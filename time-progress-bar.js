/* ═══════════════════════════════════════════════════════════
   FLIXORA — time-progress-bar.js
   Shows an elapsed-time progress bar at the bottom of the
   player. Since the video is inside an iframe we can't read
   its actual currentTime, so we track wall-clock time from
   the moment the player loads.

   • Drag the bar to visually mark a position (cosmetic only —
     can't seek an iframe, but lets you see roughly where you
     are relative to the total runtime).
   • Total duration is pulled from window._fxRuntimeMins
     (set by features-patch.js _loadDetails) or falls back
     to window.currentContent if it carries runtime.
   • Works for movies AND TV episodes.
   Drop AFTER features-patch.js in index.html.
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Inject CSS ─────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    #fx-time-bar-wrap {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      z-index: 20;
      padding: 0 0 4px 0;
      background: linear-gradient(transparent, rgba(0,0,0,.65));
      opacity: 0;
      transition: opacity .3s;
      pointer-events: none;
    }
    #playerVideo:hover #fx-time-bar-wrap,
    #fx-time-bar-wrap.touch-visible {
      opacity: 1;
      pointer-events: auto;
    }
    #fx-time-label {
      display: flex;
      justify-content: space-between;
      padding: 0 10px 3px;
      font-size: .7rem;
      font-family: inherit;
      color: rgba(255,255,255,.75);
      user-select: none;
    }
    #fx-time-track {
      position: relative;
      height: 4px;
      margin: 0 10px;
      background: rgba(255,255,255,.2);
      border-radius: 4px;
      cursor: pointer;
      transition: height .15s;
    }
    #fx-time-bar-wrap:hover #fx-time-track {
      height: 6px;
    }
    #fx-time-fill {
      height: 100%;
      width: 0%;
      background: var(--red, #e63946);
      border-radius: 4px;
      pointer-events: none;
      transition: width .9s linear;
    }
    #fx-time-thumb {
      position: absolute;
      top: 50%; right: -5px;
      width: 10px; height: 10px;
      background: #fff;
      border-radius: 50%;
      transform: translateY(-50%) scale(0);
      transition: transform .15s;
      pointer-events: none;
    }
    #fx-time-bar-wrap:hover #fx-time-thumb {
      transform: translateY(-50%) scale(1);
    }
  `;
  document.head.appendChild(style);

  /* ── State ──────────────────────────────────────────────── */
  let _startTs    = null;   // Date.now() when player loaded
  let _elapsed    = 0;      // seconds elapsed
  let _totalSecs  = 0;      // total runtime in seconds (0 = unknown)
  let _ticker     = null;
  let _injected   = false;

  /* ── Helpers ────────────────────────────────────────────── */
  function _fmt(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

  /* Try to get total runtime in minutes from various sources */
  function _getRuntimeMins() {
    // features-patch.js exposes this after _loadDetails
    if (window._fxRuntimeMins > 0) return window._fxRuntimeMins;
    return 0;
  }

  /* ── DOM refs (filled after inject) ── */
  let _fill, _label_elapsed, _label_total, _track;

  /* ── Inject the bar into #playerVideo ───────────────────── */
  function _inject() {
    const pv = document.getElementById('playerVideo');
    if (!pv || document.getElementById('fx-time-bar-wrap')) return;
    _injected = true;

    const wrap = document.createElement('div');
    wrap.id = 'fx-time-bar-wrap';
    wrap.innerHTML = `
      <div id="fx-time-label">
        <span id="fx-time-elapsed">0:00</span>
        <span id="fx-time-total"></span>
      </div>
      <div id="fx-time-track">
        <div id="fx-time-fill"></div>
        <div id="fx-time-thumb"></div>
      </div>
    `;
    pv.appendChild(wrap);

    _fill          = document.getElementById('fx-time-fill');
    _label_elapsed = document.getElementById('fx-time-elapsed');
    _label_total   = document.getElementById('fx-time-total');
    _track         = document.getElementById('fx-time-track');

    /* Touch: show briefly on tap */
    let _hideTouch;
    pv.addEventListener('touchstart', () => {
      wrap.classList.add('touch-visible');
      clearTimeout(_hideTouch);
      _hideTouch = setTimeout(() => wrap.classList.remove('touch-visible'), 4000);
    }, { passive: true });

    console.log('%c✅ Time progress bar injected', 'color:#10b981');
  }

  /* ── Start/restart the ticker ───────────────────────────── */
  function _startTicker() {
    _stopTicker();
    _startTs   = Date.now();
    _elapsed   = 0;
    _totalSecs = _getRuntimeMins() * 60;

    // Update total label if known
    if (_label_total) {
      _label_total.textContent = _totalSecs > 0 ? _fmt(_totalSecs) : '';
    }

    _ticker = setInterval(() => {
      _elapsed = Math.floor((Date.now() - _startTs) / 1000);

      if (_label_elapsed) _label_elapsed.textContent = _fmt(_elapsed);

      // Runtime might arrive late (async TMDB fetch)
      if (_totalSecs === 0) {
        const rm = _getRuntimeMins();
        if (rm > 0) {
          _totalSecs = rm * 60;
          if (_label_total) _label_total.textContent = _fmt(_totalSecs);
        }
      }

      if (_fill) {
        const pct = _totalSecs > 0
          ? Math.min(100, (_elapsed / _totalSecs) * 100)
          : 0;
        _fill.style.width = pct + '%';
        // Move thumb
        const thumb = document.getElementById('fx-time-thumb');
        if (thumb) thumb.style.right = (100 - pct) + '%';
      }

      // Stop at end
      if (_totalSecs > 0 && _elapsed >= _totalSecs) _stopTicker();
    }, 1000);
  }

  function _stopTicker() {
    if (_ticker) { clearInterval(_ticker); _ticker = null; }
  }

  /* ── Expose runtime setter for features-patch.js ─────── */
  // features-patch.js calls _loadDetails async; when done it should
  // call window._fxSetRuntime(mins) so the bar can show the total.
  window._fxSetRuntime = function (mins) {
    window._fxRuntimeMins = mins;
    if (_totalSecs === 0 && mins > 0) {
      _totalSecs = mins * 60;
      if (_label_total) _label_total.textContent = _fmt(_totalSecs);
    }
  };

  /* ── Hook into playById ─────────────────────────────────── */
  function _hookPlay() {
    const orig = window.playById;
    if (!orig || orig._tpbHooked) return;
    window.playById = async function (...args) {
      await orig(...args);
      setTimeout(() => {
        if (!_injected) _inject();
        window._fxRuntimeMins = 0; // reset until new details load
        _startTicker();
      }, 400);
    };
    window.playById._tpbHooked = true;
    window.playContentById = window.playById;
  }

  /* ── Init ────────────────────────────────────────────────── */
  function _init() {
    _hookPlay();
    // If player is already open on page load
    const pv = document.getElementById('playerVideo');
    if (pv && pv.querySelector('iframe')) {
      _inject();
      _startTicker();
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', _init)
    : _init();

  /* Re-hook after any dynamic rewrite of window.playById */
  setInterval(_hookPlay, 2000);

})();
