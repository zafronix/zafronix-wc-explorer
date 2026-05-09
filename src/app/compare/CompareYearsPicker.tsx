'use client';

/**
 * Multi-select chips for the compare view. Toggles ?years=… in the
 * URL on every click — same instant-apply UX as the year strips on
 * Stadiums / Teams / Players. No "Compare →" button: clicking a chip
 * adds the year, clicking it again removes it.
 *
 * Chronological order (1930 → latest) — operators read time left-to-
 * right. Single-tournament view is allowed so the page can stand in
 * for the per-year drill-down when you're already in "compare" mode.
 */

import { useRouter, usePathname } from 'next/navigation';

interface Props {
  allYears: number[];
  active: number[];
}

export function CompareYearsPicker({ allYears, active }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const toggle = (y: number) => {
    const next = active.includes(y) ? active.filter((x) => x !== y) : [...active, y];
    const sorted = [...next].sort((a, b) => a - b);
    if (sorted.length === 0) {
      router.replace(pathname);
    } else {
      router.replace(`${pathname}?years=${sorted.join(',')}`);
    }
  };

  const reset = () => {
    router.replace(pathname);
  };

  // Chronological — 1930 → latest. Reads left-to-right like a timeline.
  const sortedYears = [...allYears].sort((a, b) => a - b);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-sm text-ink-300">
          <span className="font-mono text-brand-400">{active.length}</span> selected
          {active.length === 0 && <span className="text-ink-500 ml-1">— pick 2+ to compare</span>}
        </div>
        {active.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="text-xs px-3 py-1.5 rounded-md border border-ink-700 hover:border-ink-500 text-ink-300"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sortedYears.map((y) => {
          const on = active.includes(y);
          return (
            <button
              key={y}
              type="button"
              onClick={() => toggle(y)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                on
                  ? 'bg-brand-600 text-white'
                  : 'bg-ink-800 hover:bg-ink-700 text-ink-300 border border-ink-700'
              }`}
              aria-pressed={on}
            >
              {y}
            </button>
          );
        })}
      </div>
    </div>
  );
}
