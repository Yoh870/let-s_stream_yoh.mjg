/* ═══════════════════════════════════════════════════════════
   FLIXORA — Smart Server Manager v2.0
   ───────────────────────────────────────────────────────────
   ✅ Auto-detects working servers for any content
   ✅ Iframe load failure detection (timeout + error events)
   ✅ Auto-fallback to next available server
   ✅ Per-content server health cache (5-min TTL)
   ✅ Visual status badges on server buttons (✓ / ✗ / ?)
   ✅ "Try All Servers" quick scan button
   ✅ Toast notifications on server switch
   ✅ Respects user's manual server picks
   Drop this AFTER app.js and episode-feature.js in index.html
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────── */
  const LOAD_TIMEOUT     = 12000;   // ms before declaring server "slow/dead"
  const HEALTH_TTL       = 5 * 60 * 1000; // 5 min cache per content+server
  const MAX_AUTO_RETRIES = 2;       // how many servers to auto-try before stopping

  /* ── State ─────────────────────────────────────────────── */
  const SM = {
    currentIdx:    0,
    autoRetries:   0,
    userPicked:    false,   // true if user manually clicked a server btn
    loadTimer:     null,
    scanning:      false,
    scanResults:   {},      // serverIdx → 'ok'|'fail'|'unknown'
  };

  // Health cache: key = `${tmdb}_${type}_${season}_${ep}_${serverIdx}` → { status, ts }
  const _healthCache = new Map();

  function _hKey(data, idx) {
    return `${data.tmdb}_${data.type}_${data.season||1}_${data.episode||1}_${idx}`;
  }
  function _hGet(data, idx) {
    const h = _healthCache.get(_hKey(data, idx));
    if (!h) return null;
    if (Date.now() - h.ts > HEALTH_TTL) { _healthCache.delete(_hKey(data, idx)); return null; }
    return h.status; // 'ok' | 'fail'
  }
  function _hSet(data, idx, status) {
    _healthCache.set(_hKey(data, idx), { status, ts: Date.now() });
  }

  /* ── Inject extra CSS ───────────────────────────────────── */
  function _injectCSS() {
    if (document.getElementById('sm-css')) return;
    const s = document.createElement('style');
    s.id = 'sm-css';
    s.textContent = `
      /* Server button status badges */
      .server-btn { position: relative; }
      .sm-badge {
        position: absolute;
        top: -6px; right: -6px;
        width: 16px; height: 16px;
        border-radius: 50%;
        font-size: .58rem; font-weight: 800;
        display: flex; align-items: center; justify-content: center;
        border: 2px solid var(--bg2, #0e0e18);
        pointer-events: none; z-index: 2;
        transition: all .2s;
      }
      .sm-badge.ok   { background: #10b981; color: #fff; }
      .sm-badge.fail { background: #e63946; color: #fff; }
      .sm-badge.chk  { background: #f5c518; color: #000; animation: smSpin .8s linear infinite; }

      /* Scanning overlay on server buttons area */
      #sm-scan-bar {
        display: none; align-items: center; gap: 10px;
        padding: 8px 12px; border-radius: 8px;
        background: rgba(16,185,129,.1); border: 1px solid rgba(16,185,129,.22);
        margin-bottom: 10px; font-size: .78rem; color: #10b981;
      }
      #sm-scan-bar.on { display: flex; }
      #sm-scan-spinner {
        width: 14px; height: 14px; border: 2px solid rgba(16,185,129,.2);
        border-top-color: #10b981; border-radius: 50%;
        animation: smSpin .8s linear infinite; flex-shrink: 0;
      }
      #sm-scan-text { flex: 1; }
      #sm-scan-stop {
        background: none; border: 1px solid rgba(16,185,129,.35);
        color: #10b981; font-size: .68rem; padding: 2px 8px;
        border-radius: 4px; cursor: pointer; font-family: inherit;
      }

      /* Try-All button */
      #sm-try-all-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 14px; border-radius: var(--r, 10px);
        background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.25);
        color: #10b981; font-size: .78rem; font-weight: 700;
        cursor: pointer; font-family: inherit; transition: all .15s;
        margin-bottom: 10px;
      }
      #sm-try-all-btn:hover { background: rgba(16,185,129,.2); }
      #sm-try-all-btn:disabled { opacity: .45; cursor: not-allowed; }

      /* Unavailable overlay on iframe */
      #sm-unavail {
        position: absolute; inset: 0; z-index: 10;
        background: rgba(8,8,16,.97);
        display: none; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 14px; color: #fff; text-align: center; padding: 24px;
      }
      #sm-unavail.on { display: flex; }
      #sm-unavail h3 { font-size: 1rem; font-weight: 700; margin: 0; }
      #sm-unavail p  { font-size: .82rem; color: #9494b8; max-width: 280px; line-height: 1.55; margin: 0; }
      #sm-unavail-btns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
      .sm-ub {
        padding: 9px 18px; border-radius: 20px; cursor: pointer;
        font-size: .8rem; font-weight: 700; font-family: inherit;
        transition: all .15s;
      }
      .sm-ub.primary { background: #e63946; color: #fff; border: none; }
      .sm-ub.primary:hover { background: #ff5561; }
      .sm-ub.ghost { background: transparent; border: 1px solid rgba(255,255,255,.2); color: #ccc; }
      .sm-ub.ghost:hover { border-color: rgba(255,255,255,.4); color: #fff; }

      @keyframes smSpin { to { transform: rotate(360deg); } }

      /* Pulse animation for currently checking */
      .server-btn.sm-checking { animation: smPulse .9s ease-in-out infinite; }
      @keyframes smPulse { 0%,100%{opacity:1} 50%{opacity:.55} }
    `;
    document.head.appendChild(s);
  }

  /* ── Get playerVideo iframe ──────────────────────────────── */
  function _getIframe() {
    return document.querySelector('#playerVideo iframe');
  }
  function _getPlayerVideo() {
    return document.getElementById('playerVideo');
  }

  /* ── Server buttons helpers ─────────────────────────────── */
  function _getServerBtns() {
    return [...document.querySelectorAll('.server-btn')];
  }
  function _setBadge(idx, status) {
    SM.scanResults[idx] = status;
    const btns = _getServerBtns();
    const btn  = btns[idx];
    if (!btn) return;
    // Remove old badge
    btn.querySelector('.sm-badge')?.remove();
    if (status === 'unknown') return;
    const b = document.createElement('span');
    b.className = 'sm-badge ' + (status === 'ok' ? 'ok' : status === 'checking' ? 'chk' : 'fail');
    b.textContent = status === 'ok' ? '✓' : status === 'checking' ? '↻' : '✗';
    b.title = status === 'ok' ? 'Working' : status === 'checking' ? 'Checking…' : 'Unavailable';
    btn.appendChild(b);
    btn.classList.toggle('sm-checking', status === 'checking');
  }
  function _clearAllBadges() {
    _getServerBtns().forEach(btn => {
      btn.querySelector('.sm-badge')?.remove();
      btn.classList.remove('sm-checking');
    });
    SM.scanResults = {};
  }

  /* ── Unavailable overlay ─────────────────────────────────── */
  function _ensureUnavailOverlay() {
    const pv = _getPlayerVideo(); if (!pv) return;
    if (document.getElementById('sm-unavail')) return;
    const div = document.createElement('div');
    div.id = 'sm-unavail';
    div.innerHTML = `
      <div style="font-size:2.4rem">⚠️</div>
      <h3 id="sm-unavail-title">Server Unavailable</h3>
      <p id="sm-unavail-msg">This server didn't load. Try another server below or let Flixora find one automatically.</p>
      <div id="sm-unavail-btns">
        <button class="sm-ub primary" onclick="SM_autoFindNext()">🔍 Auto Find Working Server</button>
        <button class="sm-ub ghost" onclick="SM_dismissOverlay()">✕ Dismiss</button>
      </div>
    `;
    pv.appendChild(div);
  }

  function _showUnavailOverlay(msg) {
    _ensureUnavailOverlay();
    const el = document.getElementById('sm-unavail'); if (!el) return;
    const m = document.getElementById('sm-unavail-msg');
    if (m && msg) m.textContent = msg;
    el.classList.add('on');
  }
  function _hideUnavailOverlay() {
    document.getElementById('sm-unavail')?.classList.remove('on');
  }

  window.SM_dismissOverlay = function () { _hideUnavailOverlay(); };

  /* ── Scan bar ───────────────────────────────────────────── */
  function _ensureScanBar() {
    if (document.getElementById('sm-scan-bar')) return;
    const serverBtns = document.getElementById('serverButtons'); if (!serverBtns) return;
    const bar = document.createElement('div');
    bar.id = 'sm-scan-bar';
    bar.innerHTML = `
      <div id="sm-scan-spinner"></div>
      <span id="sm-scan-text">Scanning servers…</span>
      <button id="sm-scan-stop" onclick="SM_stopScan()">Stop</button>
    `;
    serverBtns.parentNode.insertBefore(bar, serverBtns);
  }

  function _setScanBar(on, text) {
    _ensureScanBar();
    const bar = document.getElementById('sm-scan-bar'); if (!bar) return;
    bar.classList.toggle('on', on);
    const t = document.getElementById('sm-scan-text');
    if (t && text) t.textContent = text;
  }

  /* ── Try-All button ─────────────────────────────────────── */
  function _ensureTryAllBtn() {
    if (document.getElementById('sm-try-all-btn')) return;
    const serverBtns = document.getElementById('serverButtons'); if (!serverBtns) return;
    const btn = document.createElement('button');
    btn.id = 'sm-try-all-btn';
    btn.innerHTML = '🔍 Find Working Server';
    btn.title = 'Automatically scan all servers and play the first working one';
    btn.onclick = () => SM_autoFindNext(true);
    serverBtns.parentNode.insertBefore(btn, serverBtns);
  }

  /* ── Load timer helpers ─────────────────────────────────── */
  function _startLoadTimer(idx, data) {
    clearTimeout(SM.loadTimer);
    SM.loadTimer = setTimeout(() => {
      // Timed out — mark as fail
      const iframe = _getIframe();
      const btns   = _getServerBtns();
      // Only count as fail if this server is still active
      if (btns[idx]?.classList.contains('active')) {
        console.log(`[SM] Server ${idx + 1} timed out`);
        _hSet(data, idx, 'fail');
        _setBadge(idx, 'fail');
        if (!SM.userPicked && SM.autoRetries < MAX_AUTO_RETRIES) {
          _showUnavailOverlay(`Server ${idx + 1} took too long to load. Trying next server…`);
          setTimeout(() => SM_autoFindNext(), 800);
        } else {
          _showUnavailOverlay(`Server ${idx + 1} didn't load. Click "Find Working Server" to try others.`);
        }
      }
    }, LOAD_TIMEOUT);
  }

  function _clearLoadTimer() {
    clearTimeout(SM.loadTimer);
    SM.loadTimer = null;
  }

  /* ── Patch setServer ─────────────────────────────────────── */
  function _patchSetServer() {
    const origSS = window.setServer;
    if (!origSS || origSS._smPatched) return;

    window.setServer = function (idx, data) {
      SM.currentIdx  = idx;
      SM.autoRetries = SM.userPicked ? 0 : SM.autoRetries; // reset only on user pick
      _clearLoadTimer();
      _hideUnavailOverlay();

      // Call original
      origSS(idx, data);

      // Watch the iframe after a short delay (let original inject it)
      setTimeout(() => _watchIframe(idx, data || window.currentContent), 300);
    };
    window.setServer._smPatched = true;
    window.loadServer = window.setServer;
  }

  /* ── Watch iframe for load/error ─────────────────────────── */
  function _watchIframe(idx, data) {
    const pv = _getPlayerVideo(); if (!pv) return;

    // MutationObserver: wait for iframe to appear
    const obs = new MutationObserver(() => {
      const iframe = pv.querySelector('iframe');
      if (!iframe) return;
      obs.disconnect();
      _attachIframeListeners(iframe, idx, data);
    });

    const iframe = pv.querySelector('iframe');
    if (iframe) {
      _attachIframeListeners(iframe, idx, data);
    } else {
      obs.observe(pv, { childList: true, subtree: true });
      setTimeout(() => obs.disconnect(), 5000);
    }
  }

  let _lastIframe = null;
  function _attachIframeListeners(iframe, idx, data) {
    if (iframe === _lastIframe) return; // already attached
    _lastIframe = iframe;

    _setBadge(idx, 'checking');
    _startLoadTimer(idx, data);

    iframe.addEventListener('load', () => {
      _clearLoadTimer();

      // Try to detect blank/error frames
      let ok = true;
      try {
        // If iframe lands on about:blank or same-origin error page
        const src = iframe.src || '';
        if (!src || src === 'about:blank') ok = false;

        // Cross-origin: we can't read contentDocument, but a successful load
        // of a 3rd-party embed means it at least responded
      } catch (_) { /* cross-origin — assume ok */ }

      if (ok) {
        _hSet(data, idx, 'ok');
        _setBadge(idx, 'ok');
        _hideUnavailOverlay();
        SM.autoRetries = 0;
        SM.scanning    = false;
        _setScanBar(false);
        console.log(`[SM] Server ${idx + 1} loaded OK`);
      } else {
        _iframeFailed(idx, data);
      }
    }, { once: true });

    iframe.addEventListener('error', () => {
      _clearLoadTimer();
      _iframeFailed(idx, data);
    }, { once: true });
  }

  function _iframeFailed(idx, data) {
    console.log(`[SM] Server ${idx + 1} failed`);
    _hSet(data, idx, 'fail');
    _setBadge(idx, 'fail');

    if (!SM.userPicked && SM.autoRetries < MAX_AUTO_RETRIES) {
      _showUnavailOverlay(`Server ${idx + 1} is unavailable. Switching automatically…`);
      SM.autoRetries++;
      setTimeout(() => SM_autoFindNext(), 900);
    } else if (SM.scanning) {
      // During full scan, move to next
      _scanNext(idx + 1, data);
    } else {
      _showUnavailOverlay(`Server ${idx + 1} is unavailable. Click "Find Working Server" to try others.`);
    }
  }

  /* ── Auto-find next working server ──────────────────────── */
  window.SM_autoFindNext = function (fullScan = false) {
    const data = window.currentContent; if (!data) return;
    const btns = _getServerBtns();
    _hideUnavailOverlay();

    if (fullScan) {
      // Full scan from server 0
      SM.scanning    = true;
      SM.userPicked  = false;
      SM.autoRetries = 0;
      _clearAllBadges();
      _setScanBar(true, 'Scanning Server 1…');
      const btn = document.getElementById('sm-try-all-btn');
      if (btn) btn.disabled = true;
      _scanNext(0, data);
    } else {
      // Find next after current
      let next = SM.currentIdx + 1;
      // Check cache first — skip known-bad servers
      while (next < btns.length) {
        const cached = _hGet(data, next);
        if (cached !== 'fail') break;
        next++;
      }
      if (next >= btns.length) {
        // Wrap around or give up
        if (typeof showToast === 'function')
          showToast('All servers tried. Try again or check another title.', '⚠️', 3500, 'warning');
        _showUnavailOverlay('All servers were tried. Please check your internet connection or try a different title.');
        return;
      }
      SM.userPicked = false;
      if (typeof showToast === 'function')
        showToast(`Trying Server ${next + 1}…`, '🔄', 2000);
      window.setServer(next, data);
    }
  };

  window.SM_stopScan = function () {
    SM.scanning = false;
    _clearLoadTimer();
    _setScanBar(false);
    const btn = document.getElementById('sm-try-all-btn');
    if (btn) btn.disabled = false;
    if (typeof showToast === 'function')
      showToast('Scan stopped.', 'ℹ️', 1800);
  };

  /* Internal: scan server at index idx */
  function _scanNext(idx, data) {
    const btns = _getServerBtns();
    if (!SM.scanning || idx >= btns.length) {
      // Scan complete
      SM.scanning = false;
      _setScanBar(false);
      const btn = document.getElementById('sm-try-all-btn');
      if (btn) btn.disabled = false;

      // Did we find any ok?
      const firstOk = Object.entries(SM.scanResults).find(([, v]) => v === 'ok');
      if (!firstOk) {
        if (typeof showToast === 'function')
          showToast('No working server found for this title.', '❌', 4000, 'error');
        _showUnavailOverlay('No server could load this title. It may not be available in your region.');
      }
      return;
    }

    // Check cache
    const cached = _hGet(data, idx);
    if (cached === 'ok') {
      // Already known good — use it immediately
      SM.scanning = false;
      _setScanBar(false);
      const btn = document.getElementById('sm-try-all-btn');
      if (btn) btn.disabled = false;
      _setBadge(idx, 'ok');
      SM.userPicked = false;
      window.setServer(idx, data);
      if (typeof showToast === 'function')
        showToast(`Server ${idx + 1} is working! ▶`, '✅', 2500, 'success');
      return;
    }
    if (cached === 'fail') {
      _setBadge(idx, 'fail');
      _scanNext(idx + 1, data);
      return;
    }

    // Try this server
    _setScanBar(true, `Scanning Server ${idx + 1} of ${btns.length}…`);
    SM.currentIdx = idx;
    SM.userPicked = false;

    const origSS = window.setServer;
    // Use a probe approach: load in current player, wait for result
    origSS(idx, data);
    _setBadge(idx, 'checking');

    // Attach a one-shot watcher
    const pv = _getPlayerVideo(); if (!pv) { _scanNext(idx + 1, data); return; }

    const probeTimeout = setTimeout(() => {
      if (!SM.scanning) return;
      _hSet(data, idx, 'fail');
      _setBadge(idx, 'fail');
      _scanNext(idx + 1, data);
    }, LOAD_TIMEOUT);

    const probeObs = new MutationObserver(() => {
      const iframe = pv.querySelector('iframe');
      if (!iframe) return;
      probeObs.disconnect();

      const onLoad = () => {
        clearTimeout(probeTimeout);
        if (!SM.scanning) return;
        _hSet(data, idx, 'ok');
        _setBadge(idx, 'ok');
        SM.scanning = false;
        _setScanBar(false);
        const btn = document.getElementById('sm-try-all-btn');
        if (btn) btn.disabled = false;
        _hideUnavailOverlay();
        if (typeof showToast === 'function')
          showToast(`Server ${idx + 1} is working! ▶`, '✅', 2800, 'success');
      };

      const onError = () => {
        clearTimeout(probeTimeout);
        if (!SM.scanning) return;
        _hSet(data, idx, 'fail');
        _setBadge(idx, 'fail');
        _scanNext(idx + 1, data);
      };

      iframe.addEventListener('load', onLoad, { once: true });
      iframe.addEventListener('error', onError, { once: true });
    });

    const existingIframe = pv.querySelector('iframe');
    if (existingIframe) {
      probeObs.disconnect();
      const onLoad = () => {
        clearTimeout(probeTimeout);
        if (!SM.scanning) return;
        _hSet(data, idx, 'ok');
        _setBadge(idx, 'ok');
        SM.scanning = false;
        _setScanBar(false);
        const btn = document.getElementById('sm-try-all-btn');
        if (btn) btn.disabled = false;
        _hideUnavailOverlay();
        if (typeof showToast === 'function')
          showToast(`Server ${idx + 1} is working! ▶`, '✅', 2800, 'success');
      };
      const onError = () => {
        clearTimeout(probeTimeout);
        if (!SM.scanning) return;
        _hSet(data, idx, 'fail');
        _setBadge(idx, 'fail');
        _scanNext(idx + 1, data);
      };
      existingIframe.addEventListener('load', onLoad, { once: true });
      existingIframe.addEventListener('error', onError, { once: true });
    } else {
      probeObs.observe(pv, { childList: true, subtree: true });
      setTimeout(() => probeObs.disconnect(), LOAD_TIMEOUT + 500);
    }
  }

  /* ── Mark user picks ─────────────────────────────────────── */
  function _interceptServerBtnClicks() {
    // Delegate on serverButtons container
    const container = document.getElementById('serverButtons');
    if (!container || container._smDelegated) return;
    container._smDelegated = true;
    container.addEventListener('click', e => {
      if (e.target.closest('.server-btn')) {
        SM.userPicked  = true;
        SM.autoRetries = 0;
        SM.scanning    = false;
        _setScanBar(false);
        _hideUnavailOverlay();
      }
    }, true);
  }

  /* ── Patch playById to reset SM state on new content ─────── */
  function _patchPlayById() {
    const origPlay = window.playById;
    if (!origPlay || origPlay._smPatched) return;
    window.playById = async function (...args) {
      SM.currentIdx  = 0;
      SM.autoRetries = 0;
      SM.userPicked  = false;
      SM.scanning    = false;
      _clearLoadTimer();
      _clearAllBadges();
      _hideUnavailOverlay();
      _setScanBar(false);
      await origPlay(...args);
      // Inject Try-All button and intercept clicks after rebuild
      setTimeout(() => {
        _ensureTryAllBtn();
        _interceptServerBtnClicks();
      }, 600);
    };
    window.playById._smPatched = true;
    window.playContentById = window.playById;
  }

  /* ── Also handle server buttons rebuilt by buildServerBtns ── */
  const origBuildSB = window.buildServerBtns;
  if (typeof origBuildSB === 'function') {
    window.buildServerBtns = function (...args) {
      origBuildSB(...args);
      setTimeout(() => {
        _ensureTryAllBtn();
        _interceptServerBtnClicks();
        // Re-apply cached badges for current content
        const data = args[0] || window.currentContent;
        if (data) {
          _getServerBtns().forEach((_, idx) => {
            const cached = _hGet(data, idx);
            if (cached) _setBadge(idx, cached);
          });
        }
      }, 100);
    };
  }

  /* ── BOOT ──────────────────────────────────────────────── */
  function boot() {
    _injectCSS();
    _patchSetServer();
    _patchPlayById();
    _ensureUnavailOverlay();

    // Patch after episode-feature.js may have re-wrapped playById
    setTimeout(() => {
      _patchSetServer();
      _patchPlayById();
    }, 500);
    setTimeout(() => {
      _patchSetServer();
      _patchPlayById();
    }, 1500);

    console.log('%c✅ Flixora Server Manager v2.0 — smart auto-fallback active', 'color:#10b981;font-weight:bold');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Expose for debugging
  window._SM = SM;
  window._smHealthCache = _healthCache;

})();
