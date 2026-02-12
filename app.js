// TMDB API Configuration
const TMDB_API_KEY = '3fd2be6f0c70a2a598f084ddfb75487c';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Streaming servers
const servers = [
    { name: 'VidSrc.to', getUrl: (data) => `https://vidsrc.to/embed/${data.type}/${data.tmdb}` },
    { name: 'VidSrc.xyz', getUrl: (data) => `https://vidsrc.xyz/embed/${data.type}?tmdb=${data.tmdb}` },
    { name: 'VidSrc.me', getUrl: (data) => `https://vidsrc.me/embed/${data.type}?tmdb=${data.tmdb}` },
    { name: 'Embed.su', getUrl: (data) => `https://embed.su/embed/${data.type}/${data.tmdb}` },
    { name: '2Embed', getUrl: (data) => `https://www.2embed.cc/embed/${data.imdb || 'tt' + data.tmdb}` },
    { name: 'SuperEmbed', getUrl: (data) => `https://multiembed.mov/?video_id=${data.imdb || 'tt' + data.tmdb}&tmdb=1` },
    { name: 'AutoEmbed', getUrl: (data) => `https://autoembed.cc/${data.type}/tmdb/${data.tmdb}` },
    { name: 'VidLink', getUrl: (data) => `https://vidlink.pro/${data.type}/${data.tmdb}` }
];

let currentContent = null;
let currentPage = 1;
let totalPages = 1;
let deferredPrompt = null;

// PWA Installation
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

// Install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBanner').classList.add('show');
});

document.getElementById('installBtn').addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response: ${outcome}`);
        deferredPrompt = null;
        document.getElementById('installBanner').classList.remove('show');
    }
});

document.getElementById('closeBanner').addEventListener('click', () => {
    document.getElementById('installBanner').classList.remove('show');
});

// Check if app is installed
window.addEventListener('appinstalled', () => {
    console.log('StreamFlix app installed');
    document.getElementById('installBanner').classList.remove('show');
});

// TMDB API Functions
async function fetchTMDB(endpoint) {
    try {
        const response = await fetch(`https://api.themoviedb.org/3${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`);
        return await response.json();
    } catch (error) {
        console.error('TMDB Error:', error);
        return null;
    }
}

async function getExternalIds(id, type) {
    const data = await fetchTMDB(`/${type}/${id}/external_ids`);
    return data?.imdb_id || `tt${id}`;
}

// Load Content Functions
async function loadAllContent() {
    await Promise.all([
        loadTrending(),
        loadPopularMovies(),
        loadPopularTV(),
        loadKDrama(),
        loadAnime()
    ]);
}

async function loadTrending() {
    const data = await fetchTMDB('/trending/all/week');
    if (data?.results) displayContent('trendingContent', data.results.slice(0, 10));
}

async function loadPopularMovies() {
    const data = await fetchTMDB('/movie/popular');
    if (data?.results) displayContent('moviesContent', data.results.slice(0, 10));
}

async function loadPopularTV() {
    const data = await fetchTMDB('/tv/popular');
    if (data?.results) displayContent('tvContent', data.results.slice(0, 10));
}

async function loadKDrama() {
    const data = await fetchTMDB('/discover/tv?with_origin_country=KR&sort_by=popularity.desc');
    if (data?.results) displayContent('kdramaContent', data.results.slice(0, 10));
}

async function loadAnime() {
    const data = await fetchTMDB('/discover/tv?with_genres=16&with_origin_country=JP&sort_by=popularity.desc');
    if (data?.results) displayContent('animeContent', data.results.slice(0, 10));
}

function displayContent(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = items.map(item => createCard(item)).join('');
}

function createCard(item) {
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').split('-')[0];
    const type = item.media_type || (item.title ? 'movie' : 'tv');
    const poster = item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : 'https://via.placeholder.com/300x450?text=No+Poster';
    const rating = item.vote_average?.toFixed(1) || 'N/A';
    
    return `
        <div class="content-card" onclick='playContentById(${item.id}, "${type}", "${title.replace(/'/g, "\\'")}",  "${year}")'>
            <div class="rating-badge">⭐ ${rating}</div>
            <div class="type-badge">${type.toUpperCase()}</div>
            <img src="${poster}" alt="${title}" class="card-image" loading="lazy">
            <div class="play-overlay">▶</div>
            <div class="card-overlay">
                <div class="card-title">${title}</div>
                <div class="card-meta">
                    <span>${year || 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
}

// Search Functions
async function performMainSearch(page = 1) {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        alert('Please enter a search term');
        return;
    }

    currentPage = page;
    
    document.getElementById('heroSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('searchResultsContainer').style.display = 'block';
    document.getElementById('searchInfo').classList.add('active');

    const data = await fetchTMDB(`/search/multi?query=${encodeURIComponent(query)}&page=${page}`);
    
    if (data?.results) {
        const filtered = data.results.filter(item => item.media_type !== 'person');
        
        document.getElementById('searchTitle').textContent = `Results for "${query}"`;
        document.getElementById('searchCount').textContent = `Found ${data.total_results} results`;
        
        displayContent('searchResultsContent', filtered);
        
        totalPages = data.total_pages;
        setupPagination();
    } else {
        document.getElementById('searchResultsContent').innerHTML = '<p style="text-align: center; padding: 50px;">No results found</p>';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupPagination() {
    const container = document.getElementById('pagination');
    let buttons = [];

    if (currentPage > 1) {
        buttons.push(`<button class="page-btn" onclick="performMainSearch(${currentPage - 1})">← Prev</button>`);
    }

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        buttons.push(`<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="performMainSearch(${i})">${i}</button>`);
    }

    if (currentPage < totalPages) {
        buttons.push(`<button class="page-btn" onclick="performMainSearch(${currentPage + 1})">Next →</button>`);
    }

    container.innerHTML = buttons.join('');
}

// Category Functions
async function loadCategory(category) {
    document.getElementById('heroSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('searchResultsContainer').style.display = 'block';
    document.getElementById('searchInfo').classList.add('active');

    let endpoint = '';
    let title = '';

    switch(category) {
        case 'trending':
            endpoint = '/trending/all/week?page=1';
            title = 'Trending Now';
            break;
        case 'movies':
            endpoint = '/movie/popular?page=1';
            title = 'Popular Movies';
            break;
        case 'tv':
            endpoint = '/tv/popular?page=1';
            title = 'Popular TV Series';
            break;
        case 'kdrama':
            endpoint = '/discover/tv?with_origin_country=KR&sort_by=popularity.desc&page=1';
            title = 'Korean Drama';
            break;
        case 'anime':
            endpoint = '/discover/tv?with_genres=16&with_origin_country=JP&sort_by=popularity.desc&page=1';
            title = 'Anime';
            break;
    }

    const data = await fetchTMDB(endpoint);
    
    if (data?.results) {
        document.getElementById('searchTitle').textContent = title;
        document.getElementById('searchCount').textContent = `${data.total_results} titles`;
        displayContent('searchResultsContent', data.results);
        document.getElementById('pagination').innerHTML = '';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goHome() {
    document.getElementById('heroSection').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('searchResultsContainer').style.display = 'none';
    document.getElementById('searchInfo').classList.remove('active');
    document.getElementById('searchInput').value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Player Functions
async function playContentById(tmdbId, type, title, year) {
    const imdb = await getExternalIds(tmdbId, type);
    playContent({
        tmdb: tmdbId.toString(),
        imdb: imdb,
        type: type,
        title: title,
        year: year
    });
}

function playContent(data) {
    currentContent = data;
    document.getElementById('playerTitle').textContent = `${data.title} (${data.year})`;
    document.getElementById('playerModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    loadServerButtons();
    loadServer(0);
}

function loadServerButtons() {
    document.getElementById('serverButtons').innerHTML = servers.map((server, index) => 
        `<button class="server-btn ${index === 0 ? 'active' : ''}" onclick="loadServer(${index})">${server.name}</button>`
    ).join('');
}

function loadServer(serverIndex) {
    const playerVideo = document.getElementById('playerVideo');
    try {
        const embedUrl = servers[serverIndex].getUrl(currentContent);
        playerVideo.innerHTML = `<iframe src="${embedUrl}" allowfullscreen allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="origin"></iframe>`;
        document.querySelectorAll('.server-btn').forEach((btn, index) => {
            btn.classList.toggle('active', index === serverIndex);
        });
    } catch (error) {
        playerVideo.innerHTML = `<div class="loading"><span style="color: var(--accent-red);">Error loading. Try another server.</span></div>`;
    }
}

function closePlayer() {
    document.getElementById('playerModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    document.getElementById('playerVideo').innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading...</span></div>';
}

// Event Listeners
document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performMainSearch();
});

window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 50);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('playerModal').classList.contains('active')) {
        closePlayer();
    }
});

// Initialize on load
window.addEventListener('load', () => {
    loadAllContent();
    
    // Handle URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    if (action === 'search') {
        document.getElementById('searchInput').focus();
    } else if (action === 'trending') {
        loadCategory('trending');
    }
});

// Prevent zoom on double tap (mobile)
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);
