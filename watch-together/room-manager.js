/* ═══════════════════════════════════════════════════════════════════
   FLIXORA — Watch Together  •  room-manager.js  v4.0  (FULL REWRITE)
   ───────────────────────────────────────────────────────────────────
   Complete ground-up rewrite — no augment wrappers, no fragile chains.
   Everything lives in one flat, readable file.

   FEATURES:
     ✅ Create / Join / Leave rooms (Firebase Realtime DB)
     ✅ Auto-join from ?room=CODE URL param
     ✅ Host playback sync — guests auto-load content + server
     ✅ Chat panel — Hide / Show (text button, reliable)
     ✅ Live chat — send, receive, scroll, char counter
     ✅ Message Edit (own messages only)
     ✅ Message Delete — soft-delete, real-time (host can delete any)
     ✅ Reply — full reply preview, scroll-to-original on click
     ✅ GIF search — Tenor API with fallback tag chips
     ✅ Emoji picker — 11 categories, 500+ emojis, category tabs
     ✅ File / image attachment — base64, max 1.5 MB
     ✅ Typing indicator — live "UserX is typing…" with bounce dots
     ✅ Message reactions — 6 quick emoji, per-user toggle, live counts
     ✅ Unread badge — red count badge on Show Chat button
     ✅ Spam guard — 3 messages per 3 s, inline warning
     ✅ Sound toggle — 🔔/🔕, Web Audio API, no external files
     ✅ Chat search — live keyword filter, dims non-matches
     ✅ Smart auto-scroll — pauses on scroll-up, "↓ New" button
     ✅ Swipe-to-reply — touch swipe right on message
     ✅ Connection banner — "Reconnecting…" / "Back online" + resub
     ✅ Viewer list + kick (host only)
     ✅ Host-only lock toggle
     ✅ Room HUD overlay on player
     ✅ Maximize / fullscreen button
   ═══════════════════════════════════════════════════════════════════ */

/* ─── FIREBASE CONFIG ─────────────────────────────────────────────── */
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyBoBMQHx9nxhOgdYKX9x7M5kCrIKRxZ5gg',
  authDomain:        'streamflix-watch-together.firebaseapp.com',
  databaseURL:       'https://streamflix-watch-together-default-rtdb.firebaseio.com',
  projectId:         'streamflix-watch-together',
  storageBucket:     'streamflix-watch-together.firebasestorage.app',
  messagingSenderId: '626707913714',
  appId:             '1:626707913714:web:2dc18c5480043f0b8e696b',
};

/* ─── CONSTANTS ───────────────────────────────────────────────────── */
const WT_VER         = '4.0';
const FIREBASE_CDN   = 'https://www.gstatic.com/firebasejs/9.23.0/';
const TENOR_KEY      = 'LIVDSRZULELA';   // Tenor public demo key
const PRESENCE_TTL   = 8000;            // ms — consider offline after
const CHAT_LIMIT     = 120;             // max bubbles in DOM
const TYPING_TTL     = 3500;            // ms — stop typing broadcast
const FLOOD_MAX      = 3;              // msgs per window
const FLOOD_WIN      = 3000;           // ms
const REACTIONS      = ['❤️','😂','😮','😢','👍','🔥'];

/* ─── EMOJI DATA ──────────────────────────────────────────────────── */
const EMOJI_CATS = {
  '😊 Faces':  ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫠','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥸','😎','🧐','😭','😢','😥','😓','😩','😫','🥱','😤','😡','🤬','😠','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
  '👋 Hands':  ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','👀','👁️','👅','👄','🫦'],
  '❤️ Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','💋','💌','💍','💎','👑','🏆','🥇','🥈','🥉','🎖️','🎗️'],
  '🎉 Party':  ['🎉','🎊','🎈','🎀','🎁','🥳','🪅','🎆','🎇','✨','⭐','🌟','💫','⚡','🔥','🌈','🎭','🎪','🎨','🎬','🎥','🎵','🎶','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🪗','🎤','🎧','🎮','🕹️','🎲','🎯','🎳'],
  '🐶 Animals':['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🐢','🐍','🦎','🐙','🦑','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🐘','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦦','🦥','🐁','🐀','🐿️','🦔'],
  '🍕 Food':   ['🍎','🍊','🍋','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍆','🥦','🌽','🍕','🍔','🍟','🌭','🍿','🧀','🥚','🍳','🥞','🧇','🥓','🍗','🌮','🌯','🍜','🍝','🍣','🍱','🥟','🍤','🍙','🍘','🍥','🥮','🍡','🧁','🍰','🎂','🍭','🍬','🍫','🍩','🍪','☕','🍵','🧋','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾','🧃','🥤'],
  '⚽ Sports': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥍','🏑','🏏','🏹','⛳','🎣','🤿','🥊','🥋','🎽','🛹','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤸','🤺','🤾','🏌️','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴'],
  '🚗 Travel': ['🚗','🚕','🚙','🚌','🏎️','🚓','🚑','🚒','🛻','🚚','🚜','🏍️','🛵','🚲','🛴','✈️','🚀','🛸','🚁','🛳️','🚢','⛵','🚤','🚂','🌍','🌎','🌏','🏔️','⛰️','🏕️','🏖️','🏜️','🏝️','🏛️','🏠','🏡','🏢','🏥','🏦','🏨','🏪','🏫','🌃','🏙️','🌄','🌅','🌈','🌉','🌌','🎠','🎡','🎢'],
  '💡 Objects':['⌚','📱','💻','⌨️','🖥️','💾','💿','📀','📷','📸','📹','🎥','📺','📻','🔋','🔌','💡','🔦','🕯️','🧭','⏱️','⏰','🕰️','📡','⚙️','🔧','🪛','🔩','🔗','🧰','🔬','🔭','💊','🩺','🩹','🧪','📚','📖','📝','✏️','🖊️','📌','📍','🗓️','📊','📈','📉','📦','📫','📬','🎒','👜','👛','👓','🕶️','🌂'],
  '🌸 Nature': ['🌸','💐','🌹','🥀','🌺','🌻','🌼','🌷','🌱','🌲','🌳','🌴','🌵','🎋','🎍','☘️','🍀','🍁','🍂','🍃','🪨','🪵','🌾','💧','🌊','🌙','🌛','🌜','🌝','🌞','🌚','✨','⚡','🌈','☁️','⛅','🌤️','🌦️','🌧️','🌨️','🌩️','🌪️','❄️','☃️','⛄','☄️','🔥','🌀','🪐','⭐','🌟','💫'],
  '🔣 Symbols':['✅','❌','❎','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','▪️','▫️','◾','◽','⬛','⬜','🟥','🟧','🟨','🟩','🟦','🟪','🔃','🔄','🔙','🔚','🔛','🔜','🔝','🆗','🆕','🆙','🆓','🆒','✔️','☑️','♻️','🔱','⚜️','🚩','🎌','🏴','🏳️','💯','🔞','📵','🚫','❗','❕','❓','❔','‼️','⁉️','🔔','🔕','📶'],
};

/* ─── STATE ───────────────────────────────────────────────────────── */
const WT = {
  /* core */
  db:            null,
  roomCode:      null,
  userId:        _getUID(),
  userName:      _getStoredName(),
  isHost:        false,
  hostOnly:      false,
  presenceRef:   null,
  presenceTimer: null,
  listeners:     [],    // cleanup functions
  viewerMap:     {},    // uid → { name, online }
  /* chat */
  chatVisible:   true,
  chatCount:     0,
  autoScroll:    true,
  unreadCount:   0,
  currentReply:  null,  // { id, name, text, img, gif }
  editingMsgId:  null,
  /* features */
  soundEnabled:    false,
  searchQuery:     '',
  floodLog:        [],  // timestamps for flood check
  typingTimer:     null,
  typingRef:       null,
  connected:       true,
};
const MSG_CACHE      = {};  // fbKey → msg obj
const REACTION_CACHE = {};  // fbKey → { emoji: { uid: true } }

/* ─── TINY HELPERS ────────────────────────────────────────────────── */
function _getUID() {
  let id = localStorage.getItem('wt_uid');
  if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem('wt_uid', id); }
  return id;
}
function _getStoredName() {
  const s = localStorage.getItem('wt_name'); if (s) return s;
  const a = ['Fast','Cool','Dark','Nova','Neon','Epic','Bold','Wild','Swift','Zen'];
  const n = ['Fox','Wolf','Star','Ghost','Hawk','Lion','Rain','Blaze','Comet','Storm'];
  const name = a[Math.floor(Math.random()*a.length)] + n[Math.floor(Math.random()*n.length)];
  localStorage.setItem('wt_name', name); return name;
}
function _makeCode()  { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function _now()       { return Date.now(); }
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _ago(ts) {
  if (!ts) return '';
  const d = Math.floor((_now()-ts)/60000);
  if (d < 1)  return 'now';
  if (d < 60) return d + 'm';
  const h = Math.floor(d/60); if (h < 24) return h + 'h';
  return new Date(ts).toLocaleDateString([],{month:'short',day:'numeric'});
}

/* ─── FIREBASE SDK LOADER ─────────────────────────────────────────── */
async function _loadSDK() {
  if (window._fbLoaded) return true;
  if (window.firebase?.database) { window._fbLoaded = true; return true; }
  const load = (src, id) => new Promise((ok, fail) => {
    if (document.getElementById(id)) { ok(); return; }
    const s = document.createElement('script'); s.id = id; s.src = src;
    s.onload = ok; s.onerror = () => fail(new Error('Failed: ' + src));
    document.head.appendChild(s);
  });
  try {
    await load(FIREBASE_CDN + 'firebase-app-compat.js',      'fb-app');
    await new Promise(r => setTimeout(r, 100));
    await load(FIREBASE_CDN + 'firebase-database-compat.js', 'fb-db');
    await new Promise(r => setTimeout(r, 100));
    if (!window.firebase?.database) throw new Error('firebase.database unavailable');
    window._fbLoaded = true;
    return true;
  } catch (e) { console.error('[WT] SDK load failed:', e.message); return false; }
}

/* ═══════════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════════ */
async function initFirebase() {
  const ok = await _loadSDK();
  if (!ok) return;
  if (FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') { _noFirebaseUI(); return; }
  try {
    const app = firebase.apps?.length ? firebase.apps[0] : firebase.initializeApp(FIREBASE_CONFIG);
    WT.db = firebase.database();
    console.log(`%c✅ Watch Together v${WT_VER} (uid:${WT.userId})`, 'color:#10b981;font-weight:bold');
    _patchButtons();
    _injectCSS();
    _monitorConnection();
    _checkURLRoom();
  } catch (e) { console.error('[WT] Init error:', e.message); }
}

/* ═══════════════════════════════════════════════════════════════════
   ROOM — CREATE
   ═══════════════════════════════════════════════════════════════════ */
async function createRoom() {
  if (!WT.db) { _toast('Firebase not configured', '⚠️'); return; }
  const code    = _makeCode();
  const content = window.currentContent || null;
  try {
    await WT.db.ref(`rooms/${code}`).set({
      meta: { hostId: WT.userId, hostName: WT.userName, createdAt: _now(),
              content, serverIdx: 0, hostOnly: false, version: WT_VER },
      playback: { action: 'idle', ts: _now() },
    });
    await _joinInternal(code, true);
  } catch (e) { console.error('[WT] createRoom error:', e); _toast('Failed to create room', '❌'); }
}

/* ═══════════════════════════════════════════════════════════════════
   ROOM — JOIN
   ═══════════════════════════════════════════════════════════════════ */
async function joinRoom(code) {
  code = String(code).toUpperCase().trim();
  if (!WT.db) { _toast('Firebase not configured', '⚠️'); return; }
  try {
    const snap = await WT.db.ref(`rooms/${code}/meta`).once('value');
    if (!snap.exists()) { _toast('Room not found — check the code', '❌'); return; }
    await _joinInternal(code, false);
  } catch (e) { console.error('[WT] joinRoom error:', e); _toast('Failed to join', '❌'); }
}

async function _joinInternal(code, asHost) {
  /* clean up any existing room first */
  await leaveRoom(true);

  WT.roomCode = code;
  WT.isHost   = asHost;

  /* presence */
  WT.presenceRef = WT.db.ref(`rooms/${code}/presence/${WT.userId}`);
  await WT.presenceRef.set({ name: WT.userName, joinedAt: _now(), lastSeen: _now(), online: true });
  WT.presenceRef.onDisconnect().remove();
  WT.presenceTimer = setInterval(() => WT.presenceRef?.update({ lastSeen: _now(), online: true }), 3000);

  /* typing node — cleaned on disconnect */
  WT.typingRef = WT.db.ref(`rooms/${code}/typing/${WT.userId}`);
  WT.typingRef.onDisconnect().remove();

  /* if guest — load host content before subscribing */
  if (!asHost) {
    _joiningOverlay(code, true);
    try {
      const snap = await WT.db.ref(`rooms/${code}/meta`).once('value');
      if (snap.exists()) {
        const meta = snap.val();
        const c    = meta?.content;
        if (c?.tmdb) {
          _joiningOverlay(code, false);
          const modal = $('#playerModal');
          if (modal) { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
          await new Promise(r => setTimeout(r, 400));
          if (typeof playById === 'function') await playById(c.tmdb, c.type, c.title || '', c.year || '');
          setTimeout(() => {
            if (typeof setServer === 'function') setServer(meta.serverIdx || 0, window.currentContent || c);
          }, 1200);
        } else {
          _joiningOverlay(code, false);
          _toast('Room joined! Waiting for host…', '👀', 4000);
        }
      } else { _joiningOverlay(code, false); }
    } catch (e) {
      _joiningOverlay(code, false);
      _toast('Joined but failed to load content', '⚠️', 4000);
    }
  }

  /* subscribe to all room events */
  _subMeta(code);
  _subPresence(code);
  _subChat(code);
  _subReactions(code);
  _subTyping(code);

  /* build UI */
  _buildHUD();
  _toast(asHost ? `Room ${code} created! 🎬` : `Joined room ${code}! ✅`, asHost ? '🎬' : '✅');

  /* update URL */
  const url = new URL(location.href);
  url.searchParams.set('room', code);
  history.replaceState(null, '', url.toString());
}

/* ═══════════════════════════════════════════════════════════════════
   ROOM — LEAVE
   ═══════════════════════════════════════════════════════════════════ */
async function leaveRoom(silent = false) {
  if (!WT.roomCode) return;

  clearInterval(WT.presenceTimer); WT.presenceTimer = null;
  clearTimeout(WT.typingTimer);     WT.typingTimer = null;

  WT.listeners.forEach(fn => { try { fn(); } catch(_) {} });
  WT.listeners = [];

  try { await WT.presenceRef?.remove(); } catch(_) {}
  try { await WT.typingRef?.remove();   } catch(_) {}
  WT.presenceRef = null;
  WT.typingRef   = null;

  /* Host = delete lahat ng messages + reactions sa Firebase */
  if (WT.isHost && WT.db && WT.roomCode) {
    try { await WT.db.ref(`rooms/${WT.roomCode}/messages`).remove(); } catch(_) {}
    try { await WT.db.ref(`rooms/${WT.roomCode}/reactions`).remove(); } catch(_) {}
  }

  const was = WT.roomCode;
  WT.roomCode     = null;
  WT.isHost       = false;
  WT.viewerMap    = {};
  WT.currentReply = null;
  WT.editingMsgId = null;
  WT.unreadCount  = 0;
  WT.floodLog     = [];

  _destroyHUD();

  const url = new URL(location.href);
  url.searchParams.delete('room');
  history.replaceState(null, '', url.toString());

  if (!silent) _toast(`Left room ${was}`, '👋');
}

/* ═══════════════════════════════════════════════════════════════════
   SUBSCRIPTIONS
   ═══════════════════════════════════════════════════════════════════ */
function _subMeta(code) {
  const ref = WT.db.ref(`rooms/${code}/meta`);
  const h   = ref.on('value', snap => {
    if (!snap.exists()) { leaveRoom(); return; }
    const meta      = snap.val();
    WT.hostOnly     = !!meta.hostOnly;
    _updateLockBtn();

    /* guest: sync content */
    if (!WT.isHost && meta.content) {
      const cur = window.currentContent, mc = meta.content;
      const diff = !cur || String(cur.tmdb) !== String(mc.tmdb) || cur.type !== mc.type
                        || cur.season !== mc.season || cur.episode !== mc.episode;
      if (diff && mc.tmdb) {
        const modal = $('#playerModal');
        if (modal && !modal.classList.contains('active')) {
          modal.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
        if (typeof playById === 'function')
          playById(String(mc.tmdb), mc.type, mc.title || '', mc.year || '');
      }
    }
    /* guest: sync server */
    if (!WT.isHost && meta.serverIdx !== undefined) {
      const c = window.currentContent || meta.content;
      if (c && typeof setServer === 'function') {
        const btns = $$('.server-btn');
        if (btns[meta.serverIdx] && !btns[meta.serverIdx].classList.contains('active'))
          setServer(meta.serverIdx, c);
      }
    }
  });
  WT.listeners.push(() => ref.off('value', h));
}

function _subPresence(code) {
  const ref = WT.db.ref(`rooms/${code}/presence`);
  const h   = ref.on('value', snap => {
    WT.viewerMap = {};
    if (snap.exists()) snap.forEach(child => {
      const d = child.val();
      WT.viewerMap[child.key] = {
        name:   d.name || 'Anon',
        online: d.online && (_now() - (d.lastSeen || 0)) < PRESENCE_TTL,
      };
    });
    _updateViewerCount();
    _updateViewerList();
  });
  WT.listeners.push(() => ref.off('value', h));
}

function _subChat(code) {
  /* clear box */
  const box = $('#chatMessages');
  if (box) box.innerHTML = '';

  /* new messages */
  const addRef = WT.db.ref(`rooms/${code}/messages`).orderByChild('ts').limitToLast(80);
  const addH   = addRef.on('child_added', snap => {
    const msg = snap.val(); if (!msg) return;
    MSG_CACHE[snap.key] = msg;
    _renderMsg(snap.key, msg, true);
  });
  WT.listeners.push(() => addRef.off('child_added', addH));

  /* edits */
  const editRef = WT.db.ref(`rooms/${code}/messages`);
  const editH   = editRef.on('child_changed', snap => {
    const msg = snap.val(); if (!msg) return;
    MSG_CACHE[snap.key] = msg;
    _rerenderMsg(snap.key, msg);
  });
  WT.listeners.push(() => editRef.off('child_changed', editH));

  /* deletes */
  const delH = editRef.on('child_removed', snap => {
    delete MSG_CACHE[snap.key];
    const el = $(`[data-msg="${snap.key}"]`);
    if (el) {
      el.style.transition = 'opacity .25s, max-height .3s, padding .3s, margin .3s';
      el.style.opacity    = '0';
      el.style.maxHeight  = '0';
      el.style.padding    = '0';
      el.style.margin     = '0';
      el.style.overflow   = 'hidden';
      setTimeout(() => el.remove(), 330);
    }
  });
  WT.listeners.push(() => editRef.off('child_removed', delH));
}

function _subReactions(code) {
  const ref = WT.db.ref(`rooms/${code}/reactions`);
  const h   = ref.on('value', snap => {
    const all = snap.val() || {};
    Object.assign(REACTION_CACHE, all);
    Object.entries(all).forEach(([fbKey, emojiMap]) => {
      _updateReactionBar(fbKey, emojiMap);
    });
  });
  WT.listeners.push(() => ref.off('value', h));
}

function _subTyping(code) {
  const ref = WT.db.ref(`rooms/${code}/typing`);
  const h   = ref.on('value', snap => {
    const data  = snap.val() || {};
    const names = [];
    const now   = _now();
    Object.entries(data).forEach(([uid, val]) => {
      if (uid === WT.userId) return;
      if (val?.active && (now - (val.at || 0)) < TYPING_TTL + 500)
        names.push(val.name || 'Someone');
    });
    _showTyping(names);
  });
  WT.listeners.push(() => ref.off('value', h));
}

/* ═══════════════════════════════════════════════════════════════════
   CHAT — SEND / EDIT / DELETE
   ═══════════════════════════════════════════════════════════════════ */
function _pushMsg(text, extra = {}) {
  if (!WT.db || !WT.roomCode) return;
  const msg = { userId: WT.userId, name: WT.userName, text: text || '', ts: _now() };
  if (extra.replyTo) msg.replyTo = extra.replyTo;
  if (extra.gif)     msg.gif     = extra.gif;
  if (extra.img)     msg.img     = extra.img;
  WT.db.ref(`rooms/${WT.roomCode}/messages`).push(msg);
}

function sendChatMessage(text, extra = {}) {
  _pushMsg(text, extra);
}

function editMessage(fbKey) {
  const msg = MSG_CACHE[fbKey];
  if (!msg || msg.userId !== WT.userId) return;
  WT.editingMsgId = fbKey;
  const inp = $('#wt-inp');
  if (inp) {
    inp.value = msg.text || '';
    inp.focus();
    inp.style.borderColor  = 'rgba(245,197,24,.7)';
    inp.style.background   = 'rgba(245,197,24,.06)';
  }
  const bar = $('#wt-edit-bar');
  if (bar) bar.style.display = 'flex';
}

function _cancelEdit() {
  WT.editingMsgId = null;
  const inp = $('#wt-inp');
  if (inp) { inp.value = ''; inp.style.borderColor = ''; inp.style.background = ''; }
  const bar = $('#wt-edit-bar');
  if (bar) bar.style.display = 'none';
}

function deleteMessage(fbKey) {
  const msg = MSG_CACHE[fbKey];
  if (!msg || (msg.userId !== WT.userId && !WT.isHost)) return;
  if (!WT.db || !WT.roomCode) return;
  WT.db.ref(`rooms/${WT.roomCode}/messages/${fbKey}`).update({ deleted: true, text: '', gif: null, img: null });
}

function _confirmDelete(fbKey) {
  if (confirm('Delete this message?')) deleteMessage(fbKey);
}

function _pushSystem(text) {
  if (!WT.db || !WT.roomCode) return;
  WT.db.ref(`rooms/${WT.roomCode}/messages`).push({ userId: 'system', name: 'System', text, ts: _now() });
}

/* ═══════════════════════════════════════════════════════════════════
   CHAT — RENDER
   ═══════════════════════════════════════════════════════════════════ */
function _renderMsg(fbKey, msg, scrollBottom = false) {
  const box = $('#chatMessages'); if (!box) return;
  if ($(`[data-msg="${fbKey}"]`)) return; /* no duplicates */

  const el = document.createElement('div');
  el.dataset.msg = fbKey;
  _paintMsg(el, fbKey, msg);

  /* swipe-to-reply on touch */
  if ('ontouchstart' in window && msg.userId !== 'system' && !msg.deleted) {
    _attachSwipe(el, fbKey);
  }

  box.appendChild(el);
  WT.chatCount++;
  if (WT.chatCount > CHAT_LIMIT) { box.firstElementChild?.remove(); WT.chatCount--; }

  /* sound + unread */
  if (msg.userId !== 'system' && msg.userId !== WT.userId && !msg.deleted) {
    _ping();
    WT.unreadCount++;
    _updateBadge();
  }

  if (scrollBottom) _scroll(box);
}

function _rerenderMsg(fbKey, msg) {
  const el = $(`[data-msg="${fbKey}"]`); if (!el) return;
  _paintMsg(el, fbKey, msg);
}

function _paintMsg(el, fbKey, msg) {
  const self    = msg.userId === WT.userId;
  const system  = msg.userId === 'system';
  const deleted = !!msg.deleted;
  const canEdit = self && !deleted && !system;
  const canDel  = (self || WT.isHost) && !system;

  el.style.cssText = [
    'position:relative',
    `align-self:${self ? 'flex-end' : system ? 'center' : 'flex-start'}`,
    `max-width:${system ? '88%' : '90%'}`,
    'word-break:break-word',
    'border-radius:10px',
    'font-size:.8rem',
    'line-height:1.5',
    'transition:opacity .2s, background .2s',
  ].join(';');

  if (deleted) {
    el.style.background = 'rgba(255,255,255,.03)';
    el.style.border     = '1px solid rgba(255,255,255,.05)';
    el.style.padding    = '5px 10px';
    el.innerHTML = `<span style="color:#55556a;font-style:italic;font-size:.74rem">🗑 Message deleted</span>`;
    return;
  }

  if (system) {
    el.style.background = 'rgba(16,185,129,.1)';
    el.style.border     = '1px solid rgba(16,185,129,.18)';
    el.style.padding    = '4px 12px';
    el.style.textAlign  = 'center';
    el.style.fontStyle  = 'italic';
    el.style.color      = 'rgba(16,185,129,.9)';
    el.style.width      = '88%';
    el.innerHTML = `<span style="font-size:.74rem">${_esc(msg.text)}</span>`;
    return;
  }

  el.style.background = self ? 'rgba(230,57,70,.14)' : 'rgba(255,255,255,.06)';
  el.style.border     = `1px solid ${self ? 'rgba(230,57,70,.2)' : 'rgba(255,255,255,.08)'}`;
  el.style.padding    = '7px 10px 5px';

  let html = '';

  /* reply preview */
  if (msg.replyTo) {
    html += `<div onclick="_scrollTo('${_esc(msg.replyTo.id || '')}')"
      style="border-left:2px solid rgba(230,57,70,.55);padding:3px 8px;margin-bottom:5px;border-radius:0 4px 4px 0;background:rgba(0,0,0,.25);font-size:.7rem;color:#9898b0;cursor:pointer">
      <span style="color:#ff6b6b;font-weight:700">${_esc(msg.replyTo.name || '')}</span>
      <span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:175px">${msg.replyTo.img ? '📷 Photo' : msg.replyTo.gif ? '🎞 GIF' : _esc((msg.replyTo.text || '').slice(0, 60))}</span>
    </div>`;
  }

  /* name + time */
  html += `<div style="display:flex;align-items:baseline;gap:5px;margin-bottom:3px">
    <span style="font-weight:700;font-size:.7rem;color:${self ? '#ff6b6b' : '#6ec6ff'}">${_esc(msg.name)}</span>
    <span style="font-size:.6rem;color:#55556a">${_ago(msg.ts)}</span>
    ${msg.edited ? '<span style="font-size:.58rem;color:#55556a;font-style:italic">(edited)</span>' : ''}
  </div>`;

  /* media */
  if (msg.gif)
    html += `<img src="${_esc(msg.gif)}" alt="gif" loading="lazy" style="max-width:100%;border-radius:6px;display:block;margin-bottom:${msg.text ? '4px' : '0'}">`;
  if (msg.img)
    html += `<img src="${_esc(msg.img)}" alt="img" loading="lazy" onclick="window.open(this.src)"
              style="max-width:100%;border-radius:6px;display:block;cursor:pointer;margin-bottom:${msg.text ? '4px' : '0'}">`;
  if (msg.text)
    html += `<span style="color:${self ? '#f0f0f8' : '#d0d0e8'}">${_esc(msg.text)}</span>`;

  /* action buttons */
  html += `<div class="wt-acts" style="position:absolute;top:4px;right:4px;display:flex;gap:2px;opacity:0;transition:opacity .15s;pointer-events:auto">
    ${REACTIONS.map(r => `<button class="wt-r-btn" onclick="event.stopPropagation();_react('${_esc(fbKey)}','${r}')"
      style="background:none;border:none;font-size:.82rem;cursor:pointer;padding:1px;line-height:1;border-radius:3px;transition:transform .1s"
      onmouseenter="this.style.transform='scale(1.3)'" onmouseleave="this.style.transform=''">${r}</button>`).join('')}
    <span style="width:1px;background:rgba(255,255,255,.1);margin:1px 2px"></span>
    <button onclick="_startReply('${_esc(fbKey)}')"
      style="background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.1);color:#ccc;border-radius:4px;font-size:.58rem;padding:2px 5px;cursor:pointer;line-height:1.3">↩</button>
    ${canEdit  ? `<button onclick="editMessage('${_esc(fbKey)}')"
      style="background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.1);color:#ccc;border-radius:4px;font-size:.58rem;padding:2px 5px;cursor:pointer;line-height:1.3">✏️</button>` : ''}
    ${canDel   ? `<button onclick="_confirmDelete('${_esc(fbKey)}')"
      style="background:rgba(0,0,0,.6);border:1px solid rgba(230,57,70,.25);color:#ff6b6b;border-radius:4px;font-size:.58rem;padding:2px 5px;cursor:pointer;line-height:1.3">🗑</button>` : ''}
  </div>`;

  /* reaction bar placeholder */
  html += `<div class="wt-react-bar" style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px"></div>`;

  el.innerHTML = html;

  /* hover show actions */
  const acts = el.querySelector('.wt-acts');
  if (acts) {
    el.addEventListener('mouseenter', () => acts.style.opacity = '1');
    el.addEventListener('mouseleave', () => acts.style.opacity = '0');
  }

  /* apply any cached reactions */
  const cached = REACTION_CACHE[fbKey];
  if (cached) _updateReactionBar(fbKey, cached);
}

/* ─── SCROLL HELPERS ─────────────────────────────────────────────── */
function _scroll(box) {
  if (WT.autoScroll) {
    box.scrollTop = box.scrollHeight;
  } else {
    /* show "↓ new" button */
    let btn = $('#wt-new-btn');
    if (btn) { btn.style.display = 'flex'; }
  }
}

function _scrollTo(id) {
  if (!id) return;
  const el = $(`[data-msg="${id}"]`); if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.style.outline = '2px solid rgba(230,57,70,.5)';
  setTimeout(() => el.style.outline = '', 1200);
}

/* ─── REPLY ──────────────────────────────────────────────────────── */
function _startReply(fbKey) {
  const msg = MSG_CACHE[fbKey]; if (!msg) return;
  WT.currentReply = { id: fbKey, name: msg.name || '', text: (msg.text || '').slice(0, 80), img: msg.img || null, gif: msg.gif || null };
  const bar     = $('#wt-reply-bar');
  const preview = $('#wt-reply-preview');
  if (bar)     bar.style.display = 'flex';
  if (preview) preview.innerHTML = `<span style="color:#ff6b6b;font-weight:700;font-size:.7rem">${_esc(WT.currentReply.name)}</span>
    <span style="display:block;font-size:.68rem;color:#9898b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px">${WT.currentReply.img ? '📷 Photo' : WT.currentReply.gif ? '🎞 GIF' : _esc(WT.currentReply.text)}</span>`;
  $('#wt-inp')?.focus();
}

function _clearReply() {
  WT.currentReply = null;
  const bar = $('#wt-reply-bar');
  if (bar) bar.style.display = 'none';
}

/* ─── REACTIONS ──────────────────────────────────────────────────── */
function _react(fbKey, emoji) {
  if (!WT.db || !WT.roomCode) return;
  const path = `rooms/${WT.roomCode}/reactions/${fbKey}/${emoji}/${WT.userId}`;
  WT.db.ref(path).once('value').then(snap => {
    WT.db.ref(path)[snap.exists() ? 'remove' : 'set'](true);
  });
}

function _updateReactionBar(fbKey, emojiMap) {
  const el  = $(`[data-msg="${fbKey}"]`); if (!el) return;
  const bar = el.querySelector('.wt-react-bar'); if (!bar) return;
  const entries = Object.entries(emojiMap || {}).filter(([, uids]) => Object.keys(uids || {}).length > 0);
  if (!entries.length) { bar.innerHTML = ''; return; }
  bar.innerHTML = entries.map(([emoji, uids]) => {
    const count  = Object.keys(uids).length;
    const isMine = !!uids[WT.userId];
    return `<button onclick="_react('${fbKey}','${emoji}')"
      style="background:${isMine ? 'rgba(230,57,70,.22)' : 'rgba(255,255,255,.07)'};border:1px solid ${isMine ? 'rgba(230,57,70,.4)' : 'rgba(255,255,255,.1)'};border-radius:12px;padding:2px 7px;cursor:pointer;font-size:.72rem;color:#fff;font-family:inherit;display:inline-flex;align-items:center;gap:3px;transition:all .12s">
      ${emoji}<span style="font-size:.62rem;color:${isMine ? '#ff6b6b' : '#9898b0'}">${count}</span>
    </button>`;
  }).join('');
}

/* ─── TYPING ─────────────────────────────────────────────────────── */
function _onType() {
  if (!WT.typingRef) return;
  WT.typingRef.set({ name: WT.userName, active: true, at: _now() });
  clearTimeout(WT.typingTimer);
  WT.typingTimer = setTimeout(() => WT.typingRef?.remove(), TYPING_TTL);
}

function _showTyping(names) {
  const el = $('#wt-typing'); if (!el) return;
  if (!names.length) { el.style.opacity = '0'; el.textContent = ''; return; }
  const label = names.length === 1 ? `${names[0]} is typing…`
              : names.length === 2 ? `${names[0]} & ${names[1]} are typing…`
              : `${names[0]} and ${names.length - 1} others are typing…`;
  el.style.opacity = '1';
  el.innerHTML = `${label} <span style="display:inline-flex;gap:2px">${[0,130,260].map(d =>
    `<span style="width:4px;height:4px;border-radius:50%;background:#9898b0;animation:wtBounce .85s ${d}ms infinite"></span>`
  ).join('')}</span>`;
}

/* ─── FLOOD GUARD ────────────────────────────────────────────────── */
function _flood() {
  const now = _now();
  WT.floodLog = WT.floodLog.filter(t => now - t < FLOOD_WIN);
  if (WT.floodLog.length >= FLOOD_MAX) {
    const box = $('#chatMessages');
    if (box && !$('#wt-flood')) {
      const w = document.createElement('div');
      w.id = 'wt-flood';
      w.style.cssText = 'align-self:center;background:rgba(245,197,24,.1);border:1px solid rgba(245,197,24,.2);border-radius:8px;padding:4px 12px;font-size:.72rem;color:rgba(245,197,24,.9);text-align:center';
      w.textContent = "⚠️ Slow down — you're sending too fast!";
      box.appendChild(w);
      box.scrollTop = box.scrollHeight;
      setTimeout(() => w.remove(), 2500);
    }
    return true;
  }
  WT.floodLog.push(now);
  return false;
}

/* ─── SOUND ──────────────────────────────────────────────────────── */
function _ping() {
  if (!WT.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(); osc.stop(ctx.currentTime + 0.2);
  } catch(_) {}
}

/* ─── UNREAD BADGE ───────────────────────────────────────────────── */
function _updateBadge() {
  $$('.wt-badge').forEach(b => {
    b.textContent = WT.unreadCount > 99 ? '99+' : String(WT.unreadCount);
    b.style.display = WT.unreadCount > 0 ? 'flex' : 'none';
  });
}

/* ─── CHAT SEARCH ────────────────────────────────────────────────── */
function _filterChat(q) {
  WT.searchQuery = q.toLowerCase();
  const box = $('#chatMessages'); if (!box) return;
  [...box.children].forEach(el => {
    if (!q) { el.style.opacity = '1'; el.style.pointerEvents = ''; return; }
    const key  = el.dataset.msg;
    const msg  = key ? MSG_CACHE[key] : null;
    const hay  = ((msg?.text || '') + ' ' + (msg?.name || '')).toLowerCase();
    const hit  = hay.includes(WT.searchQuery);
    el.style.opacity       = hit ? '1' : '0.15';
    el.style.pointerEvents = hit ? '' : 'none';
  });
}

/* ─── SWIPE TO REPLY ─────────────────────────────────────────────── */
function _attachSwipe(el, fbKey) {
  let sx = null, sy = null, moved = false;
  el.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; moved = false;
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (sx === null) return;
    const dx = e.touches[0].clientX - sx;
    const dy = Math.abs(e.touches[0].clientY - sy);
    if (dy > 18) { sx = null; return; }
    if (dx > 6) {
      moved = true;
      el.style.transition = 'none';
      el.style.transform  = `translateX(${Math.min(dx, 52)}px)`;
    }
  }, { passive: true });
  el.addEventListener('touchend', () => {
    el.style.transition = 'transform .2s ease';
    el.style.transform  = '';
    if (moved) _startReply(fbKey);
    sx = null;
  });
}

/* ─── CONNECTION MONITOR ─────────────────────────────────────────── */
function _monitorConnection() {
  if (!WT.db) return;
  WT.db.ref('.info/connected').on('value', snap => {
    const live = snap.val() === true;
    if (live === WT.connected) return;
    WT.connected = live;
    if (live) {
      _hideConnBanner();
      _toast('Back online ✅', '🟢', 2000);
      if (WT.roomCode) {
        WT.listeners.forEach(fn => { try { fn(); } catch(_) {} });
        WT.listeners = [];
        _subMeta(WT.roomCode);
        _subPresence(WT.roomCode);
        _subChat(WT.roomCode);
        _subReactions(WT.roomCode);
        _subTyping(WT.roomCode);
      }
    } else { _showConnBanner(); }
  });
}

function _showConnBanner() {
  let b = $('#wt-conn');
  if (!b) {
    b = document.createElement('div'); b.id = 'wt-conn';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#b91c1c;color:#fff;font-size:.78rem;font-weight:700;text-align:center;padding:7px 14px;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.04em';
    b.innerHTML = `<div style="width:13px;height:13px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:sfSpin 1s linear infinite;flex-shrink:0"></div>Reconnecting…`;
    document.body.prepend(b);
  }
}
function _hideConnBanner() {
  const b = $('#wt-conn'); if (!b) return;
  b.style.opacity = '0'; b.style.transition = 'opacity .4s';
  setTimeout(() => b.remove(), 420);
}

/* ─── GIF SEARCH ─────────────────────────────────────────────────── */
async function _gifSearch(preset) {
  const results = $('#wt-gif-results'); if (!results) return;
  const q = preset !== undefined ? preset : ($('#wt-gif-q')?.value || '').trim();
  results.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:14px;color:#9898b0;font-size:.76rem"><div style="width:18px;height:18px;border:2px solid rgba(255,255,255,.1);border-top-color:#e63946;border-radius:50%;animation:sfSpin 1s linear infinite;margin:0 auto 8px"></div>Loading…</div>`;
  try {
    const url = q
      ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&client_key=flixora&limit=16&contentfilter=medium`
      : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&client_key=flixora&limit=16&contentfilter=medium`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const gifs = data?.results || [];
    if (!gifs.length) { results.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:14px;color:#55556a;font-size:.76rem">No results</div>`; return; }
    results.innerHTML = '';
    gifs.forEach(g => {
      const fmt = g.media_formats;
      const gif = fmt?.tinygif?.url || fmt?.gif?.url || fmt?.mediumgif?.url;
      const prv = fmt?.nanogif?.url || gif; if (!gif) return;
      const img = document.createElement('img');
      img.src   = prv; img.loading = 'lazy';
      img.style.cssText = 'width:100%;border-radius:5px;cursor:pointer;object-fit:cover;max-height:78px;min-height:45px;background:#1a1a2a;transition:transform .15s';
      img.title = g.content_description || '';
      img.onerror = () => img.remove();
      img.onmouseenter = () => img.style.transform = 'scale(1.04)';
      img.onmouseleave = () => img.style.transform = '';
      img.onclick = () => { _toggleGIF(false); _sendMedia({ gif }); };
      results.appendChild(img);
    });
  } catch(e) {
    console.warn('[WT GIF]', e);
    const tags = ['funny','love','party','wow','clap','fire','cat','anime','sad','hype'];
    results.innerHTML = `<div style="grid-column:1/-1;padding:8px;text-align:center">
      <div style="font-size:.7rem;color:#ff6b6b;margin-bottom:7px">⚠️ Try a tag:</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center">${tags.map(t =>
        `<button onclick="_gifSearch('${t}')" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#9898b0;padding:3px 8px;border-radius:10px;cursor:pointer;font-size:.7rem">${t}</button>`
      ).join('')}</div></div>`;
  }
}

function _sendMedia(extra = {}) {
  const inp  = $('#wt-inp');
  const text = (inp?.value || '').trim();
  const payload = { ...extra };
  if (WT.currentReply) { payload.replyTo = WT.currentReply; _clearReply(); }
  if (WT.roomCode) {
    if (text || payload.gif || payload.img) _pushMsg(text, payload);
  } else {
    if (text || payload.gif || payload.img)
      _renderMsg('local_' + _now(), { userId: WT.userId, name: WT.userName, text, ts: _now(), ...payload }, true);
  }
  if (inp) { inp.value = ''; inp.focus(); }
}

/* ─── PANEL TOGGLES ──────────────────────────────────────────────── */
function _toggleGIF(force) {
  const gp = $('#wt-gif'); const ep = $('#wt-emo');
  if (!gp) return;
  const open = force !== undefined ? force : gp.style.display !== 'flex';
  gp.style.display = open ? 'flex' : 'none';
  if (open && ep) ep.style.display = 'none';
  if (open) { $('#wt-gif-q')?.focus(); _gifSearch(''); }
}
function _toggleEMO(force) {
  const ep = $('#wt-emo'); const gp = $('#wt-gif');
  if (!ep) return;
  const open = force !== undefined ? force : ep.style.display !== 'flex';
  ep.style.display = open ? 'flex' : 'none';
  if (open && gp) gp.style.display = 'none';
}
function _toggleSearch(force) {
  const sb = $('#wt-search-bar');
  if (!sb) return;
  const open = force !== undefined ? force : sb.style.display !== 'flex';
  sb.style.display = open ? 'flex' : 'none';
  if (open) $('#wt-search-q')?.focus(); else _filterChat('');
}

/* ═══════════════════════════════════════════════════════════════════
   CHAT PANEL — TOGGLE VISIBILITY
   ═══════════════════════════════════════════════════════════════════ */
function toggleChatPanel() {
  const cp = $('#chatPanel'); if (!cp) return;
  WT.chatVisible = !WT.chatVisible;
  cp.style.transform = WT.chatVisible ? 'translateX(0)' : 'translateX(100%)';
  /* update every toggle button */
  $$('.wt-chat-toggle').forEach(b => {
    b.textContent = WT.chatVisible ? '💬 Hide Chat' : '💬 Show Chat';
  });
  if (WT.chatVisible) {
    WT.unreadCount = 0; _updateBadge();
    WT.autoScroll  = true;
    const box = $('#chatMessages');
    if (box) box.scrollTop = box.scrollHeight;
  }
}
window.toggleChatPanel = toggleChatPanel;

/* ═══════════════════════════════════════════════════════════════════
   BUILD — CHAT PANEL (full rebuild)
   ═══════════════════════════════════════════════════════════════════ */
function _buildChat() {
  const cp = $('#chatPanel'); if (!cp) return;
  cp.innerHTML = '';
  cp.style.cssText = [
    'position:absolute', 'right:0', 'top:0', 'height:100%', 'width:272px',
    'background:rgba(11,11,17,.99)', 'border-left:1px solid rgba(255,255,255,.07)',
    'display:flex', 'flex-direction:column', 'z-index:5',
    `transform:${WT.chatVisible ? 'translateX(0)' : 'translateX(100%)'}`,
    'transition:transform .3s ease',
  ].join(';');

  /* ── Header ── */
  const hd = _el('div', 'padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:6px;flex-shrink:0;background:rgba(7,7,12,.85)');
  hd.innerHTML = `<span style="flex:1;font-size:.82rem;font-weight:700;color:#fff">💬 Live Chat</span>`;

  /* sound toggle */
  const sndBtn = _el('button', 'background:none;border:none;color:#9898b0;cursor:pointer;font-size:.9rem;padding:3px;border-radius:4px;transition:color .12s;line-height:1;flex-shrink:0');
  sndBtn.textContent = WT.soundEnabled ? '🔔' : '🔕';
  sndBtn.title = 'Toggle sound';
  sndBtn.onclick = () => { WT.soundEnabled = !WT.soundEnabled; sndBtn.textContent = WT.soundEnabled ? '🔔' : '🔕'; _toast(WT.soundEnabled ? 'Sound on' : 'Sound off', sndBtn.textContent, 1400); };
  hd.appendChild(sndBtn);

  /* search button */
  const srcBtn = _el('button', 'background:none;border:none;color:#9898b0;cursor:pointer;font-size:.82rem;padding:3px;border-radius:4px;transition:color .12s;line-height:1;flex-shrink:0');
  srcBtn.textContent = '🔍'; srcBtn.title = 'Search messages';
  srcBtn.onclick = () => _toggleSearch();
  hd.appendChild(srcBtn);

  /* hide/show toggle */
  const togBtn = _el('button', 'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#9898b0;font-size:.68rem;font-weight:600;padding:4px 8px;border-radius:5px;cursor:pointer;white-space:nowrap;font-family:inherit;transition:all .12s;flex-shrink:0');
  togBtn.className  = 'wt-chat-toggle';
  togBtn.textContent = WT.chatVisible ? 'Hide Chat' : 'Show Chat';
  togBtn.onclick    = toggleChatPanel;
  hd.appendChild(togBtn);
  cp.appendChild(hd);

  /* ── Name row ── */
  const nameRow = _el('div', 'padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.05);display:flex;align-items:center;gap:5px;flex-shrink:0');
  nameRow.innerHTML = `
    <span style="font-size:.63rem;color:#55556a;white-space:nowrap">Name:</span>
    <input id="wt-name" maxlength="20" value="${_esc(WT.userName)}"
      style="flex:1;padding:3px 7px;border-radius:4px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#fff;font-size:.72rem;font-family:inherit;outline:none;min-width:0;transition:border-color .12s">
    <button id="wt-name-ok" style="padding:3px 7px;border-radius:4px;background:rgba(230,57,70,.65);color:#fff;font-size:.68rem;font-weight:700;cursor:pointer;border:none;white-space:nowrap">OK</button>`;
  cp.appendChild(nameRow);
  const nameInp = nameRow.querySelector('#wt-name'), nameOk = nameRow.querySelector('#wt-name-ok');
  const saveName = () => {
    const v = nameInp.value.trim(); if (!v) return;
    WT.userName = v; localStorage.setItem('wt_name', v);
    WT.presenceRef?.update({ name: v });
    _toast(`Name: "${v}"`, '✅');
  };
  nameOk.onclick = saveName;
  nameInp.addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });
  nameInp.onfocus = () => nameInp.style.borderColor = 'rgba(230,57,70,.35)';
  nameInp.onblur  = () => nameInp.style.borderColor = '';

  /* ── Search bar (hidden) ── */
  const searchBar = _el('div', 'display:none;align-items:center;gap:5px;padding:5px 8px;background:rgba(255,255,255,.03);border-top:1px solid rgba(255,255,255,.06);flex-shrink:0');
  searchBar.id = 'wt-search-bar';
  searchBar.innerHTML = `
    <span style="color:#9898b0;font-size:.75rem;flex-shrink:0">🔍</span>
    <input id="wt-search-q" placeholder="Search messages…" maxlength="50"
      style="flex:1;padding:4px 7px;border-radius:4px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);color:#fff;font-size:.74rem;font-family:inherit;outline:none;min-width:0">
    <button onclick="_toggleSearch(false)" style="background:none;border:none;color:#9898b0;cursor:pointer;font-size:.78rem;flex-shrink:0">✕</button>`;
  cp.appendChild(searchBar);
  const sq = searchBar.querySelector('#wt-search-q');
  sq.addEventListener('input',   () => _filterChat(sq.value.trim()));
  sq.addEventListener('keydown', e => { if (e.key === 'Escape') _toggleSearch(false); });

  /* ── Messages ── */
  const msgs = _el('div', 'flex:1;overflow-y:auto;padding:8px 8px 4px;display:flex;flex-direction:column;gap:4px;scroll-behavior:smooth');
  msgs.id = 'chatMessages';
  msgs.innerHTML = `<span style="font-style:italic;color:#55556a;text-align:center;padding:10px 0;font-size:.76rem">Say hi! 👋</span>`;
  msgs.addEventListener('scroll', () => {
    const near = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 60;
    if (near !== WT.autoScroll) {
      WT.autoScroll = near;
      const nb = $('#wt-new-btn'); if (nb) nb.style.display = WT.autoScroll ? 'none' : 'flex';
    }
    if (near) { WT.unreadCount = 0; _updateBadge(); }
  }, { passive: true });
  cp.appendChild(msgs);

  /* ── Typing row ── */
  const typRow = _el('div', 'padding:2px 10px 3px;font-size:.68rem;color:#9898b0;min-height:16px;flex-shrink:0;font-style:italic;opacity:0;transition:opacity .2s;display:flex;align-items:center;gap:4px');
  typRow.id = 'wt-typing';
  cp.appendChild(typRow);

  /* ── Reply bar ── */
  const replyBar = _el('div', 'display:none;align-items:center;gap:5px;padding:5px 8px;background:rgba(230,57,70,.08);border-top:1px solid rgba(230,57,70,.15);flex-shrink:0');
  replyBar.id = 'wt-reply-bar';
  replyBar.innerHTML = `
    <span style="font-size:.68rem;color:#ff6b6b;flex-shrink:0">↩</span>
    <div id="wt-reply-preview" style="flex:1;min-width:0"></div>
    <button onclick="_clearReply()" style="background:none;border:none;color:#9898b0;cursor:pointer;font-size:.78rem;flex-shrink:0;padding:2px 4px">✕</button>`;
  cp.appendChild(replyBar);

  /* ── Edit bar ── */
  const editBar = _el('div', 'display:none;align-items:center;gap:6px;padding:5px 8px;background:rgba(245,197,24,.07);border-top:1px solid rgba(245,197,24,.18);flex-shrink:0;font-size:.7rem;color:rgba(245,197,24,.9)');
  editBar.id = 'wt-edit-bar';
  editBar.innerHTML = `<span style="flex:1">✏️ Editing message</span>
    <button id="wt-edit-cancel" style="background:none;border:none;color:#9898b0;cursor:pointer;font-size:.72rem;padding:2px 5px;border-radius:3px">Cancel</button>`;
  cp.appendChild(editBar);
  editBar.querySelector('#wt-edit-cancel').onclick = _cancelEdit;

  /* ── GIF panel ── */
  const gifPanel = _el('div', 'display:none;flex-direction:column;border-top:1px solid rgba(255,255,255,.07);background:rgba(7,7,12,.99);flex-shrink:0;max-height:215px');
  gifPanel.id = 'wt-gif';
  gifPanel.innerHTML = `
    <div style="display:flex;gap:5px;padding:6px 7px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0">
      <input id="wt-gif-q" placeholder="Search GIFs…"
        style="flex:1;padding:5px 8px;border-radius:5px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#fff;font-size:.75rem;font-family:inherit;outline:none;min-width:0">
      <button onclick="_gifSearch()" style="padding:5px 9px;border-radius:5px;background:#e63946;color:#fff;font-size:.74rem;cursor:pointer;border:none;font-weight:700;flex-shrink:0">Go</button>
    </div>
    <div id="wt-gif-results" style="display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:5px 7px;overflow-y:auto;flex:1"></div>`;
  cp.appendChild(gifPanel);
  gifPanel.querySelector('#wt-gif-q').addEventListener('keydown', e => { if (e.key === 'Enter') _gifSearch(); });

  /* ── Emoji panel ── */
  const emoPanel = _buildEmojiPanel();
  emoPanel.id = 'wt-emo';
  cp.appendChild(emoPanel);

  /* ── Toolbar ── */
  const toolbar = _el('div', 'display:flex;align-items:center;gap:3px;padding:4px 6px 0;flex-shrink:0;border-top:1px solid rgba(255,255,255,.05)');
  toolbar.innerHTML = `
    <button id="wt-emo-btn" title="Emoji" style="background:none;border:none;font-size:1.1rem;cursor:pointer;padding:3px;border-radius:5px;color:#9898b0;line-height:1">😊</button>
    <button id="wt-gif-btn" title="GIF" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:#9898b0;font-size:.63rem;font-weight:800;padding:2px 6px;border-radius:4px;cursor:pointer;letter-spacing:.05em">GIF</button>
    <label title="Attach file" style="font-size:.95rem;cursor:pointer;padding:3px;border-radius:5px;color:#9898b0;line-height:1;display:flex;align-items:center">
      📎<input type="file" id="wt-file" accept="image/*,video/*,.pdf,.txt,.doc,.docx" style="display:none">
    </label>
    <span style="flex:1"></span>
    <span id="wt-cc" style="font-size:.6rem;color:#55556a">0/200</span>`;
  cp.appendChild(toolbar);
  toolbar.querySelector('#wt-emo-btn').onclick = () => _toggleEMO();
  toolbar.querySelector('#wt-gif-btn').onclick = () => _toggleGIF();
  toolbar.querySelector('#wt-file').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) { _toast('Max 1.5 MB', '⚠️'); e.target.value = ''; return; }
    _toast('Sending…', '📎', 1400);
    const reader = new FileReader();
    reader.onload = () => _sendMedia({ img: reader.result });
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  /* ── Input row ── */
  const row = _el('div', 'display:flex;gap:4px;padding:6px 7px 8px;flex-shrink:0');
  row.innerHTML = `
    <input id="wt-inp" type="text" placeholder="Type a message…" maxlength="200"
      style="flex:1;padding:7px 9px;border-radius:7px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#fff;font-size:.8rem;font-family:inherit;outline:none;min-width:0;transition:border-color .12s,background .12s">
    <button id="wt-send" style="padding:7px 11px;border-radius:7px;background:#e63946;color:#fff;font-size:.85rem;font-weight:700;cursor:pointer;border:none;flex-shrink:0;transition:background .13s">➤</button>`;
  cp.appendChild(row);

  const inp  = row.querySelector('#wt-inp');
  const send = row.querySelector('#wt-send');
  const cc   = toolbar.querySelector('#wt-cc');

  inp.addEventListener('input', () => {
    cc.textContent  = inp.value.length + '/200';
    cc.style.color  = inp.value.length > 180 ? '#ff6b6b' : '#55556a';
    _toggleGIF(false); _toggleEMO(false);
    _onType();
  });
  inp.onfocus = () => { inp.style.borderColor = 'rgba(230,57,70,.35)'; inp.style.background = 'rgba(255,255,255,.09)'; };
  inp.onblur  = () => { inp.style.borderColor = ''; inp.style.background = ''; };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); _doSend(); }
    if (e.key === 'Escape' && WT.editingMsgId) _cancelEdit();
  });
  send.onclick = _doSend;
  send.onmouseenter = () => send.style.background = '#ff6b6b';
  send.onmouseleave = () => send.style.background = '#e63946';

  function _doSend() {
    const text = (inp.value || '').trim();
    /* editing mode */
    if (WT.editingMsgId) {
      if (!text) { _cancelEdit(); return; }
      if (WT.db && WT.roomCode)
        WT.db.ref(`rooms/${WT.roomCode}/messages/${WT.editingMsgId}`).update({ text, edited: true, editedAt: _now() });
      _cancelEdit(); inp.value = ''; cc.textContent = '0/200'; return;
    }
    if (!text && !WT.currentReply) return;
    if (text && _flood()) return;
    const payload = {};
    if (WT.currentReply) { payload.replyTo = WT.currentReply; _clearReply(); }
    if (WT.roomCode) {
      _pushMsg(text, payload);
    } else {
      _renderMsg('local_' + _now(), { userId: WT.userId, name: WT.userName, text, ts: _now(), ...payload }, true);
    }
    inp.value = ''; cc.textContent = '0/200'; inp.focus();
  }
  window._sendChat = _doSend;

  /* ── "↓ New messages" floating button ── */
  const nb = _el('button', 'position:absolute;bottom:82px;left:50%;transform:translateX(-50%);background:#e63946;color:#fff;border:none;border-radius:20px;padding:5px 14px;font-size:.72rem;font-weight:700;cursor:pointer;z-index:10;display:none;align-items:center;gap:4px;font-family:inherit;box-shadow:0 4px 14px rgba(230,57,70,.4)');
  nb.id = 'wt-new-btn'; nb.textContent = '↓ New messages';
  nb.onclick = () => {
    WT.autoScroll = true; nb.style.display = 'none';
    const m = $('#chatMessages'); if (m) m.scrollTop = m.scrollHeight;
    WT.unreadCount = 0; _updateBadge();
  };
  cp.appendChild(nb);
}

/* ─── EMOJI PANEL BUILDER ─────────────────────────────────────────── */
function _buildEmojiPanel() {
  const container = _el('div', 'display:none;flex-direction:column;background:rgba(7,7,12,.99);border-top:1px solid rgba(255,255,255,.07);max-height:200px;flex-shrink:0');
  const tabs = _el('div', 'display:flex;overflow-x:auto;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;scrollbar-width:none');
  const grid = _el('div', 'display:flex;flex-wrap:wrap;padding:4px;overflow-y:auto;flex:1');

  const cats = Object.keys(EMOJI_CATS);
  function showCat(key) {
    tabs.querySelectorAll('.wt-etab').forEach(t => {
      const on = t.dataset.c === key;
      t.style.borderBottom = on ? '2px solid #e63946' : '2px solid transparent';
      t.style.color        = on ? '#fff' : '#9898b0';
    });
    grid.innerHTML = '';
    EMOJI_CATS[key].forEach(em => {
      const b = _el('button', 'background:none;border:none;font-size:1.18rem;cursor:pointer;padding:3px;border-radius:4px;line-height:1;width:30px;height:30px;display:flex;align-items:center;justify-content:center;transition:background .1s');
      b.textContent = em; b.title = em;
      b.onmouseenter = () => b.style.background = 'rgba(255,255,255,.1)';
      b.onmouseleave = () => b.style.background = '';
      b.onclick = () => { const i = $('#wt-inp'); if (i) { i.value += em; i.focus(); } _toggleEMO(false); };
      grid.appendChild(b);
    });
  }

  cats.forEach((key, i) => {
    const t = _el('button', 'background:none;border:none;border-bottom:2px solid transparent;color:#9898b0;padding:5px 7px;cursor:pointer;font-size:.9rem;white-space:nowrap;flex-shrink:0;transition:all .12s');
    t.className = 'wt-etab'; t.dataset.c = key;
    t.textContent = key.split(' ')[0]; t.title = key;
    t.onclick = () => showCat(key);
    tabs.appendChild(t);
    if (i === 0) { t.style.borderBottom = '2px solid #e63946'; t.style.color = '#fff'; }
  });

  container.appendChild(tabs);
  container.appendChild(grid);
  showCat(cats[0]);
  return container;
}

/* ─── TINY DOM HELPER ────────────────────────────────────────────── */
function _el(tag, css) { const e = document.createElement(tag); e.style.cssText = css; return e; }

/* ═══════════════════════════════════════════════════════════════════
   BUILD — ROOM HUD
   ═══════════════════════════════════════════════════════════════════ */
function _buildHUD() {
  const pv = $('#playerVideo'); if (!pv) return;
  pv.style.position = 'relative';

  /* HUD overlay */
  let hud = $('#wt-hud'); if (!hud) { hud = _el('div', ''); hud.id = 'wt-hud'; pv.appendChild(hud); }
  hud.style.cssText = 'position:absolute;bottom:0;left:0;right:0;z-index:20;background:linear-gradient(0deg,rgba(0,0,0,.75) 0%,transparent 100%);padding:22px 14px 10px;display:flex;align-items:center;gap:10px;pointer-events:none';
  hud.innerHTML = `
    <div style="background:rgba(230,57,70,.92);color:#fff;font-size:.67rem;font-weight:800;letter-spacing:.06em;padding:4px 10px;border-radius:20px;display:flex;align-items:center;gap:4px;pointer-events:auto">🎬 ROOM <strong>${WT.roomCode}</strong></div>
    <div id="wt-vcnt" onclick="_toggleViewerPanel()" style="display:flex;align-items:center;gap:5px;font-size:.74rem;font-weight:600;color:rgba(255,255,255,.85);pointer-events:auto;cursor:pointer">
      <span style="width:7px;height:7px;border-radius:50%;background:#10b981;animation:wtPulse 2s infinite;flex-shrink:0"></span>
      <span>1 watching</span>
    </div>
    <div style="margin-left:auto;font-size:.64rem;font-weight:700;color:rgba(255,255,255,.55);pointer-events:auto">${WT.isHost ? '👑 Host' : ''}</div>
    <button onclick="leaveRoom()" style="pointer-events:auto;background:rgba(20,20,20,.75);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:.67rem;font-weight:700;padding:5px 12px;border-radius:20px;cursor:pointer;backdrop-filter:blur(6px);font-family:inherit;transition:all .14s" onmouseenter="this.style.background='rgba(230,57,70,.8)'" onmouseleave="this.style.background='rgba(20,20,20,.75)'">Leave</button>`;

  /* viewer panel */
  let vp = $('#wt-viewer-panel');
  if (!vp) { vp = _el('div',''); vp.id = 'wt-viewer-panel'; pv.appendChild(vp); }
  vp.style.cssText = 'position:absolute;top:44px;left:14px;z-index:25;background:rgba(14,14,20,.97);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:14px;min-width:200px;backdrop-filter:blur(16px);box-shadow:0 12px 40px rgba(0,0,0,.6);display:none';

  /* host controls */
  const pmeta = $('.p-meta');
  let hcBar = $('#wt-hcbar');
  if (!hcBar && pmeta) { hcBar = _el('div',''); hcBar.id = 'wt-hcbar'; pmeta.insertBefore(hcBar, pmeta.firstChild); }
  if (hcBar) {
    hcBar.style.cssText = `display:${WT.isHost ? 'flex' : 'none'};gap:7px;flex-wrap:wrap;padding:8px 14px 10px;border-bottom:1px solid rgba(255,255,255,.06)`;
    hcBar.innerHTML = WT.isHost ? `
      <span style="font-size:.67rem;font-weight:800;letter-spacing:.1em;color:#9898b0;text-transform:uppercase;align-self:center">Host Controls</span>
      <button id="wt-lock-btn" onclick="toggleHostOnly()" style="padding:5px 12px;border-radius:20px;font-size:.72rem;font-weight:700;cursor:pointer;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.75);font-family:inherit;transition:all .13s">🔓 Unlocked</button>
      <button onclick="_copyLink()" style="padding:5px 12px;border-radius:20px;font-size:.72rem;font-weight:700;cursor:pointer;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.75);font-family:inherit">📋 Copy Link</button>
      <button onclick="leaveRoom()" style="padding:5px 12px;border-radius:20px;font-size:.72rem;font-weight:700;cursor:pointer;background:rgba(255,255,255,.08);border:1px solid rgba(230,57,70,.25);color:#ff6b6b;font-family:inherit">✕ Close Room</button>` : '';
  }

  /* update chat toggle buttons in player actions */
  $$('.btn-tog').forEach(btn => {
    if (/chat/i.test(btn.textContent)) {
      btn.className += ' wt-chat-toggle';
      btn.setAttribute('onclick', 'toggleChatPanel()');
      btn.textContent = WT.chatVisible ? '💬 Hide Chat' : '💬 Show Chat';
      /* add unread badge */
      if (!btn.querySelector('.wt-badge')) {
        const b = _el('span', 'display:none;background:#e63946;color:#fff;border-radius:50%;width:16px;height:16px;font-size:.58rem;font-weight:700;align-items:center;justify-content:center;margin-left:5px;flex-shrink:0;line-height:1');
        b.className = 'wt-badge'; btn.appendChild(b);
      }
    }
  });

  /* rebuild chat panel */
  _buildChat();

  /* maximize button */
  _buildMaxBtn();
}

function _destroyHUD() {
  $('#wt-hud')?.remove();
  $('#wt-viewer-panel')?.remove();
  $('#wt-hcbar')?.remove();
  const box = $('#chatMessages');
  if (box) box.innerHTML = '<span style="color:var(--tx3,#55556a);font-style:italic">Share the room to chat…</span>';
  $$('.wt-chat-toggle').forEach(btn => {
    btn.textContent = '💬 Live Chat'; btn.classList.remove('wt-chat-toggle');
    btn.setAttribute('onclick', 'toggleChatPanel()');
  });
  /* I-clear ang local message + reaction cache */
  Object.keys(MSG_CACHE).forEach(k => delete MSG_CACHE[k]);
  Object.keys(REACTION_CACHE).forEach(k => delete REACTION_CACHE[k]);
}

/* ─── VIEWER PANEL ───────────────────────────────────────────────── */
function _toggleViewerPanel() {
  const vp = $('#wt-viewer-panel'); if (!vp) return;
  const open = vp.style.display === 'none' || !vp.style.display;
  vp.style.display = open ? 'block' : 'none';
  if (open) _updateViewerList();
}
function _updateViewerCount() {
  const n  = Object.values(WT.viewerMap).filter(v => v.online).length;
  const el = $('#wt-vcnt span:last-child'); if (el) el.textContent = n + ' watching';
}
function _updateViewerList() {
  const vp = $('#wt-viewer-panel'); if (!vp) return;
  const entries = Object.entries(WT.viewerMap);
  if (!entries.length) { vp.innerHTML = '<h4 style="font-size:.72rem;font-weight:800;color:#9898b0;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Viewers</h4><p style="font-size:.78rem;color:#9898b0">No one else here</p>'; return; }
  vp.innerHTML = `<h4 style="font-size:.72rem;font-weight:800;color:#9898b0;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Viewers (${entries.length})</h4>` +
    entries.map(([uid, v]) => {
      const me = uid === WT.userId, isH = me && WT.isHost;
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">
        <span style="width:7px;height:7px;border-radius:50%;background:${v.online ? '#10b981' : '#555'};flex-shrink:0"></span>
        <span style="flex:1;font-size:.8rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(v.name)}${me ? ' (you)' : ''}${isH ? ' <span style="background:#e63946;color:#fff;font-size:.55rem;padding:1px 5px;border-radius:3px;font-weight:800;vertical-align:middle">HOST</span>' : ''}</span>
        ${WT.isHost && !me ? `<button onclick="kickViewer('${uid}')" style="font-size:.62rem;color:#ff6b6b;background:rgba(230,57,70,.12);border:1px solid rgba(230,57,70,.2);padding:2px 7px;border-radius:20px;cursor:pointer;font-weight:700;font-family:inherit">Kick</button>` : ''}
      </div>`;
    }).join('');
}

function _updateLockBtn() {
  const btn = $('#wt-lock-btn'); if (!btn) return;
  btn.textContent = WT.hostOnly ? '🔒 Locked' : '🔓 Unlocked';
  btn.style.color = WT.hostOnly ? '#ff6b6b' : '';
  btn.style.borderColor = WT.hostOnly ? 'rgba(230,57,70,.35)' : '';
}

/* ─── HOST ACTIONS ───────────────────────────────────────────────── */
function kickViewer(userId) {
  if (!WT.isHost || !WT.db || !WT.roomCode) return;
  const name = WT.viewerMap[userId]?.name || 'Viewer';
  WT.db.ref(`rooms/${WT.roomCode}/presence/${userId}`).remove();
  _pushSystem(`${name} was removed from the room`);
  _toast(`${name} removed`, '🚫');
}

async function toggleHostOnly() {
  if (!WT.isHost || !WT.db || !WT.roomCode) return;
  WT.hostOnly = !WT.hostOnly;
  await WT.db.ref(`rooms/${WT.roomCode}/meta`).update({ hostOnly: WT.hostOnly });
  _pushSystem(WT.hostOnly ? '🔒 Room locked — host controls only' : '🔓 Room unlocked');
  _updateLockBtn();
}

function _copyLink() {
  const code = WT.roomCode || WT._pendingCode || $('#roomCodeDisplay')?.textContent;
  if (!code) return;
  const url = `${location.origin}${location.pathname}?room=${code}`;
  navigator.clipboard.writeText(url).then(() => _toast('Room link copied!', '📋')).catch(() => _toast(url, '📋', 5000));
}

/* ─── BROADCAST (HOST→GUESTS) ────────────────────────────────────── */
function _broadcastContent(content, serverIdx) {
  if (!WT.isHost || !WT.db || !WT.roomCode) return;
  WT.db.ref(`rooms/${WT.roomCode}/meta`).update({ content, serverIdx: serverIdx || 0 });
  _pushSystem(`${WT.userName} changed the video 🎬`);
}
function _broadcastServer(idx) {
  if (!WT.isHost || !WT.db || !WT.roomCode) return;
  WT.db.ref(`rooms/${WT.roomCode}/meta`).update({ serverIdx: idx });
  _pushSystem(`Host switched to Server ${idx + 1}`);
}

/* ─── MAXIMIZE BUTTON ────────────────────────────────────────────── */
function _buildMaxBtn() {
  if ($('#wt-max-btn')) return;
  const pv = $('#playerVideo'); if (!pv) return;
  const btn = _el('button', 'position:absolute;bottom:10px;right:10px;z-index:30;width:34px;height:34px;border-radius:7px;background:rgba(0,0,0,.75);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .14s');
  btn.id = 'wt-max-btn'; btn.innerHTML = '⛶'; btn.title = 'Fullscreen';
  btn.onmouseenter = () => btn.style.background = 'rgba(230,57,70,.85)';
  btn.onmouseleave = () => btn.style.background = 'rgba(0,0,0,.75)';
  let manual = false;
  btn.onclick = () => {
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs || manual) {
      manual ? _restore() : (document.exitFullscreen || document.webkitExitFullscreen)?.call(document).catch(_restore);
    } else {
      const t = $('#playerModal') || document.documentElement;
      (t.requestFullscreen || t.webkitRequestFullscreen)?.call(t).catch(_manualMax) || _manualMax();
    }
  };
  function _manualMax() {
    const pb = $('.p-box'); if (!pb) return;
    pb._o = pb.style.cssText;
    pb.style.cssText = 'position:fixed!important;inset:0!important;max-width:100vw!important;max-height:100vh!important;width:100vw!important;height:100vh!important;border-radius:0!important;z-index:9999!important;overflow-y:auto';
    document.body.style.overflow = 'hidden'; manual = true; btn.innerHTML = '✕';
  }
  function _restore() {
    const pb = $('.p-box'); if (!pb) return;
    pb.style.cssText = pb._o || ''; document.body.style.overflow = ''; manual = false; btn.innerHTML = '⛶';
  }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && !manual) btn.innerHTML = '⛶'; });
  pv.appendChild(btn);
}

/* ─── JOINING OVERLAY ────────────────────────────────────────────── */
function _joiningOverlay(code, show) {
  if (show) {
    if ($('#wt-join-ov')) return;
    const ov = _el('div', 'position:fixed;inset:0;z-index:9999;background:rgba(10,10,15,.96);backdrop-filter:blur(14px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:#fff;font-family:Outfit,sans-serif');
    ov.id = 'wt-join-ov';
    ov.innerHTML = `<div style="width:50px;height:50px;border:3px solid rgba(255,255,255,.1);border-top-color:#e63946;border-radius:50%;animation:sfSpin 1s linear infinite"></div>
      <div style="text-align:center"><div style="font-size:1.1rem;font-weight:700;margin-bottom:6px">Joining Room <span style="color:#e63946;letter-spacing:.1em">${code}</span></div>
      <div style="font-size:.82rem;color:#9898b0">Loading what the host is watching…</div></div>`;
    document.body.appendChild(ov);
  } else {
    const ov = $('#wt-join-ov'); if (!ov) return;
    ov.style.transition = 'opacity .3s'; ov.style.opacity = '0';
    setTimeout(() => ov.remove(), 320);
  }
}

/* ─── URL AUTO-JOIN ──────────────────────────────────────────────── */
function _checkURLRoom() {
  const code = new URLSearchParams(location.search).get('room');
  if (code) setTimeout(() => joinRoom(code), 1200);
}

/* ─── CONNECTION LOST UI ─────────────────────────────────────────── */
function _noFirebaseUI() {
  const b = _el('div', 'position:fixed;bottom:70px;right:14px;z-index:999;background:#1a1a2e;border:1px solid rgba(245,197,24,.3);color:rgba(245,197,24,.9);padding:9px 14px;border-radius:10px;font-size:.75rem;max-width:260px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,.5)');
  b.innerHTML = `⚠️ <strong>Watch Together</strong><br>Firebase not configured.<br><a href="https://console.firebase.google.com" target="_blank" style="color:#f5c518">Set it up →</a>`;
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 12000);
}

/* ─── TOAST ──────────────────────────────────────────────────────── */
function _toast(msg, icon = '✅', ms = 2600) {
  if (typeof showToast === 'function') { showToast(msg, icon, ms); return; }
  console.log(`[WT] ${icon} ${msg}`);
}

/* ═══════════════════════════════════════════════════════════════════
   PATCH BUTTONS — wire the HTML modal buttons to real Firebase logic
   ═══════════════════════════════════════════════════════════════════ */
function _patchButtons() {
  /* Create Room — show code UI, store pending code */
  window._createRoom = async function () {
    const home = $('#wtHome'), done = $('#wtCreated');
    const code = _makeCode(); WT._pendingCode = code;
    const disp = $('#roomCodeDisplay'); if (disp) disp.textContent = code;
    if (home) home.style.display = 'none';
    if (done) done.style.display = '';
  };

  /* Start Watching — actually create on Firebase then join */
  window._startWT = async function () {
    const code = WT._pendingCode || $('#roomCodeDisplay')?.textContent;
    if (!code) return;
    window.closeWatchTogetherMenu?.();
    const content = window.currentContent || null;
    try {
      await WT.db.ref(`rooms/${code}`).set({
        meta: { hostId: WT.userId, hostName: WT.userName, createdAt: _now(), content, serverIdx: 0, hostOnly: false, version: WT_VER },
        playback: { action: 'idle', ts: _now() },
      });
      await _joinInternal(code, true);
    } catch (e) { console.error('[WT] _startWT error:', e); _toast('Failed to start room', '❌'); }
  };

  /* Join Room */
  window._joinRoom = async function () {
    const code = ($('#joinCodeInput')?.value || '').trim().toUpperCase();
    if (!code) { _toast('Enter a room code', '⚠️'); return; }
    window.closeJoinRoomDialog?.(); window.closeWatchTogetherMenu?.();
    await joinRoom(code);
  };

  /* Copy / Share link */
  window._copyRoom    = _copyLink;
  window._copyRoomLink = _copyLink;
  window._shareRoom   = function () {
    const code = WT.roomCode || WT._pendingCode || $('#roomCodeDisplay')?.textContent;
    if (!code) return;
    const url = `${location.origin}${location.pathname}?room=${code}`;
    if (navigator.share) navigator.share({ title: 'Watch on Flixora', text: `Join! Code: ${code}`, url });
    else _copyLink();
  };

  /* Intercept playById — broadcast to room if host */
  const origPlay = window.playById;
  if (typeof origPlay === 'function') {
    window.playById = async function (tmdbId, type, title, year) {
      await origPlay(tmdbId, type, title, year);
      if (WT.isHost && WT.db && WT.roomCode)
        setTimeout(() => _broadcastContent(window.currentContent, 0), 600);
    };
  }

  /* Intercept setServer — broadcast server change if host */
  const origSS = window.setServer;
  if (typeof origSS === 'function') {
    window.setServer = function (idx, data) {
      origSS(idx, data);
      if (WT.isHost && WT.db && WT.roomCode) _broadcastServer(idx);
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   CSS — injected once
   ═══════════════════════════════════════════════════════════════════ */
function _injectCSS() {
  if ($('#wt-css')) return;
  const s = document.createElement('style'); s.id = 'wt-css';
  s.textContent = `
    .wt-acts button:hover { background:rgba(255,255,255,.14) !important; }
    .wt-etab:hover        { color:#ccc !important; }
    .wt-chat-toggle:hover { background:rgba(255,255,255,.14) !important; color:#fff !important; }
    .wt-badge { display:none; background:#e63946; color:#fff; border-radius:50%; width:16px; height:16px;
                font-size:.58rem; font-weight:700; align-items:center; justify-content:center;
                margin-left:5px; flex-shrink:0; line-height:1; }
    #wt-gif-results::-webkit-scrollbar, #chatMessages::-webkit-scrollbar { width:3px; }
    #wt-gif-results::-webkit-scrollbar-thumb, #chatMessages::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:3px; }
    #wt-new-btn { animation: wtSlideUp .25s ease; }
    @keyframes wtSlideUp  { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
    @keyframes wtPulse    { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes wtBounce   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
    @keyframes sfSpin     { to{transform:rotate(360deg)} }
  `;
  document.head.appendChild(s);
}

/* ═══════════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════════ */
window.initFirebase       = initFirebase;
window.createRoom         = createRoom;
window.joinRoom           = joinRoom;
window.leaveRoom          = leaveRoom;
window.sendChatMessage    = sendChatMessage;
window.kickViewer         = kickViewer;
window.toggleHostOnly     = toggleHostOnly;
window.editMessage        = editMessage;
window.deleteMessage      = deleteMessage;
window._startReply        = _startReply;
window._clearReply        = _clearReply;
window._cancelEdit        = _cancelEdit;
window._confirmDelete     = _confirmDelete;
window._scrollTo          = _scrollTo;
window._wtSearchGif       = _gifSearch;
window._gifSearch         = _gifSearch;
window._toggleEmojiPanel  = _toggleEMO;
window._toggleGifPanel    = _toggleGIF;
window._toggleViewerPanel = _toggleViewerPanel;
window._react             = _react;
window._copyLink          = _copyLink;
window._WT                = WT;

console.log(`%c👥 Watch Together v${WT_VER} — Full clean rewrite`, 'color:#10b981;font-weight:bold;font-size:12px');
console.log('%c  ✅ Create/Join/Leave  ✅ Chat  ✅ Edit/Delete  ✅ Reply  ✅ GIF  ✅ Emoji', 'color:#6ec6ff;font-size:.82em');
console.log('%c  ✅ Reactions  ✅ Typing  ✅ Unread  ✅ Flood guard  ✅ Search  ✅ Sound', 'color:#a8e6cf;font-size:.82em');
console.log('%c  ✅ Swipe-reply  ✅ Smart scroll  ✅ Connection monitor  ✅ Reconnect', 'color:#a8e6cf;font-size:.82em');

/* ── I-clear ang chat kapag na-close o na-refresh ang app ── */
window.addEventListener('beforeunload', () => {
  if (!WT.roomCode || !WT.db) return;
  /* Host — delete lahat ng messages at reactions */
  if (WT.isHost) {
    try { WT.db.ref(`rooms/${WT.roomCode}/messages`).remove(); } catch(_) {}
    try { WT.db.ref(`rooms/${WT.roomCode}/reactions`).remove(); } catch(_) {}
  }
  /* Lahat — alisin ang presence at typing */
  try { WT.presenceRef?.remove(); } catch(_) {}
  try { WT.typingRef?.remove();   } catch(_) {}
});
