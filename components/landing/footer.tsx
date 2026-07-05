import Link from 'next/link';

export function Footer() {
  return (
    <footer id="about" className="border-t border-border-subtle">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <span className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-black text-xs font-bold">
                F
              </span>
              <span className="text-sm font-medium tracking-tight">FarmPal</span>
            </Link>
            <p className="text-sm text-text-muted leading-relaxed max-w-xs">
              Offline-first AI crop disease diagnosis assistant. Powered by Google Gemma.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-medium tracking-wider uppercase text-text-muted mb-4">Product</h4>
            <ul className="space-y-2.5">
              <li><a href="#features" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="text-sm text-text-secondary hover:text-text-primary transition-colors">How It Works</a></li>
              <li><a href="#offline-ai" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Offline AI</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-medium tracking-wider uppercase text-text-muted mb-4">Project</h4>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="https://github.com/clement342/farmpal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li><a href="#" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Privacy</a></li>
              <li><a href="#" className="text-sm text-text-secondary hover:text-text-primary transition-colors">License</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-medium tracking-wider uppercase text-text-muted mb-4">Hackathon</h4>
            <ul className="space-y-2.5">
              <li className="text-sm text-text-muted">Built for the AI</li>
              <li className="text-sm text-text-muted">Hackathon 2026</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} FarmPal. All rights reserved.
          </p>
          <p className="text-xs text-text-muted">
            Made with care for farmers everywhere.
          </p>
        </div>
      </div>
    </footer>
  );
}
