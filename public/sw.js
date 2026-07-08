// No-op service worker: enables install prompt without request interception.
// No fetch listener — the browser handles all requests normally.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
