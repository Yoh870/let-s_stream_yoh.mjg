/* ═══════════════════════════════════════════════════════════
   FLIXORA — reaction-bar-fix.js
   Collapses the annoying floating reaction bar into a small
   corner button that expands on click/tap.
   Drop AFTER features-patch.js in index.html.
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  function _fixReactBar() {
    const bar = document.getElementById('fx-react-bar');
    if (!bar || bar._fixed) return;
    bar._fixed = true;

    /* ── Restyle the collapsed button ── */
    bar.style.cssText = `
      position: absolute;
      bottom: 14px;
      right: 58px;
      z-index: 16;
      background: rgba(0,0,0,.75);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255,255,255,.15);
      border-radius: 30px;
      padding: 5px 7px;
      display: flex;
      align-items: center;
      gap: 4px;
      pointer-events: auto;
      transition: max-width .25s ease, opacity .2s ease, padding .2s ease;
      overflow: hidden;
      max-width: 40px;
      opacity: 0;
      cursor: pointer;
    `;

    /* hide individual buttons by default */
    const btns = bar.querySelectorAll('.fx-rb');
    btns.forEach(b => { b.style.display = 'none'; });

    /* collapsed "😊" trigger shown on hover */
    let trigger = bar.querySelector('#fx-react-trigger');
    if (!trigger) {
      trigger = document.createElement('span');
      trigger.id = 'fx-react-trigger';
      trigger.textContent = '😊';
      trigger.style.cssText = 'font-size:1.1rem;line-height:1;cursor:pointer;user-select:none;flex-shrink:0';
      bar.insertBefore(trigger, bar.firstChild);
    }

    let _open = false;

    function _expand() {
      _open = true;
      btns.forEach(b => { b.style.display = 'flex'; });
      trigger.style.display = 'none';
      bar.style.maxWidth = '320px';
      bar.style.padding  = '5px 10px';
      bar.style.gap      = '6px';
    }

    function _collapse() {
      _open = false;
      btns.forEach(b => { b.style.display = 'none'; });
      trigger.style.display = '';
      bar.style.maxWidth = '40px';
      bar.style.padding  = '5px 7px';
    }

    /* toggle on trigger click */
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      _open ? _collapse() : _expand();
    });

    /* clicking a reaction emoji = collapse after send */
    btns.forEach(b => {
      b.addEventListener('click', () => setTimeout(_collapse, 300));
    });

    /* close when clicking outside */
    document.addEventListener('click', e => {
      if (_open && !bar.contains(e.target)) _collapse();
    }, true);

    /* show bar only when hovering the player */
    const pv = document.getElementById('playerVideo');
    if (pv) {
      pv.addEventListener('mouseenter', () => { bar.style.opacity = '1'; });
      pv.addEventListener('mouseleave', () => { bar.style.opacity = '0'; if (_open) _collapse(); });
    }

    /* touch: show briefly on tap, hide after 3s idle */
    let _hideTimer;
    if (pv) {
      pv.addEventListener('touchstart', () => {
        bar.style.opacity = '1';
        clearTimeout(_hideTimer);
        _hideTimer = setTimeout(() => {
          if (!_open) bar.style.opacity = '0';
        }, 3000);
      }, { passive: true });
    }

    console.log('%c✅ Reaction bar collapsed to corner button', 'color:#10b981');
  }

  /* Run now + watch for bar injection */
  function _try() {
    if (document.getElementById('fx-react-bar')) { _fixReactBar(); return; }
    new MutationObserver((_, obs) => {
      if (document.getElementById('fx-react-bar')) { obs.disconnect(); _fixReactBar(); }
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* Also re-apply after playById (features-patch re-injects the bar) */
  const _origPlay = window.playById;
  if (typeof _origPlay === 'function' && !_origPlay._rxFixed) {
    window.playById = async function (...args) {
      await _origPlay(...args);
      setTimeout(_fixReactBar, 500);
    };
    window.playById._rxFixed = true;
    window.playContentById = window.playById;
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', _try)
    : _try();

})();
