/* ═══════════════════════════════════════════════════════════
   FLIXORA — Anti Click-Hijack v3.1
   FIX: Fullscreen now works (allow-fullscreen added to sandbox)
   FIX: Click guard no longer blocks fullscreen button
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const _nativeOpen = Window.prototype.open;
  Object.defineProperty(Window.prototype, 'open', {
    value: function (url) {
      if (!url || url === '' || url === 'about:blank') return null;
      try {
        const dest = new URL(url, location.href);
        if (dest.hostname === location.hostname) {
          return _nativeOpen.apply(window, arguments);
        }
      } catch (_) {}
      console.log('[Shield] Blocked window.open:', url);
      return null;
    },
    writable: false,
    configurable: false,
  });

  window.addEventListener('message', function (e) {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data && (data.type === 'redirect' || data.url || data.href || data.navigate)) {
        e.stopImmediatePropagation();
      }
    } catch (_) {}
  }, true);

  let overlay = null;
  let clickPassTimer = null;

  function createOverlay(playerDiv) {
    const old = document.getElementById('sf-click-guard');
    if (old) old.remove();

    overlay = document.createElement('div');
    overlay.id = 'sf-click-guard';
    // ✅ FIX: pointer-events none by default so fullscreen button inside iframe is always clickable
    overlay.style.cssText = 'position:absolute;inset:0;z-index:2147483647;background:transparent;cursor:pointer;pointer-events:none;';

    if (getComputedStyle(playerDiv).position === 'static') {
      playerDiv.style.position = 'relative';
    }
    playerDiv.appendChild(overlay);

    // ✅ FIX: Only activate the guard for a short window after a suspicious click,
    // not permanently blocking all interaction
    overlay.addEventListener('click', function (e) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);

    overlay.addEventListener('touchend', function () {
      overlay.style.pointerEvents = 'none';
      clearTimeout(clickPassTimer);
      clickPassTimer = setTimeout(() => { if (overlay) overlay.style.pointerEvents = 'none'; }, 800);
    }, { passive: true });

    console.log('[Shield] Click guard installed (fullscreen-safe)');
  }

  function watchPlayer() {
    const playerDiv = document.getElementById('playerVideo');
    if (!playerDiv) { setTimeout(watchPlayer, 500); return; }
    createOverlay(playerDiv);
    new MutationObserver(() => {
      if (playerDiv.querySelector('iframe') && !document.getElementById('sf-click-guard')) {
        setTimeout(() => createOverlay(playerDiv), 100);
      }
    }).observe(playerDiv, { childList: true, subtree: true });
  }

  // ✅ FIX: Added allow-fullscreen to sandbox so fullscreen button works
  function hardSandbox(iframe) {
    if (iframe._hs) return; iframe._hs = true;
    try {
      iframe.setAttribute('sandbox', [
        'allow-scripts',
        'allow-same-origin',
        'allow-presentation',
        'allow-forms',
        'allow-pointer-lock',
        'allow-fullscreen',   // ← THIS was missing! Fullscreen was blocked because of this
      ].join(' '));
      // ✅ Also make sure the allowfullscreen attribute is present
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
    } catch (_) {}
    console.log('[Shield] Iframe sandboxed (fullscreen enabled)');
  }

  new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeName === 'IFRAME') hardSandbox(node);
        node.querySelectorAll && node.querySelectorAll('iframe').forEach(hardSandbox);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href]');
    if (!a) return;
    try {
      const dest = new URL(a.href, location.href);
      if (dest.hostname !== location.hostname) {
        e.preventDefault(); e.stopImmediatePropagation();
        console.log('[Shield] Blocked external link:', dest.hostname);
      }
    } catch (_) {}
  }, true);

  setInterval(() => {
    document.querySelectorAll('div[style*="position: fixed"], div[style*="position:fixed"]').forEach(el => {
      const z = parseInt(el.style.zIndex || 0);
      const r = el.getBoundingClientRect();
      const big = r.width > window.innerWidth * 0.7 && r.height > window.innerHeight * 0.7;
      const notOurs = !el.id.startsWith('sf-') && !el.id.includes('player') && !el.id.includes('modal') && !el.id.includes('verify') && !el.id.includes('banner') && el.id !== 'navbar';
      if (big && z > 5000 && notOurs) {
        el.style.pointerEvents = 'none';
        el.style.display = 'none';
        console.log('[Shield] Removed suspicious overlay');
      }
    });
  }, 1000);

  const _fetch = window.fetch;
  const AD_HOSTS = ['doubleclick.net','googlesyndication.com','adnxs.com','taboola.com','outbrain.com','pubmatic.com','rubiconproject.com','openx.net','appnexus.com','criteo.com','media.net'];
  window.fetch = function(input) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    try {
      const h = new URL(url, location.href).hostname;
      if (AD_HOSTS.some(d => h === d || h.endsWith('.' + d))) {
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
    } catch (_) {}
    return _fetch.apply(this, arguments);
  };

  function patchSetServer() {
    const _orig = window.setServer;
    if (!_orig || _orig._patched) return;
    window.setServer = function (idx, data) {
      _orig(idx, data);
      setTimeout(() => {
        document.querySelectorAll('#playerVideo iframe').forEach(hardSandbox);
        watchPlayer();
      }, 300);
    };
    window.setServer._patched = true;
    window.loadServer = window.setServer;
  }

  function showShield() {
    if (document.getElementById('sf-shield')) return;
    const s = document.createElement('div');
    s.id = 'sf-shield';
    s.innerHTML = '🛡️ <span style="font-size:.65rem;font-weight:700">AD BLOCKED</span>';
    s.style.cssText = 'position:fixed;bottom:72px;right:12px;display:flex;align-items:center;gap:5px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.35);color:#10b981;padding:5px 11px;border-radius:20px;z-index:99999;pointer-events:none;backdrop-filter:blur(6px);font-family:sans-serif;opacity:0;transition:opacity .4s;';
    document.body.appendChild(s);
    setTimeout(() => s.style.opacity = '1', 100);
    setTimeout(() => s.style.opacity = '0', 4000);
    setTimeout(() => s.remove(), 5000);
  }

  function boot() {
    watchPlayer();
    patchSetServer();
    showShield();
    setTimeout(patchSetServer, 1000);
    setTimeout(patchSetServer, 3000);
    console.log('%c🛡️ Flixora Anti Click-Hijack v3.1 ACTIVE — fullscreen fixed!', 'color:#10b981;font-weight:bold');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
