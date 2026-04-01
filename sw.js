/* ═══════════════════════════════════════════
   FLIXORA Service Worker v5.0
   Cache-first for static assets, network-first
   for TMDB API calls. Offline fallback page.
═══════════════════════════════════════════ */

const CACHE_NAME    = 'flixora-v5';
const TMDB_CACHE    = 'flixora-tmdb-v5';
const IMG_CACHE     = 'flixora-img-v5';
const TMDB_CACHE_TTL = 5 * 60 * 1000; // 5 min

/* Assets to pre-cache on install */
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
];

/* ── INSTALL ─────────────────────────────── */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(e => {
        console.warn('[SW] Precache failed:', e.message);
      });
    })
  );
});

/* ── ACTIVATE ────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== TMDB_CACHE && k !== IMG_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH ───────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;

  // TMDB API — network first with TMDB cache
  if (url.hostname === 'api.themoviedb.org') {
    event.respondWith(networkFirstTMDB(request));
    return;
  }

  // TMDB images — cache first
  if (url.hostname === 'image.tmdb.org') {
    event.respondWith(cacheFirstImages(request));
    return;
  }

  // Google Fonts — cache first
  if (url.hostname.includes('fonts.g') || url.hostname.includes('fonts.googleapis')) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // App shell — stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

/* ── STRATEGIES ──────────────────────────── */

async function networkFirstTMDB(request) {
  const cache = await caches.open(TMDB_CACHE);
  try {
    const response = await fetch(request.clone(), { signal: AbortSignal.timeout(8000) });
    if (response.ok) {
      const cloned = response.clone();
      cache.put(request, cloned);
    }
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ success: false, status_message: 'Offline' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function cacheFirstImages(request) {
  const cache = await caches.open(IMG_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    // Return transparent 1x1 SVG as placeholder
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || await networkFetch || new Response('Offline', { status: 503 });
}
