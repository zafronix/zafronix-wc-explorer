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
import { listTournaments, getAggregatePlayers } from '@/lib/wc-api';
import { Donut, SERIES_COLORS, BarSeries } from '@/components/charts/Charts';
import { Flag } from '@/components/Flag';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Players analysis — position, DOB, hemisphere distributions',
  description: 'World Cup squads charted by position, birth month, confederation, and hemisphere. With a GOAT overlay (Pelé, Maradona, Cruyff, Messi, CR7, R9 …) so you can spot the outliers.',
};

interface PageProps {
  searchParams: Promise<{ years?: string }>;
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

  // Default: ALL years. The user explicitly asked for this — toggling
  // years on the picker narrows the window; clearing the selection
  // (or visiting without ?years=) shows all-time. The previous default
  // ("last played tournament only") was confusing because the chip
  // showed one year highlighted while the API only had data for that
  // one year. Now default = no selection = all years, picker chips
  // are click-to-include.
  const requested = sp.years
    ? sp.years.split(',').map((y) => Number(y.trim())).filter((y) => playedYears.includes(y))
    : [];
  const years = requested;       // empty = "all years" to the picker UI
  const yearsForFetch = requested.length > 0 ? requested : undefined;
  const agg = await getAggregatePlayers(yearsForFetch);

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

          <YearPicker years={years} allYears={playedYears} />

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

      {/* GOAT reference table */}
      <section className="max-w-7xl mx-auto px-6 pb-12">
        <h2 className="text-2xl font-bold mb-4">GOAT reference</h2>
        <p className="text-xs text-ink-500 mb-4">
          Curated. Inclusion in this list isn&apos;t a championship ranking — it&apos;s a span of Ballon-d&apos;Or
          winners + nominees + commonly-cited GOATs across eras, used for the overlay above.
        </p>
        <div className="bg-ink-900 border border-ink-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-800/60 text-left text-[10px] uppercase tracking-widest text-ink-300">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">DOB</th>
                <th className="px-4 py-3">Birth month</th>
              </tr>
            </thead>
            <tbody>
              {GOATS.map((g) => {
                const month = Number(g.dob.slice(5, 7));
                return (
                  <tr key={g.name} className="border-t border-ink-800/60 hover:bg-ink-800/30">
                    <td className="px-4 py-2.5 font-semibold text-white">
                      <span className="inline-flex items-center gap-2">
                        <Flag country={g.team} />
                        <span>{g.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-200">{g.team}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: `${POSITION_COLORS[g.pos]}33`, color: POSITION_COLORS[g.pos] }}
                      >
                        {POSITION_LABELS[g.pos]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{g.dob}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <span className="text-accent-gold">{MONTH_LABELS[month - 1]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

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
                      className="block w-2 h-2 rounded-full bg-accent-gold border border-amber-700 shadow-[0_0_4px_rgba(250,204,21,0.6)]"
                    />
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
            <div key={g.name} className="flex items-center gap-1.5">
              <span className="block w-1.5 h-1.5 rounded-full bg-accent-gold flex-shrink-0" />
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

// ─── Year picker ─────────────────────────────────────────────────────

function YearPicker({ years, allYears }: { years: number[]; allYears: number[] }) {
  const isActive = (y: number) => years.includes(y);
  // Build URLs that toggle one year on/off in the selection.
  function urlWith(y: number) {
    const next = isActive(y) ? years.filter((v) => v !== y) : [...years, y].sort();
    if (next.length === 0) return '/players/';
    return `/players/?years=${next.join(',')}`;
  }
  return (
    <div className="mt-6">
      <div className="text-[10px] uppercase tracking-widest text-ink-300 mb-2">
        Tournament window — click to toggle
      </div>
      <div className="flex flex-wrap gap-1.5">
        {/* Chronological — 1930 → latest. Reads as a timeline. */}
        {[...allYears].sort((a, b) => a - b).map((y) => (
          <Link
            key={y}
            href={urlWith(y)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono ${
              isActive(y)
                ? 'bg-brand-600/30 border border-brand-500 text-brand-200'
                : 'bg-ink-800 border border-ink-700 text-ink-400 hover:text-ink-100'
            }`}
          >
            {y}
          </Link>
        ))}
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
