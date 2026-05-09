/**
 * WC Explorer landing dashboard.
 *
 * The whole 1930→2026 story in one screen — total goals, attendance,
 * matches, champion distribution, decade-by-decade winners, "biggest
 * tournaments" leaderboard. Every number is a teaser for the per-
 * tournament drill-downs and the side-by-side compare view.
 *
 * All data fetched server-side from api.zafronix.com — this page is
 * THE proof that "everything you see here, you can build with our API."
 */

import Link from 'next/link';
import {
  listTournaments, getAggregateChampions, compareTournaments,
} from '@/lib/wc-api';
import {
  AreaSeries, BarSeries, LineSeries, Donut, SERIES_COLORS,
} from '@/components/charts/Charts';
import { Flag, HostFlags } from '@/components/Flag';
import { YearStrip } from '@/components/YearStrip';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'World Cup Explorer — every tournament 1930→2026',
  description:
    '23 World Cup tournaments. 1,068+ matches. 2,500+ players. Interactive charts powered by the Zafronix WC API — your starting point for fantasy apps, dashboards, and analytics.',
};

export default async function LandingPage() {
  // Pull the summary slabs in parallel.
  const [tournaments, champions] = await Promise.all([
    listTournaments(),
    getAggregateChampions(),
  ]);

  // Per-tournament metrics — only "played" tournaments (champion set).
  const playedYears = tournaments
    .filter((t) => t.champion)
    .map((t) => t.year);

  // Heavy: pull /compare for every played year so we can chart goals,
  // attendance, etc. The endpoint accepts up to 8 per call; chunk it.
  const chunks: number[][] = [];
  for (let i = 0; i < playedYears.length; i += 8) {
    chunks.push(playedYears.slice(i, i + 8));
  }
  const compareRows = (
    await Promise.all(chunks.map((c) => compareTournaments(c)))
  ).flat();
  compareRows.sort((a, b) => a.year - b.year);

  // Derived series for charts. Every point carries the host(s) so
  // tooltips can render <flag> Country in addition to year + value.
  const goalsByYear = compareRows.map((r) => ({
    label: String(r.year), value: r.totalGoals ?? 0, host: r.host,
  }));
  const goalsPerMatch = compareRows.map((r) => ({
    label: String(r.year), value: Number((r.goalsPerMatch ?? 0).toFixed(2)), host: r.host,
  }));
  const attendanceByYear = compareRows.map((r) => ({
    label: String(r.year), value: r.totalAttendance ?? 0, host: r.host,
  }));
  const teamsByYear = compareRows.map((r) => ({
    label: String(r.year), value: r.teamsCount, host: r.host,
  }));

  // Champions byCountry → donut
  const championsDonut = Object.entries(champions.byCountry)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Big-number summary
  const totalGoals = compareRows.reduce((s, r) => s + (r.totalGoals ?? 0), 0);
  const totalMatches = compareRows.reduce((s, r) => s + r.matchesCount, 0);
  const totalAttendance = compareRows.reduce((s, r) => s + (r.totalAttendance ?? 0), 0);
  const playedCount = playedYears.length;
  const upcomingCount = tournaments.length - playedCount;

  // Top-10 highest-scoring tournaments (ever)
  const topScoring = [...compareRows]
    .filter((r) => r.totalGoals != null)
    .sort((a, b) => (b.totalGoals ?? 0) - (a.totalGoals ?? 0))
    .slice(0, 10);

  // Top-10 best-attended tournaments
  const topAttended = [...compareRows]
    .filter((r) => r.totalAttendance != null)
    .sort((a, b) => (b.totalAttendance ?? 0) - (a.totalAttendance ?? 0))
    .slice(0, 10);

  return (
    <>
      {/* Hero */}
      <section className="relative bg-grid border-b border-ink-800">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-700/10 via-ink-950/0 to-ink-950" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-6 py-16 sm:py-20">
          <div className="max-w-3xl">
            <div className="text-[10px] uppercase tracking-[0.25em] text-brand-400 mb-3">
              Zafronix WC API · Sample Dashboard
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
              <span className="text-white">92 years of the World Cup,</span>
              <br />
              <span className="text-brand-400 glow-brand">in one API.</span>
            </h1>
            <p className="text-lg text-ink-300 mt-6 leading-relaxed max-w-2xl">
              Every tournament from 1930 in Uruguay to the 2026 finale at MetLife.
              23 editions, 1,068 matches, 2,500+ players, 206 venues — clean JSON,
              sub-200ms responses, free tier, no card required.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <a
                href="https://api.zafronix.com/signup"
                className="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors"
              >
                Get a free API key →
              </a>
              <Link
                href="/compare/"
                className="px-5 py-3 rounded-xl bg-ink-800 hover:bg-ink-700 border border-ink-700 text-ink-100 font-semibold transition-colors"
              >
                Compare tournaments
              </Link>
              <a
                href="https://api.zafronix.com/docs"
                className="px-5 py-3 rounded-xl border border-ink-700 hover:border-brand-500 text-ink-300 font-semibold transition-colors"
              >
                Read the docs
              </a>
            </div>
          </div>

          {/* Year strip — quick jump into any tournament. */}
          <div className="mt-10">
            <YearStrip
              years={tournaments.map((t) => t.year)}
              label="Jump to a tournament"
            />
          </div>

          {/* Big numbers */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
            <BigNumber
              label="Tournaments played"
              value={playedCount.toLocaleString()}
              hint={upcomingCount > 0 ? `+${upcomingCount} upcoming` : undefined}
            />
            <BigNumber
              label="Total goals"
              value={totalGoals.toLocaleString()}
              hint={playedCount > 0 ? `${Math.round(totalGoals / playedCount).toLocaleString()} avg / tournament` : undefined}
              accent="gold"
            />
            <BigNumber
              label="Matches"
              value={totalMatches.toLocaleString()}
              hint={playedCount > 0 ? `${Math.round(totalMatches / playedCount).toLocaleString()} avg / tournament` : undefined}
            />
            <BigNumber
              label="Total attendance"
              value={totalAttendance >= 1_000_000 ? `${(totalAttendance / 1_000_000).toFixed(1)}M` : totalAttendance.toLocaleString()}
              hint={totalMatches > 0 ? `${Math.round(totalAttendance / totalMatches).toLocaleString()} avg / match` : undefined}
            />
          </div>
        </div>
      </section>

      {/* Charts row 1 */}
      <section className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Goals per tournament"
          subtitle="Total goals scored, 1930–latest"
          source="GET /compare?years=…"
        >
          <AreaSeries data={goalsByYear} color={SERIES_COLORS.brand} height={260} />
        </ChartCard>

        <ChartCard
          title="Scoring rate"
          subtitle="Goals / match, by tournament"
          source="GET /compare?years=…"
        >
          <LineSeries
            data={goalsPerMatch}
            color={SERIES_COLORS.gold}
            height={260}
            valueLabel="goals/match"
          />
        </ChartCard>

        <ChartCard
          title="Tournament size"
          subtitle="Teams that qualified"
          source="GET /tournaments/{year}"
        >
          <BarSeries
            data={teamsByYear}
            color={SERIES_COLORS.green}
            height={260}
            valueLabel="teams"
          />
        </ChartCard>
      </section>

      {/* Charts row 2 — attendance + champions */}
      <section className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Attendance over time"
          subtitle="Total fans through the gates"
          source="GET /tournaments/{year}.totalAttendance"
          className="lg:col-span-2"
        >
          <AreaSeries data={attendanceByYear} color={SERIES_COLORS.cyan} height={300} />
        </ChartCard>

        <ChartCard
          title="Champions by country"
          subtitle="Who's lifted the trophy"
          source="GET /aggregates/champions"
        >
          {/* Donut renders flags + country + count directly on each
              slice (Phase A) so the side legend is no longer needed. */}
          <Donut
            data={championsDonut}
            centerLabel={`${championsDonut.length}`}
            height={340}
          />
        </ChartCard>
      </section>

      {/* Tournament index */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-2xl font-bold">Every tournament</h2>
          <Link href="/compare/" className="text-sm text-brand-400 hover:underline">
            Pick 2+ to compare side-by-side →
          </Link>
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {tournaments.map((t) => (
            <li key={t.year}>
              <Link
                href={`/${t.year}/`}
                className="block bg-ink-900 border border-ink-800 hover:border-brand-500/60 rounded-xl px-3 py-2.5 lift"
              >
                <div className="text-base font-bold text-white">{t.year}</div>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-ink-300 truncate">
                  {/* Co-hosts (e.g. 2002 KOR/JPN, 2026 USA/CAN/MEX)
                      get all flags side-by-side. */}
                  <HostFlags hosts={t.host} flagsOnly className="flex-shrink-0" />
                  <span className="truncate">{t.host.join(' / ')}</span>
                </div>
                {t.champion ? (
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-accent-gold truncate">
                    <span aria-hidden>🏆</span>
                    <Flag country={t.champion} size={20} />
                    <span className="truncate">{t.champion}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-ink-500 mt-1">upcoming</div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Leaderboards */}
      <section className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Leaderboard
          title="Highest-scoring tournaments"
          rows={topScoring.map((r) => ({
            year: r.year,
            hosts: r.host,
            champion: r.champion,
            value: `${r.totalGoals} goals`,
            sub: `${r.goalsPerMatch?.toFixed(2) ?? '—'}/match`,
          }))}
        />
        <Leaderboard
          title="Best-attended tournaments"
          rows={topAttended.map((r) => ({
            year: r.year,
            hosts: r.host,
            champion: r.champion,
            value: `${r.totalAttendance?.toLocaleString() ?? '—'}`,
            sub: r.avgAttendance != null
              ? `${r.avgAttendance.toLocaleString()}/match`
              : '—',
          }))}
        />
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="rounded-2xl bg-gradient-to-br from-brand-700/30 via-ink-900 to-ink-950 border border-brand-700/40 p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
          <div className="relative max-w-2xl">
            <h3 className="text-2xl sm:text-3xl font-bold leading-tight">
              Ship something with this data.
            </h3>
            <p className="text-ink-300 mt-3 text-base leading-relaxed">
              Fantasy app, news widget, trivia bot, analytics dashboard — every chart
              on this page is one HTTP call. Free tier is 5,000 requests/day, no card.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <a
                href="https://api.zafronix.com/signup"
                className="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors"
              >
                Get a free key
              </a>
              <a
                href="https://api.zafronix.com/docs"
                className="px-5 py-3 rounded-xl border border-ink-700 hover:border-brand-500 text-ink-300 font-semibold transition-colors"
              >
                Read the docs
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function BigNumber({
  label, value, hint, accent,
}: {
  label: string; value: string; hint?: string; accent?: 'gold';
}) {
  const valueClass = accent === 'gold' ? 'text-accent-gold glow-gold' : 'text-white';
  return (
    <div className="bg-ink-900/80 backdrop-blur border border-ink-800 rounded-2xl p-5 lift">
      <div className={`text-3xl sm:text-4xl font-black tracking-tight ${valueClass}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-widest text-ink-300 mt-1">{label}</div>
      {hint && <div className="text-[10px] text-ink-500 mt-1">{hint}</div>}
    </div>
  );
}

function ChartCard({
  title, subtitle, source, children, className = '',
}: {
  title: string;
  subtitle: string;
  source?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-ink-900 border border-ink-800 rounded-2xl p-5 ${className}`}>
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

function Leaderboard({
  title, rows,
}: {
  title: string;
  rows: Array<{
    year: number;
    hosts: string[];
    champion: string | null;
    value: string;
    sub: string;
  }>;
}) {
  return (
    <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-white mb-4">{title}</h3>
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.year}>
            <Link
              href={`/${r.year}/`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-ink-800/60 transition-colors"
            >
              <span className="text-[11px] font-mono text-ink-500 w-5 text-right">
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white flex items-center gap-1.5 flex-wrap">
                  <span>{r.year}</span>
                  <span className="text-ink-500">·</span>
                  <HostFlags hosts={r.hosts} flagsOnly />
                  <span className="text-ink-300 font-normal truncate">{r.hosts.join(' / ')}</span>
                </div>
                {r.champion && (
                  <div className="flex items-center gap-1 text-[11px] text-accent-gold/80 mt-0.5">
                    <span aria-hidden>🏆</span>
                    <Flag country={r.champion} />
                    <span>{r.champion}</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-accent-gold font-mono tabular-nums">
                  {r.value}
                </div>
                <div className="text-[10px] text-ink-500">{r.sub}</div>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
