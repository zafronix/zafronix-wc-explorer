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

/**
 * Server-side fetcher for api.zafronix.com.
 *
 * IMPORTANT — cacheability:
 *   Every request from this module uses identical headers (only
 *   X-API-Key + X-Origin-App, never anything visitor-specific). Next
 *   16's data cache keys on URL + method + body + headers, so as long
 *   as the headers stay constant across visitors, the first hit fills
 *   the cache and every subsequent visitor within `revalidate` reads
 *   from the cache without touching the network.
 *
 *   Forwarding X-Visitor-IP from here used to defeat the cache: every
 *   visitor's request had a different header value → unique cache key
 *   → fresh API call per visitor → 30+ API calls × N visitors per
 *   refresh, triggering 429s during demos. We dropped it on
 *   2026-05-14.
 *
 *   Per-visitor traffic attribution still works — `VisitBeacon`
 *   (client-side, in src/components/VisitBeacon.tsx) posts directly
 *   to the wc-api's /track/visit endpoint from the user's browser, so
 *   the admin map sees the real visitor IP via X-Forwarded-For. SSR
 *   data fetches just shouldn't be re-stamped with that same IP.
 *
 *   Revalidation:
 *     - REVALIDATE.static (24h)   — history pages, aggregates, trivia
 *     - REVALIDATE.meta   (1h)    — tournament shells, teams, stadiums
 *     - REVALIDATE.live   (60s)   — match results, standings, brackets
 *
 *   These windows apply per cache key (URL + headers). Demoing the
 *   landing page repeatedly to different audiences now generates ~0
 *   wc-api calls past the first one in 24h.
 */
async function apiGet<T>(path: string, opts: { revalidate?: number; tags?: string[] } = {}): Promise<T> {
  if (!WC_API_KEY) throw new Error('WC_API_KEY env var unset');

  const res = await fetch(`${WC_API_BASE}${path}`, {
    headers: {
      'X-API-Key':    WC_API_KEY,
      'X-Origin-App': 'wc-explorer',
    },
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
  // ─── Optional enrichment (2026-05-17 schema). Absent = no data. ─
  heightCm?: number | null;
  weightKg?: number | null;
  dominantFoot?: 'left' | 'right' | 'both' | 'unknown' | null;
  professional?: boolean | null;
  caps?: number | null;
  nationalGoals?: number | null;
  birthCountry?: string | null;
  goalBreakdown?: {
    leftFoot?:  number;
    rightFoot?: number;
    header?:    number;
    penalty?:   number;
    other?:     number;
    ownGoals?:  number;
  };
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
  years?:                number[];
  totalPlayers?:         number;
  totalTeams?:           number;
  totalTournaments?:     number;
  avgSquadSize?:         number;
  /** Position counts: keys are GK | DF | MF | FW. */
  byPosition?:           Record<string, number>;
  /** birthMonthByPosition[GK] = [Jan…Dec] counts. */
  birthMonthByPosition?: Record<string, number[]>;
  /** Per-confederation player counts. */
  byConfederation?:      Record<string, number>;
  /** Northern / Southern hemisphere split. */
  byHemisphere?:         { N: number; S: number };
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

export async function getAggregatePlayers(
  years?: number[],
  hemisphere?: 'N' | 'S',
): Promise<ApiAggregatePlayers> {
  const params = new URLSearchParams();
  if (years && years.length > 0) params.set('years', years.join(','));
  if (hemisphere)                params.set('hemisphere', hemisphere);
  const qs = params.toString();
  return apiGet<ApiAggregatePlayers>(`/aggregates/players${qs ? `?${qs}` : ''}`, {
    revalidate: REVALIDATE.static,
    tags: ['wc:aggregates:players'],
  });
}

// ─── Matches ─────────────────────────────────────────────────────────

export interface ApiMatch {
  id:           string;
  matchNo?:     number;
  date:         string;
  kickoff:      string | null;
  kickoffUtc?:  string;
  stage:        string;
  homeTeam:     string | null;
  awayTeam:     string | null;
  homeScore:    number | null;
  awayScore:    number | null;
  result:       string | null;
  extraTime:    boolean;
  penalties:    { home: number; away: number } | null;
  stadium:      string | null;
  stadiumId:    string | null;
  city:         string | null;
  country?:     string;
  attendance:   number | null;
  referee?:     { name: string; country: string | null } | null;
  /** Kickoff weather at the venue. Null = backfill source had no
   *  coverage for that date/location (mostly pre-1940 matches).
   *  Backfilled from Open-Meteo Historical Weather API. */
  weather?: {
    tempC:           number | null;
    humidityPct:     number | null;
    precipitationMm: number | null;
    windKmh:         number | null;
    /** WMO weather code (0 = clear, 61-65 = rain, 71-77 = snow, etc).
     *  See https://open-meteo.com/en/docs#api_form */
    code:            number | null;
  } | null;
  // ─── Optional enrichment (2026-05-17 schema). Absent = no data ──
  /** Per-goal breakdown. When set, sum of `goals` for each side
   *  matches the scoreline (excluding shootout). */
  goals?: ApiGoalEvent[];
  /** Per-match captain (overrides Team.captain when the on-the-day
   *  armband differs). */
  captains?: { home: string | null; away: string | null };
  /** Per-kick shootout breakdown. Only present when `penalties`
   *  is also set. */
  penaltyShootout?: ApiPenaltyShootout;
  /** Substitution events. Schema-ready; populated for marquee
   *  matches. */
  substitutions?: Array<{
    minute: number;
    team: 'home' | 'away';
    on: string;
    off: string;
  }>;
  /** Card events. */
  cards?: Array<{
    minute: number;
    team: 'home' | 'away';
    player: string;
    color: 'yellow' | 'red' | 'second_yellow';
  }>;
}

export interface ApiGoalEvent {
  minute: number;
  addedMinute?: number;
  team: 'home' | 'away';
  scorer: string;
  type?: 'normal' | 'penalty' | 'free_kick' | 'header' | 'own_goal' | 'volley' | 'long_range';
  bodyPart?: 'left_foot' | 'right_foot' | 'header' | 'chest' | 'other';
  assist?: string;
  extraTime?: boolean;
  note?: string;
}

export interface ApiPenaltyKick {
  order: number;
  team: 'home' | 'away';
  kicker: string;
  success: boolean;
  gk?: string;
  outcome?: 'scored' | 'saved' | 'missed' | 'post' | 'crossbar';
}

export interface ApiPenaltyShootout {
  kicks: ApiPenaltyKick[];
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'away';
}

interface MatchesListResponse {
  count?:      number;
  data?:       ApiMatch[];
  matches?:    ApiMatch[];
}

export async function getMatch(id: string): Promise<ApiMatch | null> {
  try {
    return await apiGet<ApiMatch>(`/matches/${encodeURIComponent(id)}`, {
      revalidate: REVALIDATE.static,
      tags: [`wc:match:${id}`],
    });
  } catch {
    return null;
  }
}

export async function listMatchesByYear(year: number): Promise<ApiMatch[]> {
  const res = await apiGet<MatchesListResponse>(`/matches?year=${year}`, {
    revalidate: REVALIDATE.static,
    tags: [`wc:matches:${year}`],
  });
  return res.data ?? res.matches ?? [];
}

// ─── Stadiums ────────────────────────────────────────────────────────

export interface ApiStadium {
  id:               string;
  name:             string;
  historicalName?:  string;
  fifaNames?:       Record<string, string>;
  city:             string;
  country:          string;
  iso:              string;
  coords:           { lat: number; long: number };
  capacity:         number | null;
  opened:           number | null;
  demolished:       number | null;
  /** Ground elevation in meters above sea level. Optional — added
   *  via scripts/enrich-elevation.mjs in the wc-api repo; old or
   *  newly-added rows may not have it yet. */
  elevationM?:      number | null;
  tournaments:      number[];
  isOpenAir:        boolean;
  notes?:           string;
}

interface StadiumsListResponse { count: number; data: ApiStadium[] }

export async function listStadiums(): Promise<ApiStadium[]> {
  const res = await apiGet<StadiumsListResponse>('/stadiums', {
    revalidate: REVALIDATE.static,
    tags: ['wc:stadiums'],
  });
  return res.data;
}

export async function getStadium(id: string): Promise<ApiStadium | null> {
  try {
    return await apiGet<ApiStadium>(`/stadiums/${id}`, {
      revalidate: REVALIDATE.static,
      tags: [`wc:stadium:${id}`],
    });
  } catch (e) {
    if (String(e).includes(' 404 ')) return null;
    throw e;
  }
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

// ─── Referees ────────────────────────────────────────────────────────

export interface ApiRefereeSummary {
  id:           string;
  name:         string;
  country:      string | null;
  totalMatches: number;
  years:        number[];
  tournaments:  number;
  firstYear:    number;
  lastYear:     number;
  byStage:      Record<string, number>;
}

export interface ApiRefereeDetail extends ApiRefereeSummary {
  matches: Array<{
    id:        string;
    year:      number;
    date:      string;
    stage:     string;
    homeTeam:  string | null;
    awayTeam:  string | null;
    homeScore: number | null;
    awayScore: number | null;
    stadium:   string | null;
    city:      string | null;
  }>;
}

interface ApiRefereeListResponse {
  count:    number;
  returned: number;
  referees: ApiRefereeSummary[];
}

export async function listReferees(limit = 100): Promise<ApiRefereeListResponse> {
  return apiGet<ApiRefereeListResponse>(`/referees?limit=${limit}`, {
    revalidate: REVALIDATE.static,
    tags: ['wc:referees'],
  });
}

export async function getReferee(id: string): Promise<ApiRefereeDetail | null> {
  try {
    return await apiGet<ApiRefereeDetail>(`/referees/${encodeURIComponent(id)}`, {
      revalidate: REVALIDATE.static,
      tags: [`wc:referee:${id}`],
    });
  } catch {
    return null;
  }
}
