/* ═══════════════════════════════════════════════════════════
   FLIXORA — Infinite Scroll for Horizontal Rows
   ───────────────────────────────────────────────────────────
   Watches each .row-scroll container; when the user scrolls
   near the right edge, fetches the next TMDB page and appends
   more cards. Works for Trending, Movies, TV, K-Drama, Anime.
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const THRESHOLD = 400; // px from the end before triggering next page

  // Maps row element id -> { endpoint, params, type, page, loading, done }
  const ROW_CONFIG = {
    trendingContent: { ep: '/trending/all/week', p: {}, type: null },
    moviesContent:   { ep: '/movie/popular', p: { region: 'PH' }, type: 'movie' },
    tvContent:       { ep: '/tv/popular', p: { region: 'PH' }, type: 'tv' },
    kdramaContent:   { ep: '/discover/tv', p: { with_origin_country: 'KR', sort_by: 'popularity.desc' }, type: 'tv' },
    animeContent:    { ep: '/discover/tv', p: { with_genres: '16', with_origin_country: 'JP', sort_by: 'popularity.desc' }, type: 'tv' },
    matureContent:   { ep: '/discover/movie', p: { certification_country: 'US', 'certification.gte': 'R', sort_by: 'popularity.desc' }, type: 'movie' },
  };

  const state = {}; // id -> { page, loading, done }

  function _initState() {
    Object.keys(ROW_CONFIG).forEach(id => {
      state[id] = { page: 1, loading: false, done: false };
    });
  }

  async function _loadMore(id) {
    const cfg = ROW_CONFIG[id];
    const st = state[id];
    if (!cfg || st.loading || st.done) return;

    st.loading = true;
    const nextPage = st.page + 1;

    try {
      const d = await window.tmdb(cfg.ep, { ...cfg.p, page: nextPage });
      if (!d?.results?.length) { st.done = true; st.loading = false; return; }

      st.page = nextPage;
      if (nextPage >= (d.total_pages || 1)) st.done = true;

      const row = document.getElementById(id);
      if (!row) { st.loading = false; return; }

      const html = d.results
        .map(item => window.makeCard(item, cfg.type, 0, false))
        .join('');
      row.insertAdjacentHTML('beforeend', html);

      // Re-observe any new lazy images
      if (typeof window._observeLazy === 'function') window._observeLazy();
    } catch (e) {
      console.warn('[InfiniteScroll] failed for', id, e);
    }
    st.loading = false;
  }

  function _attachListener(row) {
    if (row._infiniteScrollAttached) return;
    row._infiniteScrollAttached = true;

    row.addEventListener('scroll', () => {
      const { scrollLeft, scrollWidth, clientWidth } = row;
      const distanceFromEnd = scrollWidth - (scrollLeft + clientWidth);
      if (distanceFromEnd < THRESHOLD) {
        _loadMore(row.id);
      }
    }, { passive: true });
  }

  function _watchRows() {
    Object.keys(ROW_CONFIG).forEach(id => {
      const row = document.getElementById(id);
      if (row) _attachListener(row);
    });
  }

  function boot() {
    _initState();
    _watchRows();

    // Re-check periodically in case rows are re-rendered dynamically
    // (e.g. genre filter re-populates #trendingContent etc.)
    const obs = new MutationObserver(() => _watchRows());
    document.querySelectorAll('.row-scroll').forEach(row => {
      obs.observe(row, { childList: false }); // just ensure listener stays attached
    });

    console.log('%c✅ Flixora Infinite Scroll — active', 'color:#e63946;font-weight:bold');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
