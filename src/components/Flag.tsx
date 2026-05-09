/**
 * Inline flag image. Resolves a country name through lib/flags and
 * renders a fixed-size image with a placeholder fallback so rows
 * stay aligned even when the lookup misses.
 *
 *   <Flag country="Mexico" />               — 20×14 default
 *   <Flag country="USA" size={40} />        — bigger for chart legends
 *   <HostFlags hosts={['USA','Canada','Mexico']} />  — multi-host helper
 *
 * The Tournament types carry hosts as `string[]` (1986 Mexico is one
 * entry, 2026 is three) so HostFlags renders all of them in a row.
 */

import { flagFor, flagUrlAtSize, FLAG_W, FLAG_H, type FlagInfo } from '@/lib/flags';

interface FlagProps {
  /** Country name as it appears in the WC API ("Mexico", "USA", etc.). */
  country?: string | null;
  /** Optional pre-resolved FlagInfo (skip the lookup). */
  info?: FlagInfo;
  /** Pixel width. Height auto-derived at the typical flag aspect. */
  size?: 20 | 40 | 80;
  /** Title attribute override; defaults to the resolved name. */
  title?: string;
  /** Extra classes for the wrapper. */
  className?: string;
}

export function Flag({ country, info, size = 20, title, className = '' }: FlagProps) {
  const f = info ?? flagFor(country ?? null);
  const url = flagUrlAtSize(f, size);
  const w = size;
  const h = Math.round(size * (FLAG_H / FLAG_W));
  if (!url) {
    // Placeholder — same width so flagged + unflagged rows align.
    return (
      <span
        className={`inline-block flex-shrink-0 ${className}`}
        style={{ width: w, height: h }}
        aria-hidden
      />
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      width={w}
      height={h}
      alt=""
      title={title ?? f.name}
      loading="lazy"
      decoding="async"
      className={`inline-block flex-shrink-0 rounded-sm shadow-sm ${className}`}
    />
  );
}

/**
 * Render every host flag for a tournament side-by-side. Co-hosted
 * tournaments (2002 KOR/JPN, 2026 USA/CAN/MEX) get all flags;
 * single-host tournaments get one. Names render after the flags
 * unless `flagsOnly` is set.
 */
export function HostFlags({
  hosts, size = 20, flagsOnly = false, separator = ' / ', className = '',
}: {
  hosts: string[];
  size?: 20 | 40 | 80;
  flagsOnly?: boolean;
  separator?: string;
  className?: string;
}) {
  if (hosts.length === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {hosts.map((h, i) => (
        <span key={`${h}-${i}`} className="inline-flex items-center gap-1">
          <Flag country={h} size={size} />
          {!flagsOnly && <span>{h}</span>}
          {i < hosts.length - 1 && !flagsOnly && (
            <span className="text-zinc-500 mx-0.5">{separator}</span>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * Single country label with flag (for champion / runner-up / 3rd / etc).
 * Use this everywhere a single country needs to be shown — not the
 * multi-host case.
 */
export function CountryLabel({
  country, size = 20, className = '',
}: {
  country: string | null | undefined;
  size?: 20 | 40 | 80;
  className?: string;
}) {
  if (!country) return <span className="text-zinc-500">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Flag country={country} size={size} />
      <span>{country}</span>
    </span>
  );
}
