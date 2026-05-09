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
} from '@/lib/wc-api';
import { BarSeries, Donut, SERIES_COLORS } from '@/components/charts/Charts';
import { Flag } from '@/components/Flag';

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
  const [t, allTournaments, topScorers, trivia] = await Promise.all([
    getTournament(yearNum),
    listTournaments(),
    topScorersForYear(yearNum, 12),
    getTriviaForYear(yearNum).catch(() => []),
  ]);
  if (!t) notFound();

  const meta = t.tournament;
  const teams = t.teams ?? [];

  const champion = meta.champion ? teams.find((tm) => tm.name === meta.champion) : undefined;

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
      {(meta.bestPlayer || meta.bestYoungPlayer || meta.bestGoalkeeper || meta.ballName || meta.mascot) && (
        <section className="max-w-7xl mx-auto px-6 pb-6">
          <h2 className="text-sm uppercase tracking-widest text-ink-300 mb-3">Awards & marks</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {meta.bestPlayer       && <Award label="Best player"  value={meta.bestPlayer} />}
            {meta.bestYoungPlayer  && <Award label="Best young"   value={meta.bestYoungPlayer} />}
            {meta.bestGoalkeeper   && <Award label="Best GK"      value={meta.bestGoalkeeper} />}
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

      {/* Champion's KO path */}
      {champion && champion.knockoutPath.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-6">
          <div className="bg-ink-900 border border-accent-gold/30 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white">
              {champion.name}&apos;s road to the title
            </h2>
            <div className="text-[11px] text-ink-300 mb-4">
              Knockout-stage results, in order
            </div>
            <ol className="space-y-1.5 text-sm">
              {champion.knockoutPath.map((m, i) => (
                <li key={i} className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-lg bg-ink-950/40">
                  <span className="text-[10px] text-ink-300 uppercase tracking-wider w-16">{m.stage}</span>
                  <span className="text-white font-semibold inline-flex items-center gap-1.5">
                    vs <Flag country={m.opponent} /> {m.opponent}
                  </span>
                  <span className="ml-auto font-mono tabular-nums text-accent-gold font-bold">
                    {m.result}
                  </span>
                </li>
              ))}
            </ol>
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

function Award({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-900 border border-ink-800 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-widest text-ink-300">{label}</div>
      <div className="text-sm font-semibold text-white mt-0.5 truncate" title={value}>{value}</div>
    </div>
  );
}
