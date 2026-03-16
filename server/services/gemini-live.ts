import WebSocket from 'ws';
import { logError } from './logger.js';

const LIVE_MODELS = [
  'gemini-2.0-flash-live-001',
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.5-flash-native-audio-preview-09-2025',
];
const LIVE_ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

const OUTBOUND_LOG_MAX = 5;
type OutboundEntry = {
  at: string;
  kind: string;
  keys: string[];
  payloadShape: string;
  state: { connected: boolean; awaitingPostToolTurn: boolean; postToolOutputStarted: boolean };
};

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
  private awaitingPostToolTurn = false;
  private postToolOutputStarted = false;
  private lastToolResponseMeta: { id: string; name: string } | null = null;
  private outboundLog: OutboundEntry[] = [];

  constructor(cb: LiveCallbacks) {
    this.cb = cb;
  }

  /** Compact shape for logging: truncate base64 and long text. */
  private static payloadShape(obj: any): string {
    const s = JSON.stringify(obj, (_, v) => {
      if (typeof v === 'string' && v.length > 120) return v.slice(0, 80) + `…[${v.length}]`;
      if (typeof v === 'string' && /^[A-Za-z0-9+/=]+$/.test(v) && v.length > 60) return `[base64:${v.length}]`;
      return v;
    });
    return s.length > 500 ? s.slice(0, 480) + '…' : s;
  }

  private recordAndSend(payload: object): void {
    const keys = Object.keys(payload);
    const kind = keys[0] || 'unknown';
    const entry: OutboundEntry = {
      at: new Date().toISOString(),
      kind,
      keys,
      payloadShape: GeminiLiveSession.payloadShape(payload),
      state: {
        connected: this.connected,
        awaitingPostToolTurn: this.awaitingPostToolTurn,
        postToolOutputStarted: this.postToolOutputStarted,
      },
    };
    this.outboundLog.push(entry);
    if (this.outboundLog.length > OUTBOUND_LOG_MAX) this.outboundLog.shift();
    console.log(`[live] OUTBOUND ${entry.at} kind=${kind} keys=[${keys.join(',')}]`, entry.payloadShape.slice(0, 300));
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private dumpLastOutbound(label: string): void {
    console.log(`[live] ${label} — LAST ${this.outboundLog.length} OUTBOUND MESSAGES:`);
    this.outboundLog.forEach((e, i) => {
      console.log(`[live]   [${i + 1}] at=${e.at} kind=${e.kind} keys=[${e.keys.join(',')}] state=${JSON.stringify(e.state)}`);
      console.log(`[live]       shape=${e.payloadShape.slice(0, 400)}`);
    });
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
        console.log(`[live] WS open, sending setup for model: ${model}`, {
          hasTools: tools.length > 0,
          toolNames: tools.map((t: any) => t?.name),
          transcriptionConfig: process.env.LIVE_TRANSCRIPTION === '1',
        });
        const setupInner: any = {
          model: `models/${model}`,
          generationConfig: { responseModalities: ['TEXT'] },
          systemInstruction: { parts: [{ text: systemInstruction }] },
        };
        if (tools.length > 0) {
          setupInner.tools = [{ functionDeclarations: tools }];
        }
        if (process.env.LIVE_TRANSCRIPTION === '1') {
          setupInner.inputAudioTranscription = {};
          setupInner.outputAudioTranscription = {};
        }
        const setup = { setup: setupInner };
        this.recordAndSend(setup);
      });

      ws.on('message', (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(raw.toString());

          if (msg.error) {
            const errMsg = msg.error.message || `Gemini error ${msg.error.code || ''}`;
            console.error(`[live] Gemini error: ${errMsg}`);
            this.dumpLastOutbound('ON GEMINI ERROR');
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
        console.log(
          `[live] WS closed: code=${code} reason=${reason?.toString() || 'none'} connected=${this.connected} awaitingPostToolTurn=${this.awaitingPostToolTurn} postToolOutputStarted=${this.postToolOutputStarted}`,
        );
        this.dumpLastOutbound(`ON CLOSE code=${code}`);
        if (!settled) {
          settle(false, new Error(`WS closed before setup: code ${code}`));
        } else if (this.connected) {
          this.cb.onClose();
        }
      });
    });
  }

  private handleMessage(msg: any, onSetup: () => void) {
    console.log('[live] inbound message keys', Object.keys(msg));
    if (msg.setupComplete != null) {
      console.log('[live] setupComplete received');
      this.cb.onReady();
      onSetup();
      return;
    }

    if (msg.serverContent) {
      const sc = msg.serverContent;
      console.log('[live] serverContent keys', Object.keys(sc));
      const hasAudio = Array.isArray(sc.modelTurn?.parts)
        ? sc.modelTurn.parts.some((part: any) => !!part.inlineData?.data)
        : false;
      const partText = Array.isArray(sc.modelTurn?.parts)
        ? sc.modelTurn.parts.map((part: any) => typeof part.text === 'string' ? part.text : '').join('')
        : '';
      const outputText = partText || sc.outputTranscription?.text || '';

      if (this.awaitingPostToolTurn && !this.postToolOutputStarted && (hasAudio || outputText.trim())) {
        this.postToolOutputStarted = true;
        console.log(
          `[live] Post-tool model output started for ${this.lastToolResponseMeta?.name ?? 'unknown tool'}:${this.lastToolResponseMeta?.id ?? 'unknown id'}`,
          { hasAudio, outputTextPreview: outputText.slice(0, 120) },
        );
      }

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
      if (outputText) {
        this.cb.onOutputTranscript(outputText);
      }
      if (sc.turnComplete) {
        if (this.awaitingPostToolTurn) {
          console.log(
            `[live] Post-tool turnComplete for ${this.lastToolResponseMeta?.name ?? 'unknown tool'}:${this.lastToolResponseMeta?.id ?? 'unknown id'} | outputStarted=${this.postToolOutputStarted}`,
          );
          this.awaitingPostToolTurn = false;
          this.postToolOutputStarted = false;
          this.lastToolResponseMeta = null;
        }
        this.cb.onTurnComplete();
      }
      if (sc.interrupted) {
        if (this.awaitingPostToolTurn) {
          console.warn(
            `[live] Post-tool turn interrupted for ${this.lastToolResponseMeta?.name ?? 'unknown tool'}:${this.lastToolResponseMeta?.id ?? 'unknown id'} | outputStarted=${this.postToolOutputStarted}`,
          );
        }
        this.cb.onInterrupted();
      }
    }

    if (msg.toolCall || msg.toolCalls) {
      const calls = msg.toolCall?.functionCalls || msg.toolCalls?.functionCalls || [];
      console.log('[live] raw toolCall payload', JSON.stringify(msg.toolCall || msg.toolCalls || {}));
      for (const fc of calls) {
        console.log(`[live] toolCall received: ${fc.name}:${fc.id}`, fc.args || {});
        this.cb.onToolCall(fc.name, fc.id, fc.args || {});
      }
    }
  }

  sendAudio(base64: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.recordAndSend({
        realtimeInput: {
          audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
        },
      });
    }
  }

  sendText(text: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.recordAndSend({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true,
        },
      });
    }
  }

  respondToTool(id: string, name: string, result: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.awaitingPostToolTurn = true;
      this.postToolOutputStarted = false;
      this.lastToolResponseMeta = { id, name };
      console.log(`[live] Sending toolResponse for ${name}:${id}`, result);
      this.recordAndSend({
        toolResponse: {
          functionResponses: [{ name, id, response: { result } }],
        },
      });
    }
  }

  close() {
    if (this.ws) {
      if (this.awaitingPostToolTurn) {
        console.warn(
          `[live] Closing websocket while awaiting post-tool turn for ${this.lastToolResponseMeta?.name ?? 'unknown tool'}:${this.lastToolResponseMeta?.id ?? 'unknown id'} | outputStarted=${this.postToolOutputStarted}`,
        );
      }
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
  steps.push(`${n++}. Begin the chat with a brief acknowledgement that you've reviewed their baseline diet and have a clear picture of their usual plan.`);
  if (healthCount > 0) {
    steps.push(`${n++}. Briefly acknowledge that you also have their smartwatch or activity data and will factor it into the plan.`);
  }
  steps.push(`${n++}. Ask ONE short, focused question at a time about the user's day. Prioritize training day versus rest day first, then sleep or energy, then appetite or schedule disruption only if still needed.`);
  steps.push(`${n++}. Keep each reply concise. Do NOT write long paragraphs. Do NOT ask multiple questions in one message.`);
  steps.push(`${n++}. Stop asking questions as soon as you have enough context. Usually this should take no more than 2 or 3 questions.`);
  steps.push(`${n++}. As soon as you have enough context, say a short transition like "Perfect, I have what I need. I’m putting your plan together now." Then call the generate_adjusted_plan tool.`);
  steps.push(`${n++}. After the tool returns, deliver a concise closing message that summarizes the day, confirms the adjustment, and tells the user their plan is ready to open.`);

  const closingLetters: string[] = [];
  let letter = 'a';
  const nextLetter = () => { const l = letter; letter = String.fromCharCode(letter.charCodeAt(0) + 1); return l; };
  closingLetters.push(`${nextLetter()}) In 1–2 short sentences, summarize what you understood about the user's day. Reference specific things they told you.`);
  closingLetters.push(`${nextLetter()}) Briefly explain that you adapted portions while keeping the same baseline foods.`);
  if (healthCount > 0) {
    closingLetters.push(`${nextLetter()}) Briefly mention that you also factored in the smartwatch or activity data.`);
  }
  closingLetters.push(`${nextLetter()}) Tell the user their daily plan is ready to open in the dashboard.`);
  closingLetters.push(`${nextLetter()}) End with one short, warm encouragement.`);

  return `You are NutriFlow, a calm, confident, and friendly daily diet planning coach in a live text chat.
You help people adjust their existing diet plan for today based on how their day is going.

WHAT YOU KNOW:
You have the user's complete baseline diet: ${mealCount} meals, ${itemCount} food items.
Diet data: ${JSON.stringify(dietJson)}
${healthCount > 0 ? `The user uploaded ${healthCount} health/activity screenshot(s) from a smartwatch or health app. This data is available and will be used when generating the plan.` : ''}

CONVERSATION FLOW:
${steps.join('\n')}

YOUR CLOSING MESSAGE MUST include all of these, in this order:
${closingLetters.join('\n')}

VOICE AND TONE:
- Calm, warm, confident — like a planning coach, not a doctor or robot.
- Use short sentences. Speak naturally.
- ONE question at a time. Give the user space to answer.
- Acknowledge what the user says: "Got it, that makes sense." or "Okay, good to know."
- Keep messages concise. Prefer 1 to 3 short sentences.
- Never use clinical language — no "caloric expenditure", "macronutrient ratios", or supplement advice.
- Never give medical advice.

PACING RULES:
- Begin the session by greeting the user, acknowledging the diet, and asking your first short question.
- After asking a question, stop talking. Wait for the answer.
- Do NOT stack multiple questions in one turn.
- When transitioning to tool call, give a brief heads-up ("Let me put this together for you") so the user knows what's happening during the brief pause.
- Keep the closing message concise and clear.

ALWAYS SPEAK ENGLISH regardless of what language the user speaks.

CONSTRAINTS:
- Maximum 3 questions before generating the plan.
- Do NOT recite the diet back to the user.
- Do NOT repeat things the user already told you.
- After the tool returns success, deliver the full closing message, then stop.`;
}



export const PLAN_TOOL_DECLARATION = {
  name: 'generate_adjusted_plan',
  description: 'Generates the final adjusted daily diet plan based on the baseline diet and the routine context gathered from this conversation. Call this when you have enough information about the user\'s day.',
  parameters: {
    // IMPORTANT: Live API expects JSON Schema style, NOT the Type enum
    // used by the non-live generateContent SDK. Using the wrong shape
    // causes the server to reject tool usage with code 1008.
    type: 'object',
    properties: {
      routine_summary: {
        type: 'string',
        description: 'A detailed summary of the user\'s routine, training, rest, stress, and eating patterns gathered from the conversation',
      },
    },
    required: ['routine_summary'],
  },
};
