/**
 * /wc-explorer/api/visit — visitor-tracking beacon.
 *
 * Browser-side: a tiny <Script> in the root layout fires
 * fetch('/wc-explorer/api/visit', { method: 'POST' }) on every page
 * load. That hits THIS handler.
 *
 * Server-side: this handler reads the visitor's real IP from the
 * incoming request (X-Forwarded-For from nginx, set by the user's
 * browser → nginx → Next chain) and fires a fire-and-forget
 * authenticated request to the WC API at /tournaments with:
 *   X-Origin-App:  wc-explorer
 *   X-Visitor-IP:  <real-ip>
 *
 * The API's usage tracker honors X-Origin-App + X-Visitor-IP for
 * internal-tier keys, so the event lands tagged origin=wc-explorer
 * with the visitor's actual IP. The admin map's geoip resolver then
 * places a brand-purple dot at that visitor's city.
 *
 * Why this instead of middleware:
 *   - Edge-runtime middleware had a broken interaction with our
 *     module-level process.env.WC_API_KEY access (caused empty
 *     responses on every page render). Route handlers run in the
 *     standard Node runtime — process.env works as expected.
 *   - The beacon model also captures cache-hit page loads. Next's
 *     fetch cache + our `revalidate: 86400` means most page renders
 *     don't re-fire apiGet; this handler runs anyway because the
 *     browser explicitly hits it.
 *
 * The handler returns 204 No Content immediately — the API call to
 * the wc-api is fire-and-forget (no await), so the browser's
 * fetch().then() resolves in milliseconds. We don't surface ping
 * failures to the user; journalctl on this service catches systemic
 * problems.
 */

import 'server-only';
import type { NextRequest } from 'next/server';

const API_BASE = process.env.WC_API_BASE ?? 'https://api.zafronix.com/fifa/worldcup/v1';
const API_KEY  = process.env.WC_API_KEY;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Extract the visitor's real IP. nginx → Next adds X-Forwarded-For;
  // the first comma-separated entry is the original client. Next's
  // request.headers is a standard Headers instance.
  const ip = (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || ''
  );

  // Fire-and-forget. The browser doesn't wait on our upstream — we
  // return 204 immediately and the fetch resolves in the background.
  // If the API is slow/down/rate-limited, the visitor's page render
  // is unaffected.
  if (API_KEY && ip) {
    fetch(`${API_BASE}/tournaments`, {
      method: 'GET',
      headers: {
        'X-API-Key':    API_KEY,
        'X-Origin-App': 'wc-explorer',
        'X-Visitor-IP': ip,
        'User-Agent':   'wc-explorer-beacon/1.0',
      },
      // Don't let Next cache this — every visit must hit the API
      // fresh, otherwise we lose per-visit attribution which is the
      // whole point of the beacon.
      cache: 'no-store',
    }).catch((err) => {
      console.warn('[wc-explorer beacon]', err?.message ?? err);
    });
  }

  // 204 No Content — no body, no caching headers, just an
  // acknowledgement. Browser's fetch.then() resolves silently.
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

// GET allowed too, for sendBeacon fallback compatibility — older
// browsers' navigator.sendBeacon defaults to POST but some intranet
// proxies strip POST bodies; allowing GET as a no-cost backup keeps
// edge cases working. Same handler logic.
export const GET = POST;
