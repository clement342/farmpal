'use client';

import { useEffect } from 'react';

export function SWRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
