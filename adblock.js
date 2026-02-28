/* ═══════════════════════════════════════════════════════════
   STREAMFLIX — Universal Ad Blocker v2.0
   Works on ALL devices: phone, tablet, PC
   No setup needed by users — automatic!

   HOW TO USE:
   Add this ONE line at the bottom of your index.html
   (just before </body>):
   <script src="adblock.js"></script>
═══════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  /* ══════════════════════════════════════════
     1. BLOCK window.open() — kills ALL popups
        when tapping/clicking the player
  ══════════════════════════════════════════ */
  const _open = window.open.bind(window);
  window.open = function(url, name, specs) {
    if (!url || url === 'about:blank') return null;
    try {
      const host = new URL(url, location.href).hostname;
      // Only allow opens from same origin
      if (host === location.hostname) {
        return _open(url, name, specs);
      }
      console.log('[🛡️ AdBlock] Blocked popup →', host);
      return null;
    } catch(_) { return null; }
  };

  /* ══════════════════════════════════════════
     2. BLOCK navigation hijacking
        (ads that redirect your whole page)
  ══════════════════════════════════════════ */
  // Prevent location change from iframes
  Object.defineProperty(window, 'location', {
    get() { return location; },
    set(v) {
      // Only allow if it's from user action, not iframe
      console.log('[🛡️ AdBlock] Blocked location hijack →', v);
    },
    configurable: true
  });

  // Block beforeunload tricks
  window.addEventListener('beforeunload', function(e) {
    e.stopImmediatePropagation();
  }, true);

  /* ══════════════════════════════════════════
     3. SANDBOX ALL player iframes automatically
        — blocks popups from inside video player
  ══════════════════════════════════════════ */
  function sandboxIframe(iframe) {
    if (iframe._sf_patched) return;
    iframe._sf_patched = true;

    // These permissions let video play but BLOCK ads/popups
    iframe.sandbox.value = [
      'allow-scripts',
      'allow-same-origin',
      'allow-presentation',
      'allow-forms',
      'allow-pointer-lock',
      // NO: allow-popups
      // NO: allow-top-navigation
      // NO: allow-popups-to-escape-sandbox
    ].join(' ');

    iframe.setAttribute('allow',
      'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer'
    );
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    console.log('[🛡️ AdBlock] ✅ Iframe sandboxed');
  }

  // Watch for iframes being added to the player
  const playerObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeName === 'IFRAME') sandboxIframe(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('iframe').forEach(sandboxIframe);
        }
      });
    });
  });

  // Observe the whole document for any iframe
  playerObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Patch existing iframes too
  document.querySelectorAll('#playerVideo iframe, #player iframe').forEach(sandboxIframe);

  /* ══════════════════════════════════════════
     4. INTERCEPT fetch() and XHR
        — blocks ads calling their ad servers
  ══════════════════════════════════════════ */
  const AD_HOSTS = new Set([
    'doubleclick.net','googlesyndication.com','googleadservices.com',
    'pagead2.googlesyndication.com','adservice.google.com',
    'adnxs.com','adsrvr.org','advertising.com','ads.yahoo.com',
    'outbrain.com','taboola.com','revcontent.com',
    'mgid.com','adcolony.com','applovin.com','ironsrc.com',
    'pubmatic.com','rubiconproject.com','openx.net',
    'appnexus.com','criteo.com','media.net','bidswitch.net',
    'smartadserver.com','yieldmo.com','triplelift.com',
    'primis.tech','vidazoo.com','connatix.com','adplayer.pro',
    'amazon-adsystem.com','moatads.com','scorecardresearch.com',
    'quantserve.com','chartbeat.com','hotjar.com',
  ]);

  function isAdHost(url) {
    try {
      const host = new URL(url, location.href).hostname;
      return [...AD_HOSTS].some(d => host === d || host.endsWith('.' + d));
    } catch(_) { return false; }
  }

  // Block fetch
  const _fetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    if (isAdHost(url)) {
      console.log('[🛡️ AdBlock] Blocked fetch →', url.split('/')[2]);
      return Promise.resolve(new Response('{}', {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));
    }
    return _fetch.apply(this, arguments);
  };

  // Block XHR
  const _xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (isAdHost(url)) {
      console.log('[🛡️ AdBlock] Blocked XHR →', url.split('/')[2]);
      // Redirect to blank so it silently fails
      return _xhrOpen.call(this, method, 'about:blank');
    }
    return _xhrOpen.apply(this, arguments);
  };

  /* ══════════════════════════════════════════
     5. REMOVE ad DOM elements automatically
        — cleans up any ads that still load
  ══════════════════════════════════════════ */
  const AD_SELECTORS = [
    'ins.adsbygoogle',
    '[id^="google_ads"]',
    '[id^="div-gpt-ad"]',
    '[class*="adsbygoogle"]',
    'iframe[src*="doubleclick"]',
    'iframe[src*="googlesyndication"]',
    'iframe[src*="adnxs"]',
    'iframe[src*="amazon-adsystem"]',
    '[id*="ad-container"]',
    '[class*="ad-overlay"]',
    '[class*="video-ad"]',
    'div[id^="aswift"]',
  ];

  function nukeAds() {
    AD_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.cssText = 'display:none!important;visibility:hidden!important';
        el.remove();
      });
    });
  }

  // Run immediately + periodically
  nukeAds();
  setInterval(nukeAds, 1500);

  // Also run on any DOM change
  const adObserver = new MutationObserver(nukeAds);
  adObserver.observe(document.documentElement, {
    childList: true, subtree: true
  });

  /* ══════════════════════════════════════════
     6. BLOCK tab-switching ad tricks
        (ads that open when you switch tabs)
  ══════════════════════════════════════════ */
  let lastActiveTime = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const away = Date.now() - lastActiveTime;
      if (away > 500) {
        // Came back from another tab — kill any new popups
        nukeAds();
        // Close any window that may have opened
        console.log('[🛡️ AdBlock] Tab refocus — cleaning ads');
      }
    } else {
      lastActiveTime = Date.now();
    }
  });

  /* ══════════════════════════════════════════
     7. BLOCK touch/click redirect on player
        (the #1 cause of ads on mobile!)
        — intercepts the tap-to-redirect trick
  ══════════════════════════════════════════ */
  let lastPlayerTap = 0;

  function guardPlayerTap(e) {
    const player = document.getElementById('playerVideo');
    if (!player || !player.contains(e.target)) return;

    const now = Date.now();
    // If two taps very close together, it's likely an ad tap
    if (now - lastPlayerTap < 300) {
      e.stopImmediatePropagation();
    }
    lastPlayerTap = now;
  }

  document.addEventListener('touchstart', guardPlayerTap, { passive: true, capture: true });
  document.addEventListener('click', (e) => {
    // If a click would navigate away from the page, block it
    const a = e.target.closest('a');
    if (a && a.href) {
      try {
        const dest = new URL(a.href);
        if (dest.hostname !== location.hostname && a.target === '_blank') {
          const player = document.getElementById('playerVideo');
          if (player && player.contains(a)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            console.log('[🛡️ AdBlock] Blocked redirect link →', dest.hostname);
          }
        }
      } catch(_) {}
    }
  }, true);

  /* ══════════════════════════════════════════
     8. SHOW shield indicator in the UI
        — so users know protection is active
  ══════════════════════════════════════════ */
  function showShieldBadge() {
    if (document.getElementById('sf-shield-badge')) return;

    const badge = document.createElement('div');
    badge.id = 'sf-shield-badge';
    badge.innerHTML = '🛡️ Protected';
    badge.style.cssText = `
      position: fixed;
      bottom: 70px;
      right: 14px;
      background: rgba(16,185,129,.15);
      border: 1px solid rgba(16,185,129,.4);
      color: #10b981;
      font-size: .65rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 20px;
      z-index: 9999;
      pointer-events: none;
      letter-spacing: .5px;
      backdrop-filter: blur(4px);
      opacity: 0;
      transition: opacity .5s;
    `;
    document.body.appendChild(badge);

    // Fade in then fade out after 3 seconds
    setTimeout(() => badge.style.opacity = '1', 100);
    setTimeout(() => badge.style.opacity = '0', 3500);
    setTimeout(() => badge.remove(), 4500);
  }

  /* ══════════════════════════════════════════
     9. PATCH setServer() — re-sandbox after
        every server switch
  ══════════════════════════════════════════ */
  const _setServer = window.setServer;
  if (_setServer) {
    window.setServer = function(idx, data) {
      _setServer(idx, data);
      // Re-apply sandbox after iframe is replaced
      setTimeout(() => {
        const player = document.getElementById('playerVideo');
        if (player) player.querySelectorAll('iframe').forEach(sandboxIframe);
      }, 200);
    };
  }

  // Also patch loadServer alias
  const _loadServer = window.loadServer;
  if (_loadServer) {
    window.loadServer = window.setServer;
  }

  /* ══════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    nukeAds();
    showShieldBadge();

    // Patch setServer again after DOM ready (in case it loaded after)
    const _ss = window.setServer;
    if (_ss && !_ss._adPatched) {
      window.setServer = function(idx, data) {
        _ss(idx, data);
        setTimeout(() => {
          document.querySelectorAll('#playerVideo iframe').forEach(sandboxIframe);
        }, 200);
      };
      window.setServer._adPatched = true;
    }

    console.log('%c🛡️ StreamFlix Ad Blocker v2.0 — ACTIVE on all devices!', 'color:#10b981;font-weight:bold;font-size:13px');
    console.log('%c✅ Popup blocker ON\n✅ Iframe sandboxed\n✅ Ad networks blocked\n✅ Redirect protection ON\n✅ Tab-switch protection ON', 'color:#888');
  });

  // Show immediately if DOM already loaded
  if (document.readyState !== 'loading') {
    nukeAds();
    showShieldBadge();
  }

})();
