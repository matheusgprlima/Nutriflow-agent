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
    console.log('[ws] Client connected');
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
            console.log('[ws] start_live received');
            if (!session.extractedDiet) {
              console.log('[ws] No diet extracted, rejecting start_live');
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
              onReady: () => {
                console.log('[ws] Live session ready, sending live_ready to client');
                send(ws, { type: 'live_ready' });
              },
              onAudio: (data) => send(ws, { type: 'live_audio', payload: { data } }),
              onInputTranscript: (text) => send(ws, { type: 'live_input_transcript', payload: { text } }),
              onOutputTranscript: (text) => send(ws, { type: 'live_output_transcript', payload: { text } }),
              onTurnComplete: () => {
                console.log('[ws] turnComplete → sending live_turn_complete to client');
                send(ws, { type: 'live_turn_complete' });
              },
              onInterrupted: () => {
                console.warn('[ws] Gemini reported interruption during live turn');
                send(ws, { type: 'live_interrupted' });
              },
              onError: (message) => {
                console.error('[ws] Live session error:', message);
                send(ws, { type: 'live_error', payload: { message } });
              },
              onClose: () => {
                console.log('[ws] Live session closed');
                session.liveSession = null;
                send(ws, { type: 'live_ended' });
              },
              onToolCall: async (name, id, args) => {
                console.log(`[ws] Tool call: ${name}`, args);
                if (name === 'generate_adjusted_plan') {
                  const startedAt = Date.now();
                  try {
                    const routineSummary = args.routine_summary || 'No specific routine provided.';
                    console.log(`[ws] Starting generateAdjustedDiet for tool ${name}:${id}`);
                    send(ws, { type: 'progress', payload: { step: 'generating', detail: 'Agent is generating your plan…' } });
                    const result = await generateAdjustedDiet(
                      session.extractedDiet!,
                      routineSummary,
                      session.healthScreenshots.length > 0 ? session.healthScreenshots : undefined,
                    ) as AdjustedDiet;

                    if (result?.meals?.length) {
                      console.log(`[ws] Tool success after ${Date.now() - startedAt}ms: sending adjusted_diet + respondToTool`);
                      send(ws, { type: 'adjusted_diet', payload: result });
                      const totalItems = result.meals.reduce((n: number, m: any) => n + (m.items?.length || 0), 0);
                      const changedItems = result.meals.flatMap((m: any) => m.items || []).filter((it: any) => it.previousQuantity != null && it.previousQuantity !== it.quantity).length;
                      live.respondToTool(id, name, {
                        status: 'success',
                        meals_adjusted: result.meals.length,
                        total_items: totalItems,
                        items_with_changes: changedItems,
                        summary: `Adjusted ${changedItems} of ${totalItems} food items across ${result.meals.length} meals. The dashboard is ready for the user.`,
                      });
                    } else {
                      console.warn(`[ws] Tool returned empty result after ${Date.now() - startedAt}ms`);
                      live.respondToTool(id, name, { status: 'failed', reason: 'Could not generate adjusted plan. Apologize briefly and suggest the user try again.' });
                    }
                  } catch (err) {
                    console.error(`[ws] Tool execution failed after ${Date.now() - startedAt}ms`);
                    logError('live:tool:generate', err instanceof Error ? err : new Error(String(err)));
                    live.respondToTool(id, name, { status: 'failed', reason: 'Generation encountered an error. Apologize and suggest the user try again.' });
                  }
                }
              },
            });

            try {
              const useTools = process.env.LIVE_NO_TOOLS !== '1';
              const tools = useTools ? [PLAN_TOOL_DECLARATION] : [];
              console.log('[ws] Connecting to Gemini Live...', { useTools, toolsCount: tools.length });
              await live.connect(sysInstruction, tools);
              session.liveSession = live;
              console.log('[ws] Gemini Live connected and assigned to session');
            } catch (err: any) {
              console.error('[ws] Live connect failed:', err.message);
              logError('live:connect', err instanceof Error ? err : new Error(String(err)));
              send(ws, { type: 'live_error', payload: { message: `Could not start live agent: ${err.message}. Use text mode instead.` } });
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
            console.log('[ws] end_live received');
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
      console.log('[ws] Client disconnected');
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
