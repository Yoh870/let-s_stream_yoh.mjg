/* ═══════════════════════════════════════════════════════════════════
   STREAMFLIX — app.js  (Updated v3.0)
   Fixes: genre chips, search, hero, latest content, App namespace
═══════════════════════════════════════════════════════════════════ */

/* ─── TMDB CONFIG ──────────────────────────────────────────────── */
const TMDB_API_KEY    = '3fd2be6f0c70a2a598f084ddfb75487c';
const TMDB_BASE_URL   = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMAGE_ORIG = 'https://image.tmdb.org/t/p/original';

/* ─── STREAMING SERVERS (ordered: fewest ads first) ────────────── */
/*
   These are the cleanest available free embed servers.
   Ads are controlled by the server operators, not us.
   BEST way to block them: use Firefox/Kiwi Browser with uBlock Origin.
   Servers are constantly changing — if one breaks, try the next.
*/
const servers = [
    {
        name: 'VidSrc.xyz ★★★',
        hasSubtitles: true,
        getUrl: (d) => d.type === 'movie'
            ? `https://vidsrc.xyz/embed/movie?tmdb=${d.tmdb}`
            : `https://vidsrc.xyz/embed/tv?tmdb=${d.tmdb}&season=${d.season||1}&episode=${d.episode||1}`
    },
    {
        name: 'Embed.su ★★★',
        hasSubtitles: true,
        getUrl: (d) => d.type === 'movie'
            ? `https://embed.su/embed/movie/${d.tmdb}`
            : `https://embed.su/embed/tv/${d.tmdb}/${d.season||1}/${d.episode||1}`
    },
    {
        name: 'VidSrc.to ★★',
        hasSubtitles: true,
        getUrl: (d) => `https://vidsrc.to/embed/${d.type}/${d.tmdb}`
    },
    {
        name: 'VidSrc.me ★★',
        hasSubtitles: true,
        getUrl: (d) => d.type === 'movie'
            ? `https://vidsrc.me/embed/movie?tmdb=${d.tmdb}`
            : `https://vidsrc.me/embed/tv?tmdb=${d.tmdb}&season=${d.season||1}&episode=${d.episode||1}`
    },
    {
        name: 'AutoEmbed ★★',
        hasSubtitles: true,
        getUrl: (d) => d.type === 'movie'
            ? `https://autoembed.cc/movie/tmdb/${d.tmdb}`
            : `https://autoembed.cc/tv/tmdb/${d.tmdb}-${d.season||1}-${d.episode||1}`
    },
    {
        name: 'VidLink ★★',
        hasSubtitles: true,
        getUrl: (d) => d.type === 'movie'
            ? `https://vidlink.pro/movie/${d.tmdb}`
            : `https://vidlink.pro/tv/${d.tmdb}/${d.season||1}/${d.episode||1}`
    },
    {
        name: '2Embed ★',
        hasSubtitles: true,
        getUrl: (d) => `https://www.2embed.cc/embed/${d.imdb || 'tt'+d.tmdb}`
    },
    {
        name: 'SuperEmbed ★',
        hasSubtitles: true,
        getUrl: (d) => `https://multiembed.mov/?video_id=${d.imdb || 'tt'+d.tmdb}&tmdb=1`
    },
];

/* ─── STATE ────────────────────────────────────────────────────── */
let currentContent   = null;
let currentPage      = 1;
let currentCategory  = 'home';
let currentGenreId   = 'all';
let currentSearchQ   = '';
let matureUnlocked   = false;
let matureExpiry     = 0;
let pinFailCount     = 0;
let pinLockUntil     = 0;
const MATURE_TTL     = 15 * 60 * 1000;
const PIN_MAX        = 5;
const PIN_LOCKOUT    = 5 * 60 * 1000;

/* ─── HERO SLIDES ──────────────────────────────────────────────── */
const HERO_ITEMS = [
    { id:'872585',  type:'movie', title:'Oppenheimer',        year:'2023', badge:'🔥 Trending',   img:'https://images.unsplash.com/photo-1534131707746-25d604851a1f?w=1920&h=1080&fit=crop', desc:'The story of J. Robert Oppenheimer and the creation of the atomic bomb that changed the world forever.' },
    { id:'1396',    type:'tv',    title:'Breaking Bad',        year:'2008', badge:'⭐ All-Time Best',img:'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1920&h=1080&fit=crop', desc:'A high school chemistry teacher turned meth manufacturer partners with a former student in the criminal world.' },
    { id:'519182',  type:'movie', title:'Despicable Me 4',     year:'2024', badge:'🆕 Latest',      img:'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1920&h=1080&fit=crop', desc:'Gru and his family face a new villain — and a new chapter — in the latest adventure.' },
    { id:'94997',   type:'tv',    title:'House of the Dragon', year:'2022', badge:'🐉 Epic Fantasy', img:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop', desc:'The prequel to Game of Thrones — the story of House Targaryen before the fall.' },
];

let heroIndex  = 0;
let heroTimer  = null;
const HERO_MS  = 7000;

/* ─── TMDB FETCH ────────────────────────────────────────────────── */
async function fetchTMDB(endpoint) {
    try {
        const sep = endpoint.includes('?') ? '&' : '?';
        const res = await fetch(`${TMDB_BASE_URL}${endpoint}${sep}api_key=${TMDB_API_KEY}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('TMDB Error:', err);
        return null;
    }
}

async function getExternalIds(id, type) {
    const data = await fetchTMDB(`/${type}/${id}/external_ids`);
    return data?.imdb_id || null;
}

/* ─── HERO ENGINE ────────────────────────────────────────────────
   Works with the new HTML (#hero) and old HTML (#heroSection)
──────────────────────────────────────────────────────────────── */
function buildHero() {
    const hero = document.getElementById('hero') || document.getElementById('heroSection');
    if (!hero) return;

    // Clear old static content, inject slides
    // Keep children that are #heroBar and #heroDots if they exist
    [...hero.children].forEach(c => {
        if (!['heroBar','heroDots'].includes(c.id)) c.remove();
    });

    const bar  = document.getElementById('heroBar');
    const dots = document.getElementById('heroDots');

    HERO_ITEMS.forEach((d, i) => {
        const slide = document.createElement('div');
        slide.className = 'hero-slide' + (i === 0 ? ' active' : '');
        slide.innerHTML = `
            <img class="hero-bg" src="${d.img}" alt="${d.title}" loading="${i===0?'eager':'lazy'}">
            <div class="hero-ov"></div>
            <div class="hero-content">
                <div class="hero-badge">${d.badge}</div>
                <h1 class="hero-title">${d.title}</h1>
                <div class="hero-meta">
                    <span class="hero-score">TMDB ★</span>
                    <span style="background:rgba(255,255,255,.15);color:#fff;font-size:.74rem;padding:2px 8px;border-radius:3px">${d.year}</span>
                </div>
                <p class="hero-desc">${d.desc}</p>
                <div class="hero-acts">
                    <button class="btn-play" onclick="playContentById(${d.id},'${d.type}','${d.title.replace(/'/g,"\\'")}','${d.year}')">▶ Watch Now</button>
                    <button class="btn-more">ℹ More Info</button>
                </div>
            </div>`;
        if (bar)  hero.insertBefore(slide, bar);
        else if (dots) hero.insertBefore(slide, dots);
        else hero.appendChild(slide);

        if (dots) {
            const dot = document.createElement('div');
            dot.className = 'hdot' + (i === 0 ? ' active' : '');
            dot.onclick = () => goToSlide(i);
            dots.appendChild(dot);
        }
    });

    startHeroAuto();
}

function goToSlide(idx) {
    const slides = document.querySelectorAll('.hero-slide');
    const dotEls = document.querySelectorAll('.hdot');
    slides[heroIndex]?.classList.remove('active');
    dotEls[heroIndex]?.classList.remove('active');
    heroIndex = idx;
    slides[idx]?.classList.add('active');
    dotEls[idx]?.classList.add('active');
    resetHeroBar();
}

function startHeroAuto() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => {
        goToSlide((heroIndex + 1) % HERO_ITEMS.length);
    }, HERO_MS);
    resetHeroBar();
}

function resetHeroBar() {
    const bar = document.getElementById('heroBar');
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.width = '0%';
    requestAnimationFrame(() => {
        bar.style.transition = `width ${HERO_MS}ms linear`;
        bar.style.width = '100%';
    });
}

/* ─── SECTION REVEAL ─────────────────────────────────────────────── */
function observeSections() {
    if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.add('visible'));
        return;
    }
    const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
        });
    }, { threshold: 0.06 });
    document.querySelectorAll('.content-section').forEach(s => io.observe(s));
}

/* ─── CARD FACTORY ───────────────────────────────────────────────── */
function makeCard(item, type, opts = {}) {
    const title   = item.title || item.name || 'Unknown';
    const year    = (item.release_date || item.first_air_date || '').slice(0, 4);
    const score   = item.vote_average ? item.vote_average.toFixed(1) : '—';
    const poster  = item.poster_path
        ? `${TMDB_IMAGE_BASE}${item.poster_path}`
        : `https://via.placeholder.com/300x450/161616/555?text=${encodeURIComponent(title)}`;
    const isLock  = opts.locked || false;
    const delay   = opts.idx ? opts.idx * 50 : 0;

    return `
        <div class="card content-card" style="animation-delay:${delay}ms"
             onclick="${isLock ? 'App.openMature()' : `playContentById(${item.id},'${type}','${title.replace(/'/g,"\\'").replace(/"/g,"&quot;")}','${year}')`}">
            <div class="card-img-wrap">
                <img class="card-img card-image"
                     src="${poster}"
                     alt="${title}"
                     loading="lazy"
                     onerror="this.src='https://via.placeholder.com/300x450/161616/555?text=No+Poster'">
                <div class="card-play card-play-icon">▶</div>
                <div class="card-type type-badge">${type === 'movie' ? 'FILM' : 'TV'}</div>
                <div class="rating-badge" style="position:absolute;top:7px;left:7px;background:rgba(0,0,0,.75);padding:2px 6px;border-radius:3px;font-size:.65rem;font-weight:600">⭐ ${score}</div>
                ${isLock ? `<div class="card-lock"><div class="lico">🔒</div><div class="ltxt">18+<br>Tap to unlock</div></div>` : ''}
            </div>
            <div class="card-ov card-overlay">
                <div class="card-ttl card-title">${title}</div>
                <div class="card-meta card-meta-row">
                    <span class="star">★</span><span>${score}</span>${year ? `<span>${year}</span>` : ''}
                </div>
            </div>
        </div>`;
}

/* ─── DISPLAY CONTENT ────────────────────────────────────────────── */
function displayContent(containerId, items, opts = {}) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!items || items.length === 0) {
        el.innerHTML = '<div style="color:#888;padding:20px;font-size:.9rem">No results found.</div>';
        return;
    }
    el.innerHTML = items.map((item, i) => {
        const type = item.media_type || (item.title ? 'movie' : 'tv');
        return makeCard(item, type, { ...opts, idx: i });
    }).join('');
}

/* ─── HOME SECTION LOADERS ───────────────────────────────────────── */
async function loadTrending() {
    const data = await fetchTMDB('/trending/all/week');
    if (data?.results) displayContent('trendingContent', data.results.slice(0, 20));
}

async function loadMovies() {
    const data = await fetchTMDB('/movie/popular?region=PH');
    if (data?.results) displayContent('moviesContent', data.results.slice(0, 20));
}

async function loadTV() {
    const data = await fetchTMDB('/tv/popular?region=PH');
    if (data?.results) displayContent('tvContent', data.results.slice(0, 20));
}

async function loadKDrama() {
    const data = await fetchTMDB('/discover/tv?with_origin_country=KR&sort_by=popularity.desc&with_type=2|4');
    if (data?.results) displayContent('kdramaContent', data.results.slice(0, 20));
}

async function loadAnime() {
    const data = await fetchTMDB('/discover/tv?with_genres=16&with_origin_country=JP&sort_by=popularity.desc');
    if (data?.results) displayContent('animeContent', data.results.slice(0, 20));
}

async function loadMatureContent() {
    const data = await fetchTMDB('/movie/popular?certification_country=US&certification=R&sort_by=popularity.desc');
    if (data?.results) {
        displayContent('matureContent', data.results.slice(0, 20));
    }
}

/* ─── GENRE FILTER ───────────────────────────────────────────────
   Called by genre chips. Fetches TMDB by genre ID.
──────────────────────────────────────────────────────────────── */
async function filterByGenre(genreId) {
    currentGenreId = genreId;
    if (genreId === 'all') {
        goHome();
        return;
    }

    showResultsView();

    const genreName = document.querySelector(`.gchip[data-g="${genreId}"], .genre-chip[data-genre="${genreId}"]`)?.textContent?.trim() || 'Genre';
    setSearchInfo(`${genreName}`, 'Fetching...');

    // Fetch both movies and TV for that genre
    const [movies, tv] = await Promise.all([
        fetchTMDB(`/discover/movie?with_genres=${genreId}&sort_by=popularity.desc&page=1`),
        fetchTMDB(`/discover/tv?with_genres=${genreId}&sort_by=popularity.desc&page=1`),
    ]);

    const results = [
        ...(movies?.results || []).map(r => ({ ...r, media_type: 'movie' })),
        ...(tv?.results || []).map(r => ({ ...r, media_type: 'tv' })),
    ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    const total = (movies?.total_results || 0) + (tv?.total_results || 0);
    setSearchInfo(genreName, `${total.toLocaleString()} titles found`);
    displayContent('searchResultsContent', results);
    document.getElementById('pagination').innerHTML = '';
}

/* ─── CATEGORY LOADER ────────────────────────────────────────────
   Called by nav links and bottom nav
──────────────────────────────────────────────────────────────── */
async function loadCategory(category) {
    currentCategory = category;
    updateNavActive(category);

    if (category === 'mature') {
        App.openMature();
        return;
    }

    showResultsView();

    const categoryMap = {
        trending: { ep: '/trending/all/week',                                                    title: '🔥 Trending Now'     },
        movies:   { ep: '/discover/movie?sort_by=popularity.desc',                               title: '🎬 Popular Movies'   },
        tv:       { ep: '/discover/tv?sort_by=popularity.desc',                                  title: '📺 TV Series'        },
        kdrama:   { ep: '/discover/tv?with_origin_country=KR&sort_by=popularity.desc',           title: '🇰🇷 K-Drama'          },
        anime:    { ep: '/discover/tv?with_genres=16&with_origin_country=JP&sort_by=popularity.desc', title: '🎌 Anime'       },
        latest_movies: { ep: '/movie/now_playing',                                               title: '🆕 Now In Cinemas'   },
        top_rated:{ ep: '/movie/top_rated',                                                      title: '⭐ Top Rated Movies'  },
    };

    const cat = categoryMap[category];
    if (!cat) return;

    setSearchInfo(cat.title, 'Loading...');

    const data = await fetchTMDB(`${cat.ep}&page=1`);
    if (!data?.results) { setSearchInfo(cat.title, 'Failed to load.'); return; }

    const total = data.total_results || data.results.length;
    setSearchInfo(cat.title, `${total.toLocaleString()} titles`);

    const items = data.results.map(r => ({
        ...r,
        media_type: r.media_type || (r.title ? 'movie' : 'tv'),
    }));
    displayContent('searchResultsContent', items);

    // Pagination
    buildPagination(data.total_pages || 1, 1, (page) => loadCategoryPage(cat.ep, cat.title, page));
}

async function loadCategoryPage(ep, title, page) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSearchInfo(title, 'Loading...');
    const data = await fetchTMDB(`${ep}&page=${page}`);
    if (!data?.results) return;
    setSearchInfo(title, `${(data.total_results||0).toLocaleString()} titles — Page ${page}`);
    const items = data.results.map(r => ({
        ...r,
        media_type: r.media_type || (r.title ? 'movie' : 'tv'),
    }));
    displayContent('searchResultsContent', items);
    buildPagination(data.total_pages || 1, page, (p) => loadCategoryPage(ep, title, p));
}

/* ─── SEARCH ─────────────────────────────────────────────────────
   Works from desktop input, mobile overlay, or Enter key
──────────────────────────────────────────────────────────────── */
async function performMainSearch(page = 1) {
    const desktopQ = document.getElementById('searchInput')?.value.trim();
    const mobileQ  = document.getElementById('msearchInp')?.value.trim();
    const query    = desktopQ || mobileQ || currentSearchQ;
    if (!query) return;

    currentSearchQ = query;
    showResultsView();
    setSearchInfo(`Results for "${query}"`, 'Searching...');

    const data = await fetchTMDB(`/search/multi?query=${encodeURIComponent(query)}&page=${page}&include_adult=false`);

    if (!data?.results) {
        setSearchInfo(`Results for "${query}"`, 'Search failed. Check connection.');
        return;
    }

    const filtered = data.results.filter(r => r.media_type !== 'person' && r.poster_path);
    const total    = data.total_results || filtered.length;

    setSearchInfo(
        `Results for "<span style="color:var(--red)">${query}</span>"`,
        `${total.toLocaleString()} results found`
    );
    displayContent('searchResultsContent', filtered);
    buildPagination(data.total_pages || 1, page, (p) => performMainSearch(p));
}

/* ─── PAGINATION ─────────────────────────────────────────────────── */
function buildPagination(totalPages, currentPg, onPage) {
    const el = document.getElementById('pagination');
    if (!el || totalPages <= 1) { if (el) el.innerHTML = ''; return; }

    const max   = Math.min(totalPages, 500); // TMDB caps at 500
    let pages   = [];

    if (max <= 7) {
        pages = Array.from({ length: max }, (_, i) => i + 1);
    } else {
        pages = [1];
        if (currentPg > 3) pages.push('…');
        for (let i = Math.max(2, currentPg - 2); i <= Math.min(max - 1, currentPg + 2); i++) pages.push(i);
        if (currentPg < max - 2) pages.push('…');
        pages.push(max);
    }

    el.innerHTML = pages.map(p =>
        p === '…'
            ? `<span class="pag-btn page-btn" style="cursor:default;opacity:.4">…</span>`
            : `<button class="pag-btn page-btn ${p === currentPg ? 'active' : ''}" onclick="(${onPage.toString()})(${p})">${p}</button>`
    ).join('');
}

/* ─── VIEW HELPERS ───────────────────────────────────────────────── */
function showResultsView() {
    // Hide hero + main rows
    const hero    = document.getElementById('hero') || document.getElementById('heroSection');
    const main    = document.getElementById('mainContent');
    const results = document.getElementById('searchResultsContainer');
    const info    = document.getElementById('searchInfo');
    const genreEl = document.getElementById('genreBar');

    if (hero)    hero.style.display    = 'none';
    if (main)    main.style.display    = 'none';
    if (results) results.style.display = 'block';
    if (info)    info.classList.add('active', 'on');
    // Keep genre bar visible so user can re-filter
}

function showHomeView() {
    const hero    = document.getElementById('hero') || document.getElementById('heroSection');
    const main    = document.getElementById('mainContent');
    const results = document.getElementById('searchResultsContainer');
    const info    = document.getElementById('searchInfo');

    if (hero)    hero.style.display    = '';
    if (main)    main.style.display    = '';
    if (results) results.style.display = 'none';
    if (info)    info.classList.remove('active', 'on');

    // Reset genre chips to "All"
    document.querySelectorAll('.gchip, .genre-chip').forEach(c => {
        c.classList.toggle('active', (c.dataset.g || c.dataset.genre) === 'all');
    });
}

function setSearchInfo(title, count) {
    const t = document.getElementById('searchTitle');
    const c = document.getElementById('searchCount');
    if (t) t.innerHTML = title;
    if (c) c.textContent = count;
}

/* ─── GO HOME ────────────────────────────────────────────────────── */
function goHome() {
    currentCategory = 'home';
    currentGenreId  = 'all';
    currentSearchQ  = '';
    const si = document.getElementById('searchInput');
    if (si) si.value = '';
    const mi = document.getElementById('msearchInp');
    if (mi) mi.value = '';
    showHomeView();
    updateNavActive('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─── NAV ACTIVE STATE ───────────────────────────────────────────── */
function updateNavActive(cat) {
    document.querySelectorAll('.nav-links a, .nav-links li a').forEach(a => {
        a.classList.toggle('active', a.dataset.cat === cat);
    });
}

/* ─── PLAYER ─────────────────────────────────────────────────────── */
async function playContentById(tmdbId, type, title, year) {
    document.getElementById('playerTitle').textContent = `${title}${year ? ' ('+year+')' : ''}`;
    document.getElementById('playerModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    document.getElementById('playerVideo').innerHTML =
        '<div class="loading loading-state"><div class="spinner spin"></div><span>Loading player...</span></div>';

    let imdb = null;
    try { imdb = await getExternalIds(tmdbId, type); } catch (e) {}

    const data = {
        tmdb:    String(tmdbId),
        imdb:    imdb,
        type:    type,
        title:   title,
        year:    year,
        season:  1,
        episode: 1,
    };

    currentContent        = data;
    window.currentContent = data;

    loadServerButtons(data);
    loadServer(0, data);
}

function loadServerButtons(data) {
    const el = document.getElementById('serverButtons');
    if (!el) return;
    el.innerHTML = servers.map((s, i) => `
        <button class="srv-btn server-btn ${i === 0 ? 'active' : ''}"
                onclick="loadServer(${i}, ${JSON.stringify(data).replace(/"/g,'&quot;')})">
            ${s.name}
            ${s.hasSubtitles ? '<span class="sub-b sub-badge">CC</span>' : ''}
        </button>`).join('');
}

function loadServer(index, data) {
    const el  = document.getElementById('playerVideo');
    const url = servers[index].getUrl(data);
    el.innerHTML = `<iframe src="${url}"
        allowfullscreen
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        referrerpolicy="no-referrer-when-downgrade"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation">
    </iframe>`;
    document.querySelectorAll('.srv-btn, .server-btn').forEach((b, i) =>
        b.classList.toggle('active', i === index));
    currentContent = { ...currentContent, ...data };
    window.currentContent = currentContent;
}

function closePlayer() {
    document.getElementById('playerModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('playerVideo').innerHTML =
        '<div class="loading loading-state"><div class="spinner spin"></div><span>Loading player...</span></div>';
    document.getElementById('chatPanel')?.classList.remove('show');
}

/* ─── 18+ SYSTEM ─────────────────────────────────────────────────── */
function isMatureOk() {
    return matureUnlocked && Date.now() < matureExpiry;
}

function openMature() {
    if (isMatureOk()) { revealMature(); return; }
    document.getElementById('verifyModal').style.display = 'flex';
    showAge();
}

function showAge() {
    document.getElementById('vs1')?.classList.add('on');
    document.getElementById('vs2')?.classList.remove('on');
    document.getElementById('verifyStep1')?.classList.add('active');
    document.getElementById('verifyStep2')?.classList.remove('active');
}

function showPin() {
    document.getElementById('vs1')?.classList.remove('on');
    document.getElementById('vs2')?.classList.add('on');
    document.getElementById('verifyStep1')?.classList.remove('active');
    document.getElementById('verifyStep2')?.classList.add('active');
    setTimeout(() => document.querySelector('.pin-d, .pin-digit')?.focus(), 100);
}

function closeVerify() {
    document.getElementById('verifyModal').style.display = 'none';
    clearPins();
    const pe = document.getElementById('pinErr') || document.getElementById('pinError');
    if (pe) pe.textContent = '';
}

function verifyAge() {
    grantMature();
    closeVerify();
    revealMature();
}

async function verifyPin() {
    const now = Date.now();
    if (now < pinLockUntil) {
        const secs = Math.ceil((pinLockUntil - now) / 1000);
        const pl = document.getElementById('pinLock') || document.getElementById('lockoutTimer');
        if (pl) pl.textContent = `Locked. Try again in ${secs}s.`;
        return;
    }
    const digits = [...document.querySelectorAll('.pin-d, .pin-digit')].map(i => i.value);
    const pin    = digits.join('');
    if (pin.length < 4) {
        showPinError('Enter all 4 digits.');
        return;
    }
    const hash   = await sha256(pin);
    const stored = localStorage.getItem('sf_pin');
    if (!stored) {
        // First time: save PIN
        localStorage.setItem('sf_pin', hash);
        pinFailCount = 0;
        grantMature();
        closeVerify();
        revealMature();
    } else if (hash === stored) {
        pinFailCount = 0;
        grantMature();
        closeVerify();
        revealMature();
    } else {
        pinFailCount++;
        if (pinFailCount >= PIN_MAX) {
            pinLockUntil = Date.now() + PIN_LOCKOUT;
            pinFailCount = 0;
            showPinError('Too many attempts. Locked for 5 minutes.');
        } else {
            showPinError(`Wrong PIN. ${PIN_MAX - pinFailCount} attempts left.`);
        }
        clearPins();
    }
}

function showPinError(msg) {
    const el = document.getElementById('pinErr') || document.getElementById('pinError');
    if (el) el.textContent = msg;
}

function grantMature() {
    matureUnlocked = true;
    matureExpiry   = Date.now() + MATURE_TTL;
    setTimeout(() => {
        matureUnlocked = false;
        const s = document.getElementById('section-mature');
        if (s) s.style.display = 'none';
    }, MATURE_TTL);
}

function revealMature() {
    const s = document.getElementById('section-mature');
    if (!s) return;
    s.style.display = '';
    s.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const c = document.getElementById('matureContent');
    if (c && c.children.length === 0) loadMatureContent();
}

function clearPins() {
    document.querySelectorAll('.pin-d, .pin-digit').forEach(i => i.value = '');
    document.querySelector('.pin-d, .pin-digit')?.focus();
}

async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ─── PIN AUTO-FOCUS ─────────────────────────────────────────────── */
function initPinInputs() {
    const digits = document.querySelectorAll('.pin-d, .pin-digit');
    digits.forEach((inp, i) => {
        inp.addEventListener('input', () => {
            inp.value = inp.value.replace(/\D/g,'').slice(-1);
            if (inp.value && i < digits.length - 1) digits[i+1].focus();
        });
        inp.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !inp.value && i > 0) digits[i-1].focus();
            if (e.key === 'Enter') verifyPin();
        });
    });
}

/* ─── MOBILE SEARCH ──────────────────────────────────────────────── */
function openMSearch() {
    const el = document.getElementById('msearch') || document.getElementById('mobileSearchOverlay');
    el?.classList.add('on', 'open');
    document.getElementById('msearchInp')?.focus();
}

function closeMSearch() {
    const el = document.getElementById('msearch') || document.getElementById('mobileSearchOverlay');
    el?.classList.remove('on', 'open');
}

function initMobileSearch() {
    const inp = document.getElementById('msearchInp');
    if (!inp) return;
    let t;
    inp.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
            const q = inp.value.trim();
            if (q.length > 1) {
                const si = document.getElementById('searchInput');
                if (si) si.value = q;
                closeMSearch();
                performMainSearch(1);
            }
        }, 500);
    });
    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const q = inp.value.trim();
            if (q) {
                const si = document.getElementById('searchInput');
                if (si) si.value = q;
                closeMSearch();
                performMainSearch(1);
            }
        }
    });
}

/* ─── SCROLL ROW ─────────────────────────────────────────────────── */
function scrollR(containerId, dir) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.scrollBy({ left: dir * 650, behavior: 'smooth' });
}

/* ─── SEE ALL ────────────────────────────────────────────────────── */
function seeAll(cat) {
    loadCategory(cat);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─── BOTTOM NAV ─────────────────────────────────────────────────── */
function setNav(id) {
    document.querySelectorAll('.bni').forEach(b => b.classList.remove('active'));
    document.getElementById('bn-' + id)?.classList.add('active');
}

function openSettings() {
    alert('⚙️ Settings\n\nParental PIN: First 4-digit PIN you enter becomes your PIN.\n\nTo reset PIN: Clear your browser data / site data.\n\nAd-blocking tip: Use Firefox or Kiwi Browser with the free uBlock Origin extension for the best ad-free experience.');
}

/* ─── NAV SCROLL ─────────────────────────────────────────────────── */
function initNavScroll() {
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (nav) nav.classList.toggle('solid', window.scrollY > 50);
        // Legacy class
        nav?.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });
}

/* ─── WHEEL → HORIZONTAL SCROLL ─────────────────────────────────── */
function initWheelScroll() {
    document.querySelectorAll('.row-scroll').forEach(row => {
        row.addEventListener('wheel', e => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            e.preventDefault();
            row.scrollBy({ left: e.deltaY * 3 });
        }, { passive: false });
    });
}

/* ─── INSTALL PWA ────────────────────────────────────────────────── */
function initInstall() {
    let prompt;
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        prompt = e;
        const b = document.getElementById('installBanner');
        if (b && !localStorage.getItem('sf_install_ok')) b.classList.add('show');
    });
    document.getElementById('installBtn')?.addEventListener('click', async () => {
        if (!prompt) return;
        prompt.prompt();
        const r = await prompt.userChoice;
        if (r.outcome === 'accepted') document.getElementById('installBanner').classList.remove('show');
        prompt = null;
    });
    document.getElementById('closeBanner')?.addEventListener('click', () => {
        document.getElementById('installBanner').classList.remove('show');
        localStorage.setItem('sf_install_ok', '1');
    });
}

/* ─── KEYBOARD ───────────────────────────────────────────────────── */
function initKeys() {
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (document.getElementById('playerModal')?.classList.contains('active')) closePlayer();
            if (document.getElementById('verifyModal')?.style.display === 'flex') closeVerify();
            closeMSearch();
        }
    });
    // Desktop search — Enter key
    document.getElementById('searchInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') performMainSearch(1);
    });
}

/* ─── CONTEXT MENU DETER ─────────────────────────────────────────── */
function initContextDeter() {
    document.addEventListener('contextmenu', e => {
        if (e.target.closest('#playerVideo, .card-img-wrap')) e.preventDefault();
    });
}

/* ═══════════════════════════════════════════════════════════
   App NAMESPACE — used by new HTML onclick="App.xxx()"
   Maps every App.* call to the matching function above
═══════════════════════════════════════════════════════════ */
const App = {
    goHome,
    loadCat:       loadCategory,
    doSearch:      () => performMainSearch(1),
    genreFilter:   (chip) => {
        document.querySelectorAll('.gchip, .genre-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const gid = chip.dataset.g || chip.dataset.genre || 'all';
        filterByGenre(gid);
    },
    scrollR,
    seeAll,
    closePlayer,
    openMSearch,
    closeMSearch,
    setNav,
    openSettings,
    openMature:    openMature,
    verifyAge,
    showPin,
    showAge,
    closeVerify,
    verifyPin,
    toggleMobileSearch: openMSearch,
};

window.App = App;

/* ─── ALSO EXPOSE GLOBALS (for old HTML onclick="xxx()") ────────── */
window.playContentById    = playContentById;
window.loadServer         = loadServer;
window.loadCategory       = loadCategory;
window.goHome             = goHome;
window.closePlayer        = closePlayer;
window.performMainSearch  = () => performMainSearch(1);
window.filterByGenre      = filterByGenre;
window.seeAll             = seeAll;
window.scrollR            = scrollR;
window.loadServerButtons  = loadServerButtons;
window.openMature         = openMature;
window.verifyAge          = verifyAge;
window.verifyPin          = verifyPin;
window.showPinStep        = showPin;
window.showAgeStep        = showAge;
window.closeVerify        = closeVerify;
window.setNav             = setNav;
window.openMSearch        = openMSearch;
window.closeMSearch       = closeMSearch;

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    buildHero();
    observeSections();
    initNavScroll();
    initPinInputs();
    initKeys();
    initInstall();
    initMobileSearch();
    initContextDeter();
    setTimeout(initWheelScroll, 1500);

    // Load all home rows
    Promise.all([
        loadTrending(),
        loadMovies(),
        loadTV(),
        loadKDrama(),
        loadAnime(),
    ]).then(() => {
        console.log('✅ StreamFlix 3.0 ready');
        setTimeout(initWheelScroll, 200);
    });

    // Firebase Watch Together init (if available)
    if (typeof initFirebase === 'function') {
        initFirebase().catch(err => console.warn('Firebase:', err));
    }
});
