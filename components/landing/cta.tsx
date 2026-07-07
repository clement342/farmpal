import { Button } from '@/components/ui/button';

export function CTA() {
  return (
    <section id="cta" className="py-24 sm:py-32 border-t border-border-subtle">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl border border-border-subtle bg-surface overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-accent/3 blur-3xl" />
          </div>

          <div className="relative py-16 sm:py-20 px-6 sm:px-12 text-center">
            <h2 className="text-3xl sm:text-4xl font-medium tracking-tight max-w-lg mx-auto">
              Ready to diagnose your crops?
            </h2>
            <p className="mt-4 text-lg text-text-secondary max-w-md mx-auto">
              No setup, no account, no internet required. Start describing your symptoms and get answers instantly.
            </p>
            <div className="mt-8">
              <Button variant="primary" size="lg" href="/diagnose">
                Start Diagnosis
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
