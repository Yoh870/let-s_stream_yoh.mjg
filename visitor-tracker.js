/* ═══════════════════════════════════════════════════════════
   FLIXORA — Visitor Tracker & Access Gate
   ───────────────────────────────────────────────────────────
   • Logs each visit to Supabase (device, browser, approx location)
   • Checks maintenance_mode — blocks the site for regular visitors
     (admin, logged in via admin.html, is never blocked)
   • Checks blocked_visitors — shows a blocked screen if flagged
   Requires the Supabase JS CDN script to be loaded BEFORE this file:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   Drop this near the END of index.html's script list.
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://xzksgjhdxaxwxnomifac.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6a3NnamhkeGF4d3hub21pZmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzAyMjksImV4cCI6MjEwMjMwNjIyOX0.K_BQ2EK5LVrjHDNdRzPoS9QF-WBRA15MKIOw3L53vbY';

  if (typeof window.supabase === 'undefined') {
    console.warn('[Tracker] Supabase JS not loaded — skipping tracking.');
    return;
  }
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window._fxSupabase = sb; // exposed in case other scripts want it

  /* ── Fingerprint (persisted per-browser id, not a real device ID) ── */
  function _getFingerprint() {
    let fp = localStorage.getItem('fx_visitor_fp');
    if (!fp) {
      fp = 'fp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
      localStorage.setItem('fx_visitor_fp', fp);
    }
    return fp;
  }

  /* ── Geo lookup (cached per session to respect free-tier rate limits) ── */
  async function _getGeo() {
    const cached = sessionStorage.getItem('fx_geo_cache');
    if (cached) { try { return JSON.parse(cached); } catch (_) {} }
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) throw new Error('geo lookup failed');
      const d = await res.json();
      const geo = { ip: d.ip || null, country: d.country_name || null, city: d.city || null, region: d.region || null };
      sessionStorage.setItem('fx_geo_cache', JSON.stringify(geo));
      return geo;
    } catch (_) {
      return { ip: null, country: null, city: null, region: null };
    }
  }

  /* ── Log this visit ───────────────────────────────────────── */
  async function _logVisit(fp) {
    // One log per fingerprint per session (avoid spamming on every page interaction)
    if (sessionStorage.getItem('fx_visit_logged')) return;
    sessionStorage.setItem('fx_visit_logged', '1');

    const geo = await _getGeo();
    try {
      await sb.from('visitor_logs').insert({
        user_agent: navigator.userAgent,
        screen_size: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        referrer: document.referrer || null,
        page_path: location.pathname,
        fingerprint: fp,
        ip_address: geo.ip,
        country: geo.country,
        city: geo.city,
        region: geo.region,
      });
    } catch (e) {
      console.warn('[Tracker] Failed to log visit:', e.message);
    }
  }

  /* ── Full-page block overlay ──────────────────────────────── */
  function _showOverlay({ icon, title, message }) {
    const div = document.createElement('div');
    div.id = 'fxAccessGate';
    div.style.cssText = `
      position:fixed; inset:0; z-index:999999; background:#080810;
      display:flex; align-items:center; justify-content:center; flex-direction:column;
      gap:16px; padding:32px; text-align:center; font-family:'DM Sans',sans-serif; color:#f2f2fc;
    `;
    div.innerHTML = `
      <div style="font-size:3.4rem">${icon}</div>
      <div style="font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:800">${title}</div>
      <p style="max-width:420px;color:#9494b8;font-size:.92rem;line-height:1.7">${message}</p>
    `;
    document.body.innerHTML = '';
    document.body.appendChild(div);
  }

  /* ── Main gate logic ──────────────────────────────────────── */
  async function _runGate(fp) {
    // 1. Is this session an authenticated admin? Admin bypasses maintenance mode.
    const { data: { session } } = await sb.auth.getSession();
    const isAdmin = !!session;

    // 2. Check blocked status (always enforced, even for admin's own testing —
    //    admin should unblock themselves in the panel if needed).
    try {
      const { data: blocked } = await sb.rpc('is_fingerprint_blocked', { fp });
      if (blocked) {
        _showOverlay({
          icon: '🚫',
          title: 'Access Restricted',
          message: 'Your access to Flixora has been restricted. If you believe this is a mistake, please contact the site owner.',
        });
        return true; // gated
      }
    } catch (e) {
      console.warn('[Tracker] Block check failed:', e.message);
    }

    // 3. Check maintenance mode (skip for admin)
    if (!isAdmin) {
      try {
        const { data: settings } = await sb.from('site_settings').select('maintenance_mode, maintenance_message').eq('id', 1).single();
        if (settings?.maintenance_mode) {
          _showOverlay({
            icon: '🛠️',
            title: 'Under Maintenance',
            message: settings.maintenance_message || 'Flixora is under maintenance. Please check back soon!',
          });
          return true; // gated
        }
      } catch (e) {
        console.warn('[Tracker] Maintenance check failed:', e.message);
      }
    }

    return false; // not gated, proceed normally
  }

  /* ── Boot ─────────────────────────────────────────────────── */
  async function boot() {
    const fp = _getFingerprint();
    const gated = await _runGate(fp);
    if (!gated) {
      _logVisit(fp);
      console.log('%c✅ Flixora Visitor Tracker active', 'color:#e63946;font-weight:bold');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
