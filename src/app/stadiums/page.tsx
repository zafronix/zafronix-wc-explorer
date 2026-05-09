/**
 * Stadiums view — every WC venue 1930→2026.
 *
 * URL: /wc-explorer/stadiums/
 *
 * Sections:
 *   - Hero: total count, host countries, oldest/newest, total capacity
 *   - Highest-altitude leaderboard (the Mexico City advantage)
 *   - Most-used venues (Maracanã, Azteca, Wembley, etc.)
 *   - Capacity over time scatter (does WC stadium size grow with eras?)
 *   - Stadiums by host country donut
 *   - Big table with every venue, sortable client-side via the URL
 *
 * The choropleth-style world map is intentionally not in this view —
 * a per-country count is in the donut, and per-stadium points would
 * cluster too tightly to read at world scale. The Teams view will
 * have a per-team distance-traveled map that uses the same coords.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { listStadiums, listTournaments, listMatchesByYear, type ApiStadium } from '@/lib/wc-api';
import { Flag } from '@/components/Flag';
import { BarSeries, Donut, SERIES_COLORS } from '@/components/charts/Charts';
import { StadiumMap, type StadiumMapPoint } from '@/components/StadiumMap';
import { groupYearsByDecade, decadeShort } from '@/lib/year-groups';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Stadiums — every World Cup venue 1930→2026',
  description: '206 venues that have hosted FIFA World Cup matches. Capacity, altitude (Estadio Toluca tops at 2,666 m), host country, tournament appearances, and goals-per-match by altitude band. Map view + searchable table.',
  keywords: ['world cup stadiums', 'world cup venues', 'highest altitude world cup stadium', 'estadio azteca', 'world cup 2026 stadiums', 'fifa world cup venues map'],
  alternates: { canonical: '/wc-explorer/stadiums/' },
};

interface PageProps {
  searchParams: Promise<{ sort?: string; years?: string }>;
}

export default async function StadiumsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const sort = sp.sort ?? 'tournaments';

  const [allStadiums, tournaments] = await Promise.all([
    listStadiums(),
    listTournaments(),
  ]);
  // Stadium picker includes EVERY tournament year — 2026 schedule
  // is on file even before kickoff, so filtering to it returns the
  // pre-allocated venues. Players uses `playedYears` (champion-set)
  // because aggregate-player stats only exist for played editions.
  const playedYears = tournaments.filter((t) => t.champion).map((t) => t.year);
  const allYearsForPicker = tournaments.map((t) => t.year);

  // Year picker — same semantics as the Players page. Empty = all years.
  // When years are selected, narrow stadiums to those whose tournaments[]
  // intersects the selection. The match-count overlay also re-aggregates
  // to just the selected years.
  const requestedYears = sp.years
    ? sp.years.split(',').map((y) => Number(y.trim())).filter((y) => allYearsForPicker.includes(y))
    : [];
  const yearsActive = requestedYears.length > 0;
  const yearsSet = new Set(requestedYears);

  const stadiums = yearsActive
    ? allStadiums.filter((s) => s.tournaments.some((y) => yearsSet.has(y)))
    : allStadiums;

  // Per-stadium match counts. We fetch ALL tournament years —
  // including the upcoming/in-progress 2026, whose matches are
  // already on the schedule even before they're played. So
  // "Estadio Azteca · 1970 (2), 1986 (3), 2026 (3)" works at any
  // point in the WC cycle. With per-year caching at the API, 24+
  // parallel fetches are warm in milliseconds.
  const allTournamentYears = tournaments.map((t) => t.year);
  const yearsToFetch = yearsActive ? requestedYears : allTournamentYears;
  const matchListsByYear = new Map<number, Awaited<ReturnType<typeof listMatchesByYear>>>();
  await Promise.all(
    yearsToFetch.map(async (y) => {
      const list = await listMatchesByYear(y).catch(() => []);
      matchListsByYear.set(y, list);
    }),
  );

  // Total match count per stadium (across the active window) +
  // per-year breakdown for the leaderboard's tournament list +
  // total goals per stadium (for altitude-effect analysis below).
  const matchCountByStadium  = new Map<string, number>();
  const goalCountByStadium   = new Map<string, number>();
  const matchByStadiumYear   = new Map<string, Map<number, number>>();
  for (const [year, list] of matchListsByYear) {
    for (const m of list) {
      if (!m.stadiumId) continue;
      matchCountByStadium.set(m.stadiumId, (matchCountByStadium.get(m.stadiumId) ?? 0) + 1);
      const goals = (m.homeScore ?? 0) + (m.awayScore ?? 0);
      // Skip null-score future matches when computing the total —
      // 2026 fixtures might be on the schedule with score=null.
      if (m.homeScore != null && m.awayScore != null) {
        goalCountByStadium.set(m.stadiumId, (goalCountByStadium.get(m.stadiumId) ?? 0) + goals);
      }
      let perYear = matchByStadiumYear.get(m.stadiumId);
      if (!perYear) {
        perYear = new Map();
        matchByStadiumYear.set(m.stadiumId, perYear);
      }
      perYear.set(year, (perYear.get(year) ?? 0) + 1);
    }
  }

  // Altitude-effect bucketing — average goals/match per altitude band.
  // Only stadiums with both elevation and at least one finalized match
  // contribute. Bands picked to roughly mirror the FIFA "altitude
  // medical guidance" thresholds (sea level / mid / high / very-high).
  interface AltBucket { label: string; min: number; max: number; matches: number; goals: number; venues: number; }
  const altBuckets: AltBucket[] = [
    { label: 'Sea level (<200m)',  min: 0,    max: 200,  matches: 0, goals: 0, venues: 0 },
    { label: 'Low (200-800m)',     min: 200,  max: 800,  matches: 0, goals: 0, venues: 0 },
    { label: 'Mid (800-1500m)',    min: 800,  max: 1500, matches: 0, goals: 0, venues: 0 },
    { label: 'High (1500-2200m)',  min: 1500, max: 2200, matches: 0, goals: 0, venues: 0 },
    { label: 'Very high (≥2200m)', min: 2200, max: Infinity, matches: 0, goals: 0, venues: 0 },
  ];
  for (const s of stadiums) {
    if (typeof s.elevationM !== 'number') continue;
    const matches = matchCountByStadium.get(s.id) ?? 0;
    const goals   = goalCountByStadium.get(s.id) ?? 0;
    if (matches === 0) continue;
    const bucket = altBuckets.find((b) => (s.elevationM as number) >= b.min && (s.elevationM as number) < b.max);
    if (!bucket) continue;
    bucket.matches += matches;
    bucket.goals   += goals;
    bucket.venues  += 1;
  }
  const altitudeChart = altBuckets
    .filter((b) => b.matches > 0)
    .map((b) => ({
      label: b.label,
      value: Math.round((b.goals / b.matches) * 100) / 100,
      // Carry the totals through so the tooltip can show the underlying
      // numbers, not just the ratio.
      host: undefined,
    }));

  // ─── Aggregates ──────────────────────────────────────────────────
  const totalCapacity = stadiums.reduce((s, x) => s + (x.capacity ?? 0), 0);
  const hostCountries = new Set(stadiums.map((s) => s.country)).size;
  const oldest = [...stadiums]
    .filter((s) => s.opened != null)
    .sort((a, b) => (a.opened ?? 0) - (b.opened ?? 0))[0];
  const newest = [...stadiums]
    .filter((s) => s.opened != null)
    .sort((a, b) => (b.opened ?? 0) - (a.opened ?? 0))[0];

  // Highest altitude — Mexico City + Toluca dominate.
  const highest = [...stadiums]
    .filter((s) => typeof s.elevationM === 'number' && (s.elevationM ?? 0) > 0)
    .sort((a, b) => (b.elevationM ?? 0) - (a.elevationM ?? 0))
    .slice(0, 10);

  // Most-used venues. When a year filter is active we rank by raw
  // match count inside the selected window (so 2026's 16-venue
  // schedule populates the list — most are first-time hosts so the
  // tournaments.length>1 filter would leave only Estadio Azteca).
  // With no filter (all-time view), fall back to multi-tournament
  // reuse, which is the more interesting cross-history signal.
  const mostUsed = yearsActive
    ? [...stadiums]
        .filter((s) => (matchCountByStadium.get(s.id) ?? 0) > 0)
        .sort((a, b) =>
          (matchCountByStadium.get(b.id) ?? 0) - (matchCountByStadium.get(a.id) ?? 0)
          || (b.capacity ?? 0) - (a.capacity ?? 0))
        .slice(0, 12)
    : [...stadiums]
        .filter((s) => s.tournaments.length > 1)
        .sort((a, b) => b.tournaments.length - a.tournaments.length || (b.capacity ?? 0) - (a.capacity ?? 0))
        .slice(0, 10);

  // Stadiums by host country — donut.
  const byCountry = new Map<string, number>();
  for (const s of stadiums) byCountry.set(s.country, (byCountry.get(s.country) ?? 0) + 1);
  const countryDonut = Array.from(byCountry.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Capacity-over-time chart — bucket by decade of opening, average
  // capacity. Only stadiums with a known opening year + capacity.
  const decadeBuckets = new Map<number, number[]>();
  for (const s of stadiums) {
    if (s.opened == null || s.capacity == null) continue;
    const decade = Math.floor(s.opened / 10) * 10;
    const arr = decadeBuckets.get(decade) ?? [];
    arr.push(s.capacity);
    decadeBuckets.set(decade, arr);
  }
  const capacityByDecade = Array.from(decadeBuckets.entries())
    .map(([decade, caps]) => ({
      label: `${decade}s`,
      value: Math.round(caps.reduce((a, b) => a + b, 0) / caps.length),
    }))
    .sort((a, b) => Number(a.label.slice(0, -1)) - Number(b.label.slice(0, -1)));

  // Sortable table.
  const sorted = sortStadiums(stadiums, sort);

  // Map points — every filtered stadium with valid coords. Match
  // count comes from the year-scoped fetches above; when no years
  // are active we use tournaments.length as a proxy ("how many WCs
  // did this venue host"), which the operator sees in the info
  // window as "WC editions" instead of "matches".
  const mapPoints: StadiumMapPoint[] = stadiums
    .filter((s) => s.coords && s.coords.lat != null && s.coords.long != null)
    .map((s) => ({
      id:         s.id,
      name:       s.name,
      city:       s.city,
      country:    s.country,
      lat:        s.coords.lat,
      lng:        s.coords.long,
      capacity:   s.capacity,
      elevationM: s.elevationM ?? null,
      // Real match count (across the active window) when we have it;
      // falls back to tournaments[].length only when match data is
      // missing entirely. The marker info-window shows the real
      // figure, not just "N WC editions".
      matchCount: matchCountByStadium.get(s.id) ?? s.tournaments.length,
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
            <span className="text-white">Every World Cup venue,</span>{' '}
            <span className="text-brand-400">1930 → 2026.</span>
          </h1>
          <p className="text-ink-300 text-sm mt-2 max-w-2xl">
            {yearsActive
              ? `${stadiums.length} venue${stadiums.length === 1 ? '' : 's'} across ${hostCountries} host nation${hostCountries === 1 ? '' : 's'} for the selected year${requestedYears.length === 1 ? '' : 's'}.`
              : `${allStadiums.length} stadiums across ${new Set(allStadiums.map((s) => s.country)).size} host nations.`}
            {' '}Capacity, altitude, opening year, tournament appearances. Click any row to query the underlying API
            (<span className="font-mono text-brand-400">GET /stadiums/&lbrace;id&rbrace;</span>).
          </p>

          <YearPicker years={requestedYears} allYears={allYearsForPicker} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            <Stat label="Stadiums" value={stadiums.length.toLocaleString()} />
            <Stat label="Host countries" value={hostCountries.toString()} />
            <Stat
              label="Oldest"
              value={oldest?.opened != null ? String(oldest.opened) : '—'}
              hint={oldest?.name}
              flagCountry={oldest?.country}
            />
            <Stat
              label="Newest"
              value={newest?.opened != null ? String(newest.opened) : '—'}
              hint={newest?.name}
              flagCountry={newest?.country}
            />
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold text-white">
                Stadium map
              </h2>
              <div className="text-[11px] text-ink-300">
                {yearsActive
                  ? `Venues used in ${requestedYears.join(', ')} — marker size + color scales with match count`
                  : 'All venues — marker size + color scales with WC-edition count'}
                {' · click any marker for details'}
              </div>
            </div>
            <span className="text-[11px] font-mono text-ink-500">
              {mapPoints.length} venue{mapPoints.length === 1 ? '' : 's'}
            </span>
          </div>
          <StadiumMap
            points={mapPoints}
            height={460}
            hosts={
              yearsActive
                ? Array.from(new Set(
                    requestedYears.flatMap((y) =>
                      tournaments.find((t) => t.year === y)?.host ?? [],
                    ),
                  ))
                : []
            }
          />
        </div>
      </section>

      {/* Altitude + Repeat venues */}
      <section className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Highest-altitude venues"
          subtitle="Estadio Azteca's 2,287m made 1986 famous. Toluca tops out higher."
          source="GET /stadiums (sorted by elevationM desc)"
        >
          <ol className="space-y-1.5 text-sm">
            {highest.map((s, i) => (
              <li key={s.id}>
                <div className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-ink-800/40">
                  <span className="text-[11px] font-mono text-ink-500 w-5 text-right">{i + 1}.</span>
                  <Flag country={s.country} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{s.name}</div>
                    <div className="text-[11px] text-ink-300 truncate">{s.city}, {s.country}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-accent-gold font-mono tabular-nums">
                      {s.elevationM!.toLocaleString()} m
                    </div>
                    {s.capacity != null && (
                      <div className="text-[10px] text-ink-500">cap {s.capacity.toLocaleString()}</div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </ChartCard>

        <ChartCard
          title="Most-used venues"
          subtitle={yearsActive
            ? `Ranked by match count in ${requestedYears.join(', ')}`
            : 'Stadiums that hosted multiple World Cups'}
          source={yearsActive
            ? 'GET /matches?year=… (count grouped by stadiumId)'
            : 'GET /stadiums (filter: tournaments.length > 1)'}
        >
          {mostUsed.length === 0 ? (
            <p className="text-sm text-ink-500">No multi-tournament venues yet.</p>
          ) : (
            <ol className="space-y-1.5 text-sm">
              {mostUsed.map((s, i) => {
                const perYear = matchByStadiumYear.get(s.id);
                const totalMatches = matchCountByStadium.get(s.id) ?? 0;
                // Build "1970 (2), 1986 (3), 2026 (3)" — pulls real
                // match counts per tournament where available, falls
                // back to bare year when match data is missing.
                const yearLabel = s.tournaments
                  .map((y) => {
                    const n = perYear?.get(y);
                    return n != null ? `${y} (${n})` : `${y}`;
                  })
                  .join(', ');
                return (
                  <li key={s.id}>
                    <div className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-ink-800/40">
                      <span className="text-[11px] font-mono text-ink-500 w-5 text-right">{i + 1}.</span>
                      <Flag country={s.country} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{s.name}</div>
                        <div className="text-[11px] text-ink-300 truncate">{s.city}, {s.country}</div>
                      </div>
                      <div className="text-right">
                        {yearsActive ? (
                          <>
                            <div className="text-sm font-bold text-accent-gold font-mono tabular-nums">
                              {totalMatches} match{totalMatches === 1 ? '' : 'es'}
                            </div>
                            <div className="text-[10px] text-ink-500 font-mono">
                              {yearLabel}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-bold text-accent-gold font-mono tabular-nums">
                              {s.tournaments.length}× cups
                              {totalMatches > 0 && (
                                <span className="text-ink-400 font-normal ml-1.5">
                                  {totalMatches} match{totalMatches === 1 ? '' : 'es'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-ink-500 font-mono">
                              {yearLabel}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </ChartCard>
      </section>

      {/* Capacity trend + country donut */}
      <section className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Average capacity by opening decade"
          subtitle="Are WC venues getting bigger over time?"
          source="GET /stadiums (group by floor(opened / 10) × 10)"
        >
          <BarSeries data={capacityByDecade} color={SERIES_COLORS.cyan} valueLabel="seats" height={260} />
        </ChartCard>

        <ChartCard
          title="Stadiums by host country"
          subtitle={`${countryDonut.length} countries have hosted matches`}
          source="GET /stadiums (group by country)"
        >
          <Donut data={countryDonut} centerLabel={String(stadiums.length)} height={300} />
        </ChartCard>
      </section>

      {/* Altitude-effect chart — does playing higher correlate with
          more goals? Bands roughly mirror FIFA's altitude medical
          guidance thresholds. */}
      {altitudeChart.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-2">
          <ChartCard
            title="Goals per match by stadium altitude"
            subtitle="Does the air thin out the defense? Bands aligned with FIFA altitude-acclimatization thresholds."
            source="goals.sum / matches.count, grouped by elevation band"
          >
            <BarSeries data={altitudeChart} color={SERIES_COLORS.gold} valueLabel="goals/match" height={240} />
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
              {altBuckets.filter((b) => b.matches > 0).map((b) => (
                <div key={b.label} className="px-3 py-2 bg-ink-950/40 border border-ink-800 rounded-lg">
                  <div className="text-[10px] uppercase tracking-widest text-ink-500">{b.label}</div>
                  <div className="text-base font-bold text-white mt-0.5 tabular-nums">
                    {(b.goals / b.matches).toFixed(2)}
                    <span className="text-[10px] text-ink-400 font-normal ml-1">g/m</span>
                  </div>
                  <div className="text-[10px] text-ink-500 mt-0.5 font-mono tabular-nums">
                    {b.goals} goals · {b.matches} matches · {b.venues} venue{b.venues === 1 ? '' : 's'}
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </section>
      )}

      {/* Big table */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-2xl font-bold">All venues</h2>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-ink-500 mr-2">Sort:</span>
            <SortLink current={sort} key_="tournaments" label="WC appearances" />
            <SortLink current={sort} key_="capacity"    label="Capacity" />
            <SortLink current={sort} key_="altitude"    label="Altitude" />
            <SortLink current={sort} key_="opened"      label="Opening year" />
            <SortLink current={sort} key_="name"        label="Name" />
          </div>
        </div>
        <div className="bg-ink-900 border border-ink-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-800/60 text-left text-[10px] uppercase tracking-widest text-ink-300">
              <tr>
                <th className="px-4 py-3">Stadium</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3 text-right">Capacity</th>
                <th className="px-4 py-3 text-right">Altitude</th>
                <th className="px-4 py-3 text-right">Opened</th>
                <th className="px-4 py-3">WC editions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} className="border-t border-ink-800/60 hover:bg-ink-800/30">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-white truncate">{s.name}</div>
                    <div className="text-[10px] text-ink-500">{s.city}{s.demolished ? ` · demolished ${s.demolished}` : ''}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <Flag country={s.country} />
                      <span className="text-ink-200">{s.country}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-200 text-xs">
                    {s.capacity != null ? s.capacity.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                    {typeof s.elevationM === 'number'
                      ? <span className={(s.elevationM ?? 0) >= 1500 ? 'text-accent-gold' : 'text-ink-200'}>
                          {s.elevationM.toLocaleString()} m
                        </span>
                      : <span className="text-ink-500">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-300 text-xs">
                    {s.opened ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-ink-300">
                    {s.tournaments.length === 0
                      ? <span className="text-ink-500">—</span>
                      : s.tournaments.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function sortStadiums(rows: ApiStadium[], by: string): ApiStadium[] {
  const list = [...rows];
  switch (by) {
    case 'capacity':
      return list.sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0));
    case 'altitude':
      return list.sort((a, b) => (b.elevationM ?? -1) - (a.elevationM ?? -1));
    case 'opened':
      return list.sort((a, b) => (a.opened ?? 9999) - (b.opened ?? 9999));
    case 'name':
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case 'tournaments':
    default:
      return list.sort((a, b) =>
        b.tournaments.length - a.tournaments.length ||
        (b.capacity ?? 0) - (a.capacity ?? 0),
      );
  }
}

function SortLink({ current, key_, label }: { current: string; key_: string; label: string }) {
  const active = current === key_;
  return (
    <Link
      href={`/stadiums/?sort=${key_}`}
      className={`px-2.5 py-1 rounded ${active ? 'bg-brand-600/20 border border-brand-500 text-brand-300' : 'text-ink-300 hover:text-ink-100 border border-transparent'}`}
    >
      {label}
    </Link>
  );
}

function Stat({ label, value, hint, flagCountry }: {
  label: string;
  value: string;
  hint?: string;
  flagCountry?: string;
}) {
  return (
    <div className="bg-ink-900/80 backdrop-blur border border-ink-800 rounded-xl p-4">
      <div className="text-2xl sm:text-3xl font-black text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-ink-300 mt-1">{label}</div>
      {hint && (
        <div className="text-[10px] text-ink-500 mt-0.5 truncate flex items-center gap-1" title={hint}>
          {flagCountry && <Flag country={flagCountry} />}
          <span className="truncate">{hint}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Year picker — same shape as the Players page. Empty selection
 * means "all years"; clicking adds, clicking again removes. The
 * URL stays clean when nothing's selected (no ?years= param at
 * all) so the canonical URL for "all stadiums" is just /stadiums/.
 */
function YearPicker({ years, allYears }: { years: number[]; allYears: number[] }) {
  const isActive = (y: number) => years.includes(y);
  function urlWith(y: number) {
    const next = isActive(y) ? years.filter((v) => v !== y) : [...years, y].sort();
    if (next.length === 0) return '/stadiums/';
    return `/stadiums/?years=${next.join(',')}`;
  }
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-ink-300">
          Tournament — click to filter ({years.length === 0 ? 'showing all years' : `${years.length} selected`})
        </div>
        {years.length > 0 && (
          <Link href="/stadiums/" className="text-[11px] text-brand-400 hover:underline">
            Clear
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {/* Decade-grouped, chronological. */}
        {groupYearsByDecade(allYears).map((g) => (
          <div key={g.decade}>
            <div className="text-[9px] uppercase tracking-widest text-ink-500 mb-1 font-mono">
              {decadeShort(g.decade)}
            </div>
            <div className="flex flex-wrap gap-1">
              {g.years.map((y) => (
                <Link
                  key={y}
                  href={urlWith(y)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                    isActive(y)
                      ? 'bg-brand-600/30 border border-brand-500 text-brand-200'
                      : 'bg-ink-800 border border-ink-700 text-ink-400 hover:text-ink-100'
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
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
