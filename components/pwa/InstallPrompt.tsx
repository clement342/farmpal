'use client';

import { useState, useEffect, useCallback } from 'react';

const DISMISSAL_KEY = 'farmpal-install-dismissed';
const DISMISSAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  const checkDismissal = useCallback(() => {
    try {
      const raw = localStorage.getItem(DISMISSAL_KEY);
      if (raw) {
        const dismissedAt = parseInt(raw, 10);
        if (Date.now() - dismissedAt < DISMISSAL_TTL_MS) {
          return true;
        }
        localStorage.removeItem(DISMISSAL_KEY);
      }
    } catch {
      // localStorage unavailable
    }
    return false;
  }, []);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      if (!checkDismissal()) {
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [checkDismissal]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'dismissed') {
      try {
        localStorage.setItem(DISMISSAL_KEY, String(Date.now()));
      } catch { /* noop */ }
    }
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setDeferredPrompt(null);
    try {
      localStorage.setItem(DISMISSAL_KEY, String(Date.now()));
    } catch { /* noop */ }
  };

  if (!isVisible || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md">
      <div className="animate-fade-in rounded-xl border border-border-subtle bg-surface-elevated p-4 shadow-lg shadow-black/40">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-lg">
            🌱
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-accent-text">Install FarmPal</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              Install for faster access and offline crop diagnosis.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-lg border border-border-hover bg-surface px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
