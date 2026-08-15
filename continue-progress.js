/* ═══════════════════════════════════════════════════════════
   FLIXORA — Continue Watching: Real Progress Tracking
   ───────────────────────────────────────────────────────────
   Since playback is inside a cross-origin iframe, we can't read
   the embed's actual currentTime/duration. Instead we track how
   long the player modal stays open (wall-clock proxy) and divide
   it by the title's real runtime (fetched from TMDB), giving an
   honest estimate instead of the old random percentage.
   Drop this AFTER app.js (and after any script that defines
   _renderContinueRow / _getContinue / _saveWatchlist etc — those
   live in the inline <script> block in index.html, but since they
   are plain `function` declarations they're already on window
   by the time DOMContentLoaded fires, same as this file).
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const SAVE_INTERVAL = 5000;   // ms between autosave ticks while watching
  const MAX_PCT = 96;           // never show as fully "done" (ambiguous w/o real signal)
  const MIN_PCT = 3;            // small nonzero start once opened, so bar isn't invisible

  let tickTimer = null;
  let watchStart = null;
  let activeKey = null; // `${tmdb}_${type}`

  /* ── Storage ──────────────────────────────────────────── */
  function _load() {
    try { return JSON.parse(localStorage.getItem('fx_watch_progress') || '{}'); }
    catch (_) { return {}; }
  }
  function _save(obj) {
    try { localStorage.setItem('fx_watch_progress', JSON.stringify(obj)); } catch (_) {}
  }

  function _key(data) { return `${data.tmdb}_${data.type}`; }

  /* ── Runtime lookup (minutes → seconds) ─────────────────── */
  const _runtimeCache = new Map();
  async function _getRuntimeSeconds(data) {
    const key = _key(data);
    if (_runtimeCache.has(key)) return _runtimeCache.get(key);
    if (typeof window.tmdb !== 'function') return 45 * 60; // sane fallback

    const d = await window.tmdb(`/${data.type}/${data.tmdb}`);
    let minutes = 45; // fallback default
    if (data.type === 'movie' && d?.runtime) minutes = d.runtime;
    else if (data.type === 'tv' && Array.isArray(d?.episode_run_time) && d.episode_run_time[0]) {
      minutes = d.episode_run_time[0];
    }
    const seconds = Math.max(minutes, 5) * 60;
    _runtimeCache.set(key, seconds);
    return seconds;
  }

  /* ── Start / stop watch timer ────────────────────────────── */
  function _startTracking(data) {
    if (!data?.tmdb) return;
    activeKey = _key(data);
    watchStart = Date.now();
    clearInterval(tickTimer);
    tickTimer = setInterval(() => _commit(data, false), SAVE_INTERVAL);
  }

  function _stopTracking(data) {
    if (activeKey) _commit(data, true);
    clearInterval(tickTimer);
    tickTimer = null;
    watchStart = null;
    activeKey = null;
  }

  async function _commit(data, isFinal) {
    if (!watchStart || !data?.tmdb) return;
    const elapsed = (Date.now() - watchStart) / 1000; // seconds this session so far
    watchStart = Date.now(); // reset window so we accumulate incrementally

    const store = _load();
    const key = _key(data);
    const prev = store[key] || { seconds: 0 };
    const newSeconds = (prev.seconds || 0) + elapsed;

    const runtimeSeconds = await _getRuntimeSeconds(data);
    const pct = Math.min(MAX_PCT, Math.max(MIN_PCT, Math.round((newSeconds / runtimeSeconds) * 100)));

    store[key] = { seconds: newSeconds, runtimeSeconds, pct, ts: Date.now() };
    _save(store);

    if (isFinal) _refreshContinueRow();
  }

  function getProgressPct(data) {
    const store = _load();
    const hit = store[_key(data)];
    return hit ? hit.pct : MIN_PCT;
  }
  window.FXProgress = { get: getProgressPct };

  /* ── Refresh the Continue Watching row with real percentages ── */
  function _refreshContinueRow() {
    if (typeof window._renderContinueRow === 'function') window._renderContinueRow();
  }

  /* ── Override the random-percent renderer with a real one ──── */
  function _patchRenderContinueRow() {
    if (typeof window._getContinue !== 'function') return; // not loaded yet
    if (window._renderContinueRow?._fxPatched) return;

    window._renderContinueRow = async function () {
      const list = window._getContinue();
      const sec = document.getElementById('continueSection');
      if (sec) sec.classList.toggle('has-items', list.length > 0);
      const row = document.getElementById('continueContent');
      if (!row) return;

      const store = _load();

      row.innerHTML = list.slice(0, 8).map((i, idx) => {
        const hit = store[`${i.tmdb}_${i.type}`];
        const pct = hit ? hit.pct : MIN_PCT;
        return `<div class="continue-card"
          onclick="playById('${i.tmdb}','${i.type}','${(i.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;')}','${i.year || ''}')"
          style="width:152px;scroll-snap-align:start">
          <div style="aspect-ratio:2/3;overflow:hidden;position:relative;background:var(--bg4)">
            <img id="cw-img-${idx}" src="" alt="${(i.title || '').replace(/"/g, '&quot;')}" loading="lazy"
              style="width:100%;height:100%;object-fit:cover;display:none;position:absolute;inset:0"
              onerror="this.style.display='none'">
            <div id="cw-skel-${idx}" style="position:absolute;inset:0;background:linear-gradient(110deg,var(--bg3) 30%,var(--bg4) 50%,var(--bg3) 70%);background-size:300% 100%;animation:sfShim 1.6s ease-in-out infinite"></div>
            <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(8,8,16,.85) 0%,transparent 55%);z-index:1;pointer-events:none"></div>
            <div style="position:absolute;bottom:8px;left:8px;right:8px;font-size:.68rem;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:2">${i.title || '—'}</div>
          </div>
          <div class="continue-prog"><div class="continue-prog-fill" style="width:${pct}%"></div></div>
        </div>`;
      }).join('');

      list.slice(0, 8).forEach(async (i, idx) => {
        let posterUrl = i.poster ? `https://image.tmdb.org/t/p/w300${i.poster}` : null;
        if (!posterUrl && typeof window._fetchPoster === 'function') {
          posterUrl = await window._fetchPoster(i.tmdb, i.type || 'movie');
        }
        const img = document.getElementById(`cw-img-${idx}`);
        const skel = document.getElementById(`cw-skel-${idx}`);
        if (img && posterUrl) {
          img.src = posterUrl;
          img.onload = () => { img.style.display = 'block'; if (skel) skel.style.display = 'none'; };
          img.onerror = () => { if (skel) skel.style.display = 'none'; };
        } else if (skel) {
          skel.style.display = 'none';
        }
      });
    };
    window._renderContinueRow._fxPatched = true;
  }

  /* ── Watch player modal open/close to start/stop tracking ──── */
  function _watchModal() {
    const modal = document.getElementById('playerModal');
    if (!modal) return;
    const obs = new MutationObserver(() => {
      const data = window.currentContent;
      if (modal.classList.contains('active')) {
        if (data?.tmdb) _startTracking(data);
      } else {
        if (data?.tmdb) _stopTracking(data);
      }
    });
    obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  // Save progress if the tab closes while still watching
  window.addEventListener('beforeunload', () => {
    if (activeKey && window.currentContent) _commit(window.currentContent, true);
  });

  /* ── Boot ─────────────────────────────────────────────── */
  function boot() {
    _patchRenderContinueRow();
    _watchModal();
    _refreshContinueRow();

    // Retry patching a couple times in case _getContinue loads slightly later
    setTimeout(_patchRenderContinueRow, 500);
    setTimeout(_refreshContinueRow, 700);

    console.log('%c✅ Flixora Continue Watching — real progress tracking active', 'color:#e63946;font-weight:bold');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
