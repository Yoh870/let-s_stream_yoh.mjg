/* ═══════════════════════════════════════════════════
   StreamFlix — Service Worker
   Enables: offline support, install prompt, caching
═══════════════════════════════════════════════════ */

const CACHE  = 'streamflix-v1';
const ASSETS = [
  '/let-s_stream_yoh.mjg/',
  '/let-s_stream_yoh.mjg/index.html',
  '/let-s_stream_yoh.mjg/app.js',
  '/let-s_stream_yoh.mjg/manifest.json',
];

/* ── Install: cache core files ─────────────────── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

/* ── Activate: clear old caches ────────────────── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch: network-first, fallback to cache ───── */
self.addEventListener('fetch', e => {
  /* Skip non-GET and cross-origin API calls (TMDB, video embeds) */
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname.includes('themoviedb.org') ||
      url.hostname.includes('vidsrc')         ||
      url.hostname.includes('embed.su')       ||
      url.hostname.includes('vidlink')        ||
      url.hostname.includes('autoembed')      ||
      url.hostname.includes('2embed')         ||
      url.hostname.includes('multiembed')     ||
      url.hostname.includes('unsplash.com')   ||
      url.hostname.includes('image.tmdb.org')) {
    return; /* let browser handle API & image requests normally */
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        /* Cache fresh responses for our own files */
        if (res.ok && url.hostname === self.location.hostname) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request)) /* offline fallback */
  );
});
