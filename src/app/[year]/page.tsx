/**
 * Per-tournament drill-down with rich charts.
 *
 * URL: /wc-explorer/<year>/
 *
 * Sections:
 *   - Hero (year, host, dates, edition + champion banner)
 *   - Big-number stats
 *   - Top scorers leaderboard + bar chart
 *   - Champion's road to the trophy (KO bracket trail)
 *   - Confederation breakdown donut
 *   - Trivia
 *   - Year-jump nav
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getTournament, listTournaments, topScorersForYear, getTriviaForYear,
  listMatchesByYear, listStadiums,
} from '@/lib/wc-api';
import { BarSeries, Donut, SERIES_COLORS } from '@/components/charts/Charts';
import { Flag } from '@/components/Flag';
import { StadiumMap, type StadiumMapPoint } from '@/components/StadiumMap';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const { year } = await params;
  const t = await getTournament(Number(year));
  if (!t) return { title: `World Cup ${year}` };
  const m = t.tournament;
  return {
    title: `${m.year} World Cup — ${m.host.join(' + ')}${m.champion ? ` · ${m.champion} won` : ''}`,
    description: `${m.year} FIFA World Cup in ${m.host.join(' + ')}. Champion: ${m.champion ?? 'TBD'}. ${m.teamsCount ?? '?'} teams · ${m.matchesCount ?? '?'} matches · ${m.totalGoals ?? '?'} goals.`,
  };
}

export default async function YearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const yearNum = Number(year);
  const [t, allTournaments, topScorers, trivia, matches, allStadiums] = await Promise.all([
    getTournament(yearNum),
    listTournaments(),
    topScorersForYear(yearNum, 12),
    getTriviaForYear(yearNum).catch(() => []),
    // Best-effort — older tournaments may not have full match data;
    // an empty list just hides the map.
    listMatchesByYear(yearNum).catch(() => []),
    listStadiums().catch(() => []),
  ]);
  if (!t) notFound();

  // Build stadium-map points: every venue used in this tournament,
  // joined with the global stadium index (for capacity/elevation/
  // coords) + per-stadium match counts derived from the match list.
  const stadiumIndex = new Map(allStadiums.map((s) => [s.id, s]));
  const matchesByStadium = new Map<string, number>();
  for (const m of matches) {
    if (!m.stadiumId) continue;
    matchesByStadium.set(m.stadiumId, (matchesByStadium.get(m.stadiumId) ?? 0) + 1);
  }
  const stadiumPoints: StadiumMapPoint[] = Array.from(matchesByStadium.entries())
    .map(([id, count]) => {
      const s = stadiumIndex.get(id);
      if (!s || !s.coords) return null;
      return {
        id:         s.id,
        name:       s.name,
        city:       s.city,
        country:    s.country,
        lat:        s.coords.lat,
        lng:        s.coords.long,
        capacity:   s.capacity,
        elevationM: s.elevationM ?? null,
        matchCount: count,
      };
    })
    .filter((p): p is StadiumMapPoint => p !== null)
    .sort((a, b) => b.matchCount - a.matchCount);

  const meta = t.tournament;
  const teams = t.teams ?? [];

  const champion = meta.champion ? teams.find((tm) => tm.name === meta.champion) : undefined;

  // Player-name → team-name index. Used to add flags next to award
  // recipients (Best Player, Best GK, Best Young, Top Scorer) — those
  // fields on the API are just the player name with no team. Single
  // pass over every squad on every team.
  const playerTeam = new Map<string, string>();
  for (const team of teams) {
    for (const p of team.squad ?? []) {
      // Some players appear in multiple tournaments; first-write-wins
      // is fine since this index is per-tournament.
      if (!playerTeam.has(p.name)) playerTeam.set(p.name, team.name);
      if (p.fullName && !playerTeam.has(p.fullName)) playerTeam.set(p.fullName, team.name);
    }
  }

  // Confederation breakdown
  const byConfed: Record<string, number> = {};
  for (const team of teams) {
    byConfed[team.confederation] = (byConfed[team.confederation] ?? 0) + 1;
  }
  const confederationDonut = Object.entries(byConfed)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Top-scorers chart
  const topScorersChart = topScorers.slice(0, 8).map((s) => ({
    label: s.name.split(' ').slice(-1)[0],
    value: s.goals,
  }));

  const idx = allTournaments.findIndex((x) => x.year === yearNum);
  const prev = idx > 0 ? allTournaments[idx - 1] : undefined;
  const next = idx >= 0 && idx < allTournaments.length - 1 ? allTournaments[idx + 1] : undefined;

  return (
    <>
      {/* Hero */}
      <section className="relative bg-grid border-b border-ink-800">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-700/15 via-ink-950/0 to-ink-950" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-6 py-12 sm:py-16">
          <div className="text-xs mb-4">
            <Link href="/" className="text-brand-400 hover:underline">← All tournaments</Link>
          </div>

          <div className="flex flex-wrap items-baseline gap-4">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white glow-brand">
              {meta.year}
            </h1>
            <div className="text-ink-300 text-sm">
              Edition #{meta.edition}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-base text-ink-100">
            {meta.host.map((h, i) => (
              <span key={h} className="inline-flex items-center gap-2">
                <Flag country={h} size={40} />
                <span className="font-semibold">{h}</span>
                {i < meta.host.length - 1 && <span className="text-ink-500">+</span>}
              </span>
            ))}
          </div>

          {meta.datesIso && (
            <div className="text-ink-300 text-sm mt-2">
              {meta.datesIso.start} → {meta.datesIso.end}
            </div>
          )}

          {meta.champion && (
            <div className="mt-6 inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-accent-gold/10 border border-accent-gold/40">
              <span className="text-3xl">🏆</span>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-accent-gold/80">Champion</div>
                <div className="text-xl font-bold text-accent-gold flex items-center gap-2">
                  <Flag country={meta.champion} size={40} />
                  <span>{meta.champion}</span>
                </div>
              </div>
            </div>
          )}

          {/* Big stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10">
            <Stat label="Teams" value={meta.teamsCount?.toString() ?? '—'} />
            <Stat label="Matches" value={meta.matchesCount?.toString() ?? '—'} />
            <Stat
              label="Total goals"
              value={meta.totalGoals?.toString() ?? '—'}
              hint={meta.matchesCount && meta.totalGoals
                ? `${(meta.totalGoals / meta.matchesCount).toFixed(2)}/match`
                : undefined}
            />
            <Stat
              label="Attendance"
              value={meta.totalAttendance?.toLocaleString() ?? '—'}
            />
          </div>
        </div>
      </section>

      {/* Podium row */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PodiumStep place={2} team={meta.runnerUp} />
          <PodiumStep place={1} team={meta.champion} />
          <PodiumStep place={3} team={meta.thirdPlace} />
        </div>
      </section>

      {/* Awards row */}
      {(meta.bestPlayer || meta.bestYoungPlayer || meta.bestGoalkeeper || meta.ballName || meta.mascot || meta.topScorer) && (
        <section className="max-w-7xl mx-auto px-6 pb-6">
          <h2 className="text-sm uppercase tracking-widest text-ink-300 mb-3">Awards &amp; marks</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {meta.topScorer && (
              <Award
                label="Top scorer"
                value={meta.topScorer.player}
                hint={`${meta.topScorer.goals} goals`}
                team={playerTeam.get(meta.topScorer.player)}
              />
            )}
            {meta.bestPlayer       && <Award label="Best player"  value={meta.bestPlayer}       team={playerTeam.get(meta.bestPlayer)} />}
            {meta.bestYoungPlayer  && <Award label="Best young"   value={meta.bestYoungPlayer}  team={playerTeam.get(meta.bestYoungPlayer)} />}
            {meta.bestGoalkeeper   && <Award label="Best GK"      value={meta.bestGoalkeeper}   team={playerTeam.get(meta.bestGoalkeeper)} />}
            {meta.ballName         && <Award label="Match ball"   value={meta.ballName} />}
            {meta.mascot           && <Award label="Mascot"       value={meta.mascot} />}
          </div>
        </section>
      )}

      {/* Notes */}
      {meta.notes && (
        <section className="max-w-7xl mx-auto px-6 pb-6">
          <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
            <h2 className="text-sm uppercase tracking-widest text-ink-300 mb-3">Notes</h2>
            <p className="text-sm text-ink-100 leading-relaxed">{meta.notes}</p>
          </div>
        </section>
      )}

      {/* Stadium map — interactive Google Maps with all venues used
          in this tournament. Marker color/size scales with capacity;
          info window shows match count + elevation. Hidden when the
          match list is empty (rare — older tournaments without per-
          match stadium data). */}
      {stadiumPoints.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-6">
          <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
            <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-bold text-white">Stadiums &amp; venues</h2>
                <div className="text-[11px] text-ink-300">
                  {stadiumPoints.length} venue{stadiumPoints.length === 1 ? '' : 's'} ·{' '}
                  {stadiumPoints.reduce((s, p) => s + p.matchCount, 0)} match{stadiumPoints.reduce((s, p) => s + p.matchCount, 0) === 1 ? '' : 'es'} ·{' '}
                  click any marker for details
                </div>
              </div>
              <Link href="/stadiums/" className="text-xs text-brand-400 hover:underline">
                All stadiums →
              </Link>
            </div>
            <StadiumMap
              points={stadiumPoints}
              height={420}
              hosts={meta.host}
            />
            {/* Compact list under the map for accessibility + quick scan. */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {stadiumPoints.map((p) => (
                <div key={p.id} className="px-3 py-2 bg-ink-950/40 border border-ink-800 rounded-lg flex items-center gap-2">
                  <Flag country={p.country} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">{p.name}</div>
                    <div className="text-[10px] text-ink-500 truncate">{p.city}</div>
                  </div>
                  <div className="text-right text-[10px] text-ink-300 font-mono tabular-nums">
                    <div>{p.matchCount} match{p.matchCount === 1 ? '' : 'es'}</div>
                    {p.capacity != null && <div className="text-ink-500">{p.capacity.toLocaleString()} cap</div>}
                    {p.elevationM != null && p.elevationM > 1000 && (
                      <div className="text-accent-gold/80">{p.elevationM.toLocaleString()}m alt</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-ink-800/60 text-[10px] font-mono text-ink-500">
              GET /matches?year={meta.year} · GET /stadiums
            </div>
          </div>
        </section>
      )}

      {/* Top scorers + Confederation breakdown */}
      <section className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {topScorers.length > 0 && (
          <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white">Top scorers</h2>
            <div className="text-[11px] text-ink-300 mb-4">Goals scored, top 12</div>
            <BarSeries
              data={topScorersChart}
              color={SERIES_COLORS.gold}
              valueLabel="goals"
              height={220}
            />
            <ol className="mt-4 space-y-1 text-sm">
              {topScorers.map((s, i) => (
                <li key={`${s.name}-${i}`} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-ink-800/40">
                  <span className="text-ink-500 font-mono w-5 text-right">{i + 1}.</span>
                  <Flag country={s.team} />
                  <span className="font-semibold text-white">{s.name}</span>
                  <span className="text-xs text-ink-300">{s.team}</span>
                  <span className="text-xs text-ink-500">· {s.position}</span>
                  <span className="ml-auto text-accent-gold font-bold tabular-nums">{s.goals}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {confederationDonut.length > 0 && (
          <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white">Confederation breakdown</h2>
            <div className="text-[11px] text-ink-300 mb-4">{teams.length} qualifying teams</div>
            <Donut data={confederationDonut} centerLabel={String(teams.length)} height={260} />
          </div>
        )}
      </section>

      {/* Champion's full road to the title — group stage through final.
          Falls back to the knockoutPath summary when match data isn't
          available (older tournaments). */}
      {champion && (
        <section className="max-w-7xl mx-auto px-6 pb-6">
          <div className="bg-ink-900 border border-accent-gold/30 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white">
              {champion.name}&apos;s road to the title
            </h2>
            <div className="text-[11px] text-ink-300 mb-4">
              Every match {champion.name} played, group stage through the final
            </div>
            <ChampionRoad
              championName={champion.name}
              matches={matches}
              fallback={champion.knockoutPath}
            />
          </div>
        </section>
      )}

      {/* Trivia */}
      {trivia.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-6">
          <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white">📚 Trivia</h2>
            <div className="text-[11px] text-ink-300 mb-4">{trivia.length} curated facts</div>
            <ul className="space-y-3">
              {trivia.map((f) => (
                <li key={f.id} className="text-sm leading-relaxed text-ink-100">
                  <span className="text-[10px] uppercase tracking-wider text-brand-400 mr-2">
                    {f.category}
                  </span>
                  {f.fact}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Year nav */}
      <section className="max-w-7xl mx-auto px-6 pb-12">
        <nav className="flex items-center justify-between border-t border-ink-800 pt-5 text-sm">
          {prev ? (
            <Link href={`/${prev.year}/`} className="text-brand-400 hover:underline inline-flex items-center gap-1.5">
              ← {prev.year} <Flag country={prev.host[0]} /> {prev.host[0]}
            </Link>
          ) : <span />}
          <Link href="/" className="text-ink-300 hover:text-brand-400">All tournaments</Link>
          {next ? (
            <Link href={`/${next.year}/`} className="text-brand-400 hover:underline inline-flex items-center gap-1.5">
              {next.year} <Flag country={next.host[0]} /> {next.host[0]} →
            </Link>
          ) : <span />}
        </nav>
      </section>
    </>
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

/**
 * Render the champion's complete road — every match they played
 * across the tournament, grouped by stage. Pulled from the per-
 * tournament match list rather than the team's knockoutPath
 * summary so we get group-stage games too.
 *
 * Falls back to the legacy knockoutPath display when no match data
 * is available (older tournaments without per-match records, or
 * when the API call fails). The fallback is the prior implementation.
 */
function ChampionRoad({
  championName, matches, fallback,
}: {
  championName: string;
  matches: import('@/lib/wc-api').ApiMatch[];
  fallback: import('@/lib/wc-api').ApiKnockoutMatch[];
}) {
  // Filter to matches the champion played — chronological ordering
  // by date (kickoff if present, falling back to date only).
  const championMatches = matches
    .filter((m) => m.homeTeam === championName || m.awayTeam === championName)
    .sort((a, b) =>
      (a.kickoffUtc ?? a.date).localeCompare(b.kickoffUtc ?? b.date),
    );

  if (championMatches.length === 0) {
    // Fallback: KO-only summary that ships with the team object.
    if (fallback.length === 0) {
      return <p className="text-sm text-ink-500">No match data on file.</p>;
    }
    return (
      <ol className="space-y-1.5 text-sm">
        {fallback.map((m, i) => (
          <li key={i} className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-lg bg-ink-950/40">
            <span className="text-[10px] text-ink-300 uppercase tracking-wider w-16">{stageLabel(m.stage)}</span>
            <span className="text-white font-semibold inline-flex items-center gap-1.5">
              vs <Flag country={m.opponent} /> {m.opponent}
            </span>
            <span className="ml-auto font-mono tabular-nums text-accent-gold font-bold">
              {m.result}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  // Compute champion's perspective per match.
  type View = {
    stage: string;
    opponent: string | null;
    score: string;
    outcome: 'W' | 'D' | 'L';
    extraTime: boolean;
    pens: { home: number; away: number } | null;
    date: string;
  };
  const rows: View[] = championMatches.map((m) => {
    const isHome = m.homeTeam === championName;
    const opp = isHome ? m.awayTeam : m.homeTeam;
    const us  = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
    const them = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);
    const outcome: 'W' | 'D' | 'L' = us > them ? 'W' : us < them ? 'L' : 'D';
    return {
      stage:    stageLabel(m.stage),
      opponent: opp,
      score:    `${us}–${them}`,
      outcome,
      extraTime: m.extraTime,
      pens:     m.penalties,
      date:     m.date,
    };
  });

  // Tally — wins / draws / losses + goals for / against. Group-stage
  // draws are common; champions with zero losses through the cup
  // jump out.
  const w = rows.filter((r) => r.outcome === 'W').length;
  const d = rows.filter((r) => r.outcome === 'D').length;
  const l = rows.filter((r) => r.outcome === 'L').length;
  const gf = championMatches.reduce((s, m) =>
    s + (m.homeTeam === championName ? (m.homeScore ?? 0) : (m.awayScore ?? 0)), 0);
  const ga = championMatches.reduce((s, m) =>
    s + (m.homeTeam === championName ? (m.awayScore ?? 0) : (m.homeScore ?? 0)), 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
        <span className="font-mono text-emerald-400">{w}W</span>
        <span className="font-mono text-ink-300">{d}D</span>
        <span className="font-mono text-red-400">{l}L</span>
        <span className="text-ink-500">·</span>
        <span className="font-mono text-accent-gold">
          {gf} <span className="text-ink-400">GF</span>
        </span>
        <span className="font-mono text-ink-300">
          {ga} <span className="text-ink-400">GA</span>
        </span>
        <span className="text-ink-500">·</span>
        <span className="text-ink-400">{championMatches.length} match{championMatches.length === 1 ? '' : 'es'}</span>
      </div>
      <ol className="space-y-1.5 text-sm">
        {rows.map((r, i) => {
          const outcomeColor =
            r.outcome === 'W' ? 'bg-emerald-700/20 border-emerald-700/40 text-emerald-300' :
            r.outcome === 'L' ? 'bg-red-700/20 border-red-700/40 text-red-300' :
                                'bg-ink-700/30 border-ink-600/40 text-ink-300';
          return (
            <li
              key={i}
              className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-lg bg-ink-950/40"
            >
              <span className="text-[10px] text-ink-300 uppercase tracking-wider w-20">{r.stage}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${outcomeColor}`}>
                {r.outcome}
              </span>
              <span className="text-white font-semibold inline-flex items-center gap-1.5">
                vs <Flag country={r.opponent ?? ''} /> {r.opponent ?? '—'}
              </span>
              <span className="text-[10px] text-ink-500 font-mono ml-2">{r.date}</span>
              <span className="ml-auto font-mono tabular-nums text-accent-gold font-bold">
                {r.score}
                {r.extraTime && <span className="text-[9px] text-amber-300 ml-1">AET</span>}
                {r.pens && (
                  <span className="text-[9px] text-amber-300 ml-1">
                    pens {r.pens.home}–{r.pens.away}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** Compact stage labeler. The wc-api stores raw values like
 *  "group_a", "r16", "final"; this normalizes to display strings. */
function stageLabel(stage: string): string {
  const s = stage.toLowerCase();
  if (s.startsWith('group')) {
    const m = s.match(/^group[_\s]*([a-h])/i);
    return m ? `Group ${m[1].toUpperCase()}` : 'Group';
  }
  if (s === 'r32' || s.includes('round_of_32')) return 'R32';
  if (s === 'r16' || s.includes('round_of_16')) return 'R16';
  if (s === 'qf'  || s.includes('quarter'))     return 'QF';
  if (s === 'sf'  || s.includes('semi'))        return 'SF';
  if (s.includes('third'))                       return '3rd-place';
  if (s === 'final' || /\bfinal\b/.test(s))     return 'Final';
  return stage;
}

function PodiumStep({ place, team }: { place: 1 | 2 | 3; team: string | null }) {
  if (!team) return null;
  const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';
  const label = place === 1 ? 'Champion' : place === 2 ? 'Runner-up' : 'Third';
  const order = place === 1 ? 'sm:order-2' : place === 2 ? 'sm:order-1' : 'sm:order-3';
  const featured = place === 1;
  return (
    <div className={`${order} bg-ink-900 border ${featured ? 'border-accent-gold/40' : 'border-ink-800'} rounded-2xl p-5 text-center`}>
      <div className="text-3xl">{medal}</div>
      <div className={`mt-2 flex items-center justify-center gap-2 ${featured ? 'text-2xl text-accent-gold font-black' : 'text-lg text-white font-bold'}`}>
        <Flag country={team} size={featured ? 40 : 20} />
        <span>{team}</span>
      </div>
      <div className="text-[10px] uppercase tracking-widest text-ink-300 mt-1">{label}</div>
    </div>
  );
}

function Award({ label, value, hint, team }: { label: string; value: string; hint?: string; team?: string }) {
  return (
    <div className="bg-ink-900 border border-ink-800 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-widest text-ink-300">{label}</div>
      <div className="text-sm font-semibold text-white mt-0.5 inline-flex items-center gap-1.5 max-w-full" title={team ? `${value} (${team})` : value}>
        {team && <Flag country={team} />}
        <span className="truncate">{value}</span>
      </div>
      {(hint || team) && (
        <div className="text-[10px] text-ink-500 mt-0.5 truncate">
          {[team, hint].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  );
}
