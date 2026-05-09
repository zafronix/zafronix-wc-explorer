/**
 * Cross-page year-strip. Renders every played tournament as a chip,
 * grouped by decade so 23 years across 1930→2026 read as natural
 * clumps and wrap balanced when they have to.
 *
 * Always chronological (1930 → latest). Decade labels are subtle
 * monospace markers above each cluster.
 */

import Link from 'next/link';
import { groupYearsByDecade, decadeShort } from '@/lib/year-groups';

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
  const groups = groupYearsByDecade(years);
  const highlightSet = new Set(highlight);
  return (
    <div>
      {label && (
        <div className="text-[10px] uppercase tracking-widest text-ink-300 mb-2">
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {groups.map((g) => (
          <div key={g.decade}>
            <div className="text-[9px] uppercase tracking-widest text-ink-500 mb-1 font-mono">
              {decadeShort(g.decade)}
            </div>
            <div className="flex flex-wrap gap-1">
              {g.years.map((y) => {
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
        ))}
      </div>
    </div>
  );
}
