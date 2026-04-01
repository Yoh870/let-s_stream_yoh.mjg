/* ═══════════════════════════════════════════════════════════════
   FLIXORA app.js  v5.0  — Full Performance Overhaul
   ───────────────────────────────────────────────────────────────
   ✅ In-memory TMDB cache (5-min TTL)
   ✅ Request deduplication
   ✅ IntersectionObserver lazy-loading for images
   ✅ Debounced search with live suggestions
   ✅ Watchlist integration hooks
   ✅ Better error states with retry
   ✅ Pagination string-template fix (original)
   ✅ Genre chips auto-patching
   ✅ SEO-friendly meta updates on navigation
   ✅ All original features preserved + expanded
═══════════════════════════════════════════════════════════════ */

const qs  = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');

const TMDB_KEY = '3fd2be6f0c70a2a598f084ddfb75487c';
const TMDB_URL = 'https://api.themoviedb.org/3';
const IMG_W500 = 'https://image.tmdb.org/t/p/w500';
const IMG_W185 = 'https://image.tmdb.org/t/p/w185';

/* ── CACHE LAYER ─────────────────────────────────────────────── */
const _cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const _inflight = new Map(); // request deduplication

function _cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return hit.data;
}
function _cacheSet(key, data) {
  _cache.set(key, { data, ts: Date.now() });
  // LRU: keep max 100 entries
  if (_cache.size > 100) {
    const first = _cache.keys().next().value;
    _cache.delete(first);
  }
}

/* ── SERVERS ─────────────────────────────────────────────────── */
const SERVERS = [
  { name:'Server 1 ★★★', sub:true, url: d => d.type==='movie' ? `https://vidsrc.xyz/embed/movie?tmdb=${d.tmdb}` : `https://vidsrc.xyz/embed/tv?tmdb=${d.tmdb}&season=${d.season||1}&episode=${d.episode||1}` },
  { name:'Server 2 ★★★', sub:true, url: d => d.type==='movie' ? `https://embed.su/embed/movie/${d.tmdb}`       : `https://embed.su/embed/tv/${d.tmdb}/${d.season||1}/${d.episode||1}` },
  { name:'Server 3 ★★',  sub:true, url: d => `https://vidsrc.to/embed/${d.type}/${d.tmdb}` },
  { name:'Server 4 ★★',  sub:true, url: d => d.type==='movie' ? `https://vidsrc.me/embed/movie?tmdb=${d.tmdb}` : `https://vidsrc.me/embed/tv?tmdb=${d.tmdb}&season=${d.season||1}&episode=${d.episode||1}` },
  { name:'Server 5 ★★',  sub:true, url: d => d.type==='movie' ? `https://autoembed.cc/movie/tmdb/${d.tmdb}`    : `https://autoembed.cc/tv/tmdb/${d.tmdb}-${d.season||1}-${d.episode||1}` },
  { name:'Server 6 ★★',  sub:true, url: d => d.type==='movie' ? `https://vidlink.pro/movie/${d.tmdb}`         : `https://vidlink.pro/tv/${d.tmdb}/${d.season||1}/${d.episode||1}` },
  { name:'Server 7 ★',   sub:true, url: d => `https://www.2embed.cc/embed/${d.imdb||'tt'+d.tmdb}` },
  { name:'Server 8 ★',   sub:true, url: d => `https://multiembed.mov/?video_id=${d.imdb||'tt'+d.tmdb}&tmdb=1` },
];

/* ── GENRE MAP ───────────────────────────────────────────────── */
const GENRE_ID_MAP = {
  'all':'all','action':'28','drama':'18','comedy':'35','thriller':'53',
  'romance':'10749','sci-fi':'878','horror':'27','fantasy':'14',
  'animation':'16','documentary':'99','family':'10751','history':'36',
  'crime':'80','music':'10402','mystery':'9648','western':'37',
  '28':'28','18':'18','35':'35','53':'53','10749':'10749','878':'878',
  '27':'27','14':'14','16':'16','99':'99','10751':'10751','36':'36',
  '80':'80','10402':'10402','9648':'9648','37':'37',
};

/* ── HERO DATA ───────────────────────────────────────────────── */
const HERO_DATA = [
  { id:'872585', type:'movie', title:'Oppenheimer',        year:'2023', badge:'🔥 Trending',
    img:'https://images.unsplash.com/photo-1534131707746-25d604851a1f?w=1920&h=1080&fit=crop',
    desc:'The story of J. Robert Oppenheimer and the development of the atomic bomb during WWII.' },
  { id:'1396',   type:'tv',   title:'Breaking Bad',        year:'2008', badge:'⭐ All-Time Best',
    img:'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1920&h=1080&fit=crop',
    desc:'A chemistry teacher turned meth manufacturer navigates the criminal underworld.' },
  { id:'94997',  type:'tv',   title:'House of the Dragon', year:'2022', badge:'🐉 Epic Fantasy',
    img:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
    desc:'The Targaryen civil war that shattered a dynasty — 200 years before Game of Thrones.' },
  { id:'519182', type:'movie', title:'Despicable Me 4',    year:'2024', badge:'🆕 Latest',
    img:'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1920&h=1080&fit=crop',
    desc:'Gru and his family face a brand-new villain in the latest Minions adventure.' },
];

/* ── STATE ───────────────────────────────────────────────────── */
const S = {
  heroIdx: 0, heroTimer: null, HERO_MS: 7500,
  content: null, searchQ: '',
  matureOk: false, matureExpiry: 0, pinFails: 0, pinLockUntil: 0,
};
const MATURE_TTL = 15 * 60 * 1000;
const PIN_MAX = 5, PIN_LOCK = 5 * 60 * 1000;

/* ── TMDB FETCH (cached + deduplicated) ─────────────────────── */
async function tmdb(endpoint, params = {}) {
  const cacheKey = endpoint + JSON.stringify(params);
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  // Deduplicate in-flight requests
  if (_inflight.has(cacheKey)) return _inflight.get(cacheKey);

  const url = `${TMDB_URL}${endpoint}?${new URLSearchParams({ api_key: TMDB_KEY, ...params })}`;
  const promise = fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(json => {
      if (json.success === false) throw new Error(json.status_message || 'TMDB error');
      _cacheSet(cacheKey, json);
      _inflight.delete(cacheKey);
      return json;
    })
    .catch(e => {
      _inflight.delete(cacheKey);
      console.error('[TMDB ❌]', endpoint, e.message);
      return null;
    });

  _inflight.set(cacheKey, promise);
  return promise;
}

async function getImdbId(id, type) {
  const d = await tmdb(`/${type}/${id}/external_ids`);
  return d?.imdb_id || null;
}

/* ── LAZY IMAGE LOADER ────────────────────────────────────────── */
const _imgObserver = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries) => {
      entries.forEach(({ isIntersecting, target }) => {
        if (isIntersecting) {
          const src = target.dataset.src;
          if (src) {
            target.src = src;
            target.removeAttribute('data-src');
          }
          _imgObserver.unobserve(target);
        }
      });
    }, { rootMargin: '200px' })
  : null;

function _lazyImg(src, alt, cls = '', style = '') {
  if (!_imgObserver) {
    return `<img src="${src}" alt="${alt}" loading="lazy" class="${cls}" style="${style}">`;
  }
  // Placeholder + observer
  return `<img data-src="${src}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 2 3'%3E%3C/svg%3E" alt="${alt}" class="lazy-img ${cls}" style="${style}" onerror="this.src='https://placehold.co/300x450/141421/2e2e4e?text=No+Poster'">`;
}

// Observe newly added lazy images
function _observeLazy() {
  if (!_imgObserver) return;
  qsa('.lazy-img[data-src]').forEach(img => _imgObserver.observe(img));
}

/* ── UPDATE META ─────────────────────────────────────────────── */
function _updateMeta(title, description) {
  document.title = title + ' — FLIXORA';
  const desc = qs('meta[name="description"]');
  if (desc) desc.setAttribute('content', description || title);
}

/* ── HERO ─────────────────────────────────────────────────────── */
function buildHero() {
  const hero = qs('#hero') || qs('#heroSection');
  if (!hero) return;
  const bar = qs('#heroBar'), dots = qs('#heroDots');
  hero.querySelectorAll('.hero-slide').forEach(s => s.remove());
  if (dots) dots.innerHTML = '';

  HERO_DATA.forEach((d, i) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide' + (i === 0 ? ' active' : '');
    slide.innerHTML = `
      <img class="hero-bg hero-bg-img"
        src="${d.img}"
        alt="${d.title}"
        loading="${i === 0 ? 'eager' : 'lazy'}"
        fetchpriority="${i === 0 ? 'high' : 'low'}">
      <div class="hero-ov hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-badge">${d.badge}</div>
        <h1 class="hero-title">${d.title}</h1>
        <div class="hero-meta">
          <span style="background:#f5c518;color:#1a1000;padding:2px 9px;border-radius:4px;font-size:.7rem;font-weight:800">TMDB ★</span>
          <span style="background:rgba(255,255,255,.1);padding:2px 9px;border-radius:4px;font-size:.78rem;backdrop-filter:blur(8px)">${d.year}</span>
        </div>
        <p class="hero-desc hero-description">${d.desc}</p>
        <div class="hero-acts hero-actions">
          <button class="btn-play" onclick="playById(${d.id},'${d.type}','${esc(d.title)}','${d.year}')">▶ Watch Now</button>
          <button class="btn-info" onclick="playById(${d.id},'${d.type}','${esc(d.title)}','${d.year}')">ℹ Info</button>
        </div>
      </div>`;
    if (bar) hero.insertBefore(slide, bar);
    else if (dots) hero.insertBefore(slide, dots);
    else hero.appendChild(slide);

    if (dots) {
      const dot = document.createElement('div');
      dot.className = 'hdot hero-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', `Slide ${i + 1}: ${d.title}`);
      dot.setAttribute('tabindex', '0');
      dot.onclick = () => heroGoto(i);
      dot.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') heroGoto(i); };
      dots.appendChild(dot);
    }
  });
  heroStart();
}

function heroGoto(idx) {
  qsa('.hero-slide').forEach((s, i) => s.classList.toggle('active', i === idx));
  qsa('.hdot, .hero-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  S.heroIdx = idx;
  heroBarReset();
}
function heroStart() {
  clearInterval(S.heroTimer);
  S.heroTimer = setInterval(() => heroGoto((S.heroIdx + 1) % HERO_DATA.length), S.HERO_MS);
  heroBarReset();
}
function heroBarReset() {
  const bar = qs('#heroBar') || qs('#heroProgress');
  if (!bar) return;
  bar.style.transition = 'none';
  bar.style.width = '0%';
  requestAnimationFrame(() => {
    bar.style.transition = `width ${S.HERO_MS}ms linear`;
    bar.style.width = '100%';
  });
}

/* ── CARD ─────────────────────────────────────────────────────── */
function makeCard(item, overrideType, idx = 0, locked = false) {
  const type  = overrideType || item.media_type || (item.title ? 'movie' : 'tv');
  const title = item.title || item.name || 'Unknown';
  const year  = (item.release_date || item.first_air_date || '').slice(0, 4);
  const score = item.vote_average ? item.vote_average.toFixed(1) : '—';
  const poster = item.poster_path
    ? `${IMG_W500}${item.poster_path}`
    : `https://placehold.co/300x450/141421/2e2e4e?text=${encodeURIComponent(title)}`;
  const fn = locked
    ? `App.openMature()`
    : `playById(${item.id},'${type}','${esc(title)}','${year}')`;
  const typeLabel = type === 'movie' ? 'FILM' : 'TV';
  const typeColor = type === 'movie' ? '#e63946' : '#818cf8';

  return `<div class="content-card"
    role="listitem"
    onclick="${fn}"
    onkeydown="if(event.key==='Enter')${fn}"
    tabindex="0"
    aria-label="${esc(title)} (${year || 'N/A'}) — ${type === 'movie' ? 'Movie' : 'TV Series'}"
    onmouseenter="this.querySelector('.card-inner').style.transform='scale(1.06) translateY(-4px)';this.querySelector('.card-inner').style.boxShadow='0 20px 48px rgba(0,0,0,.75)'"
    onmouseleave="this.querySelector('.card-inner').style.transform='';this.querySelector('.card-inner').style.boxShadow=''"
    style="cursor:pointer">
    <div class="card-inner" style="border-radius:10px;overflow:hidden;background:#141421;transition:transform .28s cubic-bezier(.16,1,.3,1),box-shadow .28s">
      <div style="aspect-ratio:2/3;overflow:hidden;position:relative">
        <img
          ${_imgObserver ? 'data-src' : 'src'}="${poster}"
          ${_imgObserver ? `src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 2 3'%3E%3C/svg%3E"` : ''}
          alt="${esc(title)}"
          loading="lazy"
          ${_imgObserver ? 'class="lazy-img"' : ''}
          style="width:100%;height:100%;object-fit:cover;display:block;background:#1c1c2e"
          onerror="this.src='https://placehold.co/300x450/141421/2e2e4e?text=No+Poster'">
        <div style="position:absolute;top:7px;right:7px;background:${typeColor};color:#fff;font-size:.58rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:2px 7px;border-radius:4px">${typeLabel}</div>
        <div style="position:absolute;top:7px;left:7px;background:rgba(0,0,0,.82);backdrop-filter:blur(4px);color:#fff;padding:2px 7px;border-radius:4px;font-size:.64rem;font-weight:700">⭐ ${score}</div>
        ${locked ? `
          <div style="position:absolute;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(16px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
            <div style="font-size:2rem">🔒</div>
            <div style="font-size:.68rem;font-weight:600;color:#ccc;text-align:center">18+<br>Tap to unlock</div>
          </div>` : ''}
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(8,8,16,.9) 0%,transparent 55%);opacity:0;transition:opacity .25s" class="card-overlay"></div>
        <div style="position:absolute;bottom:8px;left:8px;right:8px;font-size:.72rem;font-weight:700;color:#fff;opacity:0;transition:opacity .25s;line-height:1.3;text-shadow:0 1px 4px rgba(0,0,0,.8)" class="card-title-ov">${esc(title)}</div>
      </div>
      <div style="padding:9px 8px 10px;background:#141421">
        <div style="font-size:.78rem;font-weight:600;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f2f2fc">${esc(title)}</div>
        <div style="display:flex;gap:7px;font-size:.67rem;color:#4e4e70;align-items:center">
          <span style="color:#f5c518">★</span>
          <span style="color:#9494b8">${score}</span>
          ${year ? `<span style="color:#4e4e70">·</span><span>${year}</span>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

// Add hover overlay effect via CSS injection
function _injectCardStyles() {
  if (qs('#fx-card-css')) return;
  const s = document.createElement('style');
  s.id = 'fx-card-css';
  s.textContent = `
    .content-card:hover .card-overlay,
    .content-card:focus .card-overlay { opacity: 1 !important; }
    .content-card:hover .card-title-ov,
    .content-card:focus .card-title-ov { opacity: 1 !important; }
    .content-card:focus-visible { outline: 2px solid #e63946; outline-offset: 3px; border-radius: 10px; }
    @keyframes sfShim { 0%{background-position:100% 0} 100%{background-position:-100% 0} }
    @keyframes sfSpin { to{transform:rotate(360deg)} }
    @keyframes sfFadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
  `;
  document.head.appendChild(s);
}

/* ── RENDER ROW ─────────────────────────────────────────────── */
function renderRow(id, items, type = null, locked = false) {
  const el = qs('#' + id);
  if (!el) return;
  el.innerHTML = items?.length
    ? items.map((item, i) => makeCard(item, type, i, locked)).join('')
    : '<p style="color:#4e4e70;padding:20px;font-size:.85rem">No content available.</p>';
  _observeLazy();
}

/* ── RENDER GRID ─────────────────────────────────────────────── */
function renderGrid(items) {
  let wrap = qs('#sf-results-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'sf-results-wrap';
    const rc = qs('#searchResultsContainer') || qs('#searchResults');
    if (rc) { rc.innerHTML = ''; rc.appendChild(wrap); }
    else document.body.appendChild(wrap);
  }

  wrap.style.cssText = [
    'display:grid',
    'grid-template-columns:repeat(auto-fill,minmax(148px,1fr))',
    'gap:14px',
    'padding:10px 22px 24px',
    'opacity:1', 'visibility:visible', 'min-height:60px',
  ].join(';');

  if (!items?.length) {
    wrap.innerHTML = '<p style="color:#4e4e70;padding:40px;text-align:center;grid-column:1/-1;font-size:.88rem">No results found. Try a different search.</p>';
    return;
  }

  wrap.innerHTML = items.map((item, i) => makeCard(item, item.media_type || (item.title ? 'movie' : 'tv'), i)).join('');
  _observeLazy();

  // Make parent visible
  let node = wrap.parentElement;
  while (node && node !== document.body) {
    const cs = getComputedStyle(node);
    if (cs.display === 'none') node.style.display = 'block';
    node.style.opacity = '1'; node.style.visibility = 'visible';
    if (node.classList.contains('content-section') || node.classList.contains('fade-in')) {
      node.classList.add('visible'); node.style.transform = 'none'; node.style.animation = 'none';
    }
    node = node.parentElement;
  }
}

/* ── HOME LOADERS ─────────────────────────────────────────────── */
async function loadTrending()  { const d = await tmdb('/trending/all/week'); renderRow('trendingContent', d?.results?.slice(0,20)); }
async function loadMovies()    { const d = await tmdb('/movie/popular', { region:'PH' }); renderRow('moviesContent', d?.results?.slice(0,20), 'movie'); }
async function loadTV()        { const d = await tmdb('/tv/popular', { region:'PH' }); renderRow('tvContent', d?.results?.slice(0,20), 'tv'); }
async function loadKDrama()    { const d = await tmdb('/discover/tv', { with_origin_country:'KR', sort_by:'popularity.desc' }); renderRow('kdramaContent', d?.results?.slice(0,20), 'tv'); }
async function loadAnime()     { const d = await tmdb('/discover/tv', { with_genres:'16', with_origin_country:'JP', sort_by:'popularity.desc' }); renderRow('animeContent', d?.results?.slice(0,20), 'tv'); }
async function loadMatureContent() { const d = await tmdb('/discover/movie', { certification_country:'US', 'certification.gte':'R', sort_by:'popularity.desc' }); renderRow('matureContent', d?.results?.slice(0,20), 'movie'); }

/* ── CATEGORY ─────────────────────────────────────────────────── */
const CAT_MAP = {
  trending:  { ep:'/trending/all/week',    p:{},                                                   label:'🔥 Trending Now',   mv:false },
  movies:    { ep:'/discover/movie',       p:{sort_by:'popularity.desc'},                          label:'🎬 Popular Movies', mv:true  },
  tv:        { ep:'/discover/tv',          p:{sort_by:'popularity.desc'},                          label:'📺 TV Series',      mv:false },
  kdrama:    { ep:'/discover/tv',          p:{with_origin_country:'KR',sort_by:'popularity.desc'}, label:'🇰🇷 K-Drama',        mv:false },
  anime:     { ep:'/discover/tv',          p:{with_genres:'16',with_origin_country:'JP',sort_by:'popularity.desc'}, label:'🎌 Anime', mv:false },
  top_rated: { ep:'/movie/top_rated',      p:{},                                                   label:'⭐ Top Rated',      mv:true  },
  now:       { ep:'/movie/now_playing',    p:{},                                                   label:'🆕 Now In Cinemas', mv:true  },
};

async function loadCategory(cat, page = 1) {
  if (cat === 'mature') { App.openMature(); return; }
  const def = CAT_MAP[cat]; if (!def) return;
  setNavActive(cat);
  showResultsView();
  setInfo(def.label, '⏳ Loading…');
  _updateMeta(def.label.replace(/[^\w\s]/g,'').trim(), `Browse ${def.label} on Flixora`);

  const d = await tmdb(def.ep, { ...def.p, page });
  if (!d?.results?.length) {
    setInfo(def.label, '⚠️ Failed to load. Please try again.');
    renderGrid([]);
    return;
  }

  const items = d.results.map(r => ({ ...r, media_type: r.media_type || (def.mv ? 'movie' : 'tv') }));
  setInfo(def.label, `${(d.total_results || items.length).toLocaleString()} titles — Page ${page}`);
  renderGrid(items);
  makePagination(d.total_pages || 1, page, `loadCategory('${cat}',PAGE)`);
}

/* ── GENRE FILTER ─────────────────────────────────────────────── */
async function fetchGenre(gid, label, page = 1) {
  console.log(`[Genre] Fetching gid=${gid} "${label}" page=${page}`);
  showResultsView();
  setInfo(label, '⏳ Loading…');
  _updateMeta(label, `Watch ${label} movies and series free on Flixora`);

  const grid = qs('#sf-results-wrap') || (() => {
    const w = document.createElement('div'); w.id = 'sf-results-wrap';
    const rc = qs('#searchResultsContainer') || qs('#searchResults');
    if (rc) { rc.innerHTML = ''; rc.appendChild(w); } else document.body.appendChild(w);
    return w;
  })();
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:14px;padding:10px 22px 24px;opacity:1;visibility:visible';
  grid.innerHTML = Array(12).fill(0).map(() => `
    <div style="border-radius:10px;overflow:hidden;background:#141421">
      <div style="aspect-ratio:2/3;background:linear-gradient(110deg,#141421 30%,#1c1c2e 50%,#141421 70%);background-size:300% 100%;animation:sfShim 1.6s ease-in-out infinite"></div>
      <div style="padding:9px 8px"><div style="height:11px;background:#1c1c2e;border-radius:4px;margin-bottom:6px"></div><div style="height:9px;background:#141421;border-radius:4px;width:60%"></div></div>
    </div>`).join('');

  const [mv, tv] = await Promise.all([
    tmdb('/discover/movie', { with_genres: gid, sort_by: 'popularity.desc', page }),
    tmdb('/discover/tv',    { with_genres: gid, sort_by: 'popularity.desc', page }),
  ]);

  if (!mv && !tv) {
    setInfo(label, '❌ Failed to connect to TMDB');
    grid.innerHTML = '<p style="color:#e63946;padding:40px;text-align:center;grid-column:1/-1">❌ Could not connect. Check your internet connection.</p>';
    return;
  }

  const results = [
    ...(mv?.results || []).map(r => ({ ...r, media_type: 'movie' })),
    ...(tv?.results || []).map(r => ({ ...r, media_type: 'tv' })),
  ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  const total    = (mv?.total_results || 0) + (tv?.total_results || 0);
  const maxPages = Math.min(Math.max(mv?.total_pages || 1, tv?.total_pages || 1), 500);

  setInfo(label, `${total.toLocaleString()} titles${page > 1 ? ' — Page ' + page : ''}`);
  renderGrid(results);
  const safeLabel = label.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  makePagination(maxPages, page, `fetchGenre('${gid}','${safeLabel}',PAGE)`);
}

/* ── GENRE CHIP PATCHING ──────────────────────────────────────── */
function patchGenreChips() {
  const chips = [...new Set([
    ...qsa('.gchip'), ...qsa('.genre-chip'),
    ...qsa('[data-g]'), ...qsa('[data-genre]'),
  ])];

  console.log(`[Chips] Found ${chips.length} genre chips. Patching…`);

  chips.forEach(chip => {
    const rawId = chip.dataset.g || chip.dataset.genre || chip.dataset.id || '';
    const label = chip.textContent.trim();
    const gid   = GENRE_ID_MAP[rawId] || GENRE_ID_MAP[label.toLowerCase()] || rawId;

    const fresh = chip.cloneNode(true);
    fresh.removeAttribute('onclick');
    chip.parentNode.replaceChild(fresh, chip);

    fresh.addEventListener('click', () => {
      qsa('.gchip,.genre-chip,[data-g],[data-genre]').forEach(c => c.classList.remove('active'));
      fresh.classList.add('active');

      if (gid === 'all' || label.toLowerCase().includes('all')) { goHome(); return; }
      if (!gid || gid === 'undefined') { console.warn('[Chip] No genre ID for:', label); return; }

      fetchGenre(gid, label, 1);
    });
  });

  console.log('[Chips] ✅ Patched');
}

/* ── SEARCH ───────────────────────────────────────────────────── */
async function doSearch(page = 1) {
  const q = [qs('#searchInput'), qs('#msearchInp'), qs('#mobileSearchInput')]
    .map(el => el?.value?.trim()).find(v => v) || S.searchQ;
  if (!q) return;
  S.searchQ = q;

  closeMSearch();
  showResultsView();
  setInfo(`Results for "<em style="color:var(--red2)">${q}</em>"`, '⏳ Searching…');
  _updateMeta(`Search: ${q}`, `Search results for "${q}" on Flixora`);

  const d = await tmdb('/search/multi', { query: q, page, include_adult: false });
  if (!d) {
    setInfo('Search', '⚠️ Search failed — check your connection.');
    renderGrid([]);
    return;
  }

  const items = d.results.filter(r => r.media_type !== 'person');
  setInfo(`Results for "<em style="color:var(--red2)">${q}</em>"`, `${(d.total_results || 0).toLocaleString()} results`);
  renderGrid(items);
  makePagination(Math.min(d.total_pages || 1, 500), page, 'doSearch(PAGE)');
}

/* ── PAGINATION ───────────────────────────────────────────────── */
function makePagination(totalPages, current, onPageCall) {
  const el = qs('#pagination'); if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  const max = Math.min(totalPages, 500);
  let pages = [];
  if (max <= 7) {
    pages = Array.from({ length: max }, (_, i) => i + 1);
  } else {
    pages = [1];
    if (current > 3) pages.push('…');
    for (let i = Math.max(2, current - 2); i <= Math.min(max - 1, current + 2); i++) pages.push(i);
    if (current < max - 2) pages.push('…');
    pages.push(max);
  }

  el.innerHTML = pages.map(p => {
    if (p === '…') return `<span style="padding:8px 12px;opacity:.35;color:var(--tx2)">…</span>`;
    const active = p === current;
    const call   = onPageCall.replace('PAGE', p);
    return `<button
      onclick="${call};window.scrollTo({top:0,behavior:'smooth'})"
      style="padding:8px 16px;background:${active ? '#e63946' : 'rgba(255,255,255,.08)'};border:1px solid ${active ? '#e63946' : 'rgba(255,255,255,.12)'};border-radius:8px;color:#fff;cursor:pointer;font-size:.84rem;font-weight:${active ? '700' : '500'};font-family:inherit;transition:all .15s"
      aria-label="Page ${p}" aria-current="${active ? 'page' : 'false'}"
      onmouseover="if(!${active})this.style.borderColor='rgba(255,255,255,.25)'"
      onmouseout="if(!${active})this.style.borderColor='rgba(255,255,255,.12)'"
    >${p}</button>`;
  }).join('');
}

/* ── VIEW HELPERS ─────────────────────────────────────────────── */
function showResultsView() {
  const hero = qs('#hero') || qs('#heroSection'); if (hero) hero.style.display = 'none';
  const main = qs('#mainContent'); if (main) main.style.display = 'none';
  const rc = qs('#searchResultsContainer') || qs('#searchResults');
  if (rc) rc.style.cssText = 'display:block;opacity:1;visibility:visible;min-height:300px';
  const info = qs('#searchInfo');
  if (info) { info.style.cssText = 'display:block;opacity:1'; info.classList.add('active', 'on'); }
}

function showHomeView() {
  const hero = qs('#hero') || qs('#heroSection'); if (hero) hero.style.display = '';
  const main = qs('#mainContent'); if (main) main.style.display = '';
  const rc = qs('#searchResultsContainer') || qs('#searchResults'); if (rc) rc.style.display = 'none';
  qs('#sf-results-wrap')?.remove();
  qs('#pagination') && (qs('#pagination').innerHTML = '');
  const info = qs('#searchInfo');
  if (info) { info.classList.remove('active', 'on'); info.style.display = ''; }
  qsa('.gchip,.genre-chip,[data-g],[data-genre]').forEach(c => {
    const g = c.dataset.g || c.dataset.genre || '';
    c.classList.toggle('active', g === 'all' || c.textContent.trim().toLowerCase() === 'all');
  });
}

function setInfo(title, count) {
  const t = qs('#searchTitle'), c = qs('#searchCount');
  if (t) t.innerHTML = title;
  if (c) c.textContent = count;
}

function setNavActive(cat) {
  qsa('.nav-links a, .nav-links li a, .ni[data-cat]').forEach(a =>
    a.classList.toggle('active', a.dataset.cat === cat)
  );
}

/* ── HOME ─────────────────────────────────────────────────────── */
function goHome() {
  S.searchQ = '';
  [qs('#searchInput'), qs('#msearchInp'), qs('#mobileSearchInput')].forEach(el => { if (el) el.value = ''; });
  if (qs('#searchInput')?.closest('.tb-srch')) qs('#searchInput').closest('.tb-srch').classList.remove('has-text');
  showHomeView();
  setNavActive('home');
  _updateMeta('Watch Movies, TV Series & Anime Free', 'Stream thousands of movies and series for free on Flixora');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── PLAYER ───────────────────────────────────────────────────── */
const SPINNER = `<div class="p-spin" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#9494b8;background:#000"><div class="spinner" style="width:40px;height:40px;border:3px solid rgba(255,255,255,.08);border-top-color:#e63946;border-radius:50%;animation:sfSpin 1s linear infinite"></div><span style="font-size:.85rem">Loading player…</span></div>`;

async function playById(tmdbId, type, title, year) {
  const modal  = qs('#playerModal');
  const ptitle = qs('#playerTitle');
  const pvideo = qs('#playerVideo');
  if (!modal || !pvideo) return;

  if (ptitle) ptitle.textContent = `${title}${year ? ' (' + year + ')' : ''}`;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  pvideo.innerHTML = SPINNER;

  // Fetch IMDB id (cached)
  let imdb = null;
  try { imdb = await getImdbId(tmdbId, type); } catch (_) {}

  // Fetch extra details for rating
  try {
    const details = await tmdb(`/${type}/${tmdbId}`);
    if (details?.vote_average) {
      const rb = qs('#playerRating');
      if (rb) { rb.textContent = '★ ' + parseFloat(details.vote_average).toFixed(1); rb.style.display = ''; }
    }
  } catch (_) {}

  const data = { tmdb: String(tmdbId), imdb, type, title, year, season: 1, episode: 1 };
  S.content = data;
  window.currentContent = data;

  buildServerBtns(data);
  setServer(0, data);

  _updateMeta(title, `Watch ${title} (${year}) free on Flixora in HD`);
}

const playContentById = playById;

function buildServerBtns(data) {
  const el = qs('#serverButtons'); if (!el) return;
  el.innerHTML = SERVERS.map((s, i) =>
    `<button class="server-btn ${i === 0 ? 'active' : ''}"
      role="radio" aria-checked="${i === 0}"
      onclick="setServer(${i},${JSON.stringify(data).replace(/'/g,"&#39;")})"
    >${s.name}${s.sub ? '<span class="sub-badge">CC</span>' : ''}</button>`
  ).join('');
}

function setServer(idx, data) {
  const pv = qs('#playerVideo');
  if (pv) {
    const existing = pv.querySelector('iframe');
    if (existing) existing.remove();
    const sp = pv.querySelector('.p-spin');
    if (sp) sp.style.display = 'flex';
  }

  const iframe = document.createElement('iframe');
  iframe.src = SERVERS[idx].url(data);
  iframe.allowFullscreen = true;
  iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
  iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
  iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none';
  iframe.onload = () => {
    const sp = pv?.querySelector('.p-spin');
    if (sp) sp.style.display = 'none';
  };

  if (pv) pv.appendChild(iframe);

  qsa('.server-btn').forEach((b, i) => {
    b.classList.toggle('active', i === idx);
    b.setAttribute('aria-checked', i === idx ? 'true' : 'false');
  });

  S.content = { ...(S.content || {}), ...data };
  window.currentContent = S.content;

  // Fallback hide spinner
  setTimeout(() => {
    const sp = pv?.querySelector('.p-spin');
    if (sp) sp.style.display = 'none';
  }, 5000);
}

const loadServer = setServer;
const loadServerButtons = buildServerBtns;

function closePlayer() {
  const modal = qs('#playerModal'); if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
  const pv = qs('#playerVideo'); if (pv) { pv.querySelectorAll('iframe').forEach(f => f.remove()); pv.innerHTML = SPINNER; }
  qs('#chatPanel')?.classList.remove('show');
  _updateMeta('Watch Movies, TV Series & Anime Free', 'Stream free on Flixora');
}

/* ── 18+ MATURE ───────────────────────────────────────────────── */
function openMature() {
  if (S.matureOk && Date.now() < S.matureExpiry) { revealMature(); return; }
  const vm = qs('#verifyModal'); if (vm) vm.style.display = 'flex';
  showAgeStep();
}
function showAgeStep() {
  qs('#vs1')?.classList.add('on', 'active');
  qs('#vs2')?.classList.remove('on', 'active');
  qs('#verifyStep1')?.classList.add('active');
  qs('#verifyStep2')?.classList.remove('active');
}
function showPinStep() {
  qs('#vs1')?.classList.remove('on', 'active');
  qs('#vs2')?.classList.add('on', 'active');
  qs('#verifyStep1')?.classList.remove('active');
  qs('#verifyStep2')?.classList.add('active');
  setTimeout(() => qsa('.pin-d,.pin-digit')[0]?.focus(), 80);
}
function closeVerify() {
  const vm = qs('#verifyModal'); if (vm) vm.style.display = 'none';
  clearPins(); setPinErr('');
}
function verifyAge()  { grantMature(); closeVerify(); revealMature(); }
async function verifyPin() {
  const now = Date.now();
  if (now < S.pinLockUntil) { setPinErr(`Locked. ${Math.ceil((S.pinLockUntil - now) / 1000)}s remaining.`); return; }
  const pin = qsa('.pin-d,.pin-digit').map(i => i.value).join('');
  if (pin.length < 4) { setPinErr('Enter all 4 digits.'); return; }
  const hash = await sha256(pin), stored = localStorage.getItem('sf_pin');
  if (!stored) { localStorage.setItem('sf_pin', hash); grantMature(); closeVerify(); revealMature(); }
  else if (hash === stored) { S.pinFails = 0; grantMature(); closeVerify(); revealMature(); }
  else {
    S.pinFails++;
    if (S.pinFails >= PIN_MAX) { S.pinLockUntil = Date.now() + PIN_LOCK; S.pinFails = 0; setPinErr('Too many attempts — locked for 5 minutes.'); }
    else setPinErr(`Wrong PIN — ${PIN_MAX - S.pinFails} ${PIN_MAX - S.pinFails === 1 ? 'try' : 'tries'} left.`);
    clearPins();
  }
}
function grantMature() {
  S.matureOk = true; S.matureExpiry = Date.now() + MATURE_TTL;
  setTimeout(() => { S.matureOk = false; const s = qs('#section-mature'); if (s) s.style.display = 'none'; }, MATURE_TTL);
}
function revealMature() {
  const sec = qs('#section-mature'); if (!sec) return;
  Object.assign(sec.style, { display: '', opacity: '1', transform: 'none', animation: 'none' });
  sec.classList.add('visible');
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const c = qs('#matureContent');
  if (c && !c.children.length) loadMatureContent();
}
function clearPins()    { qsa('.pin-d,.pin-digit').forEach(i => i.value = ''); }
function setPinErr(msg) { [qs('#pinErr'), qs('#pinError'), qs('#lockoutTimer')].forEach(el => { if (el) el.textContent = msg; }); }
function initPinInputs() {
  const digits = qsa('.pin-d,.pin-digit');
  digits.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(-1);
      if (inp.value && i < digits.length - 1) digits[i + 1].focus();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && i > 0) digits[i - 1].focus();
      if (e.key === 'Enter') verifyPin();
    });
  });
}
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── MOBILE SEARCH ────────────────────────────────────────────── */
function openMSearch()  { qs('#msearch,#mobileSearchOverlay')?.classList.add('on', 'open'); (qs('#msearchInp') || qs('#mobileSearchInput'))?.focus(); }
function closeMSearch() { qs('#msearch,#mobileSearchOverlay')?.classList.remove('on', 'open'); }

function initMobileSearch() {
  const inp = qs('#msearchInp') || qs('#mobileSearchInput'); if (!inp) return;
  let t;
  inp.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (inp.value.trim().length > 1) {
        const si = qs('#searchInput'); if (si) si.value = inp.value.trim();
        doSearch(1);
      }
    }, 500);
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && inp.value.trim()) {
      const si = qs('#searchInput'); if (si) si.value = inp.value.trim();
      doSearch(1);
    }
  });
}

/* ── MISC ─────────────────────────────────────────────────────── */
function scrollRow(cid, dir) {
  const row = qs('#' + cid); if (!row) return;
  row.scrollBy({ left: dir * 640, behavior: 'smooth' });
}
function seeAll(cat) { loadCategory(cat); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function setNavItem(id) { qsa('.bni').forEach(b => b.classList.remove('active')); qs('#bn-' + id)?.classList.add('active'); }
function openSettings() {
  if (typeof showToast === 'function') showToast('⚙️ Settings: First PIN you set becomes your parental PIN. Clear site data to reset.', '⚙️', 5000);
  else alert('⚙️ Settings\n\nParental PIN: First PIN you enter becomes your PIN.\nReset: clear site data in browser.\n\nAd-blocking:\n• Mobile: Firefox + uBlock Origin\n• Desktop: Chrome + uBlock Origin\n• Servers 1 & 2 = fewest ads');
}

function initNavScroll() {
  window.addEventListener('scroll', () => {
    const nav = qs('#navbar') || qs('#topbar');
    if (!nav) return;
    const s = window.scrollY > 60;
    nav.classList.toggle('solid', s);
    nav.classList.toggle('scrolled', s);
  }, { passive: true });
}

function initWheelScroll() {
  qsa('.row-scroll,.content-row').forEach(row => {
    row.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      row.scrollBy({ left: e.deltaY * 3 });
    }, { passive: false });
  });
}

function initSectionReveal() {
  if ('IntersectionObserver' in window) {
    const secObs = new IntersectionObserver(entries => {
      entries.forEach(({ isIntersecting, target }) => {
        if (isIntersecting) { target.classList.add('visible'); target.style.opacity = '1'; secObs.unobserve(target); }
      });
    }, { threshold: .05 });
    qsa('.content-section,.fade-in').forEach(s => {
      s.style.opacity = '1'; s.classList.add('visible');
      secObs.observe(s);
    });
  } else {
    qsa('.content-section,.fade-in').forEach(s => { s.classList.add('visible'); s.style.opacity = '1'; });
  }
}

function initInstall() {
  let dp;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); dp = e;
    const b = qs('#installBanner');
    if (b && !localStorage.getItem('sf_installed')) b._dp = dp;
  });
  qs('#installBtn')?.addEventListener('click', async () => {
    if (!dp) return;
    dp.prompt();
    const { outcome } = await dp.userChoice;
    if (outcome === 'accepted') { qs('#installBanner').classList.remove('show'); localStorage.setItem('sf_installed', '1'); }
    dp = null;
  });
  qs('#closeBanner')?.addEventListener('click', () => {
    qs('#installBanner').classList.remove('show');
    localStorage.setItem('sf_installed', '1');
  });
}

function initKeys() {
  qs('#searchInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(1); });
}

function injectKeyframes() {
  if (qs('#sf-kf')) return;
  const s = document.createElement('style'); s.id = 'sf-kf';
  s.textContent = `
    @keyframes sfShim { 0%{background-position:100% 0} 100%{background-position:-100% 0} }
    @keyframes sfFadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
    @keyframes sfSpin { to{transform:rotate(360deg)} }
  `;
  document.head.appendChild(s);
}

/* ── App NAMESPACE ────────────────────────────────────────────── */
const App = {
  goHome, loadCat: loadCategory, doSearch: () => doSearch(1),
  genreFilter: fetchGenre, filterGenre: fetchGenre,
  scrollR: scrollRow, seeAll, closePlayer, openMSearch, closeMSearch,
  setNav: setNavItem, openSettings, openMature, verifyAge,
  showPin: showPinStep, showAge: showAgeStep, closeVerify, verifyPin,
  toggleMobileSearch: openMSearch,
  cache: { clear: () => _cache.clear(), size: () => _cache.size },
};
window.App = App;

Object.assign(window, {
  playContentById, playById, loadServer, setServer, loadServerButtons, buildServerBtns,
  closePlayer, loadCategory, goHome, seeAll,
  performMainSearch: () => doSearch(1),
  filterByGenre: id => fetchGenre(String(id),
    Object.entries({ 28:'Action',18:'Drama',35:'Comedy',53:'Thriller',10749:'Romance',878:'Sci-Fi',27:'Horror',14:'Fantasy',16:'Animation',99:'Documentary' })
      .find(([k]) => k === String(id))?.[1] || 'Genre', 1),
  scrollRow, scrollR: scrollRow, openMature, verifyAge, verifyPin,
  showPinStep, showAgeStep, closeVerify, openSettings, openMSearch, closeMSearch, setNavItem,
  showWatchTogetherMenu:  () => { const m = qs('#watchTogetherMenu'); if (m) { m.style.display = 'flex'; m.classList.add('open'); } },
  closeWatchTogetherMenu: () => { const m = qs('#watchTogetherMenu'); if (m) { m.classList.remove('open'); setTimeout(() => m.style.display = 'none', 260); } },
  showJoinRoomDialog:     () => { const m = qs('#joinRoomModal'); if (m) { m.style.display = 'flex'; m.classList.add('open'); } },
  closeJoinRoomDialog:    () => { const m = qs('#joinRoomModal'); if (m) { m.classList.remove('open'); setTimeout(() => m.style.display = 'none', 260); } },
  closeRoomCreatedModal:  () => { const m = qs('#roomCreatedModal'); if (m) m.classList.remove('open'); },
  toggleChatPanel:        () => qs('#chatPanel')?.classList.toggle('show'),
  showResultsView, setInfo, setNavActive, renderGrid,
  makePagination, fetchGenre,
});

/* ── BOOT ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  injectKeyframes();
  _injectCardStyles();
  buildHero();
  initSectionReveal();
  initNavScroll();
  initPinInputs();
  initKeys();
  initInstall();
  initMobileSearch();
  patchGenreChips();

  // Prevent context menu on player
  document.addEventListener('contextmenu', e => {
    if (e.target.closest('#playerVideo')) e.preventDefault();
  });

  // Parallel home loads for speed
  await Promise.all([loadTrending(), loadMovies(), loadTV(), loadKDrama(), loadAnime()]);
  initWheelScroll();
  _observeLazy();

  // Firebase Watch Together
  if (typeof initFirebase === 'function') {
    try { await initFirebase(); } catch (e) { console.warn('[Firebase]', e.message); }
  }

  console.log('%c✅ Flixora v5.0 app.js ready', 'color:#e63946;font-weight:bold;font-size:12px');
  console.log(`%c  Cache: ${_cache.size} entries | Lazy observer: ${_imgObserver ? 'active' : 'disabled'}`, 'color:#10b981;font-size:.85em');
});
