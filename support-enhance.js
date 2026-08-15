/* ═══════════════════════════════════════════════════════════
   FLIXORA — Support Goal Progress + Smart Engagement Banner
   ───────────────────────────────────────────────────────────
   • Injects a goal progress bar into the existing #supportModal
   • Shows a small dismissible banner after N minutes of active
     engagement (not on page load — avoids feeling pushy)
   Requires Supabase JS + visitor-tracker.js loaded first (reuses
   window._fxSupabase if present, else makes its own client).
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://xzksgjhdxaxwxnomifac.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6a3NnamhkeGF4d3hub21pZmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzAyMjksImV4cCI6MjEwMjMwNjIyOX0.K_BQ2EK5LVrjHDNdRzPoS9QF-WBRA15MKIOw3L53vbY';
  const ENGAGEMENT_THRESHOLD_SEC = 180; // 3 minutes of active time before banner shows

  let sb = window._fxSupabase;
  if (!sb && typeof window.supabase !== 'undefined') {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  if (!sb) { console.warn('[Support] Supabase not available — skipping.'); return; }

  /* ── Fetch goal data ──────────────────────────────────── */
  async function _fetchGoal() {
    try {
      const { data } = await sb.from('site_settings')
        .select('goal_label, goal_amount, current_amount').eq('id', 1).single();
      return data;
    } catch (_) { return null; }
  }

  /* ── Inject progress bar into #supportModal ──────────── */
  async function _injectProgressBar() {
    const modal = document.getElementById('supportModal');
    if (!modal || document.getElementById('fxGoalBar')) return;
    const spHd = modal.querySelector('.sp-hd');
    if (!spHd) return;

    const goal = await _fetchGoal();
    if (!goal || !goal.goal_amount) return;

    const pct = Math.min(100, Math.round((goal.current_amount / goal.goal_amount) * 100));

    const wrap = document.createElement('div');
    wrap.id = 'fxGoalBar';
    wrap.style.cssText = 'padding:0 24px 16px';
    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:.74rem;color:#9494b8;font-weight:600">${goal.goal_label || "This Month's Goal"}</span>
        <span style="font-size:.74rem;color:#f5c518;font-weight:700">₱${Number(goal.current_amount).toLocaleString()} / ₱${Number(goal.goal_amount).toLocaleString()}</span>
      </div>
      <div style="height:8px;background:rgba(255,255,255,.08);border-radius:20px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#e63946,#f5c518);border-radius:20px;transition:width .4s ease"></div>
      </div>
    `;
    spHd.insertAdjacentElement('afterend', wrap);
  }

  // Refresh the bar every time the modal is opened
  function _watchModalOpen() {
    const modal = document.getElementById('supportModal');
    if (!modal) return;
    const obs = new MutationObserver(() => {
      if (modal.classList.contains('open')) {
        document.getElementById('fxGoalBar')?.remove();
        _injectProgressBar();
      }
    });
    obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  /* ── Smart engagement banner ─────────────────────────── */
  let engagedSeconds = 0;
  let engageTimer = null;

  function _startEngagementClock() {
    if (sessionStorage.getItem('fx_support_banner_shown')) return; // already shown this session
    engageTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      // Don't count time while the video player itself is open full-focus —
      // we want this to reflect genuine site browsing/watching engagement either way,
      // so we simply count all visible time.
      engagedSeconds++;
      if (engagedSeconds >= ENGAGEMENT_THRESHOLD_SEC) {
        clearInterval(engageTimer);
        _showBanner();
      }
    }, 1000);
  }

  function _showBanner() {
    if (sessionStorage.getItem('fx_support_banner_shown')) return;
    sessionStorage.setItem('fx_support_banner_shown', '1');
    if (document.getElementById('fxSupportBanner')) return;

    const el = document.createElement('div');
    el.id = 'fxSupportBanner';
    el.style.cssText = `
      position: fixed; bottom: 18px; left: 18px; z-index: 500;
      background: #141421; border: 1px solid rgba(245,197,24,.25);
      border-radius: 16px; padding: 14px 16px; max-width: 300px;
      box-shadow: 0 16px 48px rgba(0,0,0,.6);
      display: flex; align-items: center; gap: 12px;
      transform: translateY(120%); transition: transform .4s cubic-bezier(.16,1,.3,1);
      font-family: 'DM Sans', sans-serif;
    `;
    el.innerHTML = `
      <div style="font-size:1.6rem;flex-shrink:0">☕</div>
      <div style="flex:1">
        <div style="font-size:.82rem;font-weight:700;color:#f2f2fc;margin-bottom:2px">Enjoying Flixora?</div>
        <div style="font-size:.72rem;color:#9494b8;line-height:1.4">A small coffee helps keep it free for everyone.</div>
      </div>
      <button id="fxBannerClose" style="background:none;border:none;color:#4e4e70;font-size:.9rem;cursor:pointer;flex-shrink:0;padding:2px">✕</button>
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.style.transform = 'translateY(0)'));

    el.addEventListener('click', (e) => {
      if (e.target.id === 'fxBannerClose') { _hideBanner(); return; }
      if (typeof window.openSupport === 'function') window.openSupport();
      _hideBanner();
    });

    setTimeout(_hideBanner, 15000); // auto-dismiss after 15s if ignored
  }

  function _hideBanner() {
    const el = document.getElementById('fxSupportBanner');
    if (!el) return;
    el.style.transform = 'translateY(120%)';
    setTimeout(() => el.remove(), 400);
  }

  /* ── Boot ─────────────────────────────────────────────── */
  function boot() {
    _injectProgressBar();
    _watchModalOpen();
    _startEngagementClock();
    console.log('%c✅ Flixora Support Enhancements ready', 'color:#f5c518;font-weight:bold');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
