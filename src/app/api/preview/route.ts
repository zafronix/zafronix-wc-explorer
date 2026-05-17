/**
 * Server-side passthrough for the "Show the call" disclosure.
 *
 *   GET /api/preview?path=/aggregates/champions
 *
 * Fetches the named endpoint from the wc-api using the explorer's
 * internal-tier key, returns the raw JSON to the client island.
 * Without this proxy, the disclosure would have to fetch the API
 * directly from the browser, which would either require exposing
 * the internal key (no) or making the user paste their own key
 * (defeats the "see what the response looks like" promise).
 *
 * Allowlist: only paths matching the documented WC API surface are
 * forwarded. We don't want this to become a generic open proxy.
 * The allowlist is intentionally conservative — any new endpoint
 * that ships needs to be added here to be previewable.
 *
 * Caching: piggybacks on the same Next data cache the rest of the
 * SSR fetches use (24h for the static-history endpoints, 1h for
 * meta, 60s for live). So the disclosure response is usually
 * sub-millisecond.
 */

import { NextRequest } from 'next/server';

const ALLOWED_PREFIXES = [
  '/tournaments',
  '/teams',
  '/players',
  '/matches',
  '/stadiums',
  '/referees',
  '/compare',
  '/aggregates',
  '/trivia',
];

const WC_API_BASE =
  process.env.WC_API_BASE ?? 'https://api.zafronix.com/fifa/worldcup/v1';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') ?? '';
  if (!path) return new Response('missing path', { status: 400 });

  // Strict allowlist — exact prefix match. Block any attempt to
  // hop laterally (e.g. /admin, /track, /me).
  const ok = ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
  if (!ok) return new Response('forbidden', { status: 403 });

  const key = process.env.WC_API_KEY;
  if (!key) return new Response('// API key not configured', { status: 503 });

  try {
    const res = await fetch(`${WC_API_BASE}${path}`, {
      headers: {
        'X-API-Key':    key,
        'X-Origin-App': 'wc-explorer',
        Accept:         'application/json',
      },
      // 1h cache — these previews are read by curious devs hitting the
      // landing page; we don't need second-by-second freshness, and
      // hitting the API every page render would defeat the cache
      // unification work we did earlier.
      next: { revalidate: 3600 },
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch {
    return new Response('// upstream unreachable', { status: 502 });
  }
}
