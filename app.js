/* ═══════════════════════════════════════════════════════════
   STREAMFLIX app.js — v3.6
   Auto-patches genre chips — works with ANY HTML structure
═══════════════════════════════════════════════════════════ */

const qs  = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');

const TMDB_KEY = '3fd2be6f0c70a2a598f084ddfb75487c';
const TMDB_URL = 'https://api.themoviedb.org/3';
const IMG      = 'https://image.tmdb.org/t/p/w500';

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

/* Maps chip text AND data-g/data-genre values to TMDB genre IDs */
const GENRE_ID_MAP = {
  /* by text label */
  'all':'all','action':'28','drama':'18','comedy':'35','thriller':'53',
  'romance':'10749','sci-fi':'878','horror':'27','fantasy':'14',
  'animation':'16','documentary':'99','family':'10751','history':'36',
  'crime':'80','music':'10402','mystery':'9648','western':'37',
  /* by numeric string (data-g attribute) */
  '28':'28','18':'18','35':'35','53':'53','10749':'10749','878':'878',
  '27':'27','14':'14','16':'16','99':'99','10751':'10751','36':'36',
  '80':'80','10402':'10402','9648':'9648','37':'37',
};

const HERO_DATA = [
  { id:'872585', type:'movie', title:'Oppenheimer',        year:'2023', badge:'🔥 Trending',
    img:'https://images.unsplash.com/photo-1534131707746-25d604851a1f?w=1920&h=1080&fit=crop',
    desc:'The story of J. Robert Oppenheimer and his role in the development of the atomic bomb.' },
  { id:'1396',   type:'tv',   title:'Breaking Bad',        year:'2008', badge:'⭐ All-Time Best',
    img:'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1920&h=1080&fit=crop',
    desc:'A chemistry teacher turned meth manufacturer navigates the criminal underworld.' },
  { id:'94997',  type:'tv',   title:'House of the Dragon', year:'2022', badge:'🐉 Epic Fantasy',
    img:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
    desc:'The prequel to Game of Thrones — the story of House Targaryen before the fall.' },
  { id:'519182', type:'movie', title:'Despicable Me 4',    year:'2024', badge:'🆕 Latest 2024',
    img:'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1920&h=1080&fit=crop',
    desc:'Gru and his family face a brand-new villain in the latest Minions adventure.' },
];

const S = {
  heroIdx:0, heroTimer:null, HERO_MS:7000,
  content:null, searchQ:'',
  matureOk:false, matureExpiry:0, pinFails:0, pinLockUntil:0,
};
const MATURE_TTL=15*60*1000, PIN_MAX=5, PIN_LOCK=5*60*1000;

/* ═══════════════════════════════════════════════════════
   TMDB
═══════════════════════════════════════════════════════ */
async function tmdb(endpoint, params={}) {
  const url = `${TMDB_URL}${endpoint}?${new URLSearchParams({api_key:TMDB_KEY,...params})}`;
  try {
    const res  = await fetch(url);
    const json = await res.json();
    if (!res.ok || json.success===false) {
      console.error('[TMDB ❌]', json.status_message||res.status);
      return null;
    }
    return json;
  } catch(e) {
    console.error('[TMDB 🔴]', e.message);
    return null;
  }
}

async function getImdbId(id, type) {
  const d = await tmdb(`/${type}/${id}/external_ids`);
  return d?.imdb_id||null;
}

/* ═══════════════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════════════ */
function buildHero() {
  const hero = qs('#hero')||qs('#heroSection');
  if (!hero) return;
  const bar=qs('#heroBar')||qs('#heroProgress'), dots=qs('#heroDots');
  hero.querySelectorAll('.hero-slide').forEach(s=>s.remove());
  if (dots) dots.innerHTML='';

  HERO_DATA.forEach((d,i)=>{
    const slide=document.createElement('div');
    slide.className='hero-slide'+(i===0?' active':'');
    slide.innerHTML=`
      <img class="hero-bg hero-bg-img" src="${d.img}" alt="${d.title}" loading="${i===0?'eager':'lazy'}">
      <div class="hero-ov hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-badge">${d.badge}</div>
        <h1 class="hero-title">${d.title}</h1>
        <div class="hero-meta">
          <span style="background:#f5c518;color:#000;padding:2px 9px;border-radius:3px;font-size:.76rem;font-weight:700">TMDB ★</span>
          <span style="background:rgba(255,255,255,.14);padding:2px 9px;border-radius:3px;font-size:.8rem">${d.year}</span>
        </div>
        <p class="hero-desc hero-description">${d.desc}</p>
        <div class="hero-acts hero-actions">
          <button class="btn-play btn" onclick="playById(${d.id},'${d.type}','${esc(d.title)}','${d.year}')">▶ Watch Now</button>
        </div>
      </div>`;
    if(bar) hero.insertBefore(slide,bar);
    else if(dots) hero.insertBefore(slide,dots);
    else hero.appendChild(slide);
    if(dots){
      const dot=document.createElement('div');
      dot.className='hdot hero-dot'+(i===0?' active':'');
      dot.onclick=()=>heroGoto(i);
      dots.appendChild(dot);
    }
  });
  heroStart();
}
function heroGoto(idx){qsa('.hero-slide').forEach((s,i)=>s.classList.toggle('active',i===idx));qsa('.hdot,.hero-dot').forEach((d,i)=>d.classList.toggle('active',i===idx));S.heroIdx=idx;heroBarReset();}
function heroStart(){clearInterval(S.heroTimer);S.heroTimer=setInterval(()=>heroGoto((S.heroIdx+1)%HERO_DATA.length),S.HERO_MS);heroBarReset();}
function heroBarReset(){const bar=qs('#heroBar')||qs('#heroProgress');if(!bar)return;bar.style.transition='none';bar.style.width='0%';requestAnimationFrame(()=>{bar.style.transition=`width ${S.HERO_MS}ms linear`;bar.style.width='100%';});}

/* ═══════════════════════════════════════════════════════
   CARD
═══════════════════════════════════════════════════════ */
function makeCard(item, overrideType, idx=0, locked=false) {
  const type  = overrideType||item.media_type||(item.title?'movie':'tv');
  const title = item.title||item.name||'Unknown';
  const year  = (item.release_date||item.first_air_date||'').slice(0,4);
  const score = item.vote_average?item.vote_average.toFixed(1):'—';
  const poster= item.poster_path?`${IMG}${item.poster_path}`:`https://placehold.co/300x450/161616/555?text=${encodeURIComponent(title)}`;
  const fn    = locked?`App.openMature()`:`playById(${item.id},'${type}','${esc(title)}','${year}')`;
  return `<div class="content-card" onclick="${fn}"
    onmouseenter="this.style.transform='scale(1.06) translateY(-3px)';this.style.boxShadow='0 16px 40px rgba(0,0,0,.7)'"
    onmouseleave="this.style.transform='';this.style.boxShadow=''"
    style="position:relative;border-radius:8px;overflow:hidden;cursor:pointer;background:#181818;transition:transform .3s,box-shadow .3s">
    <div style="aspect-ratio:2/3;overflow:hidden;position:relative">
      <img src="${poster}" alt="${esc(title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.src='https://placehold.co/300x450/222/555?text=No+Poster'">
      <div style="position:absolute;top:7px;right:7px;background:#e50914;color:#fff;font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:2px 6px;border-radius:3px">${type==='movie'?'FILM':'TV'}</div>
      <div style="position:absolute;top:7px;left:7px;background:rgba(0,0,0,.8);color:#fff;padding:2px 6px;border-radius:3px;font-size:.65rem;font-weight:600">⭐ ${score}</div>
      ${locked?`<div style="position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(14px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px"><div style="font-size:2rem">🔒</div><div style="font-size:.7rem;font-weight:600;color:#ccc;text-align:center">18+<br>Tap to unlock</div></div>`:''}
    </div>
    <div style="padding:9px 8px;background:#181818">
      <div style="font-size:.8rem;font-weight:600;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff">${title}</div>
      <div style="display:flex;gap:7px;font-size:.68rem;color:#888"><span style="color:#f5c518">★</span><span>${score}</span>${year?`<span>${year}</span>`:''}</div>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════
   RENDER
═══════════════════════════════════════════════════════ */
function renderRow(id, items, type=null, locked=false) {
  const el=qs('#'+id); if(!el) return;
  el.innerHTML=items?.length?items.map((item,i)=>makeCard(item,type,i,locked)).join(''):'<p style="color:#666;padding:20px">No content.</p>';
}

function renderGrid(items) {
  /* Always write into a guaranteed-visible container.
     We CREATE it fresh if needed so CSS can never block it. */
  let wrap = qs('#sf-results-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'sf-results-wrap';
    /* Try to insert into the existing results container */
    const rc = qs('#searchResultsContainer') || qs('#searchResults');
    if (rc) {
      rc.innerHTML = '';
      rc.appendChild(wrap);
    } else {
      /* Last resort: append after main content */
      document.body.appendChild(wrap);
    }
  }

  wrap.style.cssText = [
    'display:grid',
    'grid-template-columns:repeat(auto-fill,minmax(145px,1fr))',
    'gap:14px',
    'padding:10px 30px 24px',
    'opacity:1',
    'visibility:visible',
    'min-height:60px',
  ].join(';');

  wrap.innerHTML = items?.length
    ? items.map((item,i)=>makeCard(item,item.media_type||(item.title?'movie':'tv'),i)).join('')
    : '<p style="color:#666;padding:30px;text-align:center;grid-column:1/-1">No results found.</p>';

  /* Force every ancestor visible */
  let node=wrap.parentElement;
  while(node&&node!==document.body){
    if(getComputedStyle(node).display==='none') node.style.display='block';
    node.style.opacity='1';
    node.style.visibility='visible';
    if(node.classList.contains('content-section')||node.classList.contains('fade-in')){
      node.classList.add('visible');
      node.style.transform='none';
      node.style.animation='none';
    }
    node=node.parentElement;
  }
}

/* ═══════════════════════════════════════════════════════
   HOME LOADERS
═══════════════════════════════════════════════════════ */
async function loadTrending(){const d=await tmdb('/trending/all/week');renderRow('trendingContent',d?.results?.slice(0,20));}
async function loadMovies(){const d=await tmdb('/movie/popular',{region:'PH'});renderRow('moviesContent',d?.results?.slice(0,20),'movie');}
async function loadTV(){const d=await tmdb('/tv/popular',{region:'PH'});renderRow('tvContent',d?.results?.slice(0,20),'tv');}
async function loadKDrama(){const d=await tmdb('/discover/tv',{with_origin_country:'KR',sort_by:'popularity.desc'});renderRow('kdramaContent',d?.results?.slice(0,20),'tv');}
async function loadAnime(){const d=await tmdb('/discover/tv',{with_genres:'16',with_origin_country:'JP',sort_by:'popularity.desc'});renderRow('animeContent',d?.results?.slice(0,20),'tv');}
async function loadMatureContent(){const d=await tmdb('/discover/movie',{certification_country:'US','certification.gte':'R',sort_by:'popularity.desc'});renderRow('matureContent',d?.results?.slice(0,20),'movie');}

/* ═══════════════════════════════════════════════════════
   CATEGORY
═══════════════════════════════════════════════════════ */
const CAT_MAP={
  trending: {ep:'/trending/all/week',p:{},                                                                       label:'🔥 Trending Now',  mv:false},
  movies:   {ep:'/discover/movie',   p:{sort_by:'popularity.desc'},                                              label:'🎬 Popular Movies',mv:true},
  tv:       {ep:'/discover/tv',      p:{sort_by:'popularity.desc'},                                              label:'📺 TV Series',     mv:false},
  kdrama:   {ep:'/discover/tv',      p:{with_origin_country:'KR',sort_by:'popularity.desc'},                     label:'🇰🇷 K-Drama',       mv:false},
  anime:    {ep:'/discover/tv',      p:{with_genres:'16',with_origin_country:'JP',sort_by:'popularity.desc'},    label:'🎌 Anime',         mv:false},
  top_rated:{ep:'/movie/top_rated',  p:{},                                                                       label:'⭐ Top Rated',     mv:true},
  now:      {ep:'/movie/now_playing',p:{},                                                                       label:'🆕 Now In Cinemas',mv:true},
};

async function loadCategory(cat,page=1){
  if(cat==='mature'){App.openMature();return;}
  const def=CAT_MAP[cat];if(!def)return;
  setNavActive(cat);showResultsView();setInfo(def.label,'⏳ Loading…');
  const d=await tmdb(def.ep,{...def.p,page});
  if(!d?.results?.length){setInfo(def.label,'⚠️ Failed to load. Please refresh.');renderGrid([]);return;}
  const items=d.results.map(r=>({...r,media_type:r.media_type||(def.mv?'movie':'tv')}));
  setInfo(def.label,`${(d.total_results||items.length).toLocaleString()} titles — Page ${page}`);
  renderGrid(items);
  makePagination(d.total_pages||1,page,p=>loadCategory(cat,p));
}

/* ═══════════════════════════════════════════════════════
   GENRE FILTER — THE CORE FIX

   This is called by patchGenreChips() which re-attaches
   ALL genre chip click handlers directly, bypassing
   whatever onclick="" the HTML originally had.
═══════════════════════════════════════════════════════ */
async function fetchGenre(gid, label, page=1) {
  console.log(`[Genre] Fetching gid=${gid} "${label}" page=${page}`);
  showResultsView();
  setInfo(label,'⏳ Loading…');

  /* Show skeleton while loading */
  const grid=qs('#sf-results-wrap')||(() => {
    const w=document.createElement('div'); w.id='sf-results-wrap';
    const rc=qs('#searchResultsContainer')||qs('#searchResults');
    if(rc){rc.innerHTML='';rc.appendChild(w);}else document.body.appendChild(w);
    return w;
  })();
  grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:14px;padding:10px 30px 24px;opacity:1;visibility:visible';
  grid.innerHTML=Array(12).fill(0).map(()=>`<div style="border-radius:8px;overflow:hidden;background:#1a1a1a"><div style="aspect-ratio:2/3;background:linear-gradient(110deg,#1a1a1a 30%,#252525 50%,#1a1a1a 70%);background-size:300% 100%;animation:sfShim 1.5s infinite"></div><div style="padding:9px"><div style="height:12px;background:#252525;border-radius:4px;margin-bottom:6px"></div><div style="height:10px;background:#1e1e1e;border-radius:4px;width:60%"></div></div></div>`).join('');

  const [mv,tv]=await Promise.all([
    tmdb('/discover/movie',{with_genres:gid,sort_by:'popularity.desc',page}),
    tmdb('/discover/tv',   {with_genres:gid,sort_by:'popularity.desc',page}),
  ]);

  console.log('[Genre] Movies:',mv?.total_results||0,'| TV:',tv?.total_results||0);

  if(!mv&&!tv){
    setInfo(label,'❌ API connection failed');
    grid.innerHTML='<p style="color:#e50914;padding:30px;text-align:center;grid-column:1/-1">❌ Could not connect to TMDB. Check internet.</p>';
    return;
  }

  const results=[
    ...(mv?.results||[]).map(r=>({...r,media_type:'movie'})),
    ...(tv?.results||[]).map(r=>({...r,media_type:'tv'})),
  ].sort((a,b)=>(b.popularity||0)-(a.popularity||0));

  const total=(mv?.total_results||0)+(tv?.total_results||0);
  const maxPages=Math.min(Math.max(mv?.total_pages||1,tv?.total_pages||1),500);

  console.log('[Genre] ✅ Rendering',results.length,'cards. Total:',total);

  setInfo(label,`${total.toLocaleString()} titles${page>1?' — Page '+page:''}`);
  renderGrid(results);
  makePagination(maxPages,page,p=>fetchGenre(gid,label,p));
}

/* ═══════════════════════════════════════════════════════
   PATCH GENRE CHIPS — THE KEY FUNCTION

   Finds ALL chip elements using multiple selectors,
   removes their existing onclick, and attaches a fresh
   addEventListener. This works no matter what the HTML says.
═══════════════════════════════════════════════════════ */
function patchGenreChips() {
  /* Collect chips from all possible selectors */
  const chips = [
    ...qsa('.gchip'),
    ...qsa('.genre-chip'),
    ...qsa('[data-g]'),
    ...qsa('[data-genre]'),
  ];

  /* Deduplicate */
  const seen = new Set();
  const unique = chips.filter(c => { if(seen.has(c)) return false; seen.add(c); return true; });

  console.log(`[Chips] Found ${unique.length} genre chips. Patching…`);

  unique.forEach(chip => {
    /* Determine the genre ID from any attribute */
    const rawId = chip.dataset.g || chip.dataset.genre || chip.dataset.id || '';
    const label  = chip.textContent.trim();
    /* Map to TMDB genre ID */
    const gid = GENRE_ID_MAP[rawId] || GENRE_ID_MAP[label.toLowerCase()] || rawId;

    /* Remove old onclick completely */
    chip.removeAttribute('onclick');
    chip.onclick = null;

    /* Clone to remove all existing event listeners */
    const fresh = chip.cloneNode(true);
    fresh.removeAttribute('onclick');
    chip.parentNode.replaceChild(fresh, chip);

    /* Attach brand new click handler */
    fresh.addEventListener('click', () => {
      console.log(`[Chip clicked] label="${label}" rawId="${rawId}" gid="${gid}"`);

      /* Highlight active chip */
      unique.forEach(c => {
        const fc = document.querySelector(`.gchip[data-g="${c.dataset.g}"],.genre-chip[data-genre="${c.dataset.genre}"]`) || c;
        fc.classList.remove('active');
      });
      qsa('.gchip,.genre-chip,[data-g],[data-genre]').forEach(c=>c.classList.remove('active'));
      fresh.classList.add('active');

      if (gid === 'all' || label.toLowerCase() === 'all') {
        goHome();
        return;
      }

      if (!gid || gid === 'undefined') {
        console.warn('[Chip] No genre ID found for:', label);
        return;
      }

      fetchGenre(gid, label, 1);
    });
  });

  console.log('[Chips] ✅ All genre chips patched!');
}

/* ═══════════════════════════════════════════════════════
   SEARCH
═══════════════════════════════════════════════════════ */
async function doSearch(page=1){
  const q=[qs('#searchInput'),qs('#msearchInp'),qs('#mobileSearchInput')].map(el=>el?.value?.trim()).find(v=>v)||S.searchQ;
  if(!q)return;S.searchQ=q;
  closeMSearch();showResultsView();
  setInfo(`Results for "<span style="color:#e50914">${q}</span>"`, '⏳ Searching…');
  const d=await tmdb('/search/multi',{query:q,page,include_adult:false});
  if(!d){setInfo('Search','⚠️ Search failed.');return;}
  const items=d.results.filter(r=>r.media_type!=='person');
  setInfo(`Results for "<span style="color:#e50914">${q}</span>"`,`${(d.total_results||0).toLocaleString()} results`);
  renderGrid(items);
  makePagination(Math.min(d.total_pages||1,500),page,p=>doSearch(p));
}

/* ═══════════════════════════════════════════════════════
   PAGINATION
═══════════════════════════════════════════════════════ */
function makePagination(totalPages,current,onPage){
  const el=qs('#pagination');if(!el)return;
  if(totalPages<=1){el.innerHTML='';return;}
  const max=Math.min(totalPages,500);
  let pages=[];
  if(max<=7)pages=Array.from({length:max},(_,i)=>i+1);
  else{pages=[1];if(current>3)pages.push('…');for(let i=Math.max(2,current-2);i<=Math.min(max-1,current+2);i++)pages.push(i);if(current<max-2)pages.push('…');pages.push(max);}
  el.innerHTML=pages.map(p=>p==='…'?`<span style="padding:8px 12px;opacity:.4">…</span>`:`<button class="page-btn ${p===current?'active':''}" style="padding:8px 16px;background:${p===current?'#e50914':'rgba(255,255,255,.1)'};border:1px solid ${p===current?'#e50914':'rgba(255,255,255,.2)'};border-radius:5px;color:#fff;cursor:pointer;font-size:.85rem" onclick="(${onPage.toString()})(${p})">${p}</button>`).join('');
}

/* ═══════════════════════════════════════════════════════
   VIEW HELPERS
═══════════════════════════════════════════════════════ */
function showResultsView(){
  const hero=qs('#hero')||qs('#heroSection');if(hero)hero.style.display='none';
  const main=qs('#mainContent');if(main)main.style.display='none';
  /* Force results container visible */
  const rc=qs('#searchResultsContainer')||qs('#searchResults');
  if(rc){rc.style.cssText='display:block;opacity:1;visibility:visible;min-height:300px';}
  const info=qs('#searchInfo');
  if(info){info.style.cssText='display:block;opacity:1';info.classList.add('active','on');}
}
function showHomeView(){
  const hero=qs('#hero')||qs('#heroSection');if(hero)hero.style.display='';
  const main=qs('#mainContent');if(main)main.style.display='';
  const rc=qs('#searchResultsContainer')||qs('#searchResults');if(rc)rc.style.display='none';
  /* Remove the dynamic grid wrapper */
  qs('#sf-results-wrap')?.remove();
  const info=qs('#searchInfo');if(info){info.classList.remove('active','on');info.style.display='';}
  qsa('.gchip,.genre-chip,[data-g],[data-genre]').forEach(c=>{
    const g=c.dataset.g||c.dataset.genre||'';c.classList.toggle('active',g==='all'||c.textContent.trim().toLowerCase()==='all');
  });
}
function setInfo(title,count){const t=qs('#searchTitle'),c=qs('#searchCount');if(t)t.innerHTML=title;if(c)c.textContent=count;}
function setNavActive(cat){qsa('.nav-links a,.nav-links li a').forEach(a=>a.classList.toggle('active',a.dataset.cat===cat));}

/* ═══════════════════════════════════════════════════════
   HOME
═══════════════════════════════════════════════════════ */
function goHome(){
  S.searchQ='';
  [qs('#searchInput'),qs('#msearchInp'),qs('#mobileSearchInput')].forEach(el=>{if(el)el.value='';});
  showHomeView();setNavActive('home');
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ═══════════════════════════════════════════════════════
   PLAYER
═══════════════════════════════════════════════════════ */
const SPINNER=`<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:14px;color:#888"><div style="width:40px;height:40px;border:3px solid rgba(255,255,255,.1);border-top-color:#e50914;border-radius:50%;animation:sfSpin 1s linear infinite"></div><span>Loading player…</span></div>`;

async function playById(tmdbId,type,title,year){
  const modal=qs('#playerModal'),ptitle=qs('#playerTitle'),pvideo=qs('#playerVideo');
  if(!modal||!pvideo)return;
  if(ptitle)ptitle.textContent=`${title}${year?' ('+year+')':''}`;
  modal.classList.add('active');document.body.style.overflow='hidden';pvideo.innerHTML=SPINNER;
  let imdb=null;try{imdb=await getImdbId(tmdbId,type);}catch(_){}
  const data={tmdb:String(tmdbId),imdb,type,title,year,season:1,episode:1};
  S.content=data;window.currentContent=data;
  buildServerBtns(data);setServer(0,data);
}
const playContentById=playById;
function buildServerBtns(data){const el=qs('#serverButtons');if(!el)return;el.innerHTML=SERVERS.map((s,i)=>`<button class="server-btn ${i===0?'active':''}" onclick='setServer(${i},${JSON.stringify(data).replace(/'/g,"&#39;")})'>${s.name}${s.sub?'<span class="sub-badge" style="background:#10b981;color:#fff;padding:1px 4px;border-radius:3px;font-size:.58rem;margin-left:3px;font-weight:700">CC</span>':''}</button>`).join('');}
function setServer(idx,data){qs('#playerVideo').innerHTML=`<iframe src="${SERVERS[idx].url(data)}" allowfullscreen allow="autoplay;fullscreen;picture-in-picture;encrypted-media" referrerpolicy="no-referrer-when-downgrade" style="width:100%;height:100%;border:none"></iframe>`;qsa('.server-btn').forEach((b,i)=>b.classList.toggle('active',i===idx));S.content={...(S.content||{}),...data};window.currentContent=S.content;}
const loadServer=setServer,loadServerButtons=buildServerBtns;
function closePlayer(){const modal=qs('#playerModal');if(modal)modal.classList.remove('active');document.body.style.overflow='';const pv=qs('#playerVideo');if(pv)pv.innerHTML=SPINNER;qs('#chatPanel')?.classList.remove('show');}

/* ═══════════════════════════════════════════════════════
   18+
═══════════════════════════════════════════════════════ */
function openMature(){if(S.matureOk&&Date.now()<S.matureExpiry){revealMature();return;}const vm=qs('#verifyModal');if(vm)vm.style.display='flex';showAgeStep();}
function showAgeStep(){qs('#vs1')?.classList.add('on','active');qs('#vs2')?.classList.remove('on','active');qs('#verifyStep1')?.classList.add('active');qs('#verifyStep2')?.classList.remove('active');}
function showPinStep(){qs('#vs1')?.classList.remove('on','active');qs('#vs2')?.classList.add('on','active');qs('#verifyStep1')?.classList.remove('active');qs('#verifyStep2')?.classList.add('active');setTimeout(()=>qsa('.pin-d,.pin-digit')[0]?.focus(),80);}
function closeVerify(){const vm=qs('#verifyModal');if(vm)vm.style.display='none';clearPins();setPinErr('');}
function verifyAge(){grantMature();closeVerify();revealMature();}
async function verifyPin(){const now=Date.now();if(now<S.pinLockUntil){setPinErr(`Locked. ${Math.ceil((S.pinLockUntil-now)/1000)}s`);return;}const pin=qsa('.pin-d,.pin-digit').map(i=>i.value).join('');if(pin.length<4){setPinErr('Enter all 4 digits.');return;}const hash=await sha256(pin),stored=localStorage.getItem('sf_pin');if(!stored){localStorage.setItem('sf_pin',hash);grantMature();closeVerify();revealMature();}else if(hash===stored){S.pinFails=0;grantMature();closeVerify();revealMature();}else{S.pinFails++;if(S.pinFails>=PIN_MAX){S.pinLockUntil=Date.now()+PIN_LOCK;S.pinFails=0;setPinErr('Locked 5 min.');}else setPinErr(`Wrong PIN — ${PIN_MAX-S.pinFails} tries left.`);clearPins();}}
function grantMature(){S.matureOk=true;S.matureExpiry=Date.now()+MATURE_TTL;setTimeout(()=>{S.matureOk=false;const s=qs('#section-mature');if(s)s.style.display='none';},MATURE_TTL);}
function revealMature(){const sec=qs('#section-mature');if(!sec)return;Object.assign(sec.style,{display:'',opacity:'1',transform:'none',animation:'none'});sec.classList.add('visible');sec.scrollIntoView({behavior:'smooth',block:'start'});const c=qs('#matureContent');if(c&&!c.children.length)loadMatureContent();}
function clearPins(){qsa('.pin-d,.pin-digit').forEach(i=>i.value='');}
function setPinErr(msg){[qs('#pinErr'),qs('#pinError'),qs('#lockoutTimer')].forEach(el=>{if(el)el.textContent=msg;});}
function initPinInputs(){const digits=qsa('.pin-d,.pin-digit');digits.forEach((inp,i)=>{inp.addEventListener('input',()=>{inp.value=inp.value.replace(/\D/g,'').slice(-1);if(inp.value&&i<digits.length-1)digits[i+1].focus();});inp.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!inp.value&&i>0)digits[i-1].focus();if(e.key==='Enter')verifyPin();});});}
async function sha256(str){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));return[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');}

/* ═══════════════════════════════════════════════════════
   MOBILE SEARCH
═══════════════════════════════════════════════════════ */
function openMSearch(){qs('#msearch,#mobileSearchOverlay')?.classList.add('on','open');(qs('#msearchInp')||qs('#mobileSearchInput'))?.focus();}
function closeMSearch(){qs('#msearch,#mobileSearchOverlay')?.classList.remove('on','open');}
function initMobileSearch(){const inp=qs('#msearchInp')||qs('#mobileSearchInput');if(!inp)return;let t;inp.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{if(inp.value.trim().length>1){const si=qs('#searchInput');if(si)si.value=inp.value.trim();doSearch(1);}},500);});inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&inp.value.trim()){const si=qs('#searchInput');if(si)si.value=inp.value.trim();doSearch(1);}});}

/* ═══════════════════════════════════════════════════════
   MISC
═══════════════════════════════════════════════════════ */
function scrollRow(cid,dir){qs('#'+cid)?.scrollBy({left:dir*650,behavior:'smooth'});}
function seeAll(cat){loadCategory(cat);window.scrollTo({top:0,behavior:'smooth'});}
function setNavItem(id){qsa('.bni').forEach(b=>b.classList.remove('active'));qs('#bn-'+id)?.classList.add('active');}
function openSettings(){alert('⚙️ StreamFlix Settings\n\n🔐 Parental PIN:\nFirst PIN you enter becomes your PIN.\nReset: clear site data in browser.\n\n🚫 Ad-Blocking:\n• Mobile: Firefox + uBlock Origin\n• Desktop: Chrome/Edge + uBlock Origin\n• Servers 1 & 2 = fewest ads');}
function initNavScroll(){window.addEventListener('scroll',()=>{const nav=qs('#navbar');if(!nav)return;const s=window.scrollY>50;nav.classList.toggle('solid',s);nav.classList.toggle('scrolled',s);},{passive:true});}
function initWheelScroll(){qsa('.row-scroll,.content-row').forEach(row=>{row.addEventListener('wheel',e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY))return;e.preventDefault();row.scrollBy({left:e.deltaY*3});},{passive:false});});}
function initSectionReveal(){qsa('.content-section,.fade-in').forEach(s=>{s.classList.add('visible');s.style.opacity='1';});}
function initInstall(){let dp;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();dp=e;const b=qs('#installBanner');if(b&&!localStorage.getItem('sf_installed'))b.classList.add('show');});qs('#installBtn')?.addEventListener('click',async()=>{if(!dp)return;dp.prompt();const{outcome}=await dp.userChoice;if(outcome==='accepted')qs('#installBanner').classList.remove('show');dp=null;});qs('#closeBanner')?.addEventListener('click',()=>{qs('#installBanner').classList.remove('show');localStorage.setItem('sf_installed','1');});}
function initKeys(){document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(qs('#playerModal')?.classList.contains('active'))closePlayer();if(qs('#verifyModal')?.style.display==='flex')closeVerify();closeMSearch();}});qs('#searchInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')doSearch(1);});}

/* ═══════════════════════════════════════════════════════
   App NAMESPACE + GLOBALS
═══════════════════════════════════════════════════════ */
const App={
  goHome,loadCat:loadCategory,doSearch:()=>doSearch(1),
  genreFilter:fetchGenre,filterGenre:fetchGenre,
  scrollR:scrollRow,seeAll,closePlayer,openMSearch,closeMSearch,
  setNav:setNavItem,openSettings,openMature,verifyAge,
  showPin:showPinStep,showAge:showAgeStep,closeVerify,verifyPin,
  toggleMobileSearch:openMSearch,
};
window.App=App;
Object.assign(window,{
  playContentById,playById,loadServer,setServer,loadServerButtons,buildServerBtns,
  closePlayer,loadCategory,goHome,seeAll,
  performMainSearch:()=>doSearch(1),
  filterByGenre:id=>fetchGenre(String(id),Object.entries({28:'Action',18:'Drama',35:'Comedy',53:'Thriller',10749:'Romance',878:'Sci-Fi',27:'Horror',14:'Fantasy',16:'Animation',99:'Documentary'}).find(([k])=>k===String(id))?.[1]||'Genre',1),
  scrollRow,scrollR:scrollRow,openMature,verifyAge,verifyPin,
  showPinStep,showAgeStep,closeVerify,openSettings,openMSearch,closeMSearch,setNavItem,
  showWatchTogetherMenu:()=>qs('#watchTogetherMenu')?.classList.add('open'),
  closeWatchTogetherMenu:()=>qs('#watchTogetherMenu')?.classList.remove('open'),
  showJoinRoomDialog:()=>qs('#joinRoomModal')?.classList.add('open'),
  closeJoinRoomDialog:()=>qs('#joinRoomModal')?.classList.remove('open'),
  closeRoomCreatedModal:()=>qs('#roomCreatedModal')?.classList.remove('open'),
  toggleChatPanel:()=>qs('#chatPanel')?.classList.toggle('show'),
});

/* Keyframes */
function injectKeyframes(){if(qs('#sf-kf'))return;const s=document.createElement('style');s.id='sf-kf';s.textContent=`@keyframes sfShim{0%{background-position:100% 0}100%{background-position:-100% 0}}@keyframes sfFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes sfSpin{to{transform:rotate(360deg)}}`;document.head.appendChild(s);}

/* ═══════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  injectKeyframes();
  buildHero();
  initSectionReveal();
  initNavScroll();
  initPinInputs();
  initKeys();
  initInstall();
  initMobileSearch();
  document.addEventListener('contextmenu',e=>{if(e.target.closest('#playerVideo'))e.preventDefault();});

  /* ★ PATCH ALL GENRE CHIPS — runs after DOM is ready */
  patchGenreChips();

  /* Load home rows */
  await Promise.all([loadTrending(),loadMovies(),loadTV(),loadKDrama(),loadAnime()]);
  initWheelScroll();

  console.log('%c✅ StreamFlix 3.6 ready — genre chips auto-patched!','color:lime;font-weight:bold');
  console.log('%c💡 Manual test: fetchGenre("28","Action")','color:#f5c518');

  if(typeof initFirebase==='function'){try{await initFirebase();}catch(e){console.warn('[Firebase]',e.message);}}
});
