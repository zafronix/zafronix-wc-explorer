/**
 * Shared color palette + helpers used by every opengraph-image.tsx
 * route. Keeps the cards visually consistent across tournament,
 * teams, players, etc., so a Twitter timeline of WC Explorer shares
 * reads as one product, not five different ones.
 */

export const OG_BG = '#0e0c1c';        // ink-950
export const OG_FG = '#ffffff';
export const OG_MUTED = '#8b87a3';     // ink-400
export const OG_BRAND = '#a384ff';     // brand purple
export const OG_GOLD = '#facc15';      // accent gold

/** ISO-2 → flagcdn URL at the size we want for OG cards.
 *  Inlined so the Edge runtime doesn't need to import the explorer's
 *  flag resolver (which depends on Image, which doesn't exist in
 *  next/og). */
export function flagCdnUrl(iso2: string, size: 80 | 160 = 160): string {
  return `https://flagcdn.com/w${size}/${iso2.toLowerCase()}.png`;
}

/** Common host-country → ISO-2 fallback map for the OG cards.
 *  We have a richer resolver in `flags.ts` but it pulls in too many
 *  deps for the Edge runtime; keep the OG copy small + hardcoded. */
export const OG_HOST_ISO: Record<string, string> = {
  uruguay: 'uy', italy: 'it', france: 'fr', brazil: 'br',
  switzerland: 'ch', sweden: 'se', chile: 'cl', england: 'gb-eng',
  mexico: 'mx', 'west germany': 'de', argentina: 'ar', spain: 'es',
  usa: 'us', 'united states': 'us', 'south korea': 'kr', japan: 'jp',
  germany: 'de', 'south africa': 'za', russia: 'ru', qatar: 'qa',
  canada: 'ca',
};

export function hostIso(name: string): string {
  return OG_HOST_ISO[name.toLowerCase()] ?? '';
}
