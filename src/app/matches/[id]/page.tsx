/**
 * Per-match detail — every enriched field on a single match.
 *
 * URL: /wc-explorer/matches/{id}/
 *
 * Renders:
 *   - Header (date, stage, teams, score with AET/penalty flags,
 *     venue, attendance, referee, weather)
 *   - Goals timeline (when `goals` is populated)
 *   - On-the-day captains (when `captains` is populated)
 *   - Penalty shootout breakdown (when `penaltyShootout` is populated)
 *   - Substitutions / cards (schema-ready, populated for marquee
 *     matches over time)
 *
 * Each enrichment section gracefully shows nothing when its field
 * is absent — this page works on every match in the dataset, even
 * the un-enriched ones, just with fewer sections.
 *
 * Future enrichment lands automatically here: the schema is purely
 * additive. As we ship more match-detail data (goals for every match
 * back to 1950, captains for every WC), this page picks it up
 * without any code change.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getMatch, type ApiGoalEvent, type ApiPenaltyKick } from '@/lib/wc-api';
import { Flag } from '@/components/Flag';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const m = await getMatch(id);
  if (!m) return { title: 'Match' };
  const home = m.homeTeam ?? '?';
  const away = m.awayTeam ?? '?';
  const score = m.homeScore != null && m.awayScore != null ? `${m.homeScore}–${m.awayScore}` : 'vs';
  return {
    title: `${home} ${score} ${away} (${m.date}) — World Cup`,
    description: `${home} vs ${away} on ${m.date} at ${m.stadium ?? 'unknown venue'}, ${m.city ?? ''}. ${m.stage} stage of the FIFA World Cup. Goals, captains, penalty shootout, weather.`,
    alternates: { canonical: `/matches/${id}/` },
  };
}

const STAGE_LABEL: Record<string, string> = {
  group_a: 'Group A', group_b: 'Group B', group_c: 'Group C', group_d: 'Group D',
  group_e: 'Group E', group_f: 'Group F', group_g: 'Group G', group_h: 'Group H',
  round_of_32: 'Round of 32', round_of_16: 'Round of 16',
  quarter_final: 'Quarterfinal', semi_final: 'Semifinal',
  third_place: 'Third-place playoff', final: 'Final',
};
function stageLabel(raw: string): string {
  return STAGE_LABEL[raw] ?? (raw.startsWith('group_') ? `Group ${raw.slice(6).toUpperCase()}` : raw);
}
function formatDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    const mn = ['January','February','March','April','May','June','July','August','September','October','November','December'][m! - 1] ?? '?';
    return `${mn} ${d}, ${y}`;
  } catch { return iso; }
}
function weatherGlyph(code: number | null | undefined): string {
  if (code == null) return '';
  if (code === 0)  return '☀️';
  if (code <= 3)   return '⛅';
  if (code <= 49)  return '🌫️';
  if (code <= 65)  return '🌧️';
  if (code <= 77)  return '❄️';
  if (code <= 86)  return '🌨️';
  if (code >= 95)  return '⛈️';
  return '';
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { id } = await params;
  const m = await getMatch(id);
  if (!m) notFound();

  const year = Number(id.split('-')[0]);
  const home = m.homeTeam?.trim() ?? null;
  const away = m.awayTeam?.trim() ?? null;
  const hasResult = m.homeScore != null && m.awayScore != null;
  const homeGoals = m.goals?.filter((g) => g.team === 'home') ?? [];
  const awayGoals = m.goals?.filter((g) => g.team === 'away') ?? [];
  const goalsChrono = [...(m.goals ?? [])].sort((a, b) => {
    const ka = a.minute + (a.addedMinute ?? 0) / 100;
    const kb = b.minute + (b.addedMinute ?? 0) / 100;
    return ka - kb;
  });

  return (
    <>
      {/* Hero — match identity */}
      <section className="border-b border-ink-800 bg-grid">
        <div className="max-w-7xl mx-auto px-6 py-10 sm:py-12">
          <div className="text-xs mb-4 flex items-center gap-3 flex-wrap">
            <Link href={`/matches/?year=${year}`} className="text-brand-400 hover:underline">← All {year} matches</Link>
            <span className="text-ink-700">·</span>
            <Link href={`/${year}/`} className="text-brand-400 hover:underline">{year} tournament</Link>
          </div>
          <div className="text-xs uppercase tracking-widest text-ink-400 mb-2 font-mono">
            {stageLabel(m.stage)} · {formatDate(m.date)}
          </div>
          {/* Scoreline */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 my-6 flex-wrap">
            <TeamLabel name={home} className="text-right" />
            <div className="text-center">
              {hasResult ? (
                <div>
                  <div className="text-5xl sm:text-6xl font-black tracking-tight text-white tabular-nums">
                    {m.homeScore}<span className="text-ink-500 mx-2">–</span>{m.awayScore}
                  </div>
                  {m.extraTime && (
                    <div className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold mt-1">After extra time</div>
                  )}
                  {m.penalties && (
                    <div className="text-sm font-mono text-amber-300 mt-1">
                      ({m.penalties.home}–{m.penalties.away} pens)
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-3xl font-mono text-ink-500">vs</div>
              )}
            </div>
            <TeamLabel name={away} />
          </div>
          {/* Match meta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            <Meta label="Venue" value={m.stadium ?? '—'} hint={m.city ?? ''} />
            <Meta
              label="Attendance"
              value={m.attendance != null ? m.attendance.toLocaleString() : '—'}
            />
            <Meta
              label="Referee"
              value={m.referee?.name ?? '—'}
              hint={m.referee?.country ?? ''}
            />
            <Meta
              label="Weather at kickoff"
              value={m.weather?.tempC != null ? `${Math.round(m.weather.tempC)}°C ${weatherGlyph(m.weather.code)}` : '—'}
              hint={m.weather?.humidityPct != null ? `${Math.round(m.weather.humidityPct)}% humidity` : ''}
            />
          </div>
        </div>
      </section>

      {/* Captains — only when set */}
      {m.captains && (
        <section className="max-w-7xl mx-auto px-6 pt-8">
          <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-3">On-the-day captains</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-ink-400 mb-1">
                  {home}
                </div>
                <div className="flex items-center gap-2 text-ink-100 font-semibold">
                  {home && <Flag country={home} />}
                  <span>{m.captains.home ?? '—'}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-ink-400 mb-1">
                  {away}
                </div>
                <div className="flex items-center gap-2 text-ink-100 font-semibold">
                  {away && <Flag country={away} />}
                  <span>{m.captains.away ?? '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Goals timeline */}
      {goalsChrono.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-1">Goals — chronological</h2>
            <p className="text-[11px] text-ink-400 mb-4">
              {homeGoals.length} for {home} · {awayGoals.length} for {away}
            </p>
            <ol className="space-y-2">
              {goalsChrono.map((g, i) => (
                <GoalRow key={i} g={g} home={home} away={away} />
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Penalty shootout */}
      {m.penaltyShootout && (
        <section className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-ink-900 border border-amber-500/30 rounded-2xl p-5">
            <header className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-bold text-white">Penalty shootout</h2>
                <p className="text-[11px] text-ink-400">
                  Kick-by-kick, in shooting order. {' '}
                  <span className="text-amber-300 font-semibold">
                    {m.penaltyShootout.winner === 'home' ? home : away} won {m.penaltyShootout.homeScore}–{m.penaltyShootout.awayScore}
                  </span>
                </p>
              </div>
              <div className="font-mono text-xl tabular-nums text-white">
                {m.penaltyShootout.homeScore}–{m.penaltyShootout.awayScore}
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-800/40 text-left text-[10px] uppercase tracking-widest text-ink-400">
                  <tr>
                    <th className="px-3 py-2 font-semibold w-10 text-right">#</th>
                    <th className="px-3 py-2 font-semibold">Team</th>
                    <th className="px-3 py-2 font-semibold">Kicker</th>
                    <th className="px-3 py-2 font-semibold text-center">Result</th>
                    <th className="px-3 py-2 font-semibold">Goalkeeper</th>
                  </tr>
                </thead>
                <tbody>
                  {m.penaltyShootout.kicks.map((k) => (
                    <KickRow key={k.order} k={k} home={home} away={away} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Substitutions / cards — schema-ready */}
      {(m.substitutions?.length ?? 0) > 0 && (
        <section className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-3">Substitutions</h2>
            <ul className="space-y-1 text-sm">
              {m.substitutions!.map((s, i) => (
                <li key={i} className="text-ink-200 font-mono tabular-nums">
                  <span className="text-ink-500">{s.minute}&apos;</span>{' '}
                  <span className="text-emerald-400">→</span> {s.on}{' '}
                  <span className="text-ink-500">for</span> {s.off}{' '}
                  <span className="text-ink-500">({s.team === 'home' ? home : away})</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {(m.cards?.length ?? 0) > 0 && (
        <section className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-3">Cards</h2>
            <ul className="space-y-1 text-sm">
              {m.cards!.map((c, i) => (
                <li key={i} className="text-ink-200 font-mono tabular-nums">
                  <span className="text-ink-500">{c.minute}&apos;</span>{' '}
                  <span className={c.color === 'red' || c.color === 'second_yellow' ? 'text-red-400' : 'text-amber-400'}>
                    {c.color === 'second_yellow' ? '🟨🟥' : c.color === 'red' ? '🟥' : '🟨'}
                  </span>{' '}
                  {c.player}{' '}
                  <span className="text-ink-500">({c.team === 'home' ? home : away})</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* API source footer */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="text-[10px] font-mono text-ink-500">
          <span className="text-brand-400">GET /matches/{id}</span> ·{' '}
          {!m.goals && !m.captains && !m.penaltyShootout && (
            <span className="text-ink-600">
              No detailed enrichment for this match yet. Schema supports goals + captains + penalty shootout + substitutions + cards; we&apos;re seeding marquee matches first and expanding via curated overlays.
            </span>
          )}
        </div>
      </section>
    </>
  );
}

function TeamLabel({ name, className = '' }: { name: string | null; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {name && <Flag country={name} size={40} />}
      <span className="text-xl sm:text-2xl font-bold text-white">{name ?? '—'}</span>
    </div>
  );
}

function Meta({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-ink-900/80 backdrop-blur border border-ink-800 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-widest text-ink-400 mb-1">{label}</div>
      <div className="text-sm font-semibold text-white truncate" title={value}>{value}</div>
      {hint && <div className="text-[10px] text-ink-500 mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

function GoalRow({ g, home, away }: { g: ApiGoalEvent; home: string | null; away: string | null }) {
  const teamName = g.team === 'home' ? home : away;
  const min = g.addedMinute ? `${g.minute}+${g.addedMinute}'` : `${g.minute}'`;
  const typeBadge = g.type === 'penalty' ? '(P)'
                  : g.type === 'header'  ? '(H)'
                  : g.type === 'free_kick' ? '(FK)'
                  : g.type === 'own_goal' ? '(OG)'
                  : '';
  return (
    <li className={`flex items-baseline gap-3 px-3 py-2 rounded-lg ${g.team === 'home' ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-brand-500/5 border border-brand-500/20'}`}>
      <span className="font-mono text-xs tabular-nums text-ink-400 w-12 text-right">{min}</span>
      {teamName && <Flag country={teamName} />}
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <span className="text-white font-semibold">{g.scorer}</span>
          {typeBadge && <span className="text-ink-400 text-xs ml-2 font-mono">{typeBadge}</span>}
          {g.extraTime && <span className="text-amber-400 text-[10px] ml-2 uppercase tracking-widest">ET</span>}
        </div>
        {g.assist && (
          <div className="text-[11px] text-ink-500 mt-0.5">
            assist <span className="text-ink-300">{g.assist}</span>
          </div>
        )}
        {g.note && (
          <div className="text-[11px] text-amber-300 mt-0.5 italic">{g.note}</div>
        )}
      </div>
    </li>
  );
}

function KickRow({ k, home, away }: { k: ApiPenaltyKick; home: string | null; away: string | null }) {
  const teamName = k.team === 'home' ? home : away;
  return (
    <tr className={`border-t border-ink-800/60 ${k.success ? '' : 'opacity-80'}`}>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-400 text-xs">{k.order}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          {teamName && <Flag country={teamName} />}
          <span className="text-ink-300">{teamName}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-ink-100 font-medium">{k.kicker}</td>
      <td className="px-3 py-2 text-center">
        {k.success ? (
          <span className="inline-block text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
            ⚽ {k.outcome ?? 'scored'}
          </span>
        ) : (
          <span className="inline-block text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 font-semibold">
            ❌ {k.outcome ?? 'missed'}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-ink-400">{k.gk ?? '—'}</td>
    </tr>
  );
}
