/**
 * Country-name → ISO map for World Cup hosts and any other country
 * label the explorer renders without an ISO already on hand.
 *
 * The wc-api's tournament records carry hosts as `string[]` (country
 * names — "Mexico", "USA", "South Korea") with no ISO codes, so we
 * resolve here. Teams already include ISO via team.iso + team.flag,
 * so this lib is *only* used for hosts and any other free-floating
 * country names (champions are also stored as names; champions is
 * usually the same as a team that played, so the team list is the
 * preferred lookup, but we cover the standalone case too).
 *
 * Coverage: every WC host nation 1930→2026 + every champion. Plus
 * a permissive fallback so a country we missed renders gracefully
 * (no flag, just the name).
 *
 * Special cases:
 *   - England uses the gb-eng subdivision flag (flagcdn supports it)
 *   - Scotland/Wales/Northern Ireland — same scheme, included even
 *     though they're not hosts because they show up as teams
 *   - West Germany / Czechoslovakia / Yugoslavia / Soviet Union —
 *     dissolved nations. flagcdn doesn't serve historical flags;
 *     we point at canonical Wikimedia SVGs (same approach as
 *     wc-api's lib/flags.ts).
 *   - USA: flagcdn uses 'us'
 */

export interface FlagInfo {
  /** ISO-3166-1 alpha-2 (lower-case) — for current countries.
   *  null for dissolved nations + unknown lookups. */
  iso: string | null;
  /** Always set — explicit URL to a flag image. flagcdn for current
   *  countries, Wikimedia for dissolved. */
  flagUrl: string | null;
  /** Display name (canonicalized — what we'd show next to the flag). */
  name: string;
}

const FLAGCDN_W20 = 'https://flagcdn.com/w20';
const FLAGCDN_W40 = 'https://flagcdn.com/w40';

/** Map of country-name (case-insensitive lookup key) → ISO/flag.
 *  Intentionally explicit rather than guessing — historical names
 *  like "West Germany" need precise handling. */
const COUNTRIES: Record<string, FlagInfo> = (() => {
  const cur = (name: string, iso: string): FlagInfo => ({
    iso, flagUrl: `${FLAGCDN_W20}/${iso}.png`, name,
  });
  const sub = (name: string, code: string): FlagInfo => ({
    // GB subdivisions — flagcdn supports gb-eng, gb-sct, gb-wls, gb-nir.
    iso: code, flagUrl: `${FLAGCDN_W20}/${code}.png`, name,
  });
  const wiki = (name: string, file: string): FlagInfo => ({
    iso: null,
    flagUrl: `https://commons.wikimedia.org/wiki/Special:FilePath/${file}`,
    name,
  });

  return {
    // Hosts (every tournament 1930-2026)
    'uruguay':       cur('Uruguay', 'uy'),
    'italy':         cur('Italy', 'it'),
    'france':        cur('France', 'fr'),
    'brazil':        cur('Brazil', 'br'),
    'switzerland':   cur('Switzerland', 'ch'),
    'sweden':        cur('Sweden', 'se'),
    'chile':         cur('Chile', 'cl'),
    'england':       sub('England', 'gb-eng'),
    'mexico':        cur('Mexico', 'mx'),
    // West Germany's flag (1949-1990) is visually identical to modern
    // Germany's — both black/red/gold horizontal. Wikimedia keeps a
    // separate file but the en-dash filename returns 404. Using the
    // canonical Flag_of_Germany.svg gets the same image.
    'west germany':  wiki('West Germany', 'Flag_of_Germany.svg'),
    'argentina':     cur('Argentina', 'ar'),
    'spain':         cur('Spain', 'es'),
    'usa':           cur('USA', 'us'),
    'united states': cur('United States', 'us'),
    'south korea':   cur('South Korea', 'kr'),
    'korea republic': cur('Korea Republic', 'kr'),
    'japan':         cur('Japan', 'jp'),
    'germany':       cur('Germany', 'de'),
    'south africa':  cur('South Africa', 'za'),
    'russia':        cur('Russia', 'ru'),
    'qatar':         cur('Qatar', 'qa'),
    'canada':        cur('Canada', 'ca'),

    // Champions / runner-ups / common participants
    'netherlands':       cur('Netherlands', 'nl'),
    // Czechoslovakia's flag is identical to today's Czech Republic
    // flag — Czechs kept it after the 1993 split. Use Flag_of_
    // Czechoslovakia.svg directly (verified 200 OK).
    'czechoslovakia':    wiki('Czechoslovakia', 'Flag_of_Czechoslovakia.svg'),
    'czech republic':    cur('Czech Republic', 'cz'),
    'hungary':           cur('Hungary', 'hu'),
    'austria':           cur('Austria', 'at'),
    'soviet union':      wiki('Soviet Union', 'Flag_of_the_Soviet_Union.svg'),
    'russia (soviet)':   wiki('Soviet Union', 'Flag_of_the_Soviet_Union.svg'),
    // Plain "Yugoslavia" filename without the (1946-1992) year-range
    // — that variant 404s due to en-dash encoding. The plain file is
    // the SFRY flag.
    'yugoslavia':        wiki('Yugoslavia', 'Flag_of_Yugoslavia.svg'),
    'fr yugoslavia':     wiki('FR Yugoslavia', 'Flag_of_FR_Yugoslavia.svg'),
    'serbia':            cur('Serbia', 'rs'),
    'serbia and montenegro': wiki('Serbia and Montenegro', 'Flag_of_Serbia_and_Montenegro.svg'),
    'croatia':           cur('Croatia', 'hr'),
    'belgium':           cur('Belgium', 'be'),
    'portugal':          cur('Portugal', 'pt'),
    'poland':            cur('Poland', 'pl'),
    'denmark':           cur('Denmark', 'dk'),
    'norway':            cur('Norway', 'no'),
    'romania':           cur('Romania', 'ro'),
    'bulgaria':          cur('Bulgaria', 'bg'),
    'turkey':            cur('Turkey', 'tr'),
    // Source data uses both "Ireland" and "Republic of Ireland" — alias.
    'ireland':           cur('Ireland', 'ie'),
    'republic of ireland': cur('Republic of Ireland', 'ie'),
    'northern ireland':  sub('Northern Ireland', 'gb-nir'),
    'scotland':          sub('Scotland', 'gb-sct'),
    'wales':             sub('Wales', 'gb-wls'),

    // Africa
    'morocco':           cur('Morocco', 'ma'),
    'tunisia':           cur('Tunisia', 'tn'),
    'algeria':           cur('Algeria', 'dz'),
    'egypt':             cur('Egypt', 'eg'),
    'nigeria':           cur('Nigeria', 'ng'),
    'cameroon':          cur('Cameroon', 'cm'),
    'ghana':             cur('Ghana', 'gh'),
    'ivory coast':       cur('Ivory Coast', 'ci'),
    "côte d'ivoire":     cur('Côte d’Ivoire', 'ci'),
    'senegal':           cur('Senegal', 'sn'),
    'zaire':             wiki('Zaire', 'Flag_of_Zaire.svg'),
    'dr congo':          cur('DR Congo', 'cd'),
    'angola':            cur('Angola', 'ao'),
    'cape verde':        cur('Cape Verde', 'cv'),
    'togo':              cur('Togo', 'tg'),

    // Asia / Oceania
    'australia':         cur('Australia', 'au'),
    'new zealand':       cur('New Zealand', 'nz'),
    'china':             cur('China', 'cn'),
    'china pr':          cur('China PR', 'cn'),
    'iran':              cur('Iran', 'ir'),
    'iraq':              cur('Iraq', 'iq'),
    'saudi arabia':      cur('Saudi Arabia', 'sa'),
    'north korea':       cur('North Korea', 'kp'),
    'korea dpr':         cur('Korea DPR', 'kp'),
    'india':             cur('India', 'in'),
    'israel':            cur('Israel', 'il'),
    'jordan':            cur('Jordan', 'jo'),
    'kuwait':            cur('Kuwait', 'kw'),
    'united arab emirates': cur('United Arab Emirates', 'ae'),
    'uzbekistan':        cur('Uzbekistan', 'uz'),

    // Americas
    'colombia':          cur('Colombia', 'co'),
    'peru':              cur('Peru', 'pe'),
    'paraguay':          cur('Paraguay', 'py'),
    'bolivia':           cur('Bolivia', 'bo'),
    'ecuador':           cur('Ecuador', 'ec'),
    'venezuela':         cur('Venezuela', 've'),
    'costa rica':        cur('Costa Rica', 'cr'),
    'honduras':          cur('Honduras', 'hn'),
    'panama':            cur('Panama', 'pa'),
    'el salvador':       cur('El Salvador', 'sv'),
    'jamaica':           cur('Jamaica', 'jm'),
    'haiti':             cur('Haiti', 'ht'),
    'trinidad and tobago': cur('Trinidad and Tobago', 'tt'),
    'cuba':              cur('Cuba', 'cu'),
    'curaçao':           cur('Curaçao', 'cw'),
    'curacao':           cur('Curaçao', 'cw'),  // ASCII fallback

    // Europe — additional
    'greece':            cur('Greece', 'gr'),
    'finland':           cur('Finland', 'fi'),
    'iceland':           cur('Iceland', 'is'),
    'slovakia':          cur('Slovakia', 'sk'),
    'slovenia':          cur('Slovenia', 'si'),
    'ukraine':           cur('Ukraine', 'ua'),
    'bosnia and herzegovina': cur('Bosnia and Herzegovina', 'ba'),
    'albania':           cur('Albania', 'al'),
    'north macedonia':   cur('North Macedonia', 'mk'),

    // Misc historical
    'dutch east indies': wiki('Dutch East Indies', 'Flag_of_the_Netherlands.svg'),
    'east germany':      wiki('East Germany', 'Flag_of_East_Germany.svg'),
  };
})();

/** Resolve a country name to its FlagInfo. Lookup is case-insensitive
 *  + ignores trailing whitespace. Unknown countries return a
 *  passthrough entry with no flag URL — caller renders the name
 *  with a small placeholder rather than crashing. */
export function flagFor(name: string | null | undefined): FlagInfo {
  if (!name) return { iso: null, flagUrl: null, name: '' };
  const key = name.toLowerCase().trim();
  return COUNTRIES[key] ?? { iso: null, flagUrl: null, name: name };
}

/** Fixed-size flag width — keeps row alignment consistent. */
export const FLAG_W = 20;
export const FLAG_H = 14;

/** flagcdn supports w20, w40, w80 — bigger sizes for retina + larger
 *  rendering targets. Helper for charts that need crisper flags. */
export function flagUrlAtSize(info: FlagInfo, size: 20 | 40 | 80 = 20): string | null {
  if (!info.flagUrl) return null;
  if (info.flagUrl.startsWith('https://flagcdn.com/')) {
    const base = size === 80 ? 'https://flagcdn.com/w80'
               : size === 40 ? FLAGCDN_W40
               :               FLAGCDN_W20;
    // Replace just the size segment.
    return info.flagUrl.replace(/^https:\/\/flagcdn\.com\/w\d+/, base);
  }
  return info.flagUrl;
}
