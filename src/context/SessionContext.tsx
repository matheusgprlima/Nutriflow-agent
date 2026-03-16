import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { SessionState, ClientWsMessage, ServerWsMessage, LiveTurn } from '../shared/schemas';

type SessionContextValue = {
  state: SessionState;
  sendDietFile: (file: File) => void;
  setTranscript: (text: string) => void;
  addHealthScreenshot: (file: File) => void;
  clearHealthScreenshots: () => void;
  generateAdjusted: () => void;
  startLive: () => void;
  sendAudioChunk: (base64: string) => void;
  sendLiveText: (text: string) => void;
  endLive: () => void;
  reset: () => void;
};

const initialState: SessionState = {
  status: 'idle',
  logs: [],
  healthScreenshotCount: 0,
  healthFileNames: [],
  liveTranscript: [],
  liveActive: false,
  agentSpeaking: false,
  planReady: false,
  closingDone: false,
};

const SessionContext = createContext<SessionContextValue | null>(null);

function getWsUrl() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws`;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const transcriptRef = useRef('');
  const pendingRef = useRef<ClientWsMessage[]>([]);
  const liveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPending = useCallback((ws: WebSocket) => {
    while (pendingRef.current.length > 0) {
      const msg = pendingRef.current.shift()!;
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const clearLiveTimeout = useCallback(() => {
    if (liveTimeoutRef.current) {
      clearTimeout(liveTimeoutRef.current);
      liveTimeoutRef.current = null;
    }
  }, []);

  const ensureConnected = useCallback((): WebSocket => {
    const existing = wsRef.current;
    if (existing && existing.readyState === WebSocket.OPEN) return existing;
    if (existing && existing.readyState === WebSocket.CONNECTING) return existing;

    console.log('[ctx] Opening WS to', getWsUrl());
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[ctx] WS connected');
      setState((s) => ({ ...s, logs: [...s.logs, 'Connected'] }));
      flushPending(ws);
    };
    ws.onclose = () => {
      console.log('[ctx] WS disconnected');
      clearLiveTimeout();
      setState((s) => ({
        ...s,
        logs: [...s.logs, 'Disconnected'],
        liveActive: false,
        agentSpeaking: false,
        status: s.status === 'live' || s.status === 'live_connecting'
          ? (s.adjustedDiet ? 'done' : 'ready')
          : s.status,
      }));
    };
    ws.onerror = () => {
      console.error('[ctx] WS error');
      clearLiveTimeout();
      setState((s) => ({ ...s, status: 'error', errorMessage: 'Connection lost. Please refresh and try again.', liveActive: false }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerWsMessage;
        switch (msg.type) {
          case 'progress':
            setState((s) => {
              if (s.status === 'live' || s.status === 'live_connecting') {
                return { ...s, liveGenerating: true, logs: [...s.logs, msg.payload.detail || msg.payload.step] };
              }
              return {
                ...s,
                status: msg.payload.step === 'extracting' ? 'extracting' : 'generating',
                logs: [...s.logs, msg.payload.detail || msg.payload.step],
              };
            });
            break;
          case 'extraction_result':
            setState((s) => ({ ...s, extractedDiet: msg.payload.diet, status: 'ready', logs: [...s.logs, 'Diet extracted'] }));
            break;
          case 'extraction_error':
            setState((s) => ({ ...s, status: 'error', errorMessage: msg.payload.message }));
            break;
          case 'health_uploaded':
            setState((s) => ({ ...s, healthScreenshotCount: msg.payload.count }));
            break;
          case 'health_cleared':
            setState((s) => ({ ...s, healthScreenshotCount: 0, healthFileNames: [] }));
            break;
          case 'adjusted_diet':
            console.log('[ctx] adjusted_diet received, liveActive=', state.liveActive);
            setState((s) => ({
              ...s,
              adjustedDiet: msg.payload,
              liveGenerating: false,
              planReady: true,
              status: s.liveActive ? 'live' : 'done',
              logs: [...s.logs, 'Daily plan ready'],
            }));
            break;

          // Live session messages
          case 'live_ready':
            console.log('[ctx] live_ready received');
            clearLiveTimeout();
            setState((s) => ({ ...s, liveActive: true, status: 'live', errorMessage: null, logs: [...s.logs, 'Live session started'] }));
            break;
          case 'live_audio':
            window.dispatchEvent(new CustomEvent('nutriflow:live_audio', { detail: { data: msg.payload.data } }));
            setState((s) => s.agentSpeaking ? s : { ...s, agentSpeaking: true });
            break;
          case 'live_input_transcript': {
            const text = msg.payload.text;
            if (text.trim()) {
              setState((s) => {
                const turns = [...s.liveTranscript];
                const last = turns[turns.length - 1];
                if (last?.role === 'user') {
                  turns[turns.length - 1] = { role: 'user', text: last.text + text };
                } else {
                  turns.push({ role: 'user', text });
                }
                return { ...s, liveTranscript: turns, agentSpeaking: false };
              });
            }
            break;
          }
          case 'live_output_transcript': {
            const text = msg.payload.text;
            if (text.trim()) {
              setState((s) => {
                const turns = [...s.liveTranscript];
                const last = turns[turns.length - 1];
                if (last?.role === 'agent') {
                  turns[turns.length - 1] = { role: 'agent', text: last.text + text };
                } else {
                  turns.push({ role: 'agent', text });
                }
                return { ...s, liveTranscript: turns, agentSpeaking: true };
              });
            }
            break;
          }
          case 'live_interrupted':
            setState((s) => ({ ...s, agentSpeaking: false }));
            break;
          case 'live_turn_complete':
            setState((s) => ({
              ...s,
              agentSpeaking: false,
              closingDone: s.planReady ? true : s.closingDone,
            }));
            break;
          case 'live_error':
            console.error('[ctx] live_error:', msg.payload.message);
            clearLiveTimeout();
            setState((s) => ({
              ...s,
              liveActive: false,
              agentSpeaking: false,
              liveGenerating: false,
              status: s.adjustedDiet ? 'done' : 'ready',
              errorMessage: msg.payload.message,
            }));
            break;
          case 'live_ended':
            console.log('[ctx] live_ended');
            clearLiveTimeout();
            setState((s) => ({
              ...s,
              liveActive: false,
              agentSpeaking: false,
              liveGenerating: false,
              status: s.adjustedDiet ? 'done' : (s.status === 'live_connecting' ? 'ready' : (s.status === 'live' ? 'ready' : s.status)),
            }));
            break;

          default:
            if (msg.type === 'adjusted_diet_error' || msg.type === 'error') {
              setState((s) => ({ ...s, status: 'error', errorMessage: (msg as any).payload?.message || 'Error' }));
            }
        }
      } catch (e) {
        console.error('[ctx] WS msg parse error:', e);
      }
    };

    return ws;
  }, [flushPending, clearLiveTimeout]);

  const send = useCallback((message: ClientWsMessage) => {
    const ws = ensureConnected();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      pendingRef.current.push(message);
    }
  }, [ensureConnected]);

  const sendDietFile = useCallback((file: File) => {
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size === 0) { setState((s) => ({ ...s, status: 'error', errorMessage: 'File is empty.' })); return; }
    if (file.size > MAX_SIZE) { setState((s) => ({ ...s, status: 'error', errorMessage: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 20 MB.` })); return; }
    setState((s) => ({ ...s, status: 'extracting', errorMessage: null, fileName: file.name }));
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (!base64) { setState((s) => ({ ...s, status: 'error', errorMessage: 'Could not read file.' })); return; }
      send({ type: 'diet_upload', payload: { base64, mimeType: file.type, filename: file.name } });
    };
    reader.onerror = () => { setState((s) => ({ ...s, status: 'error', errorMessage: 'Failed to read file.' })); };
    reader.readAsDataURL(file);
  }, [send]);

  const addHealthScreenshot = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) { setState((s) => ({ ...s, errorMessage: 'Screenshot too large (max 10 MB).' })); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (!base64) return;
      send({ type: 'health_upload', payload: { base64, mimeType: file.type, filename: file.name } });
      setState((s) => ({ ...s, healthFileNames: [...s.healthFileNames, file.name], errorMessage: null }));
    };
    reader.readAsDataURL(file);
  }, [send]);

  const clearHealthScreenshots = useCallback(() => { send({ type: 'clear_health' }); }, [send]);

  const setTranscript = useCallback((text: string) => {
    transcriptRef.current = text;
    setState((s) => ({ ...s, transcript: text }));
  }, []);

  const generateAdjusted = useCallback(() => {
    setState((s) => ({ ...s, status: 'generating', errorMessage: null }));
    send({ type: 'transcript', payload: { text: transcriptRef.current } });
    send({ type: 'generate_adjusted' });
  }, [send]);

  const startLive = useCallback(() => {
    console.log('[ctx] startLive called');
    clearLiveTimeout();
    setState((s) => ({ ...s, status: 'live_connecting', errorMessage: null, liveTranscript: [], agentSpeaking: false, liveActive: false, planReady: false, closingDone: false, liveGenerating: false }));
    send({ type: 'start_live' });

    liveTimeoutRef.current = setTimeout(() => {
      console.error('[ctx] Client-side live connection timeout (20s)');
      setState((s) => {
        if (s.status === 'live_connecting') {
          return { ...s, status: 'ready', errorMessage: 'Live agent connection timed out. Try again or use text mode.' };
        }
        return s;
      });
    }, 20000);
  }, [send, clearLiveTimeout]);

  const sendAudioChunk = useCallback((base64: string) => {
    send({ type: 'audio_chunk', payload: { data: base64 } });
  }, [send]);

  const sendLiveText = useCallback((text: string) => {
    send({ type: 'live_text', payload: { text } });
    setState((s) => ({
      ...s,
      liveTranscript: [...s.liveTranscript, { role: 'user', text }],
    }));
  }, [send]);

  const endLive = useCallback(() => {
    clearLiveTimeout();
    send({ type: 'end_live' });
  }, [send, clearLiveTimeout]);

  const reset = useCallback(() => {
    clearLiveTimeout();
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    transcriptRef.current = '';
    pendingRef.current = [];
    setState(initialState);
  }, [clearLiveTimeout]);

  const value: SessionContextValue = {
    state, sendDietFile, setTranscript, addHealthScreenshot,
    clearHealthScreenshots, generateAdjusted,
    startLive, sendAudioChunk, sendLiveText, endLive, reset,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
