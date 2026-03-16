import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import {
  FileText, Loader2, AlertCircle, Check, Mic, Square, Watch,
  Upload, X, Sparkles, ChevronDown, Volume2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

const SpeechAPI: any = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

type AudioState =
  | 'idle'
  | 'recording'
  | 'stopping'
  | 'done'
  | 'error';

export default function IntakePage() {
  const navigate = useNavigate();
  const {
    state, sendDietFile, setTranscript,
    addHealthScreenshot, clearHealthScreenshots, generateAdjusted,
  } = useSession();

  const dietInputRef = useRef<HTMLInputElement>(null);
  const healthInputRef = useRef<HTMLInputElement>(null);

  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [interimText, setInterimText] = useState('');
  const [voiceCharsAdded, setVoiceCharsAdded] = useState(0);
  const [audioErrorMsg, setAudioErrorMsg] = useState<string | null>(null);

  const shouldRecordRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalizedRef = useRef(state.transcript ?? '');

  useEffect(() => {
    if (state.adjustedDiet && state.status === 'done') navigate('/results');
  }, [state.adjustedDiet, state.status, navigate]);

  useEffect(() => {
    finalizedRef.current = state.transcript ?? '';
  }, [state.transcript]);

  useEffect(() => {
    return () => {
      shouldRecordRef.current = false;
      recognitionRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    };
  }, []);

  const startRecording = () => {
    if (!SpeechAPI) {
      setAudioState('error');
      setAudioErrorMsg('Voice input not supported in this browser. Please use the text field.');
      return;
    }

    setAudioErrorMsg(null);
    setInterimText('');
    setVoiceCharsAdded(0);
    shouldRecordRef.current = true;
    setRecordingTime(0);

    const recognition = new SpeechAPI();
    recognition.lang = navigator.language || 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const before = finalizedRef.current;
          finalizedRef.current = before ? before + ' ' + text : text;
          setTranscript(finalizedRef.current);
          setVoiceCharsAdded(prev => prev + text.length);
          setInterimText('');
        } else {
          interim += text;
        }
      }
      if (interim) setInterimText(interim);
    };

    recognition.onerror = (e: any) => {
      const fatal = e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture';
      if (fatal) {
        shouldRecordRef.current = false;
        setAudioState('error');
        setAudioErrorMsg(
          e.error === 'not-allowed'
            ? 'Microphone access denied. Check your browser permissions.'
            : 'Could not capture audio. Is a microphone connected?'
        );
        cleanupTimer();
        return;
      }
      // non-fatal (network, no-speech) — let onend handle restart
    };

    recognition.onend = () => {
      setInterimText('');
      if (shouldRecordRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (!shouldRecordRef.current) return;
          try {
            const r = new SpeechAPI();
            r.lang = recognition.lang;
            r.continuous = true;
            r.interimResults = true;
            r.maxAlternatives = 1;
            r.onresult = recognition.onresult;
            r.onerror = recognition.onerror;
            r.onend = recognition.onend;
            recognitionRef.current = r;
            r.start();
          } catch {
            shouldRecordRef.current = false;
            setAudioState('done');
            cleanupTimer();
          }
        }, 200);
      } else {
        setAudioState(voiceCharsAddedSoFar() > 0 ? 'done' : 'idle');
        cleanupTimer();
      }
    };

    try {
      recognition.start();
      setAudioState('recording');
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      setAudioState('error');
      setAudioErrorMsg('Could not start voice input. Try again.');
      shouldRecordRef.current = false;
    }
  };

  const voiceCharsAddedSoFar = () => voiceCharsAdded;

  const stopRecording = () => {
    shouldRecordRef.current = false;
    setAudioState('stopping');
    setInterimText('');

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    try {
      recognitionRef.current?.stop();
    } catch { /* already stopped */ }

    setTimeout(() => {
      setAudioState(prev => prev === 'stopping' ? 'done' : prev);
      cleanupTimer();
    }, 500);
  };

  const cleanupTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const dismissDone = () => {
    setAudioState('idle');
    setVoiceCharsAdded(0);
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
          <p className="text-gray-400">Upload your diet, add your routine, and generate your adjusted daily plan.</p>
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
                <>
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                  <p className="text-sm text-gray-300">Extracting your diet…</p>
                  <p className="text-xs text-gray-500 mt-1">This usually takes 10–20 seconds</p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-500 mb-3" />
                  <p className="text-sm text-white font-medium">Drop file or click to upload</p>
                  <p className="text-xs text-gray-500 mt-1">Image or PDF · max 20 MB</p>
                </>
              )}
            </div>
          )}
          <input ref={dietInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleDietFile} disabled={isExtracting} />

          {dietReady && diet!.extractionWarnings && diet!.extractionWarnings.length > 0 && (
            <ExtractionNotes warnings={diet!.extractionWarnings} confidence={diet!.confidence} />
          )}
        </GlassCard>

        {/* ====== SECTION 2: Routine Context ====== */}
        <GlassCard className="space-y-4">
          <SectionHeader step={2} done={hasContext} label="Tell us about your day" required />
          <p className="text-sm text-gray-500">
            When do you train? When do you rest? When do you eat less or more? How does work, stress, or sleep affect your eating?
          </p>

          {/* --- Voice recording controls --- */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {audioState === 'idle' || audioState === 'done' || audioState === 'error' ? (
                <button
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
                >
                  <Mic className="w-3.5 h-3.5" />
                  {voiceCharsAdded > 0 ? 'Record more' : 'Record voice'}
                </button>
              ) : audioState === 'recording' ? (
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Stop recording · {formatTime(recordingTime)}
                </button>
              ) : audioState === 'stopping' ? (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-gray-400 border border-white/10">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing…
                </span>
              ) : null}

              {/* Status badges */}
              {audioState === 'recording' && (
                <span className="inline-flex items-center gap-1.5 text-xs text-red-300">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  Listening…
                </span>
              )}

              {audioState === 'done' && voiceCharsAdded > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs">
                  <Check className="w-3 h-3" />
                  Voice transcript added ({voiceCharsAdded} chars)
                  <button onClick={dismissDone} className="ml-1 text-primary/50 hover:text-primary"><X className="w-3 h-3" /></button>
                </span>
              )}

              {audioState === 'done' && voiceCharsAdded === 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                  No speech detected. Try again or type below.
                </span>
              )}

              {audioState === 'error' && audioErrorMsg && (
                <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  {audioErrorMsg}
                </span>
              )}
            </div>

            {/* Live preview of what's being heard */}
            {audioState === 'recording' && interimText && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
                <Volume2 className="w-3.5 h-3.5 text-red-300 mt-0.5 shrink-0 animate-pulse" />
                <p className="text-xs text-red-200/70 italic">{interimText}</p>
              </div>
            )}
          </div>

          {/* --- Text area --- */}
          <div className="relative">
            <textarea
              className="w-full min-h-[120px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 p-4 resize-y focus:outline-none focus:border-primary/50 text-sm"
              placeholder="e.g. I train 5x a week in the morning. On rest days I eat less. Weekends I eat more. I skip breakfast on busy days…"
              value={state.transcript ?? ''}
              onChange={handleTranscriptChange}
            />
            {hasContext && (
              <div className="absolute bottom-3 right-3 text-[10px] text-gray-600">
                {(state.transcript?.length ?? 0)} chars
              </div>
            )}
          </div>
        </GlassCard>

        {/* ====== SECTION 3: Activity Data (Optional) ====== */}
        <GlassCard className="space-y-4">
          <SectionHeader step={3} done={state.healthFileNames.length > 0} label="Activity & health data" optional />
          <p className="text-sm text-gray-500">
            Add Apple Watch, smartwatch, or health app screenshots. Steps, calories, sleep data help the AI make smarter adjustments.
          </p>

          <div
            className="border-2 border-dashed border-white/10 hover:border-accent/30 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors"
            onClick={() => healthInputRef.current?.click()}
          >
            <input ref={healthInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleHealthFiles} />
            <Watch className="w-6 h-6 text-accent/50 mb-2" />
            <p className="text-sm text-gray-400">Add screenshots (up to 3)</p>
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

        {/* ====== CTA ====== */}
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
          {dietReady && !hasContext && <p className="text-center text-xs text-gray-600 mt-3">Add some routine context to enable generation</p>}
        </div>
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

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
