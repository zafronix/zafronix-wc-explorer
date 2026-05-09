/**
 * Teams view — cross-tournament team analysis.
 *
 * URL: /wc-explorer/teams/
 *
 * Sections:
 *   - Hero: distinct nations who've played, total appearances,
 *           first-time WC entrants over time
 *   - Most appearances leaderboard
 *   - Confederation distribution donut (across history)
 *   - Debutants by tournament — the "first appearance" timeline
 *   - Active streak: current appearance run for each country
 *
 * Data is computed client-side (server-rendered) by parallel-
 * fetching every played tournament. 24 tournaments × ~50ms
 * per-tournament cached fetch ≈ 60ms wall time with Promise.all.
 *
 * Live tournament (2026, no champion yet) is excluded from "most
 * appearances" since the team list isn't final until the squad
 * deadline.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { listTournaments, getTournament } from '@/lib/wc-api';
import { Flag } from '@/components/Flag';
import { BarSeries, Donut, SERIES_COLORS } from '@/components/charts/Charts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Teams — every nation that ever played a World Cup',
  description: 'Cross-tournament analysis: most appearances, confederation breakdown, debutants over time, and current streaks for every country to ever appear in a FIFA World Cup.',
};

interface TeamRecord {
  name:           string;
  iso:            string;
  confederation:  string;
  appearances:    number[];   // years
  firstYear:      number;
  lastYear:       number;
  bestFinish:     number | null;
  bestFinishYear: number | null;
}

export default async function TeamsPage() {
  const tournaments = await listTournaments();
  const playedYears = tournaments.filter((t) => t.champion).map((t) => t.year);

  // Pull every played tournament in parallel. The API caches per-year
  // for 24h, so this is cheap after first hit.
  const fulls = (await Promise.all(playedYears.map((y) => getTournament(y))))
    .filter((t): t is NonNullable<typeof t> => !!t);

  // Aggregate appearances per team across all years.
  const byTeam = new Map<string, TeamRecord>();
  for (const t of fulls) {
    for (const team of t.teams ?? []) {
      let rec = byTeam.get(team.name);
      if (!rec) {
        rec = {
          name:           team.name,
          iso:            team.iso,
          confederation:  team.confederation,
          appearances:    [],
          firstYear:      Infinity,
          lastYear:       -Infinity,
          bestFinish:     null,
          bestFinishYear: null,
        };
        byTeam.set(team.name, rec);
      }
      rec.appearances.push(t.tournament.year);
      rec.firstYear = Math.min(rec.firstYear, t.tournament.year);
      rec.lastYear  = Math.max(rec.lastYear,  t.tournament.year);
      const fp = team.finalPosition;
      if (fp != null && (rec.bestFinish == null || fp < rec.bestFinish)) {
        rec.bestFinish     = fp;
        rec.bestFinishYear = t.tournament.year;
      }
    }
  }

  // Sort the most-recent year per team's appearances list.
  for (const rec of byTeam.values()) rec.appearances.sort((a, b) => a - b);

  const allTeams = Array.from(byTeam.values());
  const totalAppearances = allTeams.reduce((s, t) => s + t.appearances.length, 0);

  // Top by appearance count.
  const mostAppearances = [...allTeams]
    .sort((a, b) => b.appearances.length - a.appearances.length || a.name.localeCompare(b.name))
    .slice(0, 12);

  // Confederation distribution (player-counts in /aggregates/players
  // is per-player; here we count team-appearances).
  const byConfed = new Map<string, number>();
  for (const t of allTeams) {
    byConfed.set(t.confederation, (byConfed.get(t.confederation) ?? 0) + t.appearances.length);
  }
  const confedDonut = Array.from(byConfed.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Debutants per tournament — every team whose firstYear === this year.
  const debutantsByYear = new Map<number, TeamRecord[]>();
  for (const t of allTeams) {
    const arr = debutantsByYear.get(t.firstYear) ?? [];
    arr.push(t);
    debutantsByYear.set(t.firstYear, arr);
  }
  const debutantsChart = playedYears.map((year) => ({
    label: String(year),
    value: debutantsByYear.get(year)?.length ?? 0,
    host: tournaments.find((tt) => tt.year === year)?.host ?? [],
  }));

  // Best-ever finish leaderboard (capture only teams that have a
  // finalPosition set in the dataset).
  const bestFinishes = [...allTeams]
    .filter((t) => t.bestFinish != null)
    .sort((a, b) =>
      (a.bestFinish ?? 99) - (b.bestFinish ?? 99) ||
      b.appearances.length - a.appearances.length,
    )
    .slice(0, 12);

  // "Active" — appeared in the most recent played WC.
  const lastPlayed = playedYears[playedYears.length - 1];
  const activeNow = allTeams.filter((t) => t.appearances.includes(lastPlayed));

  return (
    <>
      {/* Hero */}
      <section className="border-b border-ink-800 bg-grid">
        <div className="max-w-7xl mx-auto px-6 py-10 sm:py-12">
          <div className="text-xs mb-4">
            <Link href="/" className="text-brand-400 hover:underline">← Overview</Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            <span className="text-white">Every nation,</span>{' '}
            <span className="text-brand-400">across every World Cup.</span>
          </h1>
          <p className="text-ink-300 text-sm mt-2 max-w-2xl">
            {allTeams.length} distinct nations have qualified at least once across {playedYears.length} played tournaments
            (1930→{lastPlayed}). {totalAppearances.toLocaleString()} total team-appearances. Powered by{' '}
            <span className="font-mono text-brand-400">GET /tournaments/&lbrace;year&rbrace;</span> aggregated client-side.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            <Stat label="Distinct nations" value={allTeams.length.toString()} />
            <Stat label="Total appearances" value={totalAppearances.toLocaleString()} />
            <Stat label="Active in last WC" value={activeNow.length.toString()} hint={`${lastPlayed}`} />
            <Stat
              label="One-time entrants"
              value={String(allTeams.filter((t) => t.appearances.length === 1).length)}
              hint="Played exactly one WC"
            />
          </div>
        </div>
      </section>

      {/* Most appearances + Best finishes */}
      <section className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Most appearances"
          subtitle="Tournaments played, all-time"
          source="GET /tournaments/{year} (aggregated client-side)"
        >
          <ol className="space-y-1 text-sm">
            {mostAppearances.map((t, i) => (
              <li key={t.name}>
                <div className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-ink-800/40">
                  <span className="text-[11px] font-mono text-ink-500 w-5 text-right">{i + 1}.</span>
                  <Flag country={t.name} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{t.name}</div>
                    <div className="text-[10px] text-ink-500">{t.confederation} · first {t.firstYear} · last {t.lastYear}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-accent-gold font-mono tabular-nums">
                      {t.appearances.length}×
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </ChartCard>

        <ChartCard
          title="Best-ever finish"
          subtitle="Highest final position any team has reached"
          source="ApiTeam.finalPosition"
        >
          <ol className="space-y-1 text-sm">
            {bestFinishes.map((t, i) => (
              <li key={t.name}>
                <div className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-ink-800/40">
                  <span className="text-[11px] font-mono text-ink-500 w-5 text-right">{i + 1}.</span>
                  <Flag country={t.name} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{t.name}</div>
                    <div className="text-[10px] text-ink-500">
                      {t.appearances.length}× appearance · {t.confederation}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-accent-gold font-mono tabular-nums">
                      #{t.bestFinish}
                    </div>
                    <div className="text-[10px] text-ink-500">in {t.bestFinishYear}</div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </ChartCard>
      </section>

      {/* Confederation + Debutants */}
      <section className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Team-appearances by confederation"
          subtitle="UEFA + CONMEBOL dominate, AFC + CAF rising"
          source="ApiTeam.confederation × tournament count"
        >
          <Donut data={confedDonut} centerLabel={String(totalAppearances)} height={300} />
        </ChartCard>

        <ChartCard
          title="Debutants by tournament"
          subtitle="First-time entries to the World Cup, by year"
          source="GET /tournaments/{year}.teams (filter: firstYear === year)"
        >
          <BarSeries data={debutantsChart} color={SERIES_COLORS.green} valueLabel="debutants" height={260} />
        </ChartCard>
      </section>

      {/* All teams table */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold mb-4">All teams</h2>
        <div className="bg-ink-900 border border-ink-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-800/60 text-left text-[10px] uppercase tracking-widest text-ink-300">
              <tr>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Confederation</th>
                <th className="px-4 py-3 text-right">Appearances</th>
                <th className="px-4 py-3 text-right">First</th>
                <th className="px-4 py-3 text-right">Last</th>
                <th className="px-4 py-3 text-right">Best finish</th>
              </tr>
            </thead>
            <tbody>
              {[...allTeams]
                .sort((a, b) =>
                  b.appearances.length - a.appearances.length ||
                  a.name.localeCompare(b.name),
                )
                .map((t) => (
                  <tr key={t.name} className="border-t border-ink-800/60 hover:bg-ink-800/30">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <Flag country={t.name} />
                        <span className="font-semibold text-white">{t.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink-300">{t.confederation}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-200">{t.appearances.length}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-300 text-xs">{t.firstYear}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-300 text-xs">{t.lastYear}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                      {t.bestFinish != null
                        ? <span className="text-accent-gold">#{t.bestFinish} <span className="text-ink-500">({t.bestFinishYear})</span></span>
                        : <span className="text-ink-500">—</span>}
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

// ─── Helpers (shared layout — same shape as other pages) ────────────

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
  title: string; subtitle: string; source?: string; children: React.ReactNode;
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
