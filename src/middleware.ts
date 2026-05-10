/**
 * Per-request visitor-IP ping to the WC API.
 *
 * The page-render `apiGet` calls in lib/wc-api.ts are cached for 24h
 * via Next's `next: { revalidate }`, so they only fire on cache miss.
 * That means the FIRST visitor at a URL forwards their IP and the
 * next thousand within 24h are invisible to the API — useless for
 * "where are explorer visitors coming from" rollups.
 *
 * Middleware runs on every request including cache hits, so we use
 * it to fire a lightweight authenticated ping to the API on each
 * visit. Fire-and-forget — we don't await the response, the user-
 * visible response time is unaffected.
 *
 * The ping hits /tournaments (cheap, the API caches it heavily so
 * the round-trip is sub-10ms warm) with X-Origin-App: wc-explorer
 * and X-Visitor-IP: <real-ip>. The API's usage tracker records the
 * event tagged with origin=wc-explorer and ip=<visitor>; the admin's
 * map then resolves the IP through its geoip cache (30-day TTL via
 * ip-api.com) and renders a brand-purple dot at that visitor's
 * city.
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.WC_API_BASE ?? 'https://api.zafronix.com/fifa/worldcup/v1';
const API_KEY  = process.env.WC_API_KEY;

export function middleware(request: NextRequest) {
  // Skip ping for static-asset requests, OG image renders, and our
  // own internal Next.js routes — these don't represent a user
  // visiting an explorer page and would just inflate the count.
  const path = request.nextUrl.pathname;
  if (
    path.startsWith('/_next/')
    || path.startsWith('/api/')
    || path.includes('opengraph-image')
    || path.includes('favicon')
    || path.endsWith('.svg')
    || path.endsWith('.png')
    || path.endsWith('.ico')
    || path.endsWith('.webp')
  ) {
    return NextResponse.next();
  }

  // Extract visitor IP. nginx → Next adds x-forwarded-for; the
  // request.ip helper is unreliable across runtimes, so prefer the
  // explicit header. First entry is the original client; everything
  // after is upstream-added.
  const ip = (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || ''
  );

  // Fire-and-forget. We don't await — the request goes out, the
  // response comes back microseconds-to-low-ms later, but the user's
  // page render isn't blocked on it.
  if (API_KEY && ip) {
    fetch(`${API_BASE}/tournaments`, {
      method: 'GET',
      headers: {
        'X-API-Key':     API_KEY,
        'X-Origin-App':  'wc-explorer',
        'X-Visitor-IP':  ip,
        'User-Agent':    'wc-explorer-ping/1.0',
      },
      // Don't let Next cache this — every visit must hit the API
      // fresh, otherwise we lose the per-visit attribution which is
      // the whole point of the ping.
      cache: 'no-store',
    }).catch((err) => {
      // Swallow — operator visibility into ping failures isn't worth
      // surfacing to users. journalctl on the API side will show
      // any 4xx/5xx if there's a systemic auth problem.
      console.warn('[wc-explorer ping]', err?.message ?? err);
    });
  }

  return NextResponse.next();
}

export const config = {
  // Run on all paths except static assets and opengraph image routes.
  // The matcher is a coarse first filter; the inner skip-list above
  // catches anything that slips through.
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (Next route handlers)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, *.svg, *.png at the root
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)',
  ],
};
