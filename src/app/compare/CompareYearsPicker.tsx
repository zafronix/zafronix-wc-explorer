'use client';

/**
 * Multi-select chips for the compare view. Updates ?years=… in the URL
 * with router.replace so back/forward navigation Just Works.
 *
 * Chronological order (1930 → latest) — operators read time left-to-
 * right. Single-tournament view is allowed (min 1) so the page can
 * stand in for the per-year drill-down when you're already in
 * "compare" mode.
 */

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';

interface Props {
  allYears: number[];
  active: number[];
}

export function CompareYearsPicker({ allYears, active }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [picked, setPicked] = useState<number[]>(active);

  const toggle = (y: number) => {
    setPicked((cur) => (cur.includes(y) ? cur.filter((x) => x !== y) : [...cur, y]));
  };

  const apply = () => {
    if (picked.length < 1) return;
    const sorted = [...picked].sort((a, b) => a - b);
    router.replace(`${pathname}?years=${sorted.join(',')}`);
  };

  const reset = () => {
    setPicked([]);
    router.replace(pathname);
  };

  // Chronological — 1930 → latest. Reads left-to-right like a timeline.
  const sortedYears = [...allYears].sort((a, b) => a - b);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-sm text-ink-300">
          <span className="font-mono text-brand-400">{picked.length}</span> selected
          <span className="text-ink-500 ml-1">(min 1)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="text-xs px-3 py-1.5 rounded-md border border-ink-700 hover:border-ink-500 text-ink-300"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={picked.length < 1}
            className="text-xs px-4 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold"
          >
            Compare →
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sortedYears.map((y) => {
          const on = picked.includes(y);
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
