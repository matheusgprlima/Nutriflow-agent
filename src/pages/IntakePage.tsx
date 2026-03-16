import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import {
  FileText, Loader2, AlertCircle, Check, Mic, Square, Watch,
  Upload, X, Sparkles, ChevronDown, PhoneCall, PhoneOff, MessageSquare, Volume2, User, Bot,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

export default function IntakePage() {
  const navigate = useNavigate();
  const {
    state, sendDietFile, setTranscript,
    addHealthScreenshot, clearHealthScreenshots, generateAdjusted,
    startLive, sendAudioChunk, sendLiveText, endLive,
  } = useSession();

  const dietInputRef = useRef<HTMLInputElement>(null);
  const healthInputRef = useRef<HTMLInputElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<'live' | 'text'>('live');
  const [micActive, setMicActive] = useState(false);
  const [liveTextInput, setLiveTextInput] = useState('');
  const [liveConnecting, setLiveConnecting] = useState(false);

  // Audio capture refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Audio playback refs
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);

  useEffect(() => {
    if (state.adjustedDiet && state.status === 'done') navigate('/results');
  }, [state.adjustedDiet, state.status, navigate]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.liveTranscript]);

  // Live audio playback listener
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail?.data;
      if (data) playAudioChunk(data);
    };
    window.addEventListener('nutriflow:live_audio', handler);
    return () => window.removeEventListener('nutriflow:live_audio', handler);
  }, []);

  // When live becomes active, start mic
  useEffect(() => {
    if (state.liveActive && !micActive) {
      startMic();
    }
    if (!state.liveActive && micActive) {
      stopMic();
    }
  }, [state.liveActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMic();
      playbackCtxRef.current?.close();
    };
  }, []);

  // When live is ready after connecting
  useEffect(() => {
    if (state.liveActive) setLiveConnecting(false);
  }, [state.liveActive]);

  const playAudioChunk = useCallback((base64: string) => {
    if (!playbackCtxRef.current) {
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = playbackCtxRef.current;
    try {
      const raw = atob(base64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now + 0.05;
      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += buffer.duration;
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  }, []);

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const targetRate = 16000;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const inputRate = ctx.sampleRate;

        // Downsample to 16kHz
        let samples: Float32Array;
        if (inputRate === targetRate) {
          samples = input;
        } else {
          const ratio = inputRate / targetRate;
          const len = Math.floor(input.length / ratio);
          samples = new Float32Array(len);
          for (let i = 0; i < len; i++) {
            const srcIdx = i * ratio;
            const idx = Math.floor(srcIdx);
            const frac = srcIdx - idx;
            samples[i] = input[idx] * (1 - frac) + (input[idx + 1] || 0) * frac;
          }
        }

        // Float32 → Int16
        const int16 = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32768)));
        }

        // Int16 → Base64
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);

        sendAudioChunk(b64);
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setMicActive(true);
    } catch (e) {
      console.error('Mic access failed:', e);
    }
  };

  const stopMic = () => {
    processorRef.current?.disconnect();
    audioCtxRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    processorRef.current = null;
    audioCtxRef.current = null;
    streamRef.current = null;
    setMicActive(false);
  };

  const handleStartLive = () => {
    setLiveConnecting(true);
    startLive();
  };

  const handleEndLive = () => {
    stopMic();
    endLive();
  };

  const handleLiveTextSend = () => {
    const text = liveTextInput.trim();
    if (!text) return;
    sendLiveText(text);
    setLiveTextInput('');
  };

  const handleDietFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || state.status === 'extracting') return;
    sendDietFile(file);
    e.target.value = '';
  };

  const handleHealthFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach(f => addHealthScreenshot(f));
    e.target.value = '';
  };

  const handleTranscriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscript(e.target.value);
  };

  const isExtracting = state.status === 'extracting';
  const dietReady = !!state.extractedDiet?.meals?.length;
  const hasContext = !!(state.transcript?.trim());
  const canGenerate = dietReady && hasContext && state.status !== 'generating' && state.status !== 'extracting';
  const isGenerating = state.status === 'generating';
  const diet = state.extractedDiet;
  const totalItems = diet?.meals?.reduce((n, m) => n + (m.items?.length ?? 0), 0) ?? 0;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Plan your day</h1>
          <p className="text-gray-400">Upload your diet, talk to the agent, and get your adjusted daily plan.</p>
        </div>

        {state.errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-200 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {state.errorMessage}
          </div>
        )}

        {/* ====== SECTION 1: Diet Upload ====== */}
        <GlassCard className="space-y-4">
          <SectionHeader step={1} done={dietReady} label="Your baseline diet" required />
          {dietReady ? (
            <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{state.fileName || 'Diet uploaded'}</p>
                  <p className="text-xs text-gray-500">{diet!.meals.length} meals · {totalItems} items · {((diet!.confidence ?? 0) * 100).toFixed(0)}% confidence</p>
                </div>
              </div>
              <button onClick={() => dietInputRef.current?.click()} className="text-xs text-gray-400 hover:text-white transition-colors shrink-0">Replace</button>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors ${isExtracting ? 'border-primary/30 opacity-70 cursor-wait' : 'border-white/10 hover:border-primary/30 cursor-pointer'}`}
              onClick={() => !isExtracting && dietInputRef.current?.click()}
            >
              {isExtracting ? (
                <><Loader2 className="w-8 h-8 text-primary animate-spin mb-3" /><p className="text-sm text-gray-300">Extracting your diet…</p><p className="text-xs text-gray-500 mt-1">10–20 seconds</p></>
              ) : (
                <><Upload className="w-8 h-8 text-gray-500 mb-3" /><p className="text-sm text-white font-medium">Drop file or click to upload</p><p className="text-xs text-gray-500 mt-1">Image or PDF · max 20 MB</p></>
              )}
            </div>
          )}
          <input ref={dietInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleDietFile} disabled={isExtracting} />
          {dietReady && diet!.extractionWarnings && diet!.extractionWarnings.length > 0 && (
            <ExtractionNotes warnings={diet!.extractionWarnings} confidence={diet!.confidence} />
          )}
        </GlassCard>

        {/* ====== SECTION 2: Activity Data (Optional) ====== */}
        <GlassCard className="space-y-4">
          <SectionHeader step={2} done={state.healthFileNames.length > 0} label="Activity & health data" optional />
          <p className="text-sm text-gray-500">Add Apple Watch or health app screenshots for better accuracy.</p>
          <div
            className="border-2 border-dashed border-white/10 hover:border-accent/30 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors"
            onClick={() => healthInputRef.current?.click()}
          >
            <input ref={healthInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleHealthFiles} />
            <Watch className="w-5 h-5 text-accent/50 mb-1" /><p className="text-sm text-gray-400">Add screenshots (up to 3)</p>
          </div>
          {state.healthFileNames.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {state.healthFileNames.map((name, i) => (
                <span key={i} className="inline-flex items-center px-2 py-1 rounded-lg bg-accent/10 text-accent text-xs truncate max-w-[160px]">{name}</span>
              ))}
              <button onClick={clearHealthScreenshots} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"><X className="w-3 h-3" /> Clear</button>
            </div>
          )}
        </GlassCard>

        {/* ====== SECTION 3: Agent Conversation ====== */}
        <GlassCard className="space-y-4" glowBorder={state.liveActive}>
          <SectionHeader step={3} done={state.liveTranscript.length > 0 || hasContext} label="Talk to your agent" required />

          {/* Mode toggle */}
          {!state.liveActive && (
            <div className="flex gap-2">
              <button
                onClick={() => setMode('live')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'live' ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'}`}
              >
                <PhoneCall className="w-3.5 h-3.5" /> Voice conversation
              </button>
              <button
                onClick={() => setMode('text')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'text' ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'}`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Text input
              </button>
            </div>
          )}

          {/* === Live conversation mode === */}
          {mode === 'live' && !state.liveActive && !liveConnecting && (
            <div className="text-center py-4 space-y-4">
              <p className="text-sm text-gray-400">Start a live voice conversation with the NutriFlow agent. It will ask about your routine and generate your daily plan.</p>
              <Button
                onClick={handleStartLive}
                disabled={!dietReady}
                icon={<PhoneCall className="w-4 h-4" />}
                className="mx-auto"
              >
                Start conversation
              </Button>
              {!dietReady && <p className="text-xs text-gray-600">Upload your diet first</p>}
            </div>
          )}

          {liveConnecting && !state.liveActive && (
            <div className="text-center py-6 space-y-2">
              <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
              <p className="text-sm text-gray-400">Connecting to agent…</p>
            </div>
          )}

          {/* Active live session */}
          {state.liveActive && (
            <div className="space-y-4">
              {/* Status bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs text-primary font-medium">Live session active</span>
                  {micActive && <span className="text-xs text-gray-500 flex items-center gap-1"><Mic className="w-3 h-3" /> Mic on</span>}
                  {state.agentSpeaking && <span className="text-xs text-accent flex items-center gap-1"><Volume2 className="w-3 h-3 animate-pulse" /> Agent speaking</span>}
                </div>
                <button
                  onClick={handleEndLive}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                  <PhoneOff className="w-3.5 h-3.5" /> End
                </button>
              </div>

              {/* Transcript */}
              <div className="bg-black/30 rounded-xl p-4 max-h-[300px] overflow-y-auto space-y-3">
                {state.liveTranscript.length === 0 && (
                  <p className="text-sm text-gray-600 italic text-center">Speak naturally — the agent is listening…</p>
                )}
                {state.liveTranscript.map((turn, i) => (
                  <div key={i} className={`flex items-start gap-2 ${turn.role === 'user' ? '' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${turn.role === 'user' ? 'bg-white/10' : 'bg-primary/10'}`}>
                      {turn.role === 'user' ? <User className="w-3 h-3 text-gray-400" /> : <Bot className="w-3 h-3 text-primary" />}
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase">{turn.role === 'user' ? 'You' : 'Agent'}</p>
                      <p className={`text-sm ${turn.role === 'user' ? 'text-gray-300' : 'text-white'}`}>{turn.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>

              {/* Live text input for typing while in live session */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={liveTextInput}
                  onChange={(e) => setLiveTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLiveTextSend()}
                  placeholder="Type a message to the agent…"
                  className="flex-1 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                />
                <Button size="sm" onClick={handleLiveTextSend} disabled={!liveTextInput.trim()}>Send</Button>
              </div>
            </div>
          )}

          {/* === Text fallback mode === */}
          {mode === 'text' && !state.liveActive && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Describe your routine, training, and eating patterns.</p>
              <textarea
                className="w-full min-h-[120px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 p-4 resize-y focus:outline-none focus:border-primary/50 text-sm"
                placeholder="e.g. I train 5x a week in the morning. On rest days I eat less. Weekends I eat more…"
                value={state.transcript ?? ''}
                onChange={handleTranscriptChange}
              />
            </div>
          )}
        </GlassCard>

        {/* ====== Text-mode CTA ====== */}
        {mode === 'text' && !state.liveActive && (
          <div className="pt-2 pb-8">
            <Button
              size="lg"
              onClick={generateAdjusted}
              disabled={!canGenerate}
              isLoading={isGenerating}
              icon={!isGenerating ? <Sparkles className="w-5 h-5" /> : undefined}
              className="w-full py-5 text-base"
            >
              {isGenerating ? 'Generating your daily plan…' : 'Generate daily plan'}
            </Button>
            {!dietReady && <p className="text-center text-xs text-gray-600 mt-3">Upload your diet to continue</p>}
            {dietReady && !hasContext && <p className="text-center text-xs text-gray-600 mt-3">Add routine context to generate</p>}
          </div>
        )}
      </div>
    </Layout>
  );
}

/* ========== Sub-components ========== */

function SectionHeader({ step, done, label, required, optional }: { step: number; done: boolean; label: string; required?: boolean; optional?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done ? 'bg-primary text-black' : 'bg-white/10 text-gray-400'}`}>
        {done ? <Check className="w-4 h-4" /> : step}
      </div>
      <h2 className="text-lg font-semibold text-white">{label}</h2>
      {required && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 uppercase tracking-wider">required</span>}
      {optional && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500 uppercase tracking-wider">optional</span>}
    </div>
  );
}

function ExtractionNotes({ warnings, confidence }: { warnings: string[]; confidence?: number }) {
  const [open, setOpen] = useState(false);
  const count = warnings.length + (confidence != null && confidence < 0.7 ? 1 : 0);
  if (count === 0) return null;
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
        <span>{count} extraction note{count > 1 ? 's' : ''}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-1 text-xs text-gray-500">
          {confidence != null && confidence < 0.7 && <p>Low confidence ({(confidence * 100).toFixed(0)}%) — some items may be inaccurate.</p>}
          {warnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      )}
    </div>
  );
}
