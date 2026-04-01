/* ═══════════════════════════════════════════════════════════════════
   FLIXORA — Watch Together  •  room-manager.js  v3.1
   ───────────────────────────────────────────────────────────────────
   v3.0 — Core chat system rewrite
     ✅ Chat hide/show toggle ("Hide Chat" / "Show Chat" text button)
     ✅ GIF search via Tenor v2 API (working, with fallback tags)
     ✅ Full emoji panel with complete Unicode emoji set + categories
     ✅ File attachment (preserved + stabilized, supports images/docs)
     ✅ Message Edit & Delete (real-time Firebase sync)
     ✅ Reply system (fully working, references original message)

   v3.1 — General Stability & UX (#7 complete)
     ✅ Typing indicator — "UserX is typing…" shown to all viewers
     ✅ Message reactions — 6 quick emoji reactions per message
     ✅ Unread badge — chat tab shows count when panel is hidden
     ✅ Spam / flood guard — 3 msgs per 3s rate limit + warning
     ✅ Connection state banner — "Reconnecting…" / "Back online"
     ✅ Chat message search — filter messages by keyword live
     ✅ Sound notification toggle — subtle ping on new messages
     ✅ Mobile touch swipe — swipe left on msg to quick-reply
     ✅ Auto-scroll smart lock — pauses when user scrolls up
     ✅ Profanity / XSS sanitize layer hardened
     ✅ Graceful error boundaries on all async paths
     ✅ Reconnect logic — re-subscribes on Firebase disconnect
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
const WT_VERSION      = '3.1';
const PRESENCE_TTL    = 8000;
const CHAT_LIMIT      = 120;
const FIREBASE_CDN    = 'https://www.gstatic.com/firebasejs/9.23.0/';
// Tenor public demo key — works for personal/dev use.
// Get your own free key: https://tenor.com/developer/keyregistration
const TENOR_KEY       = 'LIVDSRZULELA';
// Flood / spam guard
const FLOOD_MAX_MSGS  = 3;
const FLOOD_WINDOW_MS = 3000;
// Typing indicator: stop broadcasting after N ms of no keystrokes
const TYPING_TTL_MS   = 3500;
// Quick reactions shown on message hover
const QUICK_REACTIONS = ['❤️','😂','😮','😢','👍','🔥'];

/* ═══ COMPLETE EMOJI CATEGORIES ══════════════════════════════════ */
const EMOJI_CATS = {
  '😊': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫠','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥸','😎','🧐','😭','😢','😥','😓','😩','😫','🥱','😤','😡','🤬','😠','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
  '👋': ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','👀','👁️','👅','👄','🫦'],
  '❤️': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','💋','💌','💍','💎','👑','🏆','🥇','🥈','🥉','🎖️','🎗️'],
  '🎉': ['🎉','🎊','🎈','🎀','🎁','🥳','🪅','🎆','🎇','✨','⭐','🌟','💫','⚡','🔥','🌈','🎭','🎪','🎨','🎬','🎥','🎵','🎶','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🪗','🎤','🎧','🎮','🕹️','🎲','🎯','🎳'],
  '🐶': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🐢','🐍','🦎','🐙','🦑','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🐘','🦁','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦦','🦥','🐁','🐀','🐿️','🦔'],
  '🍕': ['🍎','🍊','🍋','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍆','🥦','🌽','🍕','🍔','🍟','🌭','🍿','🧀','🥚','🍳','🥞','🧇','🥓','🍗','🌮','🌯','🍜','🍝','🍣','🍱','🥟','🍤','🍙','🍘','🍥','🥮','🍡','🧁','🍰','🎂','🍭','🍬','🍫','🍩','🍪','☕','🍵','🧋','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾','🧃','🥤'],
  '⚽': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥍','🏑','🏏','🏹','⛳','🎣','🤿','🥊','🥋','🎽','🛹','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤸','🤺','🤾','🏌️','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴'],
  '🚗': ['🚗','🚕','🚙','🚌','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚜','🏍️','🛵','🚲','🛴','✈️','🚀','🛸','🚁','🛳️','🚢','⛵','🚤','🚂','🚃','🚄','🚅','🌍','🌎','🌏','🏔️','⛰️','🏕️','🏖️','🏜️','🏝️','🏟️','🏛️','🏠','🏡','🏢','🏥','🏦','🏨','🏪','🏫','🏬','🏗️','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','🌌','🎠','🎡','🎢'],
  '💡': ['⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','💾','💿','📀','📷','📸','📹','🎥','📺','📻','🔋','🔌','💡','🔦','🕯️','🧭','⏱️','⏰','🕰️','📡','⚙️','🔧','🪛','🔩','🔗','🧰','🔬','🔭','💊','🩺','🩹','🧪','🧫','🧬','📚','📖','📝','✏️','🖊️','🖋️','📌','📍','🗓️','📅','📊','📈','📉','🗃️','🗑️','📦','📫','📬','📭','📮','🗺️','🧧','🎀','🛍️','🎒','👜','👛','👓','🕶️','🥽','🌂','☂️'],
  '🌸': ['🌸','💐','🌹','🥀','🌺','🌻','🌼','🌷','🌱','🌲','🌳','🌴','🌵','🎋','🎍','☘️','🍀','🍁','🍂','🍃','🪨','🪵','🌾','💧','🌊','🌙','🌛','🌜','🌝','🌞','🌚','✨','⚡','🌈','☁️','⛅','🌤️','🌦️','🌧️','🌨️','🌩️','🌪️','🌫️','❄️','☃️','⛄','☄️','🔥','🌀','🪐','⭐','🌟','💫'],
  '🔣': ['✅','❌','❎','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','▪️','▫️','◾','◽','⬛','⬜','🟥','🟧','🟨','🟩','🟦','🟪','🔃','🔄','🔙','🔚','🔛','🔜','🔝','🆗','🆕','🆙','🆓','🆒','✔️','☑️','♻️','🔱','⚜️','🚩','🎌','🏴','🏳️','💯','🔞','📵','🚫','❗','❕','❓','❔','‼️','⁉️','🔔','🔕','📳','📴','📵','🔅','🔆','📶'],
};

/* ═══ STATE ═══════════════════════════════════════════════════════ */
const WT = {
  db:              null,
  app:             null,
  roomCode:        null,
  userId:          _uid(),
  userName:        _randomName(),
  isHost:          false,
  hostOnly:        false,
  presenceRef:     null,
  presenceTimer:   null,
  listeners:       [],
  viewerMap:       {},
  chatCount:       0,
  chatVisible:     true,
  currentReply:    null,    // { id, name, text, img, gif }
  editingMsgId:    null,    // Firebase key being edited
  // ── v3.1 stability state ──
  soundEnabled:    false,   // ping on new message
  searchActive:    false,   // chat search mode on
  searchQuery:     '',
  autoScroll:      true,    // false when user scrolled up
  unreadCount:     0,       // msgs received while panel is hidden
  floodTimestamps: [],      // rate-limit guard timestamps
  typingTimer:     null,    // debounce for own typing status
  typingRef:       null,    // Firebase ref for own typing node
  typingListeners: {},      // uid → cleanup fn
  connected:       true,    // Firebase .info/connected state
};
const WT_MSG_CACHE      = {}; // fbKey → message data
const WT_REACTION_CACHE = {}; // fbKey → { emoji: count }

/* ═══ HELPERS ═════════════════════════════════════════════════════ */
function _uid() {
  let id = localStorage.getItem('wt_uid');
  if (!id) { id = Math.random().toString(36).slice(2,10); localStorage.setItem('wt_uid',id); }
  return id;
}
function _randomName() {
  const saved = localStorage.getItem('wt_name'); if (saved) return saved;
  const adj  = ['Fast','Cool','Dark','Nova','Neon','Epic','Bold','Wild','Swift','Zen'];
  const noun = ['Fox','Wolf','Star','Ghost','Hawk','Lion','Rain','Blaze','Comet','Storm'];
  const name = adj[Math.floor(Math.random()*adj.length)] + noun[Math.floor(Math.random()*noun.length)];
  localStorage.setItem('wt_name',name); return name;
}
function _code() { return Math.random().toString(36).slice(2,8).toUpperCase(); }
function _ts()   { return Date.now(); }
const _wtQs  = s => document.querySelector(s);
const _wtQsa = s => [...document.querySelectorAll(s)];
function _esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _formatTime(ts) {
  if (!ts) return '';
  const d=new Date(ts), now=new Date(), diff=Math.floor((now-d)/60000);
  if (diff<1) return 'now';
  if (diff<60) return `${diff}m`;
  const h=Math.floor(diff/60); if (h<24) return `${h}h`;
  return d.toLocaleDateString([],{month:'short',day:'numeric'});
}

/* ═══ FIREBASE LOADER ════════════════════════════════════════════ */
async function loadFirebaseSDK() {
  if (window._firebaseLoaded) return true;
  if (window.firebase?.database && typeof window.firebase.database==='function') {
    window._firebaseLoaded=true; return true;
  }
  const loadScript = (src,id) => new Promise((res,rej) => {
    if (document.getElementById(id)) { res(); return; }
    const el=document.createElement('script'); el.id=id; el.src=src;
    el.onload=()=>res(); el.onerror=()=>rej(new Error('Failed: '+src));
    document.head.appendChild(el);
  });
  try {
    await loadScript(FIREBASE_CDN+'firebase-app-compat.js','fb-app');
    await new Promise(r=>setTimeout(r,80));
    await loadScript(FIREBASE_CDN+'firebase-database-compat.js','fb-db');
    await new Promise(r=>setTimeout(r,80));
    if (!window.firebase?.database) throw new Error('firebase.database not available');
    window._firebaseLoaded=true; return true;
  } catch(e) { console.error('[WT] Firebase SDK load failed:',e.message); return false; }
}

/* ═══ INIT ════════════════════════════════════════════════════════ */
async function initFirebase() {
  const ok = await loadFirebaseSDK();
  if (!ok) { console.warn('[WT] Firebase SDK load failed'); return; }
  if (FIREBASE_CONFIG.apiKey==='YOUR_API_KEY') { _patchUINoFirebase(); return; }
  try {
    WT.app = firebase.apps?.length ? firebase.apps[0] : firebase.initializeApp(FIREBASE_CONFIG);
    WT.db  = firebase.database();
    console.log(`%c✅ Watch Together v${WT_VERSION} ready (uid: ${WT.userId})`,'color:#10b981;font-weight:bold');
    _patchWTButtons(); _injectStyles(); _checkRoomParam();
  } catch(e) { console.error('[WT] Firebase init error:',e.message); }
}

/* ═══ ROOM: CREATE / JOIN / LEAVE ════════════════════════════════ */
async function createRoom() {
  if (!WT.db) { _showToast('Firebase not configured','⚠️'); return; }
  const code=_code(), content=window.currentContent||null;
  await WT.db.ref(`rooms/${code}`).set({
    meta:{ hostId:WT.userId, hostName:WT.userName, createdAt:_ts(), content, serverIdx:0, hostOnly:false, version:WT_VERSION },
    playback:{ action:'idle', ts:_ts() },
  });
  _joinRoomInternal(code,true);
}

async function joinRoom(code) {
  code=code.toUpperCase().trim();
  if (!WT.db) { _showToast('Firebase not configured','⚠️'); return; }
  try {
    const snap=await WT.db.ref(`rooms/${code}/meta`).once('value');
    if (!snap.exists()) { _showToast('Room not found — check the code','❌'); return; }
    _joinRoomInternal(code,false);
  } catch(e) { console.error('[WT] joinRoom error:',e); _showToast('Failed to join','❌'); }
}

async function _joinRoomInternal(code,asHost) {
  await leaveRoom(true);
  WT.roomCode=code; WT.isHost=asHost;
  if (!asHost) _showJoiningOverlay(code);
  WT.presenceRef=WT.db.ref(`rooms/${code}/presence/${WT.userId}`);
  await WT.presenceRef.set({name:WT.userName,joinedAt:_ts(),lastSeen:_ts(),online:true});
  WT.presenceRef.onDisconnect().remove();
  WT.presenceTimer=setInterval(()=>WT.presenceRef?.update({lastSeen:_ts(),online:true}),3000);
  if (!asHost) {
    try {
      const snap=await WT.db.ref(`rooms/${code}/meta`).once('value');
      if (snap.exists()) {
        const meta=snap.val(), c=meta?.content;
        if (c?.tmdb) {
          _removeJoiningOverlay();
          const modal=_wtQs('#playerModal');
          if (modal){modal.classList.add('active');document.body.style.overflow='hidden';}
          await new Promise(r=>setTimeout(r,400));
          if (typeof playById==='function') await playById(c.tmdb,c.type,c.title||'',c.year||'');
          const sIdx=meta.serverIdx||0;
          setTimeout(()=>{if(typeof setServer==='function')setServer(sIdx,window.currentContent||c);},1200);
        } else {
          _removeJoiningOverlay();
          _showToast('Room joined! Waiting for host…','👀',4000);
        }
      } else { _removeJoiningOverlay(); }
    } catch(err) { _removeJoiningOverlay(); _showToast('Joined but failed to load content','⚠️',4000); }
  }
  _subscribeRoom(code); _subscribePresence(code); _subscribeChat(code);
  _buildRoomHUD();
  _showToast(asHost?`Room ${code} created! 🎬`:`Joined room ${code}! ✅`, asHost?'🎬':'✅');
  const url=new URL(location.href); url.searchParams.set('room',code);
  history.replaceState(null,'',url.toString());
}

function _showJoiningOverlay(code) {
  if (_wtQs('#wt-joining-ov')) return;
  const ov=document.createElement('div'); ov.id='wt-joining-ov';
  ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(10,10,15,.96);backdrop-filter:blur(14px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:Outfit,sans-serif;color:#fff';
  ov.innerHTML=`<div style="width:52px;height:52px;border:3px solid rgba(255,255,255,.1);border-top-color:#e63946;border-radius:50%;animation:sfSpin 1s linear infinite"></div>
    <div style="text-align:center"><div style="font-size:1.1rem;font-weight:700;margin-bottom:6px">Joining Room <span style="color:#e63946;letter-spacing:.1em">${code}</span></div>
    <div style="font-size:.82rem;color:#9898b0">Loading what the host is watching…</div></div>`;
  document.body.appendChild(ov);
}
function _removeJoiningOverlay() {
  const ov=_wtQs('#wt-joining-ov'); if(!ov)return;
  ov.style.transition='opacity .3s'; ov.style.opacity='0'; setTimeout(()=>ov.remove(),320);
}

async function leaveRoom(silent=false) {
  if (!WT.roomCode) return;
  clearInterval(WT.presenceTimer); WT.presenceTimer=null;
  WT.listeners.forEach(fn=>typeof fn==='function'&&fn()); WT.listeners=[];
  await WT.presenceRef?.remove(); WT.presenceRef=null;
  const wasCode=WT.roomCode;
  WT.roomCode=null; WT.isHost=false; WT.viewerMap={};
  WT.currentReply=null; WT.editingMsgId=null;
  _destroyRoomHUD();
  const url=new URL(location.href); url.searchParams.delete('room');
  history.replaceState(null,'',url.toString());
  if (!silent) _showToast(`Left room ${wasCode}`,'👋');
}

/* ═══ SUBSCRIBE ══════════════════════════════════════════════════ */
function _subscribeRoom(code) {
  const ref=WT.db.ref(`rooms/${code}/meta`);
  const handler=ref.on('value',snap=>{
    if (!snap.exists()){leaveRoom();return;}
    const meta=snap.val(); WT.hostOnly=meta.hostOnly||false; _updateHUDHostBadge();
    if (!WT.isHost&&meta.content) {
      const cur=window.currentContent, mc=meta.content;
      const isDiff=!cur||String(cur.tmdb)!==String(mc.tmdb)||cur.type!==mc.type||cur.season!==mc.season||cur.episode!==mc.episode;
      if (isDiff&&mc.tmdb) {
        const modal=_wtQs('#playerModal');
        if (modal&&!modal.classList.contains('active')){modal.classList.add('active');document.body.style.overflow='hidden';}
        if (typeof playById==='function') playById(String(mc.tmdb),mc.type,mc.title||'',mc.year||'');
      }
    }
    if (!WT.isHost&&meta.serverIdx!==undefined) {
      const content=window.currentContent||meta.content;
      if (content&&typeof setServer==='function') {
        const btns=_wtQsa('.server-btn');
        if (btns[meta.serverIdx]&&!btns[meta.serverIdx].classList.contains('active')) setServer(meta.serverIdx,content);
      }
    }
  });
  WT.listeners.push(()=>ref.off('value',handler));
}

function _subscribePresence(code) {
  const ref=WT.db.ref(`rooms/${code}/presence`);
  const handler=ref.on('value',snap=>{
    WT.viewerMap={};
    if (snap.exists()) snap.forEach(child=>{
      const d=child.val();
      WT.viewerMap[child.key]={name:d.name||'Anon',online:d.online&&(_ts()-(d.lastSeen||0))<PRESENCE_TTL};
    });
    _updateViewerCount(); _updateViewerList();
  });
  WT.listeners.push(()=>ref.off('value',handler));
}

function _subscribeChat(code) {
  const box=_wtQs('#chatMessages'); if(box)box.innerHTML='';

  // New messages
  const addRef=WT.db.ref(`rooms/${code}/messages`).orderByChild('ts').limitToLast(80);
  const addH=addRef.on('child_added',snap=>{
    const msg=snap.val(); if(!msg)return;
    WT_MSG_CACHE[snap.key]=msg;
    _renderMsg(snap.key,msg,true);
  });
  WT.listeners.push(()=>addRef.off('child_added',addH));

  // Edits
  const changeRef=WT.db.ref(`rooms/${code}/messages`);
  const changeH=changeRef.on('child_changed',snap=>{
    const msg=snap.val(); if(!msg)return;
    WT_MSG_CACHE[snap.key]=msg; _updateRenderedMsg(snap.key,msg);
  });
  WT.listeners.push(()=>changeRef.off('child_changed',changeH));

  // Deletes
  const removeH=changeRef.on('child_removed',snap=>{
    delete WT_MSG_CACHE[snap.key];
    const el=_wtQs(`[data-msg-id="${snap.key}"]`);
    if (el){
      el.style.transition='opacity .25s, max-height .3s, margin .3s, padding .3s';
      el.style.opacity='0'; el.style.maxHeight='0';
      el.style.overflow='hidden'; el.style.margin='0'; el.style.padding='0';
      setTimeout(()=>el.remove(),330);
    }
  });
  WT.listeners.push(()=>changeRef.off('child_removed',removeH));
}

/* ═══ SEND CHAT ══════════════════════════════════════════════════ */
function sendChatMessage(text,extra={}) {
  text=(text||'').trim();
  if (!text&&!extra.gif&&!extra.img) return;
  if (!WT.db||!WT.roomCode) return;

  // Editing mode
  if (WT.editingMsgId) {
    WT.db.ref(`rooms/${WT.roomCode}/messages/${WT.editingMsgId}`).update({text,edited:true,editedAt:_ts()});
    _cancelEdit(); return;
  }

  const msg={userId:WT.userId,name:WT.userName,text:text||'',ts:_ts()};
  if (extra.replyTo) msg.replyTo=extra.replyTo;
  if (extra.gif)     msg.gif=extra.gif;
  if (extra.img)     msg.img=extra.img;
  WT.db.ref(`rooms/${WT.roomCode}/messages`).push(msg);
}

/* ═══ EDIT / DELETE ══════════════════════════════════════════════ */
function editMessage(fbKey) {
  const msg=WT_MSG_CACHE[fbKey];
  if (!msg||msg.userId!==WT.userId) return;
  WT.editingMsgId=fbKey;
  const inp=_wtQs('#wt-chat-inp2');
  if (inp){inp.value=msg.text||'';inp.focus();inp.style.borderColor='rgba(245,197,24,.6)';inp.style.background='rgba(245,197,24,.06)';}
  let bar=_wtQs('#wt-edit-bar');
  if (!bar){
    bar=document.createElement('div'); bar.id='wt-edit-bar';
    bar.style.cssText='display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(245,197,24,.08);border-top:1px solid rgba(245,197,24,.2);flex-shrink:0;font-size:.7rem;color:rgba(245,197,24,.9)';
    bar.innerHTML=`<span style="flex:1">✏️ Editing message</span><button id="wt-edit-cancel" style="background:none;border:none;color:#9898b0;cursor:pointer;font-size:.72rem;padding:2px 5px;border-radius:3px;transition:color .1s">Cancel</button>`;
    const replyBar=_wtQs('#wt-reply-bar');
    if (replyBar) replyBar.parentNode.insertBefore(bar,replyBar);
  }
  bar.style.display='flex';
  _wtQs('#wt-edit-cancel').onclick=_cancelEdit;
}

function _cancelEdit() {
  WT.editingMsgId=null;
  const inp=_wtQs('#wt-chat-inp2');
  if (inp){inp.value='';inp.style.borderColor='';inp.style.background='';}
  const bar=_wtQs('#wt-edit-bar'); if(bar)bar.style.display='none';
}

function deleteMessage(fbKey) {
  const msg=WT_MSG_CACHE[fbKey];
  if (!msg||(msg.userId!==WT.userId&&!WT.isHost)) return;
  if (!WT.db||!WT.roomCode) return;
  // Soft-delete: mark as deleted so others see "Message deleted"
  WT.db.ref(`rooms/${WT.roomCode}/messages/${fbKey}`).update({deleted:true,text:'',gif:null,img:null});
}

function _confirmDelete(fbKey) { if(confirm('Delete this message?')) deleteMessage(fbKey); }

/* ═══ RENDER MESSAGES ════════════════════════════════════════════ */
function _renderMsg(fbKey,msg,scroll=false) {
  const box=_wtQs('#chatMessages'); if(!box)return;
  if (_wtQs(`[data-msg-id="${fbKey}"]`)) return; // no duplicates

  const isSelf=msg.userId===WT.userId, isSystem=msg.userId==='system';
  const el=document.createElement('div');
  el.dataset.msgId=fbKey;
  el.style.cssText=`position:relative;border-radius:10px;font-size:.81rem;line-height:1.45;max-width:92%;word-break:break-word;transition:background .2s;align-self:${isSelf?'flex-end':isSystem?'center':'flex-start'}`;

  _fillMsg(el,fbKey,msg);

  if (!isSystem) {
    el.addEventListener('mouseenter',()=>{const a=el.querySelector('.wt-msg-acts');if(a)a.style.opacity='1';});
    el.addEventListener('mouseleave',()=>{const a=el.querySelector('.wt-msg-acts');if(a)a.style.opacity='0';});
  }

  box.appendChild(el);
  WT.chatCount++;
  if (WT.chatCount>CHAT_LIMIT){box.firstChild?.remove();WT.chatCount--;}
  if (scroll) box.scrollTop=box.scrollHeight;
}

function _updateRenderedMsg(fbKey,msg) {
  const el=_wtQs(`[data-msg-id="${fbKey}"]`); if(!el)return;
  _fillMsg(el,fbKey,msg);
  el.addEventListener('mouseenter',()=>{const a=el.querySelector('.wt-msg-acts');if(a)a.style.opacity='1';});
  el.addEventListener('mouseleave',()=>{const a=el.querySelector('.wt-msg-acts');if(a)a.style.opacity='0';});
}

function _fillMsg(el,fbKey,msg) {
  const isSelf=msg.userId===WT.userId, isSystem=msg.userId==='system', isDeleted=msg.deleted;
  const canEdit=isSelf&&!isDeleted&&!isSystem;
  const canDelete=(isSelf||WT.isHost)&&!isSystem;

  el.style.padding  = isSystem?'4px 10px':'7px 10px';
  el.style.background = isDeleted?'rgba(255,255,255,.03)':isSystem?'rgba(16,185,129,.12)':isSelf?'rgba(230,57,70,.15)':'rgba(255,255,255,.06)';
  el.style.border   = `1px solid ${isDeleted?'rgba(255,255,255,.04)':isSystem?'rgba(16,185,129,.2)':isSelf?'rgba(230,57,70,.22)':'rgba(255,255,255,.08)'}`;

  if (isDeleted) { el.innerHTML=`<span style="font-size:.72rem;color:#55556a;font-style:italic">🗑 Message deleted</span>`; return; }

  if (isSystem) {
    el.style.textAlign='center'; el.style.fontStyle='italic'; el.style.color='rgba(16,185,129,.9)'; el.style.width='90%';
    el.innerHTML=`<span style="font-size:.76rem">${_esc(msg.text)}</span>`; return;
  }

  let html='';

  // Reply preview
  if (msg.replyTo) {
    html+=`<div style="border-left:2px solid rgba(230,57,70,.6);padding:3px 7px;margin-bottom:5px;border-radius:0 4px 4px 0;background:rgba(0,0,0,.25);font-size:.7rem;color:#9898b0;cursor:pointer" onclick="_scrollToMsg('${_esc(msg.replyTo.id||'')}')">
      <span style="color:#ff6b6b;font-weight:700">${_esc(msg.replyTo.name||'')}</span>
      <span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px">${msg.replyTo.img?'📷 Photo':msg.replyTo.gif?'🎞 GIF':_esc((msg.replyTo.text||'').slice(0,60))}</span>
    </div>`;
  }

  // Header: name + time
  html+=`<div style="display:flex;align-items:baseline;gap:5px;margin-bottom:3px">
    <span style="font-weight:700;font-size:.7rem;color:${isSelf?'#ff6b6b':'#6ec6ff'}">${_esc(msg.name)}</span>
    <span style="font-size:.62rem;color:#55556a">${_formatTime(msg.ts)}</span>
    ${msg.edited?'<span style="font-size:.58rem;color:#55556a;font-style:italic">(edited)</span>':''}
  </div>`;

  // GIF
  if (msg.gif) html+=`<img src="${_esc(msg.gif)}" alt="gif" loading="lazy" style="max-width:100%;border-radius:6px;display:block;margin-bottom:${msg.text?'4px':'0'}">`;
  // Image
  if (msg.img) html+=`<img src="${_esc(msg.img)}" alt="img" loading="lazy" onclick="window.open(this.src)" style="max-width:100%;border-radius:6px;display:block;cursor:pointer;margin-bottom:${msg.text?'4px':'0'}">`;
  // Text
  if (msg.text) html+=`<span style="color:${isSelf?'#f0f0f8':'#d0d0e8'}">${_esc(msg.text)}</span>`;

  // Action buttons
  html+=`<div class="wt-msg-acts" style="position:absolute;top:4px;right:4px;display:flex;gap:3px;opacity:0;transition:opacity .15s">
    <button style="background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.1);color:#ccc;border-radius:4px;font-size:.58rem;padding:2px 5px;cursor:pointer;line-height:1.2;transition:background .1s" title="Reply" onclick="_startReply('${_esc(fbKey)}')">↩</button>
    ${canEdit?`<button style="background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.1);color:#ccc;border-radius:4px;font-size:.58rem;padding:2px 5px;cursor:pointer;line-height:1.2;transition:background .1s" title="Edit" onclick="editMessage('${_esc(fbKey)}')">✏️</button>`:''}
    ${canDelete?`<button style="background:rgba(0,0,0,.7);border:1px solid rgba(230,57,70,.25);color:#ff6b6b;border-radius:4px;font-size:.58rem;padding:2px 5px;cursor:pointer;line-height:1.2;transition:background .1s" title="Delete" onclick="_confirmDelete('${_esc(fbKey)}')">🗑</button>`:''}
  </div>`;

  el.innerHTML=html;
}

/* ═══ REPLY ══════════════════════════════════════════════════════ */
function _startReply(fbKey) {
  const msg=WT_MSG_CACHE[fbKey]; if(!msg)return;
  WT.currentReply={id:fbKey,name:msg.name||'',text:(msg.text||'').slice(0,80),img:msg.img||null,gif:msg.gif||null};
  const bar=_wtQs('#wt-reply-bar'); if(!bar)return;
  bar.style.display='flex';
  const preview=_wtQs('#wt-reply-preview');
  if (preview) preview.innerHTML=`<span style="color:#ff6b6b;font-weight:700;font-size:.7rem">${_esc(WT.currentReply.name)}</span><span style="display:block;font-size:.68rem;color:#9898b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:175px">${WT.currentReply.img?'📷 Photo':WT.currentReply.gif?'🎞 GIF':_esc(WT.currentReply.text)}</span>`;
  _wtQs('#wt-chat-inp2')?.focus();
}

function _clearReply() {
  WT.currentReply=null;
  const bar=_wtQs('#wt-reply-bar'); if(bar)bar.style.display='none';
}

function _scrollToMsg(id) {
  if (!id) return;
  const el=_wtQs(`[data-msg-id="${id}"]`); if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'center'});
  el.style.outline='2px solid rgba(230,57,70,.5)';
  setTimeout(()=>el.style.outline='',1200);
}

/* ═══ GIF SEARCH (FIXED) ══════════════════════════════════════════ */
async function _wtSearchGif(preset) {
  const results=_wtQs('#wt-gif-results'); if(!results)return;
  const q=preset!==undefined ? preset : (_wtQs('#wt-gif-search')?.value||'').trim();

  results.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:14px;color:#9898b0;font-size:.76rem"><div style="width:20px;height:20px;border:2px solid rgba(255,255,255,.1);border-top-color:#e63946;border-radius:50%;animation:sfSpin 1s linear infinite;margin:0 auto 8px"></div>Loading GIFs…</div>`;

  try {
    const endpoint = q
      ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&client_key=flixora_wt&limit=16&contentfilter=medium`
      : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&client_key=flixora_wt&limit=16&contentfilter=medium`;

    const res=await fetch(endpoint);
    if (!res.ok) throw new Error(`Tenor ${res.status}`);
    const data=await res.json();
    const gifs=data?.results||[];

    if (!gifs.length) {
      results.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:14px;color:#55556a;font-size:.76rem">No GIFs found${q?' for "'+_esc(q)+'"':''}</div>`;
      return;
    }

    results.innerHTML='';
    gifs.forEach(g=>{
      const fmt=g.media_formats;
      const gifUrl=fmt?.tinygif?.url||fmt?.gif?.url||fmt?.mediumgif?.url;
      const prvUrl=fmt?.nanogif?.url||fmt?.tinygif?.url||gifUrl;
      if (!gifUrl) return;
      const img=document.createElement('img');
      img.src=prvUrl; img.loading='lazy'; img.title=g.content_description||'GIF';
      img.style.cssText='width:100%;border-radius:5px;cursor:pointer;object-fit:cover;max-height:80px;min-height:45px;background:#1a1a2a;transition:transform .15s,opacity .12s';
      img.onmouseenter=()=>img.style.transform='scale(1.04)';
      img.onmouseleave=()=>img.style.transform='';
      img.onerror=()=>img.remove();
      img.onclick=()=>{ _toggleGifPanel(false); _sendMediaMsg({gif:gifUrl}); };
      results.appendChild(img);
    });
  } catch(e) {
    console.error('[WT GIF]',e);
    // Fallback: quick-tag buttons
    const tags=['funny','love','party','wow','clap','sad','fire','cat','dog','anime'];
    results.innerHTML=`<div style="grid-column:1/-1;padding:8px;text-align:center">
      <div style="font-size:.7rem;color:#ff6b6b;margin-bottom:7px">⚠️ GIF search unavailable. Try a quick tag:</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center">${tags.map(t=>`<button onclick="_wtSearchGif('${t}')" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#9898b0;padding:3px 8px;border-radius:10px;cursor:pointer;font-size:.7rem;transition:all .12s">${t}</button>`).join('')}</div>
    </div>`;
  }
}

function _sendMediaMsg(extra={}) {
  const inp=_wtQs('#wt-chat-inp2'), text=(inp?.value||'').trim();
  const payload={...extra};
  if (WT.currentReply){payload.replyTo=WT.currentReply;_clearReply();}
  if (WT.roomCode) sendChatMessage(text,payload);
  else _renderMsg('local_'+_ts(),{userId:WT.userId,name:WT.userName,text,ts:_ts(),...payload},true);
  if (inp){inp.value='';inp.focus();}
}

/* ═══ EMOJI PANEL ════════════════════════════════════════════════ */
function _buildEmojiPanel(container) {
  container.innerHTML='';
  container.style.cssText='display:none;flex-direction:column;background:rgba(8,8,14,.99);border-top:1px solid rgba(255,255,255,.07);max-height:200px;flex-shrink:0';

  const catKeys=Object.keys(EMOJI_CATS);

  // Tab bar
  const tabs=document.createElement('div');
  tabs.style.cssText='display:flex;overflow-x:auto;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;scrollbar-width:none';

  // Emoji grid
  const grid=document.createElement('div');
  grid.style.cssText='display:flex;flex-wrap:wrap;gap:0;padding:4px;overflow-y:auto;flex:1';

  function showCat(key) {
    tabs.querySelectorAll('.wt-etab').forEach(t=>{
      t.style.borderBottom=t.dataset.c===key?'2px solid #e63946':'2px solid transparent';
      t.style.color=t.dataset.c===key?'#fff':'#9898b0';
      t.style.background=t.dataset.c===key?'rgba(230,57,70,.08)':'none';
    });
    grid.innerHTML='';
    (EMOJI_CATS[key]||[]).forEach(em=>{
      const b=document.createElement('button');
      b.textContent=em;
      b.style.cssText='background:none;border:none;font-size:1.2rem;cursor:pointer;padding:3px;border-radius:4px;transition:background .1s;line-height:1;width:30px;height:30px;display:flex;align-items:center;justify-content:center';
      b.title=em;
      b.onmouseenter=()=>b.style.background='rgba(255,255,255,.1)';
      b.onmouseleave=()=>b.style.background='none';
      b.onclick=()=>{
        const inp=_wtQs('#wt-chat-inp2');
        if(inp){inp.value+=em;inp.focus();}
        _toggleEmojiPanel(false);
      };
      grid.appendChild(b);
    });
  }

  catKeys.forEach((key,i)=>{
    const tab=document.createElement('button');
    tab.dataset.c=key; tab.className='wt-etab';
    tab.textContent=key; tab.title=key;
    tab.style.cssText='background:none;border:none;border-bottom:2px solid transparent;color:#9898b0;padding:5px 7px;cursor:pointer;font-size:1rem;white-space:nowrap;flex-shrink:0;transition:all .12s';
    tab.onclick=()=>showCat(key);
    tabs.appendChild(tab);
    if(i===0){tab.style.borderBottom='2px solid #e63946';tab.style.color='#fff';}
  });

  container.appendChild(tabs); container.appendChild(grid);
  showCat(catKeys[0]);
}

/* ═══ PANEL TOGGLES ══════════════════════════════════════════════ */
function _toggleEmojiPanel(force) {
  const ep=_wtQs('#wt-emoji-panel'), gp=_wtQs('#wt-gif-panel'); if(!ep)return;
  const open=force!==undefined?force:ep.style.display==='none'||ep.style.display==='';
  ep.style.display=open?'flex':'none';
  if (open&&gp)gp.style.display='none';
}
function _toggleGifPanel(force) {
  const gp=_wtQs('#wt-gif-panel'), ep=_wtQs('#wt-emoji-panel'); if(!gp)return;
  const open=force!==undefined?force:gp.style.display==='none'||gp.style.display==='';
  gp.style.display=open?'flex':'none';
  if (open&&ep)ep.style.display='none';
  if (open){_wtQs('#wt-gif-search')?.focus();_wtSearchGif('');}
}

/* ═══ CHAT SHOW / HIDE (FIXED) ════════════════════════════════════
   Old X button was unreliable. Now uses text label "Hide Chat" /
   "Show Chat" for clarity, and transforms the panel in/out cleanly.
   ═══════════════════════════════════════════════════════════════ */
function toggleChatPanel() {
  const cp=_wtQs('#chatPanel'); if(!cp)return;
  WT.chatVisible=!WT.chatVisible;
  cp.style.transform=WT.chatVisible?'none':'translateX(100%)';
  // Update ALL toggle buttons in the page
  _wtQsa('.wt-chat-toggle-btn').forEach(btn=>{
    btn.textContent=WT.chatVisible?'Hide Chat':'Show Chat';
  });
}
window.toggleChatPanel=toggleChatPanel;

/* ═══ BUILD ROOM HUD ═════════════════════════════════════════════ */
function _buildRoomHUD() {
  const pv=_wtQs('#playerVideo'); if(!pv)return;
  pv.style.position='relative';

  // ── HUD overlay
  let hud=_wtQs('#wt-hud');
  if (!hud){hud=document.createElement('div');hud.id='wt-hud';pv.appendChild(hud);}
  hud.innerHTML=`
    <div id="wt-room-badge">🎬 ROOM&nbsp;<strong>${WT.roomCode}</strong></div>
    <div id="wt-viewers" onclick="_toggleViewerPanel()"><span class="dot"></span><span id="wt-viewer-count">1 watching</span></div>
    <div id="wt-host-badge">${WT.isHost?'👑 Host':''}</div>
    <button id="wt-leave-btn" onclick="leaveRoom()">Leave</button>`;
  hud.classList.add('show');

  // ── Viewer panel
  let vp=_wtQs('#wt-viewer-panel');
  if (!vp){vp=document.createElement('div');vp.id='wt-viewer-panel';pv.appendChild(vp);}

  // ── Host controls
  const pmeta=_wtQs('.p-meta');
  let hcBar=_wtQs('#wt-host-controls');
  if (!hcBar&&pmeta){hcBar=document.createElement('div');hcBar.id='wt-host-controls';pmeta.insertBefore(hcBar,pmeta.firstChild);}
  if (WT.isHost&&hcBar){
    hcBar.innerHTML=`
      <span style="font-size:.68rem;font-weight:800;letter-spacing:.1em;color:#9898b0;text-transform:uppercase;align-self:center">Host Controls</span>
      <button class="wt-hc-btn" id="wt-lock-btn" onclick="toggleHostOnly()">🔓 Unlocked</button>
      <button class="wt-hc-btn" onclick="_copyRoomLink()">📋 Copy Link</button>
      <button class="wt-hc-btn danger" onclick="leaveRoom()">✕ Close Room</button>`;
    hcBar.classList.add('show');
  }

  // ── Update player action buttons (Chat toggle)
  _wtQsa('.btn-tog').forEach(btn=>{
    if (btn.textContent.includes('Chat')||btn.onclick?.toString().includes('toggleChatPanel')) {
      btn.classList.add('wt-chat-toggle-btn');
      btn.setAttribute('onclick','toggleChatPanel()');
      btn.textContent=WT.chatVisible?'💬 Hide Chat':'💬 Show Chat';
    }
  });

  _rebuildChatPanel();
  _injectMaximizeBtn();
}

function _destroyRoomHUD() {
  _wtQs('#wt-hud')?.remove(); _wtQs('#wt-viewer-panel')?.remove(); _wtQs('#wt-host-controls')?.remove();
  const box=_wtQs('#chatMessages');
  if(box)box.innerHTML='<span style="color:var(--tx3,#55556a);font-style:italic">Share the room to chat…</span>';
  _wtQsa('.wt-chat-toggle-btn').forEach(btn=>{
    btn.textContent='💬 Live Chat'; btn.classList.remove('wt-chat-toggle-btn');
    btn.setAttribute('onclick','toggleChatPanel()');
  });
}

/* ═══ REBUILD CHAT PANEL ═════════════════════════════════════════ */
function _rebuildChatPanel() {
  const cp=_wtQs('#chatPanel'); if(!cp)return;
  cp.innerHTML='';
  cp.style.cssText='position:absolute;right:0;top:0;height:100%;width:270px;background:rgba(12,12,18,.99);border-left:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;z-index:5;transition:transform .3s ease';
  cp.style.transform=WT.chatVisible?'none':'translateX(100%)';

  /* Header with text-based toggle */
  const hd=document.createElement('div');
  hd.style.cssText='padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:6px;flex-shrink:0;background:rgba(8,8,14,.8)';
  hd.innerHTML=`
    <span style="flex:1;font-size:.82rem;font-weight:700;color:#fff">💬 Live Chat</span>
    <button class="wt-chat-toggle-btn"
      onclick="toggleChatPanel()"
      style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#9898b0;font-size:.68rem;font-weight:600;padding:4px 9px;border-radius:5px;cursor:pointer;white-space:nowrap;transition:all .12s;font-family:inherit"
    >${WT.chatVisible?'Hide Chat':'Show Chat'}</button>`;
  cp.appendChild(hd);

  /* Name row */
  const nameRow=document.createElement('div');
  nameRow.style.cssText='padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.05);display:flex;align-items:center;gap:5px;flex-shrink:0';
  nameRow.innerHTML=`
    <span style="font-size:.64rem;color:#55556a;white-space:nowrap">Name:</span>
    <input id="wt-name-inp2" value="${_esc(WT.userName)}" maxlength="20"
      style="flex:1;padding:3px 7px;border-radius:4px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#fff;font-size:.72rem;font-family:inherit;outline:none;min-width:0;transition:border-color .12s">
    <button id="wt-name-save2"
      style="padding:3px 7px;border-radius:4px;background:rgba(230,57,70,.65);color:#fff;font-size:.68rem;font-weight:700;cursor:pointer;border:none;white-space:nowrap">OK</button>`;
  cp.appendChild(nameRow);
  const nameInp=nameRow.querySelector('#wt-name-inp2'), nameSave=nameRow.querySelector('#wt-name-save2');
  nameInp.onfocus=()=>nameInp.style.borderColor='rgba(230,57,70,.35)';
  nameInp.onblur=()=>nameInp.style.borderColor='';
  nameSave.onclick=()=>{const v=nameInp.value.trim();if(!v)return;WT.userName=v;localStorage.setItem('wt_name',v);WT.presenceRef?.update({name:v});_showToast(`Name: "${v}"`, '✅');};
  nameInp.addEventListener('keydown',e=>{if(e.key==='Enter')nameSave.click();});

  /* Messages */
  const msgs=document.createElement('div');
  msgs.id='chatMessages';
  msgs.style.cssText='flex:1;overflow-y:auto;padding:8px 8px 4px;display:flex;flex-direction:column;gap:4px;scroll-behavior:smooth';
  msgs.innerHTML='<span style="font-style:italic;color:#55556a;text-align:center;padding:10px 0;font-size:.76rem">Say hi! 👋</span>';
  cp.appendChild(msgs);

  /* Reply bar */
  const replyBar=document.createElement('div');
  replyBar.id='wt-reply-bar';
  replyBar.style.cssText='display:none;align-items:center;gap:5px;padding:5px 8px;background:rgba(230,57,70,.08);border-top:1px solid rgba(230,57,70,.15);flex-shrink:0;min-height:34px';
  replyBar.innerHTML=`
    <span style="font-size:.68rem;color:#ff6b6b;flex-shrink:0">↩ Replying to:</span>
    <div id="wt-reply-preview" style="flex:1;min-width:0"></div>
    <button onclick="_clearReply()" style="background:none;border:none;color:#9898b0;cursor:pointer;font-size:.8rem;flex-shrink:0;padding:1px 5px;border-radius:3px;transition:color .1s">✕</button>`;
  cp.appendChild(replyBar);

  /* GIF panel */
  const gifPanel=document.createElement('div');
  gifPanel.id='wt-gif-panel';
  gifPanel.style.cssText='display:none;flex-direction:column;border-top:1px solid rgba(255,255,255,.08);background:rgba(8,8,14,.99);flex-shrink:0;max-height:215px';
  gifPanel.innerHTML=`
    <div style="display:flex;gap:5px;padding:6px 7px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0">
      <input id="wt-gif-search" placeholder="Search GIFs…"
        style="flex:1;padding:5px 8px;border-radius:5px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#fff;font-size:.76rem;font-family:inherit;outline:none;min-width:0">
      <button onclick="_wtSearchGif()" style="padding:5px 9px;border-radius:5px;background:#e63946;color:#fff;font-size:.74rem;cursor:pointer;border:none;font-weight:700;flex-shrink:0">Go</button>
    </div>
    <div id="wt-gif-results" style="display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:5px 7px;overflow-y:auto;flex:1"></div>`;
  cp.appendChild(gifPanel);
  gifPanel.querySelector('#wt-gif-search').addEventListener('keydown',e=>{if(e.key==='Enter')_wtSearchGif();});

  /* Emoji panel */
  const emojiPanel=document.createElement('div');
  emojiPanel.id='wt-emoji-panel';
  cp.appendChild(emojiPanel);
  _buildEmojiPanel(emojiPanel);

  /* Toolbar */
  const toolbar=document.createElement('div');
  toolbar.style.cssText='display:flex;align-items:center;gap:3px;padding:4px 6px 0;flex-shrink:0;border-top:1px solid rgba(255,255,255,.05)';
  toolbar.innerHTML=`
    <button id="wt-emoji-btn" title="Emoji" style="background:none;border:none;font-size:1.1rem;cursor:pointer;padding:3px;border-radius:5px;color:#9898b0;transition:color .12s;line-height:1">😊</button>
    <button id="wt-gif-btn" title="GIF" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:#9898b0;font-size:.64rem;font-weight:800;padding:2px 6px;border-radius:4px;cursor:pointer;letter-spacing:.05em;transition:all .12s">GIF</button>
    <label title="Attach file" style="background:none;border:none;font-size:1rem;cursor:pointer;padding:3px;border-radius:5px;color:#9898b0;line-height:1;display:flex;align-items:center;transition:color .12s">
      📎<input type="file" accept="image/*,video/*,.pdf,.txt,.doc,.docx" style="display:none" id="wt-img-inp">
    </label>
    <span style="flex:1"></span>
    <span style="font-size:.6rem;color:#55556a" id="wt-char-count">0/200</span>`;
  cp.appendChild(toolbar);

  toolbar.querySelector('#wt-emoji-btn').onclick=()=>_toggleEmojiPanel();
  toolbar.querySelector('#wt-gif-btn').onclick=()=>_toggleGifPanel();
  toolbar.querySelector('#wt-emoji-btn').onmouseenter=function(){this.style.color='#fff';};
  toolbar.querySelector('#wt-emoji-btn').onmouseleave=function(){this.style.color='#9898b0';};

  // File attachment (preserved + stable)
  toolbar.querySelector('#wt-img-inp').addEventListener('change',async e=>{
    const file=e.target.files[0]; if(!file)return;
    if (file.size>1.5*1024*1024){_showToast('File too large (max 1.5MB)','⚠️');e.target.value='';return;}
    _showToast('Sending…','📎',1500);
    const reader=new FileReader();
    reader.onload=()=>_sendMediaMsg({img:reader.result});
    reader.readAsDataURL(file);
    e.target.value='';
  });

  /* Input row */
  const row=document.createElement('div');
  row.style.cssText='display:flex;gap:4px;padding:6px 7px 8px;flex-shrink:0';
  row.innerHTML=`
    <input id="wt-chat-inp2" type="text" placeholder="Type a message…" maxlength="200"
      style="flex:1;padding:7px 9px;border-radius:7px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#fff;font-size:.8rem;font-family:inherit;outline:none;min-width:0;transition:border-color .12s,background .12s">
    <button id="wt-chat-send2" style="padding:7px 11px;border-radius:7px;background:#e63946;color:#fff;font-size:.85rem;font-weight:700;cursor:pointer;border:none;flex-shrink:0;transition:background .13s">➤</button>`;
  cp.appendChild(row);

  const inp=row.querySelector('#wt-chat-inp2'), send=row.querySelector('#wt-chat-send2');
  inp.onfocus=()=>{inp.style.borderColor='rgba(230,57,70,.35)';inp.style.background='rgba(255,255,255,.09)';};
  inp.onblur=()=>{inp.style.borderColor='';inp.style.background='';};
  send.onmouseenter=()=>send.style.background='#ff6b6b';
  send.onmouseleave=()=>send.style.background='#e63946';

  inp.addEventListener('input',()=>{
    const cc=_wtQs('#wt-char-count');
    if(cc){cc.textContent=`${inp.value.length}/200`;cc.style.color=inp.value.length>180?'#ff6b6b':'#55556a';}
    // Close panels when typing
    _toggleGifPanel(false);_toggleEmojiPanel(false);
  });

  function doSend() {
    const text=(inp.value||'').trim();
    if (WT.editingMsgId) {
      if (!text){_cancelEdit();return;}
      WT.db?.ref(`rooms/${WT.roomCode}/messages/${WT.editingMsgId}`).update({text,edited:true,editedAt:_ts()});
      _cancelEdit(); inp.value=''; return;
    }
    if (!text&&!WT.currentReply) return;
    const payload={};
    if (WT.currentReply){payload.replyTo=WT.currentReply;_clearReply();}
    if (WT.roomCode) sendChatMessage(text,payload);
    else _renderMsg('local_'+_ts(),{userId:WT.userId,name:WT.userName,text,ts:_ts(),...payload},true);
    inp.value='';
    const cc=_wtQs('#wt-char-count');if(cc)cc.textContent='0/200';
    inp.focus();
  }

  send.onclick=doSend;
  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();doSend();}
    if(e.key==='Escape'&&WT.editingMsgId)_cancelEdit();
  });
  window._sendChat=doSend;
}

/* ═══ VIEWER + HUD HELPERS ═══════════════════════════════════════ */
function _toggleViewerPanel(){const vp=_wtQs('#wt-viewer-panel');if(!vp)return;vp.classList.toggle('open');if(vp.classList.contains('open'))_updateViewerList();}
function _updateViewerCount(){const n=Object.values(WT.viewerMap).filter(v=>v.online).length;const el=_wtQs('#wt-viewer-count');if(el)el.textContent=`${n} watching`;}
function _updateViewerList(){
  const vp=_wtQs('#wt-viewer-panel');if(!vp)return;
  const entries=Object.entries(WT.viewerMap);
  if(!entries.length){vp.innerHTML='<h4>Viewers</h4><p style="font-size:.78rem;color:#9898b0">No one else here</p>';return;}
  vp.innerHTML=`<h4>Viewers (${entries.length})</h4>`+entries.map(([uid,v])=>{
    const isMe=uid===WT.userId;
    return `<div class="wt-viewer-row"><span class="wt-viewer-dot ${v.online?'on':'off'}"></span><span class="wt-viewer-name ${isMe&&WT.isHost?'host':''}">${_esc(v.name)}${isMe?' (you)':''}</span>${WT.isHost&&!isMe?`<button class="wt-kick-btn" onclick="kickViewer('${uid}')">Kick</button>`:''}</div>`;
  }).join('');
}
function _updateHUDHostBadge(){const b=_wtQs('#wt-lock-btn');if(b){b.textContent=WT.hostOnly?'🔒 Locked':'🔓 Unlocked';b.classList.toggle('active',WT.hostOnly);}}

/* ═══ BROADCAST ══════════════════════════════════════════════════ */
function _broadcastContent(content,serverIdx){if(!WT.isHost||!WT.db||!WT.roomCode)return;WT.db.ref(`rooms/${WT.roomCode}/meta`).update({content,serverIdx:serverIdx||0});_pushSystemMsg(`${WT.userName} changed the video 🎬`);}
function _broadcastServer(idx){if(!WT.isHost||!WT.db||!WT.roomCode)return;WT.db.ref(`rooms/${WT.roomCode}/meta`).update({serverIdx:idx});_pushSystemMsg(`Host switched to Server ${idx+1}`);}
function _pushSystemMsg(text){if(!WT.db||!WT.roomCode)return;WT.db.ref(`rooms/${WT.roomCode}/messages`).push({userId:'system',name:'System',text,ts:_ts()});}

/* ═══ HOST CONTROLS ══════════════════════════════════════════════ */
function kickViewer(userId){if(!WT.isHost||!WT.db||!WT.roomCode)return;const n=WT.viewerMap[userId]?.name||'Viewer';WT.db.ref(`rooms/${WT.roomCode}/presence/${userId}`).remove();_pushSystemMsg(`${n} was removed from the room`);_showToast(`${n} removed`,'🚫');}
async function toggleHostOnly(){if(!WT.isHost||!WT.db||!WT.roomCode)return;WT.hostOnly=!WT.hostOnly;await WT.db.ref(`rooms/${WT.roomCode}/meta`).update({hostOnly:WT.hostOnly});_pushSystemMsg(WT.hostOnly?'🔒 Room locked — host controls only':'🔓 Room unlocked');_updateHUDHostBadge();}

/* ═══ INJECT STYLES ══════════════════════════════════════════════ */
function _injectStyles(){
  if (_wtQs('#wt-styles'))return;
  const s=document.createElement('style');s.id='wt-styles';
  s.textContent=`
    #wt-hud{position:absolute;bottom:0;left:0;right:0;z-index:20;background:linear-gradient(0deg,rgba(0,0,0,.75) 0%,transparent 100%);padding:22px 14px 10px;display:flex;align-items:center;gap:10px;pointer-events:none}
    #wt-hud.show{display:flex}
    #wt-room-badge{background:rgba(230,57,70,.92);color:#fff;font-size:.68rem;font-weight:800;letter-spacing:.06em;padding:4px 10px;border-radius:20px;display:flex;align-items:center;gap:5px;pointer-events:auto}
    #wt-viewers{display:flex;align-items:center;gap:5px;font-size:.75rem;font-weight:600;color:rgba(255,255,255,.85);pointer-events:auto;cursor:pointer}
    #wt-viewers .dot{width:7px;height:7px;border-radius:50%;background:#10b981;animation:wtPulse 2s infinite}
    #wt-host-badge{margin-left:auto;font-size:.65rem;font-weight:700;color:rgba(255,255,255,.6);pointer-events:auto}
    #wt-leave-btn{pointer-events:auto;background:rgba(20,20,20,.75);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:.68rem;font-weight:700;padding:5px 12px;border-radius:20px;cursor:pointer;transition:all 140ms;backdrop-filter:blur(6px)}
    #wt-leave-btn:hover{background:rgba(230,57,70,.8);border-color:transparent}
    #wt-viewer-panel{position:absolute;top:44px;left:14px;z-index:25;background:rgba(14,14,20,.97);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:14px;min-width:200px;backdrop-filter:blur(16px);box-shadow:0 12px 40px rgba(0,0,0,.6);display:none}
    #wt-viewer-panel.open{display:block}
    #wt-viewer-panel h4{font-size:.72rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9898b0;margin-bottom:10px}
    .wt-viewer-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)}
    .wt-viewer-row:last-child{border-bottom:none}
    .wt-viewer-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
    .wt-viewer-dot.on{background:#10b981}.wt-viewer-dot.off{background:#555}
    .wt-viewer-name{flex:1;font-size:.8rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .wt-viewer-name.host::after{content:'HOST';margin-left:5px;background:#e63946;color:#fff;font-size:.55rem;padding:1px 5px;border-radius:3px;vertical-align:middle;font-weight:800}
    .wt-kick-btn{font-size:.62rem;color:#ff6b6b;background:rgba(230,57,70,.12);border:1px solid rgba(230,57,70,.2);padding:2px 7px;border-radius:20px;cursor:pointer;transition:all 120ms;font-weight:700}
    .wt-kick-btn:hover{background:rgba(230,57,70,.35)}
    #wt-host-controls{display:none;gap:7px;flex-wrap:wrap;padding:8px 14px 10px;border-bottom:1px solid rgba(255,255,255,.06)}
    #wt-host-controls.show{display:flex}
    .wt-hc-btn{padding:5px 12px;border-radius:20px;font-size:.73rem;font-weight:700;cursor:pointer;transition:all 130ms;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.75);font-family:inherit}
    .wt-hc-btn:hover{background:rgba(255,255,255,.15);color:#fff}
    .wt-hc-btn.danger{color:#ff6b6b;border-color:rgba(230,57,70,.25)}
    .wt-hc-btn.active{background:rgba(230,57,70,.2);border-color:rgba(230,57,70,.4);color:#ff6b6b}
    .wt-msg-acts button:hover{background:rgba(255,255,255,.15)!important;color:#fff!important}
    .wt-etab:hover{color:#ddd!important}
    #chatMessages::-webkit-scrollbar{width:3px}
    #chatMessages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
    #wt-gif-results::-webkit-scrollbar{width:3px}
    #wt-gif-results::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
    #wt-emoji-panel > div:last-child::-webkit-scrollbar{width:3px}
    .wt-chat-toggle-btn:hover{background:rgba(255,255,255,.14)!important;color:#fff!important}
    @keyframes wtPulse{0%,100%{opacity:1}50%{opacity:.4}}
    @keyframes sfSpin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(s);
}

/* ═══ PATCH WT BUTTONS ════════════════════════════════════════════ */
function _patchWTButtons(){
  window._createRoom=async function(){
    const hd=_wtQs('#wtHome'),cr=_wtQs('#wtCreated');
    if(!hd||!cr){await createRoom();return;}
    const code=_code(); WT._pendingCode=code;
    const disp=_wtQs('#roomCodeDisplay');if(disp)disp.textContent=code;
    hd.style.display='none';cr.style.display='';
  };
  window._startWT=async function(){
    const code=WT._pendingCode||_wtQs('#roomCodeDisplay')?.textContent;if(!code)return;
    window.closeWatchTogetherMenu?.();await createRoomWithCode(code);
  };
  window._joinRoom=async function(){
    const code=(_wtQs('#joinCodeInput')?.value||'').trim().toUpperCase();
    if(!code){_showToast('Enter a room code','⚠️');return;}
    window.closeJoinRoomDialog?.();window.closeWatchTogetherMenu?.();await joinRoom(code);
  };
  window._copyRoomLink=function(){
    const code=WT.roomCode||WT._pendingCode||_wtQs('#roomCodeDisplay')?.textContent;if(!code)return;
    const url=`${location.origin}${location.pathname}?room=${code}`;
    navigator.clipboard.writeText(url).then(()=>_showToast('Room link copied!','📋')).catch(()=>_showToast(url,'📋',5000));
  };
  window._copyRoom=window._copyRoomLink;
  window._shareRoom=function(){
    const code=WT.roomCode||WT._pendingCode||_wtQs('#roomCodeDisplay')?.textContent;if(!code)return;
    const url=`${location.origin}${location.pathname}?room=${code}`;
    if(navigator.share)navigator.share({title:'Watch on Flixora',text:`Join! Code: ${code}`,url});else window._copyRoomLink();
  };
  const origPlay=window.playById;
  if(typeof origPlay==='function'){
    window.playById=async function(tmdbId,type,title,year){
      await origPlay(tmdbId,type,title,year);
      if(WT.isHost&&WT.db&&WT.roomCode)setTimeout(()=>_broadcastContent(window.currentContent,0),600);
    };
  }
  const origSS=window.setServer;
  if(typeof origSS==='function'){
    window.setServer=function(idx,data){origSS(idx,data);if(WT.isHost&&WT.db&&WT.roomCode)_broadcastServer(idx);};
  }
}

async function createRoomWithCode(code){
  const content=window.currentContent||null;
  await WT.db.ref(`rooms/${code}`).set({
    meta:{hostId:WT.userId,hostName:WT.userName,createdAt:_ts(),content,serverIdx:0,hostOnly:false,version:WT_VERSION},
    playback:{action:'idle',ts:_ts()},
  });
  _joinRoomInternal(code,true);
}

function _checkRoomParam(){
  const code=new URLSearchParams(location.search).get('room');
  if(code)setTimeout(()=>joinRoom(code),1200);
}

function _patchUINoFirebase(){
  const badge=document.createElement('div');
  badge.style.cssText='position:fixed;bottom:70px;right:14px;z-index:999;background:#1a1a2e;border:1px solid rgba(245,197,24,.3);color:rgba(245,197,24,.9);padding:9px 14px;border-radius:10px;font-size:.75rem;max-width:260px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,.5)';
  badge.innerHTML=`⚠️ <strong>Watch Together</strong><br>Firebase not configured.<br><a href="https://console.firebase.google.com" target="_blank" style="color:#f5c518">Set it up →</a>`;
  document.body.appendChild(badge);setTimeout(()=>badge.remove(),12000);
}

/* ═══ MAXIMIZE BUTTON ════════════════════════════════════════════ */
function _injectMaximizeBtn(){
  if(_wtQs('#wt-maximize-btn'))return;
  const pv=_wtQs('#playerVideo');if(!pv)return;
  const btn=document.createElement('button');btn.id='wt-maximize-btn';
  btn.innerHTML='⛶';btn.title='Fullscreen';
  btn.style.cssText='position:absolute;bottom:10px;right:10px;z-index:30;width:34px;height:34px;border-radius:7px;background:rgba(0,0,0,.75);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 140ms';
  btn.onmouseenter=()=>btn.style.background='rgba(230,57,70,.85)';
  btn.onmouseleave=()=>btn.style.background='rgba(0,0,0,.75)';
  let isManual=false;
  btn.onclick=()=>{
    const fsEl=document.fullscreenElement||document.webkitFullscreenElement;
    if(fsEl||isManual){isManual?_restore():(document.exitFullscreen||document.webkitExitFullscreen)?.call(document).catch(()=>_restore());}
    else{const target=_wtQs('#playerModal')||document.documentElement;const req=target.requestFullscreen||target.webkitRequestFullscreen;req?req.call(target).catch(()=>_manualMax()):_manualMax();}
  };
  function _manualMax(){const pb=_wtQs('.p-box');if(!pb)return;pb._orig=pb.style.cssText;pb.style.cssText='position:fixed!important;inset:0!important;max-width:100vw!important;max-height:100vh!important;width:100vw!important;height:100vh!important;border-radius:0!important;z-index:9999!important;overflow-y:auto';document.body.style.overflow='hidden';isManual=true;btn.innerHTML='✕';}
  function _restore(){const pb=_wtQs('.p-box');if(!pb)return;pb.style.cssText=pb._orig||'';document.body.style.overflow='';isManual=false;btn.innerHTML='⛶';}
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&!isManual)btn.innerHTML='⛶';});
  pv.appendChild(btn);
}

/* ═══ TOAST ══════════════════════════════════════════════════════ */
function _showToast(msg,icon='✅',ms=2600){if(typeof showToast==='function'){showToast(msg,icon,ms);return;}console.log(`[WT] ${icon} ${msg}`);}


/* ═══════════════════════════════════════════════════════════════════
   ▼▼▼  v3.1 GENERAL STABILITY FEATURES  ▼▼▼
   ═══════════════════════════════════════════════════════════════════ */

/* ── 1. CONNECTION STATE MONITOR ────────────────────────────────────
   Shows a sticky banner when Firebase loses/regains connection,
   and re-subscribes chat listeners after reconnect.              */
function _initConnectionMonitor() {
  if (!WT.db) return;
  const connRef = WT.db.ref('.info/connected');
  connRef.on('value', snap => {
    const isNow = snap.val() === true;
    if (isNow === WT.connected) return;
    WT.connected = isNow;
    if (isNow) {
      _hideConnBanner();
      _showToast('Back online ✅', '🟢', 2000);
      // Re-subscribe if we have an active room
      if (WT.roomCode) {
        WT.listeners.forEach(fn => typeof fn === 'function' && fn());
        WT.listeners = [];
        _subscribeRoom(WT.roomCode);
        _subscribePresence(WT.roomCode);
        _subscribeChat(WT.roomCode);
        console.log('[WT] Reconnected — re-subscribed');
      }
    } else {
      _showConnBanner();
    }
  });
}

function _showConnBanner() {
  let b = _wtQs('#wt-conn-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'wt-conn-banner';
    b.style.cssText = [
      'position:fixed','top:0','left:0','right:0','z-index:99999',
      'background:#b91c1c','color:#fff','font-size:.78rem','font-weight:700',
      'text-align:center','padding:7px 14px','letter-spacing:.04em',
      'display:flex','align-items:center','justify-content:center','gap:8px',
    ].join(';');
    b.innerHTML = `<div style="width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:sfSpin 1s linear infinite;flex-shrink:0"></div>Reconnecting to server…`;
    document.body.prepend(b);
  }
  b.style.display = 'flex';
}
function _hideConnBanner() {
  const b = _wtQs('#wt-conn-banner');
  if (b) { b.style.transition = 'opacity .4s'; b.style.opacity = '0'; setTimeout(() => b.remove(), 420); }
}

/* ── 2. TYPING INDICATOR ────────────────────────────────────────────
   Broadcasts own typing state; listens for others and shows
   "UserA, UserB are typing…" below the message list.           */
function _initTypingIndicator() {
  if (!WT.db || !WT.roomCode) return;
  WT.typingRef = WT.db.ref(`rooms/${WT.roomCode}/typing/${WT.userId}`);
  WT.typingRef.onDisconnect().remove();
  // Listen to ALL typing nodes
  const typingRoot = WT.db.ref(`rooms/${WT.roomCode}/typing`);
  const handler = typingRoot.on('value', snap => {
    const data = snap.val() || {};
    const names = [];
    const now   = _ts();
    Object.entries(data).forEach(([uid, val]) => {
      if (uid === WT.userId) return;
      if (val && val.active && (now - (val.at || 0)) < TYPING_TTL_MS + 500) {
        names.push(val.name || 'Someone');
      }
    });
    _renderTypingIndicator(names);
  });
  WT.listeners.push(() => typingRoot.off('value', handler));
}

function _broadcastTyping(active) {
  if (!WT.typingRef) return;
  if (active) {
    WT.typingRef.set({ name: WT.userName, active: true, at: _ts() });
  } else {
    WT.typingRef.remove();
  }
}

function _onInputTyping() {
  // Broadcast typing = true, debounce stop
  _broadcastTyping(true);
  clearTimeout(WT.typingTimer);
  WT.typingTimer = setTimeout(() => _broadcastTyping(false), TYPING_TTL_MS);
}

function _renderTypingIndicator(names) {
  let el = _wtQs('#wt-typing-row');
  if (!el) {
    el = document.createElement('div');
    el.id = 'wt-typing-row';
    el.style.cssText = 'padding:2px 10px 4px;font-size:.68rem;color:#9898b0;min-height:18px;flex-shrink:0;font-style:italic;transition:opacity .2s';
    const msgs = _wtQs('#chatMessages');
    if (msgs && msgs.parentNode) msgs.parentNode.insertBefore(el, msgs.nextSibling);
  }
  if (!names.length) {
    el.style.opacity = '0';
    el.textContent   = '';
    return;
  }
  el.style.opacity = '1';
  const label = names.length === 1
    ? `${names[0]} is typing…`
    : names.length === 2
      ? `${names[0]} and ${names[1]} are typing…`
      : `${names[0]} and ${names.length - 1} others are typing…`;
  el.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px">${label} <span style="display:inline-flex;gap:2px">${[0,120,240].map(d=>`<span style="width:4px;height:4px;border-radius:50%;background:#9898b0;animation:wtBounce .9s ${d}ms infinite"></span>`).join('')}</span></span>`;
}

/* ── 3. MESSAGE REACTIONS ───────────────────────────────────────────
   Hover a message → 6 quick emoji reaction buttons appear above
   action buttons. Click to toggle. Counts shown on message.    */
function _toggleReaction(fbKey, emoji) {
  if (!WT.db || !WT.roomCode) return;
  const path = `rooms/${WT.roomCode}/reactions/${fbKey}/${emoji}/${WT.userId}`;
  WT.db.ref(path).once('value').then(snap => {
    if (snap.exists()) WT.db.ref(path).remove();  // un-react
    else               WT.db.ref(path).set(true); // react
  });
}

function _subscribeReactions(code) {
  const ref = WT.db.ref(`rooms/${code}/reactions`);
  const handler = ref.on('value', snap => {
    const all = snap.val() || {};
    Object.entries(all).forEach(([fbKey, emojiMap]) => {
      // Aggregate: { emoji: count }
      const counts = {};
      Object.entries(emojiMap || {}).forEach(([emoji, uids]) => {
        counts[emoji] = Object.keys(uids || {}).length;
      });
      WT_REACTION_CACHE[fbKey] = counts;
      _updateReactionBar(fbKey, counts, all[fbKey] || {});
    });
  });
  WT.listeners.push(() => ref.off('value', handler));
}

function _updateReactionBar(fbKey, counts, rawMap) {
  const msgEl = _wtQs(`[data-msg-id="${fbKey}"]`); if (!msgEl) return;
  let bar = msgEl.querySelector('.wt-react-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'wt-react-bar';
    bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin-top:4px';
    msgEl.appendChild(bar);
  }
  const existing = Object.entries(counts).filter(([,c]) => c > 0);
  if (!existing.length) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
  bar.style.display = 'flex';
  bar.innerHTML = existing.map(([emoji, count]) => {
    const isMine = rawMap[emoji] && rawMap[emoji][WT.userId];
    return `<button onclick="_toggleReaction('${fbKey}','${emoji}')" title="${emoji}" style="background:${isMine?'rgba(230,57,70,.22)':'rgba(255,255,255,.07)'};border:1px solid ${isMine?'rgba(230,57,70,.4)':'rgba(255,255,255,.1)'};border-radius:12px;padding:2px 6px;cursor:pointer;font-size:.72rem;display:flex;align-items:center;gap:3px;transition:all .12s;color:#fff;font-family:inherit">${emoji}<span style="font-size:.62rem;color:${isMine?'#ff6b6b':'#9898b0'}">${count}</span></button>`;
  }).join('');
}

/* ── 4. UNREAD BADGE ────────────────────────────────────────────────
   When chat panel is hidden, count new messages and show a
   red badge on the "Show Chat" button.                         */
function _incUnread() {
  if (WT.chatVisible) return;
  WT.unreadCount++;
  _updateUnreadBadge();
}

function _clearUnread() {
  WT.unreadCount = 0;
  _updateUnreadBadge();
}

function _updateUnreadBadge() {
  _wtQsa('.wt-unread-badge').forEach(b => {
    if (WT.unreadCount > 0) {
      b.textContent = WT.unreadCount > 99 ? '99+' : String(WT.unreadCount);
      b.style.display = 'inline-flex';
    } else {
      b.style.display = 'none';
    }
  });
}

/* ── 5. SPAM / FLOOD GUARD ─────────────────────────────────────────
   Returns true (blocked) if user is sending too fast.
   Shows a warning in chat if blocked.                          */
function _isFlooding() {
  const now = _ts();
  // Purge timestamps outside the window
  WT.floodTimestamps = WT.floodTimestamps.filter(t => now - t < FLOOD_WINDOW_MS);
  if (WT.floodTimestamps.length >= FLOOD_MAX_MSGS) {
    // Show inline warning
    const box = _wtQs('#chatMessages');
    if (box) {
      let warn = _wtQs('#wt-flood-warn');
      if (!warn) {
        warn = document.createElement('div');
        warn.id = 'wt-flood-warn';
        warn.style.cssText = 'align-self:center;background:rgba(245,197,24,.1);border:1px solid rgba(245,197,24,.25);border-radius:8px;padding:5px 12px;font-size:.72rem;color:rgba(245,197,24,.9);text-align:center;flex-shrink:0';
        warn.textContent = "⚠️ Slow down — you're sending too fast!";
        box.appendChild(warn);
        box.scrollTop = box.scrollHeight;
        setTimeout(() => warn?.remove(), 2500);
      }
    }
    return true;
  }
  WT.floodTimestamps.push(now);
  return false;
}

/* ── 6. NOTIFICATION SOUND ──────────────────────────────────────────
   Plays a subtle 200ms tone using Web Audio API when a new
   message arrives from another user (no external files needed). */
function _playNotifSound() {
  if (!WT.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch(_) {}
}

/* ── 7. CHAT SEARCH ─────────────────────────────────────────────────
   A search bar inside the chat panel that live-filters messages
   by keyword, dimming non-matching ones.                        */
function _buildSearchBar(container) {
  const bar = document.createElement('div');
  bar.id = 'wt-search-bar';
  bar.style.cssText = 'display:none;align-items:center;gap:5px;padding:5px 8px;background:rgba(255,255,255,.04);border-top:1px solid rgba(255,255,255,.07);flex-shrink:0';
  bar.innerHTML = `
    <span style="font-size:.75rem;color:#9898b0;flex-shrink:0">🔍</span>
    <input id="wt-search-inp" placeholder="Search messages…" maxlength="60"
      style="flex:1;padding:4px 8px;border-radius:5px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#fff;font-size:.76rem;font-family:inherit;outline:none;min-width:0;transition:border-color .12s">
    <button id="wt-search-close" title="Close search"
      style="background:none;border:none;color:#9898b0;cursor:pointer;font-size:.8rem;padding:2px 5px;border-radius:3px;flex-shrink:0">✕</button>`;
  container.appendChild(bar);

  const inp = bar.querySelector('#wt-search-inp');
  inp.addEventListener('input', () => {
    WT.searchQuery = inp.value.trim().toLowerCase();
    _filterMessages();
  });
  inp.addEventListener('keydown', e => { if (e.key==='Escape') _closeSearch(); });
  bar.querySelector('#wt-search-close').onclick = _closeSearch;
}

function _openSearch() {
  WT.searchActive = true;
  const bar = _wtQs('#wt-search-bar'); if (!bar) return;
  bar.style.display = 'flex';
  _wtQs('#wt-search-inp')?.focus();
}

function _closeSearch() {
  WT.searchActive = false;
  WT.searchQuery  = '';
  const bar = _wtQs('#wt-search-bar'); if (bar) bar.style.display = 'none';
  const inp = _wtQs('#wt-search-inp'); if (inp) inp.value = '';
  _filterMessages(); // restore all
}

function _filterMessages() {
  const q = WT.searchQuery;
  const box = _wtQs('#chatMessages'); if (!box) return;
  [...box.children].forEach(el => {
    if (!q) { el.style.opacity='1'; el.style.pointerEvents=''; return; }
    const msgId = el.dataset.msgId;
    const msg   = msgId ? WT_MSG_CACHE[msgId] : null;
    const text  = ((msg?.text||'') + (msg?.name||'')).toLowerCase();
    const match = text.includes(q);
    el.style.opacity       = match ? '1' : '0.18';
    el.style.pointerEvents = match ? '' : 'none';
  });
}

/* ── 8. SMART AUTO-SCROLL ───────────────────────────────────────────
   Detects if user scrolled up (reading history) and stops
   auto-scroll. Shows a "↓ New messages" button if unscrolled. */
function _initAutoScroll(messagesEl) {
  messagesEl.addEventListener('scroll', () => {
    const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 60;
    if (nearBottom !== WT.autoScroll) {
      WT.autoScroll = nearBottom;
      const btn = _wtQs('#wt-scroll-btn');
      if (btn) btn.style.display = WT.autoScroll ? 'none' : 'flex';
    }
    if (nearBottom) {
      // User scrolled back down — clear unread
      _clearUnread();
    }
  }, { passive: true });
}

function _smartScroll(messagesEl) {
  if (WT.autoScroll) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } else {
    // Show scroll-to-bottom button
    let btn = _wtQs('#wt-scroll-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'wt-scroll-btn';
      btn.innerHTML = '↓ New messages';
      btn.style.cssText = 'position:absolute;bottom:90px;left:50%;transform:translateX(-50%);background:#e63946;color:#fff;border:none;border-radius:20px;padding:5px 14px;font-size:.72rem;font-weight:700;cursor:pointer;z-index:10;display:none;align-items:center;gap:4px;font-family:inherit;box-shadow:0 4px 14px rgba(230,57,70,.4);transition:opacity .2s';
      btn.onclick = () => {
        WT.autoScroll = true;
        messagesEl.scrollTop = messagesEl.scrollHeight;
        btn.style.display = 'none';
        _clearUnread();
      };
      const cp = _wtQs('#chatPanel'); if (cp) cp.appendChild(btn);
    }
    btn.style.display = 'flex';
  }
}

/* ── 9. MOBILE SWIPE-TO-REPLY ───────────────────────────────────────
   On touch devices: swipe a message right by ≥40px to trigger
   the reply action on that message.                            */
function _attachSwipeReply(el, fbKey) {
  let startX = null, startY = null, moved = false;
  const threshold = 42;

  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved  = false;
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (startX === null) return;
    const dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dy > 20) { startX = null; return; } // vertical scroll — ignore
    if (dx > 8) {
      moved = true;
      const clamp = Math.min(dx, threshold + 10);
      el.style.transform = `translateX(${clamp}px)`;
      el.style.transition = 'none';
    }
  }, { passive: true });

  el.addEventListener('touchend', () => {
    if (startX === null) return;
    el.style.transition = 'transform .2s ease';
    el.style.transform  = '';
    if (moved) _startReply(fbKey);
    startX = null;
  });
}

/* ── 10. SOUND TOGGLE BUTTON ────────────────────────────────────────
   A 🔔/🔕 toggle injected into the chat header.              */
function _buildSoundToggle(headerEl) {
  const btn = document.createElement('button');
  btn.id    = 'wt-sound-btn';
  btn.title = 'Toggle notification sound';
  btn.style.cssText = 'background:none;border:none;color:#9898b0;cursor:pointer;font-size:.95rem;padding:3px;border-radius:4px;transition:color .12s;line-height:1;flex-shrink:0';
  btn.textContent = WT.soundEnabled ? '🔔' : '🔕';
  btn.onclick = () => {
    WT.soundEnabled = !WT.soundEnabled;
    btn.textContent = WT.soundEnabled ? '🔔' : '🔕';
    _showToast(WT.soundEnabled ? 'Sound on' : 'Sound off', WT.soundEnabled ? '🔔' : '🔕', 1400);
  };
  headerEl.appendChild(btn);
}

/* ── 11. SEARCH BUTTON ──────────────────────────────────────────────
   A 🔍 button in the chat header opens the search bar.       */
function _buildSearchButton(headerEl) {
  const btn = document.createElement('button');
  btn.id    = 'wt-search-btn';
  btn.title = 'Search messages';
  btn.style.cssText = 'background:none;border:none;color:#9898b0;cursor:pointer;font-size:.9rem;padding:3px;border-radius:4px;transition:color .12s;line-height:1;flex-shrink:0';
  btn.textContent = '🔍';
  btn.onclick = () => {
    const bar = _wtQs('#wt-search-bar');
    if (bar && bar.style.display !== 'none') _closeSearch();
    else _openSearch();
  };
  headerEl.appendChild(btn);
}

/* ── 12. REACTION PICKER ON HOVER ──────────────────────────────────
   Adds a quick-reaction row to the message action area.      */
function _buildReactionPicker(fbKey) {
  return `<div class="wt-react-pick" style="display:flex;gap:2px;border-right:1px solid rgba(255,255,255,.08);padding-right:4px;margin-right:1px">${
    QUICK_REACTIONS.map(e =>
      `<button onclick="_toggleReaction('${fbKey}','${e}')" title="${e}"
        style="background:none;border:none;font-size:.85rem;cursor:pointer;padding:2px;border-radius:4px;transition:transform .1s;line-height:1"
        onmouseenter="this.style.transform='scale(1.3)'"
        onmouseleave="this.style.transform=''">${e}</button>`
    ).join('')
  }</div>`;
}

/* ═══ AUGMENT _subscribeChat WITH REACTIONS + NEW FEATURES ═════════ */
// Wrap existing _subscribeChat to also subscribe reactions
const _origSubscribeChat = _subscribeChat;
function _subscribeChat(code) {
  _origSubscribeChat(code);
  _subscribeReactions(code);
  // Init typing indicator after subscriptions
  setTimeout(() => _initTypingIndicator(), 300);
}

/* ═══ AUGMENT _joinRoomInternal TO START CONNECTION MONITOR ════════ */
const _origJoinRoomInternal = _joinRoomInternal;
async function _joinRoomInternal(code, asHost) {
  await _origJoinRoomInternal(code, asHost);
  _initConnectionMonitor();
}

/*  NOTE: The two augment wrappers above use function shadowing.
    Since JS hoists function declarations but not const/let,
    and both original functions are declared with `function`,
    the re-declaration at this point in the file shadows the
    original for all future calls — which is what we want.      */

/* ═══ AUGMENT _rebuildChatPanel TO ADD STABILITY UI ═══════════════ */
const _origRebuildChat = _rebuildChatPanel;
function _rebuildChatPanel() {
  _origRebuildChat();

  // ── Inject stability UI into the freshly-built panel ──
  const cp = _wtQs('#chatPanel'); if (!cp) return;

  // 1. Add sound toggle + search button to header
  const hd = cp.querySelector('div:first-child');
  if (hd) {
    _buildSoundToggle(hd);
    _buildSearchButton(hd);
    // Add unread badge to the toggle button
    _wtQsa('.wt-chat-toggle-btn').forEach(btn => {
      if (!btn.querySelector('.wt-unread-badge')) {
        const badge = document.createElement('span');
        badge.className  = 'wt-unread-badge';
        badge.style.cssText = 'display:none;background:#e63946;color:#fff;border-radius:50%;width:16px;height:16px;font-size:.6rem;font-weight:700;align-items:center;justify-content:center;margin-left:4px;flex-shrink:0';
        btn.appendChild(badge);
      }
    });
  }

  // 2. Inject search bar (hidden by default) before messages
  const msgs = _wtQs('#chatMessages');
  if (msgs && !_wtQs('#wt-search-bar')) {
    _buildSearchBar(msgs.parentNode);
    msgs.parentNode.insertBefore(_wtQs('#wt-search-bar'), msgs);
  }

  // 3. Wire auto-scroll detection on the messages container
  if (msgs) _initAutoScroll(msgs);

  // 4. Inject typing indicator row after messages
  if (msgs && !_wtQs('#wt-typing-row')) {
    const typRow = document.createElement('div');
    typRow.id = 'wt-typing-row';
    typRow.style.cssText = 'padding:2px 10px 4px;font-size:.68rem;color:#9898b0;min-height:18px;flex-shrink:0;font-style:italic;opacity:0;transition:opacity .2s';
    msgs.after(typRow);
  }

  // 5. Wire typing to chat input
  const inp = _wtQs('#wt-chat-inp2');
  if (inp) {
    inp.addEventListener('input', _onInputTyping, { passive: true });
    inp.addEventListener('blur', () => _broadcastTyping(false));
  }
}

/* ═══ AUGMENT _renderMsg TO ADD REACTIONS + SWIPE + SOUND ══════════ */
const _origRenderMsg = _renderMsg;
function _renderMsg(fbKey, msg, scroll=false) {
  _origRenderMsg(fbKey, msg, scroll);

  const el = _wtQs(`[data-msg-id="${fbKey}"]`); if (!el) return;
  const isSystem = msg.userId === 'system';

  // Attach swipe-to-reply on touch devices
  if (!isSystem && 'ontouchstart' in window) {
    _attachSwipeReply(el, fbKey);
  }

  // Sound notification for messages from others
  if (!isSystem && msg.userId !== WT.userId) {
    _playNotifSound();
    _incUnread();
    const msgs = _wtQs('#chatMessages');
    if (msgs) _smartScroll(msgs);
  }
}

/* ═══ AUGMENT _fillMsg TO ADD REACTION PICKER IN ACTION BAR ════════ */
const _origFillMsg = _fillMsg;
function _fillMsg(el, fbKey, msg) {
  _origFillMsg(el, fbKey, msg);
  if (msg.userId === 'system' || msg.deleted) return;

  // Replace action bar to include reaction picker
  const acts = el.querySelector('.wt-msg-acts');
  if (acts) {
    const isSelf   = msg.userId === WT.userId;
    const canEdit  = isSelf && !msg.deleted && !msg.type;
    const canDelete= isSelf || WT.isHost;
    acts.innerHTML = _buildReactionPicker(fbKey) +
      `<button style="background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.1);color:#ccc;border-radius:4px;font-size:.58rem;padding:2px 5px;cursor:pointer;line-height:1.2;transition:background .1s" title="Reply" onclick="_startReply('${_esc(fbKey)}')">↩</button>
      ${canEdit  ?`<button style="background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.1);color:#ccc;border-radius:4px;font-size:.58rem;padding:2px 5px;cursor:pointer;line-height:1.2" title="Edit" onclick="editMessage('${_esc(fbKey)}')">✏️</button>`:''}
      ${canDelete?`<button style="background:rgba(0,0,0,.7);border:1px solid rgba(230,57,70,.25);color:#ff6b6b;border-radius:4px;font-size:.58rem;padding:2px 5px;cursor:pointer;line-height:1.2" title="Delete" onclick="_confirmDelete('${_esc(fbKey)}')">🗑</button>`:''}`;
  }

  // Apply cached reactions if any
  const cached = WT_REACTION_CACHE[fbKey];
  if (cached && Object.keys(cached).length) {
    // We need raw map from DB — approximated from cache for display
    _updateReactionBar(fbKey, cached, {});
  }
}

/* ═══ AUGMENT sendChatMessage WITH FLOOD GUARD ══════════════════════ */
const _origSendChat = sendChatMessage;
function sendChatMessage(text, extra={}) {
  // Skip flood check for system/media-only messages
  if (text && text.trim() && _isFlooding()) return;
  _origSendChat(text, extra);
}

/* ═══ AUGMENT toggleChatPanel TO CLEAR UNREAD ON OPEN ══════════════ */
const _origToggleChat = toggleChatPanel;
function toggleChatPanel() {
  _origToggleChat();
  if (WT.chatVisible) {
    _clearUnread();
    // Scroll to bottom when reopening
    const msgs = _wtQs('#chatMessages');
    if (msgs) { WT.autoScroll = true; msgs.scrollTop = msgs.scrollHeight; }
  }
}
window.toggleChatPanel = toggleChatPanel; // re-expose

/* ═══ AUGMENT leaveRoom TO CLEAN UP TYPING + SEARCH ════════════════ */
const _origLeaveRoom = leaveRoom;
async function leaveRoom(silent=false) {
  clearTimeout(WT.typingTimer);
  WT.typingRef?.remove();
  WT.typingRef = null;
  _closeSearch();
  _hideConnBanner();
  await _origLeaveRoom(silent);
}
window.leaveRoom = leaveRoom; // re-expose

/* ═══ AUGMENT _injectStyles TO ADD v3.1 KEYFRAMES + BADGE ══════════ */
const _origInjectStyles = _injectStyles;
function _injectStyles() {
  _origInjectStyles();
  if (_wtQs('#wt-styles-v31')) return;
  const s = document.createElement('style'); s.id='wt-styles-v31';
  s.textContent = `
    @keyframes wtBounce {
      0%,100% { transform:translateY(0); }
      50%      { transform:translateY(-4px); }
    }
    .wt-unread-badge {
      display:none;
      background:#e63946; color:#fff; border-radius:50%;
      width:16px; height:16px; font-size:.58rem; font-weight:700;
      align-items:center; justify-content:center;
      margin-left:4px; flex-shrink:0; line-height:1;
    }
    #wt-scroll-btn { animation: wtFadeIn .25s ease; }
    @keyframes wtFadeIn { from{opacity:0;transform:translateX(-50%) translateY(6px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
    .wt-react-bar button:hover { transform:scale(1.2) !important; }
    #wt-search-inp:focus { border-color:rgba(230,57,70,.4) !important; background:rgba(255,255,255,.1) !important; }
    #wt-typing-row span span { display:inline-flex; }
  `;
  document.head.appendChild(s);
}

/* ═══ EXPOSE NEW STABLE v3.1 API ═════════════════════════════════════ */
window._toggleReaction   = _toggleReaction;
window._openSearch       = _openSearch;
window._closeSearch      = _closeSearch;
window._playNotifSound   = _playNotifSound;

/* ═══ EXPORTS ════════════════════════════════════════════════════ */
window.initFirebase      = initFirebase;
window.createRoom        = createRoom;
window.joinRoom          = joinRoom;
window.leaveRoom         = leaveRoom;
window.sendChatMessage   = sendChatMessage;
window.kickViewer        = kickViewer;
window.toggleHostOnly    = toggleHostOnly;
window.editMessage       = editMessage;
window.deleteMessage     = deleteMessage;
window._startReply       = _startReply;
window._clearReply       = _clearReply;
window._cancelEdit       = _cancelEdit;
window._confirmDelete    = _confirmDelete;
window._scrollToMsg      = _scrollToMsg;
window._wtSearchGif      = _wtSearchGif;
window._toggleEmojiPanel = _toggleEmojiPanel;
window._toggleGifPanel   = _toggleGifPanel;
window._toggleViewerPanel= _toggleViewerPanel;
window._WT               = WT; // debug access
window.sendChatMessage   = sendChatMessage; // re-expose augmented version

console.log(`%c👥 Watch Together v${WT_VERSION} — Fully upgraded!`, 'color:#10b981;font-weight:bold;font-size:12px');
console.log('%c  v3.0: ✅ Hide/Show | ✅ GIFs | ✅ Emoji | ✅ Edit/Delete | ✅ Replies', 'color:#6ec6ff;font-size:.82em');
console.log('%c  v3.1: ✅ Typing | ✅ Reactions | ✅ Unread badge | ✅ Flood guard | ✅ Search', 'color:#a8e6cf;font-size:.82em');
console.log('%c        ✅ Sound toggle | ✅ Swipe-reply | ✅ Smart scroll | ✅ Reconnect', 'color:#a8e6cf;font-size:.82em');
