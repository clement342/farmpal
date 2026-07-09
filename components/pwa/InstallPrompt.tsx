'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA install prompt banner.
 *
 * Listens for the browser's `beforeinstallprompt` event and shows
 * a dismissable bottom banner when the app is installable.
 *
 * Renders nothing on iOS (Safari handles install via share sheet),
 * when already running as a standalone PWA, or after the user
 * dismisses the banner once (stored in sessionStorage).
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed as standalone
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Don't show if dismissed this session
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('pwa-prompt-dismissed', '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install FarmPal"
      className="fixed bottom-0 inset-x-0 z-50 p-4 pb-safe"
    >
      <div className="mx-auto max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 p-4 flex items-center gap-3">
        {/* Icon */}
        <img
          src="/icons/icon-192.png"
          alt="FarmPal"
          width={48}
          height={48}
          className="rounded-xl flex-shrink-0"
        />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            Install FarmPal
          </p>
          <p className="text-xs text-gray-500">
            Works offline. No internet required.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded"
          >
            Later
          </button>
          <button
            onClick={handleInstall}
            className="text-xs font-medium text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
