import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { CheckCircle, Copy } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function NavigatorPage() {
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId');
  const navigate = useNavigate();
  const [actions, setActions] = useState<any>(null);

  useEffect(() => {
    if (!runId) {
      navigate('/upload');
      return;
    }
    const fetchActions = async () => {
      const res = await fetch(`/api/runs/${runId}`);
      const data = await res.json();
      if (data.actions) setActions(data.actions);
    };
    fetchActions();
  }, [runId, navigate]);

  if (!actions) return <Layout><div className="text-center pt-20">Loading Navigator...</div></Layout>;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-white">Navigator Actions</h1>
          <p className="text-gray-400">Follow these steps to log your plan.</p>
        </div>

        <div className="space-y-4">
          {actions.steps.map((step: any, i: number) => (
            <GlassCard key={i} className="flex items-start gap-4 p-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold">
                {i + 1}
              </div>
              <div>
                <h3 className="font-medium text-white">{step.action}</h3>
                <p className="text-sm text-gray-400 mt-1">{step.details}</p>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="flex justify-center">
          <Button 
            variant="secondary" 
            icon={<Copy className="w-4 h-4" />}
            onClick={() => navigator.clipboard.writeText(JSON.stringify(actions, null, 2))}
          >
            Copy Action JSON
          </Button>
        </div>
      </div>
    </Layout>
  );
}
