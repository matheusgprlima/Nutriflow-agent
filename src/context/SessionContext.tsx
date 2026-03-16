import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { SessionState, ClientWsMessage, ServerWsMessage } from '../shared/schemas';

type SessionContextValue = {
  state: SessionState;
  sendDietFile: (file: File) => void;
  setTranscript: (text: string) => void;
  addHealthScreenshot: (file: File) => void;
  clearHealthScreenshots: () => void;
  generateAdjusted: () => void;
  reset: () => void;
};

const initialState: SessionState = {
  status: 'idle',
  logs: [],
  healthScreenshotCount: 0,
  healthFileNames: [],
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

  const flushPending = useCallback((ws: WebSocket) => {
    while (pendingRef.current.length > 0) {
      const msg = pendingRef.current.shift()!;
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const ensureConnected = useCallback((): WebSocket => {
    const existing = wsRef.current;
    if (existing && existing.readyState === WebSocket.OPEN) return existing;
    if (existing && existing.readyState === WebSocket.CONNECTING) return existing;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setState((s) => ({ ...s, logs: [...s.logs, 'Connected'] }));
      flushPending(ws);
    };
    ws.onclose = () => setState((s) => ({ ...s, logs: [...s.logs, 'Disconnected'] }));
    ws.onerror = () => setState((s) => ({ ...s, status: 'error', errorMessage: 'Connection error' }));

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerWsMessage;
        switch (msg.type) {
          case 'progress':
            setState((s) => ({
              ...s,
              status: msg.payload.step === 'extracting' ? 'extracting' : 'generating',
              logs: [...s.logs, msg.payload.detail || msg.payload.step],
            }));
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
            setState((s) => ({ ...s, adjustedDiet: msg.payload, status: 'done', logs: [...s.logs, 'Daily plan ready'] }));
            break;
          default:
            if (msg.type === 'adjusted_diet_error' || msg.type === 'error') {
              setState((s) => ({ ...s, status: 'error', errorMessage: (msg as any).payload?.message || 'Error' }));
            }
        }
      } catch (e) {
        console.error('[WS msg]', e);
      }
    };

    return ws;
  }, [flushPending]);

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

  const reset = useCallback(() => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    transcriptRef.current = '';
    pendingRef.current = [];
    setState(initialState);
  }, []);

  const value: SessionContextValue = { state, sendDietFile, setTranscript, addHealthScreenshot, clearHealthScreenshots, generateAdjusted, reset };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
