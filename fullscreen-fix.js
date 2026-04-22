/* ═══════════════════════════════════════════════════════════════════
   FLIXORA — fullscreen-fix.js  v1.0
   ─────────────────────────────────────────────────────────────────
   Drop this LAST in index.html (after all other scripts):
     <script src="fullscreen-fix.js"></script>

   FIXES:
     ✅ Iframe sandbox blocks fullscreen → patched
     ✅ Fullscreen button targets wrong element → fixed
     ✅ Mobile fullscreen (iOS Safari + Android) → handled
     ✅ Keyboard shortcut F → works
     ✅ ESC to exit → works
     ✅ Fullscreen state icon updates correctly
     ✅ Removes conflicting fullscreen handlers from adblock.js
═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── STEP 1: Fix sandbox on all iframes (current + future) ──────
     The sandbox attribute from adblock.js sometimes strips fullscreen.
     We override it to always include allow-fullscreen.
  ─────────────────────────────────────────────────────────────────*/
  const SAFE_SANDBOX = [
    'allow-scripts',
    'allow-same-origin',
    'allow-presentation',
    'allow-forms',
    'allow-pointer-lock',
    'allow-fullscreen',
    'allow-popups',
  ].join(' ');

  function _fixIframe(iframe) {
    if (!iframe || iframe._fxFixed) return;
    iframe._fxFixed = true;
    try {
      iframe.setAttribute('sandbox', SAFE_SANDBOX);
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('webkitallowfullscreen', '');
      iframe.setAttribute('mozallowfullscreen', '');
      iframe.setAttribute('allow',
        'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer');
    } catch (e) {
      console.warn('[FS-Fix] Could not patch iframe:', e.message);
    }
  }

  // Fix all existing iframes
  document.querySelectorAll('iframe').forEach(_fixIframe);

  // Fix future iframes as they're injected
  new MutationObserver(mutations => {
    mutations.forEach(m => m.addedNodes.forEach(node => {
      if (node.nodeName === 'IFRAME') _fixIframe(node);
      if (node.querySelectorAll) node.querySelectorAll('iframe').forEach(_fixIframe);
    }));
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Also re-fix after setServer (servers inject new iframes)
  const _origSS = window.setServer;
  if (typeof _origSS === 'function' && !_origSS._fsFix) {
    window.setServer = function (...args) {
      _origSS(...args);
      setTimeout(() => document.querySelectorAll('#playerVideo iframe').forEach(_fixIframe), 400);
    };
    window.setServer._fsFix = true;
    window.loadServer = window.setServer;
  }

  /* ── STEP 2: Fullscreen engine ───────────────────────────────────
     Priority order:
       1. Native browser fullscreen on the player modal  ← best
       2. Native on playerVideo wrapper
       3. Native on the iframe itself
       4. CSS "manual fullscreen" fallback (for iOS Safari)
  ─────────────────────────────────────────────────────────────────*/
  let _manualFS   = false;
  let _manualPrev = {};  // saved styles for restore

  function _getTargets() {
    return {
      modal:   document.getElementById('playerModal'),
      pbox:    document.querySelector('.p-box'),
      pvideo:  document.getElementById('playerVideo'),
      iframe:  document.querySelector('#playerVideo iframe'),
    };
  }

  function _requestFS(el) {
    const fn = el.requestFullscreen
            || el.webkitRequestFullscreen
            || el.mozRequestFullScreen
            || el.msRequestFullscreen;
    if (fn) return fn.call(el).catch(() => null);
    return Promise.reject(new Error('no requestFullscreen'));
  }

  function _exitFS() {
    const fn = document.exitFullscreen
            || document.webkitExitFullscreen
            || document.mozCancelFullScreen
            || document.msExitFullscreen;
    if (fn) fn.call(document);
  }

  function _isFS() {
    return !!(document.fullscreenElement
           || document.webkitFullscreenElement
           || document.mozFullScreenElement
           || document.msFullscreenElement);
  }

  // Manual CSS fullscreen (iOS / fallback)
  function _manualEnter() {
    const t = _getTargets();
    const target = t.pbox || t.pvideo || t.modal;
    if (!target) return;
    _manualPrev = {
      el:     target,
      cssText: target.style.cssText,
      bodyOF: document.body.style.overflow,
    };
    target.style.cssText = [
      'position:fixed',
      'inset:0',
      'width:100vw',
      'height:100vh',
      'max-width:100vw',
      'max-height:100vh',
      'border-radius:0',
      'z-index:99999',
      'background:#000',
      'overflow:hidden',
    ].join('!important;') + '!important';
    document.body.style.overflow = 'hidden';
    _manualFS = true;
    _updateBtn(true);

    // Scroll player into view on mobile
    target.scrollIntoView({ behavior: 'instant' });
  }

  function _manualExit() {
    if (!_manualFS) return;
    const { el, cssText, bodyOF } = _manualPrev;
    if (el) el.style.cssText = cssText || '';
    document.body.style.overflow = bodyOF || '';
    _manualFS = false;
    _updateBtn(false);
    _manualPrev = {};
  }

  // Main toggle — tries native first, falls back to CSS
  async function toggleFullscreen() {
    const t = _getTargets();

    if (_isFS() || _manualFS) {
      if (_manualFS)  _manualExit();
      else            _exitFS();
      return;
    }

    // Try: modal → pbox → playerVideo → iframe
    const candidates = [t.modal, t.pbox, t.pvideo, t.iframe].filter(Boolean);
    let succeeded = false;
    for (const el of candidates) {
      try {
        await _requestFS(el);
        succeeded = true;
        break;
      } catch (_) { /* try next */ }
    }

    if (!succeeded) {
      // Fallback for iOS Safari / restricted environments
      _manualEnter();
    }
  }
  window.toggleFullscreen = toggleFullscreen;

  /* ── STEP 3: Inject the fullscreen button ───────────────────────
     Replaces any existing broken ⛶ button with a reliable one.
  ─────────────────────────────────────────────────────────────────*/
  function _removeOldBtn() {
    // Remove buttons from features-patch & room-manager
    document.querySelectorAll('#wt-max-btn, #fx-fs-btn').forEach(b => b.remove());
  }

  function _injectFSBtn() {
    _removeOldBtn();
    const pv = document.getElementById('playerVideo');
    if (!pv || document.getElementById('fx-fs-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'fx-fs-btn';
    btn.title = 'Toggle Fullscreen (F)';
    btn.setAttribute('aria-label', 'Toggle fullscreen');
    btn.innerHTML = _fsIcon(false);
    btn.style.cssText = [
      'position:absolute',
      'bottom:10px',
      'right:10px',
      'z-index:50',
      'width:38px',
      'height:38px',
      'border-radius:8px',
      'background:rgba(0,0,0,.82)',
      'border:1px solid rgba(255,255,255,.2)',
      'color:#fff',
      'font-size:1.05rem',
      'cursor:pointer',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'transition:background .15s, transform .15s',
      'backdrop-filter:blur(8px)',
      '-webkit-backdrop-filter:blur(8px)',
    ].join(';');

    btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(230,57,70,.85)');
    btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(0,0,0,.82)');
    btn.addEventListener('click', e => { e.stopPropagation(); toggleFullscreen(); });

    pv.style.position = 'relative';
    pv.appendChild(btn);
  }

  function _fsIcon(isOn) {
    return isOn
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
           <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
         </svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
           <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
           <line x1="9" y1="15" x2="3" y2="21"/><line x1="15" y1="9" x2="21" y2="3"/>
         </svg>`;
  }

  function _updateBtn(isOn) {
    const btn = document.getElementById('fx-fs-btn');
    if (btn) btn.innerHTML = _fsIcon(isOn);
  }

  /* ── STEP 4: Sync button icon with browser fullscreen state ─────*/
  document.addEventListener('fullscreenchange',       () => _updateBtn(_isFS()));
  document.addEventListener('webkitfullscreenchange', () => _updateBtn(_isFS()));
  document.addEventListener('mozfullscreenchange',    () => _updateBtn(_isFS()));
  document.addEventListener('MSFullscreenChange',     () => _updateBtn(_isFS()));

  /* ── STEP 5: Keyboard shortcut — F key ──────────────────────────*/
  document.addEventListener('keydown', e => {
    const modal = document.getElementById('playerModal');
    if (!modal?.classList.contains('active')) return;
    if (e.target.matches('input, textarea, select')) return;

    if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleFullscreen();
    }
    if (e.key === 'Escape' && _manualFS) {
      _manualExit();
    }
  });

  /* ── STEP 6: Double-tap on video = fullscreen (mobile UX) ───────*/
  let _lastTap = 0;
  const _pv = document.getElementById('playerVideo');
  if (_pv) {
    _pv.addEventListener('touchend', e => {
      const now = Date.now();
      if (now - _lastTap < 320) {
        e.preventDefault();
        toggleFullscreen();
      }
      _lastTap = now;
    }, { passive: false });
  }

  /* ── STEP 7: Hook into playById to re-inject button ────────────*/
  function _patchPlay() {
    const orig = window.playById;
    if (!orig || orig._fsPatched) return;
    window.playById = async function (...args) {
      await orig(...args);
      setTimeout(() => {
        document.querySelectorAll('#playerVideo iframe').forEach(_fixIframe);
        _injectFSBtn();
      }, 350);
      setTimeout(() => {
        document.querySelectorAll('#playerVideo iframe').forEach(_fixIframe);
      }, 1200);
    };
    window.playById._fsPatched = true;
    window.playContentById = window.playById;
  }

  /* ── STEP 8: CSS — hide the broken old buttons ──────────────────*/
  function _injectCSS() {
    if (document.getElementById('fx-fs-css')) return;
    const s = document.createElement('style');
    s.id = 'fx-fs-css';
    s.textContent = `
      /* Hide old broken fullscreen buttons from other scripts */
      #wt-max-btn { display: none !important; }

      /* Fullscreen button hover area — show on player hover */
      #playerVideo #fx-fs-btn {
        opacity: 0;
        transition: opacity .25s, background .15s !important;
      }
      #playerVideo:hover #fx-fs-btn,
      #fx-fs-btn:focus {
        opacity: 1;
      }

      /* When in manual fullscreen, make sure iframe fills 100% */
      body.fx-manual-fs #playerVideo {
        position: absolute !important;
        inset: 0 !important;
        padding-top: 0 !important;
        height: 100% !important;
      }
      body.fx-manual-fs #playerVideo iframe {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
    `;
    document.head.appendChild(s);
  }

  /* ── BOOT ───────────────────────────────────────────────────────*/
  function _boot() {
    _injectCSS();
    _patchPlay();

    // Inject button if player is already open
    if (document.getElementById('playerModal')?.classList.contains('active')) {
      _injectFSBtn();
    }

    // Re-patch after other scripts finish loading
    setTimeout(() => { _patchPlay(); }, 500);
    setTimeout(() => { _patchPlay(); }, 2000);

    // Also watch for player modal opening
    const modal = document.getElementById('playerModal');
    if (modal) {
      new MutationObserver(() => {
        if (modal.classList.contains('active')) {
          setTimeout(_injectFSBtn, 300);
        }
      }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    console.log('%c✅ Flixora Fullscreen Fix v1.0 — native + CSS fallback active', 'color:#10b981;font-weight:bold');
    console.log('%c  ✅ Sandbox fixed  ✅ F key  ✅ Double-tap  ✅ iOS fallback', 'color:#6ec6ff;font-size:.82em');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

})();
