import type { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { extractDietFromBuffer, generateAdjustedDiet } from './services/gemini.js';
import { GeminiLiveSession, buildDietSystemInstruction, PLAN_TOOL_DECLARATION } from './services/gemini-live.js';
import { logError } from './services/logger.js';
import type { ExtractedDiet, AdjustedDiet } from '../src/shared/schemas.js';

type HealthShot = { base64: string; mimeType: string };

type Session = {
  extractedDiet: ExtractedDiet | null;
  transcript: string;
  healthScreenshots: HealthShot[];
  liveSession: GeminiLiveSession | null;
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
    const session: Session = { extractedDiet: null, transcript: '', healthScreenshots: [], liveSession: null };

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

          // ========== Live session handlers ==========

          case 'start_live': {
            if (!session.extractedDiet) {
              send(ws, { type: 'live_error', payload: { message: 'Upload your diet first.' } });
              return;
            }
            if (session.liveSession) {
              session.liveSession.close();
              session.liveSession = null;
            }

            const sysInstruction = buildDietSystemInstruction(
              session.extractedDiet,
              session.healthScreenshots.length,
            );

            const live = new GeminiLiveSession({
              onReady: () => send(ws, { type: 'live_ready' }),
              onAudio: (data) => send(ws, { type: 'live_audio', payload: { data } }),
              onInputTranscript: (text) => send(ws, { type: 'live_input_transcript', payload: { text } }),
              onOutputTranscript: (text) => send(ws, { type: 'live_output_transcript', payload: { text } }),
              onInterrupted: () => send(ws, { type: 'live_interrupted' }),
              onError: (message) => send(ws, { type: 'live_error', payload: { message } }),
              onClose: () => {
                session.liveSession = null;
                send(ws, { type: 'live_ended' });
              },
              onToolCall: async (name, id, args) => {
                if (name === 'generate_adjusted_plan') {
                  try {
                    const routineSummary = args.routine_summary || 'No specific routine provided.';
                    const result = await generateAdjustedDiet(
                      session.extractedDiet!,
                      routineSummary,
                      session.healthScreenshots.length > 0 ? session.healthScreenshots : undefined,
                    ) as AdjustedDiet;

                    if (result?.meals?.length) {
                      send(ws, { type: 'adjusted_diet', payload: result });
                      live.respondToTool(id, name, { success: true, message: 'Daily plan generated successfully. Tell the user their plan is ready and they can view it now.' });
                    } else {
                      live.respondToTool(id, name, { success: false, message: 'Could not generate the plan. Ask the user to try again.' });
                    }
                  } catch (err) {
                    logError('live:tool:generate', err instanceof Error ? err : new Error(String(err)));
                    live.respondToTool(id, name, { success: false, message: 'Generation failed. Ask the user to try the text fallback.' });
                  }
                }
              },
            });

            try {
              await live.connect(sysInstruction, [PLAN_TOOL_DECLARATION]);
              session.liveSession = live;
            } catch (err) {
              logError('live:connect', err instanceof Error ? err : new Error(String(err)));
              send(ws, { type: 'live_error', payload: { message: 'Could not start live session. Try the text input instead.' } });
            }
            return;
          }

          case 'audio_chunk': {
            if (session.liveSession?.isOpen) {
              session.liveSession.sendAudio(msg.payload?.data ?? '');
            }
            return;
          }

          case 'live_text': {
            if (session.liveSession?.isOpen) {
              session.liveSession.sendText(msg.payload?.text ?? '');
            }
            return;
          }

          case 'end_live': {
            if (session.liveSession) {
              session.liveSession.close();
              session.liveSession = null;
            }
            send(ws, { type: 'live_ended' });
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
      if (session.liveSession) {
        session.liveSession.close();
        session.liveSession = null;
      }
      session.extractedDiet = null;
      session.transcript = '';
      session.healthScreenshots = [];
    });
  });

  return wss;
}
