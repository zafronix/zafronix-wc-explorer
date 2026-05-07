/**
 * Zafronix WC API client (read-side).
 *
 * Same role as siono-platform/src/lib/wc-api-client.ts but trimmed to
 * what the explorer needs: history (1930-2026), aggregates, trivia,
 * compare. No live-tournament writes here — explorer is purely a
 * showcase.
 *
 * Auth via WC_API_KEY env var (read-tier key). Set in
 * /etc/systemd/system/zafronix-wc-explorer.service.d/override.conf
 * alongside whatever else the unit needs.
 */

import 'server-only';

export const WC_API_BASE =
  process.env.WC_API_BASE ?? 'https://api.zafronix.com/fifa/worldcup/v1';

const WC_API_KEY = process.env.WC_API_KEY;

export const REVALIDATE = {
  static: 86_400,    // history is immutable
  meta:   3_600,
  live:   60,
} as const;

async function apiGet<T>(path: string, opts: { revalidate?: number; tags?: string[] } = {}): Promise<T> {
  if (!WC_API_KEY) throw new Error('WC_API_KEY env var unset');
  const res = await fetch(`${WC_API_BASE}${path}`, {
    headers: { 'X-API-Key': WC_API_KEY },
    next: {
      revalidate: opts.revalidate ?? REVALIDATE.static,
      tags: opts.tags,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`WC API ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ============================================================================
// Types — match the API wire format exactly
// ============================================================================

export interface ApiTournamentIndexEntry {
  year: number;
  edition: number;
  host: string[];
  champion: string | null;
  file?: string;
}

export interface ApiTournamentMeta {
  year: number;
  edition: number;
  host: string[];
  datesIso?: { start: string; end: string };
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
  topScorer?: { player: string; goals: number } | null;
  bestPlayer?: string | null;
  bestGoalkeeper?: string | null;
  bestYoungPlayer?: string | null;
  ballName?: string | null;
  mascot?: string | null;
  notes?: string | null;
  totalGoals?: number | null;
  totalAttendance?: number | null;
  matchesCount?: number;
  teamsCount?: number;
}

export interface ApiSquadPlayer {
  jersey?: number | null;
  name: string;
  fullName?: string;
  position: string;
  born?: string | null;
  ageAtTournament?: number | null;
  club?: { name: string; country?: string } | null;
  goals: number;
  captain?: boolean;
}

export interface ApiKnockoutMatch {
  stage: string;
  opponent: string;
  result: string;
  won?: boolean;
}

export interface ApiTeam {
  name: string;
  code: string;
  iso: string;
  confederation: string;
  flag: { iso: string | null; iso3166_3: string | null; fifaCode: string; flagUrl: string };
  knockoutPath: ApiKnockoutMatch[];
  finalPosition: number | null;
  squad: ApiSquadPlayer[];
}

export interface ApiTournamentFull {
  schemaVersion: number;
  tournament: ApiTournamentMeta;
  teams?: ApiTeam[];
}

export interface ApiTriviaFact {
  id: string;
  year: number | number[];
  category: string;
  fact: string;
  players?: string[];
  teams?: string[];
}

export interface ApiCompareRow {
  year: number;
  edition: number;
  host: string[];
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
  teamsCount: number;
  matchesCount: number;
  totalGoals: number | null;
  goalsPerMatch: number | null;
  totalAttendance: number | null;
  avgAttendance: number | null;
  topScorer: { player: string; goals: number } | null;
  bestPlayer: string | null;
}

export interface ApiAggregateChampions {
  byCountry: Record<string, number>;
  byDecade: Record<string, Array<{ year: number; champion: string }>>;
}

export interface ApiAggregatePlayers {
  positionCounts?: Record<string, number>;
  birthMonthsByPosition?: Record<string, Record<string, { N: number; S: number }>>;
  confederationCounts?: Record<string, number>;
}

// ============================================================================
// Endpoints
// ============================================================================

export async function listTournaments(): Promise<ApiTournamentIndexEntry[]> {
  const all = await apiGet<ApiTournamentIndexEntry[]>('/tournaments', {
    revalidate: REVALIDATE.static,
    tags: ['wc:tournaments-index'],
  });
  // Filter the synthetic sandbox year (9999) — explorer is public.
  return all.filter((t) => t.year < 9000);
}

export async function getTournament(year: number): Promise<ApiTournamentFull | null> {
  try {
    return await apiGet<ApiTournamentFull>(`/tournaments/${year}`, {
      revalidate: REVALIDATE.static,
      tags: [`wc:tournament:${year}`],
    });
  } catch (e) {
    if (String(e).includes(' 404 ')) return null;
    throw e;
  }
}

export async function getTriviaForYear(year: number): Promise<ApiTriviaFact[]> {
  return apiGet<ApiTriviaFact[]>(`/trivia?year=${year}`, {
    revalidate: REVALIDATE.static,
    tags: [`wc:trivia:${year}`],
  });
}

export async function compareTournaments(years: number[]): Promise<ApiCompareRow[]> {
  if (years.length === 0) return [];
  return apiGet<ApiCompareRow[]>(`/compare?years=${years.join(',')}`, {
    revalidate: REVALIDATE.static,
    tags: [`wc:compare:${years.join(',')}`],
  });
}

export async function getAggregateChampions(): Promise<ApiAggregateChampions> {
  return apiGet<ApiAggregateChampions>('/aggregates/champions', {
    revalidate: REVALIDATE.static,
    tags: ['wc:aggregates:champions'],
  });
}

export async function getAggregatePlayers(years?: number[]): Promise<ApiAggregatePlayers> {
  const qs = years && years.length > 0 ? `?years=${years.join(',')}` : '';
  return apiGet<ApiAggregatePlayers>(`/aggregates/players${qs}`, {
    revalidate: REVALIDATE.static,
    tags: ['wc:aggregates:players'],
  });
}

export async function topScorersForYear(
  year: number, limit = 10,
): Promise<Array<{ name: string; team: string; position: string; goals: number }>> {
  const t = await getTournament(year);
  if (!t || !t.teams) return [];
  const scorers: Array<{ name: string; team: string; position: string; goals: number }> = [];
  for (const team of t.teams) {
    for (const p of team.squad ?? []) {
      if (p.goals > 0) {
        scorers.push({ name: p.name, team: team.name, position: p.position, goals: p.goals });
      }
    }
  }
  scorers.sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
  return scorers.slice(0, limit);
}
