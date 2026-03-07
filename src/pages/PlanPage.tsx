import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { BrainCircuit, Utensils, ArrowRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function PlanPage() {
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId');
  const navigate = useNavigate();
  const [plan, setPlan] = useState<any>(null);

  useEffect(() => {
    if (!runId) {
      navigate('/upload');
      return;
    }
    const fetchPlan = async () => {
      const res = await fetch(`/api/runs/${runId}`);
      const data = await res.json();
      if (data.plan) setPlan(data.plan);
    };
    fetchPlan();
  }, [runId, navigate]);

  const handleGenerateActions = async () => {
    await fetch(`/api/runs/${runId}/actions`, { method: 'POST' });
    navigate(`/navigator?runId=${runId}`);
  };

  if (!plan) return <Layout><div className="text-center pt-20">Loading Plan...</div></Layout>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Tomorrow's Plan</h1>
            <p className="text-gray-400">AI-optimized nutrition based on your metrics.</p>
          </div>
          <Button onClick={handleGenerateActions} icon={<ArrowRight className="w-4 h-4" />}>
            Generate Navigator
          </Button>
        </div>

        <GlassCard className="p-6 space-y-4" glowBorder>
          <div className="flex items-center gap-3 mb-4">
            <BrainCircuit className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-white">Strategy</h2>
          </div>
          <div className="space-y-2">
            {plan.summary.notes.map((note: string, i: number) => (
              <div key={i} className="flex items-start gap-3 text-gray-300 bg-white/5 p-3 rounded-lg">
                <span className="mt-1.5 w-1.5 h-1.5 bg-primary rounded-full shrink-0" />
                {note}
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="grid gap-6 md:grid-cols-2">
          {plan.meals.map((meal: any, i: number) => (
            <GlassCard key={i} className="space-y-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Utensils className="w-4 h-4 text-gray-400" />
                {meal.name}
              </h3>
              <ul className="space-y-2">
                {meal.items.map((item: any, j: number) => (
                  <li key={j} className="flex justify-between items-center text-sm bg-white/5 p-3 rounded-lg">
                    <span className="text-gray-200">{item.foodName}</span>
                    <span className="font-mono font-bold text-primary">{item.quantity} {item.unit}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>
      </div>
    </Layout>
  );
}
