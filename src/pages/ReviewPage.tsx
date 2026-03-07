import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Activity, FileText, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ReviewPage() {
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId');
  const navigate = useNavigate();
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId) {
      navigate('/upload');
      return;
    }
    const fetchRun = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        const data = await res.json();
        setRun(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRun();
  }, [runId, navigate]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await fetch(`/api/runs/${runId}/plan`, { method: 'POST' });
      navigate(`/plan?runId=${runId}`);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  if (loading || !run) return (
    <Layout>
      <div className="flex justify-center pt-20">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  const { dietTemplate, dailyMetrics } = run.extraction || {};

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Context Review</h1>
            <p className="text-gray-400">Verify extracted data before plan generation.</p>
          </div>
          <Button onClick={handleConfirm} icon={<ArrowRight className="w-4 h-4" />}>
            Confirm & Generate Plan
          </Button>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Diet Template Section */}
          <GlassCard className="space-y-6" glowBorder>
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-white">Diet Template</h2>
              </div>
              <StatusBadge status="active" label="Extracted" />
            </div>

            {dietTemplate?.meals?.map((meal: any, i: number) => (
              <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5">
                <h3 className="text-lg font-medium text-primary mb-3">{meal.name}</h3>
                <ul className="space-y-2">
                  {meal.items.map((item: any, j: number) => (
                    <li key={j} className="flex justify-between items-center text-sm">
                      <span className="text-gray-300">{item.foodName}</span>
                      <span className="font-mono text-primary/80 bg-primary/10 px-2 py-0.5 rounded text-xs">
                        {item.baseQuantity}{item.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </GlassCard>

          {/* Metrics Section */}
          <GlassCard className="space-y-6" glowBorder>
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-semibold text-white">Daily Metrics</h2>
              </div>
              <StatusBadge status="active" label="Extracted" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Steps</span>
                <div className="text-2xl font-bold text-white mt-1">{dailyMetrics?.steps || '-'}</div>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Active Cal</span>
                <div className="text-2xl font-bold text-white mt-1">{dailyMetrics?.activeCaloriesKcal || '-'}</div>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Sleep</span>
                <div className="text-2xl font-bold text-white mt-1">{dailyMetrics?.sleepHours || '-'} hrs</div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </Layout>
  );
}
