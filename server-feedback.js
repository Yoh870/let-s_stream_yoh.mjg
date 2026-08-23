/* ═══════════════════════════════════════════════════════════
   FLIXORA — Server Feedback & Recommendation
   ───────────────────────────────────────────────────────────
   Adds 👍/👎 buttons next to each server option. Tracks votes
   in localStorage. Server with the best ratio (min 3 votes)
   gets a "✓ Recommended" badge, auto-updated on every render.
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const STORE_KEY = 'fx_server_feedback';

  function _load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch (_) { return {}; }
  }
  function _save(obj) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch (_) {}
  }

  function _vote(serverName, isGood) {
    const store = _load();
    if (!store[serverName]) store[serverName] = { good: 0, bad: 0 };
    store[serverName][isGood ? 'good' : 'bad']++;
    _save(store);
    _renderFeedbackUI();
    if (typeof window.showToast === 'function') {
      window.showToast(isGood ? 'Thanks for the feedback!' : 'Noted — try another server', isGood ? '👍' : '👎', 1800);
    }
  }
  window._fxVoteServer = _vote;

  function _getBestServer(serverNames) {
    const store = _load();
    let best = null, bestScore = -Infinity;
    serverNames.forEach(name => {
      const v = store[name];
      if (!v) return;
      const total = v.good + v.bad;
      if (total < 3) return; // need minimum sample size
      const score = v.good / total;
      if (score > bestScore) { bestScore = score; best = name; }
    });
    return best;
  }

  function _renderFeedbackUI() {
    const container = document.getElementById('serverButtons');
    if (!container) return;
    if (container.querySelector('.fxsf-row')) return _updateExisting();

    // Build a feedback row under the existing server buttons
    const wrap = document.createElement('div');
    wrap.className = 'fxsf-row';
    wrap.style.cssText = 'width:100%;margin-top:8px;padding-top:10px;border-top:1px solid var(--bd);font-size:.72rem;color:var(--tx3)';
    wrap.innerHTML = `Was this server working for you? <span id="fxsfActiveLabel" style="font-weight:700;color:var(--tx2)"></span>
      <button id="fxsfGood" style="margin-left:8px;padding:3px 10px;border-radius:20px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.25);color:#10b981;cursor:pointer">👍 Works</button>
      <button id="fxsfBad" style="margin-left:6px;padding:3px 10px;border-radius:20px;background:rgba(230,57,70,.12);border:1px solid rgba(230,57,70,.25);color:#e63946;cursor:pointer">👎 Issue</button>`;
    container.parentElement.insertBefore(wrap, container.nextSibling);

    document.getElementById('fxsfGood').addEventListener('click', () => {
      const active = document.querySelector('.server-btn.active');
      if (active) _vote(active.dataset.srvName, true);
    });
    document.getElementById('fxsfBad').addEventListener('click', () => {
      const active = document.querySelector('.server-btn.active');
      if (active) _vote(active.dataset.srvName, false);
    });

    _updateExisting();
  }

  function _updateExisting() {
    const active = document.querySelector('.server-btn.active');
    const label = document.getElementById('fxsfActiveLabel');
    if (active && label) label.textContent = `(${active.dataset.srvName})`;
  }

  // Patch buildServerBtns to add data-srv-name + recommended badge
  function _patchBuildServerBtns() {
    if (typeof window.buildServerBtns !== 'function' || window.buildServerBtns._fxPatched) return;
    const orig = window.buildServerBtns;

    window.buildServerBtns = function (data) {
      orig(data);
      const el = document.getElementById('serverButtons');
      if (!el || typeof window.SERVERS === 'undefined') return;

      const names = window.SERVERS ? window.SERVERS.map(s => s.name) : [];
      const best = _getBestServer(names);

      [...el.querySelectorAll('.server-btn')].forEach((btn, i) => {
        const srv = window.SERVERS[i];
        if (!srv) return;
        btn.dataset.srvName = srv.name;
        if (srv.name === best && !btn.querySelector('.fxsf-rec')) {
          const badge = document.createElement('span');
          badge.className = 'fxsf-rec';
          badge.textContent = '✓ Recommended';
          badge.style.cssText = 'margin-left:5px;font-size:.6rem;font-weight:800;color:#10b981;background:rgba(16,185,129,.14);padding:1px 6px;border-radius:4px';
          btn.appendChild(badge);
        }
      });

      _renderFeedbackUI();
    };
    window.buildServerBtns._fxPatched = true;
  }

  // Also patch setServer so the feedback row updates active label on server switch
  function _patchSetServer() {
    if (typeof window.setServer !== 'function' || window.setServer._fxFeedbackPatched) return;
    const orig = window.setServer;
    window.setServer = function (idx, data) {
      orig(idx, data);
      setTimeout(_updateExisting, 50);
    };
    window.setServer._fxFeedbackPatched = true;
  }

  function boot() {
    // Retry patching since app.js may load slightly before/after this file
    const tryPatch = () => { _patchBuildServerBtns(); _patchSetServer(); };
    tryPatch();
    setTimeout(tryPatch, 300);
    setTimeout(tryPatch, 800);
    console.log('%c✅ Flixora Server Feedback — active', 'color:#e63946;font-weight:bold');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
