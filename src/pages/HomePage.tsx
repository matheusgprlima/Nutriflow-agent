import React from 'react';
import { ArrowRight, Upload, PhoneCall, Sparkles, Watch } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-16 py-8">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Live AI diet planning agent
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white">
            Your diet, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">planned by a live agent</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Upload your diet. Talk to the AI agent about your day. Get an adjusted plan — same foods, portions tuned for today. In real time.
          </p>
          <div className="flex justify-center pt-4">
            <Button size="lg" onClick={() => navigate('/intake')} icon={<ArrowRight className="w-5 h-5" />} className="px-8 py-6 text-lg">
              Start planning
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-5">
          <GlassCard className="space-y-3" hoverEffect>
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-white">1. Upload diet</h3>
            <p className="text-sm text-gray-400">Image or PDF of your current diet plan. This stays as your baseline.</p>
          </GlassCard>
          <GlassCard className="space-y-3" hoverEffect>
            <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
              <Watch className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">2. Activity data</h3>
            <p className="text-sm text-gray-400">Optionally add Apple Watch or health app screenshots for better accuracy.</p>
          </GlassCard>
          <GlassCard className="space-y-3" hoverEffect>
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <PhoneCall className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-white">3. Talk to agent</h3>
            <p className="text-sm text-gray-400">Have a live voice conversation with the AI. It asks about your day and generates your plan.</p>
          </GlassCard>
          <GlassCard className="space-y-3" hoverEffect>
            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">4. Get your plan</h3>
            <p className="text-sm text-gray-400">Same foods, adjusted portions. Not a new diet — a smarter day.</p>
          </GlassCard>
        </div>
      </div>
    </Layout>
  );
}
