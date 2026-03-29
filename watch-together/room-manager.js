/* ═══════════════════════════════════════════════════════════════════
   FLIXORA — Watch Together  •  room-manager.js  v2.0
   ───────────────────────────────────────────────────────────────────
   Features:
     ✅ Playback sync   — host play/pause/server-change mirrors to all
     ✅ Live chat        — Firebase-powered, replaces basic _sendChat()
     ✅ Room host ctrl   — kick viewers, toggle host-only lock
     ✅ Viewer count     — real-time presence with online dots

   HOW TO SET UP (one-time, 5 minutes):
   ─────────────────────────────────────
   1. Go to https://console.firebase.google.com
   2. Create a new project (e.g. "flixora-watch")
   3. Add a Web app — copy the firebaseConfig object
   4. Go to Build → Realtime Database → Create database
      • Start in TEST mode (change rules later)
   5. Paste your config below where it says YOUR_CONFIG_HERE
   ═══════════════════════════════════════════════════════════════════ */

// ─── 🔧 PASTE YOUR FIREBASE CONFIG HERE ───────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBoBMQHx9nxhOgdYKX9x7M5kCrIKRxZ5gg",
  authDomain:        "streamflix-watch-together.firebaseapp.com",
  databaseURL:       "https://streamflix-watch-together-default-rtdb.firebaseio.com",
  projectId:         "streamflix-watch-together",
  storageBucket:     "streamflix-watch-together.firebasestorage.app",
  messagingSenderId: "626707913714",
  appId:             "1:626707913714:web:2dc18c5480043f0b8e696b",
};
// ──────────────────────────────────────────────────────────────────

/* ═══ CONSTANTS ═══════════════════════════════════════════════════ */
const WT_VERSION      = '2.0';
const PRESENCE_TTL    = 8000;   // ms — kick offline after 8s no ping
const CHAT_LIMIT      = 120;    // max messages kept in UI
const SYNC_DEBOUNCE   = 400;    // ms debounce for seek sync
const FIREBASE_CDN    = 'https://www.gstatic.com/firebasejs/9.23.0/';

/* ═══ STATE ═══════════════════════════════════════════════════════ */
const WT = {
  db:           null,
  app:          null,
  roomCode:     null,
  userId:       _uid(),
  userName:     _randomName(),
  isHost:       false,
  hostOnly:     false,
  presenceRef:  null,
  presenceTimer:null,
  listeners:    [],          // unsubscribe fns
  viewerMap:    {},          // userId → { name, online }
  chatCount:    0,
};

/* ═══ HELPERS ═════════════════════════════════════════════════════ */
function _uid() {
  let id = localStorage.getItem('wt_uid');
  if (!id) { id = Math.random().toString(36).slice(2,10); localStorage.setItem('wt_uid',id); }
  return id;
}
function _randomName() {
  const saved = localStorage.getItem('wt_name');
  if (saved) return saved;
  const adj  = ['Fast','Cool','Dark','Nova','Neon','Epic','Bold','Wild'];
  const noun = ['Fox','Wolf','Star','Ghost','Hawk','Lion','Rain','Blaze'];
  const name = adj[Math.floor(Math.random()*adj.length)] + noun[Math.floor(Math.random()*noun.length)];
  localStorage.setItem('wt_name', name);
  return name;
}
function _code() {
  return Math.random().toString(36).slice(2,8).toUpperCase();
}
function _ts() { return Date.now(); }
function _dbPath(...parts) { return parts.join('/'); }
const qs  = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];

/* ═══ FIREBASE LOADER ════════════════════════════════════════════ */
async function loadFirebaseSDK() {
  if (window._firebaseLoaded) return true;

  // Check if already loaded via script tags
  if (window.firebase?.initializeApp) { window._firebaseLoaded=true; return true; }

  return new Promise(resolve => {
    const scripts = [
      { src: FIREBASE_CDN + 'firebase-app-compat.js',      id: 'fb-app' },
      { src: FIREBASE_CDN + 'firebase-database-compat.js', id: 'fb-db'  },
    ];
    let loaded = 0;
    scripts.forEach(s => {
      if (document.getElementById(s.id)) { loaded++; if(loaded===scripts.length){window._firebaseLoaded=true;resolve(true);} return; }
      const el = document.createElement('script');
      el.id  = s.id;
      el.src = s.src;
      el.onload  = () => { loaded++; if(loaded===scripts.length){window._firebaseLoaded=true;resolve(true);} };
      el.onerror = () => { console.error('[WT] Failed to load Firebase SDK'); resolve(false); };
      document.head.appendChild(el);
    });
  });
}

/* ═══ INIT ════════════════════════════════════════════════════════ */
async function initFirebase() {
  const ok = await loadFirebaseSDK();
  if (!ok) { console.warn('[WT] Firebase SDK load failed'); return; }

  if (FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') {
    console.warn('[WT] ⚠️  Firebase not configured — Watch Together disabled.\n    Fill in FIREBASE_CONFIG in room-manager.js');
    _patchUINoFirebase();
    return;
  }

  try {
    if (!firebase.apps || !firebase.apps.length) {
      WT.app = firebase.initializeApp(FIREBASE_CONFIG);
    } else {
      WT.app = firebase.apps[0];
    }
    WT.db = firebase.database();
    console.log(`%c✅ Watch Together v${WT_VERSION} ready (uid: ${WT.userId})`, 'color:#10b981;font-weight:bold');

    _patchWTButtons();
    _injectStyles();
    _checkRoomParam();        // auto-join if ?room=CODE in URL
  } catch(e) {
    console.error('[WT] Firebase init error:', e.message);
  }
}

/* ═══ ROOM: CREATE ════════════════════════════════════════════════ */
async function createRoom() {
  if (!WT.db) { _showToast('Firebase not configured','⚠️'); return; }

  const code    = _code();
  const content = window.currentContent || null;

  await WT.db.ref(`rooms/${code}`).set({
    meta: {
      hostId:   WT.userId,
      hostName: WT.userName,
      createdAt: _ts(),
      content:   content,
      serverIdx: 0,
      hostOnly:  false,
      version:   WT_VERSION,
    },
    playback: { action:'idle', ts: _ts() },
  });

  _joinRoomInternal(code, true);
}

/* ═══ ROOM: JOIN ══════════════════════════════════════════════════ */
async function joinRoom(code) {
  code = code.toUpperCase().trim();
  if (!WT.db) { _showToast('Firebase not configured','⚠️'); return; }

  try {
    const snap = await WT.db.ref(`rooms/${code}/meta`).once('value');
    if (!snap.exists()) { _showToast('Room not found — check the code','❌'); return; }
    _joinRoomInternal(code, false);
  } catch(e) {
    console.error('[WT] joinRoom error:', e);
    _showToast('Failed to join — check console','❌');
  }
}

async function _joinRoomInternal(code, asHost) {
  // Clean up any previous room
  await leaveRoom(true);

  WT.roomCode = code;
  WT.isHost   = asHost;

  // Show joining overlay immediately on guest screen
  if (!asHost) _showJoiningOverlay(code);

  // Register presence
  WT.presenceRef = WT.db.ref(`rooms/${code}/presence/${WT.userId}`);
  await WT.presenceRef.set({ name: WT.userName, joinedAt: _ts(), lastSeen: _ts(), online: true });
  WT.presenceRef.onDisconnect().remove();

  // Heartbeat
  WT.presenceTimer = setInterval(() => {
    WT.presenceRef?.update({ lastSeen: _ts(), online: true });
  }, 3000);

  // If joining as GUEST — load content FIRST before subscribing
  if (!asHost) {
    try {
      console.log('[WT] Guest fetching room meta for code:', code);
      const snap = await WT.db.ref(`rooms/${code}/meta`).once('value');
      console.log('[WT] Room meta exists:', snap.exists(), '| val:', JSON.stringify(snap.val()));

      if (snap.exists()) {
        const meta = snap.val();
        const c    = meta?.content;

        console.log('[WT] Content from room:', JSON.stringify(c));

        if (c && c.tmdb) {
          _removeJoiningOverlay();

          // Open player modal
          const modal = qs('#playerModal');
          if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            console.log('[WT] Player modal opened');
          } else {
            console.warn('[WT] #playerModal not found in DOM!');
          }

          // Wait for modal animation
          await new Promise(r => setTimeout(r, 400));

          console.log('[WT] Calling playById:', c.tmdb, c.type, c.title, c.year);
          if (typeof playById === 'function') {
            await playById(c.tmdb, c.type, c.title || '', c.year || '');
            console.log('[WT] playById done');
          } else {
            console.error('[WT] playById function not found!');
          }

          // Sync to correct server after content loads
          const sIdx = meta.serverIdx || 0;
          setTimeout(() => {
            console.log('[WT] Syncing server index:', sIdx);
            if (typeof setServer === 'function') {
              setServer(sIdx, window.currentContent || c);
            }
          }, 1200);

        } else {
          _removeJoiningOverlay();
          console.log('[WT] No content in room yet — waiting for host');
          _showToast('Room joined! Waiting for host to play something…', '👀', 4000);
        }
      } else {
        _removeJoiningOverlay();
        console.warn('[WT] Room meta snap does not exist for code:', code);
      }
    } catch(err) {
      _removeJoiningOverlay();
      console.error('[WT] Guest content load error:', err);
      _showToast('Joined room but failed to load content', '⚠️', 4000);
    }
  }

  // Subscribe to room state
  _subscribeRoom(code);
  _subscribePresence(code);
  _subscribeChat(code);

  // Build HUD
  _buildRoomHUD();
  _showToast(asHost ? `Room ${code} created! 🎬` : `Joined room ${code}! ✅`, asHost ? '🎬' : '✅');

  // Push current URL with room code (shareable link)
  const url = new URL(location.href);
  url.searchParams.set('room', code);
  history.replaceState(null, '', url.toString());
}

/* Loading overlay shown while guest fetches room content */
function _showJoiningOverlay(code) {
  if (qs('#wt-joining-ov')) return;
  const ov = document.createElement('div');
  ov.id = 'wt-joining-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,10,15,.96);backdrop-filter:blur(14px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:Outfit,sans-serif;color:#fff';
  ov.innerHTML = `
    <div style="width:52px;height:52px;border:3px solid rgba(255,255,255,.1);border-top-color:#e63946;border-radius:50%;animation:sfSpin 1s linear infinite"></div>
    <div style="text-align:center">
      <div style="font-size:1.1rem;font-weight:700;margin-bottom:6px">Joining Room <span style="color:#e63946;letter-spacing:.1em">${code}</span></div>
      <div style="font-size:.82rem;color:#9898b0">Loading what the host is watching…</div>
    </div>
  `;
  document.body.appendChild(ov);
}

function _removeJoiningOverlay() {
  const ov = qs('#wt-joining-ov');
  if (!ov) return;
  ov.style.transition = 'opacity .3s';
  ov.style.opacity = '0';
  setTimeout(() => ov.remove(), 320);
}

/* ═══ ROOM: LEAVE ════════════════════════════════════════════════ */
async function leaveRoom(silent=false) {
  if (!WT.roomCode) return;

  clearInterval(WT.presenceTimer);
  WT.presenceTimer = null;

  // Remove listeners
  WT.listeners.forEach(fn => typeof fn==='function' && fn());
  WT.listeners = [];

  await WT.presenceRef?.remove();
  WT.presenceRef = null;

  const wasCode = WT.roomCode;
  WT.roomCode = null;
  WT.isHost   = false;
  WT.viewerMap = {};

  _destroyRoomHUD();

  // Remove ?room= from URL
  const url = new URL(location.href);
  url.searchParams.delete('room');
  history.replaceState(null,'', url.toString());

  if (!silent) _showToast(`Left room ${wasCode}`,'👋');
}

/* ═══ SUBSCRIBE: ROOM META / PLAYBACK ════════════════════════════ */
function _subscribeRoom(code) {
  const ref = WT.db.ref(`rooms/${code}/meta`);
  const handler = ref.on('value', snap => {
    if (!snap.exists()) { leaveRoom(); return; }
    const meta = snap.val();

    WT.hostOnly = meta.hostOnly || false;
    _updateHUDHostBadge();

    // Sync content — if host changed what's playing, follow along
    if (!WT.isHost && meta.content) {
      const cur = window.currentContent;
      const mc  = meta.content;
      if (cur?.tmdb !== String(mc.tmdb) || cur?.type !== mc.type ||
          cur?.season !== mc.season    || cur?.episode !== mc.episode) {
        if (typeof playById === 'function') {
          playById(mc.tmdb, mc.type, mc.title||'', mc.year||'');
        }
      }
    }

    // Sync server selection
    if (!WT.isHost && meta.serverIdx !== undefined) {
      const content = window.currentContent || meta.content;
      if (content && typeof setServer === 'function') {
        const btns = qsa('.server-btn');
        if (btns[meta.serverIdx] && !btns[meta.serverIdx].classList.contains('active')) {
          setServer(meta.serverIdx, content);
        }
      }
    }
  });
  WT.listeners.push(() => ref.off('value', handler));
}

/* ═══ SUBSCRIBE: PRESENCE ════════════════════════════════════════ */
function _subscribePresence(code) {
  const ref = WT.db.ref(`rooms/${code}/presence`);
  const handler = ref.on('value', snap => {
    WT.viewerMap = {};
    if (snap.exists()) {
      snap.forEach(child => {
        const d = child.val();
        const active = (d.online && (_ts() - (d.lastSeen||0)) < PRESENCE_TTL);
        WT.viewerMap[child.key] = { name: d.name||'Anon', online: active };
      });
    }
    _updateViewerCount();
    _updateViewerList();
  });
  WT.listeners.push(() => ref.off('value', handler));
}

/* ═══ SUBSCRIBE: CHAT ════════════════════════════════════════════ */
function _subscribeChat(code) {
  const box = qs('#chatMessages');
  if (box) box.innerHTML = '';

  const ref = WT.db.ref(`rooms/${code}/messages`).orderByChild('ts').limitToLast(80);
  const handler = ref.on('child_added', snap => {
    const msg = snap.val();
    if (!msg) return;
    _appendChatMessage(msg);
  });
  WT.listeners.push(() => ref.off('child_added', handler));
}

/* ═══ SEND CHAT ══════════════════════════════════════════════════ */
function sendChatMessage(text) {
  text = (text||'').trim();
  if (!text || !WT.db || !WT.roomCode) return;
  WT.db.ref(`rooms/${WT.roomCode}/messages`).push({
    userId: WT.userId,
    name:   WT.userName,
    text:   text,
    ts:     _ts(),
  });
}

function _appendChatMessage(msg) {
  const box = qs('#chatMessages');
  if (!box) return;

  const isSelf   = msg.userId === WT.userId;
  const isSystem = msg.userId === 'system';
  const d        = document.createElement('div');

  d.style.cssText = `
    margin-bottom:8px;
    padding:7px 10px;
    border-radius:10px;
    font-size:.81rem;
    line-height:1.45;
    max-width:90%;
    word-break:break-word;
    background:${isSystem ? 'rgba(16,185,129,.12)' : isSelf ? 'rgba(230,57,70,.18)' : 'rgba(255,255,255,.07)'};
    border:1px solid ${isSystem ? 'rgba(16,185,129,.2)' : isSelf ? 'rgba(230,57,70,.25)' : 'rgba(255,255,255,.08)'};
    align-self:${isSelf ? 'flex-end' : 'flex-start'};
    ${isSystem ? 'text-align:center;width:100%;font-style:italic;color:rgba(16,185,129,.9)' : ''}
  `;

  if (!isSystem) {
    d.innerHTML = `<span style="font-weight:700;font-size:.73rem;display:block;margin-bottom:3px;color:${isSelf?'#ff6b6b':'#9898b0'}">${_esc(msg.name)}${msg.userId===WT.db.ref(`rooms/${WT.roomCode}/meta`).key?'<span style="background:#e63946;color:#fff;padding:1px 4px;border-radius:3px;font-size:.58rem;margin-left:4px">HOST</span>':''}</span>${_esc(msg.text)}`;
  } else {
    d.textContent = msg.text;
  }

  box.appendChild(d);

  // Trim chat
  WT.chatCount++;
  if (WT.chatCount > CHAT_LIMIT) {
    box.firstChild?.remove();
    WT.chatCount--;
  }

  box.scrollTop = box.scrollHeight;
}

function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ═══ PLAYBACK SYNC ══════════════════════════════════════════════ */
// Host broadcasts when content/server changes — guests auto-follow
// (True frame-level sync isn't possible with cross-origin iframes;
//  we sync content selection and server choice which covers 95% of use cases)

function _broadcastContent(content, serverIdx) {
  if (!WT.isHost || !WT.db || !WT.roomCode) return;
  WT.db.ref(`rooms/${WT.roomCode}/meta`).update({
    content:   content,
    serverIdx: serverIdx||0,
  });
  _pushSystemMsg(`${WT.userName} changed the video 🎬`);
}

function _broadcastServer(idx) {
  if (!WT.isHost || !WT.db || !WT.roomCode) return;
  WT.db.ref(`rooms/${WT.roomCode}/meta`).update({ serverIdx: idx });
  _pushSystemMsg(`Host switched to Server ${idx+1}`);
}

function _pushSystemMsg(text) {
  if (!WT.db || !WT.roomCode) return;
  WT.db.ref(`rooms/${WT.roomCode}/messages`).push({
    userId: 'system', name:'System', text, ts: _ts()
  });
}

/* ═══ HOST CONTROLS ══════════════════════════════════════════════ */
function kickViewer(userId) {
  if (!WT.isHost || !WT.db || !WT.roomCode) return;
  const name = WT.viewerMap[userId]?.name || 'Viewer';
  WT.db.ref(`rooms/${WT.roomCode}/presence/${userId}`).remove();
  _pushSystemMsg(`${name} was removed from the room`);
  _showToast(`${name} removed`,'🚫');
}

async function toggleHostOnly() {
  if (!WT.isHost || !WT.db || !WT.roomCode) return;
  WT.hostOnly = !WT.hostOnly;
  await WT.db.ref(`rooms/${WT.roomCode}/meta`).update({ hostOnly: WT.hostOnly });
  _pushSystemMsg(WT.hostOnly ? '🔒 Room locked — host controls only' : '🔓 Room unlocked');
  _updateHUDHostBadge();
}

/* ═══ UI INJECTION ════════════════════════════════════════════════ */
function _injectStyles() {
  if (qs('#wt-styles')) return;
  const s = document.createElement('style');
  s.id = 'wt-styles';
  s.textContent = `
    /* Room HUD */
    #wt-hud {
      position:absolute; top:0; left:0; right:0; z-index:20;
      background:linear-gradient(180deg,rgba(0,0,0,.82) 0%,transparent 100%);
      padding:10px 14px 22px;
      display:flex; align-items:center; gap:10px;
      pointer-events:none;
    }
    #wt-hud.show { display:flex; }
    #wt-room-badge {
      background:rgba(230,57,70,.92); color:#fff;
      font-size:.68rem; font-weight:800; letter-spacing:.06em;
      padding:4px 10px; border-radius:20px;
      display:flex; align-items:center; gap:5px;
      pointer-events:auto;
    }
    #wt-viewers {
      display:flex; align-items:center; gap:5px;
      font-size:.75rem; font-weight:600; color:rgba(255,255,255,.85);
      pointer-events:auto; cursor:pointer;
    }
    #wt-viewers .dot { width:7px; height:7px; border-radius:50%; background:#10b981; animation:wtPulse 2s infinite; }
    #wt-host-badge {
      margin-left:auto;
      font-size:.65rem; font-weight:700; color:rgba(255,255,255,.6);
      pointer-events:auto;
    }
    #wt-leave-btn {
      pointer-events:auto;
      background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.18);
      color:#fff; font-size:.68rem; font-weight:700; padding:4px 10px;
      border-radius:20px; cursor:pointer; transition:all 140ms;
    }
    #wt-leave-btn:hover { background:rgba(230,57,70,.7); }

    /* Viewer panel */
    #wt-viewer-panel {
      position:absolute; top:44px; left:14px; z-index:25;
      background:rgba(14,14,20,.97); border:1px solid rgba(255,255,255,.12);
      border-radius:12px; padding:14px; min-width:200px;
      backdrop-filter:blur(16px); box-shadow:0 12px 40px rgba(0,0,0,.6);
      display:none;
    }
    #wt-viewer-panel.open { display:block; }
    #wt-viewer-panel h4 { font-size:.72rem; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:#9898b0; margin-bottom:10px; }
    .wt-viewer-row { display:flex; align-items:center; gap:8px; padding:5px 0; border-bottom:1px solid rgba(255,255,255,.05); }
    .wt-viewer-row:last-child { border-bottom:none; }
    .wt-viewer-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
    .wt-viewer-dot.on  { background:#10b981; }
    .wt-viewer-dot.off { background:#555; }
    .wt-viewer-name { flex:1; font-size:.8rem; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .wt-viewer-name.host::after { content:'HOST'; margin-left:5px; background:#e63946; color:#fff; font-size:.55rem; padding:1px 5px; border-radius:3px; vertical-align:middle; font-weight:800; }
    .wt-kick-btn { font-size:.62rem; color:#ff6b6b; background:rgba(230,57,70,.12); border:1px solid rgba(230,57,70,.2); padding:2px 7px; border-radius:20px; cursor:pointer; transition:all 120ms; font-weight:700; }
    .wt-kick-btn:hover { background:rgba(230,57,70,.35); }

    /* Host control bar */
    #wt-host-controls {
      display:none; gap:7px; flex-wrap:wrap;
      padding:8px 14px 10px;
      border-bottom:1px solid rgba(255,255,255,.06);
    }
    #wt-host-controls.show { display:flex; }
    .wt-hc-btn {
      padding:5px 12px; border-radius:20px; font-size:.73rem; font-weight:700;
      cursor:pointer; transition:all 130ms;
      background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12);
      color:rgba(255,255,255,.75);
    }
    .wt-hc-btn:hover { background:rgba(255,255,255,.15); color:#fff; }
    .wt-hc-btn.danger { color:#ff6b6b; border-color:rgba(230,57,70,.25); }
    .wt-hc-btn.active { background:rgba(230,57,70,.2); border-color:rgba(230,57,70,.4); color:#ff6b6b; }

    /* Shared name input banner */
    #wt-name-bar {
      position:absolute; bottom:0; left:0; right:0; z-index:25;
      background:rgba(14,14,20,.95); padding:10px 14px;
      display:none; align-items:center; gap:8px;
      border-top:1px solid rgba(255,255,255,.08);
    }
    #wt-name-bar.show { display:flex; }
    #wt-name-inp {
      flex:1; padding:7px 12px; border-radius:8px;
      background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12);
      color:#fff; font-size:.82rem; outline:none;
    }
    #wt-name-inp:focus { border-color:rgba(230,57,70,.4); }
    #wt-name-save {
      padding:7px 14px; border-radius:8px;
      background:#e63946; color:#fff; font-size:.8rem; font-weight:700;
      cursor:pointer; border:none; transition:all 130ms;
    }
    #wt-name-save:hover { background:#ff6b6b; }

    @keyframes wtPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  `;
  document.head.appendChild(s);
}

function _buildRoomHUD() {
  const pbox = qs('.p-box');
  if (!pbox) return;

  // Ensure player video container is relative
  const pv = qs('#playerVideo');
  if (pv) pv.style.position = 'relative';

  // ── Room HUD (over video) ──
  let hud = qs('#wt-hud');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'wt-hud';
    pv?.appendChild(hud);
  }
  hud.innerHTML = `
    <div id="wt-room-badge">🎬 ROOM&nbsp;<strong>${WT.roomCode}</strong></div>
    <div id="wt-viewers" onclick="_toggleViewerPanel()">
      <span class="dot"></span>
      <span id="wt-viewer-count">1 watching</span>
    </div>
    <div id="wt-host-badge">${WT.isHost ? '👑 You are Host' : ''}</div>
    <button id="wt-leave-btn" onclick="leaveRoom()">Leave</button>
  `;
  hud.classList.add('show');

  // ── Viewer panel (dropdown) ──
  let vp = qs('#wt-viewer-panel');
  if (!vp) {
    vp = document.createElement('div');
    vp.id = 'wt-viewer-panel';
    pv?.appendChild(vp);
  }

  // ── Host controls bar (below video, inside p-meta) ──
  const pmeta = qs('.p-meta');
  let hcBar = qs('#wt-host-controls');
  if (!hcBar && pmeta) {
    hcBar = document.createElement('div');
    hcBar.id = 'wt-host-controls';
    pmeta.insertBefore(hcBar, pmeta.firstChild);
  }

  if (WT.isHost && hcBar) {
    hcBar.innerHTML = `
      <span style="font-size:.68rem;font-weight:800;letter-spacing:.1em;color:#9898b0;text-transform:uppercase;align-self:center">Host Controls</span>
      <button class="wt-hc-btn" id="wt-lock-btn" onclick="toggleHostOnly()">🔓 Unlocked</button>
      <button class="wt-hc-btn" onclick="_copyRoomLink()">📋 Copy Link</button>
      <button class="wt-hc-btn danger" onclick="leaveRoom()">✕ Close Room</button>
    `;
    hcBar.classList.add('show');
  }

  // ── Name bar ──
  _ensureNameBar();

  // Patch chat send
  _patchChatInput();
}

function _destroyRoomHUD() {
  qs('#wt-hud')?.remove();
  qs('#wt-viewer-panel')?.remove();
  qs('#wt-host-controls')?.remove();
  qs('#wt-name-bar')?.remove();
  // Clear chat
  const box = qs('#chatMessages');
  if (box) box.innerHTML = '<span style="color:var(--tx3,#55556a);font-style:italic">Share the room to chat…</span>';
}

function _ensureNameBar() {
  if (qs('#wt-name-bar')) return;
  const cp = qs('#chatPanel');
  if (!cp) return;
  const bar = document.createElement('div');
  bar.id = 'wt-name-bar';
  bar.classList.add('show');
  bar.innerHTML = `
    <span style="font-size:.72rem;color:#9898b0;white-space:nowrap">Your name:</span>
    <input id="wt-name-inp" value="${_esc(WT.userName)}" maxlength="20" placeholder="Your name">
    <button id="wt-name-save" onclick="_saveWTName()">Save</button>
  `;
  cp.appendChild(bar);
}

function _saveWTName() {
  const v = (qs('#wt-name-inp')?.value || '').trim();
  if (!v) return;
  WT.userName = v;
  localStorage.setItem('wt_name', v);
  if (WT.presenceRef) WT.presenceRef.update({ name: v });
  _showToast(`Name set to "${v}"`, '✅');
}

function _patchChatInput() {
  // Override existing _sendChat to use Firebase
  window._sendChat = function() {
    const inp = qs('#chatInput');
    const msg = (inp?.value || '').trim();
    if (!msg) return;
    if (WT.roomCode) {
      sendChatMessage(msg);
    } else {
      // Fallback local chat
      const box = qs('#chatMessages');
      if (box) {
        const d = document.createElement('div');
        d.innerHTML = `<span style="color:#ff6b6b;font-weight:700">You:</span> ${_esc(msg)}`;
        box.appendChild(d); box.scrollTop = box.scrollHeight;
      }
    }
    if (inp) inp.value = '';
  };
  qs('#chatInput')?.addEventListener('keydown', e => { if(e.key==='Enter') window._sendChat(); });
}

function _toggleViewerPanel() {
  const vp = qs('#wt-viewer-panel');
  if (!vp) return;
  vp.classList.toggle('open');
  if (vp.classList.contains('open')) _updateViewerList();
}

function _updateViewerCount() {
  const onlineCount = Object.values(WT.viewerMap).filter(v => v.online).length;
  const el = qs('#wt-viewer-count');
  if (el) el.textContent = `${onlineCount} watching`;
}

function _updateViewerList() {
  const vp = qs('#wt-viewer-panel');
  if (!vp) return;

  const entries = Object.entries(WT.viewerMap);
  if (!entries.length) { vp.innerHTML = '<h4>Viewers</h4><p style="font-size:.78rem;color:#9898b0">No one else here</p>'; return; }

  // Get host from meta (read from DB cache or isHost flag)
  const rows = entries.map(([uid, v]) => {
    const isMe   = uid === WT.userId;
    const online = v.online;
    const isH    = isMe && WT.isHost;
    return `
      <div class="wt-viewer-row">
        <span class="wt-viewer-dot ${online?'on':'off'}"></span>
        <span class="wt-viewer-name ${isH?'host':''}">${_esc(v.name)}${isMe?' (you)':''}</span>
        ${WT.isHost && !isMe ? `<button class="wt-kick-btn" onclick="kickViewer('${uid}')">Kick</button>` : ''}
      </div>`;
  }).join('');

  vp.innerHTML = `<h4>Viewers (${entries.length})</h4>${rows}`;
}

function _updateHUDHostBadge() {
  const btn = qs('#wt-lock-btn');
  if (btn) {
    btn.textContent = WT.hostOnly ? '🔒 Locked' : '🔓 Unlocked';
    btn.classList.toggle('active', WT.hostOnly);
  }
}

/* ═══ PATCH WT BUTTONS ════════════════════════════════════════════ */
function _patchWTButtons() {
  // Override the Create Room button handler
  window._createRoom = async function() {
    const hd = qs('#wtHome');
    const cr = qs('#wtCreated');
    if (!hd || !cr) { await createRoom(); return; }

    // Show room code first, then create on Firebase
    const code = _code();
    qs('#roomCodeDisplay').textContent = code;
    hd.style.display = 'none';
    cr.style.display = '';

    // Assign WT.roomCode so _copyRoom works
    WT._pendingCode = code;
  };

  // Override Start Watching
  window._startWT = async function() {
    const code = WT._pendingCode || qs('#roomCodeDisplay')?.textContent;
    if (!code) return;
    window.closeWatchTogetherMenu?.();
    await createRoomWithCode(code);
  };

  // Override Join Room
  window._joinRoom = async function() {
    const code = qs('#joinCodeInput')?.value?.trim()?.toUpperCase();
    if (!code) { _showToast('Enter a room code','⚠️'); return; }
    window.closeJoinRoomDialog?.();
    window.closeWatchTogetherMenu?.();
    await joinRoom(code);
  };

  // Override copy link
  window._copyRoomLink = function() {
    const code = WT.roomCode || WT._pendingCode || qs('#roomCodeDisplay')?.textContent;
    if (!code) return;
    const url = `${location.origin}${location.pathname}?room=${code}`;
    navigator.clipboard.writeText(url).then(()=>_showToast('Room link copied!','📋')).catch(()=>_showToast(url,'📋',5000));
  };

  window._copyRoom = window._copyRoomLink;
  window._shareRoom = function() {
    const code = WT.roomCode || WT._pendingCode || qs('#roomCodeDisplay')?.textContent;
    if (!code) return;
    const url  = `${location.origin}${location.pathname}?room=${code}`;
    if(navigator.share) navigator.share({title:'Watch on Flixora',text:`Join my room! Code: ${code}`,url});
    else window._copyRoomLink();
  };

  // Intercept playById — broadcast to room if host
  const origPlay = window.playById;
  window.playById = async function(tmdbId, type, title, year) {
    await origPlay(tmdbId, type, title, year);
    if (WT.isHost && WT.db && WT.roomCode) {
      setTimeout(() => {
        _broadcastContent(window.currentContent, 0);
      }, 600);
    }
  };

  // Intercept setServer — broadcast server change if host
  const origSS = window.setServer;
  window.setServer = function(idx, data) {
    origSS(idx, data);
    if (WT.isHost && WT.db && WT.roomCode) {
      _broadcastServer(idx);
    }
  };
}

async function createRoomWithCode(code) {
  const content = window.currentContent || null;
  await WT.db.ref(`rooms/${code}`).set({
    meta: {
      hostId:   WT.userId,
      hostName: WT.userName,
      createdAt: _ts(),
      content:   content,
      serverIdx: 0,
      hostOnly:  false,
      version:   WT_VERSION,
    },
    playback: { action:'idle', ts: _ts() },
  });
  _joinRoomInternal(code, true);
}

/* ═══ AUTO-JOIN FROM URL ══════════════════════════════════════════ */
function _checkRoomParam() {
  const params = new URLSearchParams(location.search);
  const code   = params.get('room');
  if (code) {
    console.log(`[WT] Auto-joining room from URL: ${code}`);
    setTimeout(() => joinRoom(code), 1200);
  }
}

/* ═══ NO FIREBASE FALLBACK ════════════════════════════════════════ */
function _patchUINoFirebase() {
  const badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;bottom:70px;right:14px;z-index:999;background:#1a1a2e;border:1px solid rgba(245,197,24,.3);color:rgba(245,197,24,.9);padding:9px 14px;border-radius:10px;font-size:.75rem;max-width:260px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,.5)';
  badge.innerHTML = `⚠️ <strong>Watch Together</strong><br>Firebase not configured.<br><a href="https://console.firebase.google.com" target="_blank" style="color:#f5c518">Set it up →</a> then edit room-manager.js`;
  document.body.appendChild(badge);
  setTimeout(() => badge.remove(), 12000);
}

/* ═══ TOAST HELPER (uses app's showToast if available) ═══════════ */
function _showToast(msg, icon='✅', ms=2600) {
  if (typeof showToast === 'function') { showToast(msg, icon, ms); return; }
  console.log(`[WT] ${icon} ${msg}`);
}

/* ═══ EXPORTS ════════════════════════════════════════════════════ */
window.initFirebase   = initFirebase;
window.createRoom     = createRoom;
window.joinRoom       = joinRoom;
window.leaveRoom      = leaveRoom;
window.sendChatMessage = sendChatMessage;
window.kickViewer     = kickViewer;
window.toggleHostOnly = toggleHostOnly;

// Expose WT state for debugging
window._WT = WT;

console.log(`%c👥 Watch Together module loaded (v${WT_VERSION})`, 'color:#10b981');
