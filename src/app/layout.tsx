import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

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
    images: ['/wc-explorer/og.png'],
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-ink-800 bg-ink-950/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-baseline gap-2 group">
                <span className="text-base font-bold text-brand-400 group-hover:text-brand-300 transition-colors">
                  Zafronix
                </span>
                <span className="text-[10px] uppercase tracking-widest text-ink-300">
                  WC&nbsp;Explorer
                </span>
              </Link>
              <nav className="hidden sm:flex items-center gap-6 text-sm">
                <Link href="/" className="text-ink-300 hover:text-ink-100 transition-colors">
                  Overview
                </Link>
                <Link href="/compare/" className="text-ink-300 hover:text-ink-100 transition-colors">
                  Compare
                </Link>
                <a
                  href="https://api.zafronix.com/docs"
                  className="text-ink-300 hover:text-ink-100 transition-colors"
                >
                  API docs
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://api.zafronix.com/signup"
                className="text-xs px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors"
              >
                Get a free key
              </a>
            </div>
          </div>
        </header>

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
      </body>
    </html>
  );
}
