import React, { useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { MacroBar, MacroGrid, sumItemMacros, hasMacroData } from '../components/MacroDisplay';
import {
  CheckCircle, Utensils, ArrowLeft, Flame, Download,
  ChevronDown, FileText, BarChart3, Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

export default function ResultsPage() {
  const navigate = useNavigate();
  const { state, reset } = useSession();
  const adjustedDiet = state.adjustedDiet;
  const baselineDiet = state.extractedDiet;

  const handleStartOver = () => { reset(); navigate('/'); };

  if (!adjustedDiet?.meals?.length) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-12 space-y-4">
          <p className="text-gray-400">No daily plan generated yet.</p>
          <Button variant="secondary" onClick={() => navigate('/intake')}>Go to intake</Button>
        </div>
      </Layout>
    );
  }

  const adjustedMacros = sumItemMacros(adjustedDiet.meals.flatMap(m => m.items));
  const baselineMacros = baselineDiet ? sumItemMacros(baselineDiet.meals.flatMap(m => m.items)) : null;
  const showMacros = hasMacroData(adjustedMacros);
  const totalMeals = adjustedDiet.meals.length;
  const totalItems = adjustedDiet.meals.reduce((n, m) => n + (m.items?.length ?? 0), 0);
  const changedItems = adjustedDiet.meals.flatMap(m => m.items || []).filter((item: any) => item.previousQuantity != null && item.previousQuantity !== item.quantity).length;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Success header */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-primary shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-white">Your daily plan is ready</h1>
              <p className="text-sm text-gray-400 mt-0.5">Same foods from your diet, portions adjusted for your day.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={handleStartOver} icon={<ArrowLeft className="w-3.5 h-3.5" />}>Start over</Button>
            <PdfDownloadButton state={state} adjustedMacros={adjustedMacros} baselineMacros={baselineMacros} />
          </div>
        </div>

        {/* ====== Analytics Dashboard ====== */}
        <div className="grid sm:grid-cols-3 gap-4">
          <StatCard icon={<Utensils className="w-4 h-4 text-primary" />} label="Meals" value={totalMeals} />
          <StatCard icon={<BarChart3 className="w-4 h-4 text-accent" />} label="Food items" value={totalItems} />
          <StatCard icon={<Sparkles className="w-4 h-4 text-purple-400" />} label="Adjusted items" value={changedItems} />
        </div>

        {/* Macro comparison */}
        {showMacros && (
          <GlassCard className="space-y-4">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-white">Daily nutrition</h2>
              <span className="text-xs text-gray-500">adjusted vs. baseline</span>
            </div>
            <MacroBar protein={adjustedMacros.protein} carbs={adjustedMacros.carbs} fat={adjustedMacros.fat} />
            <MacroGrid macros={adjustedMacros} comparison={baselineMacros} />
            <p className="text-[10px] text-gray-600">Estimates based on common nutritional data. Actual values may vary.</p>
          </GlassCard>
        )}

        {/* Planning notes */}
        {Array.isArray(adjustedDiet.notes) && adjustedDiet.notes.length > 0 && (
          <GlassCard className="space-y-2">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-gray-500" /> Planning notes</h2>
            <ul className="space-y-1 text-gray-400 text-sm">
              {adjustedDiet.notes.map((note: string, i: number) => (
                <li key={i} className="flex items-start gap-2"><span className="text-primary/60 mt-0.5">•</span>{note}</li>
              ))}
            </ul>
          </GlassCard>
        )}

        {/* ====== Baseline summary (collapsible) ====== */}
        {baselineDiet && <BaselineSummary diet={baselineDiet} macros={baselineMacros} />}

        {/* ====== Adjusted Daily Plan ====== */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Adjusted daily plan</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {adjustedDiet.meals.map((meal: any, i: number) => {
              const mm = sumItemMacros(meal.items || []);
              const hasMM = hasMacroData(mm);
              return (
                <GlassCard key={i} className="space-y-3 !p-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Utensils className="w-3.5 h-3.5 text-gray-500" />
                    {meal.name}
                  </h3>
                  {hasMM && (
                    <>
                      <MacroBar protein={mm.protein} carbs={mm.carbs} fat={mm.fat} className="!h-1.5" />
                      <p className="text-[10px] text-gray-500 font-mono">{mm.calories}cal · P{mm.protein}g · C{mm.carbs}g · F{mm.fat}g</p>
                    </>
                  )}
                  <ul className="space-y-1.5">
                    {meal.items?.map((item: any, j: number) => {
                      const changed = item.previousQuantity != null && item.previousQuantity !== item.quantity;
                      return (
                        <li key={j} className="flex justify-between items-start text-xs gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="text-gray-200 truncate">{item.foodName}</span>
                            {item.note && <span className="text-[10px] text-gray-500 italic">{item.note}</span>}
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`font-mono font-bold ${changed ? 'text-primary' : 'text-gray-400'}`}>{item.quantity} {item.unit}</span>
                            {changed && <p className="text-[10px] text-gray-500">was {item.previousQuantity}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </GlassCard>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="flex justify-center gap-3 pt-4 pb-8">
          <Button variant="secondary" onClick={handleStartOver} icon={<ArrowLeft className="w-4 h-4" />}>Start over</Button>
          <PdfDownloadButton state={state} adjustedMacros={adjustedMacros} baselineMacros={baselineMacros} />
        </div>
      </div>
    </Layout>
  );
}

/* ========== Sub-components ========== */

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <GlassCard className="flex items-center gap-3 !py-4 !px-5">
      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      </div>
    </GlassCard>
  );
}

function BaselineSummary({ diet, macros }: { diet: any; macros: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
        <span className="text-sm font-semibold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          Baseline diet summary ({diet.meals.length} meals)
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 pb-5 space-y-4">
          {macros && hasMacroData(macros) && (
            <div className="space-y-2">
              <MacroBar protein={macros.protein} carbs={macros.carbs} fat={macros.fat} className="!h-1.5" />
              <p className="text-[10px] text-gray-500 font-mono">{macros.calories}cal · P{macros.protein}g · C{macros.carbs}g · F{macros.fat}g</p>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {diet.meals.map((meal: any, i: number) => (
              <div key={i} className="bg-white/[0.03] rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-300">{meal.name}</p>
                {meal.items?.map((item: any, j: number) => (
                  <p key={j} className="text-[11px] text-gray-500 flex justify-between">
                    <span className="truncate">{item.foodName}</span>
                    <span className="font-mono shrink-0 ml-2">{item.baseQuantity}{item.unit}</span>
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== PDF Download ========== */

function PdfDownloadButton({ state, adjustedMacros, baselineMacros }: { state: any; adjustedMacros: any; baselineMacros: any }) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const html = buildPdfHtml(state, adjustedMacros, baselineMacros);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.width = '800px';
      iframe.style.height = '1200px';
      document.body.appendChild(iframe);
      iframe.contentDocument!.open();
      iframe.contentDocument!.write(html);
      iframe.contentDocument!.close();

      await new Promise(r => setTimeout(r, 300));
      iframe.contentWindow!.print();

      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1000);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button variant="primary" size="sm" onClick={handleDownload} disabled={generating} icon={<Download className="w-3.5 h-3.5" />}>
      {generating ? 'Preparing…' : 'Download PDF'}
    </Button>
  );
}

function buildPdfHtml(state: any, adjustedMacros: any, baselineMacros: any): string {
  const diet = state.adjustedDiet;
  const baseline = state.extractedDiet;
  const transcript = state.transcript || 'Not provided';

  const mealRows = (diet?.meals || []).map((meal: any) =>
    `<div style="break-inside:avoid;margin-bottom:16px;">
      <h3 style="margin:0 0 6px;font-size:14px;color:#333;">${esc(meal.name)}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="border-bottom:1px solid #eee;color:#888;text-align:left;">
          <th style="padding:4px 0;">Food</th><th>Qty</th><th>Unit</th><th>Prev</th><th>Note</th>
        </tr></thead>
        <tbody>${(meal.items || []).map((item: any) => {
          const changed = item.previousQuantity != null && item.previousQuantity !== item.quantity;
          return `<tr style="border-bottom:1px solid #f5f5f5;">
            <td style="padding:3px 0;">${esc(item.foodName)}</td>
            <td style="font-weight:${changed ? 'bold' : 'normal'};color:${changed ? '#00c853' : '#333'}">${item.quantity}</td>
            <td>${item.unit}</td>
            <td style="color:#999;">${item.previousQuantity ?? '—'}</td>
            <td style="color:#999;font-style:italic;font-size:11px;">${esc(item.note || '')}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`
  ).join('');

  const macroLine = (m: any, label: string) =>
    m ? `<p style="margin:4px 0;font-size:12px;"><strong>${label}:</strong> ${m.calories} kcal · P ${m.protein}g · C ${m.carbs}g · F ${m.fat}g</p>` : '';

  const notes = (diet?.notes || []).map((n: string) => `<li>${esc(n)}</li>`).join('');

  const baselineSummary = baseline?.meals?.map((meal: any) =>
    `<p style="margin:2px 0;font-size:11px;"><strong>${esc(meal.name)}:</strong> ${(meal.items || []).map((i: any) => `${esc(i.foodName)} ${i.baseQuantity}${i.unit}`).join(', ')}</p>`
  ).join('') || '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>NutriFlow Daily Plan</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px; color: #333; }
  h1 { font-size: 20px; margin: 0; } h2 { font-size: 16px; margin: 20px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; font-size: 10px; padding: 2px 8px; border-radius: 4px; margin-bottom: 8px; }
</style></head><body>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
    <div style="width:28px;height:28px;background:linear-gradient(135deg,#00ff94,#00b4d8);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#000;font-weight:bold;font-size:14px;">N</div>
    <h1>NutriFlow — Daily Plan</h1>
  </div>
  <p style="color:#888;font-size:12px;margin:0 0 16px;">Generated ${new Date().toLocaleDateString()}</p>

  <h2>Nutrition Summary</h2>
  ${macroLine(adjustedMacros, 'Adjusted')}
  ${macroLine(baselineMacros, 'Baseline')}

  ${notes ? `<h2>Planning Notes</h2><ul style="margin:0;padding-left:18px;font-size:12px;">${notes}</ul>` : ''}

  <h2>Routine Context</h2>
  <p style="font-size:12px;color:#555;white-space:pre-wrap;">${esc(transcript)}</p>

  ${state.healthFileNames?.length ? `<p style="font-size:11px;color:#888;">Activity data: ${state.healthFileNames.join(', ')}</p>` : ''}

  <h2>Adjusted Daily Plan</h2>
  ${mealRows}

  ${baselineSummary ? `<h2>Baseline Diet</h2>${baselineSummary}` : ''}

  <p style="margin-top:24px;font-size:10px;color:#bbb;text-align:center;">NutriFlow — AI Daily Diet Planner. Not medical advice.</p>
</body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
