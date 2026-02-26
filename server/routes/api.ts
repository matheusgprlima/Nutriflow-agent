import express from 'express';
import multer from 'multer';
import { dbService } from '../services/db.js';
import { saveFile } from '../services/storage.js';
import { extractDiet, extractMetrics, generatePlan, generateNavigatorActions } from '../services/gemini.js';
import { DateTime } from 'luxon';
import { z } from 'zod';
import crypto from 'crypto';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// --- Upload Endpoint ---
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = await saveFile(req.file);
    const id = crypto.randomUUID();
    
    // Save metadata to DB
    dbService.saveUpload(id, filename, req.file.originalname, req.file.mimetype);

    res.json({ id, filename, originalName: req.file.originalname });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// --- Extract Endpoint ---
router.post('/extract', async (req, res) => {
  try {
    const { type, fileId, timezone } = req.body;
    
    // In a real app, we would look up the file path from DB using fileId
    // For this demo, we assume fileId is the full path returned by upload
    // (In production, never expose full paths to client)
    const filePath = fileId; 

    if (!filePath) {
      return res.status(400).json({ error: 'Missing fileId' });
    }

    let result;
    if (type === 'diet') {
      result = await extractDiet(filePath, 'image/jpeg'); // Assuming JPEG for now
      // Save template to DB
      dbService.saveDietTemplate(crypto.randomUUID(), result);
    } else if (type === 'metrics') {
      result = await extractMetrics(filePath, 'image/jpeg');
      // Save metrics to DB
      const localDate = DateTime.now().setZone(timezone || 'UTC').toISODate();
      dbService.saveDailyMetrics(crypto.randomUUID(), localDate, result);
    } else {
      return res.status(400).json({ error: 'Invalid extraction type' });
    }

    res.json(result);
  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({ error: 'Extraction failed' });
  }
});

// --- Plan Endpoint ---
router.post('/plan', async (req, res) => {
  try {
    const { timezone, goal } = req.body;
    
    if (!timezone) {
      return res.status(400).json({ error: 'Timezone required' });
    }

    // Get latest diet template
    const diet = dbService.getLatestDietTemplate();
    if (!diet) {
      return res.status(400).json({ error: 'No diet template found. Please upload one first.' });
    }

    // Get today's metrics
    const today = DateTime.now().setZone(timezone).toISODate();
    const metrics = dbService.getDailyMetrics(today);
    
    // If no metrics for today, we might want to warn or use defaults
    // For now, proceed with empty metrics if missing, but ideally we block
    
    const plan = await generatePlan(diet, metrics || {}, goal || { mode: 'maintenance' }, timezone);
    
    // Save plan
    const tomorrow = DateTime.now().setZone(timezone).plus({ days: 1 }).toISODate();
    dbService.savePlan(crypto.randomUUID(), tomorrow, plan);

    res.json(plan);
  } catch (error) {
    console.error('Plan generation error:', error);
    res.status(500).json({ error: 'Plan generation failed' });
  }
});

// --- Actions Endpoint ---
router.post('/actions', async (req, res) => {
  try {
    const { plan } = req.body;
    const actions = await generateNavigatorActions(plan);
    res.json(actions);
  } catch (error) {
    console.error('Actions generation error:', error);
    res.status(500).json({ error: 'Actions generation failed' });
  }
});

// --- Get Data Endpoint ---
router.get('/data', async (req, res) => {
  try {
    const diet = dbService.getLatestDietTemplate();
    const today = DateTime.now().setZone(req.query.timezone as string || 'UTC').toISODate();
    const metrics = dbService.getDailyMetrics(today);
    
    res.json({ diet, metrics });
  } catch (error) {
    console.error('Get data error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

export default router;
