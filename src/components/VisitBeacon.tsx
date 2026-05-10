'use client';

/**
 * Visitor-tracking beacon — fires a single POST to /api/visit on
 * every page load (mount), including:
 *
 *   - Hard navigations (full page loads)
 *   - Soft navigations (Next's client-side router transitions)
 *   - Browser back/forward navigation
 *
 * Mounted once in the root layout. The 'usePathname' dependency in
 * useEffect re-fires on every route change, so we get one beacon per
 * page view across the entire SPA.
 *
 * Why client-side: the server-side render is cached by Next's fetch
 * cache, so the wc-api/lib/wc-api.ts apiGet calls only run on cache
 * miss. The browser-side beacon runs every time, attributable to the
 * actual visitor's IP via the request to /api/visit (which then forwards
 * the IP to the wc-api). See app/api/visit/route.ts for the server side.
 *
 * Failure mode: navigator.sendBeacon is preferred when available
 * because it survives page-unload (the browser fires the request even
 * if the user immediately closes the tab). Falls back to fetch() on
 * older browsers. Either way: zero impact on user-visible response time.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function VisitBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    // Beacon fires DIRECTLY at the public WC API (not through our
    // own /api/visit proxy route) so the underlying TCP connection
    // comes from the visitor's browser, not from this wc-explorer
    // process on its VPS. nginx in front of the API captures the
    // visitor's real IP via X-Forwarded-For; the admin's geo map
    // then resolves the actual user's city instead of the VPS's
    // Atlanta IONOS location.
    //
    // The endpoint is anonymous + Origin-gated — the Origin /
    // Referer header must come from api.zafronix.com /
    // zafronix.com / siono.app, so random sites can't spam our
    // geo data.
    //
    // sendBeacon is fire-and-forget by spec; browser queues the
    // request and dispatches it even on page-unload. Falls back to
    // fetch+keepalive on rare environments without sendBeacon.
    const url = 'https://api.zafronix.com/fifa/worldcup/v1/track/visit?origin=wc-explorer';
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(url);
      } else {
        // Fire-and-forget. mode: 'cors' + credentials: 'omit' is the
        // standard cross-origin beacon shape; the API responds with
        // permissive CORS headers for our whitelisted origins.
        fetch(url, { method: 'POST', keepalive: true, mode: 'cors', credentials: 'omit' });
      }
    } catch {
      // Swallow — beacon failures should never affect the user-
      // visible page. Server-side journalctl catches systemic issues.
    }
  }, [pathname]);

  // No DOM — pure side effect.
  return null;
}
