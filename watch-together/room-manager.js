// ===========================
// STREAMFLIX WATCH TOGETHER - ROOM MANAGEMENT
// ===========================

/**
 * Create a new watch room
 * @param {Object} content - Content to watch {tmdbId, type, title, year}
 * @returns {Promise<string>} Room code
 */
async function createRoom(content) {
    try {
        if (!currentUser) {
            throw new Error('User not authenticated');
        }
        
        if (!content || !content.tmdb) {  // ← Changed tmdbId to tmdb
            throw new Error('Invalid content data');
        }
        
        // Generate unique room code
        let roomCode = generateRoomCode();
        let roomExists = true;
        let attempts = 0;
        
        // Ensure unique code
        while (roomExists && attempts < 10) {
            const snapshot = await database.ref(`rooms/${roomCode}`).once('value');
            roomExists = snapshot.exists();
            if (roomExists) {
                roomCode = generateRoomCode();
                attempts++;
            }
        }
        
        if (attempts >= 10) {
            throw new Error('Failed to generate unique room code');
        }
        
        // Create room data
        const roomData = {
            hostId: currentUser.uid,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            content: {
                tmdbId: content.tmdbId,
                type: content.type || 'movie',
                title: content.title,
                year: content.year,
                serverIndex: content.serverIndex || 0
            },
            playback: {
                isPlaying: false,
                currentTime: 0,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            },
            participants: {
                [currentUser.uid]: {
                    name: content.userName || 'Host',
                    joinedAt: firebase.database.ServerValue.TIMESTAMP,
                    isHost: true
                }
            },
            settings: {
                maxParticipants: 5,
                allowChat: true
            }
        };
        
        // Write to Firebase
        await database.ref(`rooms/${roomCode}`).set(roomData);
        
        // Set current room
        currentRoom = roomCode;
        isHost = true;
        
        // Setup disconnect handler
        setupRoomDisconnect(roomCode);
        
        // Start listeners
        setupPlaybackSync();
        setupParticipantSync();
        setupChat();
        
        // Show room UI
        showRoomUI(roomCode);
        
        console.log('✅ Room created:', roomCode);
        showToast('Room created successfully!', 'success');
        
        return roomCode;
        
    } catch (error) {
        console.error('❌ Create room failed:', error);
        showToast('Failed to create room', 'error');
        throw error;
    }
}

/**
 * Join existing watch room
 * @param {string} roomCode - 6-character room code
 * @returns {Promise<boolean>} Success status
 */
async function joinRoom(roomCode) {
    try {
        if (!currentUser) {
            await authenticateUser();
        }
        
        // Validate room code
        roomCode = roomCode.toUpperCase().trim();
        if (!isValidRoomCode(roomCode)) {
            throw new Error('Invalid room code format');
        }
        
        // Check if room exists
        const roomSnapshot = await database.ref(`rooms/${roomCode}`).once('value');
        if (!roomSnapshot.exists()) {
            throw new Error('Room not found');
        }
        
        const roomData = roomSnapshot.val();
        
        // Check participant limit
        const participantCount = Object.keys(roomData.participants || {}).length;
        if (participantCount >= (roomData.settings?.maxParticipants || 5)) {
            throw new Error('Room is full');
        }
        
        // Check if user already in room
        if (roomData.participants && roomData.participants[currentUser.uid]) {
            console.log('⚠️ User already in room');
        } else {
            // Add participant
            await database.ref(`rooms/${roomCode}/participants/${currentUser.uid}`).set({
                name: `Guest${participantCount + 1}`,
                joinedAt: firebase.database.ServerValue.TIMESTAMP,
                isHost: false
            });
        }
        
        // Set current room
        currentRoom = roomCode;
        isHost = (roomData.hostId === currentUser.uid);
        
        // Setup disconnect handler
        setupRoomDisconnect(roomCode);
        
        // Load content
        await loadRoomContent(roomData.content);
        
        // Sync playback state
        await syncToHostState(roomData.playback);
        
        // Start listeners
        setupPlaybackSync();
        setupParticipantSync();
        setupChat();
        
        // Show room UI
        showRoomUI(roomCode);
        
        // Update URL without reload
        const newUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
        window.history.pushState({room: roomCode}, '', newUrl);
        
        console.log('✅ Joined room:', roomCode);
        showToast(`Joined room ${roomCode}`, 'success');
        
        return true;
        
    } catch (error) {
        console.error('❌ Join room failed:', error);
        showToast(error.message || 'Failed to join room', 'error');
        return false;
    }
}

/**
 * Leave current room
 */
async function leaveRoom() {
    try {
        if (!currentRoom || !currentUser) return;
        
        const roomCode = currentRoom;
        
        // Remove participant
        await database.ref(`rooms/${roomCode}/participants/${currentUser.uid}`).remove();
        
        // Cleanup listeners
        cleanupListeners();
        
        // Check if room is empty or host left
        const snapshot = await database.ref(`rooms/${roomCode}/participants`).once('value');
        const participants = snapshot.val();
        
        if (!participants || Object.keys(participants).length === 0) {
            // Room is empty, delete it
            await destroyRoom(roomCode);
        } else if (isHost) {
            // Host left, transfer to new host
            await transferHost(roomCode);
        }
        
        // Reset state
        currentRoom = null;
        isHost = false;
        
        // Hide room UI
        hideRoomUI();
        
        // Clean URL
        const newUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.pushState({}, '', newUrl);
        
        console.log('✅ Left room:', roomCode);
        showToast('Left room', 'info');
        
    } catch (error) {
        console.error('❌ Leave room failed:', error);
    }
}

/**
 * Destroy room completely
 * @param {string} roomCode - Room to destroy
 */
async function destroyRoom(roomCode) {
    try {
        await database.ref(`rooms/${roomCode}`).remove();
        console.log('✅ Room destroyed:', roomCode);
    } catch (error) {
        console.error('❌ Destroy room failed:', error);
    }
}

/**
 * Transfer host to another participant
 * @param {string} roomCode - Room code
 */
async function transferHost(roomCode) {
    try {
        const snapshot = await database.ref(`rooms/${roomCode}/participants`).once('value');
        const participants = snapshot.val();
        
        if (!participants || Object.keys(participants).length === 0) {
            await destroyRoom(roomCode);
            return;
        }
        
        // Get first participant
        const newHostId = Object.keys(participants)[0];
        
        // Update host
        await database.ref(`rooms/${roomCode}`).update({
            hostId: newHostId
        });
        
        // Update participant flags
        await database.ref(`rooms/${roomCode}/participants/${newHostId}`).update({
            isHost: true
        });
        
        console.log('✅ Host transferred to:', newHostId);
        
        // Notify participants
        await sendSystemMessage(roomCode, 'Host has changed');
        
    } catch (error) {
        console.error('❌ Transfer host failed:', error);
    }
}

/**
 * Setup disconnect handler for room
 * @param {string} roomCode - Room code
 */
function setupRoomDisconnect(roomCode) {
    const participantRef = database.ref(`rooms/${roomCode}/participants/${currentUser.uid}`);
    
    participantRef.onDisconnect().remove().then(() => {
        console.log('✅ Disconnect handler set');
    });
    
    // Also handle empty room cleanup
    const roomRef = database.ref(`rooms/${roomCode}/participants`);
    roomRef.onDisconnect().once('value', async (snapshot) => {
        const participants = snapshot.val();
        if (!participants || Object.keys(participants).length === 0) {
            await destroyRoom(roomCode);
        }
    });
}

/**
 * Load room content into player
 * @param {Object} content - Content data
 */
async function loadRoomContent(content) {
    try {
        // Use existing playMovie function
        const movieData = {
            tmdb: content.tmdbId,
            type: content.type,
            title: content.title,
            year: content.year
        };
        
        // Load content
        if (typeof playMovie === 'function') {
            await playMovie(movieData);
        }
        
        // Switch to correct server
        if (content.serverIndex && typeof loadServer === 'function') {
            loadServer(content.serverIndex, movieData);
        }
        
        console.log('✅ Room content loaded');
        
    } catch (error) {
        console.error('❌ Load room content failed:', error);
    }
}

/**
 * Sync to host playback state
 * @param {Object} playbackState - Playback state from Firebase
 */
async function syncToHostState(playbackState) {
    if (!playbackState) return;
    
    isSyncing = true;
    
    try {
        // Sync time if difference > 2 seconds
        const currentTime = playbackState.currentTime || 0;
        
        // Note: Since we use iframe, we'll need to reload with timestamp
        // This is a limitation of iframe embeds
        console.log('🔄 Syncing to host state:', playbackState);
        
        // Store state for when iframe loads
        sessionStorage.setItem('watchTogether_syncState', JSON.stringify({
            isPlaying: playbackState.isPlaying,
            currentTime: currentTime,
            timestamp: Date.now()
        }));
        
    } catch (error) {
        console.error('❌ Sync failed:', error);
    } finally {
        setTimeout(() => {
            isSyncing = false;
        }, 500);
    }
}

/**
 * Send system message to chat
 * @param {string} roomCode - Room code
 * @param {string} message - Message text
 */
async function sendSystemMessage(roomCode, message) {
    try {
        const messageRef = database.ref(`rooms/${roomCode}/chat`).push();
        await messageRef.set({
            sender: 'system',
            text: message,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    } catch (error) {
        console.error('❌ Send system message failed:', error);
    }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createRoom,
        joinRoom,
        leaveRoom,
        destroyRoom,
        transferHost,
        loadRoomContent,
        syncToHostState
    };
}
