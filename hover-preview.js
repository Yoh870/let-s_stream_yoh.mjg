/* ════════════════════════════════════════════
   FLIXORA — Hover Preview Cards
   Desktop: mouse hover (~500ms delay)
   Mobile:  long-press / tap-hold (~450ms)
   Shows: muted trailer clip if available, else
          static info overlay (title, year, rating)
════════════════════════════════════════════ */

(function () {
  const TMDB_KEY = '3fd2be6f0c70a2a598f084ddfb75487c';
  const HOVER_DELAY = 500;      // ms before desktop preview triggers
  const LONGPRESS_DELAY = 450;  // ms before mobile preview triggers
  const PREVIEW_SCALE = 1.15;

  // Cache trailer lookups so we don't re-fetch TMDB every hover
  const trailerCache = new Map(); // key: `${type}-${tmdbId}` -> youtubeKey | null
  const detailsCache = new Map(); // key: `${type}-${tmdbId}` -> {overview, genres, vote_average}

  let activeCard = null;
  let hoverTimer = null;
  let longpressTimer = null;

  /* ── Helpers to read card data ─────────────── */
  // Cards call playById(tmdbId, type, title, year) onclick.
  // We parse that same info out of the onclick attribute so we don't
  // need to touch existing card-rendering code anywhere else.
  function _parseCardData(card) {
    const onclick = card.getAttribute('onclick') || '';
    const m = onclick.match(/playById\('([^']*)','([^']*)','([^']*)','([^']*)'\)/);
    if (!m) return null;
    return { tmdb: m[1], type: m[2] === 'tv_series' ? 'tv' : m[2], title: m[3], year: m[4] };
  }

  async function _fetchTrailer(tmdb, type) {
    const key = `${type}-${tmdb}`;
    if (trailerCache.has(key)) return trailerCache.get(key);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdb}/videos?api_key=${TMDB_KEY}`);
      const data = await res.json();
      const vids = data.results || [];
      const trailer =
        vids.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
        vids.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
        vids.find(v => v.site === 'YouTube' && v.type === 'Teaser');
      const ytKey = trailer ? trailer.key : null;
      trailerCache.set(key, ytKey);
      return ytKey;
    } catch (e) {
      trailerCache.set(key, null);
      return null;
    }
  }

  async function _fetchDetails(tmdb, type) {
    const key = `${type}-${tmdb}`;
    if (detailsCache.has(key)) return detailsCache.get(key);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdb}?api_key=${TMDB_KEY}`);
      const d = await res.json();
      const info = {
        overview: d.overview || '',
        genres: (d.genres || []).slice(0, 3).map(g => g.name),
        vote_average: d.vote_average || 0,
        runtime: d.runtime || (d.episode_run_time && d.episode_run_time[0]) || null
      };
      detailsCache.set(key, info);
      return info;
    } catch (e) {
      const fallback = { overview: '', genres: [], vote_average: 0, runtime: null };
      detailsCache.set(key, fallback);
      return fallback;
    }
  }

  /* ── Build the overlay DOM ─────────────────── */
  function _buildOverlay(card, data) {
    const overlay = document.createElement('div');
    overlay.className = 'hp-overlay';
    overlay.innerHTML = `
      <div class="hp-media">
        <div class="hp-media-spin"><div class="hp-spinner"></div></div>
      </div>
      <div class="hp-info">
        <div class="hp-title">${data.title || ''}</div>
        <div class="hp-meta-row">
          <span class="hp-year">${data.year || ''}</span>
          <span class="hp-rating" style="display:none">★ <span class="hp-rating-val"></span></span>
        </div>
        <div class="hp-genres"></div>
        <div class="hp-actions">
          <button class="hp-play-btn" aria-label="Play">▶</button>
        </div>
      </div>
    `;
    card.appendChild(overlay);
    overlay.querySelector('.hp-play-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      card.click();
    });
    return overlay;
  }

  async function _populateOverlay(overlay, data) {
    const [ytKey, details] = await Promise.all([
      _fetchTrailer(data.tmdb, data.type),
      _fetchDetails(data.tmdb, data.type)
    ]);

    // Bail if card was un-hovered while we were fetching
    if (!overlay.isConnected || !overlay.classList.contains('hp-active')) return;

    const mediaBox = overlay.querySelector('.hp-media');
    if (ytKey) {
      mediaBox.innerHTML = `<iframe
        src="https://www.youtube.com/embed/${ytKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytKey}&modestbranding=1&rel=0&playsinline=1"
        allow="autoplay; encrypted-media"
        frameborder="0"
        title="Preview trailer"></iframe>`;
    } else {
      mediaBox.innerHTML = `<div class="hp-no-trailer">${data.title || ''}</div>`;
    }

    if (details.vote_average > 0) {
      const rEl = overlay.querySelector('.hp-rating');
      overlay.querySelector('.hp-rating-val').textContent = details.vote_average.toFixed(1);
      rEl.style.display = '';
    }
    if (details.genres.length) {
      overlay.querySelector('.hp-genres').textContent = details.genres.join(' · ');
    }
  }

  /* ── Activate / deactivate preview on a card ── */
  function _activate(card) {
    if (activeCard === card) return;
    _deactivateAll();

    const data = _parseCardData(card);
    if (!data || !data.tmdb) return;

    activeCard = card;
    card.classList.add('hp-card-active');
    const overlay = _buildOverlay(card, data);
    requestAnimationFrame(() => overlay.classList.add('hp-active'));
    _populateOverlay(overlay, data);
  }

  function _deactivateAll() {
    document.querySelectorAll('.hp-card-active').forEach(card => {
      card.classList.remove('hp-card-active');
      const overlay = card.querySelector('.hp-overlay');
      if (overlay) overlay.remove();
    });
    activeCard = null;
  }

  /* ── Attach listeners (desktop hover) ─────── */
  function _attachDesktop(card) {
    card.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => _activate(card), HOVER_DELAY);
    });
    card.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      if (activeCard === card) _deactivateAll();
    });
  }

  /* ── Attach listeners (mobile long-press) ─── */
  function _attachMobile(card) {
    let moved = false;
    card.addEventListener('touchstart', () => {
      moved = false;
      longpressTimer = setTimeout(() => {
        if (!moved) {
          _activate(card);
          if (navigator.vibrate) navigator.vibrate(12);
        }
      }, LONGPRESS_DELAY);
    }, { passive: true });

    card.addEventListener('touchmove', () => {
      moved = true;
      clearTimeout(longpressTimer);
    }, { passive: true });

    card.addEventListener('touchend', (e) => {
      clearTimeout(longpressTimer);
      if (activeCard === card) {
        // Long-press already showed the preview — first tap-after-hold
        // dismisses it instead of navigating, so users can look before
        // committing to play.
        if (!moved) e.preventDefault();
        _deactivateAll();
      }
    });
  }

  /* ── Scan the page and wire up all cards ──── */
  function _wireAllCards() {
    document.querySelectorAll('.content-card, .continue-card').forEach(card => {
      if (card.dataset.hpWired) return;
      card.dataset.hpWired = '1';
      card.classList.add('hp-card');
      _attachDesktop(card);
      _attachMobile(card);
    });
  }

  // Re-scan periodically since cards are re-rendered dynamically
  // (skeleton -> real content, category switches, watchlist updates, etc.)
  const observer = new MutationObserver(() => _wireAllCards());
  document.addEventListener('DOMContentLoaded', () => {
    _wireAllCards();
    observer.observe(document.body, { childList: true, subtree: true });
  });

  // Also dismiss preview on scroll (row scrolling shouldn't leave a
  // stale preview floating over the wrong card)
  document.addEventListener('scroll', () => { clearTimeout(hoverTimer); _deactivateAll(); }, { passive: true, capture: true });

  /* ── Styles ────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    .hp-card { position: relative; }
    .hp-card-active {
      z-index: 50;
      transform: scale(${PREVIEW_SCALE});
      transition: transform .28s cubic-bezier(.34,1.56,.64,1);
      box-shadow: 0 20px 50px rgba(0,0,0,.6);
      border-radius: 10px;
    }
    .hp-overlay {
      position: absolute; inset: 0;
      border-radius: 10px; overflow: hidden;
      opacity: 0; pointer-events: none;
      transition: opacity .22s ease;
      background: #0a0a12;
      display: flex; flex-direction: column;
    }
    .hp-overlay.hp-active { opacity: 1; pointer-events: all; }

    .hp-media {
      position: relative; width: 100%; aspect-ratio: 16/9;
      background: #000; overflow: hidden; flex-shrink: 0;
    }
    .hp-media iframe {
      position: absolute; top: 50%; left: 50%;
      width: 220%; height: 220%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .hp-media-spin {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .hp-spinner {
      width: 22px; height: 22px;
      border: 2px solid rgba(255,255,255,.15);
      border-top-color: #e63946;
      border-radius: 50%;
      animation: hpSpin .8s linear infinite;
    }
    @keyframes hpSpin { to { transform: rotate(360deg); } }
    .hp-no-trailer {
      display: flex; align-items: center; justify-content: center;
      width: 100%; height: 100%;
      background: linear-gradient(135deg, #1c1c2e, #0e0e18);
      color: #9494b8; font-size: .7rem; font-weight: 600;
      text-align: center; padding: 10px;
    }

    .hp-info {
      flex: 1; padding: 10px 10px 12px;
      background: #10101a;
      display: flex; flex-direction: column; gap: 5px;
    }
    .hp-title {
      font-size: .78rem; font-weight: 700; color: #f2f2fc;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .hp-meta-row {
      display: flex; align-items: center; gap: 8px;
      font-size: .68rem; color: #9494b8; font-weight: 600;
    }
    .hp-rating { color: #f5c518; }
    .hp-genres {
      font-size: .64rem; color: #6c6c94;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .hp-actions { margin-top: 2px; }
    .hp-play-btn {
      width: 26px; height: 26px; border-radius: 50%;
      background: #fff; color: #000; border: none;
      font-size: .6rem; display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: transform .15s;
    }
    .hp-play-btn:hover { transform: scale(1.12); }

    @media (max-width: 640px) {
      .hp-card-active { transform: scale(1.08); }
      .hp-media iframe { pointer-events: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .hp-card-active { transition: none; }
      .hp-overlay { transition: none; }
    }
  `;
  document.head.appendChild(style);
})();
