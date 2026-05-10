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
    // sendBeacon is fire-and-forget by spec; the browser queues the
    // request and dispatches it even if the page is closing. Falls
    // back to fetch on rare environments without sendBeacon support
    // (some legacy in-app browsers, headless test tooling).
    // Trailing slash matches next.config.ts trailingSlash: true.
    // Without it, hitting /api/visit returns 308 → /api/visit/ and
    // sendBeacon doesn't follow redirects on every browser.
    const url = '/wc-explorer/api/visit/';
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(url);
      } else {
        // Fire-and-forget — don't await, don't .catch (we don't care
        // about the response on the browser side).
        fetch(url, { method: 'POST', keepalive: true });
      }
    } catch {
      // Swallow — beacon failures should never affect the user-
      // visible page. Server-side journalctl catches systemic issues.
    }
  }, [pathname]);

  // No DOM — pure side effect.
  return null;
}
