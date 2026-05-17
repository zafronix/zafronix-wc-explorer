/**
 * TournamentSelector — single-year picker, used across every page
 * except /compare (which is intentionally multi-select).
 *
 * Visual: flat pills, chronological left-to-right (1930 → latest).
 * Active year highlighted brand-purple. Upcoming-but-unplayed years
 * (no champion yet) render dimmer so the operator can tell which
 * tournaments have data without clicking through. Match-view-style
 * pills are deliberately not decade-grouped — the user picked this
 * style explicitly; if scanning a wider span of years gets cramped
 * we'll revisit.
 *
 * URL-driven: every pill is an RSC `<Link>` whose href is generated
 * by the caller via `buildHref(year)`. This keeps the picker
 * page-agnostic — each page decides whether to put the year on
 * `?year=` or rebuild its path (e.g. /1990/, /2022/, etc.).
 *
 * The active state is computed from `activeYear ?? null`. Pass null
 * to render with no chip active (e.g. "all years" mode on /players
 * before any year is clicked).
 *
 * For the multi-select case on /compare we keep the separate
 * `CompareYearsPicker` — multi-select needs add/remove semantics
 * that don't compose cleanly into a single-year API.
 */

import Link from 'next/link';

interface Props {
  /** Every tournament year to render (played + upcoming). Caller
   *  controls ordering before passing — typical is `.sort((a, b) =>
   *  a - b)` for chronological. */
  years:        number[];
  /** Played-tournament years (have a champion). Years not in this
   *  set render dimmer so the operator knows there's no data yet. */
  playedYears:  number[];
  /** Currently selected year. Null = no selection. */
  activeYear:   number | null;
  /** Build the href for a given year. Page-specific. Example:
   *    /players → (y) => `/players/?year=${y}` (or whatever shape) */
  buildHref:    (year: number) => string;
  /** Optional label rendered above the strip. Default: "Tournament". */
  label?:       string;
}

export function TournamentSelector({
  years, playedYears, activeYear, buildHref, label = 'Tournament',
}: Props) {
  const playedSet = new Set(playedYears);
  return (
    <div className="mt-6">
      <div className="text-[10px] uppercase tracking-widest text-ink-300 mb-2">{label}</div>
      <div className="flex flex-wrap gap-1">
        {years.map((y) => {
          const isActive = y === activeYear;
          const isPlayed = playedSet.has(y);
          return (
            <Link
              key={y}
              href={buildHref(y)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                isActive
                  ? 'bg-brand-600/30 border border-brand-500 text-brand-200'
                  : isPlayed
                    ? 'bg-ink-800 border border-ink-700 text-ink-400 hover:text-ink-100'
                    : 'bg-ink-800 border border-ink-700 text-ink-600 hover:text-ink-300'
              }`}
              title={isPlayed ? `${y} — completed` : `${y} — upcoming`}
            >
              {y}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Multi-select variant — used by /compare ────────────────────────
// Same pill styling and chronological order as the single-select
// version, but supports an arbitrary number of active years. Click
// to toggle on/off. Used on /compare where the operator picks 2-N
// tournaments to compare side-by-side.

interface MultiProps {
  years:        number[];
  playedYears:  number[];
  /** Currently selected years (any order). */
  activeYears:  number[];
  /** Build the href that results when `year` is toggled — caller
   *  owns the URL shape. */
  buildHref:    (year: number) => string;
  /** Optional secondary action — e.g. "clear all" link rendered to
   *  the right of the label. */
  rightSlot?:   React.ReactNode;
  label?:       string;
}

export function TournamentMultiSelector({
  years, playedYears, activeYears, buildHref, rightSlot, label = 'Tournaments — click to add/remove',
}: MultiProps) {
  const playedSet = new Set(playedYears);
  const activeSet = new Set(activeYears);
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="text-[10px] uppercase tracking-widest text-ink-300">{label}</div>
        {rightSlot}
      </div>
      <div className="flex flex-wrap gap-1">
        {years.map((y) => {
          const isActive = activeSet.has(y);
          const isPlayed = playedSet.has(y);
          return (
            <Link
              key={y}
              href={buildHref(y)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                isActive
                  ? 'bg-brand-600/30 border border-brand-500 text-brand-200'
                  : isPlayed
                    ? 'bg-ink-800 border border-ink-700 text-ink-400 hover:text-ink-100'
                    : 'bg-ink-800 border border-ink-700 text-ink-600 hover:text-ink-300'
              }`}
              title={isActive ? `${y} — click to remove` : isPlayed ? `${y} — click to add` : `${y} — upcoming, click to add`}
            >
              {y}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
