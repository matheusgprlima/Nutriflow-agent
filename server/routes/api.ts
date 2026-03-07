import express from 'express';
import multer from 'multer';
import { dbService } from '../services/db.js';
import { saveFile } from '../services/storage.js';
import { extractDiet, extractMetrics, generatePlan, generateNavigatorActions, checkLegibility } from '../services/gemini.js';
import { DateTime } from 'luxon';
import crypto from 'crypto';

const router = express.Router();

// Log all API requests
router.use((req, res, next) => {
  console.log(`API Request: ${req.method} ${req.path}`);
  next();
});

// Enforce 25MB limit
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } 
});

// --- Run Management ---

router.post('/runs/create', (req, res) => {
  try {
    const { timezone } = req.body;
    const runId = crypto.randomUUID();
    const run = {
      id: runId,
      userId: 'dev-user', // Mock user
      localDate: DateTime.now().setZone(timezone || 'UTC').toISODate(),
      timezone: timezone || 'UTC',
      status: 'draft',
      uploads: [],
      extraction: {
        dietTemplate: null,
        dailyMetrics: null,
        bioImpedance: null,
        legibilityReport: null
      },
      plan: null,
      actions: null,
      issues: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    dbService.createRun(run);
    res.json({ runId, run });
  } catch (error: any) {
    console.error('Create run error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/runs/:runId', (req, res) => {
  try {
    const run = dbService.getRun(req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Uploads ---

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { runId, category, timezone } = req.body;
    if (!runId) return res.status(400).json({ error: 'runId required' });

    const filepath = await saveFile(req.file, category || 'uncategorized', timezone || 'UTC');
    const fileId = crypto.randomUUID();
    
    // Update Run
    const run = dbService.getRun(runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });

    const newUpload = {
      category,
      fileId,
      storagePath: filepath,
      mimeType: req.file.mimetype,
      bytes: req.file.size,
      filename: req.file.originalname
    };

    const updatedUploads = [...(run.uploads || []), newUpload];
    dbService.updateRun(runId, { uploads: updatedUploads });

    res.json({ success: true, file: newUpload });
  } catch (error: any) {
    console.error('Upload error details:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// --- Processing Flow ---

router.post('/runs/:runId/start', async (req, res) => {
  try {
    const { runId } = req.params;
    const run = dbService.getRun(runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });

    // Update status to processing
    dbService.updateRun(runId, { status: 'processing', issues: [] });

    // Trigger async processing (fire and forget for response, but await for logic here since we don't have a job queue)
    // In a real app, this would be a background job. Here we'll do it and client polls.
    processRun(runId).catch(err => {
      console.error(`Background processing failed for run ${runId}:`, err);
      dbService.updateRun(runId, { status: 'failed', issues: [err.message] });
    });

    res.json({ success: true, status: 'processing' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function processRun(runId: string) {
  const run = dbService.getRun(runId);
  if (!run) return;

  try {
    // 1. Legibility Check
    const dietFiles = run.uploads.filter((u: any) => u.category === 'diet');
    const metricsFiles = run.uploads.filter((u: any) => u.category === 'metrics');

    if (dietFiles.length === 0 || metricsFiles.length === 0) {
      throw new Error("Missing required files");
    }

    // Check Diet Legibility
    // Assuming first file for now, or check all.
    const dietPaths = dietFiles.map((u: any) => u.storagePath);
    const dietLegibility = await checkLegibility(dietPaths, dietFiles[0].mimeType);

    if (!dietLegibility.passed) {
      dbService.updateRun(runId, { 
        status: 'needs_reupload', 
        extraction: { ...run.extraction, legibilityReport: dietLegibility },
        issues: [`Diet file issue: ${dietLegibility.reason}`]
      });
      return;
    }

    // 2. Extraction
    const dietTemplate = await extractDiet(dietPaths, dietFiles[0].mimeType);
    const metricsPaths = metricsFiles.map((u: any) => u.storagePath);
    const dailyMetrics = await extractMetrics(metricsPaths, metricsFiles[0].mimeType);

    dbService.updateRun(runId, {
      status: 'ready_for_review',
      extraction: {
        dietTemplate,
        dailyMetrics,
        legibilityReport: dietLegibility
      }
    });

  } catch (error: any) {
    console.error("Processing Logic Error:", error);
    dbService.updateRun(runId, { status: 'failed', issues: [error.message] });
  }
}

router.patch('/runs/:runId/dietTemplate', (req, res) => {
  try {
    const { runId } = req.params;
    const { dietTemplate } = req.body;
    const run = dbService.getRun(runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });

    dbService.updateRun(runId, {
      extraction: { ...run.extraction, dietTemplate }
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/runs/:runId/plan', async (req, res) => {
  try {
    const { runId } = req.params;
    const run = dbService.getRun(runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });

    const plan = await generatePlan(
      run.extraction.dietTemplate, 
      run.extraction.dailyMetrics, 
      { mode: 'maintenance' }, // Default goal
      run.timezone
    );

    dbService.updateRun(runId, {
      status: 'planned',
      plan
    });

    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/runs/:runId/actions', async (req, res) => {
  try {
    const { runId } = req.params;
    const run = dbService.getRun(runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });

    const actions = await generateNavigatorActions(run.plan);

    dbService.updateRun(runId, {
      status: 'actions_ready',
      actions
    });

    res.json(actions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
