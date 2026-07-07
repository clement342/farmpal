const CACHE_VERSION = 'v1';
const STATIC_CACHE = `farmpal-static-${CACHE_VERSION}`;
const SHELL_CACHE = `farmpal-shell-${CACHE_VERSION}`;
const API_CACHE = `farmpal-api-${CACHE_VERSION}`;

const SHELL_URLS = [
  '/',
  '/diagnose',
];

const STATIC_PATTERNS = [
  /\/_next\/static\/.*/,
  /\/icons\/.*\.svg$/,
  /\/manifest\.json$/,
  /\/favicon\.svg$/,
  /\/apple-touch-icon\.svg$/,
];

const API_PATTERNS = [
  /\/api\/.*/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => {
        return cache.addAll(SHELL_URLS).catch(() => {
          // Individual URLs may fail — that's OK for shell pre-caching
        });
      }),
      caches.open(STATIC_CACHE),
      caches.open(API_CACHE),
    ]).then(() => {
      return self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name.startsWith('farmpal-') &&
              !name.endsWith(CACHE_VERSION)
            );
          })
          .map((name) => caches.delete(name)),
      );
    }).then(() => {
      return self.clients.claim();
    }),
  );
});

function isStaticAsset(url) {
  return STATIC_PATTERNS.some((pattern) => pattern.test(url));
}

function isApiCall(url) {
  return API_PATTERNS.some((pattern) => pattern.test(url));
}

function isShellUrl(url) {
  const path = new URL(url).pathname;
  return SHELL_URLS.includes(path);
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(
      JSON.stringify({
        success: false,
        message: 'You are offline. Some features may be unavailable.',
        offline: true,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (event.request.method !== 'GET') {
    return;
  }

  if (isApiCall(url)) {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE));
    return;
  }

  if (isShellUrl(url)) {
    event.respondWith(cacheFirst(event.request, SHELL_CACHE));
    return;
  }

  event.respondWith(networkFirst(event.request, SHELL_CACHE));
});
