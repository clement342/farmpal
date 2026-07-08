'use client';

import { useState, useEffect } from 'react';

export function OfflineDetector() {
  const [isOffline, setIsOffline] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      setShowBanner(false);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOffline) {
      setShowBanner(true);
    }
  }, [isOffline]);

  if (!showBanner) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        isOffline ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="border-b border-border-subtle bg-surface px-4 py-2.5">
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-2 text-sm">
          <span className="text-accent-text">📡</span>
          <span className="font-medium text-foreground">
            You are offline
          </span>
          <span className="text-text-secondary">
            — Knowledge Engine is still available for crop diagnosis.
          </span>
          {isOffline && (
            <button
              onClick={() => setShowBanner(false)}
              className="ml-2 text-text-muted transition-colors hover:text-text-secondary"
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
