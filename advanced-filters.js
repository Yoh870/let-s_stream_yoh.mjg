/* ═══════════════════════════════════════════════════════════
   FLIXORA — Advanced Filter Panel
   ───────────────────────────────────────────────────────────
   Adds a "Filters" button + dropdown panel (Type, Year, Sort)
   that queries TMDB /discover directly. Uses the globals already
   exposed by app.js (tmdb, renderGrid, showResultsView, setInfo,
   makePagination) — doesn't touch app.js itself.
   Drop this AFTER app.js in index.html.
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const CURRENT_YEAR = new Date().getFullYear();
  const MIN_YEAR = 1970;

  const SORT_OPTIONS = [
    { id: 'popularity.desc',        label: 'Most Popular' },
    { id: 'vote_average.desc',      label: 'Highest Rated' },
    { id: 'primary_release_date.desc', label: 'Newest First' },
    { id: 'primary_release_date.asc',  label: 'Oldest First' },
  ];

  const state = {
    type: 'all',      // all | movie | tv | anime
    yearFrom: '',
    yearTo: '',
    sort: 'popularity.desc',
    page: 1,
    open: false,
  };

  /* ── CSS ──────────────────────────────────────────────── */
  function _injectCSS() {
    if (document.getElementById('fxaf-css')) return;
    const s = document.createElement('style');
    s.id = 'fxaf-css';
    s.textContent = `
      #fxafBtn {
        flex-shrink: 0; padding: 7px 16px; border-radius: 30px;
        background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.07);
        color: #9494b8; font-size: .8rem; font-weight: 600;
        cursor: pointer; white-space: nowrap; display: inline-flex;
        align-items: center; gap: 6px; transition: all .15s;
      }
      #fxafBtn:hover, #fxafBtn.fxaf-active { background: #e63946; color: #fff; border-color: transparent; }

      #fxafPanel {
        position: relative; margin: 0 22px 4px;
        max-height: 0; overflow: hidden;
        transition: max-height .28s ease;
      }
      #fxafPanel.fxaf-open { max-height: 220px; }
      #fxafInner {
        background: #141421; border: 1px solid rgba(255,255,255,.1);
        border-radius: 14px; padding: 16px;
        display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 14px; margin-top: 8px;
      }
      .fxaf-field label {
        display: block; font-size: .64rem; font-weight: 700;
        letter-spacing: .1em; text-transform: uppercase; color: #4e4e70;
        margin-bottom: 6px;
      }
      .fxaf-field select, .fxaf-field input {
        width: 100%; padding: 8px 10px; border-radius: 8px;
        background: #1c1c2e; border: 1px solid rgba(255,255,255,.1);
        color: #f2f2fc; font-size: .82rem; font-family: inherit;
      }
      .fxaf-field select:focus, .fxaf-field input:focus { border-color: #e63946; }
      .fxaf-yearrow { display: flex; gap: 8px; align-items: center; }
      .fxaf-yearrow span { color: #4e4e70; font-size: .75rem; flex-shrink: 0; }
      .fxaf-actions {
        grid-column: 1/-1; display: flex; gap: 10px; justify-content: flex-end;
        padding-top: 4px;
      }
      .fxaf-apply, .fxaf-reset {
        padding: 8px 18px; border-radius: 20px; font-size: .8rem;
        font-weight: 700; cursor: pointer; font-family: inherit; transition: all .15s;
      }
      .fxaf-apply { background: #e63946; color: #fff; border: none; }
      .fxaf-apply:hover { background: #ff5561; }
      .fxaf-reset { background: transparent; border: 1px solid rgba(255,255,255,.15); color: #9494b8; }
      .fxaf-reset:hover { color: #fff; border-color: rgba(255,255,255,.3); }

      @media (max-width: 640px) {
        #fxafPanel { margin: 0 14px 4px; }
        #fxafPanel.fxaf-open { max-height: 320px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Build UI ─────────────────────────────────────────── */
  function _yearOptions(selectedVal) {
    let opts = `<option value="">Any</option>`;
    for (let y = CURRENT_YEAR + 1; y >= MIN_YEAR; y--) {
      opts += `<option value="${y}"${String(y) === String(selectedVal) ? ' selected' : ''}>${y}</option>`;
    }
    return opts;
  }

  function _buildUI() {
    const genreBar = document.getElementById('genreBar');
    if (!genreBar || document.getElementById('fxafBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'fxafBtn';
    btn.innerHTML = '🎛 Filters';
    btn.addEventListener('click', _togglePanel);
    genreBar.parentNode.insertBefore(btn, genreBar);
    genreBar.style.display = 'inline-flex';
    // Wrap genreBar + button in a flex row without breaking existing layout
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:0 22px';
    genreBar.parentNode.insertBefore(row, genreBar);
    row.appendChild(btn);
    row.appendChild(genreBar);
    genreBar.style.padding = '16px 0 12px';

    const panel = document.createElement('div');
    panel.id = 'fxafPanel';
    panel.innerHTML = `
      <div id="fxafInner">
        <div class="fxaf-field">
          <label>Type</label>
          <select id="fxafType">
            <option value="all">All</option>
            <option value="movie">Movies</option>
            <option value="tv">TV Series</option>
            <option value="anime">Anime</option>
          </select>
        </div>
        <div class="fxaf-field">
          <label>Year Range</label>
          <div class="fxaf-yearrow">
            <select id="fxafYearFrom">${_yearOptions('')}</select>
            <span>to</span>
            <select id="fxafYearTo">${_yearOptions('')}</select>
          </div>
        </div>
        <div class="fxaf-field">
          <label>Sort By</label>
          <select id="fxafSort">
            ${SORT_OPTIONS.map(o => `<option value="${o.id}">${o.label}</option>`).join('')}
          </select>
        </div>
        <div class="fxaf-actions">
          <button class="fxaf-reset" id="fxafReset">Reset</button>
          <button class="fxaf-apply" id="fxafApply">Apply Filters</button>
        </div>
      </div>
    `;
    row.parentNode.insertBefore(panel, row.nextSibling);

    document.getElementById('fxafApply').addEventListener('click', () => {
      state.type     = document.getElementById('fxafType').value;
      state.yearFrom = document.getElementById('fxafYearFrom').value;
      state.yearTo   = document.getElementById('fxafYearTo').value;
      state.sort     = document.getElementById('fxafSort').value;
      state.page     = 1;
      _runFilters(1);
    });

    document.getElementById('fxafReset').addEventListener('click', () => {
      document.getElementById('fxafType').value = 'all';
      document.getElementById('fxafYearFrom').value = '';
      document.getElementById('fxafYearTo').value = '';
      document.getElementById('fxafSort').value = 'popularity.desc';
      state.type = 'all'; state.yearFrom = ''; state.yearTo = ''; state.sort = 'popularity.desc';
      if (typeof window.goHome === 'function') window.goHome();
      _closePanel();
    });
  }

  function _togglePanel() { state.open ? _closePanel() : _openPanel(); }
  function _openPanel() {
    state.open = true;
    document.getElementById('fxafPanel')?.classList.add('fxaf-open');
    document.getElementById('fxafBtn')?.classList.add('fxaf-active');
  }
  function _closePanel() {
    state.open = false;
    document.getElementById('fxafPanel')?.classList.remove('fxaf-open');
    document.getElementById('fxafBtn')?.classList.remove('fxaf-active');
  }

  /* ── Run the filtered query ──────────────────────────── */
  async function _runFilters(page) {
    if (typeof window.tmdb !== 'function') { console.warn('[Filters] tmdb() not found'); return; }
    state.page = page;
    _closePanel();

    const label = _describeFilters();
    window.showResultsView?.();
    window.setInfo?.(label, '⏳ Loading…');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const baseParams = { sort_by: state.sort, page };
    if (state.yearFrom) baseParams['primary_release_date.gte'] = `${state.yearFrom}-01-01`;
    if (state.yearTo)   baseParams['primary_release_date.lte'] = `${state.yearTo}-12-31`;

    // TV uses different date param names
    const tvParams = { sort_by: state.sort.replace('primary_release_date', 'first_air_date'), page };
    if (state.yearFrom) tvParams['first_air_date.gte'] = `${state.yearFrom}-01-01`;
    if (state.yearTo)   tvParams['first_air_date.lte'] = `${state.yearTo}-12-31`;

    let results = [];
    let totalPages = 1;

    if (state.type === 'anime') {
      const d = await window.tmdb('/discover/tv', { ...tvParams, with_genres: '16', with_origin_country: 'JP' });
      results = (d?.results || []).map(r => ({ ...r, media_type: 'tv' }));
      totalPages = d?.total_pages || 1;
    } else if (state.type === 'movie') {
      const d = await window.tmdb('/discover/movie', baseParams);
      results = (d?.results || []).map(r => ({ ...r, media_type: 'movie' }));
      totalPages = d?.total_pages || 1;
    } else if (state.type === 'tv') {
      const d = await window.tmdb('/discover/tv', tvParams);
      results = (d?.results || []).map(r => ({ ...r, media_type: 'tv' }));
      totalPages = d?.total_pages || 1;
    } else {
      const [mv, tv] = await Promise.all([
        window.tmdb('/discover/movie', baseParams),
        window.tmdb('/discover/tv', tvParams),
      ]);
      results = [
        ...(mv?.results || []).map(r => ({ ...r, media_type: 'movie' })),
        ...(tv?.results || []).map(r => ({ ...r, media_type: 'tv' })),
      ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      totalPages = Math.max(mv?.total_pages || 1, tv?.total_pages || 1);
    }

    if (!results.length) {
      window.setInfo?.(label, 'No titles match these filters.');
      window.renderGrid?.([]);
      return;
    }

    window.setInfo?.(label, `${results.length} titles${page > 1 ? ' — Page ' + page : ''}`);
    window.renderGrid?.(results);
    window.makePagination?.(Math.min(totalPages, 500), page, 'FXAF.run(PAGE)');
  }

  function _describeFilters() {
    const typeLabel = { all: 'All Titles', movie: 'Movies', tv: 'TV Series', anime: 'Anime' }[state.type];
    const sortLabel = SORT_OPTIONS.find(o => o.id === state.sort)?.label || '';
    let yearLabel = '';
    if (state.yearFrom && state.yearTo) yearLabel = ` · ${state.yearFrom}–${state.yearTo}`;
    else if (state.yearFrom) yearLabel = ` · from ${state.yearFrom}`;
    else if (state.yearTo) yearLabel = ` · until ${state.yearTo}`;
    return `🎛 ${typeLabel}${yearLabel} · ${sortLabel}`;
  }

  window.FXAF = { run: _runFilters, open: _openPanel, close: _closePanel };

  /* ── Boot ─────────────────────────────────────────────── */
  function boot() {
    _injectCSS();
    _buildUI();
    console.log('%c✅ Flixora Advanced Filters ready', 'color:#e63946;font-weight:bold');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
