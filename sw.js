const CACHE = 'pipeline-v5';
const BASE = self.registration.scope;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      BASE,
      BASE + 'app.js',
      BASE + 'i18n.js',
      BASE + 'style.css',
      BASE + 'sw.js',
      BASE + 'manifest.json',
      BASE + 'constants.js',
      BASE + 'state.js',
      BASE + 'dom.js',
      BASE + 'utils.js',
      BASE + 'persistence.js',
      BASE + 'scoring.js',
      BASE + 'rendering.js',
      BASE + 'round.js',
      BASE + 'solo.js',
      BASE + 'multiplayer.js',
      BASE + 'camera.js',
    ]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stale-while-revalidate: serve cached instantly, update in background
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Skip Firebase and QR API requests — always fetch fresh
  const url = e.request.url;
  if (url.includes('firebase') || url.includes('qrserver')) return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(res => {
          cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
  );
});
