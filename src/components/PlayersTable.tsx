'use client';

/**
 * Client-side filterable + searchable player table. Used twice on
 * /players: once for the full player roster (squad rows from every
 * fetched tournament) and again for the curated GOAT reference list.
 *
 * Filters are URL-independent — they're local React state. The table
 * is virtualized via simple `slice` (no react-window) since the
 * filtered set is typically <500 rows; if it grows we can swap in
 * windowing later.
 */

import { useMemo, useState } from 'react';
import { Flag } from '@/components/Flag';

const POSITION_LABELS: Record<string, string> = {
  GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Attacker',
};

const POSITION_COLORS: Record<string, string> = {
  GK: '#facc15', DF: '#22d3ee', MF: '#a384ff', FW: '#f472b6',
};

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Southern-hemisphere national teams. Duplicates the same set in
 * src/app/players/page.tsx so the table can offer a hemisphere
 * dropdown independent of the page-level URL filter. If you edit
 * one, edit the other.
 */
const SOUTH_HEMISPHERE_TEAMS = new Set<string>([
  'Argentina', 'Brazil', 'Bolivia', 'Chile', 'Paraguay', 'Peru', 'Uruguay',
  'Angola', 'Cameroon', 'Congo DR', 'Mozambique', 'Namibia', 'South Africa',
  'Tanzania', 'Zambia', 'Zimbabwe',
  'Australia', 'New Zealand', 'Indonesia', 'Papua New Guinea',
]);

export interface PlayerRow {
  name:           string;
  team:           string;
  position:       string;        // GK / DF / MF / FW
  dob:            string | null; // ISO yyyy-mm-dd
  /** Comma-separated tournament years the player appears in (e.g. "1958, 1962, 1970"). */
  years:          number[];
  goals:          number;
  captain:        boolean;
}

interface Props {
  players: PlayerRow[];
  /** A short label shown in the empty/no-match state — "players" / "GOATs" / etc. */
  noun?:   string;
  /** Cap the visible rows (the filter usually narrows it enough that
   *  this matters mostly for the unfiltered "All players" case). */
  pageSize?: number;
  /** Initial value for the in-table hemisphere dropdown. Lets the
   *  /players page URL filter (`?hemisphere=N|S`) seed this control
   *  so the table state mirrors what the operator picked in the
   *  hero. Defaults to '' (no hemisphere filter). */
  defaultHemisphere?: 'N' | 'S' | '';
  /** When false, hide the hemisphere control entirely. Used for the
   *  GOATs reference table where the curated list is global by
   *  design. */
  showHemisphere?: boolean;
}

export function PlayersTable({
  players,
  noun = 'players',
  pageSize = 100,
  defaultHemisphere = '',
  showHemisphere = true,
}: Props) {
  const [name, setName]         = useState('');
  const [country, setCountry]   = useState('');
  const [position, setPosition] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [hemisphere, setHemisphere] = useState<'N' | 'S' | ''>(defaultHemisphere);
  const [showAll, setShowAll]   = useState(false);

  // Country + birth-year option lists derived from the data so we
  // don't have to hand-maintain them.
  const countries = useMemo(() => {
    const s = new Set(players.map((p) => p.team));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [players]);

  const birthYears = useMemo(() => {
    const s = new Set<number>();
    for (const p of players) {
      if (p.dob) {
        const y = Number(p.dob.slice(0, 4));
        if (Number.isFinite(y)) s.add(y);
      }
    }
    return Array.from(s).sort((a, b) => b - a);
  }, [players]);

  const filtered = useMemo(() => {
    const needle = name.trim().toLowerCase();
    return players.filter((p) => {
      if (needle && !p.name.toLowerCase().includes(needle)) return false;
      if (country && p.team !== country) return false;
      if (position && p.position !== position) return false;
      if (birthYear && (!p.dob || p.dob.slice(0, 4) !== birthYear)) return false;
      if (birthMonth && (!p.dob || p.dob.slice(5, 7) !== birthMonth)) return false;
      if (hemisphere) {
        const isSouth = SOUTH_HEMISPHERE_TEAMS.has(p.team);
        if (hemisphere === 'S' && !isSouth) return false;
        if (hemisphere === 'N' &&  isSouth) return false;
      }
      return true;
    });
  }, [players, name, country, position, birthYear, birthMonth, hemisphere]);

  const visible = showAll ? filtered : filtered.slice(0, pageSize);
  const truncated = filtered.length > visible.length;

  const filterActive = !!(name || country || position || birthYear || birthMonth || hemisphere);
  const reset = () => {
    setName(''); setCountry(''); setPosition(''); setBirthYear(''); setBirthMonth(''); setHemisphere('');
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="bg-ink-900 border border-ink-800 rounded-xl p-3 mb-3 flex flex-wrap items-end gap-2">
        <FilterField label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Search…"
            className="bg-ink-950 border border-ink-700 rounded-md px-2 py-1.5 text-sm text-white placeholder:text-ink-500 w-44 focus:outline-none focus:border-brand-400"
          />
        </FilterField>

        <FilterField label="Country">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="bg-ink-950 border border-ink-700 rounded-md px-2 py-1.5 text-sm text-white w-44 focus:outline-none focus:border-brand-400"
          >
            <option value="">All</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </FilterField>

        <FilterField label="Position">
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="bg-ink-950 border border-ink-700 rounded-md px-2 py-1.5 text-sm text-white w-32 focus:outline-none focus:border-brand-400"
          >
            <option value="">All</option>
            <option value="GK">Goalkeeper</option>
            <option value="DF">Defender</option>
            <option value="MF">Midfielder</option>
            <option value="FW">Attacker</option>
          </select>
        </FilterField>

        <FilterField label="Birth year">
          <select
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            className="bg-ink-950 border border-ink-700 rounded-md px-2 py-1.5 text-sm text-white w-28 focus:outline-none focus:border-brand-400"
          >
            <option value="">All</option>
            {birthYears.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </FilterField>

        <FilterField label="Birth month">
          <select
            value={birthMonth}
            onChange={(e) => setBirthMonth(e.target.value)}
            className="bg-ink-950 border border-ink-700 rounded-md px-2 py-1.5 text-sm text-white w-32 focus:outline-none focus:border-brand-400"
          >
            <option value="">All</option>
            {MONTH_LABELS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>
        </FilterField>

        {showHemisphere && (
          <FilterField label="Hemisphere">
            <select
              value={hemisphere}
              onChange={(e) => setHemisphere(e.target.value as 'N' | 'S' | '')}
              className="bg-ink-950 border border-ink-700 rounded-md px-2 py-1.5 text-sm text-white w-32 focus:outline-none focus:border-brand-400"
            >
              <option value="">All</option>
              <option value="N">Northern</option>
              <option value="S">Southern</option>
            </select>
          </FilterField>
        )}

        <div className="ml-auto flex items-center gap-2">
          {filterActive && (
            <button
              onClick={reset}
              className="text-[11px] text-ink-300 hover:text-white px-2 py-1.5 rounded-md hover:bg-ink-800"
            >
              Clear filters
            </button>
          )}
          <span className="text-[11px] text-ink-500 font-mono tabular-nums">
            {filtered.length.toLocaleString()} / {players.length.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="bg-ink-900 border border-ink-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-800/60 text-left text-[10px] uppercase tracking-widest text-ink-300">
            <tr>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3">DOB</th>
              <th className="px-4 py-3">Birth month</th>
              <th className="px-4 py-3 text-right">WCs</th>
              <th className="px-4 py-3 text-right">Goals</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-400">
                  No {noun} match the current filters.
                </td>
              </tr>
            ) : visible.map((p) => {
              const month = p.dob ? Number(p.dob.slice(5, 7)) : null;
              return (
                <tr key={`${p.name}|${p.team}`} className="border-t border-ink-800/60 hover:bg-ink-800/30">
                  <td className="px-4 py-2.5 font-semibold text-white">
                    <span className="inline-flex items-center gap-2">
                      <Flag country={p.team} />
                      <span>{p.name}</span>
                      {p.captain && (
                        <span className="text-[9px] uppercase tracking-widest text-accent-gold ml-1">C</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-ink-200">{p.team}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                      style={{
                        backgroundColor: `${POSITION_COLORS[p.position] ?? '#a384ff'}33`,
                        color: POSITION_COLORS[p.position] ?? '#a384ff',
                      }}
                    >
                      {POSITION_LABELS[p.position] ?? p.position}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{p.dob ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {month ? <span className="text-accent-gold">{MONTH_LABELS[month - 1]}</span> : <span className="text-ink-500">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-ink-300">
                    <span title={p.years.join(', ')}>{p.years.length}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.goals > 0 ? (
                      <span className="text-accent-gold font-semibold">{p.goals}</span>
                    ) : (
                      <span className="text-ink-500">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {truncated && !showAll && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-brand-400 hover:underline"
          >
            Show all {filtered.length.toLocaleString()} {noun} ↓
          </button>
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-ink-500">{label}</span>
      {children}
    </label>
  );
}
