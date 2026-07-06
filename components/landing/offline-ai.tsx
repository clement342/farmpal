import { SectionHeader } from '@/components/ui/section-header';

const indicators = [
  { label: 'AI Ready', variant: 'accent' as const },
  { label: 'Local Model Connected', variant: 'accent' as const },
  { label: 'Offline Enabled', variant: 'accent' as const },
];

const bullets = [
  'Runs locally using Google Gemma',
  'No permanent internet required',
  'Data remains on your device',
  'Reliable in low-connectivity environments',
];

export function OfflineAI() {
  return (
    <section id="offline-ai" className="py-24 sm:py-32 border-t border-border-subtle">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          label="Offline AI"
          title="AI that works where you work"
          description="FarmPal is built on Google Gemma, a state-of-the-art language model that runs entirely on your device."
        />

        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border-subtle">
              <div className="w-10 h-10 rounded-lg bg-accent-subtle border border-accent/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-text">
                  <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-text-primary">Model Status</h3>
                <p className="text-xs text-text-muted mt-0.5">Gemma 3B — Local Inference</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {bullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent mt-0.5 shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-sm text-text-secondary">{bullet}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              {indicators.map((indicator) => (
                <div
                  key={indicator.label}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-subtle bg-background"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="text-xs text-text-muted font-medium">{indicator.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
