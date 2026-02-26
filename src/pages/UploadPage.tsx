import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Activity, FileText } from 'lucide-react';
import { Layout } from '../components/Layout';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';

export default function UploadPage() {
  const [dietFile, setDietFile] = useState<File | null>(null);
  const [metricsFile, setMetricsFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleUpload = async () => {
    if (!dietFile && !metricsFile) {
      setMessage('Please select at least one file.');
      setStatus('error');
      return;
    }

    setStatus('uploading');
    setMessage('Uploading files...');

    try {
      if (dietFile) {
        const formData = new FormData();
        formData.append('file', dietFile);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Diet upload failed');
        const data = await res.json();
        
        await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'diet', fileId: data.filename, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
        });
      }

      if (metricsFile) {
        const formData = new FormData();
        formData.append('file', metricsFile);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Metrics upload failed');
        const data = await res.json();

        await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'metrics', fileId: data.filename, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
        });
      }

      setStatus('success');
      setMessage('Files uploaded and processed successfully!');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setMessage('Upload failed. Please try again.');
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-3 mb-12">
          <div 
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4 animate-in fade-in slide-in-from-top-4"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            Upload Center
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Initialize <span className="text-primary text-glow">Data Stream</span>
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            Upload your latest diet plan and health metrics to synchronize the agent's context.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Diet Upload */}
          <GlassCard className="relative group overflow-hidden" hoverEffect glowBorder={!!dietFile}>
            <input 
              type="file" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={(e) => setDietFile(e.target.files?.[0] || null)}
              accept="image/*"
            />
            <div className="flex flex-col items-center justify-center text-center p-8 min-h-[300px] border-2 border-dashed border-white/10 rounded-xl group-hover:border-primary/30 transition-colors">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,255,148,0.1)] group-hover:scale-110 transition-transform duration-300">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Diet Plan</h3>
              <p className="text-sm text-gray-400 mb-6">
                {dietFile ? (
                  <span className="text-primary font-medium">{dietFile.name}</span>
                ) : (
                  "Drag & drop or click to upload"
                )}
              </p>
              {dietFile && (
                <StatusBadge status="active" label="Ready to process" />
              )}
            </div>
            
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          </GlassCard>

          {/* Metrics Upload */}
          <GlassCard className="relative group overflow-hidden" hoverEffect glowBorder={!!metricsFile}>
            <input 
              type="file" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={(e) => setMetricsFile(e.target.files?.[0] || null)}
              accept="image/*"
            />
            <div className="flex flex-col items-center justify-center text-center p-8 min-h-[300px] border-2 border-dashed border-white/10 rounded-xl group-hover:border-accent/30 transition-colors">
              <div className="w-16 h-16 bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(6,182,212,0.1)] group-hover:scale-110 transition-transform duration-300">
                <Activity className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Health Metrics</h3>
              <p className="text-sm text-gray-400 mb-6">
                {metricsFile ? (
                  <span className="text-accent font-medium">{metricsFile.name}</span>
                ) : (
                  "Drag & drop or click to upload"
                )}
              </p>
              {metricsFile && (
                <StatusBadge status="active" label="Ready to process" />
              )}
            </div>

             {/* Background Glow */}
             <div className="absolute inset-0 bg-gradient-to-t from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          </GlassCard>
        </div>

        <div className="flex flex-col items-center justify-center space-y-6 mt-8">
          <Button
            onClick={handleUpload}
            disabled={status === 'uploading'}
            variant="primary"
            size="lg"
            isLoading={status === 'uploading'}
            className="w-full md:w-auto min-w-[200px]"
            icon={<Upload className="w-5 h-5" />}
          >
            {status === 'uploading' ? 'Processing Stream...' : 'Initialize Extraction'}
          </Button>

          {status === 'success' && (
            <div 
              className="glass-panel px-6 py-3 rounded-xl flex items-center gap-3 border-green-500/30 bg-green-500/10 animate-in fade-in slide-in-from-bottom-2"
            >
              <CheckCircle className="w-5 h-5 text-green-400" />
              <p className="text-green-200 font-medium">{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div 
              className="glass-panel px-6 py-3 rounded-xl flex items-center gap-3 border-red-500/30 bg-red-500/10 animate-in fade-in slide-in-from-bottom-2"
            >
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-200 font-medium">{message}</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
