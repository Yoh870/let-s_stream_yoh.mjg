/* ═══════════════════════════════════════════════════════════
   FLIXORA — Custom Player Overlay Controls
   ───────────────────────────────────────────────────────────
   Adds on top of the existing iframe-based player:
     • Auto-hide top control bar (title, minimize, fullscreen, close)
     • Custom fullscreen toggle (works on the player container)
     • Draggable mini-player / floating mode
   Does NOT touch the iframe's own playback (cross-origin —
   impossible to control seek/play/volume inside it). This only
   wraps controls AROUND the embed.
   Drop this AFTER all other player-related scripts.
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const HIDE_DELAY = 3000; // ms of inactivity before the bar fades

  let hideTimer = null;
  let isMini = false;
  let dragState = null;

  /* ── CSS ──────────────────────────────────────────────── */
  function _injectCSS() {
    if (document.getElementById('fxpo-css')) return;
    const s = document.createElement('style');
    s.id = 'fxpo-css';
    s.textContent = `
      #fxpoBar {
        position: absolute; top: 0; left: 0; right: 0; z-index: 20;
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px;
        background: linear-gradient(to bottom, rgba(0,0,0,.75), transparent);
        opacity: 1; transition: opacity .25s ease;
        pointer-events: none;
      }
      #fxpoBar.fxpo-hidden { opacity: 0; }
      #fxpoBar > * { pointer-events: all; }
      #fxpoTitle {
        flex: 1; color: #fff; font-size: .8rem; font-weight: 700;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        text-shadow: 0 1px 4px rgba(0,0,0,.6);
      }
      .fxpo-btn {
        width: 30px; height: 30px; border-radius: 50%;
        background: rgba(0,0,0,.55); border: 1px solid rgba(255,255,255,.15);
        color: #fff; font-size: .8rem;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all .15s; flex-shrink: 0;
      }
      .fxpo-btn:hover { background: rgba(230,57,70,.85); border-color: transparent; }

      #fxpoHoverZone {
        position: absolute; top: 0; left: 0; right: 0; height: 54px;
        z-index: 19; pointer-events: all;
      }

      .fxpo-mini #playerModal { background: transparent; pointer-events: none; }
      .fxpo-mini .p-box {
        position: fixed !important;
        width: 320px !important; max-width: 90vw;
        height: auto !important; max-height: none !important;
        top: auto !important;
        border-radius: 14px !important;
        overflow: hidden !important;
        box-shadow: 0 20px 60px rgba(0,0,0,.7) !important;
        pointer-events: all;
        transition: none;
        z-index: 850;
      }
      .fxpo-mini .p-meta,
      .fxpo-mini #kbHint,
      .fxpo-mini #chatPanel { display: none !important; }
      .fxpo-mini #playerVideo { padding-top: 56.25%; min-height: 0; }
      .fxpo-mini #fxpoBar { cursor: move; }
      .fxpo-mini #fxpoDragHandle { display: flex; }
      #fxpoDragHandle { display: none; }

      @media (max-width: 640px) {
        .fxpo-mini .p-box { width: 260px !important; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Build overlay bar (once) ─────────────────────────── */
  function _ensureBar() {
    const pv = document.getElementById('playerVideo');
    if (!pv || document.getElementById('fxpoBar')) return;

    const zone = document.createElement('div');
    zone.id = 'fxpoHoverZone';
    pv.appendChild(zone);

    const bar = document.createElement('div');
    bar.id = 'fxpoBar';
    bar.innerHTML = `
      <span id="fxpoDragHandle" class="fxpo-btn" title="Drag" style="cursor:move">⠿</span>
      <span id="fxpoTitle">—</span>
      <button class="fxpo-btn" id="fxpoMiniBtn" title="Mini player">▁</button>
      <button class="fxpo-btn" id="fxpoFsBtn" title="Fullscreen">⛶</button>
      <button class="fxpo-btn" id="fxpoCloseBtn" title="Close">✕</button>
    `;
    pv.appendChild(bar);

    document.getElementById('fxpoMiniBtn').addEventListener('click', _toggleMini);
    document.getElementById('fxpoFsBtn').addEventListener('click', _toggleFullscreen);
    document.getElementById('fxpoCloseBtn').addEventListener('click', () => {
      if (isMini) _exitMini();
      if (typeof window.closePlayer === 'function') window.closePlayer();
    });

    zone.addEventListener('mouseenter', _showBar);
    bar.addEventListener('mouseenter', _showBar);
    bar.addEventListener('mousemove', _showBar);

    const handle = document.getElementById('fxpoDragHandle');
    handle.addEventListener('pointerdown', _dragStart);
    bar.addEventListener('pointerdown', e => {
      if (isMini && !e.target.closest('.fxpo-btn') && e.target.id !== 'fxpoDragHandle') _dragStart(e);
    });
  }

  function _showBar() {
    const bar = document.getElementById('fxpoBar');
    if (!bar) return;
    bar.classList.remove('fxpo-hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => bar.classList.add('fxpo-hidden'), HIDE_DELAY);
  }

  function _syncTitle() {
    const t = document.getElementById('fxpoTitle');
    const src = document.getElementById('playerTitle');
    if (t && src) t.textContent = src.textContent || '—';
  }

  /* ── Fullscreen ───────────────────────────────────────── */
  function _toggleFullscreen() {
    const pv = document.getElementById('playerVideo');
    if (!pv) return;
    if (!document.fullscreenElement) {
      (pv.requestFullscreen || pv.webkitRequestFullscreen || pv.msRequestFullscreen)?.call(pv)
        .catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  /* ── Mini player ──────────────────────────────────────── */
  function _toggleMini() { isMini ? _exitMini() : _enterMini(); }

  function _enterMini() {
    isMini = true;
    document.documentElement.classList.add('fxpo-mini');
    const box = document.querySelector('.p-box');
    if (box) {
      box.style.right = '18px';
      box.style.bottom = '18px';
      box.style.left = 'auto';
    }
    const btn = document.getElementById('fxpoMiniBtn');
    if (btn) { btn.textContent = '⛶'; btn.title = 'Restore'; }
    _showBar();
  }

  function _exitMini() {
    isMini = false;
    document.documentElement.classList.remove('fxpo-mini');
    const box = document.querySelector('.p-box');
    if (box) { box.style.right = ''; box.style.bottom = ''; box.style.left = ''; box.style.top = ''; }
    const btn = document.getElementById('fxpoMiniBtn');
    if (btn) { btn.textContent = '▁'; btn.title = 'Mini player'; }
  }

  /* ── Dragging ─────────────────────────────────────────── */
  function _dragStart(e) {
    if (!isMini) return;
    const box = document.querySelector('.p-box');
    if (!box) return;
    const rect = box.getBoundingClientRect();
    dragState = {
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
      w: rect.width, h: rect.height
    };
    box.style.transition = 'none';
    window.addEventListener('pointermove', _dragMove);
    window.addEventListener('pointerup', _dragEnd, { once: true });
    e.preventDefault();
  }

  function _dragMove(e) {
    if (!dragState) return;
    const box = document.querySelector('.p-box');
    if (!box) return;
    let x = e.clientX - dragState.offX;
    let y = e.clientY - dragState.offY;
    x = Math.max(4, Math.min(window.innerWidth - dragState.w - 4, x));
    y = Math.max(4, Math.min(window.innerHeight - dragState.h - 4, y));
    box.style.left = x + 'px';
    box.style.top = y + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
  }

  function _dragEnd() {
    dragState = null;
    window.removeEventListener('pointermove', _dragMove);
  }

  /* ── Hook into player open/close ─────────────────────── */
  function _onPlayerOpen() {
    _ensureBar();
    _syncTitle();
    _showBar();
  }

  function _watchModal() {
    const modal = document.getElementById('playerModal');
    if (!modal) return;
    const obs = new MutationObserver(() => {
      if (modal.classList.contains('active')) {
        _onPlayerOpen();
      } else {
        if (isMini) _exitMini();
      }
    });
    obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  function _watchTitle() {
    const t = document.getElementById('playerTitle');
    if (!t) return;
    const obs = new MutationObserver(_syncTitle);
    obs.observe(t, { childList: true, characterData: true, subtree: true });
  }

  /* ── Boot ─────────────────────────────────────────────── */
  function boot() {
    _injectCSS();
    _watchModal();
    _watchTitle();
    if (document.getElementById('playerModal')?.classList.contains('active')) _onPlayerOpen();
    console.log('%c✅ Flixora Player Overlay — mini-player + fullscreen ready', 'color:#e63946;font-weight:bold');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
