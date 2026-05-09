/**
 * Cross-page year-strip. Renders every played tournament as a chip.
 *
 * Two modes:
 *   - linkPattern (default '/[year]/'): chip is a hard link to a
 *     specific URL. Used on Overview + Teams where pages are
 *     aggregate views — a chip click jumps to the per-tournament
 *     drill-down.
 *   - active + onClick filter (NOT this component — see /players
 *     and /stadiums YearPicker). For toggle-based filtering use
 *     those page-local pickers; the strip here is link-only.
 *
 * Always chronological (1930 → latest) so years read as a timeline.
 */

import Link from 'next/link';

interface YearStripProps {
  years:        number[];
  /** Pattern with `:year` placeholder. Defaults to per-tournament page. */
  linkPattern?: string;
  /** Highlighted years (e.g. host country selected, or current year
   *  on per-tournament page). */
  highlight?:   number[];
  /** Optional label rendered above the strip. */
  label?:       string;
}

export function YearStrip({
  years, linkPattern = '/:year/', highlight = [], label,
}: YearStripProps) {
  const sorted = [...years].sort((a, b) => a - b);
  const highlightSet = new Set(highlight);
  return (
    <div>
      {label && (
        <div className="text-[10px] uppercase tracking-widest text-ink-300 mb-2">
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((y) => {
          const url = linkPattern.replace(':year', String(y));
          const active = highlightSet.has(y);
          return (
            <Link
              key={y}
              href={url}
              className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                active
                  ? 'bg-brand-600/30 border border-brand-500 text-brand-200'
                  : 'bg-ink-800 border border-ink-700 text-ink-400 hover:text-ink-100'
              }`}
            >
              {y}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
