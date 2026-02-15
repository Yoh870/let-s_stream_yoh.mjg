// ===========================
// STREAMFLIX WATCH TOGETHER - LIVE CHAT SYSTEM
// ===========================

const MAX_MESSAGE_LENGTH = 200;
const MAX_MESSAGES_DISPLAY = 50;

/**
 * Setup live chat system
 */
function setupChat() {
    if (!currentRoom) return;
    
    const chatRef = database.ref(`rooms/${currentRoom}/chat`)
        .orderByChild('timestamp')
        .limitToLast(MAX_MESSAGES_DISPLAY);
    
    // Listen to new messages
    const unsubscribe = chatRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (message) {
            displayMessage(snapshot.key, message);
        }
    });
    
    chatListeners.push(() => chatRef.off('child_added', unsubscribe));
    
    // Setup chat input
    setupChatInput();
    
    console.log('✅ Chat enabled');
}

/**
 * Setup chat input handlers
 */
function setupChatInput() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendChatBtn');
    
    if (!chatInput || !sendButton) return;
    
    // Send on Enter key
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Send on button click
    sendButton.addEventListener('click', sendMessage);
    
    // Character counter
    chatInput.addEventListener('input', () => {
        const remaining = MAX_MESSAGE_LENGTH - chatInput.value.length;
        const counter = document.getElementById('charCounter');
        if (counter) {
            counter.textContent = remaining;
            counter.classList.toggle('warning', remaining < 20);
        }
    });
}

/**
 * Send chat message
 */
async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !currentRoom || !currentUser) return;
    
    const text = sanitizeText(chatInput.value);
    if (!text || text.length === 0) return;
    
    if (text.length > MAX_MESSAGE_LENGTH) {
        showToast('Message too long', 'error');
        return;
    }
    
    try {
        const messageRef = database.ref(`rooms/${currentRoom}/chat`).push();
        
        await messageRef.set({
            sender: currentUser.uid,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Clear input
        chatInput.value = '';
        
        // Update counter
        const counter = document.getElementById('charCounter');
        if (counter) {
            counter.textContent = MAX_MESSAGE_LENGTH;
            counter.classList.remove('warning');
        }
        
    } catch (error) {
        console.error('❌ Send message failed:', error);
        showToast('Failed to send message', 'error');
    }
}

/**
 * Display message in chat
 * @param {string} messageId - Message ID
 * @param {Object} message - Message data
 */
function displayMessage(messageId, message) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.dataset.messageId = messageId;
    
    // Check if system message
    if (message.sender === 'system') {
        messageElement.classList.add('system-message');
        messageElement.innerHTML = `
            <div class="system-text">
                <span class="system-icon">ℹ️</span>
                ${message.text}
            </div>
        `;
    } else {
        // Regular user message
        const isOwnMessage = message.sender === currentUser.uid;
        messageElement.classList.toggle('own-message', isOwnMessage);
        
        // Get participant name
        getParticipantName(message.sender).then(name => {
            const time = message.timestamp ? formatMessageTime(message.timestamp) : 'Now';
            
            messageElement.innerHTML = `
                <div class="message-header">
                    <span class="message-sender">${name}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${escapeHtml(message.text)}</div>
            `;
        });
    }
    
    chatMessages.appendChild(messageElement);
    
    // Auto-scroll to bottom
    scrollChatToBottom();
    
    // Keep only last MAX_MESSAGES_DISPLAY messages
    while (chatMessages.children.length > MAX_MESSAGES_DISPLAY) {
        chatMessages.removeChild(chatMessages.firstChild);
    }
}

/**
 * Get participant name from Firebase
 * @param {string} uid - User ID
 * @returns {Promise<string>} Participant name
 */
async function getParticipantName(uid) {
    if (!currentRoom) return 'Unknown';
    
    try {
        const snapshot = await database.ref(`rooms/${currentRoom}/participants/${uid}`).once('value');
        const participant = snapshot.val();
        return participant?.name || 'Unknown';
    } catch (error) {
        console.error('❌ Get participant name failed:', error);
        return 'Unknown';
    }
}

/**
 * Format message timestamp
 * @param {number} timestamp - Firebase timestamp
 * @returns {string} Formatted time
 */
function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
}

/**
 * Scroll chat to bottom
 */
function scrollChatToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
    });
}

/**
 * Clear chat messages
 */
function clearChat() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
}

/**
 * Toggle chat panel
 */
function toggleChatPanel() {
    const chatPanel = document.getElementById('chatPanel');
    if (!chatPanel) return;
    
    chatPanel.classList.toggle('open');
    
    if (chatPanel.classList.contains('open')) {
        scrollChatToBottom();
        
        // Focus input
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            setTimeout(() => chatInput.focus(), 300);
        }
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Send reaction emoji
 * @param {string} emoji - Emoji to send
 */
async function sendReaction(emoji) {
    if (!currentRoom || !currentUser) return;
    
    try {
        const messageRef = database.ref(`rooms/${currentRoom}/chat`).push();
        
        await messageRef.set({
            sender: currentUser.uid,
            text: emoji,
            type: 'reaction',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
    } catch (error) {
        console.error('❌ Send reaction failed:', error);
    }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setupChat,
        sendMessage,
        displayMessage,
        toggleChatPanel,
        sendReaction,
        clearChat
    };
}
