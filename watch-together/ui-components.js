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
        // Close menu
        closeWatchTogetherMenu();
        
        // Check if content is loaded
        if (!state.currentMovie && !currentContent) {
            showToast('Please select a movie first', 'info');
            return;
        }
        
        // Get current content
        const content = state.currentMovie || currentContent || {
            tmdbId: '872585',
            type: 'movie',
            title: 'Sample Movie',
            year: '2024'
        };
        
        // Create room
        const roomCode = await createRoom(content);
        
        // Show room created modal
        showRoomCreatedModal(roomCode);
        
    } catch (error) {
        console.error('❌ Init create room failed:', error);
        showToast('Failed to create room', 'error');
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
        
        // Focus input
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
        
        // Clear input
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
        showToast('Please enter a room code', 'error');
        return;
    }
    
    if (!isValidRoomCode(roomCode)) {
        showToast('Invalid room code format', 'error');
        return;
    }
    
    closeJoinRoomDialog();
    
    const success = await joinRoom(roomCode);
    
    if (success) {
        showToast(`Joined room ${roomCode}!`, 'success');
    }
}

/**
 * Show room created modal
 * @param {string} roomCode - Room code
 */
function showRoomCreatedModal(roomCode) {
    const modal = document.getElementById('roomCreatedModal');
    if (!modal) return;
    
    // Set room code
    const codeDisplay = document.getElementById('roomCodeDisplay');
    if (codeDisplay) {
        codeDisplay.textContent = roomCode;
    }
    
    // Set invite link
    const inviteLink = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    const linkDisplay = document.getElementById('inviteLinkDisplay');
    if (linkDisplay) {
        linkDisplay.value = inviteLink;
    }
    
    // Show modal
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
    
    showToast('Link copied to clipboard!', 'success');
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
 * @param {string} roomCode - Room code
 */
function showRoomUI(roomCode) {
    // Show room indicator
    const indicator = document.getElementById('roomIndicator');
    if (indicator) {
        indicator.style.display = 'flex';
    }
    
    // Set room code
    const badge = document.getElementById('roomCodeBadge');
    if (badge) {
        badge.textContent = roomCode;
    }
    
    // Show chat button
    const chatBtn = document.getElementById('toggleChatBtn');
    if (chatBtn) {
        chatBtn.style.display = 'flex';
    }
}

/**
 * Hide room UI
 */
function hideRoomUI() {
    // Hide room indicator
    const indicator = document.getElementById('roomIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
    
    // Hide chat button
    const chatBtn = document.getElementById('toggleChatBtn');
    if (chatBtn) {
        chatBtn.style.display = 'none';
    }
    
    // Close chat panel
    const chatPanel = document.getElementById('chatPanel');
    if (chatPanel) {
        chatPanel.classList.remove('open');
    }
    
    // Clear chat
    clearChat();
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showWatchTogetherMenu,
        closeWatchTogetherMenu,
        initCreateRoom,
        showJoinRoomDialog,
        handleJoinRoom,
        showRoomCreatedModal,
        copyInviteLink,
        shareRoom,
        showRoomUI,
        hideRoomUI
    };
}
