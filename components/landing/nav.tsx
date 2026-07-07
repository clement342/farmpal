'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const links = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Offline AI', href: '#offline-ai' },
  { label: 'About', href: '#about' },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-black text-xs font-bold">
              F
            </span>
            <span className="text-sm font-medium tracking-tight">FarmPal</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://github.com/clement342/farmpal"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-200"
            >
              GitHub
            </a>
            <Button variant="primary" size="sm" href="/diagnose">
              Start Diagnosis
            </Button>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Toggle navigation"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              {open ? (
                <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border-subtle bg-background">
          <div className="px-4 py-4 space-y-3">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block text-sm text-text-secondary hover:text-text-primary transition-colors py-1.5"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://github.com/clement342/farmpal"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-text-secondary hover:text-text-primary transition-colors py-1.5"
            >
              GitHub
            </a>
            <Button variant="primary" size="sm" href="/diagnose" className="w-full mt-2">
              Start Diagnosis
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
