// ===========================
// STREAMFLIX WATCH TOGETHER - FIREBASE CONFIG
// ===========================

/**
 * Firebase Configuration
 * Replace with your actual Firebase config from Firebase Console
 */
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// Global Firebase instances
let app, auth, database;
let currentUser = null;
let currentRoom = null;
let isHost = false;
let isSyncing = false;
let playbackListeners = [];
let chatListeners = [];
let participantListeners = [];

/**
 * Initialize Firebase
 * Must be called before any Firebase operations
 */
async function initFirebase() {
    try {
        // Initialize Firebase App
        if (!firebase.apps.length) {
            app = firebase.initializeApp(firebaseConfig);
        } else {
            app = firebase.app();
        }
        
        // Initialize services
        auth = firebase.auth();
        database = firebase.database();
        
        // Enable persistence
        database.ref('.info/connected').on('value', (snapshot) => {
            if (snapshot.val() === true) {
                console.log('🔥 Firebase connected');
            } else {
                console.log('🔥 Firebase disconnected');
            }
        });
        
        // Authenticate anonymously
        await authenticateUser();
        
        // Check for room code in URL
        const roomCode = getRoomCodeFromURL();
        if (roomCode) {
            await joinRoom(roomCode);
        }
        
        console.log('✅ Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        showToast('Failed to initialize Watch Together', 'error');
        return false;
    }
}

/**
 * Authenticate user anonymously
 */
async function authenticateUser() {
    try {
        const result = await auth.signInAnonymously();
        currentUser = result.user;
        console.log('✅ User authenticated:', currentUser.uid);
        
        // Setup presence
        setupPresence();
        
        return currentUser;
    } catch (error) {
        console.error('❌ Authentication failed:', error);
        throw error;
    }
}

/**
 * Setup presence system
 * Tracks when user goes online/offline
 */
function setupPresence() {
    const userStatusRef = database.ref(`/status/${currentUser.uid}`);
    const isOnlineData = {
        state: 'online',
        lastChanged: firebase.database.ServerValue.TIMESTAMP
    };
    const isOfflineData = {
        state: 'offline',
        lastChanged: firebase.database.ServerValue.TIMESTAMP
    };
    
    // Monitor connection state
    database.ref('.info/connected').on('value', (snapshot) => {
        if (snapshot.val() === false) return;
        
        userStatusRef
            .onDisconnect()
            .set(isOfflineData)
            .then(() => {
                userStatusRef.set(isOnlineData);
            });
    });
}

/**
 * Get room code from URL parameter
 * @returns {string|null} Room code or null
 */
function getRoomCodeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    
    if (roomCode && /^[A-Z0-9]{6}$/.test(roomCode)) {
        return roomCode.toUpperCase();
    }
    
    return null;
}

/**
 * Generate secure 6-character room code
 * @returns {string} Room code
 */
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code;
}

/**
 * Validate room code format
 * @param {string} code - Room code to validate
 * @returns {boolean} Valid or not
 */
function isValidRoomCode(code) {
    return /^[A-Z0-9]{6}$/.test(code);
}

/**
 * Sanitize text input
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
    return text
        .replace(/[<>]/g, '')
        .substring(0, 200)
        .trim();
}

/**
 * Cleanup all Firebase listeners
 */
function cleanupListeners() {
    playbackListeners.forEach(unsubscribe => unsubscribe());
    chatListeners.forEach(unsubscribe => unsubscribe());
    participantListeners.forEach(unsubscribe => unsubscribe());
    
    playbackListeners = [];
    chatListeners = [];
    participantListeners = [];
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initFirebase,
        generateRoomCode,
        isValidRoomCode,
        sanitizeText,
        getRoomCodeFromURL
    };
}
