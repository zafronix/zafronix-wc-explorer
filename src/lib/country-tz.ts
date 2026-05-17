/**
 * Country → primary timezone (UTC offset, in hours).
 *
 * Used by the matches/page.tsx Team Logistics table to compute the
 * "TZ shift" each team experienced at the venue vs their home base.
 * It's an approximation:
 *
 *   - Single-zone countries (UK, Germany, Italy, Argentina, etc.) →
 *     accurate.
 *   - Multi-zone countries (USA, Brazil, Russia, China, Indonesia,
 *     Australia) → we use the capital-city zone as the proxy. A
 *     California-based MLS player on the USA squad gets the same
 *     "shift" as a New York-based one in this model; we accept
 *     that imprecision rather than building a player-residence
 *     resolver we don't have data for.
 *   - Daylight saving is ignored — we use the standard offset
 *     year-round. DST shifts at most ±1h, which is below the
 *     "noticeable jet lag" threshold our display rounds to.
 *
 * The shift the table displays is `|stadium_country_tz - team_tz|`
 * in hours. 0 = local, ≥3 = real jet lag, ≥6 = a continental
 * crossing.
 *
 * Maintenance: add entries as new countries qualify. Unknown
 * countries return null; the UI just shows "—" for them.
 */

const TZ_HOURS: Record<string, number> = {
  // ─── Americas ───────────────────────────────────────────────
  'Argentina':         -3,
  'Bolivia':           -4,
  'Brazil':            -3,    // Brasília
  'Canada':            -5,    // Ottawa / Toronto
  'Chile':             -4,    // Santiago (DST-ignored)
  'Colombia':          -5,
  'Costa Rica':        -6,
  'Ecuador':           -5,
  'El Salvador':       -6,
  'Honduras':          -6,
  'Jamaica':           -5,
  'Mexico':            -6,    // CDMX
  'Panama':            -5,
  'Paraguay':          -4,
  'Peru':              -5,
  'Trinidad and Tobago': -4,
  'United States':     -5,    // Washington DC / NYC
  'USA':               -5,
  'Uruguay':           -3,
  'Venezuela':         -4,

  // ─── Europe ─────────────────────────────────────────────────
  'Albania':           1,
  'Austria':           1,
  'Belgium':           1,
  'Bosnia and Herzegovina': 1,
  'Bulgaria':          2,
  'Croatia':           1,
  'Cyprus':            2,
  'Czechia':           1,
  'Czech Republic':    1,
  'Denmark':           1,
  'England':           0,
  'Finland':           2,
  'France':            1,
  'Germany':           1,
  'Greece':            2,
  'Hungary':           1,
  'Iceland':           0,
  'Ireland':           0,
  'Italy':             1,
  'Latvia':            2,
  'Netherlands':       1,
  'Northern Ireland':  0,
  'Norway':            1,
  'Poland':            1,
  'Portugal':          0,
  'Romania':           2,
  'Russia':            3,    // Moscow (Russia spans 11 zones; capital used)
  'Scotland':          0,
  'Serbia':            1,
  'Slovakia':          1,
  'Slovenia':          1,
  'Soviet Union':      3,
  'Spain':             1,
  'Sweden':            1,
  'Switzerland':       1,
  'Turkey':            3,
  'Ukraine':           2,
  'Wales':             0,
  'West Germany':      1,
  'East Germany':      1,
  'Yugoslavia':        1,

  // ─── Africa ─────────────────────────────────────────────────
  'Algeria':           1,
  'Angola':            1,
  'Cameroon':          1,
  'Congo DR':          1,    // Kinshasa
  'Egypt':             2,
  'Ghana':             0,
  'Ivory Coast':       0,
  "Côte d'Ivoire":     0,
  'Morocco':           1,
  'Nigeria':           1,
  'Senegal':           0,
  'South Africa':      2,
  'Tunisia':           1,
  'Zaire':             1,

  // ─── Asia ───────────────────────────────────────────────────
  'China':             8,    // Beijing
  'China PR':          8,
  'Iran':              3.5,
  'Iraq':              3,
  'Israel':            2,
  'Japan':             9,
  'Kuwait':            3,
  'North Korea':       9,
  'Qatar':             3,
  'Saudi Arabia':      3,
  'South Korea':       9,
  'Korea Republic':    9,
  'Korea DPR':         9,
  'UAE':               4,
  'United Arab Emirates': 4,

  // ─── Oceania ────────────────────────────────────────────────
  'Australia':         10,   // Canberra / Sydney
  'New Zealand':       12,
};

/** Get a country's primary TZ offset in hours from UTC. Null when
 *  unknown — caller should render "—". */
export function tzHoursForCountry(country: string | null | undefined): number | null {
  if (!country) return null;
  const key = country.trim();
  if (key in TZ_HOURS) return TZ_HOURS[key]!;
  return null;
}

/** Return the absolute shift (in hours) between two countries' TZs.
 *  Null if either is unknown. Always positive (we don't care which
 *  direction a team traveled — only how much). */
export function tzShift(a: string | null | undefined, b: string | null | undefined): number | null {
  const ta = tzHoursForCountry(a);
  const tb = tzHoursForCountry(b);
  if (ta == null || tb == null) return null;
  return Math.abs(ta - tb);
}
