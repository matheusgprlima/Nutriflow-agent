import WebSocket from 'ws';
import { logError } from './logger.js';

const LIVE_MODELS = [
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.5-flash-native-audio-preview-09-2025',
  'gemini-2.0-flash-live-001',
];
const LIVE_ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export type LiveCallbacks = {
  onReady: () => void;
  onAudio: (base64: string) => void;
  onInputTranscript: (text: string) => void;
  onOutputTranscript: (text: string) => void;
  onTurnComplete: () => void;
  onToolCall: (name: string, id: string, args: Record<string, any>) => void;
  onInterrupted: () => void;
  onError: (msg: string) => void;
  onClose: () => void;
};

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private cb: LiveCallbacks;
  private connected = false;

  constructor(cb: LiveCallbacks) {
    this.cb = cb;
  }

  async connect(systemInstruction: string, tools: any[]): Promise<void> {
    const key = (process.env.GEMINI_API_KEY || process.env.API_KEY)?.trim();
    if (!key) throw new Error('GEMINI_API_KEY not set');

    const errors: string[] = [];
    for (const model of LIVE_MODELS) {
      try {
        console.log(`[live] Trying model: ${model}`);
        await this.tryConnect(key, model, systemInstruction, tools);
        console.log(`[live] Connected with model: ${model}`);
        return;
      } catch (err: any) {
        console.warn(`[live] Model ${model} failed: ${err.message}`);
        errors.push(`${model}: ${err.message}`);
        try { this.ws?.close(); } catch {}
        this.ws = null;
        this.connected = false;
      }
    }
    throw new Error(`All live models failed. ${errors.join(' | ')}`);
  }

  private tryConnect(key: string, model: string, systemInstruction: string, tools: any[]): Promise<void> {
    const url = `${LIVE_ENDPOINT}?key=${key}`;

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      this.connected = false;
      const ws = new WebSocket(url);
      this.ws = ws;

      const settle = (ok: boolean, err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (ok) {
          this.connected = true;
          resolve();
        } else {
          reject(err || new Error('Unknown'));
        }
      };

      const timeout = setTimeout(() => {
        console.error(`[live] Connection timed out for model ${model}`);
        settle(false, new Error(`Timeout connecting with ${model}`));
        try { ws.close(); } catch {}
      }, 12000);

      ws.on('open', () => {
        console.log(`[live] WS open, sending setup for model: ${model}`);
        const setup: any = {
          setup: {
            model: `models/${model}`,
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
      });

      ws.on('message', (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(raw.toString());

          if (msg.error) {
            const errMsg = msg.error.message || `Gemini error ${msg.error.code || ''}`;
            console.error(`[live] Gemini error: ${errMsg}`);
            if (!settled) {
              settle(false, new Error(errMsg));
              try { ws.close(); } catch {}
              return;
            }
            this.cb.onError(errMsg);
            try { ws.close(); } catch {}
            return;
          }

          this.handleMessage(msg, () => settle(true));
        } catch (e) {
          logError('gemini-live:parse', e instanceof Error ? e : new Error(String(e)));
        }
      });

      ws.on('error', (err) => {
        console.error(`[live] WS error:`, err.message);
        settle(false, err);
      });

      ws.on('close', (code, reason) => {
        console.log(`[live] WS closed: code=${code} reason=${reason?.toString() || 'none'} connected=${this.connected}`);
        if (!settled) {
          settle(false, new Error(`WS closed before setup: code ${code}`));
        } else if (this.connected) {
          this.cb.onClose();
        }
      });
    });
  }

  private handleMessage(msg: any, onSetup: () => void) {
    if (msg.setupComplete != null) {
      console.log('[live] setupComplete received');
      this.cb.onReady();
      onSetup();
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
      if (sc.turnComplete) {
        this.cb.onTurnComplete();
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
  const mealCount = dietJson?.meals?.length ?? 0;
  const itemCount = dietJson?.meals?.reduce((n: number, m: any) => n + (m.items?.length ?? 0), 0) ?? 0;

  const steps: string[] = [];
  let n = 1;
  steps.push(`${n++}. Greet the user warmly. Mention that you've reviewed their diet — say something like "I can see you have ${mealCount} meals in your plan with about ${itemCount} items, so I have a clear picture of your baseline." Keep it brief — one or two sentences, then move to questions.`);
  if (healthCount > 0) {
    steps.push(`${n++}. Briefly acknowledge the activity data: "I also have your health and activity information, so I'll factor that in too."`);
  }
  steps.push(`${n++}. Ask ONE focused question about their day. Good examples: "How's your day looking — is it a training day or more of a rest day?" or "Anything different about today compared to a normal day?"`);
  steps.push(`${n++}. Listen carefully. Then ask ONE follow-up based on what they said — about energy, sleep, stress, appetite, or schedule changes. Do NOT ask multiple questions at once.`);
  steps.push(`${n++}. After 2–3 exchanges, say something natural like "Great, I have a good picture of your day. Let me put your adjusted plan together." Then call the generate_adjusted_plan tool.`);
  steps.push(`${n++}. CRITICAL — After the tool returns, deliver your CLOSING MESSAGE. This is the most important part of the entire conversation. See the closing instructions below.`);

  const closingLetters: string[] = [];
  let letter = 'a';
  const nextLetter = () => { const l = letter; letter = String.fromCharCode(letter.charCodeAt(0) + 1); return l; };
  closingLetters.push(`${nextLetter()}) In 1–2 sentences, summarize what you understood about the user's day. Reference SPECIFIC things they told you — training type, rest day, energy level, sleep quality, stress, appetite, schedule. Show that you listened.`);
  closingLetters.push(`${nextLetter()}) Explain what you adjusted: "I've adapted your daily portions while keeping the same baseline foods." Be specific — mention if you increased pre-workout fuel, shifted snack timing, adjusted portions for a rest day, etc.`);
  if (healthCount > 0) {
    closingLetters.push(`${nextLetter()}) Mention: "I also factored in the activity data from your smartwatch to fine-tune things."`);
  }
  closingLetters.push(`${nextLetter()}) Direct the user to their results: "Your dashboard is ready now — you'll find the adjusted plan, nutrition breakdown, and a PDF you can download."`);
  closingLetters.push(`${nextLetter()}) End on a warm, encouraging note. Something natural like "Enjoy your meals today!" or "Have a great training day!" — match it to what they told you.`);

  return `You are NutriFlow, a calm, confident, and friendly daily diet planning coach.
You help people adjust their existing diet plan for today based on how their day is going.

WHAT YOU KNOW:
You have the user's complete baseline diet: ${mealCount} meals, ${itemCount} food items.
Diet data: ${JSON.stringify(dietJson)}
${healthCount > 0 ? `The user uploaded ${healthCount} health/activity screenshot(s) from a smartwatch or health app. This data is available and will be used when generating the plan.` : ''}

CONVERSATION FLOW:
${steps.join('\n')}

YOUR CLOSING MESSAGE MUST include all of these, in this order:
${closingLetters.join('\n')}

Take your time with the closing. Speak at a relaxed pace. Do NOT condense it into a single rushed sentence. This is the moment the user remembers.

VOICE AND TONE:
- Calm, warm, confident — like a planning coach, not a doctor or robot.
- Use short sentences. Speak naturally.
- ONE question at a time. Give the user space to answer.
- Acknowledge what the user says: "Got it, that makes sense." or "Okay, good to know."
- Never use clinical language — no "caloric expenditure", "macronutrient ratios", or supplement advice.
- Never give medical advice.

PACING RULES:
- After your greeting, pause and wait for the user to respond. Do NOT immediately ask a question in the same breath as the greeting.
- After asking a question, stop talking. Wait for the answer.
- Do NOT stack multiple questions in one turn.
- When transitioning to tool call, give a brief heads-up ("Let me put this together for you") so the user knows what's happening during the brief pause.
- The closing message should be spoken at a relaxed, natural pace — not a speed-run.

ALWAYS SPEAK ENGLISH regardless of what language the user speaks.

CONSTRAINTS:
- Maximum 3 questions before generating the plan.
- Do NOT recite the diet back to the user.
- Do NOT repeat things the user already told you.
- After the tool returns success, deliver the FULL closing message. Do NOT cut it short. The user will be automatically redirected to the dashboard after you finish speaking, so take your time.`;
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
