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
const _wtQs  = s => document.querySelector(s);
const _wtQsa = s => [...document.querySelectorAll(s)];

/* ═══ FIREBASE LOADER ════════════════════════════════════════════ */
async function loadFirebaseSDK() {
  if (window._firebaseLoaded) return true;

  // Already loaded and initialized
  if (window.firebase && window.firebase.database && typeof window.firebase.database === 'function') {
    window._firebaseLoaded = true;
    return true;
  }

  // Load app first, then database sequentially (order matters!)
  const loadScript = (src, id) => new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const el = document.createElement('script');
    el.id = id; el.src = src;
    el.onload  = () => resolve();
    el.onerror = () => reject(new Error('Failed to load: ' + src));
    document.head.appendChild(el);
  });

  try {
    // Step 1: load firebase-app FIRST and wait
    await loadScript(FIREBASE_CDN + 'firebase-app-compat.js', 'fb-app');
    // Step 2: small pause to let app init
    await new Promise(r => setTimeout(r, 80));
    // Step 3: load firebase-database AFTER app is ready
    await loadScript(FIREBASE_CDN + 'firebase-database-compat.js', 'fb-db');
    // Step 4: verify both are available
    await new Promise(r => setTimeout(r, 80));
    if (!window.firebase?.database) throw new Error('firebase.database still not available');
    window._firebaseLoaded = true;
    console.log('[WT] Firebase SDK loaded successfully');
    return true;
  } catch(e) {
    console.error('[WT] Firebase SDK load failed:', e.message);
    return false;
  }
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
          const modal = _wtQs('#playerModal');
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
  if (_wtQs('#wt-joining-ov')) return;
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
  const ov = _wtQs('#wt-joining-ov');
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

    // Sync content — if host changed what's playing, guest auto-loads
    if (!WT.isHost && meta.content) {
      const cur = window.currentContent;
      const mc  = meta.content;
      const isDiff = !cur ||
        String(cur.tmdb) !== String(mc.tmdb) ||
        cur.type !== mc.type ||
        cur.season !== mc.season ||
        cur.episode !== mc.episode;

      if (isDiff && mc.tmdb) {
        console.log('[WT] Host changed content → syncing guest', mc);
        // Open modal if not open
        const modal = _wtQs('#playerModal');
        if (modal && !modal.classList.contains('active')) {
          modal.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
        if (typeof playById === 'function') {
          playById(String(mc.tmdb), mc.type, mc.title||'', mc.year||'');
        }
      }
    }

    // Sync server selection
    if (!WT.isHost && meta.serverIdx !== undefined) {
      const content = window.currentContent || meta.content;
      if (content && typeof setServer === 'function') {
        const btns = _wtQsa('.server-btn');
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
  const box = _wtQs('#chatMessages');
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
function sendChatMessage(text, extra={}) {
  text = (text||'').trim();
  const hasMedia = extra.gif || extra.img;
  if (!text && !hasMedia) return;
  if (!WT.db || !WT.roomCode) return;
  const msg = { userId:WT.userId, name:WT.userName, text:text||'', ts:_ts() };
  if (extra.replyTo) msg.replyTo = extra.replyTo;
  if (extra.gif)     msg.gif     = extra.gif;
  if (extra.img)     msg.img     = extra.img;
  WT.db.ref(`rooms/${WT.roomCode}/messages`).push(msg);
}

// Store messages by Firebase key for reply lookup
const WT_MSG_CACHE = {};

function _appendChatMessage(msg, fbKey) {
  const box = _wtQs('#chatMessages');
  if (!box) return;
  if (fbKey) WT_MSG_CACHE[fbKey] = msg;

  const isSelf   = msg.userId === WT.userId;
  const isSystem = msg.userId === 'system';
  const d        = document.createElement('div');
  d.dataset.msgId = fbKey || '';

  d.style.cssText = [
    'position:relative',
    'padding:7px 10px 7px',
    'border-radius:10px',
    'font-size:.81rem',
    'line-height:1.45',
    'max-width:92%',
    'word-break:break-word',
    `background:${isSystem?'rgba(16,185,129,.12)':isSelf?'rgba(230,57,70,.15)':'rgba(255,255,255,.06)'}`,
    `border:1px solid ${isSystem?'rgba(16,185,129,.2)':isSelf?'rgba(230,57,70,.22)':'rgba(255,255,255,.08)'}`,
    `align-self:${isSelf?'flex-end':isSystem?'center':'flex-start'}`,
    isSystem?'text-align:center;font-style:italic;color:rgba(16,185,129,.9);width:90%':''
  ].join(';');

  if (isSystem) {
    d.textContent = msg.text;
  } else {
    let inner = '';

    // Reply preview
    if (msg.replyTo) {
      inner += `<div style="border-left:2px solid rgba(230,57,70,.6);padding:3px 7px;margin-bottom:5px;border-radius:0 4px 4px 0;background:rgba(0,0,0,.25);font-size:.72rem;color:#9898b0;cursor:pointer" onclick="_scrollToMsg('${_esc(msg.replyTo.id)}')">
        <span style="color:#ff6b6b;font-weight:700">${_esc(msg.replyTo.name)}</span>
        <span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px">${msg.replyTo.img?'📷 Photo':msg.replyTo.gif?'🎞 GIF':_esc(msg.replyTo.text||'')} </span>
      </div>`;
    }

    // Sender name
    inner += `<span style="font-weight:700;font-size:.72rem;display:block;margin-bottom:3px;color:${isSelf?'#ff6b6b':'#6ec6ff'}">${_esc(msg.name)}</span>`;

    // GIF
    if (msg.gif) {
      inner += `<img src="${_esc(msg.gif)}" alt="gif" style="max-width:100%;border-radius:6px;display:block;margin-bottom:${msg.text?'4px':'0'}" loading="lazy">`;
    }

    // Image
    if (msg.img) {
      inner += `<img src="${_esc(msg.img)}" alt="img" style="max-width:100%;border-radius:6px;display:block;cursor:pointer;margin-bottom:${msg.text?'4px':'0'}" loading="lazy" onclick="window.open(this.src)">`;
    }

    // Text
    if (msg.text) inner += `<span>${_esc(msg.text)}</span>`;

    // Reply button (on hover)
    inner += `<button class="wt-reply-btn" data-msg-id="${fbKey||''}" title="Reply"
      style="position:absolute;top:4px;right:${isSelf?'auto':'4px'};${isSelf?'left:4px':'right:4px'};
      background:rgba(0,0,0,.5);border:none;color:#fff;border-radius:50%;
      width:22px;height:22px;font-size:.65rem;cursor:pointer;
      display:none;align-items:center;justify-content:center;line-height:1" onclick="_setReply('${fbKey||''}',${JSON.stringify({
        id:fbKey||'', name:_esc(msg.name), text:(msg.text||''
      ).slice(0,60), img:msg.img||null, gif:msg.gif||null}).replace(/'/g,'&#39;')})">↩</button>`;

    d.innerHTML = inner;
  }

  // Show/hide reply btn on hover
  d.addEventListener('mouseenter', () => { const b=d.querySelector('.wt-reply-btn'); if(b) b.style.display='flex'; });
  d.addEventListener('mouseleave', () => { const b=d.querySelector('.wt-reply-btn'); if(b) b.style.display='none'; });
  // Touch support
  d.addEventListener('touchstart', () => { const b=d.querySelector('.wt-reply-btn'); if(b) b.style.display='flex'; },{passive:true});

  box.appendChild(d);
  WT.chatCount++;
  if (WT.chatCount > CHAT_LIMIT) { box.firstChild?.remove(); WT.chatCount--; }
  box.scrollTop = box.scrollHeight;
}

function _scrollToMsg(id) {
  const el = document.querySelector(`[data-msg-id="${id}"]`);
  if (el) { el.scrollIntoView({behavior:'smooth',block:'center'}); el.style.outline='2px solid rgba(230,57,70,.5)'; setTimeout(()=>el.style.outline='',1200); }
}

// Current reply state
let WT_REPLY = null;

function _setReply(id, data) {
  WT_REPLY = { id, ...data };
  const bar = _wtQs('#wt-reply-bar');
  if (!bar) return;
  bar.style.display = 'flex';
  bar.querySelector('#wt-reply-preview').textContent = `↩ ${data.name}: ${data.img?'📷 Photo':data.gif?'🎞 GIF':data.text}`;
  _wtQs('#wt-chat-inp2')?.focus();
}

function _clearReply() {
  WT_REPLY = null;
  const bar = _wtQs('#wt-reply-bar');
  if (bar) bar.style.display = 'none';
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
  if (_wtQs('#wt-styles')) return;
  const s = document.createElement('style');
  s.id = 'wt-styles';
  s.textContent = `
    /* Room HUD */
    #wt-hud {
      position:absolute; bottom:0; left:0; right:0; z-index:20;
      background:linear-gradient(0deg,rgba(0,0,0,.75) 0%,transparent 100%);
      padding:22px 14px 10px;
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
      background:rgba(20,20,20,.75); border:1px solid rgba(255,255,255,.25);
      color:#fff; font-size:.68rem; font-weight:700; padding:5px 12px;
      border-radius:20px; cursor:pointer; transition:all 140ms;
      backdrop-filter:blur(6px);
    }
    #wt-leave-btn:hover { background:rgba(230,57,70,.8); border-color:transparent; }

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

    /* name bar removed */

    @keyframes wtPulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    /* Push player close btn left when chat panel is open */
    #chatPanel.show ~ * #playerClose,
    .p-box:has(#chatPanel.show) #playerClose {
      right: 274px !important;
      transition: right .3s;
    }
    #playerClose { transition: right .3s; }
  `;
  document.head.appendChild(s);
}

function _buildRoomHUD() {
  const pbox = _wtQs('.p-box');
  if (!pbox) return;

  // Ensure player video container is relative
  const pv = _wtQs('#playerVideo');
  if (pv) pv.style.position = 'relative';

  // ── Room HUD (over video) ──
  let hud = _wtQs('#wt-hud');
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
  let vp = _wtQs('#wt-viewer-panel');
  if (!vp) {
    vp = document.createElement('div');
    vp.id = 'wt-viewer-panel';
    pv?.appendChild(vp);
  }

  // ── Host controls bar (below video, inside p-meta) ──
  const pmeta = _wtQs('.p-meta');
  let hcBar = _wtQs('#wt-host-controls');
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

  // ── Completely rebuild chat panel ──
  _rebuildChatPanel();

  // ── Add maximize/fullscreen button to player ──
  _injectMaximizeBtn();
}

function _destroyRoomHUD() {
  _wtQs('#wt-hud')?.remove();
  _wtQs('#wt-viewer-panel')?.remove();
  _wtQs('#wt-host-controls')?.remove();
  _wtQs('#wt-name-bar')?.remove();
  // Clear chat
  const box = _wtQs('#chatMessages');
  if (box) box.innerHTML = '<span style="color:var(--tx3,#55556a);font-style:italic">Share the room to chat…</span>';
}

function _ensureNameBar() {} // no-op — replaced by _rebuildChatPanel

function _rebuildChatPanel() {
  const cp = _wtQs('#chatPanel');
  if (!cp) return;

  cp.innerHTML = '';
  cp.style.cssText = 'position:absolute;right:0;top:0;height:100%;width:270px;background:rgba(12,12,18,.98);border-left:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;z-index:5;transform:none';

  // ── Header ──
  const hd = document.createElement('div');
  hd.style.cssText = 'padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);font-weight:700;font-size:.86rem;display:flex;align-items:center;gap:6px;flex-shrink:0;color:#fff';
  hd.innerHTML = `
    <button onclick="toggleChatPanel()" title="Hide chat"
      style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.1);border:none;color:#fff;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
    <span style="flex:1;text-align:center">💬 Live Chat</span>
    <span style="width:26px"></span>
  `;
  cp.appendChild(hd);

  // ── Name row ──
  const nameRow = document.createElement('div');
  nameRow.style.cssText = 'padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.05);display:flex;align-items:center;gap:5px;flex-shrink:0';
  nameRow.innerHTML = `
    <span style="font-size:.68rem;color:#55556a;white-space:nowrap">Name:</span>
    <input id="wt-name-inp2" value="${_esc(WT.userName)}" maxlength="20"
      style="flex:1;padding:4px 8px;border-radius:5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:#fff;font-size:.74rem;font-family:inherit;outline:none;min-width:0">
    <button id="wt-name-save2" style="padding:4px 8px;border-radius:5px;background:rgba(230,57,70,.65);color:#fff;font-size:.7rem;font-weight:700;cursor:pointer;border:none;white-space:nowrap">OK</button>
  `;
  cp.appendChild(nameRow);
  nameRow.querySelector('#wt-name-save2').onclick = () => {
    const v = (nameRow.querySelector('#wt-name-inp2')?.value||'').trim();
    if (!v) return;
    WT.userName = v; localStorage.setItem('wt_name',v);
    WT.presenceRef?.update({name:v});
    _showToast(`Name: "${v}"`,'✅');
  };

  // ── Messages ──
  const msgs = document.createElement('div');
  msgs.id = 'chatMessages';
  msgs.style.cssText = 'flex:1;overflow-y:auto;padding:8px 8px 4px;display:flex;flex-direction:column;gap:5px;font-size:.81rem;color:#9898b0;scroll-behavior:smooth';
  msgs.innerHTML = '<span style="font-style:italic;color:#55556a;text-align:center;padding:10px 0">Say hi! 👋</span>';
  cp.appendChild(msgs);

  // ── Reply bar ──
  const replyBar = document.createElement('div');
  replyBar.id = 'wt-reply-bar';
  replyBar.style.cssText = 'display:none;align-items:center;gap:6px;padding:5px 10px;background:rgba(230,57,70,.1);border-top:1px solid rgba(230,57,70,.2);flex-shrink:0';
  replyBar.innerHTML = `
    <span id="wt-reply-preview" style="flex:1;font-size:.72rem;color:#ff6b6b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span>
    <button onclick="_clearReply()" style="background:none;border:none;color:#9898b0;cursor:pointer;font-size:.85rem;flex-shrink:0">✕</button>
  `;
  cp.appendChild(replyBar);

  // ── GIF search panel (hidden) ──
  const gifPanel = document.createElement('div');
  gifPanel.id = 'wt-gif-panel';
  gifPanel.style.cssText = 'display:none;flex-direction:column;border-top:1px solid rgba(255,255,255,.08);background:rgba(10,10,14,.98);flex-shrink:0;max-height:200px';
  gifPanel.innerHTML = `
    <div style="display:flex;gap:6px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.06)">
      <input id="wt-gif-search" placeholder="Search GIFs…" style="flex:1;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#fff;font-size:.78rem;font-family:inherit;outline:none">
      <button onclick="_wtSearchGif()" style="padding:5px 9px;border-radius:6px;background:#e63946;color:#fff;font-size:.75rem;cursor:pointer;border:none;font-weight:700">Go</button>
    </div>
    <div id="wt-gif-results" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:6px 8px;overflow-y:auto;max-height:160px"></div>
  `;
  cp.appendChild(gifPanel);
  gifPanel.querySelector('#wt-gif-search').addEventListener('keydown',e=>{ if(e.key==='Enter') _wtSearchGif(); });

  // ── Emoji picker (hidden) ──
  const emojiPanel = document.createElement('div');
  emojiPanel.id = 'wt-emoji-panel';
  emojiPanel.style.cssText = 'display:none;flex-wrap:wrap;gap:2px;padding:8px;border-top:1px solid rgba(255,255,255,.08);background:rgba(10,10,14,.98);max-height:130px;overflow-y:auto;flex-shrink:0';
  const EMOJIS = ['😀','😂','🥹','😍','🥰','😘','😎','🤩','😭','😱','😡','🥺','😏','🤔','🤣','😴','🫡','🫶','❤️','🔥','💯','👍','👎','👏','🙌','🤝','✌️','🫂','💀','👀','🎉','🎬','🍿','💔','❤️‍🔥','💕','🥂','😤','🤯','🥴','😵','🤮','🤧','🫠','🙂‍↔️','😶','🫣','🤭','🥱','😮','🫢'];
  EMOJIS.forEach(em => {
    const b = document.createElement('button');
    b.textContent = em;
    b.style.cssText = 'background:none;border:none;font-size:1.2rem;cursor:pointer;padding:2px;border-radius:4px;transition:background 100ms';
    b.onmouseenter = ()=>b.style.background='rgba(255,255,255,.1)';
    b.onmouseleave = ()=>b.style.background='none';
    b.onclick = () => {
      const inp = _wtQs('#wt-chat-inp2');
      if (inp) { inp.value += em; inp.focus(); }
      _toggleEmojiPanel(false);
    };
    emojiPanel.appendChild(b);
  });
  cp.appendChild(emojiPanel);

  // ── Toolbar row (emoji, gif, image) ──
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;align-items:center;gap:4px;padding:5px 8px 0;flex-shrink:0';
  toolbar.innerHTML = `
    <button id="wt-emoji-btn" title="Emoji"
      style="background:none;border:none;font-size:1.15rem;cursor:pointer;padding:4px 5px;border-radius:6px;color:#9898b0;transition:all 120ms">😊</button>
    <button id="wt-gif-btn" title="GIF"
      style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#9898b0;font-size:.68rem;font-weight:800;padding:3px 7px;border-radius:5px;cursor:pointer;letter-spacing:.05em;transition:all 120ms">GIF</button>
    <label id="wt-img-btn" title="Send image" style="background:none;border:none;font-size:1.1rem;cursor:pointer;padding:4px 5px;border-radius:6px;color:#9898b0;transition:all 120ms">
      📷<input type="file" accept="image/*" style="display:none" id="wt-img-inp">
    </label>
    <span style="flex:1"></span>
    <span style="font-size:.64rem;color:#55556a" id="wt-char-count">0/200</span>
  `;
  cp.appendChild(toolbar);

  // ── Input row ──
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:5px;padding:6px 8px 8px;flex-shrink:0';
  row.innerHTML = `
    <input id="wt-chat-inp2" type="text" placeholder="Type a message…" maxlength="200"
      style="flex:1;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);color:#fff;font-size:.82rem;font-family:inherit;outline:none;min-width:0">
    <button id="wt-chat-send2"
      style="padding:8px 11px;border-radius:8px;background:#e63946;color:#fff;font-size:.85rem;font-weight:700;cursor:pointer;border:none;flex-shrink:0;transition:all 130ms">➤</button>
  `;
  cp.appendChild(row);

  const inp  = row.querySelector('#wt-chat-inp2');
  const send = row.querySelector('#wt-chat-send2');

  // Char counter
  inp.addEventListener('input', () => {
    const cc = _wtQs('#wt-char-count');
    if (cc) { cc.textContent=`${inp.value.length}/200`; cc.style.color=inp.value.length>180?'#ff6b6b':'#55556a'; }
    // Close panels on type
    _toggleGifPanel(false); _toggleEmojiPanel(false);
  });

  function doSend(extra={}) {
    const msg = (inp.value||'').trim();
    if (!msg && !extra.gif && !extra.img) return;
    const payload = { ...extra };
    if (WT_REPLY) { payload.replyTo = WT_REPLY; _clearReply(); }
    if (WT.roomCode) {
      sendChatMessage(msg, payload);
    } else {
      _appendChatMessage({ userId:WT.userId, name:WT.userName, text:msg, ts:_ts(), ...payload });
    }
    inp.value = '';
    const cc = _wtQs('#wt-char-count'); if(cc) cc.textContent='0/200';
    inp.focus();
  }

  send.addEventListener('click', ()=>doSend());
  send.onmouseenter = ()=>send.style.background='#ff6b6b';
  send.onmouseleave = ()=>send.style.background='#e63946';
  inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();doSend();} });
  inp.addEventListener('focus', ()=>inp.style.borderColor='rgba(230,57,70,.35)');
  inp.addEventListener('blur',  ()=>inp.style.borderColor='rgba(255,255,255,.1)');
  window._sendChat = ()=>doSend();

  // Emoji toggle
  toolbar.querySelector('#wt-emoji-btn').onclick = ()=>_toggleEmojiPanel();
  toolbar.querySelector('#wt-gif-btn').onclick   = ()=>_toggleGifPanel();

  // Image upload
  toolbar.querySelector('#wt-img-inp').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 800*1024) { _showToast('Image too large (max 800KB)','⚠️'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      _showToast('Sending image…','📷',1500);
      doSend({ img: reader.result });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  cp.classList.add('show');
}

// ── Emoji / GIF panel toggles ──
function _toggleEmojiPanel(force) {
  const ep = _wtQs('#wt-emoji-panel');
  const gp = _wtQs('#wt-gif-panel');
  if (!ep) return;
  const open = force !== undefined ? force : ep.style.display==='none';
  ep.style.display = open ? 'flex' : 'none';
  if (open && gp) gp.style.display='none';
}

function _toggleGifPanel(force) {
  const gp = _wtQs('#wt-gif-panel');
  const ep = _wtQs('#wt-emoji-panel');
  if (!gp) return;
  const open = force !== undefined ? force : gp.style.display==='none';
  gp.style.display = open ? 'flex' : 'none';
  if (open && ep) ep.style.display='none';
  if (open) _wtQs('#wt-gif-search')?.focus();
}

async function _wtSearchGif() {
  const q = (_wtQs('#wt-gif-search')?.value||'').trim();
  const results = _wtQs('#wt-gif-results');
  if (!results) return;
  results.innerHTML = '<span style="font-size:.75rem;color:#55556a;grid-column:1/-1;text-align:center;padding:10px">Loading…</span>';
  try {
    // Tenor v2 API — free, no key needed for basic usage
    const url = q
      ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=AIzaSyAyimkuYQYF_FXVALexPzkcsvZnUpdated&client_key=flixora&limit=12`
      : `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPzkcsvZnUpdated&client_key=flixora&limit=12`;
    const res  = await fetch(url);
    const data = await res.json();
    const gifs = data?.results || [];
    if (!gifs.length) { results.innerHTML='<span style="font-size:.75rem;color:#55556a;grid-column:1/-1;text-align:center;padding:10px">No results</span>'; return; }
    results.innerHTML = '';
    gifs.forEach(g => {
      const gifUrl = g.media_formats?.tinygif?.url || g.media_formats?.gif?.url;
      if (!gifUrl) return;
      const img = document.createElement('img');
      img.src = gifUrl; img.loading='lazy';
      img.style.cssText='width:100%;border-radius:5px;cursor:pointer;object-fit:cover;max-height:70px';
      img.title = g.content_description||'GIF';
      img.onclick = () => {
        _toggleGifPanel(false);
        const inp = _wtQs('#wt-chat-inp2');
        const doS = window._sendChat;
        // Send gif directly
        const msg = (inp?.value||'').trim();
        const payload = { gif: gifUrl };
        if (WT_REPLY) { payload.replyTo=WT_REPLY; _clearReply(); }
        if (WT.roomCode) { sendChatMessage(msg, payload); } else { _appendChatMessage({userId:WT.userId,name:WT.userName,text:msg,ts:_ts(),...payload}); }
        if (inp) { inp.value=''; inp.focus(); }
      };
      results.appendChild(img);
    });
  } catch(e) {
    results.innerHTML='<span style="font-size:.75rem;color:#ff6b6b;grid-column:1/-1;text-align:center;padding:8px">GIF load failed</span>';
    console.error('[WT GIF]',e);
  }
}

function _saveWTName() {
  const v = (_wtQs('#wt-name-inp')?.value || '').trim();
  if (!v) return;
  WT.userName = v;
  localStorage.setItem('wt_name', v);
  if (WT.presenceRef) WT.presenceRef.update({ name: v });
  _showToast(`Name set to "${v}"`, '✅');
}

function _patchChatInput() {
  // ── Rebuild the entire ch-inp area for reliability ──
  const chatPanel = _wtQs('#chatPanel');
  if (!chatPanel) return;

  // Remove old ch-inp if exists
  const oldInp = chatPanel.querySelector('.ch-inp');
  if (oldInp) oldInp.remove();

  // Also remove stale name bar
  _wtQs('#wt-name-bar')?.remove();

  // Build fresh chat input row
  const row = document.createElement('div');
  row.className = 'ch-inp';
  row.style.cssText = 'display:flex;gap:6px;padding:10px;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0';
  row.innerHTML = `
    <input id="wt-chat-inp" type="text" placeholder="Type a message…"
      style="flex:1;padding:8px 11px;border-radius:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#fff;font-size:.82rem;font-family:inherit;outline:none"
      maxlength="200">
    <button id="wt-chat-send"
      style="padding:8px 13px;border-radius:8px;background:#e63946;color:#fff;font-size:.82rem;font-weight:700;cursor:pointer;border:none;flex-shrink:0">➤</button>
  `;
  chatPanel.appendChild(row);

  const inp  = row.querySelector('#wt-chat-inp');
  const send = row.querySelector('#wt-chat-send');

  function doSend() {
    const msg = (inp.value || '').trim();
    if (!msg) return;
    if (WT.roomCode) {
      sendChatMessage(msg);
    } else {
      const box = _wtQs('#chatMessages');
      if (box) {
        const d = document.createElement('div');
        d.innerHTML = `<span style="color:#ff6b6b;font-weight:700">${_esc(WT.userName)}:</span> ${_esc(msg)}`;
        box.appendChild(d); box.scrollTop = box.scrollHeight;
      }
    }
    inp.value = '';
    inp.focus();
  }

  send.addEventListener('click', doSend);
  inp.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();doSend();} });

  // Also keep window._sendChat working
  window._sendChat = doSend;
}

function _toggleViewerPanel() {
  const vp = _wtQs('#wt-viewer-panel');
  if (!vp) return;
  vp.classList.toggle('open');
  if (vp.classList.contains('open')) _updateViewerList();
}

function _updateViewerCount() {
  const onlineCount = Object.values(WT.viewerMap).filter(v => v.online).length;
  const el = _wtQs('#wt-viewer-count');
  if (el) el.textContent = `${onlineCount} watching`;
}

function _updateViewerList() {
  const vp = _wtQs('#wt-viewer-panel');
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
  const btn = _wtQs('#wt-lock-btn');
  if (btn) {
    btn.textContent = WT.hostOnly ? '🔒 Locked' : '🔓 Unlocked';
    btn.classList.toggle('active', WT.hostOnly);
  }
}

/* ═══ PATCH WT BUTTONS ════════════════════════════════════════════ */
function _patchWTButtons() {
  // Override the Create Room button handler
  window._createRoom = async function() {
    const hd = _wtQs('#wtHome');
    const cr = _wtQs('#wtCreated');
    if (!hd || !cr) { await createRoom(); return; }

    // Show room code first, then create on Firebase
    const code = _code();
    _wtQs('#roomCodeDisplay').textContent = code;
    hd.style.display = 'none';
    cr.style.display = '';

    // Assign WT.roomCode so _copyRoom works
    WT._pendingCode = code;
  };

  // Override Start Watching
  window._startWT = async function() {
    const code = WT._pendingCode || _wtQs('#roomCodeDisplay')?.textContent;
    if (!code) return;
    window.closeWatchTogetherMenu?.();
    await createRoomWithCode(code);
  };

  // Override Join Room
  window._joinRoom = async function() {
    const code = _wtQs('#joinCodeInput')?.value?.trim()?.toUpperCase();
    if (!code) { _showToast('Enter a room code','⚠️'); return; }
    window.closeJoinRoomDialog?.();
    window.closeWatchTogetherMenu?.();
    await joinRoom(code);
  };

  // Override copy link
  window._copyRoomLink = function() {
    const code = WT.roomCode || WT._pendingCode || _wtQs('#roomCodeDisplay')?.textContent;
    if (!code) return;
    const url = `${location.origin}${location.pathname}?room=${code}`;
    navigator.clipboard.writeText(url).then(()=>_showToast('Room link copied!','📋')).catch(()=>_showToast(url,'📋',5000));
  };

  window._copyRoom = window._copyRoomLink;
  window._shareRoom = function() {
    const code = WT.roomCode || WT._pendingCode || _wtQs('#roomCodeDisplay')?.textContent;
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

/* ═══ MAXIMIZE / FULLSCREEN ══════════════════════════════════════ */
function _injectMaximizeBtn() {
  if (_wtQs('#wt-maximize-btn')) return;
  const pv = _wtQs('#playerVideo');
  if (!pv) return;

  const btn = document.createElement('button');
  btn.id = 'wt-maximize-btn';
  btn.innerHTML = '⛶';
  btn.title = 'Fullscreen';
  btn.style.cssText = 'position:absolute;bottom:10px;right:10px;z-index:30;width:36px;height:36px;border-radius:8px;background:rgba(0,0,0,.75);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 140ms';
  btn.onmouseenter = () => btn.style.background = 'rgba(230,57,70,.85)';
  btn.onmouseleave = () => btn.style.background = 'rgba(0,0,0,.75)';

  let isManual = false;

  function enterFS() {
    // Try native fullscreen on the whole modal first
    const target = _wtQs('#playerModal') || document.documentElement;
    const req = target.requestFullscreen || target.webkitRequestFullscreen || target.mozRequestFullScreen || target.msRequestFullscreen;
    if (req) {
      req.call(target).catch(() => _manualMax());
    } else {
      _manualMax();
    }
  }

  function exitFS() {
    if (isManual) {
      _manualRestore();
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
      if (exit) exit.call(document).catch(() => _manualRestore());
    }
  }

  function _manualMax() {
    const pbox = _wtQs('.p-box');
    if (!pbox) return;
    pbox._origStyle = pbox.style.cssText;
    pbox.style.cssText = 'position:fixed!important;inset:0!important;max-width:100vw!important;max-height:100vh!important;width:100vw!important;height:100vh!important;border-radius:0!important;z-index:9999!important;overflow-y:auto';
    document.body.style.overflow = 'hidden';
    isManual = true;
    btn.innerHTML = '✕';
    btn.title = 'Exit Fullscreen';
  }

  function _manualRestore() {
    const pbox = _wtQs('.p-box');
    if (!pbox) return;
    pbox.style.cssText = pbox._origStyle || '';
    document.body.style.overflow = '';
    isManual = false;
    btn.innerHTML = '⛶';
    btn.title = 'Fullscreen';
  }

  btn.addEventListener('click', () => {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl || isManual) exitFS(); else enterFS();
  });

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !isManual) {
      btn.innerHTML = '⛶';
      btn.title = 'Fullscreen';
    }
  });
  document.addEventListener('webkitfullscreenchange', () => {
    if (!document.webkitFullscreenElement && !isManual) {
      btn.innerHTML = '⛶';
      btn.title = 'Fullscreen';
    }
  });

  pv.appendChild(btn);
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
