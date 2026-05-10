import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  metadataBase: new URL('https://api.zafronix.com'),
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

        <main className="flex-1">{children}</main>

        <footer className="border-t border-ink-800 mt-12 py-6">
          <div className="max-w-7xl mx-auto px-6 text-xs text-ink-500 flex flex-col sm:flex-row gap-3 justify-between">
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
