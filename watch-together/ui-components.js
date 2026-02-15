// ===========================
// STREAMFLIX WATCH TOGETHER - UI COMPONENTS
// ===========================

/**
 * Show Watch Together menu
 */
function showWatchTogetherMenu() {
    const modal = document.getElementById('watchTogetherMenu');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Close Watch Together menu
 */
function closeWatchTogetherMenu() {
    const modal = document.getElementById('watchTogetherMenu');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Initialize room creation
 */
async function initCreateRoom() {
    try {
        closeWatchTogetherMenu();
        
        // Check if currentContent exists
        console.log('Current content:', currentContent);
        console.log('Window content:', window.currentContent);
        
        if (!currentContent && !window.currentContent) {
            alert('Please play a movie first!');
            return;
        }
        
        // Use whichever is available
        const content = currentContent || window.currentContent || {
            tmdb: '872585',
            type: 'movie',
            title: 'Sample Movie',
            year: '2024',
            serverIndex: 0
        };
        
        // Validate content has required fields
        if (!content.tmdb || !content.type || !content.title) {
            throw new Error('Invalid content data: missing required fields');
        }
        
        console.log('✅ Creating room with:', content);
        
        const roomCode = await createRoom(content);
        
        if (roomCode) {
            console.log('✅ Room created:', roomCode);
            showRoomCreatedModal(roomCode);
        } else {
            throw new Error('Room code not generated');
        }
        
    } catch (error) {
        console.error('❌ Create room error:', error);
        alert('Failed to create room: ' + error.message);
    }
}

/**
 * Show join room dialog
 */
function showJoinRoomDialog() {
    closeWatchTogetherMenu();
    
    const modal = document.getElementById('joinRoomModal');
    if (modal) {
        modal.classList.add('active');
        
        const input = document.getElementById('joinRoomCodeInput');
        if (input) {
            setTimeout(() => input.focus(), 300);
        }
    }
}

/**
 * Close join room dialog
 */
function closeJoinRoomDialog() {
    const modal = document.getElementById('joinRoomModal');
    if (modal) {
        modal.classList.remove('active');
        
        const input = document.getElementById('joinRoomCodeInput');
        if (input) input.value = '';
    }
}

/**
 * Handle join room
 */
async function handleJoinRoom() {
    const input = document.getElementById('joinRoomCodeInput');
    if (!input) return;
    
    const roomCode = input.value.trim().toUpperCase();
    
    if (!roomCode) {
        alert('Please enter a room code');
        return;
    }
    
    if (!isValidRoomCode(roomCode)) {
        alert('Invalid room code format');
        return;
    }
    
    closeJoinRoomDialog();
    
    const success = await joinRoom(roomCode);
    
    if (success) {
        alert(`Joined room ${roomCode}!`);
    }
}

/**
 * Show room created modal
 */
function showRoomCreatedModal(roomCode) {
    const modal = document.getElementById('roomCreatedModal');
    if (!modal) return;
    
    const codeDisplay = document.getElementById('roomCodeDisplay');
    if (codeDisplay) {
        codeDisplay.textContent = roomCode;
    }
    
    const inviteLink = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    const linkDisplay = document.getElementById('inviteLinkDisplay');
    if (linkDisplay) {
        linkDisplay.value = inviteLink;
    }
    
    modal.classList.add('active');
}

/**
 * Close room created modal
 */
function closeRoomCreatedModal() {
    const modal = document.getElementById('roomCreatedModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Copy invite link
 */
function copyInviteLink() {
    const linkDisplay = document.getElementById('inviteLinkDisplay');
    if (!linkDisplay) return;
    
    linkDisplay.select();
    document.execCommand('copy');
    
    alert('Link copied to clipboard!');
}

/**
 * Share room
 */
async function shareRoom() {
    const linkDisplay = document.getElementById('inviteLinkDisplay');
    if (!linkDisplay) return;
    
    const link = linkDisplay.value;
    const roomCode = document.getElementById('roomCodeDisplay')?.textContent || 'ABC123';
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Watch Together on StreamFlix',
                text: `Join me in room ${roomCode} to watch together!`,
                url: link
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                copyInviteLink();
            }
        }
    } else {
        copyInviteLink();
    }
}

/**
 * Show room UI
 */
function showRoomUI(roomCode) {
    const indicator = document.getElementById('roomIndicator');
    if (indicator) {
        indicator.style.display = 'flex';
    }
    
    const badge = document.getElementById('roomCodeBadge');
    if (badge) {
        badge.textContent = roomCode;
    }
    
    const chatBtn = document.getElementById('toggleChatBtn');
    if (chatBtn) {
        chatBtn.style.display = 'flex';
    }
    
    // Hide Watch Together button when room is active
    const watchBtn = document.getElementById('playerWatchBtn');
    if (watchBtn) {
        watchBtn.style.display = 'none';
    }
}

/**
 * Hide room UI
 */
function hideRoomUI() {
    const indicator = document.getElementById('roomIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
    
    const chatBtn = document.getElementById('toggleChatBtn');
    if (chatBtn) {
        chatBtn.style.display = 'none';
    }
    
    // Show Watch Together button when no room
    const watchBtn = document.getElementById('playerWatchBtn');
    if (watchBtn) {
        watchBtn.style.display = 'flex';
    }
    
    const chatPanel = document.getElementById('chatPanel');
    if (chatPanel) {
        chatPanel.classList.remove('open');
    }
    
    if (typeof clearChat === 'function') {
        clearChat();
    }
}

console.log('✅ UI Components loaded');







