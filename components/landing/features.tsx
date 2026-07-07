import { SectionHeader } from '@/components/ui/section-header';

interface Feature {
  title: string;
  description: string;
  icon: string;
}

const features: Feature[] = [
  {
    title: 'Offline AI Diagnosis',
    description: 'Powered by Google Gemma, FarmPal runs entirely on your device. Diagnose diseases without an internet connection.',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    title: 'Conversation-Based Diagnosis',
    description: 'Describe symptoms naturally. FarmPal asks follow-up questions to narrow down the issue, just like a real agronomist.',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  },
  {
    title: 'Local Data Storage',
    description: 'Your farm data never leaves your device. All diagnoses, crop information, and history are stored locally.',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  },
  {
    title: 'Fast AI Responses',
    description: 'Get instant preliminary assessments without waiting for cloud servers. The local model provides rapid analysis.',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    title: 'Conversation History',
    description: 'Every diagnosis session is saved. Review past conversations, track recurring issues, and monitor crop health over time.',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  {
    title: 'Privacy First',
    description: 'No cloud uploads, no data mining. Your agricultural data stays under your control, completely offline.',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8zM12 3a4 4 0 00-4 4v2',
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32 border-t border-border-subtle">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          label="Features"
          title="Built for farmers, designed for reliability"
          description="Every feature is crafted to work without connectivity, respect your privacy, and deliver accurate diagnoses through natural conversation."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border-subtle rounded-2xl overflow-hidden">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="bg-surface p-6 sm:p-8 transition-colors duration-200 hover:bg-surface-elevated"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-10 h-10 rounded-lg bg-accent-subtle border border-accent/20 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-text">
                  <path d={feature.icon} />
                </svg>
              </div>
              <h3 className="text-base font-medium text-text-primary mb-2">{feature.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
