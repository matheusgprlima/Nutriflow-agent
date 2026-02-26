import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { UiActions } from '../shared/schemas';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Play, CheckCircle, AlertCircle, Terminal, MousePointer2, Type, List } from 'lucide-react';

export default function NavigatorPage() {
  const [actions, setActions] = useState<UiActions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateActions = async () => {
    setLoading(true);
    setError('');
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const planRes = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone, goal: { mode: 'maintenance' } })
      });
      const plan = await planRes.json();

      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      
      if (!res.ok) throw new Error('Failed to generate actions');
      
      const data = await res.json();
      setActions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'click': return <MousePointer2 className="w-4 h-4" />;
      case 'type': return <Type className="w-4 h-4" />;
      case 'select': return <List className="w-4 h-4" />;
      default: return <Terminal className="w-4 h-4" />;
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Navigator Mode</h1>
            <p className="text-gray-400">Execute diet plan via automated UI actions.</p>
          </div>
          <Button
            onClick={handleGenerateActions}
            disabled={loading}
            variant="primary"
            isLoading={loading}
            icon={<Play className="w-5 h-5" />}
          >
            {loading ? 'Computing...' : 'Generate Action Sequence'}
          </Button>
        </div>

        {error && (
          <div 
            className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2"
          >
            <AlertCircle className="w-5 h-5 text-red-400" />
            {error}
          </div>
        )}

        {actions && (
          <div 
            className="space-y-6 animate-in fade-in slide-in-from-bottom-4"
          >
            <GlassCard className="relative overflow-hidden" glowBorder>
              <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  Execution Sequence
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">Confidence</span>
                  <StatusBadge 
                    status={actions.confidence > 0.8 ? 'active' : 'warning'} 
                    label={`${(actions.confidence * 100).toFixed(0)}%`} 
                  />
                </div>
              </div>

              <div className="space-y-0 relative">
                {/* Connecting Line */}
                <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-white/5 z-0" />

                {actions.actions.map((action, i) => (
                  <div 
                    key={i}
                    className="relative z-10 flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group animate-in fade-in slide-in-from-left-2"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="w-10 h-10 bg-surface rounded-full flex items-center justify-center border border-white/10 text-sm font-mono text-gray-500 shrink-0 group-hover:border-primary/50 group-hover:text-primary transition-colors shadow-lg">
                      {i + 1}
                    </div>
                    
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`flex items-center gap-1 text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                          action.type === 'click' ? 'bg-blue-500/10 text-blue-400' :
                          action.type === 'type' ? 'bg-green-500/10 text-green-400' :
                          action.type === 'select' ? 'bg-purple-500/10 text-purple-400' :
                          'bg-gray-500/10 text-gray-400'
                        }`}>
                          {getActionIcon(action.type)}
                          {action.type}
                        </span>
                        {action.fieldId && (
                          <span className="font-mono text-xs text-gray-500">#{action.fieldId}</span>
                        )}
                      </div>
                      
                      <div className="text-gray-300 font-medium">
                        {action.type === 'click' && <span>Click element</span>}
                        {action.type === 'type' && <span>Type <span className="text-white bg-white/10 px-1.5 rounded border border-white/10">"{action.value}"</span></span>}
                        {action.type === 'select' && <span>Select option <span className="text-white bg-white/10 px-1.5 rounded border border-white/10">"{action.option}"</span></span>}
                        {action.type === 'submit' && <span>Submit form</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </Layout>
  );
}
