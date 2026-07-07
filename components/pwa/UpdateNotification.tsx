'use client';

import { useState, useEffect, useCallback } from 'react';

export function UpdateNotification() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const onSWUpdate = useCallback((registration: ServiceWorkerRegistration) => {
    const worker = registration.waiting;
    if (worker) {
      setWaitingWorker(worker);
      setIsVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');

        if (registration.waiting) {
          onSWUpdate(registration);
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                onSWUpdate(registration);
              }
            });
          }
        });
      } catch {
        // SW registration failed — non-critical
      }
    };

    registerSW();

    let interval: ReturnType<typeof setInterval>;
    const startPolling = async () => {
      if ('serviceWorker' in navigator) {
        interval = setInterval(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.update();
          }
        }, 60 * 60 * 1000);
      }
    };
    startPolling();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [onSWUpdate]);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.addEventListener('statechange', () => {
        if (waitingWorker.state === 'activated') {
          window.location.reload();
        }
      });
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md">
      <div className="animate-fade-in rounded-xl border border-border-subtle bg-surface-elevated p-4 shadow-lg shadow-black/40">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-lg">
            🔄
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-accent-text">
              New version available
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              A new version of FarmPal is available. Update for the latest features.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleUpdate}
            className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Update
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-lg border border-border-hover bg-surface px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
