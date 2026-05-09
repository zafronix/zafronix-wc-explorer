/**
 * Group a list of years by decade for the cross-page year strips.
 *
 * Returns ascending-decade-then-ascending-year. The decade label is
 * just the floor decade ("1930", "1990", "2020") — the strip
 * components render it as `'30s` / `'70s` / `'20s` for compactness.
 *
 * Why group? The played-years span 1930→2026 with WWII gaps; a
 * single flex-wrap row of 23 chips often breaks awkwardly (e.g.
 * 2026 alone on a second row). Decade groups give the eye natural
 * reading clumps and keeps wrapping balanced when it does happen.
 */
export interface YearDecadeGroup {
  decade: number;       // 1930, 1940, 1950, …
  years:  number[];     // ascending
}

export function groupYearsByDecade(years: number[]): YearDecadeGroup[] {
  const map = new Map<number, number[]>();
  for (const y of [...years].sort((a, b) => a - b)) {
    const d = Math.floor(y / 10) * 10;
    const arr = map.get(d) ?? [];
    arr.push(y);
    map.set(d, arr);
  }
  return Array.from(map.entries())
    .map(([decade, ys]) => ({ decade, years: ys }))
    .sort((a, b) => a.decade - b.decade);
}

/** Two-digit decade suffix ("1970" → "'70s"). */
export function decadeShort(decade: number): string {
  return `'${String(decade).slice(2)}s`;
}
