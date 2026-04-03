/* ═══════════════════════════════════════════════════════════
   FLIXORA — Extended Server List v2.0
   ───────────────────────────────────────────────────────────
   Drop this BEFORE server-manager.js in index.html.
   It replaces window.SERVERS with an expanded, up-to-date list
   of embed providers and patches buildServerBtns to use it.
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     FULL SERVER LIST
     Each entry:
       name    — display label (star rating = rough reliability)
       sub     — has English subtitles (CC badge)
       url(d)  — function(contentData) → embed URL
                 d = { tmdb, imdb, type, season, episode }
  ────────────────────────────────────────────────────────── */
  const SERVERS_EXTENDED = [
    // ── Tier 1 — Most reliable, fewest ads ─────────────────
    {
      name: 'Server 1 ★★★',
      sub: true,
      url: d => d.type === 'movie'
        ? `https://vidsrc.xyz/embed/movie?tmdb=${d.tmdb}`
        : `https://vidsrc.xyz/embed/tv?tmdb=${d.tmdb}&season=${d.season||1}&episode=${d.episode||1}`,
    },
    {
      name: 'Server 2 ★★★',
      sub: true,
      url: d => d.type === 'movie'
        ? `https://embed.su/embed/movie/${d.tmdb}`
        : `https://embed.su/embed/tv/${d.tmdb}/${d.season||1}/${d.episode||1}`,
    },
    {
      name: 'Server 3 ★★★',
      sub: true,
      url: d => d.type === 'movie'
        ? `https://vidsrc.to/embed/movie/${d.tmdb}`
        : `https://vidsrc.to/embed/tv/${d.tmdb}/${d.season||1}/${d.episode||1}`,
    },
    // ── Tier 2 — Good, occasional ads ──────────────────────
    {
      name: 'Server 4 ★★',
      sub: true,
      url: d => d.type === 'movie'
        ? `https://vidsrc.me/embed/movie?tmdb=${d.tmdb}`
        : `https://vidsrc.me/embed/tv?tmdb=${d.tmdb}&season=${d.season||1}&episode=${d.episode||1}`,
    },
    {
      name: 'Server 5 ★★',
      sub: true,
      url: d => d.type === 'movie'
        ? `https://autoembed.cc/movie/tmdb/${d.tmdb}`
        : `https://autoembed.cc/tv/tmdb/${d.tmdb}-${d.season||1}-${d.episode||1}`,
    },
    {
      name: 'Server 6 ★★',
      sub: true,
      url: d => d.type === 'movie'
        ? `https://vidlink.pro/movie/${d.tmdb}`
        : `https://vidlink.pro/tv/${d.tmdb}/${d.season||1}/${d.episode||1}`,
    },
    {
      name: 'Server 7 ★★',
      sub: true,
      url: d => d.type === 'movie'
        ? `https://player.videasy.net/movie/${d.tmdb}`
        : `https://player.videasy.net/tv/${d.tmdb}/${d.season||1}/${d.episode||1}`,
    },
    {
      name: 'Server 8 ★★',
      sub: true,
      url: d => d.type === 'movie'
        ? `https://moviesapi.club/movie/${d.tmdb}`
        : `https://moviesapi.club/tv/${d.tmdb}-${d.season||1}-${d.episode||1}`,
    },
    // ── Tier 3 — Alternative, more ads ─────────────────────
    {
      name: 'Server 9 ★',
      sub: true,
      url: d => `https://www.2embed.cc/embed/${d.imdb || ('tt' + String(d.tmdb).padStart(7, '0'))}`,
    },
    {
      name: 'Server 10 ★',
      sub: true,
      url: d => `https://multiembed.mov/?video_id=${d.imdb || d.tmdb}&tmdb=1`,
    },
    {
      name: 'Server 11 ★',
      sub: false,
      url: d => d.type === 'movie'
        ? `https://vidsrc.cc/v2/embed/movie/${d.tmdb}`
        : `https://vidsrc.cc/v2/embed/tv/${d.tmdb}/${d.season||1}/${d.episode||1}`,
    },
    {
      name: 'Server 12 ★',
      sub: false,
      url: d => d.type === 'movie'
        ? `https://superembed.stream/movie/${d.tmdb}`
        : `https://superembed.stream/tv/${d.tmdb}/${d.season||1}/${d.episode||1}`,
    },
  ];

  /* ── Replace global SERVERS array used by app.js ────────── */
  // app.js uses window.SERVERS or the module-level const SERVERS
  // We patch both buildServerBtns and setServer to use our list.
  window.SERVERS_EXTENDED = SERVERS_EXTENDED;

  /* ── Patch buildServerBtns ───────────────────────────────── */
  function _patchBuildServerBtns() {
    window.buildServerBtns = function (data) {
      window.loadServerButtons = window.buildServerBtns; // alias

      const el = document.getElementById('serverButtons');
      if (!el) return;

      el.innerHTML = SERVERS_EXTENDED.map((s, i) =>
        `<button class="server-btn${i === 0 ? ' active' : ''}"
          role="radio" aria-checked="${i === 0}"
          style="position:relative"
          onclick="_smUserPick(${i},${JSON.stringify(data).replace(/'/g,"&#39;").replace(/"/g,'&quot;')})">
          ${s.name}${s.sub ? '<span class="sub-badge">CC</span>' : ''}
        </button>`
      ).join('');
    };
    window.loadServerButtons = window.buildServerBtns;
  }

  /* ── _smUserPick: called when user clicks a server button ── */
  window._smUserPick = function (idx, data) {
    // Mark as user-intentional pick so SM doesn't auto-switch away
    if (window._SM) {
      window._SM.userPicked  = true;
      window._SM.autoRetries = 0;
    }
    window.setServer(idx, data);
  };

  /* ── Patch setServer to use extended URL list ────────────── */
  function _patchSetServer() {
    const origSS = window.setServer;

    // We only wrap if it hasn't been wrapped by server-manager.js yet,
    // OR if server-manager already wrapped it — we stay inside that.
    // Strategy: replace window.setServer entirely since we control the URL.
    window.setServer = function (idx, data) {
      const srv = SERVERS_EXTENDED[idx];
      if (!srv) return;

      const pv = document.getElementById('playerVideo');
      if (!pv) return;

      // Remove old iframe
      pv.querySelectorAll('iframe').forEach(f => f.remove());

      // Show spinner
      let sp = pv.querySelector('.p-spin');
      if (!sp) {
        sp = document.createElement('div');
        sp.className = 'p-spin';
        sp.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#9494b8;background:#000';
        sp.innerHTML = '<div class="spinner" style="width:40px;height:40px;border:3px solid rgba(255,255,255,.08);border-top-color:#e63946;border-radius:50%;animation:sfSpin 1s linear infinite"></div><span style="font-size:.85rem">Loading player…</span>';
        pv.appendChild(sp);
      }
      sp.style.display = 'flex';

      const iframe = document.createElement('iframe');
      iframe.src = srv.url(data);
      iframe.allowFullscreen = true;
      iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none';

      iframe.onload = () => {
        if (sp) sp.style.display = 'none';
      };

      pv.appendChild(iframe);

      // Update active state on buttons
      document.querySelectorAll('.server-btn').forEach((b, i) => {
        b.classList.toggle('active', i === idx);
        b.setAttribute('aria-checked', i === idx ? 'true' : 'false');
      });

      // Sync currentContent
      const merged = { ...(window.currentContent || {}), ...data };
      window.currentContent = merged;
      if (window.S) window.S.content = merged;

      // Fallback hide spinner
      setTimeout(() => { if (sp) sp.style.display = 'none'; }, 8000);
    };

    window.loadServer = window.setServer;
  }

  /* ── Boot ─────────────────────────────────────────────────── */
  function boot() {
    _patchBuildServerBtns();
    _patchSetServer();

    // Re-patch after other scripts finish (episode-feature, room-manager, etc.)
    setTimeout(() => { _patchBuildServerBtns(); _patchSetServer(); }, 400);
    setTimeout(() => { _patchBuildServerBtns(); _patchSetServer(); }, 1200);

    console.log('%c✅ Flixora Extended Servers — 12 servers active', 'color:#818cf8;font-weight:bold');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
