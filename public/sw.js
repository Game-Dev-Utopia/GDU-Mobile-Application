const CACHE_NAME = 'gduxp-v1';
const ASSETS = [
  '/',
  '/transcript',
  '/leaderboard',
  '/profile',
  '/activities',
  '/my-claims',
  '/manifest.json',
  '/favicon.ico',
];

// Install event: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful GET responses
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic'
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(request, responseClone)
          );
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
