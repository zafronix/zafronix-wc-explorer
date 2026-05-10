'use client';

/**
 * Site header with responsive nav.
 *
 * Two breakpoints:
 *   - md (≥768px): inline horizontal nav next to the logo
 *   - <md: hamburger button next to the "Get a free key" CTA. Tap to
 *          open a full-width dropdown panel with the same nav links.
 *
 * Why client component? The hamburger requires open/close state.
 * Everything else (logo, CTA, links) is identical to the previous
 * server-rendered layout.
 */

import Link from 'next/link';
import { useState } from 'react';

const NAV_LINKS: Array<{ href: string; label: string; external?: boolean }> = [
  { href: '/',          label: 'Overview' },
  { href: '/compare/',  label: 'Compare' },
  { href: '/teams/',    label: 'Teams' },
  { href: '/players/',  label: 'Players' },
  { href: '/stadiums/', label: 'Stadiums' },
  { href: 'https://api.zafronix.com/docs', label: 'API docs', external: true },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-ink-800 bg-ink-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
        {/* Logo + desktop nav */}
        <div className="flex items-center gap-8 min-w-0">
          <Link href="/" className="flex items-baseline gap-2 group flex-shrink-0">
            <span className="text-base font-bold text-brand-400 group-hover:text-brand-300 transition-colors">
              Zafronix
            </span>
            <span className="text-[10px] uppercase tracking-widest text-ink-300">
              WC&nbsp;Explorer
            </span>
          </Link>
          {/* Inline nav — only when there's enough horizontal room.
              Bumped from `sm:` (640px) to `md:` (768px) since on phone
              landscape the inline nav was crammed against the CTA and
              there wasn't enough room without overflow. */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.label} {...link} />
            ))}
          </nav>
        </div>

        {/* CTA + hamburger */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href="https://api.zafronix.com/signup"
            className="text-xs px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors whitespace-nowrap"
          >
            Get a free key
          </a>
          {/* Hamburger — only visible when the inline nav is hidden. */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="md:hidden p-2 -mr-2 rounded-md hover:bg-ink-800 text-ink-300 hover:text-ink-100 transition-colors"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="site-mobile-menu"
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel — full-width, slides under the bar.
          We render unconditionally and toggle via max-height + opacity
          for a small slide animation. `aria-hidden` keeps it out of the
          a11y tree when closed. */}
      <div
        id="site-mobile-menu"
        className={`md:hidden border-t border-ink-800 overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
          open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!open}
      >
        <nav className="max-w-7xl mx-auto px-6 py-3 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <MobileNavLink
              key={link.label}
              {...link}
              onClick={() => setOpen(false)}
            />
          ))}
        </nav>
      </div>
    </header>
  );
}

// ─── Inline-nav link (desktop) ─────────────────────────────────────

function NavLink({ href, label, external }: { href: string; label: string; external?: boolean }) {
  if (external) {
    return (
      <a href={href} className="text-ink-300 hover:text-ink-100 transition-colors">
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className="text-ink-300 hover:text-ink-100 transition-colors">
      {label}
    </Link>
  );
}

// ─── Dropdown link (mobile) ────────────────────────────────────────
//
// Larger tap targets, full-row hover/active state. Closes the dropdown
// on tap so the user lands on the new page with the menu out of the way.

function MobileNavLink({
  href, label, external, onClick,
}: { href: string; label: string; external?: boolean; onClick: () => void }) {
  const className =
    'block px-3 py-3 rounded-md text-base text-ink-200 hover:text-white hover:bg-ink-800/60 active:bg-ink-800 transition-colors';
  if (external) {
    return (
      <a href={href} onClick={onClick} className={className}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={className}>
      {label}
    </Link>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}
