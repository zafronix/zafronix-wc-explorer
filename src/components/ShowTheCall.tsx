'use client';

/**
 * "Show the call" disclosure — the load-bearing conversion lever on
 * the WC Explorer landing page.
 *
 * Why this exists: the rest of the landing page says "here's a chart."
 * A developer's first question is "what's the request that builds
 * that chart?" Showing them the exact curl + JSON response converts
 * intent to "I could ship this in 10 minutes" — that's the moment the
 * Get-a-free-key button stops being hypothetical.
 *
 * The disclosure is collapsed by default (sub-row footer below each
 * chart). Clicking expands a small panel showing:
 *
 *   - The exact curl with the production API base + their would-be
 *     API key placeholder (X-API-Key: $WC_API_KEY)
 *   - A trimmed sample of the JSON response, fetched live from the
 *     wc-api when expanded the first time (cached client-side so
 *     re-toggling is instant)
 *   - "Copy curl" + "Copy URL" affordances
 *
 * Live-fetch path: the same /track endpoint allowlist that protects
 * the visit beacon doesn't apply here; we just GET the endpoint with
 * the explorer's own caching path (it's already a 24h cache so the
 * extra fetch is free in the warm case).
 *
 * Failure mode: if the live fetch errors, we show a placeholder
 * sample. Better to never leave the dev staring at a spinner.
 */

import { useState, useEffect } from 'react';

interface Props {
  /** The endpoint path (without origin), e.g. `/aggregates/champions`.
   *  We append the prod API base for display; for the live fetch we
   *  hit the wc-explorer's own server (which forwards to the API with
   *  the internal key) so the demo doesn't require a key. */
  endpoint: string;
  /** Override the displayed curl command — when the endpoint takes
   *  query params that need explicit examples. Leave blank for auto. */
  displayCurl?: string;
}

const PROD_BASE = 'https://api.zafronix.com/fifa/worldcup/v1';

export function ShowTheCall({ endpoint, displayCurl }: Props) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  // The curl the developer would actually run.
  const curl = displayCurl
    ?? `curl -H "X-API-Key: $WC_API_KEY" ${PROD_BASE}${endpoint}`;
  const fullUrl = `${PROD_BASE}${endpoint}`;

  // Live-fetch the response when expanded for the first time. We
  // proxy through the wc-explorer's own server route so the demo
  // works without a key. The proxy is a tiny passthrough wired up
  // alongside this component (see src/app/api/preview/...).
  useEffect(() => {
    if (!open || body !== null || loading) return;
    setLoading(true);
    fetch(`/wc-explorer/api/preview?path=${encodeURIComponent(endpoint)}`)
      .then((r) => r.text())
      .then((t) => {
        // Pretty-print + truncate for display.
        try {
          const j = JSON.parse(t);
          const pretty = JSON.stringify(j, null, 2);
          setBody(pretty.length > 1600 ? pretty.slice(0, 1600) + '\n…' : pretty);
        } catch {
          setBody(t.slice(0, 1600));
        }
      })
      .catch(() => setBody('// Live fetch unavailable. Try the curl above against a real API key.'))
      .finally(() => setLoading(false));
  }, [open, body, loading, endpoint]);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint(`${label} copied`);
      setTimeout(() => setCopyHint(null), 1500);
    } catch {
      setCopyHint('Press Ctrl/Cmd-C');
      setTimeout(() => setCopyHint(null), 1500);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-ink-800/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-[10px] font-mono text-ink-500 hover:text-brand-300 transition-colors group"
        aria-expanded={open}
      >
        <span className="truncate">
          <span className="text-ink-600">{open ? '▼' : '▶'}</span>{' '}
          <span className="group-hover:text-brand-400">GET</span> {endpoint}
        </span>
        <span className="text-brand-400/80 group-hover:text-brand-300 ml-2 flex-shrink-0">
          {open ? 'hide' : 'show the call →'}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {/* curl */}
          <div className="bg-ink-950 border border-ink-800 rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-ink-800 bg-ink-900/60">
              <span className="text-[9px] uppercase tracking-widest text-ink-400">curl</span>
              <div className="flex items-center gap-3">
                {copyHint && <span className="text-[10px] text-brand-300">{copyHint}</span>}
                <button
                  type="button"
                  onClick={() => copy(curl, 'curl')}
                  className="text-[10px] text-brand-400 hover:text-brand-300"
                >
                  Copy curl
                </button>
                <button
                  type="button"
                  onClick={() => copy(fullUrl, 'URL')}
                  className="text-[10px] text-ink-400 hover:text-ink-200"
                >
                  Copy URL
                </button>
              </div>
            </div>
            <pre className="px-3 py-2 text-[11px] font-mono text-zinc-200 overflow-x-auto whitespace-pre-wrap break-all">
{curl}
            </pre>
          </div>
          {/* JSON response */}
          <div className="bg-ink-950 border border-ink-800 rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-ink-800 bg-ink-900/60">
              <span className="text-[9px] uppercase tracking-widest text-ink-400">response</span>
              <span className="text-[9px] text-ink-500 font-mono">
                {loading ? 'fetching…' : body ? `${body.split('\n').length} lines` : ''}
              </span>
            </div>
            <pre className="px-3 py-2 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-72 overflow-y-auto leading-snug">
{loading ? '// loading...' : (body ?? '// expand to fetch')}
            </pre>
          </div>
          <p className="text-[10px] text-ink-500 leading-relaxed">
            Live response from the same API powering this chart. The free tier handles 5,000 requests/day,
            no card required.{' '}
            <a href="https://api.zafronix.com/signup" className="text-brand-400 hover:underline">Get a key →</a>
          </p>
        </div>
      )}
    </div>
  );
}
