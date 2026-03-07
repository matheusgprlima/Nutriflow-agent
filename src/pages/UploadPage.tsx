import React, { useState, useRef, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, Activity, FileText, X, Loader2, RefreshCw, Image as ImageIcon, FileType } from 'lucide-react';
import { Layout } from '../components/Layout';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { processImage, ProcessedFile } from '../utils/imageProcessing';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface FileUploadState {
  [id: string]: ProcessedFile;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [runId, setRunId] = useState<string | null>(searchParams.get('runId'));
  const [files, setFiles] = useState<FileUploadState>({});
  const [error, setError] = useState<string | null>(searchParams.get('error') === 'legibility' ? 'Some files were not legible. Please re-upload clearer images.' : null);
  
  const dietInputRef = useRef<HTMLInputElement>(null);
  const metricsInputRef = useRef<HTMLInputElement>(null);

  // Create run on mount if not exists
  useEffect(() => {
    if (!runId) {
      const createRun = async () => {
        try {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const res = await fetch('/api/runs/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone })
          });
          const data = await res.json();
          setRunId(data.runId);
        } catch (e) {
          console.error("Failed to create run", e);
          setError("Failed to initialize session");
        }
      };
      createRun();
    }
  }, [runId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, category: 'diet' | 'metrics') => {
    if (!e.target.files?.length || !runId) return;

    const newFiles: FileUploadState = {};
    
    Array.from(e.target.files).forEach(file => {
      const id = crypto.randomUUID();
      newFiles[id] = {
        id,
        originalFile: file,
        status: 'pending',
        progress: 0,
        category
      };
    });

    setFiles(prev => ({ ...prev, ...newFiles }));
    e.target.value = '';

    Object.values(newFiles).forEach(fileState => processAndUpload(fileState, runId));
  };

  const processAndUpload = async (fileState: ProcessedFile, currentRunId: string) => {
    const updateFile = (updates: Partial<ProcessedFile>) => {
      setFiles(prev => ({
        ...prev,
        [fileState.id]: { ...prev[fileState.id], ...updates }
      }));
    };

    try {
      let uploadBlob = fileState.originalFile;

      // Only compress images
      if (fileState.originalFile.type.startsWith('image/')) {
        updateFile({ status: 'compressing', progress: 10 });
        uploadBlob = (await processImage(fileState.originalFile)) as any; // Cast for blob compatibility
        updateFile({ compressedBlob: uploadBlob, progress: 30 });
      }

      updateFile({ status: 'uploading', progress: 40 });
      const formData = new FormData();
      formData.append('runId', currentRunId);
      formData.append('category', fileState.category);
      formData.append('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
      formData.append('file', uploadBlob, fileState.originalFile.name);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      
      const data = await res.json();
      updateFile({ status: 'completed', progress: 100, uploadResult: data });

    } catch (error: any) {
      console.error('Processing error:', error);
      updateFile({ status: 'error', error: error.message, progress: 0 });
    }
  };

  const handleStartAnalysis = () => {
    if (runId) {
      navigate(`/processing?runId=${runId}`);
    }
  };

  const hasRequiredFiles = 
    Object.values(files).some(f => f.category === 'diet' && f.status === 'completed') &&
    Object.values(files).some(f => f.category === 'metrics' && f.status === 'completed');

  const renderDropzone = (category: 'diet' | 'metrics', title: string, icon: React.ReactNode, inputRef: React.RefObject<HTMLInputElement>) => {
    const categoryFiles = Object.values(files).filter(f => f.category === category);
    
    return (
      <GlassCard className="relative group overflow-hidden" hoverEffect>
        <input 
          ref={inputRef}
          type="file" 
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e, category)}
          accept="image/*,.pdf,.doc,.docx"
        />
        
        <div 
          className="flex flex-col items-center justify-center text-center p-8 min-h-[300px] border-2 border-dashed border-white/10 rounded-xl hover:border-primary/30 transition-colors cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          {categoryFiles.length === 0 ? (
            <>
              <div className="w-16 h-16 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                {icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-400 mb-6">
                Drag & drop or click to upload<br/>
                <span className="text-xs opacity-50">Images, PDF, DOCX</span>
              </p>
            </>
          ) : (
            <div className="w-full space-y-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-white">{title}</h3>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                  icon={<Upload className="w-3 h-3" />}
                >
                  Add More
                </Button>
              </div>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {categoryFiles.map(file => (
                  <div key={file.id} className="bg-white/5 rounded-lg p-3 flex items-center gap-3 border border-white/5" onClick={(e) => e.stopPropagation()}>
                    <div className="w-10 h-10 rounded bg-black/20 flex items-center justify-center shrink-0 overflow-hidden">
                      {file.status === 'compressing' || file.status === 'uploading' ? (
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      ) : file.status === 'error' ? (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      ) : (
                        <FileType className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{file.originalFile.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${file.status === 'error' ? 'bg-red-500' : 'bg-primary'}`} 
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </GlassCard>
    );
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-3 mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Upload <span className="text-primary text-glow">Context</span>
          </h1>
          <p className="text-gray-400">Upload your diet plan and metrics to begin.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            {error}
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-2">
          {renderDropzone('diet', 'Diet Plan', <FileText className="w-8 h-8 text-primary" />, dietInputRef)}
          {renderDropzone('metrics', 'Health Metrics', <Activity className="w-8 h-8 text-accent" />, metricsInputRef)}
        </div>

        <div className="flex justify-center mt-8">
          <Button
            onClick={handleStartAnalysis}
            disabled={!hasRequiredFiles}
            variant="primary"
            size="lg"
            className="w-full md:w-auto min-w-[200px]"
          >
            Start Analysis
          </Button>
        </div>
      </div>
    </Layout>
  );
}
