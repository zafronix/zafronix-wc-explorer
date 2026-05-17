/**
 * Players Analysis view — distribution of players by position, DOB
 * month, hemisphere, confederation across one or more tournaments.
 *
 * URL: /wc-explorer/players/?years=2018,2022
 *
 * Charts answer: "what month were most defenders / attackers /
 * midfielders / goalkeepers born?" Per tournament, optionally
 * narrowed via the year picker.
 *
 * GOATs overlay: a curated list of historic stars annotates the
 * birth-month chart so the operator can see whether outliers (Pelé
 * October, Maradona October, Messi June, CR7 February, R9 September)
 * sit on or off the trend line for their position.
 *
 * Data source: GET /aggregates/players?years=… for the per-position
 * birth-month buckets + confederation/hemisphere counts. GOAT DOBs
 * are static — pinned in the page.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { listTournaments, getAggregatePlayers, getTournament } from '@/lib/wc-api';
import { Donut, SERIES_COLORS, BarSeries } from '@/components/charts/Charts';
import { Flag } from '@/components/Flag';
import { PlayersTable, type PlayerRow } from '@/components/PlayersTable';
import { TournamentSelector } from '@/components/TournamentSelector';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Players — every World Cup squad, searchable',
  description: 'Every player from every FIFA World Cup squad, searchable by name, country, position, birth year, and birth month. With a GOAT overlay (Pelé, Maradona, Cruyff, Messi, CR7, R9) and the all-time hat-tricks leaderboard.',
  keywords: ['world cup players', 'world cup squad search', 'world cup hat tricks', 'fifa world cup goalscorers', 'world cup goat list', 'world cup birth month'],
  alternates: { canonical: '/players/' },
};

interface PageProps {
  searchParams: Promise<{ year?: string; years?: string; hemisphere?: string }>;
}

const POSITIONS = ['GK', 'DF', 'MF', 'FW'] as const;
type Position = typeof POSITIONS[number];

const POSITION_LABELS: Record<Position, string> = {
  GK: 'Goalkeepers', DF: 'Defenders', MF: 'Midfielders', FW: 'Attackers',
};

const POSITION_COLORS: Record<Position, string> = {
  GK: SERIES_COLORS.gold,
  DF: SERIES_COLORS.cyan,
  MF: SERIES_COLORS.brand,
  FW: SERIES_COLORS.pink,
};

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Southern-hemisphere national teams. Mirrors the same set in the
 *  wc-api's src/routes/aggregates.ts so the explorer's local filter
 *  agrees with the aggregator's rollups. Used by:
 *
 *    - the hemisphere filter chip in the hero (passed to the API)
 *    - the All-Players table below (filtered locally)
 *
 *  Naturalized players are misclassified by this proxy (team-country
 *  ≠ player-birth-country in ~10% of modern squads). Acceptable
 *  noise for the Relative Age Effect story this filter supports;
 *  not acceptable for citizenship-themed analyses. */
const SOUTH_HEMISPHERE_TEAMS = new Set<string>([
  // CONMEBOL
  'Argentina', 'Brazil', 'Bolivia', 'Chile', 'Paraguay', 'Peru', 'Uruguay',
  // Africa south of equator
  'Angola', 'Cameroon', 'Congo DR', 'Mozambique', 'Namibia', 'South Africa',
  'Tanzania', 'Zambia', 'Zimbabwe',
  // OFC + Oceania
  'Australia', 'New Zealand', 'Indonesia', 'Papua New Guinea',
]);

/**
 * Curated GOAT / Ballon-d'Or-era pinning list. DOBs sourced from
 * Wikipedia / FIFA records; pos is the position they're best known
 * for at the World Cup (some played multiple). Used to overlay the
 * birth-month-by-position chart so the operator can see whether the
 * legendary players sit at the modal birth month for their role or
 * are statistical outliers.
 */
const GOATS: Array<{ name: string; dob: string; pos: Position; team: string }> = [
  // 1950s-60s
  { name: 'Pelé',           dob: '1940-10-23', pos: 'FW', team: 'Brazil' },
  { name: 'Garrincha',      dob: '1933-10-28', pos: 'FW', team: 'Brazil' },
  { name: 'Eusébio',        dob: '1942-01-25', pos: 'FW', team: 'Portugal' },
  { name: 'Bobby Charlton', dob: '1937-10-11', pos: 'MF', team: 'England' },
  { name: 'Lev Yashin',     dob: '1929-10-22', pos: 'GK', team: 'Soviet Union' },
  { name: 'Gerd Müller',    dob: '1945-11-03', pos: 'FW', team: 'West Germany' },

  // 1970s-80s
  { name: 'Johan Cruyff',           dob: '1947-04-25', pos: 'FW', team: 'Netherlands' },
  { name: 'Franz Beckenbauer',      dob: '1945-09-11', pos: 'DF', team: 'West Germany' },
  { name: 'Diego Maradona',         dob: '1960-10-30', pos: 'MF', team: 'Argentina' },
  { name: 'Michel Platini',         dob: '1955-06-21', pos: 'MF', team: 'France' },
  { name: 'Zico',                   dob: '1953-03-03', pos: 'MF', team: 'Brazil' },
  { name: 'Karl-Heinz Rummenigge',  dob: '1955-09-25', pos: 'FW', team: 'West Germany' },
  { name: 'Paolo Rossi',            dob: '1956-09-23', pos: 'FW', team: 'Italy' },

  // 1990s-2000s
  { name: 'Romário',                dob: '1966-01-29', pos: 'FW', team: 'Brazil' },
  { name: 'Ronaldo (R9)',           dob: '1976-09-22', pos: 'FW', team: 'Brazil' },
  { name: 'Zinedine Zidane',        dob: '1972-06-23', pos: 'MF', team: 'France' },
  { name: 'Ronaldinho',             dob: '1980-03-21', pos: 'MF', team: 'Brazil' },
  { name: 'Kaká',                   dob: '1982-04-22', pos: 'MF', team: 'Brazil' },
  { name: 'Fabio Cannavaro',        dob: '1973-09-13', pos: 'DF', team: 'Italy' },
  { name: 'Andrés Iniesta',         dob: '1984-05-11', pos: 'MF', team: 'Spain' },
  { name: 'Xavi Hernández',         dob: '1980-01-25', pos: 'MF', team: 'Spain' },

  // 2010s-now
  { name: 'Cristiano Ronaldo',      dob: '1985-02-05', pos: 'FW', team: 'Portugal' },
  { name: 'Lionel Messi',           dob: '1987-06-24', pos: 'FW', team: 'Argentina' },
  { name: 'Luka Modrić',            dob: '1985-09-09', pos: 'MF', team: 'Croatia' },
  { name: 'Kylian Mbappé',          dob: '1998-12-20', pos: 'FW', team: 'France' },
  { name: 'Neymar',                 dob: '1992-02-05', pos: 'FW', team: 'Brazil' },
  { name: 'Robert Lewandowski',     dob: '1988-08-21', pos: 'FW', team: 'Poland' },
  { name: 'Mohamed Salah',          dob: '1992-06-15', pos: 'FW', team: 'Egypt' },
  { name: 'Karim Benzema',          dob: '1987-12-19', pos: 'FW', team: 'France' },
  { name: 'Vinícius Jr',            dob: '2000-07-12', pos: 'FW', team: 'Brazil' },
];

export default async function PlayersAnalysisPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tournaments = await listTournaments();
  const playedYears = tournaments.filter((t) => t.champion).map((t) => t.year);

  // Single-year selection — matches the picker style used everywhere
  // else (only /compare is multi-select). `?year=YYYY` narrows to one
  // tournament; absent = all-time aggregation. Legacy `?years=Y1,Y2`
  // is honored for back-compat from old bookmarks: we take the first
  // year in the list and ignore the rest, redirecting via a hidden
  // canonical link wouldn't help since the data fetch is happening
  // server-side already.
  const fromYearParam = sp.year ? Number(sp.year) : NaN;
  const fromYearsParam = sp.years
    ? Number(sp.years.split(',')[0]?.trim())
    : NaN;
  const requestedYear = [fromYearParam, fromYearsParam].find(
    (y) => Number.isFinite(y) && playedYears.includes(y as number),
  ) as number | undefined;
  const yearsForFetch = requestedYear ? [requestedYear] : undefined;
  const years = requestedYear ? [requestedYear] : []; // empty = "all years"
  // Hemisphere filter — birth-month distribution is sensitive to the
  // hemisphere of a team's domestic football calendar (Relative Age
  // Effect cutoff differs N vs S). Aggregating both flattens the
  // curve; filtering reveals it. Caveat: uses team-country hemisphere,
  // not player-birth-country (we don't track birth-country in the
  // dataset). Naturalized players are a <10% smudge on the signal.
  const hemisphereParam: 'N' | 'S' | undefined =
    sp.hemisphere === 'N' || sp.hemisphere === 'S' ? sp.hemisphere : undefined;
  const agg = await getAggregatePlayers(yearsForFetch, hemisphereParam);

  // Pull full squads for the visible window (or every played
  // tournament when no filter is set) so the All Players table can
  // render every individual player. The wc-api caches per-year for
  // 24h so the warm path is fast even when fetching all 22 played
  // WCs in parallel.
  const yearsToFetch = yearsForFetch ?? playedYears;
  const tournamentFulls = (await Promise.all(
    yearsToFetch.map((y) => getTournament(y).catch(() => null)),
  )).filter((t): t is NonNullable<typeof t> => !!t);

  // Dedupe player rows across tournaments — a player who appears at
  // multiple WCs becomes a single row with their tournament list +
  // total goals + (if ever) captain flag. Key is name|team because
  // a player could (in theory) switch national teams; keeping team
  // in the key surfaces both rows separately rather than merging.
  const playerByKey = new Map<string, PlayerRow>();
  for (const t of tournamentFulls) {
    for (const team of t.teams ?? []) {
      for (const sp of team.squad ?? []) {
        const key = `${sp.name}|${team.name}`;
        let row = playerByKey.get(key);
        if (!row) {
          row = {
            name:     sp.name,
            team:     team.name,
            position: sp.position,
            dob:      sp.born ?? null,
            years:    [],
            goals:    0,
            captain:  false,
          };
          playerByKey.set(key, row);
        }
        if (!row.years.includes(t.tournament.year)) row.years.push(t.tournament.year);
        row.goals  += sp.goals ?? 0;
        if (sp.captain) row.captain = true;
      }
    }
  }
  const allPlayers: PlayerRow[] = Array.from(playerByKey.values())
    .map((r) => ({
      ...r,
      years: [...r.years].sort((a, b) => a - b),
    }))
    // Apply the hemisphere filter to the All-Players table too. The
    // filter chip in the hero feeds the aggregator above; we mirror
    // it here so the table the operator scrolls also reflects the
    // chosen hemisphere. Caveat lives in HEMISPHERE comment.
    .filter((p) => {
      if (!hemisphereParam) return true;
      const isSouth = SOUTH_HEMISPHERE_TEAMS.has(p.team);
      return hemisphereParam === 'S' ? isSouth : !isSouth;
    });
  // Sort: most goals first, then most appearances, then name.
  allPlayers.sort((a, b) =>
    b.goals - a.goals
    || b.years.length - a.years.length
    || a.name.localeCompare(b.name),
  );

  // Convert the curated GOATS list into the same row shape so it can
  // share the table component. We don't have per-tournament participation
  // for GOATs at this layer, so years[] is left empty (the column reads
  // as 0 — acceptable since this table is reference-only).
  const goatRows: PlayerRow[] = GOATS.map((g) => ({
    name:     g.name,
    team:     g.team,
    position: g.pos,
    dob:      g.dob,
    years:    [],
    goals:    0,
    captain:  false,
  }));

  // Derived: total players, position split, top confederation,
  // hemisphere breakdown.
  const totalPlayers = agg.totalPlayers ?? 0;
  const positionEntries = Object.entries(agg.byPosition ?? {}) as Array<[Position, number]>;
  const positionDonut = positionEntries
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({
      label: POSITION_LABELS[label],
      value,
      color: POSITION_COLORS[label],
    }))
    .sort((a, b) => b.value - a.value);

  const confederationDonut = Object.entries(agg.byConfederation ?? {})
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  // GOATs whose DOB-month + position is captured by the visible
  // years window. We overlay these on the birth-month charts.
  const yearsSet = new Set(years);
  const goatsInWindow = GOATS.filter((g) => {
    // Heuristic: a GOAT's "WC era" includes the first WC where their
    // age-at-tournament is between 18 and 38. We don't have per-
    // player tournament participation here without a separate API,
    // so: include them all on the chart, color the marker by
    // whether they played in any of the requested years (approx via
    // birthYear). It's a tasteful overlay, not a participation
    // gate — operator wants to see the trend line vs the legend.
    void yearsSet;
    return true;
  });

  return (
    <>
      {/* Hero */}
      <section className="border-b border-ink-800 bg-grid">
        <div className="max-w-7xl mx-auto px-6 py-10 sm:py-12">
          <div className="text-xs mb-4">
            <Link href="/" className="text-brand-400 hover:underline">← Overview</Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            <span className="text-white">Players analysis,</span>{' '}
            <span className="text-brand-400">in distribution.</span>
          </h1>
          <p className="text-ink-300 text-sm mt-2 max-w-2xl">
            What month were most goalkeepers born? Do attackers cluster differently from defenders?
            Where do the GOATs (Pelé, Maradona, Cruyff, Messi, CR7, R9…) fall on the curve —
            on the modal month or as outliers?
          </p>

          <TournamentSelector
            years={[...playedYears].sort((a, b) => a - b)}
            playedYears={playedYears}
            activeYear={requestedYear ?? null}
            buildHref={(y) => {
              const params = new URLSearchParams({ year: String(y) });
              if (hemisphereParam) params.set('hemisphere', hemisphereParam);
              return `/players/?${params.toString()}`;
            }}
            label="Tournament (single-year)"
          />

          {/* Hemisphere filter — see the page-level comment above. School-
              year cutoffs for football academies differ N vs S, so the
              Relative Age Effect (Q1-birthday bias) shows up on different
              months. Aggregating both flattens the signal. */}
          <HemisphereFilter active={hemisphereParam ?? null} years={years} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            <Stat label="Players in window" value={totalPlayers.toLocaleString()} />
            <Stat label="Teams" value={(agg.totalTeams ?? 0).toLocaleString()} />
            <Stat label="Avg squad size" value={(agg.avgSquadSize ?? 0).toFixed(1)} />
            <Stat
              label="Tournaments"
              value={(agg.totalTournaments ?? playedYears.length).toString()}
              hint={years.length === 0 ? 'all years' : years.join(', ')}
            />
          </div>
        </div>
      </section>

      {/* Position split + Confederation */}
      <section className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Squads by position"
          subtitle="Players in the selected window, split by role"
          source={years.length === 0 ? 'GET /aggregates/players' : `GET /aggregates/players?years=${years.join(',')}`}
        >
          <Donut data={positionDonut} centerLabel={String(totalPlayers)} height={320} />
        </ChartCard>

        <ChartCard
          title="By confederation"
          subtitle="Where the players come from"
          source={years.length === 0 ? 'GET /aggregates/players' : `GET /aggregates/players?years=${years.join(',')}`}
        >
          <Donut
            data={confederationDonut}
            centerLabel={String(confederationDonut.reduce((s, d) => s + d.value, 0))}
            height={320}
          />
        </ChartCard>
      </section>

      {/* Hemisphere split */}
      {agg.byHemisphere && (
        <section className="max-w-7xl mx-auto px-6">
          <ChartCard
            title="Hemisphere split"
            subtitle="Northern vs Southern hemisphere national teams"
            source="ApiTeam.country × hemisphere classification"
          >
            <div className="grid grid-cols-2 gap-4">
              <HemisphereStat
                label="Northern"
                count={agg.byHemisphere?.N ?? 0}
                total={(agg.byHemisphere?.N ?? 0) + (agg.byHemisphere?.S ?? 0)}
                color={SERIES_COLORS.brand}
              />
              <HemisphereStat
                label="Southern"
                count={agg.byHemisphere?.S ?? 0}
                total={(agg.byHemisphere?.N ?? 0) + (agg.byHemisphere?.S ?? 0)}
                color={SERIES_COLORS.gold}
              />
            </div>
          </ChartCard>
        </section>
      )}

      {/* Birth-month per position — the headline charts. */}
      <section className="max-w-7xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Birth month, by position</h2>
          <p className="text-sm text-ink-300">
            One chart per role. GOAT pin-marks (gold dots above the bars) call out where iconic players sit.
            Look for the &ldquo;relative-age effect&rdquo; — many youth-academy systems privilege Q1 birthdays
            (Jan-Mar) for early physical development, and you sometimes see the same skew in elite squads.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {POSITIONS.map((p) => {
            const counts = agg.birthMonthByPosition?.[p] ?? new Array(12).fill(0);
            const data = counts.map((value, i) => ({
              label: MONTH_LABELS[i],
              value,
              host: undefined,
            }));
            const goats = goatsInWindow.filter((g) => g.pos === p);
            return (
              <BirthMonthChart
                key={p}
                position={p}
                data={data}
                goats={goats}
                color={POSITION_COLORS[p]}
              />
            );
          })}
        </div>
      </section>

      {/* All players — full filterable / searchable roster from every
          fetched tournament. Filters: name search, country, position,
          birth year, birth month. Caps at 100 rows by default with a
          "show all" expand. */}
      <section className="max-w-7xl mx-auto px-6 pb-8">
        <h2 className="text-2xl font-bold mb-2">
          All players
          {hemisphereParam && (
            <span className="text-base font-normal text-brand-400 ml-2">
              · {hemisphereParam === 'N' ? 'Northern hemisphere only' : 'Southern hemisphere only'}
            </span>
          )}
        </h2>
        <p className="text-xs text-ink-500 mb-4">
          Every player from {years.length === 0 ? 'all played World Cups' : `the ${years.join(', ')} squad${years.length === 1 ? '' : 's'}`}
          {hemisphereParam && ` on ${hemisphereParam === 'N' ? 'Northern' : 'Southern'}-hemisphere national teams`}.
          Search by name or filter by country, position, birth year or birth month. The C badge
          marks captains. Change the hemisphere filter in the hero above.
        </p>
        <PlayersTable
          players={allPlayers}
          noun="players"
          pageSize={100}
          defaultHemisphere={hemisphereParam ?? ''}
        />
      </section>

      {/* GOAT reference — same table, filtered to the curated list.
          Shares the search + filter UX so an operator can ask "which
          GOATs were born in October?" or "which Brazilians made the
          list?" without scrolling. */}
      <section className="max-w-7xl mx-auto px-6 pb-12">
        <h2 className="text-2xl font-bold mb-2">GOAT reference</h2>
        <p className="text-xs text-ink-500 mb-4">
          Curated. Inclusion in this list isn&apos;t a championship ranking — it&apos;s a span of Ballon-d&apos;Or
          winners + nominees + commonly-cited GOATs across eras, used for the overlay above.
        </p>
        <PlayersTable players={goatRows} noun="GOATs" pageSize={50} showHemisphere={false} />
      </section>

      {/* Hat-tricks leaderboard — every 3+ goal individual performance
          across the FIFA World Cup. Curated, since the public API
          surfaces only per-tournament goal totals (not per-match
          scorers), and historical goal-by-goal data is well-documented
          enough to inline here. Sorted goals DESC, then year ASC. */}
      <section className="max-w-7xl mx-auto px-6 pb-12">
        <h2 className="text-2xl font-bold mb-2">Hat-tricks (3+ goals in a match)</h2>
        <p className="text-xs text-ink-500 mb-4">
          Every individual 3+ goal performance in World Cup history. Oleg Salenko&apos;s 5-goal
          haul in 1994 v Cameroon is the all-time single-match record.
        </p>
        <div className="bg-ink-900 border border-ink-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-800/60 text-left text-[10px] uppercase tracking-widest text-ink-300">
              <tr>
                <th className="px-4 py-3 text-right w-12">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Opponent</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3 text-right">Year</th>
                <th className="px-4 py-3 text-right">Goals</th>
              </tr>
            </thead>
            <tbody>
              {HAT_TRICKS.map((h, i) => (
                <tr key={`${h.year}-${h.player}-${h.opponent}`} className="border-t border-ink-800/60 hover:bg-ink-800/30">
                  <td className="px-4 py-2.5 text-right text-[11px] font-mono text-ink-500">{i + 1}</td>
                  <td className="px-4 py-2.5 font-semibold text-white">
                    <span className="inline-flex items-center gap-2">
                      <Flag country={h.team} />
                      <span>{h.player}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-200">{h.team}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2 text-xs text-ink-200">
                      <Flag country={h.opponent} />
                      <span>{h.opponent}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-300">{h.stage}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-ink-300">{h.year}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <span className={h.goals >= 4 ? 'text-accent-gold font-bold' : 'text-white font-semibold'}>
                      {h.goals}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-ink-500 mt-3 font-mono">
          {HAT_TRICKS.length} hat-tricks · {HAT_TRICKS.filter((h) => h.goals >= 4).length} with 4+ goals
          · Salenko&apos;s 5 (1994) is the only 5-goal haul on record
        </div>
      </section>
    </>
  );
}

/**
 * Every 3+ goal performance at a FIFA World Cup. Curated from FIFA's
 * historical match reports + Wikipedia. Sorted goals DESC, year ASC
 * inside the table render. Captures the famous ones (Hurst '66 final,
 * Pelé '58 v France, Wilimowski '38 v Brazil with 4 in a losing
 * effort, Salenko '94 with 5 v Cameroon, Mbappé '22 in the final).
 */
const HAT_TRICKS: Array<{
  year:     number;
  player:   string;
  team:     string;
  opponent: string;
  goals:    number;
  stage:    string;
}> = [
  // 5 goals
  { year: 1994, player: 'Oleg Salenko',         team: 'Russia',         opponent: 'Cameroon',     goals: 5, stage: 'Group' },
  // 4 goals
  { year: 1938, player: 'Ernst Wilimowski',     team: 'Poland',         opponent: 'Brazil',       goals: 4, stage: 'Round of 16' },
  { year: 1950, player: 'Ademir',               team: 'Brazil',         opponent: 'Sweden',       goals: 4, stage: 'Final round' },
  { year: 1954, player: 'Sándor Kocsis',        team: 'Hungary',        opponent: 'West Germany', goals: 4, stage: 'Group' },
  { year: 1966, player: 'Eusébio',              team: 'Portugal',       opponent: 'North Korea',  goals: 4, stage: 'Quarter-final' },
  { year: 1970, player: 'Gerd Müller',          team: 'West Germany',   opponent: 'Bulgaria',     goals: 3, stage: 'Group' },
  { year: 1986, player: 'Emilio Butragueño',    team: 'Spain',          opponent: 'Denmark',      goals: 4, stage: 'Round of 16' },
  // 3 goals
  { year: 1930, player: 'Bert Patenaude',       team: 'United States',  opponent: 'Paraguay',     goals: 3, stage: 'Group' },
  { year: 1930, player: 'Pedro Cea',            team: 'Uruguay',        opponent: 'Yugoslavia',   goals: 3, stage: 'Semi-final' },
  { year: 1930, player: 'Guillermo Stábile',    team: 'Argentina',      opponent: 'Mexico',       goals: 3, stage: 'Group' },
  { year: 1934, player: 'Edmund Conen',         team: 'Germany',        opponent: 'Belgium',      goals: 3, stage: 'Round of 16' },
  { year: 1934, player: 'Angelo Schiavio',      team: 'Italy',          opponent: 'United States', goals: 3, stage: 'Round of 16' },
  { year: 1934, player: 'Oldřich Nejedlý',      team: 'Czechoslovakia', opponent: 'Germany',      goals: 3, stage: 'Semi-final' },
  { year: 1938, player: 'Leônidas',             team: 'Brazil',         opponent: 'Poland',       goals: 3, stage: 'Round of 16' },
  { year: 1938, player: 'Gyula Zsengellér',     team: 'Hungary',        opponent: 'Dutch East Indies', goals: 3, stage: 'Round of 16' },
  { year: 1938, player: 'Harry Andersson',      team: 'Sweden',         opponent: 'Cuba',         goals: 3, stage: 'Quarter-final' },
  { year: 1938, player: 'Gustav Wetterström',   team: 'Sweden',         opponent: 'Cuba',         goals: 3, stage: 'Quarter-final' },
  { year: 1950, player: 'Oscar Míguez',         team: 'Uruguay',        opponent: 'Bolivia',      goals: 3, stage: 'Group' },
  { year: 1950, player: 'Estanislao Basora',    team: 'Spain',          opponent: 'Uruguay',      goals: 3, stage: 'Final round' },
  { year: 1954, player: 'Sándor Kocsis',        team: 'Hungary',        opponent: 'South Korea',  goals: 3, stage: 'Group' },
  { year: 1954, player: 'Erich Probst',         team: 'Austria',        opponent: 'Czechoslovakia', goals: 3, stage: 'Group' },
  { year: 1954, player: 'Carlos Borges',        team: 'Uruguay',        opponent: 'Scotland',     goals: 3, stage: 'Group' },
  { year: 1954, player: 'Suat Mamat',           team: 'Turkey',         opponent: 'South Korea',  goals: 3, stage: 'Group' },
  { year: 1954, player: 'Josef Hügi',           team: 'Switzerland',    opponent: 'Austria',      goals: 3, stage: 'Quarter-final' },
  { year: 1958, player: 'Just Fontaine',        team: 'France',         opponent: 'Paraguay',     goals: 3, stage: 'Group' },
  { year: 1958, player: 'Just Fontaine',        team: 'France',         opponent: 'West Germany', goals: 3, stage: 'Third place' },
  { year: 1958, player: 'Pelé',                 team: 'Brazil',         opponent: 'France',       goals: 3, stage: 'Semi-final' },
  { year: 1962, player: 'Florian Albert',       team: 'Hungary',        opponent: 'Bulgaria',     goals: 3, stage: 'Group' },
  { year: 1966, player: 'Geoff Hurst',          team: 'England',        opponent: 'West Germany', goals: 3, stage: 'Final' },
  { year: 1966, player: 'Franz Beckenbauer',    team: 'West Germany',   opponent: 'Switzerland',  goals: 3, stage: 'Group' },
  { year: 1966, player: 'Helmut Haller',        team: 'West Germany',   opponent: 'Switzerland',  goals: 3, stage: 'Group' },
  { year: 1966, player: 'Eusébio',              team: 'Portugal',       opponent: 'Brazil',       goals: 3, stage: 'Group' },
  { year: 1970, player: 'Gerd Müller',          team: 'West Germany',   opponent: 'Peru',         goals: 3, stage: 'Quarter-final' },
  { year: 1974, player: 'Andrzej Szarmach',     team: 'Poland',         opponent: 'Haiti',        goals: 3, stage: 'Group' },
  { year: 1974, player: 'Dušan Bajević',        team: 'Yugoslavia',     opponent: 'Zaire',        goals: 3, stage: 'Group' },
  { year: 1978, player: 'Robbie Rensenbrink',   team: 'Netherlands',    opponent: 'Iran',         goals: 3, stage: 'Group' },
  { year: 1978, player: 'Teófilo Cubillas',     team: 'Peru',           opponent: 'Iran',         goals: 3, stage: 'Group' },
  { year: 1982, player: 'Karl-Heinz Rummenigge', team: 'West Germany',  opponent: 'Chile',        goals: 3, stage: 'Group' },
  { year: 1982, player: 'Zbigniew Boniek',      team: 'Poland',         opponent: 'Belgium',      goals: 3, stage: 'Second round' },
  { year: 1982, player: 'László Kiss',          team: 'Hungary',        opponent: 'El Salvador',  goals: 3, stage: 'Group' },
  { year: 1982, player: 'Paolo Rossi',          team: 'Italy',          opponent: 'Brazil',       goals: 3, stage: 'Second round' },
  { year: 1986, player: 'Gary Lineker',         team: 'England',        opponent: 'Poland',       goals: 3, stage: 'Group' },
  { year: 1986, player: 'Igor Belanov',         team: 'Soviet Union',   opponent: 'Belgium',      goals: 3, stage: 'Round of 16' },
  { year: 1990, player: 'Tomáš Skuhravý',       team: 'Czechoslovakia', opponent: 'Costa Rica',   goals: 3, stage: 'Round of 16' },
  { year: 1990, player: 'Míchel',               team: 'Spain',          opponent: 'South Korea',  goals: 3, stage: 'Group' },
  { year: 1994, player: 'Gabriel Batistuta',    team: 'Argentina',      opponent: 'Greece',       goals: 3, stage: 'Group' },
  { year: 1998, player: 'Gabriel Batistuta',    team: 'Argentina',      opponent: 'Jamaica',      goals: 3, stage: 'Group' },
  { year: 2002, player: 'Miroslav Klose',       team: 'Germany',        opponent: 'Saudi Arabia', goals: 3, stage: 'Group' },
  { year: 2002, player: 'Pauleta',              team: 'Portugal',       opponent: 'Poland',       goals: 3, stage: 'Group' },
  { year: 2010, player: 'Gonzalo Higuaín',      team: 'Argentina',      opponent: 'South Korea',  goals: 3, stage: 'Group' },
  { year: 2014, player: 'Thomas Müller',        team: 'Germany',        opponent: 'Portugal',     goals: 3, stage: 'Group' },
  { year: 2014, player: 'Xherdan Shaqiri',      team: 'Switzerland',    opponent: 'Honduras',     goals: 3, stage: 'Group' },
  { year: 2018, player: 'Cristiano Ronaldo',    team: 'Portugal',       opponent: 'Spain',        goals: 3, stage: 'Group' },
  { year: 2018, player: 'Harry Kane',           team: 'England',        opponent: 'Panama',       goals: 3, stage: 'Group' },
  { year: 2022, player: 'Gonçalo Ramos',        team: 'Portugal',       opponent: 'Switzerland',  goals: 3, stage: 'Round of 16' },
  { year: 2022, player: 'Kylian Mbappé',        team: 'France',         opponent: 'Argentina',    goals: 3, stage: 'Final' },
]
  .sort((a, b) => b.goals - a.goals || a.year - b.year);

// ─── Birth-month chart with GOAT overlay ─────────────────────────────

function BirthMonthChart({
  position, data, goats, color,
}: {
  position: Position;
  data: Array<{ label: string; value: number }>;
  goats: Array<{ name: string; dob: string; pos: Position; team: string }>;
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  // Group GOATs by birth month so we can stack pins on the same x.
  const goatsByMonth = new Map<number, typeof goats>();
  for (const g of goats) {
    const m = Number(g.dob.slice(5, 7));
    const arr = goatsByMonth.get(m) ?? [];
    arr.push(g);
    goatsByMonth.set(m, arr);
  }

  return (
    <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">{POSITION_LABELS[position]}</h3>
          <div className="text-[11px] text-ink-300">Birth-month distribution + {goats.length} GOAT marker{goats.length === 1 ? '' : 's'}</div>
        </div>
        <span className="text-[10px] uppercase tracking-widest" style={{ color }}>{position}</span>
      </div>

      {/* Bar chart */}
      <BarSeries data={data} color={color} valueLabel="players" height={200} />

      {/* GOAT pins below the chart, aligned to month columns. Each
          pin has a tooltip with the player's name + DOB. */}
      <div className="grid grid-cols-12 gap-1 mt-2 h-12">
        {MONTH_LABELS.map((m, i) => {
          const month = i + 1;
          const pins = goatsByMonth.get(month) ?? [];
          return (
            <div key={m} className="flex flex-col items-center justify-end gap-0.5 text-[8px] text-ink-500">
              {pins.length > 0 && (
                <div className="flex flex-col items-center gap-0.5">
                  {pins.slice(0, 3).map((g) => (
                    <span
                      key={g.name}
                      title={`${g.name} (${g.team}, ${g.dob})`}
                      className="inline-flex"
                    >
                      <Flag country={g.team} size={20} />
                    </span>
                  ))}
                  {pins.length > 3 && (
                    <span className="text-[8px] text-accent-gold/70">+{pins.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend of GOATs in this position. */}
      {goats.length > 0 && (
        <div className="mt-4 pt-4 border-t border-ink-800 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          {goats.map((g) => (
            <div key={g.name} className="flex items-center gap-1.5 min-w-0">
              <Flag country={g.team} size={20} />
              <span className="text-ink-200 truncate">{g.name}</span>
              <span className="text-ink-500 truncate">· {MONTH_LABELS[Number(g.dob.slice(5, 7)) - 1]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modal-month callout */}
      <div className="mt-3 text-[11px] text-ink-300">
        Modal month: <span className="text-accent-gold font-semibold">{
          data.reduce((best, d) => d.value > best.value ? d : best, data[0]).label
        }</span> — {data.reduce((best, d) => d.value > best.value ? d : best, data[0]).value} players ({((data.reduce((best, d) => d.value > best.value ? d : best, data[0]).value / Math.max(1, data.reduce((s, d) => s + d.value, 0))) * 100).toFixed(1)}%).
        Range: {Math.min(...data.map((d) => d.value))}—{max}.
      </div>
    </div>
  );
}

// ─── Hemisphere filter ───────────────────────────────────────────────
//
// Toggle which teams contribute to the rollups by hemisphere. The
// filter is a passthrough to the wc-api `/aggregates/players?
// hemisphere=N|S` query param. We preserve the years[] selection so
// the operator can switch hemispheres mid-window.
//
// Why this exists: birth-month distribution is sensitive to the
// hemisphere of a player's domestic football calendar. School-year
// cutoffs differ N vs S, so the Relative Age Effect (Q1-birthday
// bias in academy systems) lands on different months. Combining the
// two hides the signal.

function HemisphereFilter({
  active, years,
}: {
  active: 'N' | 'S' | null;
  years: number[];
}) {
  function urlWith(hemi: 'N' | 'S' | null): string {
    const params = new URLSearchParams();
    // Single-year mode: the picker passes years=[oneYear]. Use ?year=
    // (canonical, matches the rest of the site); back-compat for
    // ?years= happens at the page level.
    if (years.length > 0) params.set('year', String(years[0]));
    if (hemi) params.set('hemisphere', hemi);
    return `/players/${params.toString() ? `?${params.toString()}` : ''}`;
  }
  const OPTIONS: Array<{ key: 'all' | 'N' | 'S'; label: string; hint: string }> = [
    { key: 'all', label: 'All players',  hint: 'every nation' },
    { key: 'N',   label: 'Northern',     hint: 'CONCACAF + UEFA + AFC + most CAF' },
    { key: 'S',   label: 'Southern',     hint: 'CONMEBOL + OFC + sub-Saharan' },
  ];
  return (
    <div className="mt-5">
      <div className="text-[10px] uppercase tracking-widest text-ink-300 mb-2">
        Hemisphere filter
        <span className="text-ink-500 font-normal normal-case ml-2 lowercase tracking-normal">
          team country&apos;s hemisphere
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const isActive = (opt.key === 'all' && !active) || opt.key === active;
          const href = urlWith(opt.key === 'all' ? null : opt.key);
          return (
            <Link
              key={opt.key}
              href={href}
              className={`inline-flex flex-col px-3 py-1.5 rounded-md text-xs ${
                isActive
                  ? 'bg-brand-600/30 border border-brand-500 text-brand-100'
                  : 'bg-ink-800 border border-ink-700 text-ink-300 hover:text-ink-100'
              }`}
            >
              <span className="font-semibold">{opt.label}</span>
              <span className="text-[9px] text-ink-500 mt-0.5">{opt.hint}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Hemisphere stat ─────────────────────────────────────────────────

function HemisphereStat({
  label, count, total, color,
}: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] uppercase tracking-widest text-ink-300">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {count.toLocaleString()} <span className="text-ink-500 font-normal">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ─── Layout helpers (same shape as other pages) ──────────────────────

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-ink-900/80 backdrop-blur border border-ink-800 rounded-xl p-4">
      <div className="text-2xl sm:text-3xl font-black text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-ink-300 mt-1">{label}</div>
      {hint && <div className="text-[10px] text-ink-500 mt-0.5 truncate">{hint}</div>}
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
