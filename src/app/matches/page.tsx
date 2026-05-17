/**
 * Matches view — every World Cup match, browsable + filterable.
 *
 * URL: /wc-explorer/matches/?year=YYYY&stage=STAGE
 *
 * Phase-1 scope (this file):
 *   - Year picker (defaults to most-recent played tournament)
 *   - Stage filter (group / r16 / quarter / semi / final / all)
 *   - Sortable table: date · stage · home/away · score · attendance · stadium
 *   - Knockout dramatic-finish flags (AET, pens)
 *
 * Future enrichment (separate PRs):
 *   - Weather at kickoff (Open-Meteo historical, free, 1940+)
 *   - Goals-by-minute bucket
 *   - Days of rest per team
 *   - Captain per match
 *   - Per-match referee breakdown
 *   - Penalty shootout granularity (every kick, kicker, GK)
 *
 * Data source: GET /matches?year=YYYY plus listTournaments() for the
 * year picker chips. All revalidate 24h.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { listTournaments, listMatchesByYear, listStadiums, type ApiMatch, type ApiStadium } from '@/lib/wc-api';
import { Flag } from '@/components/Flag';
import { SionoPollEmbed } from '@/components/SionoPollEmbed';
import { TournamentSelector } from '@/components/TournamentSelector';
import { tzShift } from '@/lib/country-tz';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Matches — every World Cup result, 1930→latest',
  description: 'Browse every World Cup match: date, stage, teams, scores, attendance, venue. Filter by tournament + stage. 1,168+ matches from 1930 to 2022 plus the 2026 schedule.',
  keywords: ['world cup matches', 'world cup results', 'world cup match by match', 'world cup 2026 fixtures', 'fifa world cup results history'],
  alternates: { canonical: '/matches/' },
};

interface PageProps {
  searchParams: Promise<{ year?: string; stage?: string }>;
}

// Canonical stage labels. The wc-api emits raw stage codes like
// `group_a`, `round_of_16`, `quarter_final`, etc. We group them for
// UI sanity into 5 buckets.
const STAGE_BUCKETS: Record<string, { label: string; matches: (s: string) => boolean }> = {
  all:    { label: 'All',          matches: () => true },
  group:  { label: 'Group stage',  matches: (s) => s.startsWith('group_') },
  r32:    { label: 'Round of 32',  matches: (s) => s === 'round_of_32' },
  r16:    { label: 'Round of 16',  matches: (s) => s === 'round_of_16' },
  qf:     { label: 'Quarterfinals', matches: (s) => s === 'quarter_final' },
  sf:     { label: 'Semifinals',   matches: (s) => s === 'semi_final' },
  third:  { label: 'Third place',  matches: (s) => s === 'third_place' },
  final:  { label: 'Final',        matches: (s) => s === 'final' },
};

const STAGE_LABEL: Record<string, string> = {
  round_of_32:    'R32',
  round_of_16:    'R16',
  quarter_final:  'QF',
  semi_final:     'SF',
  third_place:    '3rd',
  final:          'F',
};

function shortStage(raw: string): string {
  if (raw.startsWith('group_')) return `Grp ${raw.slice(6).toUpperCase()}`;
  return STAGE_LABEL[raw] ?? raw;
}

function isKnockout(raw: string): boolean {
  return !raw.startsWith('group_');
}

/** Great-circle distance in km between two lat/long pairs.
 *  6371 km = mean Earth radius. Accurate to ~0.5% across a single
 *  great circle, plenty for tournament-logistics summaries. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function formatDate(iso: string): string {
  // "2022-12-18" → "Dec 18, 2022"
  try {
    const [y, m, d] = iso.split('-').map(Number);
    const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1] ?? '?';
    return `${monthName} ${d}, ${y}`;
  } catch { return iso; }
}

export default async function MatchesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tournaments = await listTournaments();
  const playedYears = tournaments.filter((t) => t.champion).map((t) => t.year);
  const upcomingYears = tournaments.filter((t) => !t.champion).map((t) => t.year);
  // Ascending — operator reads time left-to-right as the canon for
  // history. The earlier reverse-chronological default felt off when
  // jumping deep into the past.
  const allYears = [...playedYears, ...upcomingYears].sort((a, b) => a - b);

  // Default to the most recent played tournament. The 2026 page is
  // accessible via the chip but doesn't auto-default until it has
  // results — empty match tables are a bad first impression.
  const defaultYear = playedYears[playedYears.length - 1] ?? 2022;
  const year = Number(sp.year) || defaultYear;
  const stageBucket = sp.stage && STAGE_BUCKETS[sp.stage] ? sp.stage : 'all';
  const stageFilter = STAGE_BUCKETS[stageBucket]!;

  // Pull matches for the year + stadiums (for coord-based distance
  // calculation). Both share the 24h fetch cache so the warm path is
  // sub-millisecond.
  const [matchesRaw, allStadiums]: [ApiMatch[], ApiStadium[]] = await Promise.all([
    listMatchesByYear(year).catch<ApiMatch[]>(() => []),
    listStadiums().catch<ApiStadium[]>(() => []),
  ]);
  const matches = matchesRaw.filter((m) => stageFilter.matches(m.stage));

  // ─── Team logistics — days-of-rest + distance traveled ────────────
  //
  // Days of rest: gap in days between this team's previous match and
  // this one. Compute by sorting each team's match list ascending,
  // diffing kickoff dates.
  //
  // Distance traveled: sum of great-circle distances between each
  // pair of consecutive stadiums in the team's match sequence. First
  // match counts 0km (we don't know their home anchor; using
  // capital-city would overweight teams whose camp wasn't at the
  // capital). Pure stadium-to-stadium = honest, repeatable, no fake
  // anchor.
  const stadiumById = new Map<string, ApiStadium>();
  for (const s of allStadiums) stadiumById.set(s.id, s);

  type TeamLog = {
    team:          string;
    matches:       number;
    restDays:      number[];      // gap before each match (entry 0 = 0 by convention)
    avgRest:       number | null;
    minRest:       number | null;
    distanceKm:    number;
    stadiums:      string[];      // visited, in order
    /** Max time-zone shift (in hours) the team experienced at any
     *  match venue vs their home country's TZ. Null when we don't
     *  have a TZ mapping for either side. */
    maxTzShift:    number | null;
  };

  const teamLogs = new Map<string, TeamLog>();
  // Build per-team chronological match list across ALL matches in the
  // tournament (not just the filtered subset — logistics is a
  // tournament-wide story).
  const byTeam = new Map<string, ApiMatch[]>();
  for (const m of matchesRaw) {
    for (const team of [m.homeTeam, m.awayTeam]) {
      if (!team) continue;
      // Trim — early 2014 data has leading/trailing whitespace in
      // team names ("Germany " vs "Germany") which would silently
      // split a team's match list into two undercounted entries.
      const key = team.trim();
      const arr = byTeam.get(key) ?? [];
      arr.push(m);
      byTeam.set(key, arr);
    }
  }

  for (const [team, list] of byTeam) {
    const sorted = list
      .filter((m) => m.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length === 0) continue;

    const restDays: number[] = [];
    let distanceKm = 0;
    const stadiums: string[] = [];
    let prevDate: Date | null = null;
    let prevStadium: ApiStadium | null = null;
    for (const m of sorted) {
      const date = new Date(m.date);
      if (prevDate) {
        const diffMs = date.getTime() - prevDate.getTime();
        restDays.push(Math.round(diffMs / 86_400_000) - 1);
      } else {
        restDays.push(0);  // first match — no prior to compare
      }
      const stadium = m.stadiumId ? stadiumById.get(m.stadiumId) : null;
      if (stadium && prevStadium && stadium.id !== prevStadium.id) {
        distanceKm += haversineKm(
          prevStadium.coords.lat, prevStadium.coords.long,
          stadium.coords.lat,     stadium.coords.long,
        );
      }
      if (stadium) {
        stadiums.push(stadium.city ?? stadium.name);
        prevStadium = stadium;
      }
      prevDate = date;
    }

    // avg/min rest computed across the gaps that actually represent
    // a rest period (skip the leading 0).
    const realRests = restDays.slice(1);

    // Max TZ shift across all venues the team played at. Uses the
    // stadium's country (not its precise coords). Skip nulls so we
    // still surface a number when at least one venue resolves.
    let maxTzShift: number | null = null;
    for (const m of sorted) {
      const sid = m.stadiumId;
      if (!sid) continue;
      const stadium = stadiumById.get(sid);
      if (!stadium) continue;
      const shift = tzShift(stadium.country, team);
      if (shift == null) continue;
      if (maxTzShift == null || shift > maxTzShift) maxTzShift = shift;
    }

    teamLogs.set(team, {
      team,
      matches: sorted.length,
      restDays,
      avgRest: realRests.length > 0
        ? Math.round((realRests.reduce((s, x) => s + x, 0) / realRests.length) * 10) / 10
        : null,
      minRest: realRests.length > 0 ? Math.min(...realRests) : null,
      distanceKm: Math.round(distanceKm),
      stadiums,
      maxTzShift,
    });
  }

  // Sort logistics by distance traveled (descending) — the operator
  // is usually curious which teams flew the most for their result.
  const logistics = [...teamLogs.values()].sort((a, b) => b.distanceKm - a.distanceKm);

  // Build a rest-day lookup by (matchId, team) for the per-row badge.
  const restByMatchTeam = new Map<string, number>();
  for (const log of teamLogs.values()) {
    let prev: ApiMatch | null = null;
    const sorted = (byTeam.get(log.team) ?? [])
      .filter((m) => m.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    for (const m of sorted) {
      if (prev) {
        const days = Math.round((new Date(m.date).getTime() - new Date(prev.date).getTime()) / 86_400_000) - 1;
        restByMatchTeam.set(`${m.id}|${log.team}`, days);
      }
      prev = m;
    }
  }

  // Aggregate stats for the hero strip.
  const totalGoals = matches.reduce(
    (s, m) => s + (m.homeScore ?? 0) + (m.awayScore ?? 0), 0,
  );
  const totalAttendance = matches.reduce((s, m) => s + (m.attendance ?? 0), 0);
  const dramaticFinishes = matches.filter((m) => m.extraTime || m.penalties).length;

  const tournament = tournaments.find((t) => t.year === year);

  return (
    <>
      {/* Hero */}
      <section className="border-b border-ink-800 bg-grid">
        <div className="max-w-7xl mx-auto px-6 py-10 sm:py-12">
          <div className="text-xs mb-4">
            <Link href="/" className="text-brand-400 hover:underline">← Overview</Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            <span className="text-white">Matches,</span>{' '}
            <span className="text-brand-400">every kick.</span>
          </h1>
          <p className="text-ink-300 text-sm mt-2 max-w-2xl">
            Every World Cup match in a single table — date, stage, teams, score, attendance, venue.
            Pick a tournament + stage. Knockout dramatic finishes (AET, penalties) are flagged.
          </p>

          {/* Year strip — defaults to most recent played; future years
              that don't have results yet (2026) stay reachable. */}
          <TournamentSelector
            years={allYears}
            playedYears={playedYears}
            activeYear={year}
            buildHref={(y) => {
              const params = new URLSearchParams({ year: String(y) });
              if (stageBucket !== 'all') params.set('stage', stageBucket);
              return `/matches/?${params.toString()}`;
            }}
          />

          {/* Stage filter — pill row under the year picker. */}
          <StageFilter active={stageBucket} year={year} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            <Stat
              label="Matches"
              value={matches.length.toLocaleString()}
              hint={STAGE_BUCKETS[stageBucket]?.label.toLowerCase() ?? ''}
            />
            <Stat
              label="Goals"
              value={totalGoals.toLocaleString()}
              hint={matches.length > 0 ? `${(totalGoals / matches.length).toFixed(2)}/match` : '—'}
            />
            <Stat
              label="Attendance"
              value={totalAttendance >= 1_000_000
                ? `${(totalAttendance / 1_000_000).toFixed(2)}M`
                : totalAttendance.toLocaleString()}
              hint={matches.length > 0 ? `${Math.round(totalAttendance / matches.length).toLocaleString()}/match` : '—'}
            />
            <Stat
              label="Dramatic finishes"
              value={dramaticFinishes.toString()}
              hint="AET + penalties"
            />
          </div>
        </div>
      </section>

      {/* Siono poll — contextually tagged for the visible year. The
          year pages already carry this; matches page reuses the same
          tag so a wc-{year} poll surfaces on either route. */}
      <section className="max-w-7xl mx-auto px-6 pt-8 pb-2">
        <SionoPollEmbed
          context={{ tournament: `wc-${year}` }}
          eyebrow="Fan poll · powered by Siono"
        />
      </section>

      {/* Match table */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        {matches.length === 0 ? (
          <div className="bg-ink-900 border border-ink-800 rounded-2xl p-10 text-center text-ink-400">
            <div className="text-4xl mb-3 opacity-40">⚽</div>
            <p className="text-sm">
              {tournament && !tournament.champion
                ? `${year} is upcoming — fixtures will appear here once published by FIFA.`
                : `No matches recorded for ${year} in this stage filter.`}
            </p>
          </div>
        ) : (
          <div className="bg-ink-900 border border-ink-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-800/80 text-left text-[10px] uppercase tracking-widest text-ink-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Stage</th>
                    <th className="px-4 py-3 font-semibold">Match</th>
                    <th className="px-4 py-3 font-semibold text-center">Score</th>
                    <th className="px-4 py-3 font-semibold">Venue</th>
                    <th className="px-4 py-3 font-semibold text-right">Att.</th>
                    <th className="px-4 py-3 font-semibold text-right" title="Kickoff weather — temperature + condition. Backfilled from Open-Meteo, 1940+ coverage.">Weather</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m, i) => (
                    <MatchRow
                      key={`${m.id ?? m.matchNo ?? i}`}
                      m={m}
                      homeRest={restByMatchTeam.get(`${m.id}|${m.homeTeam?.trim() ?? ''}`)}
                      awayRest={restByMatchTeam.get(`${m.id}|${m.awayTeam?.trim() ?? ''}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-ink-800 text-[10px] font-mono text-ink-500">
              GET /matches?year={year}
              {stageBucket !== 'all' ? `  · client-side stage filter: ${stageBucket}` : ''}
            </div>
          </div>
        )}
      </section>

      {/* Team logistics — derived per-team summary across the
          whole tournament. Distance is honest stadium-to-stadium
          (no fake "home anchor" so the leader doesn't get
          double-billed for international travel). */}
      {logistics.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-10">
          <div className="bg-ink-900 border border-ink-800 rounded-2xl overflow-hidden">
            <header className="px-5 py-3 border-b border-ink-800/60 flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-white">Team logistics — {year}</h2>
              <span className="text-[10px] text-ink-500 font-mono">
                {logistics.length} teams · sorted by distance
              </span>
            </header>
            <p className="px-5 py-2 text-[11px] text-ink-400 border-b border-ink-800/60">
              Distance is stadium-to-stadium between consecutive matches, great-circle (haversine).
              First match counts 0 km — we don&apos;t guess a pre-tournament anchor. Rest days = full days
              between consecutive kickoffs (so a Mon → Fri turnaround is 3 days of rest).
              TZ shift = max hours offset between any venue&apos;s country and the team&apos;s home country.
              Multi-zone countries (USA, Brazil, Russia) use their capital city as proxy. DST ignored.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-800/40 text-left text-[10px] uppercase tracking-widest text-ink-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Team</th>
                    <th className="px-4 py-2 font-semibold text-right">Matches</th>
                    <th className="px-4 py-2 font-semibold text-right">Distance</th>
                    <th className="px-4 py-2 font-semibold text-right" title="Max time-zone shift from team's home TZ at any venue. 0 = local, ≥3h = real jet lag.">TZ shift</th>
                    <th className="px-4 py-2 font-semibold text-right">Avg rest</th>
                    <th className="px-4 py-2 font-semibold text-right">Min rest</th>
                    <th className="px-4 py-2 font-semibold">Cities visited</th>
                  </tr>
                </thead>
                <tbody>
                  {logistics.map((log) => (
                    <tr key={log.team} className="border-t border-ink-800/60 hover:bg-ink-800/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Flag country={log.team} />
                          <span className="text-ink-100 font-medium">{log.team}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink-200 tabular-nums">{log.matches}</td>
                      <td className="px-4 py-2.5 text-right text-ink-100 font-mono tabular-nums">
                        {log.distanceKm.toLocaleString()} km
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                        {log.maxTzShift == null ? (
                          <span className="text-ink-600">—</span>
                        ) : log.maxTzShift === 0 ? (
                          <span className="text-emerald-400/80" title="Local time zone — no jet lag">0h</span>
                        ) : log.maxTzShift < 3 ? (
                          <span className="text-ink-300" title="Minor adjustment">{log.maxTzShift}h</span>
                        ) : log.maxTzShift < 6 ? (
                          <span className="text-amber-400/80" title="Real jet lag">{log.maxTzShift}h</span>
                        ) : (
                          <span className="text-red-400/80" title="Continental crossing">{log.maxTzShift}h</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink-300 tabular-nums">
                        {log.avgRest != null ? `${log.avgRest.toFixed(1)}d` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink-300 tabular-nums">
                        {log.minRest != null ? `${log.minRest}d` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-ink-400 truncate max-w-md">
                        {Array.from(new Set(log.stadiums)).join(' → ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-ink-800 text-[10px] font-mono text-ink-500">
              Derived client-side from <span className="text-brand-400">GET /matches?year={year}</span> + <span className="text-brand-400">GET /stadiums</span>
            </div>
          </div>
        </section>
      )}

      {/* Enrichment hint — be honest about what's coming. */}
      <section className="max-w-7xl mx-auto px-6 pb-12">
        <div className="bg-ink-900/60 border border-ink-800 rounded-xl p-5">
          <p className="text-xs text-ink-300 leading-relaxed">
            <span className="text-brand-400 font-semibold">Coming next:</span>{' '}
            goals-by-minute bucket, captain per match, and penalty-shootout
            granularity. Subscribe to the API to get the extra fields as they ship.
          </p>
        </div>
      </section>
    </>
  );
}

function StageFilter({ active, year }: { active: string; year: number }) {
  const ORDER: Array<keyof typeof STAGE_BUCKETS> = [
    'all', 'group', 'r32', 'r16', 'qf', 'sf', 'third', 'final',
  ];
  function urlWith(stage: string): string {
    const params = new URLSearchParams({ year: String(year) });
    if (stage !== 'all') params.set('stage', stage);
    return `/matches/?${params.toString()}`;
  }
  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase tracking-widest text-ink-300 mb-2">Stage</div>
      <div className="flex flex-wrap gap-1">
        {ORDER.map((key) => {
          const isActive = key === active;
          const label = STAGE_BUCKETS[key]?.label ?? key;
          return (
            <Link
              key={key}
              href={urlWith(key)}
              className={`px-2.5 py-1 rounded text-[11px] ${
                isActive
                  ? 'bg-brand-600/30 border border-brand-500 text-brand-200 font-semibold'
                  : 'bg-ink-800 border border-ink-700 text-ink-400 hover:text-ink-100'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-ink-900/60 border border-ink-800 rounded-xl px-4 py-3">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-ink-300 mt-1">{label}</div>
      {hint && <div className="text-[10px] text-ink-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function RestBadge({ days }: { days?: number }) {
  if (days == null || days <= 0) return null;
  // Color-band rest days: <3 short turnaround, 3-4 normal, 5+ long rest.
  const tone = days < 3
    ? 'text-amber-400/80 border-amber-500/30 bg-amber-500/10'
    : days < 5
      ? 'text-ink-400 border-ink-700 bg-ink-800/40'
      : 'text-emerald-400/80 border-emerald-500/30 bg-emerald-500/10';
  return (
    <span
      className={`inline-block text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded border ${tone}`}
      title={`${days} day${days === 1 ? '' : 's'} rest since previous match`}
    >
      {days}d
    </span>
  );
}

function MatchRow({
  m, homeRest, awayRest,
}: {
  m: ApiMatch;
  homeRest?: number;
  awayRest?: number;
}) {
  const ko = isKnockout(m.stage);
  const stageDisplay = shortStage(m.stage);
  const home = m.homeTeam ?? '—';
  const away = m.awayTeam ?? '—';
  const hasResult = m.homeScore != null && m.awayScore != null;
  // Rich-detail indicator — show a small "details" badge when we
  // have goals/captains/shootout data so the operator knows there's
  // more to expand. We can't actually expand inline server-side
  // (no client interaction here); this signals where the data exists
  // and points to the year page or the API. Keep this passive for now.
  const hasGoals = (m.goals?.length ?? 0) > 0;
  const hasShootout = m.penaltyShootout != null;
  const hasCaptains = m.captains != null;
  return (
    <tr className="border-t border-ink-800/60 hover:bg-ink-800/30">
      <td className="px-4 py-3 text-ink-300 text-xs whitespace-nowrap">{formatDate(m.date)}</td>
      <td className="px-4 py-3">
        <span className={`inline-block text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded ${
          ko
            ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
            : 'bg-ink-700/40 text-ink-300 border border-ink-700'
        }`}>{stageDisplay}</span>
      </td>
      <td className="px-4 py-3">
        <Link href={`/matches/${m.id}/`} className="flex items-center gap-2 text-ink-100 hover:text-brand-300">
          {home !== '—' && <Flag country={home} />}
          <span className="font-medium truncate">{home}</span>
          <RestBadge days={homeRest} />
          <span className="text-ink-500 px-1">vs</span>
          {away !== '—' && <Flag country={away} />}
          <span className="font-medium truncate">{away}</span>
          <RestBadge days={awayRest} />
          {(hasGoals || hasShootout || hasCaptains) && (
            <span
              className="ml-1 text-[9px] uppercase tracking-widest text-brand-400 font-semibold"
              title={[
                hasGoals && `${m.goals!.length} goal events`,
                hasCaptains && 'captains',
                hasShootout && 'penalty shootout',
              ].filter(Boolean).join(' · ')}
            >
              ✦ details
            </span>
          )}
        </Link>
      </td>
      <td className="px-4 py-3 text-center">
        {hasResult ? (
          <div>
            <span className="font-mono tabular-nums text-white">
              {m.homeScore}–{m.awayScore}
            </span>
            {m.extraTime && (
              <span className="ml-1 text-[9px] text-amber-300 font-semibold uppercase tracking-wider">
                AET
              </span>
            )}
            {m.penalties && (
              <span className="ml-1 text-[9px] text-amber-400 font-mono">
                ({m.penalties.home}–{m.penalties.away} p)
              </span>
            )}
          </div>
        ) : (
          <span className="text-ink-600 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-ink-300 truncate">
        {m.stadium}{m.city ? <span className="text-ink-500">, {m.city}</span> : null}
      </td>
      <td className="px-4 py-3 text-right text-ink-300 tabular-nums text-xs">
        {m.attendance != null ? m.attendance.toLocaleString() : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <WeatherCell weather={m.weather} />
      </td>
    </tr>
  );
}

/** Compact weather pill. Renders just temperature + an emoji glyph
 *  based on the WMO weather code. Null weather (pre-1940 coverage)
 *  renders as a muted dash so the column doesn't visually flicker. */
function WeatherCell({ weather }: { weather: ApiMatch['weather'] }) {
  if (!weather || weather.tempC == null) {
    return <span className="text-ink-600 text-xs">—</span>;
  }
  const t = weather.tempC;
  const glyph = weatherGlyph(weather.code);
  return (
    <span
      className="inline-flex items-center gap-1 text-xs tabular-nums text-ink-200"
      title={[
        `${Math.round(t)}°C / ${Math.round(t * 9 / 5 + 32)}°F`,
        weather.humidityPct != null ? `${Math.round(weather.humidityPct)}% humidity` : null,
        weather.precipitationMm != null && weather.precipitationMm > 0
          ? `${weather.precipitationMm}mm precip`
          : null,
        weather.windKmh != null ? `${Math.round(weather.windKmh)} km/h wind` : null,
      ].filter(Boolean).join(' · ')}
    >
      <span>{glyph}</span>
      <span>{Math.round(t)}°</span>
    </span>
  );
}

/** WMO weather codes → emoji. https://open-meteo.com/en/docs */
function weatherGlyph(code: number | null | undefined): string {
  if (code == null) return '·';
  if (code === 0)              return '☀️';   // clear
  if (code <= 3)               return '⛅';   // partly cloudy
  if (code <= 49)              return '🌫️';   // fog
  if (code <= 65)              return '🌧️';   // rain
  if (code <= 77)              return '❄️';   // snow
  if (code <= 86)              return '🌨️';   // sleet / snow showers
  if (code >= 95)              return '⛈️';   // thunderstorm
  return '·';
}
