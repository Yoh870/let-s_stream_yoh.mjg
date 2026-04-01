/* ═══════════════════════════════════════════
   FLIXORA Service Worker v5.1
   Cache-first for static assets, network-first
   for TMDB API calls. Proper offline fallback.
═══════════════════════════════════════════ */

const CACHE_NAME    = 'flixora-v5';
const TMDB_CACHE    = 'flixora-tmdb-v5';
const IMG_CACHE     = 'flixora-img-v5';

/* Assets to pre-cache on install */
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  '/offline.html',
];

/* Inline offline page — no external file needed */
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Flixora — Offline</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#080810;color:#f2f2fc;font-family:'DM Sans',sans-serif;
       display:flex;flex-direction:column;align-items:center;justify-content:center;
       min-height:100vh;gap:18px;padding:24px;text-align:center}
  .logo{font-size:2.8rem;font-weight:900;letter-spacing:.08em;color:#e63946}
  h1{font-size:1.4rem;font-weight:700}
  p{color:#9494b8;font-size:.92rem;max-width:320px;line-height:1.6}
  button{margin-top:8px;padding:12px 28px;border-radius:30px;background:#e63946;
         color:#fff;border:none;font-size:.9rem;font-weight:700;cursor:pointer;
         font-family:inherit;transition:background .15s}
  button:hover{background:#ff5561}
</style>
</head>
<body>
  <div class="logo">FLIXORA</div>
  <h1>You're offline</h1>
  <p>Check your internet connection and try again. Your watchlist and continue-watching are saved locally.</p>
  <button onclick="location.reload()">Try Again</button>
</body>
</html>`;

/* ── INSTALL ─────────────────────────────── */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache offline page inline — no network needed
      cache.put('/offline.html', new Response(OFFLINE_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }));
      return cache.addAll(PRECACHE_ASSETS.filter(u => u !== '/offline.html')).catch(e => {
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

  if (request.method !== 'GET') return;

  // TMDB API — network first
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

  // App shell — stale-while-revalidate, offline fallback
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
    if (response.ok) cache.put(request, response.clone());
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

  if (cached) return cached;

  const live = await networkFetch;
  if (live) return live;

  // Return proper offline page for navigation requests
  if (request.mode === 'navigate') {
    const offline = await cache.match('/offline.html');
    if (offline) return offline;
  }

  return new Response('Offline', { status: 503 });
}
