import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { VisitBeacon } from '@/components/VisitBeacon';

export const metadata: Metadata = {
  // metadataBase MUST include the basePath ('/wc-explorer') because
  // Next.js resolves relative OG/Twitter image URLs against this base
  // and the basePath is otherwise stripped before resolution. Without
  // /wc-explorer here, opengraph-image references emit as
  // https://api.zafronix.com/1986/opengraph-image (404) instead of
  // https://api.zafronix.com/wc-explorer/1986/opengraph-image (200),
  // and every social preview ships with a missing image.
  metadataBase: new URL('https://api.zafronix.com/wc-explorer'),
  title: {
    default: 'WC Explorer · Zafronix',
    template: '%s · WC Explorer',
  },
  description:
    'Interactive sample dashboard for the Zafronix World Cup API — every tournament from 1930 to 2026 with rich charts, team breakdowns, and side-by-side comparisons.',
  openGraph: {
    type: 'website',
    siteName: 'Zafronix WC Explorer',
    // FIXME: should be a WC-Explorer-branded card, not the generic
    // brand one. The original /wc-explorer/og.png was never generated
    // and 500'd, so Facebook/Twitter previews shipped with no image.
    // Falling back to the shared brand OG card until we build a
    // per-page OG generator. Tracked separately.
    images: ['https://api.zafronix.com/static/og-card.png'],
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Same domain-restricted Google Maps key the admin + siono use.
  // Restricted via Google Cloud to *.zafronix.com + *.siono.app, so
  // embedding in the client bundle is fine. Override via the env var
  // for dev or future rotation.
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    ?? 'AIzaSyDY_rR_MRbvbIZHG7_07GMXqDa97VTE0VM';
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <SiteHeader />

        {/* Visitor-tracking beacon — fires one POST per page load
            (including client-side route changes) to /api/visit, which
            forwards the visitor's IP to the WC API for the admin map. */}
        <VisitBeacon />

        <main className="flex-1">{children}</main>

        <footer className="border-t border-ink-800 mt-12">
          {/* Three exit ramps — applies to every page, no matter how
              deep the user clicked from the landing. Visually weighted
              so the API CTA dominates without bullying the others. */}
          <section className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a
              href="https://api.zafronix.com/signup"
              className="group relative overflow-hidden rounded-2xl border border-brand-500/50 bg-gradient-to-br from-brand-700/40 via-ink-900 to-ink-950 p-5 hover:border-brand-400 transition-colors"
            >
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative">
                <div className="text-[10px] uppercase tracking-widest text-brand-400 font-semibold mb-1">
                  Build with this data
                </div>
                <div className="text-lg font-bold text-white">
                  Get a free API key <span className="text-brand-300">→</span>
                </div>
                <p className="text-[11px] text-ink-300 mt-2 leading-relaxed">
                  5,000 requests/day. No card required. Every chart on this site is one HTTP call away.
                </p>
              </div>
            </a>
            <a
              href="https://api.zafronix.com/docs"
              className="rounded-2xl border border-ink-700 hover:border-ink-500 bg-ink-900/40 p-5 transition-colors group"
            >
              <div className="text-[10px] uppercase tracking-widest text-ink-400 font-semibold mb-1">
                Reference
              </div>
              <div className="text-lg font-bold text-white">
                Read the docs <span className="text-ink-400 group-hover:text-ink-200">↗</span>
              </div>
              <p className="text-[11px] text-ink-400 mt-2 leading-relaxed">
                Endpoint reference, rate limits, webhooks, OpenAPI spec. Curl-ready examples for every route.
              </p>
            </a>
            <a
              href="https://api.zafronix.com/wc-mcp"
              className="rounded-2xl border border-ink-700 hover:border-ink-500 bg-ink-900/40 p-5 transition-colors group"
            >
              <div className="text-[10px] uppercase tracking-widest text-ink-400 font-semibold mb-1">
                AI / Agents
              </div>
              <div className="text-lg font-bold text-white">
                MCP server <span className="text-ink-400 group-hover:text-ink-200">↗</span>
              </div>
              <p className="text-[11px] text-ink-400 mt-2 leading-relaxed">
                Use the WC API from Claude / ChatGPT / Cursor. Tool-call wrappers for every endpoint, one-click install.
              </p>
            </a>
          </section>
          <div className="border-t border-ink-800/60">
            <div className="max-w-7xl mx-auto px-6 py-5 text-xs text-ink-500 flex flex-col sm:flex-row gap-3 justify-between">
              <div>
                Built on the{' '}
                <a href="https://api.zafronix.com/docs" className="text-brand-400 hover:underline">
                  Zafronix WC API
                </a>{' '}
                · 23 tournaments · 1930 → 2026 · 1,068+ matches · 2,500+ players
              </div>
              <div className="flex items-center gap-3">
                <a href="https://zafronix.com" className="hover:text-ink-300">zafronix.com</a>
                <span aria-hidden>·</span>
                <a href="https://api.zafronix.com/docs" className="hover:text-ink-300">API docs</a>
                <span aria-hidden>·</span>
                <a href="mailto:contact@zafronix.com" className="hover:text-ink-300">contact</a>
              </div>
            </div>
          </div>
        </footer>

        {mapsKey && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${mapsKey}&loading=async`}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
