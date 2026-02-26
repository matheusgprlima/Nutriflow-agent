import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard } from '../components/ui/GlassCard';
import { MetricWidget } from '../components/ui/MetricWidget';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { DailyMetrics, TomorrowPlan } from '../shared/schemas';
import { BrainCircuit, ArrowRight, Activity, Moon, Zap, Flame, Droplets, TrendingUp, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DailyMetrics | null>(null);
  const [plan, setPlan] = useState<TomorrowPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching data
    const loadData = async () => {
      setLoading(true);
      try {
        // Mock data for now
        setTimeout(() => {
          setMetrics({
            date: new Date().toISOString().split('T')[0],
            weight: 75.5,
            sleepHours: 7.2,
            restingHeartRate: 62,
            caloriesConsumed: 2100,
            proteinConsumed: 160,
            carbsConsumed: 200,
            fatsConsumed: 70,
            waterIntake: 2500,
            steps: 8500,
            mood: 'energetic',
            energyLevel: 8,
          });
          
          setPlan({
            localDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            summary: {
              totalCalories: 2250,
              proteinGrams: 180,
              carbsGrams: 210,
              fatsGrams: 75,
              expectedAdjustment: 'increase',
              notes: ['Increased protein for recovery', 'Slight caloric surplus for training day']
            },
            meals: [],
            validations: { noNewFoods: true, withinRanges: true },
            warnings: []
          });
          
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <Layout>
      <div className="space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
              Welcome back, <span className="text-primary text-glow">Agent</span>
            </h1>
            <p className="text-gray-400 text-sm">Metabolic status: <span className="text-success font-medium">Optimized</span></p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status="active" label="AI Online" />
            <Button variant="glass" size="sm" icon={<Calendar className="w-4 h-4" />}>
              Today, {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricWidget 
            label="Metabolic Rate" 
            value="2,450" 
            unit="kcal" 
            trend="up" 
            trendValue="120"
            icon={<Flame className="w-5 h-5" />}
            color="primary"
          />
          <MetricWidget 
            label="Recovery Score" 
            value="92" 
            unit="%" 
            trend="up" 
            trendValue="4%"
            icon={<Zap className="w-5 h-5" />}
            color="accent"
          />
          <MetricWidget 
            label="Sleep Quality" 
            value="7.2" 
            unit="hrs" 
            trend="neutral" 
            trendValue="0.1"
            icon={<Moon className="w-5 h-5" />}
            color="primary"
          />
          <MetricWidget 
            label="Hydration" 
            value="2.5" 
            unit="L" 
            trend="down" 
            trendValue="0.3"
            icon={<Droplets className="w-5 h-5" />}
            color="warning"
          />
        </div>

        {/* Main Content Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Charts & Trends */}
          <div className="lg:col-span-2 space-y-6">
            <GlassCard className="h-[400px] flex flex-col" glowBorder>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Metabolic Adaptation
                </h3>
                <div className="flex gap-2">
                  {['1W', '1M', '3M', 'YTD'].map((period) => (
                    <button 
                      key={period}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        period === '1W' ? 'bg-primary/20 text-primary' : 'text-gray-500 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Simple CSS Chart Replacement */}
              <div className="flex-1 w-full flex items-end justify-between gap-2 px-4 pb-4">
                 {[65, 72, 68, 75, 82, 78, 85].map((height, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 w-full group">
                      <div className="relative w-full bg-white/5 rounded-t-lg overflow-hidden h-64 flex items-end">
                         <div 
                           className="w-full bg-gradient-to-t from-primary/20 to-primary/60 rounded-t-lg transition-all duration-500 group-hover:from-primary/40 group-hover:to-primary/80"
                           style={{ height: `${height}%` }}
                         />
                      </div>
                      <span className="text-xs text-gray-500">Day {i + 1}</span>
                    </div>
                 ))}
              </div>
            </GlassCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <GlassCard>
                 <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">Weight Trend</h3>
                 <div className="flex items-end gap-2 mb-2">
                   <span className="text-2xl font-bold text-white">75.5</span>
                   <span className="text-sm text-gray-500 mb-1">kg</span>
                 </div>
                 <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                   <div className="bg-accent h-1.5 rounded-full" style={{ width: '70%' }}></div>
                 </div>
                 <p className="text-xs text-gray-500">0.5kg from target</p>
               </GlassCard>
               
               <GlassCard>
                 <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">Protein Intake</h3>
                 <div className="flex items-end gap-2 mb-2">
                   <span className="text-2xl font-bold text-white">160</span>
                   <span className="text-sm text-gray-500 mb-1">g</span>
                 </div>
                 <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                   <div className="bg-primary h-1.5 rounded-full" style={{ width: '85%' }}></div>
                 </div>
                 <p className="text-xs text-gray-500">85% of daily goal</p>
               </GlassCard>
            </div>
          </div>

          {/* Right Column: Tomorrow's Plan Preview */}
          <div className="space-y-6">
            <GlassCard className="h-full relative overflow-hidden" glowBorder>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-accent" />
                    Tomorrow's Strategy
                  </h3>
                  <span className="text-xs text-accent bg-accent/10 px-2 py-1 rounded-full border border-accent/20">
                    Ready
                  </span>
                </div>

                {loading ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-20 bg-white/5 rounded-xl" />
                    <div className="h-20 bg-white/5 rounded-xl" />
                    <div className="h-20 bg-white/5 rounded-xl" />
                  </div>
                ) : plan ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-400">Target Calories</span>
                        <span className="text-xl font-bold text-white">{plan.summary.totalCalories}</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden flex">
                        <div className="bg-blue-500 h-full" style={{ width: '30%' }} />
                        <div className="bg-green-500 h-full" style={{ width: '45%' }} />
                        <div className="bg-yellow-500 h-full" style={{ width: '25%' }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> P: {plan.summary.proteinGrams}g</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> C: {plan.summary.carbsGrams}g</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500" /> F: {plan.summary.fatsGrams}g</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">AI Adjustments</h4>
                      {plan.summary.notes.map((note, i) => (
                        <div key={i} className="flex gap-3 text-sm text-gray-300">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                          {note}
                        </div>
                      ))}
                    </div>

                    <Link to="/plan" className="block">
                      <Button className="w-full group" variant="glass">
                        View Full Plan 
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-500">
                    No plan generated yet.
                  </div>
                )}
              </div>
              
              {/* Decorative Background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            </GlassCard>
          </div>
        </div>
      </div>
    </Layout>
  );
}
