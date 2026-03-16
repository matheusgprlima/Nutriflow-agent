import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import {
  AlertCircle, ArrowRight, Check, ChevronDown, FileText,
  Loader2, MessageSquareText, Sparkles, Upload, User, Watch, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

export default function IntakePage() {
  const navigate = useNavigate();
  const {
    state,
    sendDietFile,
    setTranscript,
    addHealthScreenshot,
    clearHealthScreenshots,
    generateAdjusted,
    startLive,
    sendLiveText,
  } = useSession();

  const dietInputRef = useRef<HTMLInputElement>(null);
  const healthInputRef = useRef<HTMLInputElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.liveTranscript, state.liveGenerating, state.adjustedDiet]);

  const handleDietFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || state.status === 'extracting') return;
    sendDietFile(file);
    e.target.value = '';
  };

  const handleHealthFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach((file) => addHealthScreenshot(file));
    e.target.value = '';
  };

  const handleFallbackChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscript(e.target.value);
  };

  const handleSend = () => {
    const text = chatInput.trim();
    if (!text || !state.liveActive || state.liveGenerating || state.adjustedDiet) return;
    sendLiveText(text);
    setChatInput('');
  };

  const isExtracting = state.status === 'extracting';
  const isGenerating = state.status === 'generating';
  const isLiveConnecting = state.status === 'live_connecting';
  const diet = state.extractedDiet;
  const dietReady = !!diet?.meals?.length;
  const planReady = !!state.adjustedDiet;
  const healthLocked = isLiveConnecting || state.liveActive;
  const canStartLive = dietReady && !isExtracting && !isLiveConnecting && !state.liveActive && !planReady;
  const canSend = !!chatInput.trim() && state.liveActive && !state.liveGenerating && !planReady;
  const fallbackReady = dietReady && !!state.transcript?.trim() && !state.liveActive && !isLiveConnecting && !planReady && !isGenerating;
  const totalItems = diet?.meals?.reduce((count, meal) => count + (meal.items?.length ?? 0), 0) ?? 0;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Plan today with a live text agent</h1>
          <p className="text-gray-400">
            Upload your baseline diet, optionally add activity data, and let NutriFlow collect today&apos;s context in a short live chat.
          </p>
        </div>

        {state.errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 text-red-200 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{state.errorMessage}</p>
          </div>
        )}

        <GlassCard className="space-y-4">
          <SectionHeader step={1} done={dietReady} label="Upload your baseline diet" required />
          {dietReady ? (
            <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{state.fileName || 'Diet uploaded'}</p>
                  <p className="text-xs text-gray-500">
                    {diet.meals.length} meals · {totalItems} items · {((diet.confidence ?? 0) * 100).toFixed(0)}% confidence
                  </p>
                </div>
              </div>
              <button
                onClick={() => dietInputRef.current?.click()}
                className="text-xs text-gray-400 hover:text-white transition-colors shrink-0"
              >
                Replace
              </button>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors ${
                isExtracting
                  ? 'border-primary/30 opacity-70 cursor-wait'
                  : 'border-white/10 hover:border-primary/30 cursor-pointer'
              }`}
              onClick={() => !isExtracting && dietInputRef.current?.click()}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                  <p className="text-sm text-gray-300">Extracting your baseline diet…</p>
                  <p className="text-xs text-gray-500 mt-1">This usually takes 10 to 20 seconds</p>
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
          <input
            ref={dietInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleDietFile}
            disabled={isExtracting}
          />
          {dietReady && diet.extractionWarnings && diet.extractionWarnings.length > 0 && (
            <ExtractionNotes warnings={diet.extractionWarnings} confidence={diet.confidence} />
          )}
        </GlassCard>

        <GlassCard className="space-y-4">
          <SectionHeader step={2} done={state.healthFileNames.length > 0} label="Optionally add activity data" optional />
          <p className="text-sm text-gray-500">
            Add Apple Watch, smartwatch, or health app screenshots before starting the live chat if you want that context factored in.
          </p>
          <div
            className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-colors ${
              healthLocked
                ? 'border-white/5 opacity-60 cursor-not-allowed'
                : 'border-white/10 hover:border-accent/30 cursor-pointer'
            }`}
            onClick={() => !healthLocked && healthInputRef.current?.click()}
          >
            <input
              ref={healthInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleHealthFiles}
              disabled={healthLocked}
            />
            <Watch className="w-5 h-5 text-accent/50 mb-1" />
            <p className="text-sm text-gray-400">Add screenshots (up to 3)</p>
            {healthLocked && <p className="text-xs text-gray-600 mt-1">Activity uploads are locked while the live chat is active.</p>}
          </div>
          {state.healthFileNames.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {state.healthFileNames.map((name, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-1 rounded-lg bg-accent/10 text-accent text-xs truncate max-w-[160px]"
                >
                  {name}
                </span>
              ))}
              {!healthLocked && (
                <button
                  onClick={clearHealthScreenshots}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          )}
        </GlassCard>

        <GlassCard className="space-y-4">
          <SectionHeader
            step={3}
            done={state.liveTranscript.length > 0 || planReady}
            label="Chat with your live planning agent"
            required
          />

          {!dietReady && (
            <p className="text-sm text-gray-500">
              Upload your baseline diet first so the live agent can review it before asking about today.
            </p>
          )}

          {dietReady && !state.liveActive && !isLiveConnecting && state.liveTranscript.length === 0 && !planReady && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
              <p className="text-sm text-gray-400">
                The live text agent will acknowledge your baseline diet, ask a few short follow-up questions, and trigger plan generation as soon as it has enough context.
              </p>
              <Button onClick={startLive} disabled={!canStartLive} icon={<MessageSquareText className="w-4 h-4" />}>
                Start live chat
              </Button>
            </div>
          )}

          {(isLiveConnecting || state.liveActive || state.liveTranscript.length > 0 || planReady) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${state.liveActive ? 'bg-primary' : 'bg-gray-500'} ${(state.agentSpeaking || isLiveConnecting || state.liveGenerating) ? 'animate-pulse' : ''}`} />
                  <p className="text-xs text-gray-400">
                    {isLiveConnecting
                      ? 'Connecting to live agent…'
                      : state.liveGenerating
                        ? 'Agent is generating your daily plan…'
                        : state.agentSpeaking
                          ? 'Agent is responding…'
                          : state.liveActive
                            ? 'Live chat active'
                            : planReady
                              ? 'Plan ready'
                              : 'Chat ready to restart'}
                  </p>
                </div>
                {!state.liveActive && !isLiveConnecting && !planReady && (
                  <button
                    onClick={startLive}
                    className="text-xs text-primary hover:text-white transition-colors shrink-0"
                  >
                    Restart chat
                  </button>
                )}
              </div>

              <div className="rounded-2xl bg-black/30 border border-white/5 p-4 space-y-3 max-h-[420px] overflow-y-auto">
                {state.liveTranscript.length === 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageSquareText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="rounded-2xl rounded-tl-md bg-white/[0.04] px-4 py-3 text-sm text-gray-400">
                      {isLiveConnecting ? 'Opening your live planning chat…' : 'Your live agent messages will appear here.'}
                    </div>
                  </div>
                )}

                {state.liveTranscript.map((turn, index) => (
                  <div key={index} className={`flex items-start gap-3 ${turn.role === 'user' ? 'justify-end' : ''}`}>
                    {turn.role === 'agent' && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <MessageSquareText className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                        turn.role === 'agent'
                          ? 'rounded-tl-md bg-white/[0.04] text-gray-100'
                          : 'rounded-tr-md bg-primary text-black'
                      }`}
                    >
                      {turn.text}
                    </div>
                    {turn.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                  </div>
                ))}

                {(state.agentSpeaking || state.liveGenerating || isLiveConnecting) && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageSquareText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="rounded-2xl rounded-tl-md bg-white/[0.04] px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      {state.liveGenerating ? 'Putting your adjusted plan together…' : 'Thinking…'}
                    </div>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={state.liveActive && !planReady ? 'Type your reply…' : 'Start the live chat to reply here'}
                  disabled={!state.liveActive || state.liveGenerating || planReady}
                  className="flex-1 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 px-4 py-3 text-sm focus:outline-none focus:border-primary/50 disabled:opacity-60"
                />
                <Button onClick={handleSend} disabled={!canSend}>Send</Button>
              </div>
            </div>
          )}
        </GlassCard>

        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">Manual fallback</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500 uppercase tracking-wider">optional</span>
          </div>
          <p className="text-xs text-gray-500">
            If the live chat is unavailable, you can still paste a short daily context note and generate directly.
          </p>
          <textarea
            className="w-full min-h-[96px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 p-3 resize-y focus:outline-none focus:border-primary/50 text-sm"
            placeholder="Training day or rest day, sleep, energy, appetite, schedule, and anything unusual about today."
            value={state.transcript ?? ''}
            onChange={handleFallbackChange}
            disabled={state.liveActive || isLiveConnecting || planReady}
          />
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={generateAdjusted}
              disabled={!fallbackReady}
              isLoading={isGenerating}
              icon={!isGenerating ? <Sparkles className="w-4 h-4" /> : undefined}
            >
              {isGenerating ? 'Generating from note…' : 'Generate from note'}
            </Button>
          </div>
        </GlassCard>

        <div className="pt-2 pb-8 space-y-3">
          <Button
            size="lg"
            onClick={() => navigate('/results')}
            disabled={!planReady}
            icon={<ArrowRight className="w-5 h-5" />}
            className="w-full py-5 text-base"
          >
            Open your daily plan
          </Button>
          {!dietReady && <p className="text-center text-xs text-gray-600">Upload your baseline diet to begin.</p>}
          {dietReady && !planReady && (
            <p className="text-center text-xs text-gray-600">
              This button unlocks when the live agent finishes generating your adjusted plan.
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}

function SectionHeader({
  step,
  done,
  label,
  required,
  optional,
}: {
  step: number;
  done: boolean;
  label: string;
  required?: boolean;
  optional?: boolean;
}) {
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
          {confidence != null && confidence < 0.7 && <p>Low confidence ({(confidence * 100).toFixed(0)}%) - some items may be inaccurate.</p>}
          {warnings.map((warning, i) => <p key={i}>{warning}</p>)}
        </div>
      )}
    </div>
  );
}
