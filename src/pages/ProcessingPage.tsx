import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GlassCard } from '../components/ui/GlassCard';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ProcessingPage() {
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId');
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('initializing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      navigate('/upload');
      return;
    }

    // Start processing
    const startProcessing = async () => {
      try {
        await fetch(`/api/runs/${runId}/start`, { method: 'POST' });
      } catch (e) {
        console.error("Failed to start processing", e);
      }
    };
    startProcessing();

    // Poll status
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) throw new Error("Failed to fetch run");
        const run = await res.json();
        
        setStatus(run.status);

        if (run.status === 'ready_for_review') {
          navigate(`/review?runId=${runId}`);
        } else if (run.status === 'needs_reupload') {
          navigate(`/upload?runId=${runId}&error=legibility`);
        } else if (run.status === 'failed') {
          setError(run.issues?.[0] || "Processing failed");
          clearInterval(interval);
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [runId, navigate]);

  return (
    <Layout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <GlassCard className="max-w-md w-full text-center p-8 space-y-6">
          {error ? (
            <>
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-white">Processing Failed</h2>
              <p className="text-red-300">{error}</p>
              <button 
                onClick={() => navigate(`/upload?runId=${runId}`)}
                className="text-primary hover:underline"
              >
                Return to Upload
              </button>
            </>
          ) : (
            <>
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <Loader2 className="absolute inset-0 m-auto w-8 h-8 text-primary animate-pulse" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Analyzing Data</h2>
                <p className="text-gray-400 animate-pulse">
                  {status === 'initializing' && "Initializing run..."}
                  {status === 'processing' && "Extracting insights from your uploads..."}
                  {status === 'draft' && "Preparing..."}
                </p>
              </div>

              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>Uploads verified</span>
                </div>
                <div className={`flex items-center justify-center gap-2 transition-opacity duration-500 ${status === 'processing' ? 'opacity-100' : 'opacity-50'}`}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking legibility...</span>
                </div>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </Layout>
  );
}
