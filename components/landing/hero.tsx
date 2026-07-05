'use client';

import { Button } from '@/components/ui/button';

export function Hero() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/3 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-accent/2 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-32 w-full">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border-subtle bg-surface/50 mb-8 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
              <span className="text-xs text-text-muted font-medium tracking-wide">
                Offline AI — Powered by Gemma
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight leading-tight">
              Diagnose Crop Diseases{' '}
              <span className="text-accent-text">Anywhere, Even Offline</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-text-secondary leading-relaxed max-w-xl">
              FarmPal runs a local AI model on your device to diagnose crop diseases
              through natural conversation. No internet required. Your data stays with you.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button variant="primary" size="lg" href="/diagnose">
                Start Diagnosis
              </Button>
              <Button variant="secondary" size="lg" href="#features">
                Learn More
              </Button>
            </div>
          </div>

          <div className="flex-1 w-full max-w-md lg:max-w-none">
            <div className="relative aspect-square lg:aspect-[4/3] w-full rounded-2xl border border-border-subtle bg-surface overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent-subtle border border-accent/20 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-text">
                      <path d="M12 2a4 4 0 0 0-4 4v4h-2a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4v-2a4 4 0 0 0-4-4h-2V6a4 4 0 0 0-4-4z" />
                      <path d="M12 14v4" />
                      <path d="M10 16h4" />
                    </svg>
                  </div>
                  <p className="text-sm text-text-secondary">AI Analysis Ready</p>
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" style={{ animationDelay: '0s' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse-dot" style={{ animationDelay: '0.3s' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/30 animate-pulse-dot" style={{ animationDelay: '0.6s' }} />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-elevated border border-border-subtle">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-xs text-text-secondary">Local model connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
