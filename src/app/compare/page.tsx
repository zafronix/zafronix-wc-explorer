/**
 * Side-by-side comparison view with chart visualizations.
 *
 * URL: /wc-explorer/compare/?years=1986,2022,2018
 *
 * The picker is a tiny client island; the page itself is server-rendered
 * so the charts ship pre-data. Multi-line charts overlay every selected
 * tournament so you can see "this is the highest scoring rate" at a glance
 * across multiple years.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { compareTournaments, listTournaments, getTournament } from '@/lib/wc-api';
import {
  BarSeries, SERIES_COLORS, PALETTE,
} from '@/components/charts/Charts';
import { Flag, HostFlags } from '@/components/Flag';
import { CompareYearsPicker } from './CompareYearsPicker';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Compare World Cups side-by-side',
  description: 'Pick any 2+ FIFA World Cup tournaments and see them charted side-by-side: total goals, goals per match, attendance, top scorers, champions.',
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ years?: string }>;
}) {
  const sp = await searchParams;
  const all = await listTournaments();
  const playedYears = all.filter((t) => t.champion).map((t) => t.year);

  const requested = sp.years
    ? sp.years.split(',').map((y) => Number(y.trim())).filter((y) => playedYears.includes(y))
    : [];

  // Default: 3 most-recent played
  // Min 1 — operator can render a single tournament in this layout
  // when they want the comparative table treatment for one year.
  const years = requested.length >= 1 ? requested : playedYears.slice(-3);

  const rows = await compareTournaments(years);
  // Server may return rows in any order; pin to the user's request order
  // for chart stability.
  rows.sort((a, b) => years.indexOf(a.year) - years.indexOf(b.year));

  // Build a player-name → team-name index across the selected
  // tournaments so the Top Scorer and Best Player cells in the
  // breakdown table can render with a flag. /compare gives us names
  // only; we resolve teams by walking each year's full squad.
  // Cached per-year at the API, so this is a warm round-trip.
  const fulls = await Promise.all(years.map((y) => getTournament(y).catch(() => null)));
  const playerTeam = new Map<string, string>();
  for (const t of fulls) {
    if (!t || !t.teams) continue;
    for (const team of t.teams) {
      for (const p of team.squad ?? []) {
        if (!playerTeam.has(p.name)) playerTeam.set(p.name, team.name);
        if (p.fullName && !playerTeam.has(p.fullName)) playerTeam.set(p.fullName, team.name);
      }
    }
  }

  // Chart data — every point carries host(s) so tooltips render
  // <flag> Country alongside the year + value.
  const goalsByYear = rows.map((r) => ({
    label: String(r.year), value: r.totalGoals ?? 0, host: r.host,
  }));
  const goalsPerMatch = rows.map((r) => ({
    label: String(r.year), value: Number((r.goalsPerMatch ?? 0).toFixed(2)), host: r.host,
  }));
  const attendanceByYear = rows.map((r) => ({
    label: String(r.year), value: r.totalAttendance ?? 0, host: r.host,
  }));
  const teamsByYear = rows.map((r) => ({
    label: String(r.year), value: r.teamsCount, host: r.host,
  }));

  const topScorerBars = rows.map((r) => ({
    label: r.topScorer ? `${r.topScorer.player.split(' ').slice(-1)[0]} (${r.year})` : String(r.year),
    value: r.topScorer?.goals ?? 0,
    host: r.host,
  }));

  // Side-by-side podiums
  const podiums = rows.map((r) => ({
    year: r.year,
    hosts: r.host,
    champion: r.champion,
    runnerUp: r.runnerUp,
    thirdPlace: r.thirdPlace,
    bestPlayer: r.bestPlayer,
  }));

  return (
    <>
      {/* Hero */}
      <section className="border-b border-ink-800 bg-grid">
        <div className="max-w-7xl mx-auto px-6 py-10 sm:py-12">
          <div className="text-xs mb-4">
            <Link href="/" className="text-brand-400 hover:underline">
              ← Overview
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Compare tournaments
          </h1>
          <p className="text-ink-300 text-sm mt-2 max-w-2xl">
            Pick any 2 or more World Cups. URL is shareable
            (<span className="font-mono text-brand-400">?years=1986,2022</span>).
            Powered by <span className="font-mono text-brand-400">GET /compare?years=…</span>
          </p>

          <CompareYearsPicker allYears={playedYears} active={years} />
        </div>
      </section>

      {rows.length < 1 ? (
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <p className="text-ink-300">Pick at least one tournament.</p>
        </div>
      ) : (
        <>
          {/* Podium row — quick visual comparison of who won what */}
          <section className="max-w-7xl mx-auto px-6 py-8">
            <h2 className="text-sm uppercase tracking-widest text-ink-300 mb-4">
              Champions, runners-up, third places
            </h2>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
            >
              {podiums.map((p, i) => (
                <div
                  key={p.year}
                  className="bg-ink-900 border border-ink-800 rounded-2xl p-5 lift"
                  style={{ borderTopColor: PALETTE[i % PALETTE.length], borderTopWidth: 3 }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/${p.year}/`}
                      className="text-2xl font-black text-white hover:text-brand-400"
                    >
                      {p.year}
                    </Link>
                    <HostFlags hosts={p.hosts} flagsOnly className="text-[10px]" />
                  </div>
                  <div className="text-[10px] text-ink-300 mt-0.5 truncate">{p.hosts.join(' / ')}</div>
                  <div className="mt-4 space-y-2 text-sm">
                    <Slot place="🏆 Champion"  team={p.champion}  highlight />
                    <Slot place="🥈 Runner-up" team={p.runnerUp} />
                    <Slot place="🥉 Third"     team={p.thirdPlace} />
                  </div>
                  {p.bestPlayer && (
                    <div className="mt-4 pt-3 border-t border-ink-800 text-[11px]">
                      <span className="text-ink-300">Best player: </span>
                      <span className="text-white font-semibold inline-flex items-center gap-1.5 align-middle">
                        {playerTeam.get(p.bestPlayer) && <Flag country={playerTeam.get(p.bestPlayer)} />}
                        <span>{p.bestPlayer}</span>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Charts row 1 */}
          <section className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Total goals"
              subtitle="Goals scored across the tournament"
            >
              <BarSeries data={goalsByYear} color={SERIES_COLORS.brand} valueLabel="goals" height={260} />
            </ChartCard>

            <ChartCard
              title="Goals per match"
              subtitle="Scoring rate"
            >
              <BarSeries data={goalsPerMatch} color={SERIES_COLORS.gold} valueLabel="goals/match" height={260} />
            </ChartCard>
          </section>

          {/* Charts row 2 */}
          <section className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Total attendance"
              subtitle="Fans through the gates"
            >
              <BarSeries data={attendanceByYear} color={SERIES_COLORS.cyan} valueLabel="attendance" height={260} />
            </ChartCard>

            <ChartCard
              title="Tournament size"
              subtitle="Qualifying teams"
            >
              <BarSeries data={teamsByYear} color={SERIES_COLORS.green} valueLabel="teams" height={260} />
            </ChartCard>
          </section>

          {/* Top scorer comparison */}
          <section className="max-w-7xl mx-auto px-6 pb-6">
            <ChartCard
              title="Top scorer per tournament"
              subtitle="Goals scored by the Golden-Boot winner"
            >
              <BarSeries data={topScorerBars} color={SERIES_COLORS.pink} valueLabel="goals" height={240} />
            </ChartCard>
          </section>

          {/* Detail table */}
          <section className="max-w-7xl mx-auto px-6 pb-12">
            <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5 overflow-x-auto">
              <h2 className="text-sm font-bold text-white mb-4">Full breakdown</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-[10px] uppercase tracking-widest text-ink-300">
                    <th className="text-left py-2 px-2">Metric</th>
                    {rows.map((r) => (
                      <th key={r.year} className="text-left py-2 px-2 text-white text-sm font-bold">
                        <Link href={`/${r.year}/`} className="hover:text-brand-400">{r.year}</Link>
                        <div className="text-[10px] text-ink-300 font-normal flex items-center gap-1 mt-0.5">
                          <HostFlags hosts={r.host} flagsOnly />
                          <span className="truncate">{r.host.join(' / ')}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  <Row label="Edition"           rows={rows} get={(r) => `#${r.edition}`} />
                  <Row label="Champion"          rows={rows} getNode={(r) => <CountryCell name={r.champion} />} highlight />
                  <Row label="Runner-up"         rows={rows} getNode={(r) => <CountryCell name={r.runnerUp} />} />
                  <Row label="Third place"       rows={rows} getNode={(r) => <CountryCell name={r.thirdPlace} />} />
                  <Row label="Teams"             rows={rows} get={(r) => String(r.teamsCount)} numeric />
                  <Row label="Matches"           rows={rows} get={(r) => String(r.matchesCount)} numeric />
                  <Row label="Total goals"       rows={rows} get={(r) => r.totalGoals != null ? String(r.totalGoals) : '—'} numeric />
                  <Row label="Goals / match"     rows={rows} get={(r) => r.goalsPerMatch != null ? r.goalsPerMatch.toFixed(2) : '—'} numeric />
                  <Row label="Top scorer"        rows={rows} getNode={(r) =>
                    r.topScorer
                      ? <PlayerCell name={r.topScorer.player} suffix={` (${r.topScorer.goals})`} team={playerTeam.get(r.topScorer.player)} />
                      : <span className="text-ink-500">—</span>}
                  />
                  <Row label="Best player"       rows={rows} getNode={(r) =>
                    r.bestPlayer
                      ? <PlayerCell name={r.bestPlayer} team={playerTeam.get(r.bestPlayer)} />
                      : <span className="text-ink-500">—</span>}
                  />
                  <Row label="Total attendance"  rows={rows} get={(r) => r.totalAttendance != null ? r.totalAttendance.toLocaleString() : '—'} numeric />
                  <Row label="Avg attendance"    rows={rows} get={(r) => r.avgAttendance != null ? r.avgAttendance.toLocaleString() : '—'} numeric />
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Slot({ place, team, highlight }: { place: string; team: string | null; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-ink-300">{place}</span>
      <span className={`text-sm ${highlight ? 'text-accent-gold font-bold' : 'text-white font-medium'} truncate text-right inline-flex items-center gap-1.5`}>
        {team ? <Flag country={team} /> : null}
        <span>{team ?? '—'}</span>
      </span>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: {
  title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <div className="text-[11px] text-ink-300">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

import type { ApiCompareRow } from '@/lib/wc-api';

function Row({
  label, rows, get, getNode, highlight, numeric,
}: {
  label: string;
  rows: ApiCompareRow[];
  /** Renders a string value into the cell. Use for numbers, plain
   *  text, or anything that doesn't need flags. Mutually exclusive
   *  with getNode. */
  get?: (r: ApiCompareRow) => string;
  /** Renders a React node into the cell. Use for country cells
   *  (champion / runner-up / third place) where we want a flag. */
  getNode?: (r: ApiCompareRow) => React.ReactNode;
  highlight?: boolean;
  numeric?: boolean;
}) {
  return (
    <tr className="hover:bg-ink-800/30">
      <td className="py-2 px-2 text-[11px] uppercase tracking-wider text-ink-300 whitespace-nowrap">
        {label}
      </td>
      {rows.map((r) => (
        <td
          key={r.year}
          className={`py-2 px-2 text-sm ${
            highlight ? 'text-accent-gold font-bold' : 'text-white'
          } ${numeric ? 'font-mono tabular-nums' : ''}`}
        >
          {getNode ? getNode(r) : (get ? get(r) : '—')}
        </td>
      ))}
    </tr>
  );
}

/**
 * Country cell with inline flag — used for champion / runner-up / third-
 * place rows of the comparison table. Falls back to em-dash when null.
 */
function CountryCell({ name }: { name: string | null }) {
  if (!name) return <span className="text-ink-500">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Flag country={name} />
      <span>{name}</span>
    </span>
  );
}

/**
 * Player cell with the team flag on the left. The `team` is resolved
 * upstream by walking the tournament's squads — when the lookup
 * misses (rare; player named under a non-canonical form) we still
 * render the name without a flag so the row stays informative.
 */
function PlayerCell({ name, team, suffix }: { name: string; team?: string; suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {team && <Flag country={team} />}
      <span>{name}{suffix ?? ''}</span>
    </span>
  );
}
