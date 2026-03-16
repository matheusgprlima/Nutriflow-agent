import type { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { extractDietFromBuffer, generateAdjustedDiet } from './services/gemini.js';
import { logError } from './services/logger.js';
import type { ExtractedDiet, AdjustedDiet } from '../src/shared/schemas.js';

type HealthShot = { base64: string; mimeType: string };

type Session = {
  extractedDiet: ExtractedDiet | null;
  transcript: string;
  healthScreenshots: HealthShot[];
};

const MAX_HEALTH = 3;

function send(ws: WebSocket, msg: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function attachWs(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const session: Session = { extractedDiet: null, transcript: '', healthScreenshots: [] };

    ws.on('message', async (raw: Buffer | string) => {
      let msg: { type: string; payload?: any };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: 'error', payload: { message: 'Invalid JSON' } });
        return;
      }

      try {
        switch (msg.type) {
          case 'diet_upload': {
            const { base64, mimeType } = msg.payload || {};
            if (!base64 || !mimeType) {
              send(ws, { type: 'extraction_error', payload: { message: 'Missing file data.' } });
              return;
            }
            send(ws, { type: 'progress', payload: { step: 'extracting', detail: 'Reading diet…' } });
            const diet = await extractDietFromBuffer(base64, mimeType);
            if (!diet?.meals?.length) {
              send(ws, { type: 'extraction_error', payload: { message: 'Could not extract diet from file.' } });
              return;
            }
            session.extractedDiet = diet;
            send(ws, { type: 'extraction_result', payload: { diet } });
            return;
          }

          case 'transcript': {
            session.transcript = msg.payload?.text ?? '';
            return;
          }

          case 'health_upload': {
            const { base64, mimeType } = msg.payload || {};
            if (!base64 || !mimeType) {
              send(ws, { type: 'error', payload: { message: 'Missing health data.' } });
              return;
            }
            if (session.healthScreenshots.length >= MAX_HEALTH) {
              send(ws, { type: 'error', payload: { message: `Max ${MAX_HEALTH} screenshots.` } });
              return;
            }
            session.healthScreenshots.push({ base64, mimeType });
            send(ws, { type: 'health_uploaded', payload: { count: session.healthScreenshots.length } });
            return;
          }

          case 'clear_health': {
            session.healthScreenshots = [];
            send(ws, { type: 'health_cleared', payload: { count: 0 } });
            return;
          }

          case 'generate_adjusted': {
            if (!session.extractedDiet) {
              send(ws, { type: 'adjusted_diet_error', payload: { message: 'No diet extracted yet.' } });
              return;
            }
            send(ws, { type: 'progress', payload: { step: 'generating', detail: 'Planning your day…' } });
            const result = await generateAdjustedDiet(
              session.extractedDiet,
              session.transcript || 'No specific routine provided.',
              session.healthScreenshots.length > 0 ? session.healthScreenshots : undefined,
            ) as AdjustedDiet;
            if (!result?.meals?.length) {
              send(ws, { type: 'adjusted_diet_error', payload: { message: 'Could not generate daily plan.' } });
              return;
            }
            send(ws, { type: 'adjusted_diet', payload: result });
            return;
          }

          default:
            send(ws, { type: 'error', payload: { message: `Unknown message type: ${msg.type}` } });
        }
      } catch (err: any) {
        logError('ws:handler', err, { msgType: msg.type });
        send(ws, { type: 'error', payload: { message: 'Something went wrong. Please try again.' } });
      }
    });

    ws.on('close', () => {
      session.extractedDiet = null;
      session.transcript = '';
      session.healthScreenshots = [];
    });
  });

  return wss;
}
