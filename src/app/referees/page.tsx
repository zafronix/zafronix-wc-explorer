/**
 * Referees — every WC referee with year filter + analytics charts.
 *
 * URL: /wc-explorer/referees/?year=YYYY
 *
 * Layout (no year selected):
 *   1. Hero with all-time stats
 *   2. Year selector
 *   3. Three analytics charts:
 *      - Top 10 referees by # of World Cups (career veterans)
 *      - Top 10 referee countries by total games officiated
 *      - Country × Stage matrix (top 10 countries, per-stage counts)
 *   4. Leaderboard table — every referee, sorted by matches
 *
 * Layout (year selected via ?year=YYYY):
 *   1. Hero stats scoped to that year
 *   2. Year selector (with active chip)
 *   3. Leaderboard filtered to refs who officiated that year
 *   (Charts hidden when a year is selected — "top by # WCs" doesn't
 *    make sense in a single-year window.)
 *
 * Data source: GET /referees?limit=500 — server-side aggregation.
 * The year filter is applied admin-side via `years.includes(year)`
 * since the API returns full per-ref data including the year list.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { listReferees, listTournaments, type ApiRefereeSummary } from '@/lib/wc-api';
import { Flag } from '@/components/Flag';
import { TournamentSelector } from '@/components/TournamentSelector';
import { BarSeries, SERIES_COLORS } from '@/components/charts/Charts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Referees — every World Cup match official',
  description: 'Every referee who has officiated at a FIFA World Cup. Ranked by matches officiated. Top 10 by tournaments + per-country analytics. Ravshan Irmatov leads with 11 matches across 3 World Cups.',
  keywords: ['world cup referees', 'fifa world cup referee history', 'ravshan irmatov', 'world cup match officials', 'most experienced world cup referee', 'referees by country'],
  alternates: { canonical: '/referees/' },
};

interface PageProps {
  searchParams: Promise<{
    year?: string;
    /** Substring filter on referee name (case-insensitive). */
    name?: string;
    /** Filter to refs from this country (exact match). Composes with
     *  year/stage on the leaderboard. */
    country?: string;
    /** Filter to refs/countries who officiated at this stage. Values:
     *  group, r32, r16, qf, sf, thirdPlace, final. */
    stage?: string;
  }>;
}

// ─── Stage helpers ──────────────────────────────────────────────────
//
// The wc-api emits per-stage counts using SHORT stage codes that
// match the canonical match.stage values in the dataset:
//   group_a..group_l, r32, r16, qf, sf, thirdPlace, final.
//
// We collapse all the group_* keys into a single 'group' bucket for
// display, but otherwise keep the same naming the API uses so the
// column lookups don't silently miss values.
const STAGE_ORDER: Array<{ key: string; label: string; isKo: boolean }> = [
  { key: 'group',      label: 'Group',  isKo: false },
  { key: 'r32',        label: 'R32',    isKo: true },
  { key: 'r16',        label: 'R16',    isKo: true },
  { key: 'qf',         label: 'QF',     isKo: true },
  { key: 'sf',         label: 'SF',     isKo: true },
  { key: 'thirdPlace', label: '3rd',    isKo: true },
  { key: 'final',      label: 'F',      isKo: true },
];

/** Sum a single referee's per-stage counts into the canonical bucket
 *  set. Group stages span group_a..group_l; collapse all of those
 *  into a single 'group' bucket. KO codes match the API directly. */
function bucketsForRef(byStage: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { group: 0, r32: 0, r16: 0, qf: 0, sf: 0, thirdPlace: 0, final: 0 };
  for (const [k, v] of Object.entries(byStage)) {
    if (k.startsWith('group_')) out.group += v;
    else if (k in out) out[k] += v;
  }
  return out;
}

export default async function RefereesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [data, tournaments] = await Promise.all([
    listReferees(500).catch(() => null),
    listTournaments(),
  ]);
  const allRefs: ApiRefereeSummary[] = data?.referees ?? [];
  const playedYears = tournaments.filter((t) => t.champion).map((t) => t.year);
  const yearParam = sp.year ? Number(sp.year) : NaN;
  const requestedYear = Number.isFinite(yearParam) && playedYears.includes(yearParam) ? yearParam : null;

  // Filter inputs — all optional, all URL-driven so the filter state
  // is bookmarkable and back/forward works.
  const nameFilter    = (sp.name    ?? '').trim().toLowerCase();
  const countryFilter = (sp.country ?? '').trim();
  const stageFilter   = (sp.stage   ?? '').trim();   // 'group' | 'round_of_X' | etc.
  const validStage    = STAGE_ORDER.some((s) => s.key === stageFilter) ? stageFilter : '';

  /** True if a ref has ≥1 match at the given stage (single key, or
   *  the synthetic "group" bucket which spans group_a..group_l). */
  function refHasStage(r: ApiRefereeSummary, stage: string): boolean {
    if (!stage) return true;
    if (stage === 'group') {
      return Object.keys(r.byStage).some((k) => k.startsWith('group_') && r.byStage[k] > 0);
    }
    return (r.byStage[stage] ?? 0) > 0;
  }

  // Filtered leaderboard set. All filters are AND.
  const visibleRefs = allRefs.filter((r) => {
    if (requestedYear && !r.years.includes(requestedYear)) return false;
    if (nameFilter && !r.name.toLowerCase().includes(nameFilter)) return false;
    if (countryFilter && r.country !== countryFilter) return false;
    if (validStage && !refHasStage(r, validStage)) return false;
    return true;
  });
  // Stats for the hero — always reflect the active filter set.
  const totalMatches = visibleRefs.reduce((s, r) => s + r.totalMatches, 0);
  const veterans = allRefs.filter((r) => r.tournaments >= 3);  // always all-time
  const countries = new Set(visibleRefs.map((r) => r.country).filter(Boolean));

  // Distinct values for the filter selects.
  const allCountries = [...new Set(allRefs.map((r) => r.country).filter((c): c is string => !!c))]
    .sort((a, b) => a.localeCompare(b));

  // Did the user set any non-year filter? Drives the visibility of
  // the "clear filters" pill + the empty-state message tone.
  const anyFilterActive = !!(nameFilter || countryFilter || validStage);

  // ─── Chart data (always all-time; year filter doesn't apply) ──
  // Top 10 referees by # of World Cups. Ties broken by total matches.
  const topByWCs = [...allRefs]
    .sort((a, b) => b.tournaments - a.tournaments || b.totalMatches - a.totalMatches)
    .slice(0, 10)
    .map((r) => ({ label: r.name.split(' ').slice(-1)[0]!, value: r.tournaments, host: [r.country ?? ''] }));

  // Country aggregation — sum matches + per-stage across every ref.
  // Always aggregates ALL refs (the country table shows the full
  // career picture per country); the country/stage filters narrow
  // which ROWS we display below, not what gets summed.
  const countryStats = new Map<string, { matches: number; refs: number; byStage: Record<string, number> }>();
  for (const r of allRefs) {
    const c = r.country;
    if (!c) continue;
    let agg = countryStats.get(c);
    if (!agg) {
      agg = { matches: 0, refs: 0, byStage: { group: 0, r32: 0, r16: 0, qf: 0, sf: 0, thirdPlace: 0, final: 0 } };
      countryStats.set(c, agg);
    }
    agg.matches += r.totalMatches;
    agg.refs += 1;
    const bs = bucketsForRef(r.byStage);
    for (const k of Object.keys(agg.byStage)) agg.byStage[k] += bs[k] ?? 0;
  }
  const allCountryRows = [...countryStats.entries()]
    .map(([country, s]) => ({ country, ...s }))
    .sort((a, b) => b.matches - a.matches);

  // Apply country/stage filters to the country×stage table — but NOT
  // the year filter (charts/tables are all-time when no year is
  // selected; the table is hidden when a year IS selected).
  const visibleCountryRows = allCountryRows.filter((c) => {
    if (countryFilter && c.country !== countryFilter) return false;
    if (validStage && (c.byStage[validStage] ?? 0) === 0) return false;
    return true;
  });
  // When stage is filtered, re-sort by that stage's count descending
  // so the most-represented countries at that stage float to the top.
  if (validStage) {
    visibleCountryRows.sort((a, b) => (b.byStage[validStage] ?? 0) - (a.byStage[validStage] ?? 0));
  }

  const topCountriesByMatches = allCountryRows.slice(0, 10).map((c) => ({
    label: c.country.length > 14 ? c.country.slice(0, 12) + '…' : c.country,
    value: c.matches,
    host: [c.country],
  }));

  return (
    <>
      {/* Hero */}
      <section className="border-b border-ink-800 bg-grid">
        <div className="max-w-7xl mx-auto px-6 py-10 sm:py-12">
          <div className="text-xs mb-4">
            <Link href="/" className="text-brand-400 hover:underline">← Overview</Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            <span className="text-white">Referees,</span>{' '}
            <span className="text-brand-400">
              {requestedYear ? `${requestedYear} only.` : 'across every World Cup.'}
            </span>
          </h1>
          <p className="text-ink-300 text-sm mt-2 max-w-2xl">
            {requestedYear
              ? `Match officials who worked the ${requestedYear} World Cup. Click any row for their full career history across every WC they officiated.`
              : 'Every match official from 1930 to today. 90% of WC matches have referee data on record — pre-1950 sparse, modern WCs near-complete. Click any row for full career history.'}
          </p>

          {/* Year picker — single-select, click again on the active year to clear */}
          <TournamentSelector
            years={[...playedYears].sort((a, b) => a - b)}
            playedYears={playedYears}
            activeYear={requestedYear}
            buildHref={(y) => (y === requestedYear ? '/referees/' : `/referees/?year=${y}`)}
            label="Filter by tournament"
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            <Stat
              label={requestedYear ? `Referees in ${requestedYear}` : 'Distinct referees'}
              value={visibleRefs.length.toLocaleString()}
            />
            <Stat
              label="Matches officiated"
              value={totalMatches.toLocaleString()}
              hint={requestedYear ? `in ${requestedYear}` : 'across all WCs'}
            />
            <Stat
              label="3+ World Cups"
              value={veterans.length.toString()}
              hint="career veterans (all-time)"
            />
            <Stat
              label="Countries represented"
              value={countries.size.toString()}
              hint={requestedYear ? `in ${requestedYear}` : ''}
            />
          </div>
        </div>
      </section>

      {/* Charts (only when no year filter is active — single-year
          "by # WCs" charts make no sense). */}
      {!requestedYear && (
        <section className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Top 10 referees by World Cups officiated"
            subtitle="Career veterans — ties broken by total matches. Surname only on the axis for readability."
            source="GET /referees?limit=500"
          >
            <BarSeries data={topByWCs} color={SERIES_COLORS.gold} valueLabel="WCs" height={260} />
            <ol className="mt-4 space-y-1 text-xs">
              {[...allRefs]
                .sort((a, b) => b.tournaments - a.tournaments || b.totalMatches - a.totalMatches)
                .slice(0, 10)
                .map((r, i) => (
                  <li key={r.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-ink-800/40">
                    <span className="text-ink-500 font-mono w-5 text-right tabular-nums">{i + 1}.</span>
                    {r.country && <Flag country={r.country} />}
                    <Link href={`/referees/${r.id}/`} className="font-semibold text-ink-100 hover:text-brand-300 truncate">
                      {r.name}
                    </Link>
                    <span className="text-ink-500">·</span>
                    <span className="text-ink-300 text-[11px] truncate">{r.country ?? '—'}</span>
                    <span className="ml-auto text-accent-gold font-bold tabular-nums">{r.tournaments} WC</span>
                  </li>
                ))}
            </ol>
          </ChartCard>

          <ChartCard
            title="Top 10 referee countries by total games"
            subtitle="Aggregate matches officiated by referees from each country, across every WC."
            source="GET /referees · client-side aggregation by country"
          >
            <BarSeries data={topCountriesByMatches} color={SERIES_COLORS.brand} valueLabel="games" height={260} />
            <ol className="mt-4 space-y-1 text-xs">
              {allCountryRows.slice(0, 10).map((c, i) => (
                <li key={c.country} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-ink-800/40">
                  <span className="text-ink-500 font-mono w-5 text-right tabular-nums">{i + 1}.</span>
                  <Flag country={c.country} />
                  <span className="font-semibold text-ink-100 truncate">{c.country}</span>
                  <span className="ml-auto text-ink-400 text-[11px] tabular-nums">{c.refs} ref{c.refs === 1 ? '' : 's'}</span>
                  <span className="text-brand-400 font-bold tabular-nums">{c.matches}</span>
                </li>
              ))}
            </ol>
          </ChartCard>
        </section>
      )}

      {/* Country × Stage matrix — full list, filterable. Always
          shown (even when year is selected) since it represents the
          all-time per-country breakdown which remains useful context. */}
      {!requestedYear && (
        <section id="country-stage" className="max-w-7xl mx-auto px-6 pb-10 scroll-mt-20">
          <div className="bg-ink-900 border border-ink-800 rounded-2xl overflow-hidden">
            <header className="px-5 py-3 border-b border-ink-800/60">
              <h2 className="text-sm font-bold text-white">Referee countries by stage</h2>
              <p className="text-[11px] text-ink-400 mt-1">
                Every country with WC referee history — counts of matches officiated at each stage
                by referees from that country. Group = all group-stage matches combined; KO columns
                separated. Gold-emphasis on final-stage cells. Filter by country or stage below;
                stage filter re-ranks by that stage&apos;s count.
              </p>
            </header>
            {/* Filter bar — wired to the same searchParams as the
                leaderboard so a single filter set drives both tables. */}
            <RefereeFilterBar
              countries={allCountries}
              activeCountry={countryFilter}
              activeStage={validStage}
              activeName=""  // name filter doesn't apply here
              activeYear={requestedYear}
              showName={false}
              context="country-stage"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-800/40 text-left text-[10px] uppercase tracking-widest text-ink-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold w-8 text-right">#</th>
                    <th className="px-4 py-2 font-semibold">Country</th>
                    {STAGE_ORDER.map((s) => (
                      <th
                        key={s.key}
                        className={`px-3 py-2 font-semibold text-right ${
                          s.key === validStage ? 'text-brand-300' : ''
                        }`}
                      >
                        {s.label}
                      </th>
                    ))}
                    <th className="px-4 py-2 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCountryRows.length === 0 ? (
                    <tr>
                      <td colSpan={STAGE_ORDER.length + 3} className="px-4 py-8 text-center text-ink-400">
                        No countries match the active filters.
                      </td>
                    </tr>
                  ) : visibleCountryRows.map((c, i) => (
                    <tr key={c.country} className="border-t border-ink-800/60 hover:bg-ink-800/30">
                      <td className="px-4 py-2.5 text-right text-ink-500 font-mono text-xs tabular-nums">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Flag country={c.country} />
                          <span className="text-ink-100 font-medium">{c.country}</span>
                          <span className="text-ink-500 text-[10px] font-mono">({c.refs} ref{c.refs === 1 ? '' : 's'})</span>
                        </div>
                      </td>
                      {STAGE_ORDER.map((s) => {
                        const n = c.byStage[s.key] ?? 0;
                        const isMarquee = s.key === 'final';
                        const isActiveStage = s.key === validStage;
                        return (
                          <td
                            key={s.key}
                            className={`px-3 py-2.5 text-right tabular-nums ${
                              isActiveStage
                                ? 'bg-brand-500/10'
                                : ''
                            } ${
                              n === 0
                                ? 'text-ink-700'
                                : isMarquee
                                  ? 'text-accent-gold font-bold'
                                  : s.isKo
                                    ? 'text-brand-300'
                                    : 'text-ink-300'
                            }`}
                          >
                            {n === 0 ? '·' : n}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5 text-right text-white font-mono font-bold tabular-nums">{c.matches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-ink-800 text-[10px] font-mono text-ink-500 flex items-center justify-between gap-2 flex-wrap">
              <span>
                <span className="text-brand-400">GET /referees?limit=500</span>
                {' · client-side aggregation by country'}
                {(countryFilter || validStage) && (
                  <span className="text-amber-400">
                    {' · filtered'}{countryFilter && `: country=${countryFilter}`}{validStage && `: stage=${validStage}`}
                  </span>
                )}
              </span>
              <span>
                {visibleCountryRows.length} of {allCountryRows.length} countries
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Leaderboard */}
      <section id="leaderboard" className="max-w-7xl mx-auto px-6 pb-10 scroll-mt-20">
        <div className="bg-ink-900 border border-ink-800 rounded-2xl overflow-hidden">
          <header className="px-5 py-3 border-b border-ink-800/60 flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-white">
              {requestedYear ? `${requestedYear} referees` : 'All referees — sorted by matches officiated'}
            </h2>
            <span className="text-[10px] text-ink-500 font-mono">
              {visibleRefs.length} referee{visibleRefs.length === 1 ? '' : 's'}
              {anyFilterActive && ` of ${allRefs.length}`}
            </span>
          </header>
          {/* Filter bar — name + country + stage. Composes with the
              year selector in the hero. */}
          <RefereeFilterBar
            countries={allCountries}
            activeCountry={countryFilter}
            activeStage={validStage}
            activeName={nameFilter}
            activeYear={requestedYear}
            showName
            context="leaderboard"
          />
          {visibleRefs.length === 0 ? (
            <div className="p-10 text-center text-ink-400">
              {anyFilterActive
                ? 'No referees match the active filters.'
                : requestedYear
                  ? `No referee data for ${requestedYear}.`
                  : 'No referee data.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-800/40 text-left text-[10px] uppercase tracking-widest text-ink-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold w-8 text-right">#</th>
                    <th className="px-4 py-2 font-semibold">Referee</th>
                    <th className="px-4 py-2 font-semibold">Country</th>
                    <th className="px-4 py-2 font-semibold text-right">Matches</th>
                    <th className="px-4 py-2 font-semibold text-right">WCs</th>
                    <th className="px-4 py-2 font-semibold">Span</th>
                    <th className="px-4 py-2 font-semibold">Knockout matches</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRefs
                    .slice()
                    .sort((a, b) => b.totalMatches - a.totalMatches || a.name.localeCompare(b.name))
                    .map((r, i) => {
                      const koKeys = ['r32', 'r16', 'qf', 'sf', 'thirdPlace', 'final'];
                      const koTotal = koKeys.reduce((s, k) => s + (r.byStage[k] ?? 0), 0);
                      const koList: Array<{ k: string; n: number; label: string }> = [
                        { k: 'final',      n: r.byStage.final      ?? 0, label: 'F'   },
                        { k: 'thirdPlace', n: r.byStage.thirdPlace ?? 0, label: '3rd' },
                        { k: 'sf',         n: r.byStage.sf         ?? 0, label: 'SF'  },
                        { k: 'qf',         n: r.byStage.qf         ?? 0, label: 'QF'  },
                        { k: 'r16',        n: r.byStage.r16        ?? 0, label: 'R16' },
                        { k: 'r32',        n: r.byStage.r32        ?? 0, label: 'R32' },
                      ].filter((x) => x.n > 0);
                      return (
                        <tr key={r.id} className="border-t border-ink-800/60 hover:bg-ink-800/30">
                          <td className="px-4 py-2.5 text-right text-ink-500 font-mono text-xs tabular-nums">{i + 1}</td>
                          <td className="px-4 py-2.5">
                            <Link href={`/referees/${r.id}/`} className="text-ink-100 font-medium hover:text-brand-300">
                              {r.name}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {r.country ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Flag country={r.country} />
                                <span className="text-ink-300">{r.country}</span>
                              </span>
                            ) : <span className="text-ink-600">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-ink-100 font-mono tabular-nums">{r.totalMatches}</td>
                          <td className="px-4 py-2.5 text-right text-ink-300 tabular-nums">{r.tournaments}</td>
                          <td className="px-4 py-2.5 text-xs text-ink-400 font-mono tabular-nums whitespace-nowrap">
                            {r.firstYear === r.lastYear ? r.firstYear : `${r.firstYear}–${r.lastYear}`}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {koTotal === 0 ? (
                              <span className="text-ink-600">none</span>
                            ) : (
                              <span className="flex flex-wrap gap-1">
                                {koList.map(({ k, n, label }) => (
                                  <span
                                    key={k}
                                    className={`inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                      k === 'final'
                                        ? 'bg-accent-gold/15 text-accent-gold border-accent-gold/40'
                                        : k === 'sf' || k === 'thirdPlace'
                                          ? 'bg-brand-500/15 text-brand-300 border-brand-500/40'
                                          : 'bg-ink-700/40 text-ink-300 border-ink-700'
                                    }`}
                                    title={`${n} × ${k.replace(/_/g, ' ')}`}
                                  >
                                    {label}{n > 1 ? ` ×${n}` : ''}
                                  </span>
                                ))}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-2 border-t border-ink-800 text-[10px] font-mono text-ink-500">
            <span className="text-brand-400">GET /referees?limit=500</span>
            {requestedYear && <span> · year={requestedYear}</span>}
            {nameFilter    && <span> · name~{nameFilter}</span>}
            {countryFilter && <span> · country={countryFilter}</span>}
            {validStage    && <span> · stage={validStage}</span>}
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Filter bar — shared shape across both the country×stage matrix and
 * the all-referees leaderboard. Form-driven (no JS needed); submits
 * via GET to update the URL searchParams in place. The "Apply"
 * button is the only network ping per filter change.
 *
 * `context` is a label for the cache-busting key only — both
 * instances render the same controls; their action target differs
 * only via the URL params they preserve. `showName` hides the name
 * input on the country×stage table where it doesn't apply.
 */
function RefereeFilterBar({
  countries, activeCountry, activeStage, activeName, activeYear, showName, context,
}: {
  countries:     string[];
  activeCountry: string;
  activeStage:   string;
  activeName:    string;
  activeYear:    number | null;
  showName:      boolean;
  context:       string;
}) {
  const anyActive = !!(activeName || activeCountry || activeStage);
  // The hash anchor lands the reload at the table the user just
  // touched so the page doesn't scroll back to the top.
  const anchor = context === 'leaderboard' ? '#leaderboard' : '#country-stage';
  // Build a "clear filters" URL that keeps the year but drops the
  // rest. When no year is active, lands back at the bare /referees/.
  const clearHref = activeYear ? `/wc-explorer/referees/?year=${activeYear}${anchor}` : `/wc-explorer/referees/${anchor}`;
  return (
    <form
      method="get"
      action={`/wc-explorer/referees/${anchor}`}
      className="px-5 py-3 border-b border-ink-800/60 bg-ink-900/40 flex flex-wrap items-end gap-3 text-xs"
    >
      {/* Preserve year across filter changes */}
      {activeYear != null && <input type="hidden" name="year" value={activeYear} />}

      {showName && (
        <label className="flex flex-col gap-1 min-w-[180px]">
          <span className="text-[9px] uppercase tracking-widest text-ink-400">Name contains</span>
          <input
            type="text"
            name="name"
            defaultValue={activeName}
            placeholder="e.g. Irmatov"
            className="bg-ink-800 border border-ink-700 rounded px-2 py-1 text-ink-100 placeholder:text-ink-600 focus:border-brand-500 outline-none"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 min-w-[160px]">
        <span className="text-[9px] uppercase tracking-widest text-ink-400">Country</span>
        <select
          name="country"
          defaultValue={activeCountry}
          className="bg-ink-800 border border-ink-700 rounded px-2 py-1 text-ink-100 focus:border-brand-500 outline-none"
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 min-w-[140px]">
        <span className="text-[9px] uppercase tracking-widest text-ink-400">Stage</span>
        <select
          name="stage"
          defaultValue={activeStage}
          className="bg-ink-800 border border-ink-700 rounded px-2 py-1 text-ink-100 focus:border-brand-500 outline-none"
        >
          <option value="">All stages</option>
          <option value="group">Group stage</option>
          <option value="r32">Round of 32</option>
          <option value="r16">Round of 16</option>
          <option value="qf">Quarterfinal</option>
          <option value="sf">Semifinal</option>
          <option value="thirdPlace">Third-place playoff</option>
          <option value="final">Final</option>
        </select>
      </label>

      <div className="flex items-center gap-2 ml-auto">
        <button
          type="submit"
          className="text-[10px] uppercase tracking-widest font-semibold bg-brand-600 hover:bg-brand-500 text-white rounded px-3 py-1.5 transition-colors"
        >
          Apply
        </button>
        {anyActive && (
          <a
            href={clearHref}
            className="text-[10px] uppercase tracking-widest font-semibold border border-ink-700 hover:border-ink-500 text-ink-300 hover:text-ink-100 rounded px-3 py-1.5 transition-colors"
          >
            Clear
          </a>
        )}
      </div>
    </form>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-ink-900/80 backdrop-blur border border-ink-800 rounded-xl p-4">
      <div className="text-2xl sm:text-3xl font-black text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-ink-300 mt-1">{label}</div>
      {hint && <div className="text-[10px] text-ink-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function ChartCard({
  title, subtitle, source, children,
}: {
  title: string;
  subtitle: string;
  source?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <div className="text-[11px] text-ink-300">{subtitle}</div>
      </div>
      {children}
      {source && (
        <div className="mt-3 pt-3 border-t border-ink-800/60 text-[10px] font-mono text-ink-500">
          {source}
        </div>
      )}
    </div>
  );
}
