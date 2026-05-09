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
import { listTournaments, getTournament, listMatchesByYear, listStadiums, type ApiMatch, type ApiStadium } from '@/lib/wc-api';
import { Flag } from '@/components/Flag';
import { YearStrip } from '@/components/YearStrip';
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
  /** Every year the team reached its best-ever final position. For
   *  Brazil that's 1958/1962/1970/1994/2002 (5× champions); for
   *  Germany it's 1954/1974/1990/2014. Listing only one year would
   *  understate dynasties — the user called this out and they were
   *  right. */
  bestFinishYears: number[];
}

export default async function TeamsPage() {
  const tournaments = await listTournaments();
  const playedYears = tournaments.filter((t) => t.champion).map((t) => t.year);

  // Pull every played tournament + matches + stadiums in parallel.
  // The API caches per-year for 24h so the warm path is fast.
  // Stadiums are cross-year and used to compute distance traveled
  // by each team (great-circle from venue-to-venue across the
  // tournament).
  const [fullsRaw, matchesByYear, stadiums] = await Promise.all([
    Promise.all(playedYears.map((y) => getTournament(y))),
    Promise.all(playedYears.map(async (y) => ({ year: y, list: await listMatchesByYear(y).catch(() => []) }))),
    listStadiums().catch(() => [] as ApiStadium[]),
  ]);
  const fulls = fullsRaw.filter((t): t is NonNullable<typeof t> => !!t);
  const stadiumById = new Map(stadiums.map((s) => [s.id, s]));

  // Aggregate appearances per team across all years.
  const byTeam = new Map<string, TeamRecord>();
  for (const t of fulls) {
    for (const team of t.teams ?? []) {
      let rec = byTeam.get(team.name);
      if (!rec) {
        rec = {
          name:            team.name,
          iso:             team.iso,
          confederation:   team.confederation,
          appearances:     [],
          firstYear:       Infinity,
          lastYear:        -Infinity,
          bestFinish:      null,
          bestFinishYears: [],
        };
        byTeam.set(team.name, rec);
      }
      rec.appearances.push(t.tournament.year);
      rec.firstYear = Math.min(rec.firstYear, t.tournament.year);
      rec.lastYear  = Math.max(rec.lastYear,  t.tournament.year);
      const fp = team.finalPosition;
      if (fp != null) {
        if (rec.bestFinish == null || fp < rec.bestFinish) {
          // New best finish — reset the year list to just this one.
          rec.bestFinish      = fp;
          rec.bestFinishYears = [t.tournament.year];
        } else if (fp === rec.bestFinish) {
          // Tied for best — append this year. Brazil/Germany champions
          // accumulate multiple entries here.
          rec.bestFinishYears.push(t.tournament.year);
        }
      }
    }
  }

  // Sort years lists for stable display.
  for (const rec of byTeam.values()) {
    rec.appearances.sort((a, b) => a - b);
    rec.bestFinishYears.sort((a, b) => a - b);
  }

  const allTeams = Array.from(byTeam.values());
  const totalAppearances = allTeams.reduce((s, t) => s + t.appearances.length, 0);

  // ─── Squad age + captain age ───────────────────────────────────
  // Average age per team-tournament + captain-only average. We use
  // the API's `ageAtTournament` field when set, otherwise derive
  // from `born` against the tournament start (best-effort).

  function ageAtYear(bornISO: string | null | undefined, tournamentYear: number): number | null {
    if (!bornISO) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bornISO);
    if (!m) return null;
    // Approximate: tournament start is mid-year, so age = year - birthYear,
    // minus 1 if their birthday is later than mid-June.
    const born = new Date(bornISO).getTime();
    const ref  = new Date(`${tournamentYear}-06-15`).getTime();
    return Math.max(0, Math.floor((ref - born) / (365.25 * 24 * 3600 * 1000)));
  }

  type TournamentAge = {
    year:        number;
    team:        string;
    avgAge:      number;
    captainAge:  number | null;
    captainName: string | null;
    confederation: string;
    finalPosition: number | null;
  };
  const tournamentAges: TournamentAge[] = [];
  for (const t of fulls) {
    for (const team of t.teams ?? []) {
      const ages: number[] = [];
      let captainAge: number | null = null;
      let captainName: string | null = null;
      for (const p of team.squad ?? []) {
        const a = p.ageAtTournament ?? ageAtYear(p.born, t.tournament.year);
        if (a == null) continue;
        ages.push(a);
        if (p.captain) {
          captainAge = a;
          captainName = p.name;
        }
      }
      if (ages.length === 0) continue;
      const avg = ages.reduce((s, x) => s + x, 0) / ages.length;
      tournamentAges.push({
        year:           t.tournament.year,
        team:           team.name,
        avgAge:         Math.round(avg * 10) / 10,
        captainAge,
        captainName,
        confederation:  team.confederation,
        finalPosition:  team.finalPosition,
      });
    }
  }

  // Youngest / oldest squad ever + youngest / oldest captain.
  const youngestSquad = [...tournamentAges].sort((a, b) => a.avgAge - b.avgAge).slice(0, 5);
  const oldestSquad   = [...tournamentAges].sort((a, b) => b.avgAge - a.avgAge).slice(0, 5);
  const youngestCaptain = [...tournamentAges]
    .filter((r) => r.captainAge != null)
    .sort((a, b) => (a.captainAge ?? 99) - (b.captainAge ?? 99))
    .slice(0, 5);
  const oldestCaptain = [...tournamentAges]
    .filter((r) => r.captainAge != null)
    .sort((a, b) => (b.captainAge ?? 0) - (a.captainAge ?? 0))
    .slice(0, 5);

  // Champion-squad-age timeline — chart of avg age of the winner per year.
  const championAge = fulls
    .map((t) => {
      const champion = t.teams?.find((tm) => tm.name === t.tournament.champion);
      if (!champion) return null;
      const row = tournamentAges.find((a) => a.year === t.tournament.year && a.team === champion.name);
      if (!row) return null;
      return {
        label: String(t.tournament.year),
        value: row.avgAge,
        host:  t.tournament.host,
      };
    })
    .filter((x): x is { label: string; value: number; host: string[] } => x !== null);

  // ─── Distance traveled per team per tournament ─────────────────
  // For each match a team played, project the venue's lat/long onto
  // the great-circle from the team's previous venue (or the venue
  // they played their first match at, with origin = home country
  // capital approximated as zero-distance start). Sum per
  // (team, year). Surfaces marathon teams (Brazil 1986 trekked
  // ~22,000 km criss-crossing Mexico).
  function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371; // km
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const x = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  type Trip = { year: number; team: string; km: number; venues: number; finalPosition: number | null };
  const trips: Trip[] = [];
  for (const { year, list } of matchesByYear) {
    // Group matches by team in chronological order.
    const teamMatches = new Map<string, ApiMatch[]>();
    for (const m of list) {
      if (!m.stadiumId || !m.homeTeam || !m.awayTeam) continue;
      for (const teamName of [m.homeTeam, m.awayTeam]) {
        const arr = teamMatches.get(teamName) ?? [];
        arr.push(m);
        teamMatches.set(teamName, arr);
      }
    }
    // Cross-reference with that tournament's official team list to
    // get finalPosition for the trip leaderboard.
    const tournament = fulls.find((t) => t.tournament.year === year);
    const teams = tournament?.teams ?? [];
    for (const [teamName, ms] of teamMatches) {
      const sorted = [...ms].sort((a, b) =>
        (a.kickoffUtc ?? a.date).localeCompare(b.kickoffUtc ?? b.date),
      );
      let km = 0;
      let prev: { lat: number; lng: number } | null = null;
      const venuesSeen = new Set<string>();
      for (const m of sorted) {
        const stadium = stadiumById.get(m.stadiumId!);
        if (!stadium || !stadium.coords) continue;
        const here = { lat: stadium.coords.lat, lng: stadium.coords.long };
        venuesSeen.add(stadium.id);
        if (prev) km += haversine(prev, here);
        prev = here;
      }
      const finalPosition = teams.find((tm) => tm.name === teamName)?.finalPosition ?? null;
      trips.push({ year, team: teamName, km: Math.round(km), venues: venuesSeen.size, finalPosition });
    }
  }
  // Top trips — most-traveled team-tournaments.
  const topTrips = [...trips]
    .filter((t) => t.km > 0)
    .sort((a, b) => b.km - a.km)
    .slice(0, 12);

  // ─── Coaches ────────────────────────────────────────────────────
  // Coaches across tournaments. The wc-api ApiTeam has coach.name +
  // coach.country. A coach who appears in multiple tournament-rows
  // with the same name is a "repeat coach" — list with their
  // tournaments + best result.
  type CoachRecord = { name: string; country: string; tournaments: { year: number; team: string; finalPosition: number | null }[] };
  const coachByName = new Map<string, CoachRecord>();
  for (const t of fulls) {
    for (const team of t.teams ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coach = (team as any).coach;
      if (!coach || !coach.name) continue;
      let rec = coachByName.get(coach.name);
      if (!rec) {
        rec = { name: coach.name, country: coach.country ?? '', tournaments: [] };
        coachByName.set(coach.name, rec);
      }
      rec.tournaments.push({
        year:          t.tournament.year,
        team:          team.name,
        finalPosition: team.finalPosition,
      });
    }
  }
  const repeatCoaches = Array.from(coachByName.values())
    .filter((c) => c.tournaments.length > 1)
    .sort((a, b) =>
      b.tournaments.length - a.tournaments.length ||
      (Math.min(...a.tournaments.map((x) => x.finalPosition ?? 99))
        - Math.min(...b.tournaments.map((x) => x.finalPosition ?? 99))),
    )
    .slice(0, 10);

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

          {/* Year strip — quick jump to per-tournament drill-down. */}
          <div className="mt-6">
            <YearStrip years={playedYears} label="Jump to a tournament" />
          </div>

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
                      {t.bestFinishYears.length > 1 && (
                        <span className="text-ink-400 font-normal text-xs ml-1">×{t.bestFinishYears.length}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-ink-500 font-mono">
                      {t.bestFinishYears.join(', ')}
                    </div>
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

      {/* Squad ages — youngest/oldest squad + captains */}
      <section className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Youngest squads ever"
          subtitle="Lowest avg age across the 23/26-man roster"
          source="mean(ageAtTournament) over team.squad"
        >
          <ol className="space-y-1 text-sm">
            {youngestSquad.map((r, i) => (
              <li key={`${r.year}-${r.team}`}>
                <div className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-ink-800/40">
                  <span className="text-[11px] font-mono text-ink-500 w-5 text-right">{i + 1}.</span>
                  <Flag country={r.team} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{r.team}</div>
                    <div className="text-[10px] text-ink-500">{r.year} · {r.confederation}{r.finalPosition != null ? ` · #${r.finalPosition}` : ''}</div>
                  </div>
                  <div className="text-sm font-bold text-accent-gold font-mono tabular-nums">{r.avgAge.toFixed(1)}</div>
                </div>
              </li>
            ))}
          </ol>
        </ChartCard>

        <ChartCard
          title="Oldest squads ever"
          subtitle="Highest avg age across the roster"
          source="mean(ageAtTournament) over team.squad"
        >
          <ol className="space-y-1 text-sm">
            {oldestSquad.map((r, i) => (
              <li key={`${r.year}-${r.team}`}>
                <div className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-ink-800/40">
                  <span className="text-[11px] font-mono text-ink-500 w-5 text-right">{i + 1}.</span>
                  <Flag country={r.team} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{r.team}</div>
                    <div className="text-[10px] text-ink-500">{r.year} · {r.confederation}{r.finalPosition != null ? ` · #${r.finalPosition}` : ''}</div>
                  </div>
                  <div className="text-sm font-bold text-accent-gold font-mono tabular-nums">{r.avgAge.toFixed(1)}</div>
                </div>
              </li>
            ))}
          </ol>
        </ChartCard>

        <ChartCard
          title="Youngest captains"
          subtitle="Captain age at tournament start"
          source="team.squad[captain==true].ageAtTournament"
        >
          <ol className="space-y-1 text-sm">
            {youngestCaptain.map((r, i) => (
              <li key={`${r.year}-${r.team}`}>
                <div className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-ink-800/40">
                  <span className="text-[11px] font-mono text-ink-500 w-5 text-right">{i + 1}.</span>
                  <Flag country={r.team} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{r.captainName}</div>
                    <div className="text-[10px] text-ink-500">{r.team} · {r.year}</div>
                  </div>
                  <div className="text-sm font-bold text-accent-gold font-mono tabular-nums">{r.captainAge}</div>
                </div>
              </li>
            ))}
          </ol>
        </ChartCard>

        <ChartCard
          title="Oldest captains"
          subtitle="Captain age at tournament start"
          source="team.squad[captain==true].ageAtTournament"
        >
          <ol className="space-y-1 text-sm">
            {oldestCaptain.map((r, i) => (
              <li key={`${r.year}-${r.team}`}>
                <div className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-ink-800/40">
                  <span className="text-[11px] font-mono text-ink-500 w-5 text-right">{i + 1}.</span>
                  <Flag country={r.team} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{r.captainName}</div>
                    <div className="text-[10px] text-ink-500">{r.team} · {r.year}</div>
                  </div>
                  <div className="text-sm font-bold text-accent-gold font-mono tabular-nums">{r.captainAge}</div>
                </div>
              </li>
            ))}
          </ol>
        </ChartCard>
      </section>

      {/* Champion squad-age timeline */}
      {championAge.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-2">
          <ChartCard
            title="Champion squad — average age per tournament"
            subtitle="Are champions getting older or younger over time?"
            source="winningTeam.squad mean age"
          >
            <BarSeries data={championAge} color={SERIES_COLORS.brand} valueLabel="avg age" height={240} />
          </ChartCard>
        </section>
      )}

      {/* Distance traveled */}
      {topTrips.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Most-traveled team-tournaments"
            subtitle="Sum of great-circle km between consecutive match venues"
            source="haversine(stadium[i], stadium[i+1]) over chronological matches"
          >
            <ol className="space-y-1 text-sm">
              {topTrips.map((r, i) => (
                <li key={`${r.year}-${r.team}`}>
                  <div className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-ink-800/40">
                    <span className="text-[11px] font-mono text-ink-500 w-5 text-right">{i + 1}.</span>
                    <Flag country={r.team} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{r.team}</div>
                      <div className="text-[10px] text-ink-500">
                        {r.year} · {r.venues} venue{r.venues === 1 ? '' : 's'}
                        {r.finalPosition != null ? ` · #${r.finalPosition}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-accent-gold font-mono tabular-nums">
                        {r.km.toLocaleString()}<span className="text-[10px] text-ink-400 font-normal ml-1">km</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </ChartCard>

          {/* Repeat coaches */}
          <ChartCard
            title="Repeat coaches"
            subtitle="Managers who led a team at more than one World Cup"
            source="team.coach.name grouped across tournaments"
          >
            {repeatCoaches.length === 0 ? (
              <div className="text-xs text-ink-500">No repeat coaches in the dataset.</div>
            ) : (
              <ol className="space-y-1 text-sm">
                {repeatCoaches.map((c, i) => {
                  const bestFp = Math.min(...c.tournaments.map((t) => t.finalPosition ?? 99));
                  return (
                    <li key={c.name}>
                      <div className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-ink-800/40">
                        <span className="text-[11px] font-mono text-ink-500 w-5 text-right">{i + 1}.</span>
                        {c.country && <Flag country={c.country} />}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{c.name}</div>
                          <div className="text-[10px] text-ink-500 truncate">
                            {c.tournaments.map((t) => `${t.team} ${t.year}`).join(' · ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-accent-gold font-mono tabular-nums">
                            {c.tournaments.length}×
                          </div>
                          {bestFp < 99 && (
                            <div className="text-[10px] text-ink-500 font-mono">best #{bestFp}</div>
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
      )}

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
                        ? <span className="text-accent-gold">
                            #{t.bestFinish}{t.bestFinishYears.length > 1 ? ` ×${t.bestFinishYears.length}` : ''}{' '}
                            <span className="text-ink-500 text-[10px]">({t.bestFinishYears.join(', ')})</span>
                          </span>
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
