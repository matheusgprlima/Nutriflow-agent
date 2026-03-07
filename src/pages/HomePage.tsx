import React from 'react';
import { ArrowRight, Upload, Activity, Zap } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-16 py-8">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium animate-in fade-in slide-in-from-top-4">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            AI-Powered Nutrition Agent
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white animate-in fade-in slide-in-from-bottom-4">
            Precision Nutrition <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Autopilot
            </span>
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 delay-100">
            Upload your diet plan and daily metrics. NutriFlow analyzes, adjusts, and generates exact execution steps for tomorrow.
          </p>

          <div className="flex justify-center pt-4 animate-in fade-in slide-in-from-bottom-4 delay-200">
            <Button 
              size="lg" 
              onClick={() => navigate('/upload')}
              icon={<ArrowRight className="w-5 h-5" />}
              className="px-8 py-6 text-lg"
            >
              Upload Diet & Metrics
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 delay-300">
          <GlassCard className="space-y-4" hoverEffect>
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-white">1. Ingest</h3>
            <p className="text-gray-400">
              Upload photos of your diet plan (PDF/Images) and health metrics (Apple Watch, Oura, etc).
            </p>
          </GlassCard>

          <GlassCard className="space-y-4" hoverEffect>
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold text-white">2. Optimize</h3>
            <p className="text-gray-400">
              AI analyzes your activity, sleep, and adherence to adjust tomorrow's macros dynamically.
            </p>
          </GlassCard>

          <GlassCard className="space-y-4" hoverEffect>
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white">3. Execute</h3>
            <p className="text-gray-400">
              Get a precise meal plan and automated UI actions to log everything in your tracking app.
            </p>
          </GlassCard>
        </div>
      </div>
    </Layout>
  );
}
