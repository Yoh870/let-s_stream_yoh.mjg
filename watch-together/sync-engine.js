// ===========================
// STREAMFLIX WATCH TOGETHER - PLAYBACK SYNC ENGINE
// ===========================

let lastPlaybackUpdate = 0;
const UPDATE_THROTTLE = 1000; // 1 second minimum between updates
const SYNC_THRESHOLD = 2; // Sync if difference > 2 seconds

/**
 * Setup playback synchronization
 * Listens to Firebase playback changes and mirrors them
 */
function setupPlaybackSync() {
    if (!currentRoom) return;
    
    const playbackRef = database.ref(`rooms/${currentRoom}/playback`);
    
    // Listen to playback changes
    const unsubscribe = playbackRef.on('value', (snapshot) => {
        if (!snapshot.exists()) return;
        
        const playbackState = snapshot.val();
        
        // Only apply changes if not host and not currently syncing
        if (!isHost && !isSyncing) {
            handlePlaybackUpdate(playbackState);
        }
    });
    
    playbackListeners.push(() => playbackRef.off('value', unsubscribe));
    
    console.log('✅ Playback sync enabled');
}

/**
 * Handle playback update from Firebase
 * @param {Object} state - Playback state
 */
function handlePlaybackUpdate(state) {
    if (!state) return;
    
    isSyncing = true;
    
    try {
        console.log('🔄 Playback update received:', state);
        
        // Handle play/pause
        if (state.isPlaying !== undefined) {
            handlePlayPauseSync(state.isPlaying);
        }
        
        // Handle seek
        if (state.currentTime !== undefined) {
            handleSeekSync(state.currentTime);
        }
        
    } catch (error) {
        console.error('❌ Playback update failed:', error);
    } finally {
        setTimeout(() => {
            isSyncing = false;
        }, 500);
    }
}

/**
 * Handle play/pause synchronization
 * @param {boolean} shouldPlay - Play or pause
 */
function handlePlayPauseSync(shouldPlay) {
    try {
        // Since we use iframe, we need to reload with appropriate state
        // Store state for iframe management
        sessionStorage.setItem('watchTogether_playing', shouldPlay);
        
        // Show visual indicator
        const indicator = document.querySelector('.sync-indicator');
        if (indicator) {
            indicator.textContent = shouldPlay ? '▶️ Playing' : '⏸️ Paused';
            indicator.classList.add('active');
            setTimeout(() => indicator.classList.remove('active'), 2000);
        }
        
        console.log(`🔄 Sync: ${shouldPlay ? 'Playing' : 'Paused'}`);
        
    } catch (error) {
        console.error('❌ Play/Pause sync failed:', error);
    }
}

/**
 * Handle seek synchronization
 * @param {number} time - Target time in seconds
 */
function handleSeekSync(time) {
    try {
        const currentTime = getCurrentPlaybackTime();
        const timeDiff = Math.abs(time - currentTime);
        
        // Only sync if difference is significant
        if (timeDiff < SYNC_THRESHOLD) {
            return;
        }
        
        // Store target time
        sessionStorage.setItem('watchTogether_seekTime', time);
        
        // Reload iframe with timestamp (server-dependent)
        reloadPlayerWithTimestamp(time);
        
        console.log(`🔄 Sync: Seeking to ${formatTime(time)}`);
        
    } catch (error) {
        console.error('❌ Seek sync failed:', error);
    }
}

/**
 * Update playback state (HOST ONLY)
 * @param {Object} updates - State updates
 */
async function updatePlaybackState(updates) {
    if (!isHost || !currentRoom || isSyncing) return;
    
    const now = Date.now();
    if (now - lastPlaybackUpdate < UPDATE_THROTTLE) {
        return; // Throttle updates
    }
    
    try {
        lastPlaybackUpdate = now;
        
        const updateData = {
            ...updates,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };
        
        await database.ref(`rooms/${currentRoom}/playback`).update(updateData);
        
        console.log('✅ Playback state updated:', updates);
        
    } catch (error) {
        console.error('❌ Update playback state failed:', error);
    }
}

/**
 * Update server selection (HOST ONLY)
 * @param {number} serverIndex - Server index
 */
async function updateServerState(serverIndex) {
    if (!isHost || !currentRoom || isSyncing) return;
    
    try {
        await database.ref(`rooms/${currentRoom}/content`).update({
            serverIndex: serverIndex
        });
        
        console.log('✅ Server updated:', serverIndex);
        
    } catch (error) {
        console.error('❌ Update server failed:', error);
    }
}

/**
 * Reload player with timestamp
 * @param {number} time - Time in seconds
 */
function reloadPlayerWithTimestamp(time) {
    const playerVideo = document.getElementById('playerVideo');
    if (!playerVideo) return;
    
    const iframe = playerVideo.querySelector('iframe');
    if (!iframe) return;
    
    const currentSrc = iframe.src;
    const baseUrl = currentSrc.split('?')[0];
    
    // Add timestamp parameter (works with some servers)
    const newSrc = `${baseUrl}?t=${Math.floor(time)}`;
    
    iframe.src = newSrc;
    
    console.log(`🔄 Player reloaded with time: ${formatTime(time)}`);
}

/**
 * Get current playback time (estimation)
 * @returns {number} Current time in seconds
 */
function getCurrentPlaybackTime() {
    // Since we can't access iframe internals, estimate from session storage
    const syncState = sessionStorage.getItem('watchTogether_syncState');
    if (syncState) {
        const state = JSON.parse(syncState);
        const elapsed = (Date.now() - state.timestamp) / 1000;
        return state.currentTime + (state.isPlaying ? elapsed : 0);
    }
    return 0;
}

/**
 * Format time for display
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time (MM:SS)
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Setup participant synchronization
 * Track who's in the room
 */
function setupParticipantSync() {
    if (!currentRoom) return;
    
    const participantsRef = database.ref(`rooms/${currentRoom}/participants`);
    
    // Listen to participant changes
    const unsubscribe = participantsRef.on('value', (snapshot) => {
        if (!snapshot.exists()) return;
        
        const participants = snapshot.val();
        updateParticipantsList(participants);
    });
    
    participantListeners.push(() => participantsRef.off('value', unsubscribe));
    
    console.log('✅ Participant sync enabled');
}

/**
 * Update participants list UI
 * @param {Object} participants - Participants data
 */
function updateParticipantsList(participants) {
    const container = document.getElementById('participantsList');
    if (!container) return;
    
    const participantArray = Object.entries(participants || {});
    
    container.innerHTML = participantArray.map(([uid, data]) => `
        <div class="participant-item ${data.isHost ? 'host' : ''}">
            <div class="participant-avatar">${data.name.charAt(0)}</div>
            <div class="participant-info">
                <div class="participant-name">${data.name}</div>
                ${data.isHost ? '<span class="host-badge">👑 Host</span>' : ''}
            </div>
        </div>
    `).join('');
    
    // Update count
    const countElement = document.getElementById('participantCount');
    if (countElement) {
        countElement.textContent = participantArray.length;
    }
}

/**
 * Listen to server changes
 */
function setupServerSync() {
    if (!currentRoom) return;
    
    const contentRef = database.ref(`rooms/${currentRoom}/content/serverIndex`);
    
    const unsubscribe = contentRef.on('value', (snapshot) => {
        if (!snapshot.exists() || isHost || isSyncing) return;
        
        const serverIndex = snapshot.val();
        
        // Switch to same server
        if (typeof loadServer === 'function' && currentContent) {
            isSyncing = true;
            loadServer(serverIndex, currentContent);
            setTimeout(() => {
                isSyncing = false;
            }, 500);
        }
    });
    
    playbackListeners.push(() => contentRef.off('value', unsubscribe));
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setupPlaybackSync,
        updatePlaybackState,
        updateServerState,
        handlePlaybackUpdate,
        getCurrentPlaybackTime,
        formatTime
    };
}
