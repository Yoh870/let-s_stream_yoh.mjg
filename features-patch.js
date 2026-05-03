/* ═══════════════════════════════════════════════════════════════════
   FLIXORA — features-patch.js  v1.0
   ─────────────────────────────────────────────────────────────────
   Drop this AFTER all other scripts in index.html:
     <script src="features-patch.js"></script>

   INCLUDES:
     ✅ 1. Trailer Button       — TMDB /videos → YouTube embed
     ✅ 2. Movie Details Panel  — poster, overview, runtime, genres, cast
     ✅ 3. Related Content Row  — "More Like This" inside player
     ✅ 4. Surprise Me          — random trending title picker
     ✅ 5. Language Filter Bar  — PH / KR / JP / etc. chips
     ✅ 6. Theme Color Switcher — 8 accent colors + contrast / motion toggles
     ✅ 7. Watch Party Voting   — live Firebase poll inside chat panel
     ✅ 8. QR Code Room Invite  — scannable QR via free API, downloadable
     ✅ 9. Floating Reactions   — TikTok Live-style emoji bursts, synced in room
═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Reuse app's cached tmdb() if available ── */
  const _tmdb = window.tmdb || async function (ep, p = {}) {
    const KEY = '3fd2be6f0c70a2a598f084ddfb75487c';
    const url = `https://api.themoviedb.org/3${ep}?${new URLSearchParams({ api_key: KEY, ...p })}`;
    try { const r = await fetch(url); return r.ok ? r.json() : null; } catch { return null; }
  };

  /* ══════════════════════════════════════════════════════════════
     CSS — injected once
  ══════════════════════════════════════════════════════════════ */
  function _injectCSS() {
    if (document.getElementById('fx-features-css')) return;
    const s = document.createElement('style');
    s.id = 'fx-features-css';
    s.textContent = `
    /* ─── TRAILER ─── */
    #fx-trailer-modal{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.97);
      display:none;align-items:center;justify-content:center;padding:20px}
    #fx-trailer-modal.on{display:flex}
    #fx-trailer-box{width:100%;max-width:880px;background:#0e0e18;border-radius:16px;
      overflow:hidden;position:relative;box-shadow:0 48px 120px rgba(0,0,0,.9);
      animation:fxScaleIn .25s cubic-bezier(.34,1.56,.64,1)}
    #fx-trailer-box iframe{width:100%;aspect-ratio:16/9;display:block;border:none}
    #fx-trailer-close{position:absolute;top:10px;right:10px;z-index:5;width:34px;height:34px;
      border-radius:50%;background:rgba(0,0,0,.8);border:1px solid rgba(255,255,255,.15);
      color:#fff;font-size:.9rem;cursor:pointer;display:flex;align-items:center;
      justify-content:center;transition:background .15s}
    #fx-trailer-close:hover{background:var(--red,#e63946)}

    /* ─── DETAILS PANEL ─── */
    #fx-details-panel{padding:0 24px 6px;display:none}
    #fx-details-panel.on{display:block}
    .fx-det-grid{display:grid;grid-template-columns:100px 1fr;gap:14px;
      background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);
      border-radius:12px;padding:14px;margin-bottom:12px}
    .fx-det-poster{width:100px;aspect-ratio:2/3;border-radius:8px;object-fit:cover;
      background:#141421;display:block}
    .fx-det-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px}
    .fx-det-tag{padding:3px 8px;border-radius:20px;font-size:.65rem;font-weight:700;
      background:rgba(255,255,255,.07);color:#9494b8;border:1px solid rgba(255,255,255,.09)}
    .fx-det-ov{font-size:.8rem;color:#9494b8;line-height:1.65;
      display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
    .fx-sec-lbl{font-size:.6rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;
      color:#4e4e70;margin-bottom:8px;display:block}
    .fx-cast-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}
    .fx-cast-row::-webkit-scrollbar{display:none}
    .fx-cast-card{flex-shrink:0;text-align:center;width:58px}
    .fx-cast-img{width:50px;height:50px;border-radius:50%;object-fit:cover;background:#1c1c2e;
      margin:0 auto 4px;display:block;border:2px solid rgba(255,255,255,.07)}
    .fx-cast-name{font-size:.58rem;color:#9494b8;overflow:hidden;text-overflow:ellipsis;
      white-space:nowrap;line-height:1.3}

    /* ─── RELATED ─── */
    #fx-related-section{padding:0 24px 18px;display:none}
    #fx-related-section.on{display:block}
    .fx-rel-row{display:grid;grid-auto-flow:column;grid-auto-columns:96px;gap:8px;
      overflow-x:auto;scrollbar-width:none;padding-bottom:4px}
    .fx-rel-row::-webkit-scrollbar{display:none}
    .fx-rel-card{cursor:pointer;border-radius:8px;overflow:hidden;background:#141421;
      transition:transform .2s cubic-bezier(.34,1.56,.64,1);flex-shrink:0}
    .fx-rel-card:hover{transform:scale(1.06) translateY(-3px)}
    .fx-rel-card img{width:100%;aspect-ratio:2/3;object-fit:cover;display:block}
    .fx-rel-title{padding:5px 6px;font-size:.62rem;font-weight:600;color:#9494b8;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

    /* ─── SURPRISE ME ─── */
    #fx-surprise-btn{background:rgba(139,92,246,.12)!important;
      border-color:rgba(139,92,246,.3)!important;color:#a78bfa!important}
    #fx-surprise-btn:hover{background:rgba(139,92,246,.22)!important}
    #fx-surprise-btn.spin{animation:fxSpin .55s linear}

    /* ─── LANGUAGE BAR ─── */
    #fx-lang-bar{display:flex;gap:7px;padding:8px 22px 10px;overflow-x:auto;
      scrollbar-width:none;border-bottom:1px solid var(--bd,rgba(255,255,255,.07))}
    #fx-lang-bar::-webkit-scrollbar{display:none}
    .fx-lc{flex-shrink:0;padding:5px 13px;border-radius:30px;
      background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);
      color:#9494b8;font-size:.75rem;font-weight:500;cursor:pointer;transition:all .15s;
      white-space:nowrap;user-select:none}
    .fx-lc:hover{background:rgba(255,255,255,.1);color:#f2f2fc}
    .fx-lc.active{background:rgba(99,102,241,.16);border-color:rgba(99,102,241,.4);
      color:#818cf8;font-weight:700}

    /* ─── THEME BAR ─── */
    #fx-theme-bar{position:fixed;top:78px;right:16px;z-index:600;
      background:var(--bg2,#0e0e18);border:1px solid rgba(255,255,255,.12);
      border-radius:14px;padding:14px 16px;display:none;flex-direction:column;gap:11px;
      box-shadow:0 20px 60px rgba(0,0,0,.65);animation:fxDrop .15s ease;min-width:190px}
    #fx-theme-bar.on{display:flex}
    .fx-th-lbl{font-size:.6rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#4e4e70}
    .fx-swatches{display:flex;gap:7px;flex-wrap:wrap}
    .fx-sw{width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent;
      transition:transform .15s,border-color .15s;flex-shrink:0}
    .fx-sw:hover{transform:scale(1.25)}
    .fx-sw.active{border-color:#fff;transform:scale(1.15)}
    .fx-th-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .fx-th-rlbl{font-size:.78rem;color:#9494b8}
    .fx-tog{width:36px;height:20px;border-radius:10px;background:rgba(255,255,255,.1);
      border:1px solid rgba(255,255,255,.12);cursor:pointer;position:relative;
      transition:background .2s;flex-shrink:0}
    .fx-tog.on{background:var(--red,#e63946)}
    .fx-tog::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;
      border-radius:50%;background:#fff;transition:transform .2s}
    .fx-tog.on::after{transform:translateX(16px)}

    /* ─── VOTE PANEL ─── */
    #wt-vote-panel{padding:8px 10px 6px;border-top:1px solid rgba(255,255,255,.06);display:none}
    #wt-vote-panel.on{display:block}
    .wt-vq{font-size:.8rem;font-weight:600;color:#f2f2fc;margin-bottom:9px;line-height:1.45}
    .wt-vo{position:relative;padding:6px 9px;background:rgba(255,255,255,.05);
      border:1px solid rgba(255,255,255,.08);border-radius:7px;cursor:pointer;
      font-size:.76rem;color:#f2f2fc;overflow:hidden;transition:border-color .15s;margin-bottom:4px}
    .wt-vo:hover{border-color:rgba(255,255,255,.18)}
    .wt-vo.voted{border-color:rgba(230,57,70,.45);background:rgba(230,57,70,.1)}
    .wt-vo-bar{position:absolute;inset:0 auto 0 0;background:rgba(230,57,70,.14);transition:width .4s ease}
    .wt-vo-row{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center}
    .wt-vo-pct{font-size:.68rem;color:#9494b8;margin-left:6px}
    .wt-create-inp{width:100%;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,.07);
      border:1px solid rgba(255,255,255,.1);color:#fff;font-size:.74rem;font-family:inherit;
      outline:none;margin-bottom:4px;box-sizing:border-box;transition:border-color .15s}
    .wt-create-inp:focus{border-color:rgba(230,57,70,.4)}
    .wt-vbtn{padding:5px 10px;border-radius:6px;background:rgba(230,57,70,.75);color:#fff;
      border:none;font-size:.7rem;font-weight:700;cursor:pointer;font-family:inherit;
      transition:background .15s;white-space:nowrap}
    .wt-vbtn:hover{background:var(--red,#e63946)}
    .wt-vbtn.ghost{background:rgba(255,255,255,.08);color:#9494b8}

    /* ─── QR MODAL ─── */
    #fx-qr-modal{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.9);
      backdrop-filter:blur(14px);display:none;align-items:center;justify-content:center;padding:20px}
    #fx-qr-modal.on{display:flex}
    #fx-qr-box{background:#0e0e18;border:1px solid rgba(255,255,255,.1);border-radius:20px;
      padding:28px 24px;text-align:center;max-width:280px;width:100%;
      box-shadow:0 40px 100px rgba(0,0,0,.8);animation:fxScaleIn .25s cubic-bezier(.34,1.56,.64,1)}
    #fx-qr-box h3{font-size:1rem;font-weight:800;margin-bottom:4px;color:#f2f2fc}
    #fx-qr-box p{font-size:.75rem;color:#9494b8;margin-bottom:14px;line-height:1.55}
    #fx-qr-img{width:168px;height:168px;border-radius:10px;background:#fff;
      margin:0 auto 12px;display:block;padding:6px}
    #fx-qr-code-val{font-family:monospace;font-size:1.5rem;font-weight:800;
      letter-spacing:.25em;color:var(--red,#e63946);background:rgba(230,57,70,.08);
      border:1px solid rgba(230,57,70,.15);border-radius:8px;padding:10px;margin-bottom:14px}
    .fx-qr-acts{display:flex;gap:7px}
    .fx-qr-acts button{flex:1;padding:9px;border-radius:8px;font-size:.76rem;
      font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s}
    .fx-qr-acts .primary{background:var(--red,#e63946);color:#fff;border:none}
    .fx-qr-acts .primary:hover{background:var(--red2,#ff5561)}
    .fx-qr-acts .ghost{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#9494b8}
    .fx-qr-acts .ghost:hover{color:#f2f2fc}

    /* ─── FLOATING REACTIONS ─── */
    #fx-float-ov{position:absolute;inset:0;pointer-events:none;z-index:15;overflow:hidden}
    .fx-fe{position:absolute;bottom:55px;font-size:2rem;pointer-events:none;
      animation:fxFloat var(--dur,2.8s) ease-out forwards;user-select:none;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}
    /* reaction bar removed */

    /* ─── KEYFRAMES ─── */
    @keyframes fxFloat{
      0%{opacity:1;transform:translateY(0) scale(1) rotate(0deg)}
      60%{opacity:.9}
      100%{opacity:0;transform:translateY(-230px) scale(1.5) rotate(var(--rot,15deg))}}
    @keyframes fxSpin{to{transform:rotate(360deg)}}
    @keyframes fxScaleIn{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:none}}
    @keyframes fxDrop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════════
     1. TRAILER BUTTON
  ══════════════════════════════════════════════════════════════ */
  function _injectTrailerModal() {
    if (document.getElementById('fx-trailer-modal')) return;
    const d = document.createElement('div');
    d.id = 'fx-trailer-modal';
    d.innerHTML = `<div id="fx-trailer-box">
      <button id="fx-trailer-close" onclick="FX.closeTrailer()" aria-label="Close">✕</button>
      <iframe id="fx-trailer-iframe" allowfullscreen allow="autoplay; fullscreen"></iframe>
    </div>`;
    document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d) FX.closeTrailer(); });
  }

  async function openTrailer(tmdbId, type) {
    _injectTrailerModal();
    const modal = document.getElementById('fx-trailer-modal');
    const iframe = document.getElementById('fx-trailer-iframe');
    if (!modal || !iframe) return;
    iframe.src = '';
    modal.classList.add('on');

    const ep = type === 'tv' ? `/tv/${tmdbId}/videos` : `/movie/${tmdbId}/videos`;
    const d = await _tmdb(ep);
    const vids = d?.results || [];
    const pick = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer')
              || vids.find(v => v.site === 'YouTube' && v.type === 'Teaser')
              || vids.find(v => v.site === 'YouTube');

    if (!pick) {
      FX.closeTrailer();
      if (typeof showToast === 'function') showToast('No trailer found for this title', '🎬', 2400);
      return;
    }
    iframe.src = `https://www.youtube.com/embed/${pick.key}?autoplay=1&rel=0`;
  }

  function closeTrailer() {
    const m = document.getElementById('fx-trailer-modal');
    const i = document.getElementById('fx-trailer-iframe');
    if (m) m.classList.remove('on');
    if (i) i.src = '';
  }

  function _addTrailerBtn() {
    const acts = document.querySelector('.p-acts');
    if (!acts || document.getElementById('fx-trailer-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'fx-trailer-btn';
    btn.className = 'btn-tog';
    btn.innerHTML = '🎬 Trailer';
    btn.style.cssText = 'background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.22);color:#fca5a5';
    btn.onclick = () => {
      const c = window.currentContent;
      if (c) openTrailer(c.tmdb, c.type || 'movie');
    };
    acts.insertBefore(btn, acts.firstChild);
  }

  /* ══════════════════════════════════════════════════════════════
     2 & 3. DETAILS PANEL + RELATED ROW
  ══════════════════════════════════════════════════════════════ */
  function _injectDetailsSections() {
    const pmeta = document.querySelector('.p-meta');
    if (!pmeta) return;
    if (!document.getElementById('fx-details-panel')) {
      const det = document.createElement('div');
      det.id = 'fx-details-panel';
      det.innerHTML = `
        <span class="fx-sec-lbl">About This Title</span>
        <div id="fx-det-inner"><div style="color:#4e4e70;font-size:.78rem">Loading…</div></div>
        <span class="fx-sec-lbl" style="margin-top:12px;display:block">Cast</span>
        <div class="fx-cast-row" id="fx-cast-row"></div>`;
      pmeta.appendChild(det);
    }
    if (!document.getElementById('fx-related-section')) {
      const rel = document.createElement('div');
      rel.id = 'fx-related-section';
      rel.innerHTML = `
        <span class="fx-sec-lbl">More Like This</span>
        <div class="fx-rel-row" id="fx-rel-row"></div>`;
      pmeta.appendChild(rel);
    }
  }

  async function _loadDetails(tmdbId, type) {
    _injectDetailsSections();
    const panel   = document.getElementById('fx-details-panel');
    const inner   = document.getElementById('fx-det-inner');
    const castRow = document.getElementById('fx-cast-row');
    const relSec  = document.getElementById('fx-related-section');
    const relRow  = document.getElementById('fx-rel-row');
    if (!panel || !inner) return;

    panel.classList.add('on');
    if (relSec) relSec.classList.add('on');
    inner.innerHTML = '<div style="color:#4e4e70;font-size:.78rem">Loading…</div>';
    if (castRow) castRow.innerHTML = '';
    if (relRow)  relRow.innerHTML  = '';

    const t = type === 'tv' ? 'tv' : 'movie';
    const [details, credits, similar] = await Promise.all([
      _tmdb(`/${t}/${tmdbId}`),
      _tmdb(`/${t}/${tmdbId}/credits`),
      _tmdb(`/${t}/${tmdbId}/similar`),
    ]);

    if (!details) { inner.innerHTML = '<div style="color:#4e4e70;font-size:.78rem">Details unavailable.</div>'; return; }

    const runtime = t === 'movie'
      ? (details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : '')
      : (details.episode_run_time?.[0] ? `~${details.episode_run_time[0]}m/ep` : '');

    // Expose runtime in minutes for the time-progress-bar
    const _rtMins = t === 'movie'
      ? (details.runtime || 0)
      : (details.episode_run_time?.[0] || 0);
    if (typeof window._fxSetRuntime === 'function') window._fxSetRuntime(_rtMins);
    const genres = (details.genres || []).slice(0, 3).map(g => g.name).join(', ');
    const score  = details.vote_average ? `★ ${parseFloat(details.vote_average).toFixed(1)}` : '';
    const year   = (details.release_date || details.first_air_date || '').slice(0, 4);
    const lang   = (details.original_language || '').toUpperCase();
    const poster = details.poster_path ? `https://image.tmdb.org/t/p/w154${details.poster_path}` : '';
    const ov     = details.overview || '';

    inner.innerHTML = `<div class="fx-det-grid">
      ${poster
        ? `<img class="fx-det-poster" src="${poster}" alt="poster" loading="lazy"
             onerror="this.style.background='#1c1c2e';this.removeAttribute('src')">`
        : `<div class="fx-det-poster" style="background:#1c1c2e"></div>`}
      <div>
        <div class="fx-det-meta">
          ${score  ? `<span class="fx-det-tag" style="background:rgba(245,197,24,.1);color:#f5c518;border-color:rgba(245,197,24,.2)">${score}</span>` : ''}
          ${year   ? `<span class="fx-det-tag">${year}</span>` : ''}
          ${runtime? `<span class="fx-det-tag">⏱ ${runtime}</span>` : ''}
          ${lang   ? `<span class="fx-det-tag">🌐 ${lang}</span>` : ''}
        </div>
        ${genres ? `<div style="font-size:.7rem;color:#55556a;margin-bottom:8px">${genres}</div>` : ''}
        ${ov ? `<div class="fx-det-ov">${ov}</div>` : ''}
      </div>
    </div>`;

    // Cast
    if (castRow && credits?.cast?.length) {
      castRow.innerHTML = credits.cast.slice(0, 14).map(p => {
        const img = p.profile_path
          ? `https://image.tmdb.org/t/p/w92${p.profile_path}`
          : `https://placehold.co/50x50/1c1c2e/4e4e70?text=${encodeURIComponent((p.name || '?')[0])}`;
        return `<div class="fx-cast-card">
          <img class="fx-cast-img" src="${img}" alt="${p.name}" loading="lazy"
            onerror="this.src='https://placehold.co/50x50/1c1c2e/4e4e70?text=?'">
          <div class="fx-cast-name">${p.name}</div>
        </div>`;
      }).join('');
    }

    // Related
    if (relRow && similar?.results?.length) {
      relRow.innerHTML = similar.results.slice(0, 12).map(item => {
        const ti = item.title || item.name || '';
        const yr = (item.release_date || item.first_air_date || '').slice(0, 4);
        const pt = item.poster_path
          ? `https://image.tmdb.org/t/p/w154${item.poster_path}`
          : `https://placehold.co/96x144/141421/2e2e4e?text=${encodeURIComponent(ti.slice(0, 2))}`;
        const safe = ti.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `<div class="fx-rel-card"
          onclick="playById(${item.id},'${t}','${safe}','${yr}')"
          title="${ti} ${yr}">
          <img src="${pt}" loading="lazy" style="display:block"
            onerror="this.style.display='none'">
          <div class="fx-rel-title">${ti}</div>
        </div>`;
      }).join('');
    }
  }

  /* ══════════════════════════════════════════════════════════════
     4. SURPRISE ME
  ══════════════════════════════════════════════════════════════ */
  async function surpriseMe() {
    const btn = document.getElementById('fx-surprise-btn');
    if (btn) { btn.disabled = true; btn.classList.add('spin'); }
    try {
      const pg = Math.floor(Math.random() * 10) + 1;
      const d  = await _tmdb('/trending/all/week', { page: pg });
      const items = (d?.results || []).filter(i => i.media_type !== 'person');
      if (!items.length) return;
      const pick  = items[Math.floor(Math.random() * items.length)];
      const type  = pick.media_type === 'movie' ? 'movie' : 'tv';
      const title = pick.title || pick.name || '';
      const year  = (pick.release_date || pick.first_air_date || '').slice(0, 4);
      if (typeof showToast === 'function') showToast(`🎲 Rolling the dice… "${title}"`, '🎲', 3000);
      if (typeof playById === 'function') await playById(pick.id, type, title, year);
    } finally {
      if (btn) { btn.disabled = false; btn.classList.remove('spin'); }
    }
  }

  function _injectSurpriseBtn() {
    const acts = document.querySelector('.tb-acts');
    if (!acts || document.getElementById('fx-surprise-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'fx-surprise-btn'; btn.className = 'tb-btn';
    btn.innerHTML = '🎲'; btn.title = 'Surprise Me — random pick';
    btn.setAttribute('aria-label', 'Surprise me');
    btn.onclick = surpriseMe;
    acts.insertBefore(btn, acts.firstChild);
  }

  /* ══════════════════════════════════════════════════════════════
     5. LANGUAGE FILTER BAR
  ══════════════════════════════════════════════════════════════ */
  const LANGS = [
    { code: 'all', label: '🌍 All' },
    { code: 'tl',  label: '🇵🇭 Filipino' },
    { code: 'ko',  label: '🇰🇷 Korean' },
    { code: 'ja',  label: '🇯🇵 Japanese' },
    { code: 'zh',  label: '🇨🇳 Chinese' },
    { code: 'hi',  label: '🇮🇳 Hindi' },
    { code: 'en',  label: '🇺🇸 English' },
    { code: 'es',  label: '🇪🇸 Spanish' },
    { code: 'fr',  label: '🇫🇷 French' },
    { code: 'th',  label: '🇹🇭 Thai' },
    { code: 'id',  label: '🇮🇩 Indonesian' },
    { code: 'ar',  label: '🇸🇦 Arabic' },
  ];

  function _injectLangBar() {
    if (document.getElementById('fx-lang-bar')) return;
    const genreBar = document.getElementById('genreBar');
    if (!genreBar) return;
    const bar = document.createElement('nav');
    bar.id = 'fx-lang-bar';
    bar.setAttribute('aria-label', 'Filter by language');
    bar.innerHTML = LANGS.map((l, i) =>
      `<div class="fx-lc${i === 0 ? ' active' : ''}" data-lang="${l.code}" role="button" tabindex="0">${l.label}</div>`
    ).join('');
    genreBar.insertAdjacentElement('afterend', bar);

    bar.addEventListener('click', e => {
      const chip = e.target.closest('.fx-lc'); if (!chip) return;
      bar.querySelectorAll('.fx-lc').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const code = chip.dataset.lang;
      if (code === 'all') { if (typeof goHome === 'function') goHome(); return; }
      _filterByLang(code, chip.textContent.trim());
    });

    bar.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') e.target.click();
    });
  }

  async function _filterByLang(lang, label) {
    if (typeof showResultsView === 'function') showResultsView();
    if (typeof setInfo === 'function') setInfo(label, '⏳ Loading…');
    const [mv, tv] = await Promise.all([
      _tmdb('/discover/movie', { with_original_language: lang, sort_by: 'popularity.desc' }),
      _tmdb('/discover/tv',    { with_original_language: lang, sort_by: 'popularity.desc' }),
    ]);
    const results = [
      ...(mv?.results || []).map(r => ({ ...r, media_type: 'movie' })),
      ...(tv?.results || []).map(r => ({ ...r, media_type: 'tv' })),
    ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    const total = (mv?.total_results || 0) + (tv?.total_results || 0);
    if (typeof setInfo  === 'function') setInfo(label, `${total.toLocaleString()} titles`);
    if (typeof renderGrid === 'function') renderGrid(results);
  }

  /* ══════════════════════════════════════════════════════════════
     6. THEME SWITCHER
  ══════════════════════════════════════════════════════════════ */
  const THEMES = [
    { key: 'red',    a: '#e63946', a2: '#ff5561' },
    { key: 'purple', a: '#8b5cf6', a2: '#a78bfa' },
    { key: 'blue',   a: '#3b82f6', a2: '#60a5fa' },
    { key: 'emerald',a: '#10b981', a2: '#34d399' },
    { key: 'orange', a: '#f97316', a2: '#fb923c' },
    { key: 'pink',   a: '#ec4899', a2: '#f472b6' },
    { key: 'gold',   a: '#f5c518', a2: '#fbbf24' },
    { key: 'cyan',   a: '#06b6d4', a2: '#22d3ee' },
  ];

  let _activeTheme = localStorage.getItem('fx_theme') || 'red';

  function _applyTheme(key) {
    const t = THEMES.find(x => x.key === key) || THEMES[0];
    const r = s => parseInt(s.slice(1, 3), 16);
    const g = s => parseInt(s.slice(3, 5), 16);
    const b = s => parseInt(s.slice(5, 7), 16);
    document.documentElement.style.setProperty('--red',  t.a);
    document.documentElement.style.setProperty('--red2', t.a2);
    document.documentElement.style.setProperty('--rd',   `rgba(${r(t.a)},${g(t.a)},${b(t.a)},.12)`);
    document.documentElement.style.setProperty('--rd2',  `rgba(${r(t.a)},${g(t.a)},${b(t.a)},.22)`);
    _activeTheme = key; localStorage.setItem('fx_theme', key);
  }

  function _injectThemePanel() {
    if (document.getElementById('fx-theme-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'fx-theme-bar';
    bar.innerHTML = `
      <div class="fx-th-lbl">Accent Color</div>
      <div class="fx-swatches">
        ${THEMES.map(t => `<div class="fx-sw${t.key === _activeTheme ? ' active' : ''}"
          data-k="${t.key}" style="background:${t.a}" title="${t.key}"></div>`).join('')}
      </div>
      <div class="fx-th-row">
        <span class="fx-th-rlbl">High Contrast</span>
        <div class="fx-tog" id="fx-tog-contrast" onclick="FX.toggleContrast()"></div>
      </div>
      <div class="fx-th-row">
        <span class="fx-th-rlbl">Reduce Motion</span>
        <div class="fx-tog" id="fx-tog-motion" onclick="FX.toggleMotion()"></div>
      </div>`;
    document.body.appendChild(bar);
    _applyTheme(_activeTheme);
    bar.querySelectorAll('.fx-sw').forEach(sw => {
      sw.addEventListener('click', () => {
        _applyTheme(sw.dataset.k);
        bar.querySelectorAll('.fx-sw').forEach(x => x.classList.remove('active'));
        sw.classList.add('active');
      });
    });
  }

  function _injectThemeBtn() {
    const acts = document.querySelector('.tb-acts');
    if (!acts || document.getElementById('fx-theme-tb-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'fx-theme-tb-btn'; btn.className = 'tb-btn';
    btn.innerHTML = '🎨'; btn.title = 'Theme & Appearance';
    btn.setAttribute('aria-label', 'Theme');
    btn.onclick = toggleThemeBar;
    acts.appendChild(btn);
  }

  function toggleThemeBar() {
    const bar = document.getElementById('fx-theme-bar');
    if (!bar) { _injectThemePanel(); document.getElementById('fx-theme-bar')?.classList.add('on'); return; }
    bar.classList.toggle('on');
  }

  function toggleContrast() {
    const t = document.getElementById('fx-tog-contrast'); if (!t) return;
    t.classList.toggle('on');
    const on = t.classList.contains('on');
    document.documentElement.style.setProperty('--tx2', on ? '#c8c8e0' : '#9494b8');
    document.documentElement.style.setProperty('--tx3', on ? '#7878a0' : '#4e4e70');
  }

  function toggleMotion() {
    const t = document.getElementById('fx-tog-motion'); if (!t) return;
    t.classList.toggle('on');
    const on = t.classList.contains('on');
    document.documentElement.style.setProperty('--ease',  on ? 'linear' : 'cubic-bezier(.16,1,.3,1)');
    document.documentElement.style.setProperty('--ease3', on ? 'linear' : 'cubic-bezier(.34,1.56,.64,1)');
  }

  document.addEventListener('click', e => {
    const bar = document.getElementById('fx-theme-bar');
    if (!bar?.classList.contains('on')) return;
    if (!e.target.closest('#fx-theme-bar') && !e.target.closest('#fx-theme-tb-btn'))
      bar.classList.remove('on');
  });

  /* ══════════════════════════════════════════════════════════════
     7. WATCH PARTY VOTING
  ══════════════════════════════════════════════════════════════ */
  let _voteAttached = false;

  function _injectVoteUI() {
    const cp = document.getElementById('chatPanel');
    if (!cp || document.getElementById('wt-vote-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'wt-vote-panel';
    panel.innerHTML = `
      <div class="fx-th-lbl" style="margin-bottom:7px">📊 Room Poll</div>
      <div id="wt-vote-content">
        <div style="color:#4e4e70;font-size:.74rem;font-style:italic">No active poll</div>
      </div>
      <div id="wt-vote-create-area" style="display:none;margin-top:8px">
        <div class="fx-th-lbl" style="margin-bottom:5px">Create Poll</div>
        <input class="wt-create-inp" id="wt-v-q" placeholder="Ask the room something…" maxlength="60">
        <div id="wt-v-opts">
          <input class="wt-create-inp wt-v-o" placeholder="Option 1" maxlength="40">
          <input class="wt-create-inp wt-v-o" placeholder="Option 2" maxlength="40">
        </div>
        <div style="display:flex;gap:5px;margin-top:3px">
          <button class="wt-vbtn" style="flex:1" onclick="FX.startVote()">▶ Start</button>
          <button class="wt-vbtn ghost" onclick="FX.addVoteOpt()">+ Option</button>
        </div>
      </div>`;
    // Insert before the reply bar or at end
    const replyBar = cp.querySelector('#wt-reply-bar') || cp.querySelector('#wt-typing');
    replyBar ? cp.insertBefore(panel, replyBar) : cp.appendChild(panel);
  }

  function _showVotePanel() {
    _injectVoteUI();
    const p = document.getElementById('wt-vote-panel');
    if (p) p.classList.add('on');
    const create = document.getElementById('wt-vote-create-area');
    if (create) create.style.display = window._WT?.isHost ? 'block' : 'none';
  }

  function addVoteOpt() {
    const container = document.getElementById('wt-v-opts'); if (!container) return;
    const cur = container.querySelectorAll('.wt-v-o').length;
    if (cur >= 5) { if (typeof showToast === 'function') showToast('Max 5 options', '⚠️'); return; }
    const inp = document.createElement('input');
    inp.className = 'wt-create-inp wt-v-o'; inp.placeholder = `Option ${cur + 1}`; inp.maxLength = 40;
    container.appendChild(inp);
  }

  async function startVote() {
    const db = window._WT?.db, room = window._WT?.roomCode;
    if (!db || !room) { if (typeof showToast === 'function') showToast('Join a room first', '⚠️'); return; }
    const q = document.getElementById('wt-v-q')?.value.trim();
    if (!q) { if (typeof showToast === 'function') showToast('Enter a question', '⚠️'); return; }
    const opts = [...document.querySelectorAll('.wt-v-o')].map(i => i.value.trim()).filter(Boolean);
    if (opts.length < 2) { if (typeof showToast === 'function') showToast('Need at least 2 options', '⚠️'); return; }
    await db.ref(`rooms/${room}/poll`).set({ question: q, options: opts, votes: {}, active: true, ts: Date.now() });
    if (typeof showToast === 'function') showToast('Poll started! 📊', '📊', 2000);
  }

  function _subscribePoll(room) {
    const db = window._WT?.db;
    if (!db || _voteAttached) return;
    _voteAttached = true;
    db.ref(`rooms/${room}/poll`).on('value', snap => {
      if (!snap.exists()) return;
      _renderPoll(snap.val());
    });
  }

  async function castVote(idx) {
    const db = window._WT?.db, room = window._WT?.roomCode, uid = window._WT?.userId;
    if (!db || !room || !uid) return;
    await db.ref(`rooms/${room}/poll/votes/${uid}`).set(idx);
  }

  function _renderPoll(poll) {
    _injectVoteUI();
    const content = document.getElementById('wt-vote-content'); if (!content || !poll?.active) return;
    document.getElementById('wt-vote-panel')?.classList.add('on');
    const votes = poll.votes || {};
    const totals = (poll.options || []).map((_, i) => Object.values(votes).filter(v => v === i).length);
    const total = Math.max(totals.reduce((a, b) => a + b, 0), 1);
    const myVote = votes[window._WT?.userId];
    content.innerHTML = `
      <div class="wt-vq">${poll.question}</div>
      ${(poll.options || []).map((opt, i) => {
        const pct = Math.round((totals[i] / total) * 100);
        return `<div class="wt-vo${myVote === i ? ' voted' : ''}" onclick="FX.castVote(${i})">
          <div class="wt-vo-bar" style="width:${pct}%"></div>
          <div class="wt-vo-row"><span>${opt}</span><span class="wt-vo-pct">${pct}%</span></div>
        </div>`;
      }).join('')}
      <div style="font-size:.63rem;color:#4e4e70;margin-top:4px">${Object.keys(votes).length} vote(s)</div>
      ${window._WT?.isHost ? `<button class="wt-vbtn ghost" style="margin-top:6px;width:100%" onclick="FX.endVote()">End Poll</button>` : ''}`;
  }

  async function endVote() {
    const db = window._WT?.db, room = window._WT?.roomCode;
    if (!db || !room) return;
    await db.ref(`rooms/${room}/poll`).update({ active: false });
    const c = document.getElementById('wt-vote-content');
    if (c) c.innerHTML = '<div style="color:#4e4e70;font-size:.74rem;font-style:italic">Poll ended</div>';
  }

  // Polling interval to attach vote listener when room becomes active
  setInterval(() => {
    const wt = window._WT;
    if (!wt?.roomCode) return;
    if (!_voteAttached) _subscribePoll(wt.roomCode);
    _showVotePanel();
  }, 1500);

  /* ══════════════════════════════════════════════════════════════
     8. QR CODE ROOM INVITE
  ══════════════════════════════════════════════════════════════ */
  function _injectQRModal() {
    if (document.getElementById('fx-qr-modal')) return;
    const d = document.createElement('div');
    d.id = 'fx-qr-modal';
    d.innerHTML = `<div id="fx-qr-box">
      <h3>📱 Scan to Join Room</h3>
      <p>Share this QR code with friends — they'll jump right in!</p>
      <img id="fx-qr-img" alt="QR Code">
      <div id="fx-qr-code-val">—</div>
      <div class="fx-qr-acts">
        <button class="primary" onclick="FX.downloadQR()">⬇ Save Image</button>
        <button class="ghost"   onclick="FX.closeQR()">✕ Close</button>
      </div>
    </div>`;
    document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d) FX.closeQR(); });
  }

  function openQR(roomCode) {
    _injectQRModal();
    const modal  = document.getElementById('fx-qr-modal');
    const img    = document.getElementById('fx-qr-img');
    const codeEl = document.getElementById('fx-qr-code-val');
    if (!modal || !img) return;
    const url = `${location.origin}${location.pathname}?room=${roomCode}`;
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=336x336&bgcolor=ffffff&color=0e0e18&data=${encodeURIComponent(url)}`;
    if (codeEl) codeEl.textContent = roomCode;
    modal.classList.add('on');
  }

  function closeQR() { document.getElementById('fx-qr-modal')?.classList.remove('on'); }

  function downloadQR() {
    const img = document.getElementById('fx-qr-img'); if (!img) return;
    const a = document.createElement('a');
    a.href = img.src; a.download = 'flixora-room-qr.png'; a.target = '_blank'; a.click();
  }

  function _injectQRButton() {
    const created = document.getElementById('wtCreated'); if (!created) return;
    const acts = created.querySelector('.rc-acts');
    if (!acts || document.getElementById('fx-qr-wt-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'fx-qr-wt-btn'; btn.className = 'btn-ghost';
    btn.style.cssText = 'justify-content:center;flex:1';
    btn.innerHTML = '📱 QR';
    btn.onclick = () => {
      const code = document.getElementById('roomCodeDisplay')?.textContent;
      if (code && code.length > 3) openQR(code);
    };
    acts.appendChild(btn);
  }

  // Observe the WT modal so we inject the QR button whenever it becomes visible
  const _qrObs = new MutationObserver(() => _injectQRButton());
  const _wtMenu = document.getElementById('watchTogetherMenu');
  if (_wtMenu) _qrObs.observe(_wtMenu, { childList: true, subtree: true, attributes: true });

  /* ══════════════════════════════════════════════════════════════
     9. FLOATING REACTIONS (TikTok Live style)
  ══════════════════════════════════════════════════════════════ */
  const REACT_EMOJIS = ['❤️','🔥','😂','😮','👏','🎬','⭐','💯','😍','🤩','🥳','🫶'];

  function _injectFloatReactions() {
    // Reaction bar removed — floating emoji overlay kept for remote reactions only
    const pv = document.getElementById('playerVideo');
    if (!pv || document.getElementById('fx-float-ov')) return;
    const ov = document.createElement('div'); ov.id = 'fx-float-ov'; pv.appendChild(ov);
  }

  function floatEmoji(emoji, fromRemote) {
    const ov = document.getElementById('fx-float-ov'); if (!ov) return;
    const el = document.createElement('div');
    el.className = 'fx-fe';
    el.textContent = emoji;
    el.style.left = (8 + Math.random() * 74) + '%';
    el.style.setProperty('--rot', ((Math.random() - .5) * 36) + 'deg');
    el.style.setProperty('--dur', (2 + Math.random() * 1.2) + 's');
    ov.appendChild(el);
    el.addEventListener('animationend', () => el.remove());

    // Broadcast to room (only for local clicks, not remote)
    if (!fromRemote) {
      const db = window._WT?.db, room = window._WT?.roomCode;
      if (db && room) {
        db.ref(`rooms/${room}/live_reactions`).push({ e: emoji, uid: window._WT?.userId, ts: Date.now() });
      }
    }
  }

  let _floatAttached = false;
  function _startFloatListener() {
    const db = window._WT?.db, room = window._WT?.roomCode;
    if (!db || !room || _floatAttached) return;
    _floatAttached = true;
    db.ref(`rooms/${room}/live_reactions`).orderByChild('ts').limitToLast(1)
      .on('child_added', snap => {
        const d = snap.val();
        if (d && d.uid !== window._WT?.userId) floatEmoji(d.e, true);
      });
  }

  setInterval(() => {
    if (!_floatAttached && window._WT?.roomCode) _startFloatListener();
  }, 2000);

  /* ══════════════════════════════════════════════════════════════
     PATCH playById — connect all features
  ══════════════════════════════════════════════════════════════ */
  function _patch() {
    const orig = window.playById;
    if (!orig || orig._fxPatched) return;
    window.playById = async function (tmdbId, type, title, year) {
      await orig(tmdbId, type, title, year);
      // Give the player modal time to render, then inject feature UI
      setTimeout(() => {
        _addTrailerBtn();
        _injectFloatReactions();
        _loadDetails(String(tmdbId), type || 'movie');
      }, 300);
    };
    window.playById._fxPatched = true;
    window.playContentById = window.playById;
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════════ */
  window.FX = {
    openTrailer, closeTrailer,
    surpriseMe,
    toggleThemeBar, toggleContrast, toggleMotion,
    openQR, closeQR, downloadQR,
    floatEmoji,
    startVote, addVoteOpt, castVote, endVote,
  };

  /* ══════════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════════ */
  function _boot() {
    _injectCSS();
    _injectSurpriseBtn();
    _injectLangBar();
    _injectThemeBtn();
    _injectThemePanel();
    _injectTrailerModal();
    _injectQRButton();
    _patch();
    // Re-patch after other scripts may have wrapped playById
    setTimeout(_patch, 600);
    setTimeout(_patch, 2000);

    console.log('%c✅ Flixora Features Pack v1.0', 'color:#818cf8;font-weight:bold;font-size:12px');
    console.log('%c  🎬 Trailer  📝 Details  🔁 Related  🎲 Surprise Me  🌍 Language Filter', 'color:#6ec6ff;font-size:.82em');
    console.log('%c  🌙 Theme Switcher  🗳️ Vote  🎭 QR Code  📱 Floating Reactions', 'color:#a8e6cf;font-size:.82em');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

})();
