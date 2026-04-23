/* ═══════════════════════════════════════════════════════════════════
   FLIXORA — fullscreen-fix.js  v2.0
   ─────────────────────────────────────────────────────────────────
   Drop this LAST in index.html (after all other scripts):
     <script src="fullscreen-fix.js"></script>

   ROOT CAUSE FIX:
     The video was NOT filling the screen because there were no
     :fullscreen CSS rules — #playerVideo kept its padding-top:56.25%
     and .p-box kept its max-width:920px even in fullscreen mode.

   ALL FIXES:
     ✅ :fullscreen CSS rules — video now fills the entire screen
     ✅ Conflicting F-key in index.html — neutralized via capture
     ✅ Sandbox iframe attributes — always includes allow-fullscreen
     ✅ Native fullscreen targets playerVideo directly (best approach)
     ✅ Manual CSS fallback for iOS Safari
     ✅ Double-tap on video = fullscreen on mobile
     ✅ Button icon syncs correctly on enter/exit
═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     STEP 1 — :fullscreen CSS  (THIS was the root cause)
     Without these rules, the browser enters fullscreen but the
     #playerVideo still has padding-top:56.25% and max-width:920px
     so the video appears small / background disappears only.
  ───────────────────────────────────────────────────────────── */
  function _injectCSS() {
    if (document.getElementById('fx-fs-css')) return;
    const s = document.createElement('style');
    s.id = 'fx-fs-css';
    s.textContent = `

      /* ── playerVideo as fullscreen root ─────────────── */
      #playerVideo:-webkit-full-screen,
      #playerVideo:fullscreen {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        padding-top: 0 !important;
        max-width: none !important;
        max-height: none !important;
        z-index: 99999 !important;
        background: #000 !important;
      }
      #playerVideo:-webkit-full-screen iframe,
      #playerVideo:fullscreen iframe {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }

      /* ── playerModal as fullscreen root ─────────────── */
      #playerModal:-webkit-full-screen,
      #playerModal:fullscreen {
        padding: 0 !important;
        background: #000 !important;
        align-items: stretch !important;
        justify-content: stretch !important;
      }
      #playerModal:-webkit-full-screen .p-box,
      #playerModal:fullscreen .p-box {
        max-width: 100vw !important;
        max-height: 100vh !important;
        width: 100vw !important;
        height: 100vh !important;
        border-radius: 0 !important;
        overflow: hidden !important;
        transform: none !important;
      }
      #playerModal:-webkit-full-screen #playerVideo,
      #playerModal:fullscreen #playerVideo {
        padding-top: 0 !important;
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
      #playerModal:-webkit-full-screen #playerVideo iframe,
      #playerModal:fullscreen #playerVideo iframe {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }

      /* ── .p-box as fullscreen root ───────────────────── */
      .p-box:-webkit-full-screen,
      .p-box:fullscreen {
        max-width: 100vw !important;
        max-height: 100vh !important;
        width: 100vw !important;
        height: 100vh !important;
        border-radius: 0 !important;
        overflow: hidden !important;
      }
      .p-box:-webkit-full-screen #playerVideo,
      .p-box:fullscreen #playerVideo {
        padding-top: 0 !important;
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
      .p-box:-webkit-full-screen #playerVideo iframe,
      .p-box:fullscreen #playerVideo iframe {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }

      /* ── Hide the old broken fullscreen button ───────── */
      #wt-max-btn { display: none !important; }

      /* ── Our FS button hover reveal ──────────────────── */
      #fx-fs-btn {
        opacity: 0;
        transition: opacity .25s, background .15s !important;
      }
      #playerVideo:hover #fx-fs-btn,
      #fx-fs-btn:hover,
      #fx-fs-btn:focus {
        opacity: 1 !important;
      }

      /* ── Manual CSS fullscreen (iOS Safari fallback) ─── */
      .fx-manual-fs {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        border-radius: 0 !important;
        z-index: 99999 !important;
        background: #000 !important;
        overflow: hidden !important;
        padding: 0 !important;
        transform: none !important;
      }
      .fx-manual-fs #playerVideo {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        padding-top: 0 !important;
      }
      .fx-manual-fs #playerVideo iframe {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
    `;
    document.head.appendChild(s);
  }

  /* ─────────────────────────────────────────────────────────────
     STEP 2 — Fix iframe sandbox
     adblock.js sets sandbox but sometimes the _hs flag prevents
     re-running. We force it here as final authority.
  ───────────────────────────────────────────────────────────── */
  const SANDBOX = [
    'allow-scripts', 'allow-same-origin', 'allow-presentation',
    'allow-forms', 'allow-pointer-lock', 'allow-fullscreen', 'allow-popups',
  ].join(' ');

  const ALLOW = 'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer';

  function _fixIframe(iframe) {
    if (!iframe) return;
    // Force-reset even if adblock.js already tagged it
    delete iframe._hs;
    delete iframe._fxFixed;
    try {
      iframe.setAttribute('sandbox', SANDBOX);
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('webkitallowfullscreen', '');
      iframe.setAttribute('mozallowfullscreen', '');
      iframe.setAttribute('allow', ALLOW);
      iframe._fxFixed = true;
    } catch (_) {}
  }

  document.querySelectorAll('iframe').forEach(_fixIframe);

  new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeName === 'IFRAME') setTimeout(() => _fixIframe(n), 50);
      n.querySelectorAll?.('iframe').forEach(f => setTimeout(() => _fixIframe(f), 50));
    }));
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* ─────────────────────────────────────────────────────────────
     STEP 3 — Fullscreen engine
     Best target = #playerVideo (direct), then fallbacks.
  ───────────────────────────────────────────────────────────── */
  let _manualTarget = null;

  function _isNativeFS() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement ||
              document.mozFullScreenElement || document.msFullscreenElement);
  }

  function _req(el) {
    const fn = el.requestFullscreen || el.webkitRequestFullscreen ||
               el.mozRequestFullScreen || el.msRequestFullscreen;
    return fn ? fn.call(el) : Promise.reject('no api');
  }

  function _exit() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen ||
               document.mozCancelFullScreen || document.msExitFullscreen;
    if (fn) fn.call(document);
  }

  function _manualEnter() {
    const target = document.querySelector('.p-box') ||
                   document.getElementById('playerVideo');
    if (!target || _manualTarget) return;
    _manualTarget = target;
    target.classList.add('fx-manual-fs');
    document.body.style.overflow = 'hidden';
    _updateBtn(true);
  }

  function _manualExit() {
    if (!_manualTarget) return;
    _manualTarget.classList.remove('fx-manual-fs');
    document.body.style.overflow = '';
    _manualTarget = null;
    _updateBtn(false);
  }

  async function toggleFullscreen() {
    if (_isNativeFS()) { _exit(); return; }
    if (_manualTarget) { _manualExit(); return; }

    const pvideo = document.getElementById('playerVideo');
    const pbox   = document.querySelector('.p-box');
    const modal  = document.getElementById('playerModal');
    const iframe = document.querySelector('#playerVideo iframe');

    // Try each candidate — stop at first success
    for (const el of [pvideo, pbox, modal, iframe].filter(Boolean)) {
      try { await _req(el); return; } catch (_) {}
    }
    // All failed → iOS CSS fallback
    _manualEnter();
  }

  window.toggleFullscreen = toggleFullscreen;

  /* ─────────────────────────────────────────────────────────────
     STEP 4 — Fullscreen button
  ───────────────────────────────────────────────────────────── */
  function _injectBtn() {
    document.querySelectorAll('#wt-max-btn').forEach(b => b.remove());
    const pv = document.getElementById('playerVideo');
    if (!pv || document.getElementById('fx-fs-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'fx-fs-btn';
    btn.title = 'Fullscreen (F)';
    btn.setAttribute('aria-label', 'Toggle fullscreen');
    btn.innerHTML = _icon(false);
    btn.style.cssText = [
      'position:absolute', 'bottom:12px', 'right:12px', 'z-index:50',
      'width:40px', 'height:40px', 'border-radius:8px',
      'background:rgba(0,0,0,.85)', 'border:1px solid rgba(255,255,255,.25)',
      'color:#fff', 'cursor:pointer', 'display:flex',
      'align-items:center', 'justify-content:center',
      'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
    ].join(';');

    btn.onmouseenter = () => btn.style.background = 'rgba(230,57,70,.9)';
    btn.onmouseleave = () => btn.style.background = 'rgba(0,0,0,.85)';
    btn.onclick = e => { e.stopPropagation(); toggleFullscreen(); };

    pv.style.position = 'relative';
    pv.appendChild(btn);
  }

  function _icon(on) {
    return on
      ? `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`
      : `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
  }

  function _updateBtn(on) {
    const btn = document.getElementById('fx-fs-btn');
    if (btn) btn.innerHTML = _icon(on);
  }

  ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange']
    .forEach(ev => document.addEventListener(ev, () => _updateBtn(_isNativeFS())));

  /* ─────────────────────────────────────────────────────────────
     STEP 5 — Neutralize CONFLICTING F-key in index.html
     The inline script also handles F key but calls pv.requestFullscreen()
     directly without any CSS fix. We intercept it at capture phase.
  ───────────────────────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    const modal = document.getElementById('playerModal');
    if (!modal?.classList.contains('active')) return;
    if (e.target.matches('input, textarea, select')) return;

    if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      e.stopImmediatePropagation(); // blocks the old handler
      toggleFullscreen();
    }
    if (e.key === 'Escape' && _manualTarget) {
      _manualExit();
    }
  }, true); // capture = true → runs before all bubble handlers

  /* ─────────────────────────────────────────────────────────────
     STEP 6 — Double-tap on video = fullscreen (mobile UX)
  ───────────────────────────────────────────────────────────── */
  let _lastTap = 0;
  function _initDoubleTap() {
    const pv = document.getElementById('playerVideo');
    if (!pv) return;
    pv.addEventListener('touchend', e => {
      const now = Date.now();
      if (now - _lastTap < 300) { e.preventDefault(); toggleFullscreen(); }
      _lastTap = now;
    }, { passive: false });
  }

  /* ─────────────────────────────────────────────────────────────
     STEP 7 — Patch setServer & playById to re-fix iframes & button
  ───────────────────────────────────────────────────────────── */
  function _patchAll() {
    // setServer
    const origSS = window.setServer;
    if (origSS && !origSS._fsFix2) {
      window.setServer = function (...args) {
        origSS(...args);
        setTimeout(() => {
          document.querySelectorAll('#playerVideo iframe').forEach(_fixIframe);
          document.querySelectorAll('#wt-max-btn').forEach(b => b.remove());
          if (!document.getElementById('fx-fs-btn')) _injectBtn();
        }, 400);
      };
      window.setServer._fsFix2 = true;
      window.loadServer = window.setServer;
    }

    // playById
    const origPlay = window.playById;
    if (origPlay && !origPlay._fsFix2) {
      window.playById = async function (...args) {
        await origPlay(...args);
        setTimeout(() => {
          document.querySelectorAll('#playerVideo iframe').forEach(_fixIframe);
          document.querySelectorAll('#wt-max-btn').forEach(b => b.remove());
          _injectBtn();
        }, 400);
        setTimeout(() => {
          document.querySelectorAll('#playerVideo iframe').forEach(_fixIframe);
        }, 1200);
      };
      window.playById._fsFix2 = true;
      window.playContentById = window.playById;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     BOOT
  ───────────────────────────────────────────────────────────── */
  function _boot() {
    _injectCSS();
    _initDoubleTap();
    _patchAll();

    // Watch modal open
    const modal = document.getElementById('playerModal');
    if (modal) {
      new MutationObserver(() => {
        if (modal.classList.contains('active')) {
          setTimeout(() => {
            document.querySelectorAll('#wt-max-btn').forEach(b => b.remove());
            _injectBtn();
          }, 300);
        }
      }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    // Inject now if already open
    if (modal?.classList.contains('active')) _injectBtn();

    // Re-patch late-loading scripts
    [500, 1500, 3000].forEach(ms => setTimeout(_patchAll, ms));

    console.log('%c✅ Flixora Fullscreen Fix v2.0', 'color:#10b981;font-weight:bold;font-size:12px');
    console.log('%c  ✅ :fullscreen CSS fixed  ✅ F-key conflict resolved  ✅ iOS fallback  ✅ Double-tap', 'color:#6ec6ff;font-size:.82em');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

})();
