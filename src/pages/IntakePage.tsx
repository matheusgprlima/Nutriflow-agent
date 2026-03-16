import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import {
  FileText, Loader2, AlertCircle, Check, Watch,
  Upload, X, Sparkles, ChevronDown,
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
  } = useSession();

  const dietInputRef = useRef<HTMLInputElement>(null);
  const healthInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.adjustedDiet && state.status === 'done') {
      navigate('/results');
    }
  }, [state.adjustedDiet, state.status, navigate]);

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

  const handleTranscriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscript(e.target.value);
  };

  const isExtracting = state.status === 'extracting';
  const isGenerating = state.status === 'generating';
  const diet = state.extractedDiet;
  const dietReady = !!diet?.meals?.length;
  const hasContext = !!state.transcript?.trim();
  const canGenerate = dietReady && hasContext && !isExtracting && !isGenerating;
  const totalItems = diet?.meals?.reduce((count, meal) => count + (meal.items?.length ?? 0), 0) ?? 0;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Generate your daily adjusted plan</h1>
          <p className="text-gray-400">
            Upload your baseline diet, tell us about your day, and optionally add activity data.
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
          <SectionHeader step={2} done={hasContext} label="Tell us about your day" required />
          <p className="text-sm text-gray-500">
            Share the context that affects today&apos;s plan: training day or rest day, energy, sleep, stress,
            appetite, and anything that changes your schedule.
          </p>
          <textarea
            className="w-full min-h-[180px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 p-4 resize-y focus:outline-none focus:border-primary/50 text-sm"
            placeholder="Example: Today is a training day and I&apos;m lifting at 6pm. Sleep was short, energy is medium, stress is high, and I&apos;ll be in meetings most of the afternoon. Appetite is lower than usual until after training."
            value={state.transcript ?? ''}
            onChange={handleTranscriptChange}
          />
          <p className="text-xs text-gray-600">
            This is the main input for generating your adjusted daily plan.
          </p>
        </GlassCard>

        <GlassCard className="space-y-4">
          <SectionHeader step={3} done={state.healthFileNames.length > 0} label="Optionally add activity data" optional />
          <p className="text-sm text-gray-500">
            Add Apple Watch, smartwatch, or health app screenshots if you want extra context. This step is optional.
          </p>
          <div
            className="border-2 border-dashed border-white/10 hover:border-accent/30 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors"
            onClick={() => healthInputRef.current?.click()}
          >
            <input ref={healthInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleHealthFiles} />
            <Watch className="w-5 h-5 text-accent/50 mb-1" />
            <p className="text-sm text-gray-400">Add screenshots (up to 3)</p>
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
              <button
                onClick={clearHealthScreenshots}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
          )}
        </GlassCard>

        <div className="pt-2 pb-8">
          <Button
            size="lg"
            onClick={generateAdjusted}
            disabled={!canGenerate}
            isLoading={isGenerating}
            icon={!isGenerating ? <Sparkles className="w-5 h-5" /> : undefined}
            className="w-full py-5 text-base"
          >
            {isGenerating ? 'Generating your daily adjusted plan…' : 'Generate your daily adjusted plan'}
          </Button>
          {!dietReady && <p className="text-center text-xs text-gray-600 mt-3">Upload your baseline diet to continue.</p>}
          {dietReady && !hasContext && <p className="text-center text-xs text-gray-600 mt-3">Tell us about your day to continue.</p>}
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
