// ===========================
// STREAMFLIX - MAIN APP
// ===========================


const TMDB_API_KEY = '3fd2be6f0c70a2a598f084ddfb75487c';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

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

// Fetch TMDB data
async function fetchTMDB(endpoint) {
    try {
        const url = `${TMDB_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error('TMDB Error:', error);
        return null;
    }
}

// Get external IDs
async function getExternalIds(id, type) {
    const data = await fetchTMDB(`/${type}/${id}/external_ids`);
    return data?.imdb_id || `tt${id}`;
}

// Load trending content
async function loadTrending() {
    const data = await fetchTMDB('/trending/all/week');
    if (data?.results) {
        displayContent('trendingContent', data.results.slice(0, 10));
    }
}

// Load movies
async function loadMovies() {
    const data = await fetchTMDB('/movie/popular');
    if (data?.results) {
        displayContent('moviesContent', data.results.slice(0, 10));
    }
}

// Load TV
async function loadTV() {
    const data = await fetchTMDB('/tv/popular');
    if (data?.results) {
        displayContent('tvContent', data.results.slice(0, 10));
    }
}

// Load K-Drama
async function loadKDrama() {
    const data = await fetchTMDB('/discover/tv?with_origin_country=KR&sort_by=popularity.desc');
    if (data?.results) {
        displayContent('kdramaContent', data.results.slice(0, 10));
    }
}

// Load Anime
async function loadAnime() {
    const data = await fetchTMDB('/discover/tv?with_genres=16&with_origin_country=JP&sort_by=popularity.desc');
    if (data?.results) {
        displayContent('animeContent', data.results.slice(0, 10));
    }
}

// Display content
function displayContent(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = items.map(item => {
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
    }).join('');
}

// Play content
async function playContentById(tmdbId, type, title, year) {
    try {
        const imdb = await getExternalIds(tmdbId, type);
        const data = {
            tmdb: tmdbId.toString(),
            imdb: imdb,
            type: type,
            title: title,
            year: year,
            serverIndex: 0
        };
        
        // IMPORTANT: Set currentContent globally
        currentContent = data;
        window.currentContent = data;  // Also set on window object
        
        console.log('✅ Content loaded:', currentContent);
        
        document.getElementById('playerTitle').textContent = `${title} (${year})`;
        document.getElementById('playerModal').classList.add('active');
        document.body.style.overflow = 'hidden';
        
        loadServerButtons(data);
        loadServer(0, data);
        
    } catch (error) {
        console.error('❌ Play content failed:', error);
        alert('Failed to load content');
    }
}

// Load server buttons
function loadServerButtons(data) {
    const container = document.getElementById('serverButtons');
    container.innerHTML = servers.map((server, index) => 
        `<button class="server-btn ${index === 0 ? 'active' : ''}" onclick='loadServer(${index}, ${JSON.stringify(data)})'>${server.name}</button>`
    ).join('');
}

// Load server
function loadServer(index, data) {
    const playerVideo = document.getElementById('playerVideo');
    const url = servers[index].getUrl(data);
    
    playerVideo.innerHTML = `<iframe src="${url}" allowfullscreen allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="origin"></iframe>`;
    
    document.querySelectorAll('.server-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });
}

// Close player
function closePlayer() {
    document.getElementById('playerModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    document.getElementById('playerVideo').innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading...</span></div>';
}

// Search
async function performMainSearch(page = 1) {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
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
    }
}

// Category
async function loadCategory(category) {
    document.getElementById('heroSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('searchResultsContainer').style.display = 'block';
    document.getElementById('searchInfo').classList.add('active');
    
    let endpoint = '';
    let title = '';
    
    switch(category) {
        case 'trending':
            endpoint = '/trending/all/week';
            title = 'Trending Now';
            break;
        case 'movies':
            endpoint = '/movie/popular';
            title = 'Popular Movies';
            break;
        case 'tv':
            endpoint = '/tv/popular';
            title = 'Popular TV Series';
            break;
        case 'kdrama':
            endpoint = '/discover/tv?with_origin_country=KR&sort_by=popularity.desc';
            title = 'Korean Drama';
            break;
        case 'anime':
            endpoint = '/discover/tv?with_genres=16&with_origin_country=JP&sort_by=popularity.desc';
            title = 'Anime';
            break;
    }
    
    const data = await fetchTMDB(endpoint);
    if (data?.results) {
        document.getElementById('searchTitle').textContent = title;
        document.getElementById('searchCount').textContent = `${data.total_results} titles`;
        displayContent('searchResultsContent', data.results);
    }
}

// Go home
function goHome() {
    document.getElementById('heroSection').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('searchResultsContainer').style.display = 'none';
    document.getElementById('searchInfo').classList.remove('active');
    document.getElementById('searchInput').value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Search on Enter
document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performMainSearch();
});

// Navbar scroll
window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 50);
});

// ESC to close player
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('playerModal').classList.contains('active')) {
        closePlayer();
    }
});

// Initialize on load
window.addEventListener('load', async () => {
    await Promise.all([
        loadTrending(),
        loadMovies(),
        loadTV(),
        loadKDrama(),
        loadAnime()
    ]);

});

// Simple Toast Function
function showToast(message, type) {
    console.log(`[${type}] ${message}`);
    // Optional: Show alert for errors
    if (type === 'error') {
        alert(message);
    }
}




