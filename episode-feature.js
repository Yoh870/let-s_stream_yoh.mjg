/* ═══════════════════════════════════════════════════════════
   STREAMFLIX — Episode Selector Patch
   Drop this AFTER app.js in your index.html
   Features:
   - Season/Episode selector panel
   - Next & Previous episode buttons
   - "Latest" episode badge
   - Continue Watching (remembers last episode)
   ═══════════════════════════════════════════════════════════ */

/* ── Storage helpers ── */
const CW_KEY = 'sf_continue_watching';

function saveContinueWatching(tmdbId, data) {
  try {
    const all = JSON.parse(localStorage.getItem(CW_KEY) || '{}');
    all[tmdbId] = { ...data, savedAt: Date.now() };
    // Keep only last 20
    const keys = Object.keys(all).sort((a, b) => (all[b].savedAt || 0) - (all[a].savedAt || 0));
    if (keys.length > 20) keys.slice(20).forEach(k => delete all[k]);
    localStorage.setItem(CW_KEY, JSON.stringify(all));
  } catch (_) {}
}

function getContinueWatching(tmdbId) {
  try {
    const all = JSON.parse(localStorage.getItem(CW_KEY) || '{}');
    return all[tmdbId] || null;
  } catch (_) { return null; }
}

/* ── Episode State ── */
const EP = {
  tmdbId: null,
  type: null,
  title: null,
  year: null,
  seasons: [],       // [{season_number, episode_count, name}]
  currentSeason: 1,
  currentEpisode: 1,
  totalEpisodesInSeason: 1,
  latestSeason: 1,
  latestEpisode: 1,
};

/* ── Fetch season info from TMDB ── */
async function fetchSeasons(tmdbId) {
  const d = await tmdb(`/tv/${tmdbId}`);
  if (!d) return [];
  return (d.seasons || [])
    .filter(s => s.season_number > 0)
    .map(s => ({
      season_number: s.season_number,
      episode_count: s.episode_count,
      name: s.name || `Season ${s.season_number}`,
      air_date: s.air_date || '',
    }));
}

async function fetchEpisodeCount(tmdbId, seasonNum) {
  const d = await tmdb(`/tv/${tmdbId}/season/${seasonNum}`);
  return d?.episodes?.length || 0;
}

/* ── Inject episode panel HTML into the player modal ── */
function injectEpisodePanel() {
  if (document.getElementById('sf-ep-panel')) return;

  const style = document.createElement('style');
  style.textContent = `
    #sf-ep-panel {
      background: #111;
      border-top: 1px solid #222;
      padding: 0;
      display: none;
      flex-direction: column;
      max-height: 380px;
      overflow: hidden;
    }
    #sf-ep-panel.visible { display: flex; }

    .sf-ep-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px 8px;
      border-bottom: 1px solid #1e1e1e;
      flex-wrap: wrap;
    }
    .sf-ep-header h4 {
      margin: 0;
      color: #fff;
      font-size: .85rem;
      font-weight: 700;
      flex: 1;
      white-space: nowrap;
    }

    /* Season selector */
    #sf-season-select {
      background: #1e1e1e;
      color: #fff;
      border: 1px solid #333;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: .8rem;
      cursor: pointer;
      outline: none;
    }
    #sf-season-select:focus { border-color: #e50914; }

    /* Nav buttons */
    .sf-ep-nav {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .sf-ep-nav button {
      background: #1e1e1e;
      color: #ccc;
      border: 1px solid #333;
      border-radius: 6px;
      padding: 5px 12px;
      font-size: .78rem;
      cursor: pointer;
      transition: background .2s, color .2s, border-color .2s;
      white-space: nowrap;
    }
    .sf-ep-nav button:hover:not(:disabled) {
      background: #e50914;
      color: #fff;
      border-color: #e50914;
    }
    .sf-ep-nav button:disabled {
      opacity: .35;
      cursor: not-allowed;
    }
    .sf-ep-nav button.next-ep {
      background: #e50914;
      color: #fff;
      border-color: #e50914;
      font-weight: 700;
    }
    .sf-ep-nav button.next-ep:hover:not(:disabled) {
      background: #ff1f1f;
    }

    /* Episode grid */
    #sf-ep-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
      gap: 7px;
      padding: 12px 16px;
      overflow-y: auto;
      max-height: 260px;
    }
    #sf-ep-grid::-webkit-scrollbar { width: 4px; }
    #sf-ep-grid::-webkit-scrollbar-track { background: #111; }
    #sf-ep-grid::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }

    .sf-ep-btn {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      color: #aaa;
      border-radius: 6px;
      padding: 8px 4px;
      font-size: .75rem;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: all .18s;
      position: relative;
    }
    .sf-ep-btn:hover {
      background: #2a2a2a;
      color: #fff;
      border-color: #444;
      transform: translateY(-1px);
    }
    .sf-ep-btn.active {
      background: #e50914;
      border-color: #e50914;
      color: #fff;
    }
    .sf-ep-btn .latest-badge {
      position: absolute;
      top: -6px;
      right: -4px;
      background: #10b981;
      color: #fff;
      font-size: .5rem;
      font-weight: 800;
      padding: 1px 4px;
      border-radius: 3px;
      letter-spacing: .5px;
      text-transform: uppercase;
    }
    .sf-ep-btn .saved-dot {
      position: absolute;
      bottom: 3px;
      right: 4px;
      width: 5px;
      height: 5px;
      background: #f5c518;
      border-radius: 50%;
    }

    /* Current playing label */
    #sf-now-playing {
      padding: 6px 16px 10px;
      font-size: .75rem;
      color: #666;
      border-top: 1px solid #1a1a1a;
    }
    #sf-now-playing span { color: #e50914; font-weight: 600; }

    /* Continue watching banner */
    #sf-cw-banner {
      display: none;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, #1a1a1a, #111);
      border: 1px solid #e50914;
      border-radius: 8px;
      padding: 10px 14px;
      margin: 8px 16px 0;
      cursor: pointer;
      transition: background .2s;
    }
    #sf-cw-banner:hover { background: #1e1e1e; }
    #sf-cw-banner.visible { display: flex; }
    #sf-cw-banner .cw-icon { font-size: 1.3rem; }
    #sf-cw-banner .cw-text { flex: 1; }
    #sf-cw-banner .cw-text strong { color: #fff; font-size: .82rem; display: block; }
    #sf-cw-banner .cw-text small { color: #888; font-size: .72rem; }
    #sf-cw-banner .cw-play {
      background: #e50914;
      color: #fff;
      border: none;
      border-radius: 5px;
      padding: 5px 12px;
      font-size: .75rem;
      font-weight: 700;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  // Find the player modal — inject panel inside it
  const modal = document.getElementById('playerModal');
  if (!modal) return;

  const panel = document.createElement('div');
  panel.id = 'sf-ep-panel';
  panel.innerHTML = `
    <div id="sf-cw-banner">
      <div class="cw-icon">▶️</div>
      <div class="cw-text">
        <strong id="sf-cw-label">Continue Watching</strong>
        <small id="sf-cw-sub">Pick up where you left off</small>
      </div>
      <button class="cw-play" id="sf-cw-btn">Resume</button>
    </div>
    <div class="sf-ep-header">
      <h4>📺 Episodes</h4>
      <select id="sf-season-select"></select>
      <div class="sf-ep-nav">
        <button id="sf-prev-btn" onclick="sfPrevEp()" title="Previous Episode">◀ Prev</button>
        <button id="sf-next-btn" class="next-ep" onclick="sfNextEp()" title="Next Episode">Next ▶</button>
      </div>
    </div>
    <div id="sf-ep-grid"></div>
    <div id="sf-now-playing">Now playing: <span id="sf-ep-label">—</span></div>
  `;

  // Insert panel below the video player inside the modal
  const video = document.getElementById('playerVideo');
  const serverBtns = document.getElementById('serverButtons');
  if (serverBtns) {
    serverBtns.parentNode.insertBefore(panel, serverBtns.nextSibling);
  } else if (video) {
    video.parentNode.insertBefore(panel, video.nextSibling);
  } else {
    modal.appendChild(panel);
  }

  // Season dropdown change
  document.getElementById('sf-season-select').addEventListener('change', async function () {
    const s = parseInt(this.value);
    EP.currentSeason = s;
    EP.currentEpisode = 1;
    await buildEpGrid(EP.tmdbId, s);
    sfPlayEpisode(EP.tmdbId, s, 1);
  });

  // Continue watching button
  document.getElementById('sf-cw-btn').addEventListener('click', () => {
    const cw = getContinueWatching(EP.tmdbId);
    if (cw) {
      EP.currentSeason = cw.season;
      EP.currentEpisode = cw.episode;
      document.getElementById('sf-season-select').value = cw.season;
      buildEpGrid(EP.tmdbId, cw.season).then(() => {
        sfPlayEpisode(EP.tmdbId, cw.season, cw.episode);
      });
    }
  });
}

/* ── Build episode grid for a season ── */
async function buildEpGrid(tmdbId, seasonNum) {
  const grid = document.getElementById('sf-ep-grid');
  if (!grid) return;

  grid.innerHTML = `<div style="color:#666;font-size:.8rem;padding:10px;grid-column:1/-1">Loading episodes…</div>`;

  const count = await fetchEpisodeCount(tmdbId, seasonNum);
  EP.totalEpisodesInSeason = count || 1;

  // If this is the latest season, mark the latest episode
  const isLatestSeason = (seasonNum === EP.latestSeason);
  const latestEp = isLatestSeason ? EP.latestEpisode : null;

  // Get saved progress
  const cw = getContinueWatching(tmdbId);
  const savedEp = (cw && cw.season === seasonNum) ? cw.episode : null;

  grid.innerHTML = '';
  for (let ep = 1; ep <= count; ep++) {
    const btn = document.createElement('button');
    btn.className = 'sf-ep-btn' + (ep === EP.currentEpisode && seasonNum === EP.currentSeason ? ' active' : '');
    btn.setAttribute('data-ep', ep);
    btn.title = `Episode ${ep}`;

    let inner = `Ep ${ep}`;
    if (isLatestSeason && ep === latestEp) {
      inner += `<span class="latest-badge">NEW</span>`;
    }
    if (savedEp && ep === savedEp && ep !== EP.currentEpisode) {
      inner += `<span class="saved-dot" title="Saved progress"></span>`;
    }
    btn.innerHTML = inner;

    btn.addEventListener('click', () => {
      EP.currentEpisode = ep;
      EP.currentSeason = seasonNum;
      sfPlayEpisode(tmdbId, seasonNum, ep);
    });
    grid.appendChild(btn);
  }

  updateNavButtons();
  updateNowPlayingLabel();
}

/* ── Play specific episode ── */
function sfPlayEpisode(tmdbId, season, episode) {
  const data = {
    tmdb: String(tmdbId),
    imdb: window.currentContent?.imdb || null,
    type: 'tv',
    title: EP.title,
    year: EP.year,
    season,
    episode,
  };

  EP.currentSeason = season;
  EP.currentEpisode = episode;
  window.currentContent = { ...window.currentContent, ...data };
  if (window.S) window.S.content = window.currentContent;

  // Use existing setServer
  const activeServerBtn = document.querySelector('.server-btn.active');
  const serverIdx = activeServerBtn
    ? [...document.querySelectorAll('.server-btn')].indexOf(activeServerBtn)
    : 0;
  setServer(serverIdx, data);
  buildServerBtns(data);

  // Update grid active state
  document.querySelectorAll('.sf-ep-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.ep) === episode);
  });

  // Scroll active ep into view
  const activeBtn = document.querySelector(`.sf-ep-btn[data-ep="${episode}"]`);
  activeBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Save continue watching
  saveContinueWatching(tmdbId, {
    season, episode,
    title: EP.title,
    year: EP.year,
    type: 'tv',
  });

  updateNavButtons();
  updateNowPlayingLabel();
}

/* ── Next / Prev episode ── */
function sfNextEp() {
  if (EP.currentEpisode < EP.totalEpisodesInSeason) {
    EP.currentEpisode++;
    sfPlayEpisode(EP.tmdbId, EP.currentSeason, EP.currentEpisode);
  } else {
    // Go to next season
    const nextSeason = EP.currentSeason + 1;
    const seasonExists = EP.seasons.find(s => s.season_number === nextSeason);
    if (seasonExists) {
      EP.currentSeason = nextSeason;
      EP.currentEpisode = 1;
      document.getElementById('sf-season-select').value = nextSeason;
      buildEpGrid(EP.tmdbId, nextSeason).then(() => {
        sfPlayEpisode(EP.tmdbId, nextSeason, 1);
      });
    }
  }
}

function sfPrevEp() {
  if (EP.currentEpisode > 1) {
    EP.currentEpisode--;
    sfPlayEpisode(EP.tmdbId, EP.currentSeason, EP.currentEpisode);
  } else {
    // Go to prev season last episode
    const prevSeason = EP.currentSeason - 1;
    const seasonData = EP.seasons.find(s => s.season_number === prevSeason);
    if (seasonData) {
      EP.currentSeason = prevSeason;
      document.getElementById('sf-season-select').value = prevSeason;
      buildEpGrid(EP.tmdbId, prevSeason).then(() => {
        EP.currentEpisode = EP.totalEpisodesInSeason;
        sfPlayEpisode(EP.tmdbId, prevSeason, EP.currentEpisode);
      });
    }
  }
}

function updateNavButtons() {
  const prev = document.getElementById('sf-prev-btn');
  const next = document.getElementById('sf-next-btn');
  if (!prev || !next) return;

  const hasPrev = EP.currentEpisode > 1 || EP.currentSeason > 1;
  const hasNext = EP.currentEpisode < EP.totalEpisodesInSeason ||
    EP.seasons.some(s => s.season_number === EP.currentSeason + 1);

  prev.disabled = !hasPrev;
  next.disabled = !hasNext;

  // Update next button label
  if (EP.currentEpisode < EP.totalEpisodesInSeason) {
    next.textContent = `Next ▶`;
  } else if (EP.seasons.some(s => s.season_number === EP.currentSeason + 1)) {
    next.textContent = `Season ${EP.currentSeason + 1} ▶`;
  } else {
    next.textContent = `Next ▶`;
  }
}

function updateNowPlayingLabel() {
  const label = document.getElementById('sf-ep-label');
  if (label) {
    label.textContent = `Season ${EP.currentSeason}, Episode ${EP.currentEpisode}`;
  }
}

/* ── Override playById to inject episode panel for TV ── */
const _originalPlayById = window.playById;

window.playById = async function (tmdbId, type, title, year) {
  // Call original first
  await _originalPlayById(tmdbId, type, title, year);

  const panel = document.getElementById('sf-ep-panel');

  if (type !== 'tv') {
    // Movie — hide episode panel
    if (panel) panel.classList.remove('visible');
    return;
  }

  // TV Series — show episode panel
  injectEpisodePanel();

  EP.tmdbId = tmdbId;
  EP.type = type;
  EP.title = title;
  EP.year = year;
  EP.currentSeason = 1;
  EP.currentEpisode = 1;

  const epPanel = document.getElementById('sf-ep-panel');
  if (epPanel) epPanel.classList.add('visible');

  // Load seasons
  const grid = document.getElementById('sf-ep-grid');
  if (grid) grid.innerHTML = `<div style="color:#666;font-size:.8rem;padding:10px;grid-column:1/-1">Loading seasons…</div>`;

  const seasons = await fetchSeasons(tmdbId);
  EP.seasons = seasons;

  if (!seasons.length) {
    // Fallback: just show episodes 1-20
    EP.latestSeason = 1;
    EP.latestEpisode = 1;
    buildEpGrid(tmdbId, 1);
    return;
  }

  // Determine latest season/episode
  const latestSeason = seasons[seasons.length - 1];
  EP.latestSeason = latestSeason.season_number;
  EP.latestEpisode = latestSeason.episode_count;

  // Build season dropdown
  const sel = document.getElementById('sf-season-select');
  if (sel) {
    sel.innerHTML = seasons.map(s =>
      `<option value="${s.season_number}">${s.name}${s.season_number === EP.latestSeason ? ' 🆕' : ''}</option>`
    ).join('');
    sel.value = 1;
  }

  // Show continue watching banner if applicable
  const cw = getContinueWatching(tmdbId);
  const cwBanner = document.getElementById('sf-cw-banner');
  if (cw && cwBanner) {
    document.getElementById('sf-cw-label').textContent = `Continue: ${title}`;
    document.getElementById('sf-cw-sub').textContent =
      `Season ${cw.season}, Episode ${cw.episode} — saved ${timeAgo(cw.savedAt)}`;
    cwBanner.classList.add('visible');

    // Auto-load saved episode
    EP.currentSeason = cw.season;
    EP.currentEpisode = cw.episode;
    if (sel) sel.value = cw.season;
    await buildEpGrid(tmdbId, cw.season);
    sfPlayEpisode(tmdbId, cw.season, cw.episode);
  } else {
    if (cwBanner) cwBanner.classList.remove('visible');
    await buildEpGrid(tmdbId, 1);
  }
};

// Also override playContentById
window.playContentById = window.playById;

/* ── Time ago helper ── */
function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

/* ── Init on load ── */
document.addEventListener('DOMContentLoaded', () => {
  injectEpisodePanel();
  console.log('%c✅ Episode Selector loaded!', 'color:lime;font-weight:bold');
});
