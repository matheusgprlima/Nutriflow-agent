import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { TomorrowPlan } from '../shared/schemas';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AlertTriangle, CheckCircle, ArrowRight, BrainCircuit, Utensils } from 'lucide-react';

export default function PlanPage() {
  const [plan, setPlan] = useState<TomorrowPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGeneratePlan = async () => {
    setLoading(true);
    setError('');
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone, goal: { mode: 'maintenance' } })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate plan');
      }
      
      const data = await res.json();
      setPlan(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Plan Generation</h1>
            <p className="text-gray-400">AI-optimized nutrition for tomorrow.</p>
          </div>
          <Button
            onClick={handleGeneratePlan}
            disabled={loading}
            variant="primary"
            isLoading={loading}
            icon={<BrainCircuit className="w-5 h-5" />}
          >
            {loading ? 'Optimizing...' : 'Generate Plan'}
          </Button>
        </div>

        {error && (
          <div 
            className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2"
          >
            <AlertTriangle className="w-5 h-5 text-red-400" />
            {error}
          </div>
        )}

        {plan && (
          <div 
            className="space-y-8 animate-in fade-in slide-in-from-bottom-4"
          >
            {/* Summary Card */}
            <GlassCard className="relative overflow-hidden" glowBorder>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BrainCircuit className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">AI Strategy Summary</h2>
                    <p className="text-sm text-gray-400">{plan.localDate}</p>
                  </div>
                  <div className="ml-auto">
                    <StatusBadge 
                      status={plan.summary.expectedAdjustment === 'none' ? 'idle' : 'active'}
                      label={plan.summary.expectedAdjustment === 'increase' ? 'Caloric Surplus' : plan.summary.expectedAdjustment === 'decrease' ? 'Caloric Deficit' : 'Maintenance'}
                    />
                  </div>
                </div>
                
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-3">
                    {plan.summary.notes.map((note, i) => (
                      <div key={i} className="flex items-start gap-3 text-gray-300 bg-white/5 p-3 rounded-lg border border-white/5">
                        <span className="mt-1.5 w-1.5 h-1.5 bg-primary rounded-full shrink-0 shadow-[0_0_10px_rgba(0,255,148,0.5)]" />
                        {note}
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Safety Checks</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">New Foods</span>
                        <span className={plan.validations.noNewFoods ? "text-success flex items-center gap-1" : "text-error"}>
                          {plan.validations.noNewFoods ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {plan.validations.noNewFoods ? "None" : "Detected"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Range Check</span>
                        <span className={plan.validations.withinRanges ? "text-success flex items-center gap-1" : "text-warning"}>
                          {plan.validations.withinRanges ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {plan.validations.withinRanges ? "Pass" : "Adjusted"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Background Glow */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            </GlassCard>

            {/* Meals Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {plan.meals.map((meal, i) => (
                <GlassCard key={i} hoverEffect className="group">
                  <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                      {meal.name}
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {meal.items.map((item, j) => (
                      <li key={j} className="flex justify-between items-center text-sm bg-white/5 p-3 rounded-lg border border-white/5 group-hover:border-white/10 transition-colors">
                        <div>
                          <span className="text-gray-200 font-medium block">{item.foodName}</span>
                          {item.reason && <span className="text-xs text-gray-500 italic">{item.reason}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary text-lg">
                            {item.quantity}
                          </span>
                          <span className="text-xs text-gray-500 uppercase">{item.unit}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              ))}
            </div>

            {/* Warnings */}
            {plan.warnings.length > 0 && (
              <GlassCard className="border-warning/30 bg-warning/5">
                <h3 className="text-warning font-medium mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Critical Warnings
                </h3>
                <ul className="space-y-2">
                  {plan.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-warning/80 text-sm">
                      <span className="mt-1.5 w-1.5 h-1.5 bg-warning rounded-full shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
