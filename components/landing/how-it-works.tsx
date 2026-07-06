import { SectionHeader } from '@/components/ui/section-header';

const steps = [
  {
    number: '01',
    title: 'Describe Symptoms',
    description: 'Tell FarmPal what you see — yellowing leaves, stunted growth, unusual spots. Describe it in your own words, just like talking to a fellow farmer.',
  },
  {
    number: '02',
    title: 'AI Asks Follow-Up Questions',
    description: 'Our local AI engages in a natural conversation, asking targeted questions to narrow down the possible causes and rule out false positives.',
  },
  {
    number: '03',
    title: 'Receive Diagnosis',
    description: 'FarmPal provides a detailed diagnosis including the disease name, confidence level, severity, and a clear explanation of the condition.',
  },
  {
    number: '04',
    title: 'Apply Recommendations',
    description: 'Get actionable advice — immediate steps, preventive measures, and guidance on when to consult an extension officer.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32 border-t border-border-subtle">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          label="How It Works"
          title="From symptoms to solutions in minutes"
          description="No app store, no account creation, no training required. Just open FarmPal and start describing what you see."
        />

        <div className="relative">
          <div className="hidden lg:block absolute left-[68px] top-12 bottom-12 w-px bg-border-subtle" />

          <div className="space-y-16 lg:space-y-0">
            {steps.map((step) => (
              <div key={step.number} className="lg:flex items-start gap-8 lg:pb-16 relative">
                <div className="hidden lg:flex w-[136px] shrink-0 items-start pt-1">
                  <span className="text-[40px] font-medium tracking-tighter text-text-muted leading-none">
                    {step.number}
                  </span>
                </div>

                <div className="lg:hidden flex items-center gap-4 mb-4">
                  <span className="w-8 h-8 rounded-full bg-accent-subtle border border-accent/20 flex items-center justify-center">
                    <span className="text-xs font-medium text-accent-text">{step.number}</span>
                  </span>
                  <div className="h-px flex-1 bg-border-subtle" />
                </div>

                <div className="lg:pl-0">
                  <h3 className="text-xl font-medium text-text-primary mb-2">{step.title}</h3>
                  <p className="text-text-secondary leading-relaxed max-w-xl">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
