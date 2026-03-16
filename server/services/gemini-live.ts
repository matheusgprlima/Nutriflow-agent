import WebSocket from 'ws';
import { logError } from './logger.js';

const LIVE_MODEL = 'gemini-2.5-flash-preview-native-audio-dialog';
const LIVE_ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export type LiveCallbacks = {
  onReady: () => void;
  onAudio: (base64: string) => void;
  onInputTranscript: (text: string) => void;
  onOutputTranscript: (text: string) => void;
  onToolCall: (name: string, id: string, args: Record<string, any>) => void;
  onInterrupted: () => void;
  onError: (msg: string) => void;
  onClose: () => void;
};

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private cb: LiveCallbacks;
  private setupResolve: (() => void) | null = null;

  constructor(cb: LiveCallbacks) {
    this.cb = cb;
  }

  async connect(systemInstruction: string, tools: any[]): Promise<void> {
    const key = (process.env.GEMINI_API_KEY || process.env.API_KEY)?.trim();
    if (!key) throw new Error('GEMINI_API_KEY not set');

    const url = `${LIVE_ENDPOINT}?key=${key}`;

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;

      const timeout = setTimeout(() => {
        reject(new Error('Live session connection timed out'));
        ws.close();
      }, 15000);

      ws.on('open', () => {
        const setup: any = {
          setup: {
            model: `models/${LIVE_MODEL}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
            },
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        };
        if (tools.length > 0) {
          setup.setup.tools = [{ functionDeclarations: tools }];
        }
        ws.send(JSON.stringify(setup));
        this.setupResolve = () => {
          clearTimeout(timeout);
          resolve();
        };
      });

      ws.on('message', (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleMessage(msg);
        } catch (e) {
          logError('gemini-live:parse', e instanceof Error ? e : new Error(String(e)));
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        logError('gemini-live:ws-error', err);
        this.cb.onError('Live session connection failed');
        reject(err);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        this.cb.onClose();
      });
    });
  }

  private handleMessage(msg: any) {
    if (msg.setupComplete != null) {
      this.cb.onReady();
      this.setupResolve?.();
      this.setupResolve = null;
      return;
    }

    if (msg.serverContent) {
      const sc = msg.serverContent;

      if (sc.modelTurn?.parts) {
        for (const part of sc.modelTurn.parts) {
          if (part.inlineData?.data) {
            this.cb.onAudio(part.inlineData.data);
          }
        }
      }

      if (sc.inputTranscription?.text) {
        this.cb.onInputTranscript(sc.inputTranscription.text);
      }
      if (sc.outputTranscription?.text) {
        this.cb.onOutputTranscript(sc.outputTranscription.text);
      }
      if (sc.interrupted) {
        this.cb.onInterrupted();
      }
    }

    if (msg.toolCall?.functionCalls) {
      for (const fc of msg.toolCall.functionCalls) {
        this.cb.onToolCall(fc.name, fc.id, fc.args || {});
      }
    }
  }

  sendAudio(base64: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        realtimeInput: {
          audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
        },
      }));
    }
  }

  sendText(text: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true,
        },
      }));
    }
  }

  respondToTool(id: string, name: string, result: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        toolResponse: {
          functionResponses: [{ name, id, response: { result } }],
        },
      }));
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export function buildDietSystemInstruction(dietJson: any, healthCount: number): string {
  return `You are NutriFlow, a friendly and concise daily diet planning agent.

CONTEXT:
The user has uploaded their baseline diet plan. Here it is:
${JSON.stringify(dietJson)}

${healthCount > 0 ? `The user also provided ${healthCount} health/activity screenshot(s) from their smartwatch or health app, which were already analyzed.` : ''}

YOUR ROLE:
1. Greet the user briefly.
2. Ask about their routine for today: training schedule, rest days, stress, sleep, energy level, any unusual eating patterns.
3. Keep the conversation focused and short — 2-4 questions max.
4. When you have enough context, call the generate_adjusted_plan tool with a summary of what you learned.
5. After calling the tool, tell the user their adjusted plan is ready.

RULES:
- Be conversational but efficient. This is a planning tool, not a therapy session.
- Do NOT give medical or nutritional advice.
- Do NOT recommend supplements or medication.
- Keep responses under 3 sentences when possible.
- Speak in the same language the user speaks.`;
}

export const PLAN_TOOL_DECLARATION = {
  name: 'generate_adjusted_plan',
  description: 'Generates the final adjusted daily diet plan based on the baseline diet and the routine context gathered from this conversation. Call this when you have enough information about the user\'s day.',
  parameters: {
    type: 'OBJECT',
    properties: {
      routine_summary: {
        type: 'STRING',
        description: 'A detailed summary of the user\'s routine, training, rest, stress, and eating patterns gathered from the conversation',
      },
    },
    required: ['routine_summary'],
  },
};
