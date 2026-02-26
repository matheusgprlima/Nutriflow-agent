import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { DietTemplate, DailyMetrics } from '../shared/schemas';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Activity, FileText, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ReviewPage() {
  const [data, setData] = useState<{ diet: DietTemplate | null, metrics: DailyMetrics | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch(`/api/data?timezone=${timezone}`);
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-gray-400 animate-pulse">Retrieving context...</p>
        </div>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Context Review</h1>
            <p className="text-gray-400">Verify extracted data before plan generation.</p>
          </div>
          <StatusBadge status="active" label="Data Synced" />
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Diet Template Section */}
          <GlassCard className="space-y-6" glowBorder>
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-white">Diet Template</h2>
              </div>
              {data?.diet && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Confidence</span>
                  <StatusBadge 
                    status={data.diet.confidence > 0.8 ? 'active' : 'error'} 
                    label={`${(data.diet.confidence * 100).toFixed(0)}%`} 
                  />
                </div>
              )}
            </div>

            {data?.diet ? (
              <div className="space-y-6">
                {data.diet.meals.map((meal, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-primary/20 transition-colors">
                    <h3 className="text-lg font-medium text-primary mb-3">{meal.name}</h3>
                    <ul className="space-y-2">
                      {meal.items.map((item, j) => (
                        <li key={j} className="flex justify-between items-center text-sm group">
                          <span className="text-gray-300 group-hover:text-white transition-colors">{item.foodName}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-primary/80 bg-primary/10 px-2 py-0.5 rounded text-xs">
                              {item.baseQuantity}{item.unit}
                            </span>
                            {(item.minQuantity || item.maxQuantity) && (
                              <span className="text-xs text-gray-500">
                                ({item.minQuantity || '0'}-{item.maxQuantity || '∞'})
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                
                {data.diet.extractionWarnings.length > 0 && (
                  <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
                    <h4 className="text-warning font-medium flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4" /> Warnings
                    </h4>
                    <ul className="list-disc list-inside text-sm text-warning/80 space-y-1">
                      {data.diet.extractionWarnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No diet template found.</p>
              </div>
            )}
          </GlassCard>

          {/* Metrics Section */}
          <GlassCard className="space-y-6" glowBorder>
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Activity className="w-5 h-5 text-accent" />
                </div>
                <h2 className="text-xl font-semibold text-white">Daily Metrics</h2>
              </div>
              {data?.metrics && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Confidence</span>
                  <StatusBadge 
                    status={data.metrics.confidence > 0.8 ? 'active' : 'error'} 
                    label={`${(data.metrics.confidence * 100).toFixed(0)}%`} 
                  />
                </div>
              )}
            </div>

            {data?.metrics ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Steps</span>
                    <div className="text-2xl font-bold text-white mt-1">{data.metrics.steps?.toLocaleString() || '-'}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Active Cal</span>
                    <div className="text-2xl font-bold text-white mt-1">{data.metrics.activeCaloriesKcal || '-'} <span className="text-sm font-normal text-gray-500">kcal</span></div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Sleep</span>
                    <div className="text-2xl font-bold text-white mt-1">{data.metrics.sleepHours || '-'} <span className="text-sm font-normal text-gray-500">hrs</span></div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Resting HR</span>
                    <div className="text-2xl font-bold text-white mt-1">{data.metrics.restingHR || '-'} <span className="text-sm font-normal text-gray-500">bpm</span></div>
                  </div>
                </div>

                {data.metrics.training.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Training Sessions</h3>
                    <div className="space-y-2">
                      {data.metrics.training.map((session, i) => (
                        <div key={i} className="flex items-center justify-between bg-accent/5 border border-accent/10 p-3 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-accent" />
                            <span className="text-white capitalize">{session.type}</span>
                          </div>
                          <div className="text-sm text-gray-400">
                            {session.durationMin} min • <span className="capitalize">{session.intensity}</span> Intensity
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.metrics.extractionWarnings.length > 0 && (
                  <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
                    <h4 className="text-warning font-medium flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4" /> Warnings
                    </h4>
                    <ul className="list-disc list-inside text-sm text-warning/80 space-y-1">
                      {data.metrics.extractionWarnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No metrics found for today.</p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </Layout>
  );
}
