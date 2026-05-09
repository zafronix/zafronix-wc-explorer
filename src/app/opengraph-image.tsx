/**
 * Landing-page OG image. Default share card for /wc-explorer/.
 * Highlights the headline data: 23 tournaments, 1,168+ matches,
 * 2,500+ players, 206 stadiums.
 */

import { ImageResponse } from 'next/og';
import { OG_BG, OG_FG, OG_MUTED, OG_BRAND, OG_GOLD } from '@/lib/og-helpers';

export const runtime = 'edge';
export const alt = 'Zafronix World Cup Explorer';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: `linear-gradient(135deg, ${OG_BG} 0%, #1a1632 50%, ${OG_BG} 100%)`,
        color: OG_FG, display: 'flex', flexDirection: 'column',
        padding: '64px 80px', fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 22,
                      letterSpacing: 4, textTransform: 'uppercase', color: OG_BRAND,
                      fontWeight: 700, marginBottom: 32 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: OG_BRAND }} />
          Zafronix WC Explorer
        </div>

        <div style={{ fontSize: 92, fontWeight: 900, lineHeight: 1.05,
                      letterSpacing: -2, marginBottom: 24, maxWidth: '90%' }}>
          Every <span style={{ color: OG_BRAND }}>FIFA World Cup</span><br/>
          since 1930, charted.
        </div>

        <div style={{ fontSize: 28, color: OG_MUTED, marginBottom: 'auto', maxWidth: 800 }}>
          Interactive sample dashboard for the Zafronix World Cup API
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between',
                      borderTop: `1px solid ${OG_MUTED}30`, paddingTop: 28 }}>
          <Stat value="23" label="TOURNAMENTS" />
          <Stat value="1,168+" label="MATCHES" />
          <Stat value="2,500+" label="PLAYERS" />
          <Stat value="206" label="STADIUMS" highlight />
          <div style={{ display: 'flex', alignItems: 'flex-end', color: OG_BRAND,
                        fontSize: 18, fontFamily: 'monospace' }}>
            api.zafronix.com/wc-explorer/
          </div>
        </div>
      </div>
    ),
    size,
  );
}

function Stat({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 56, fontWeight: 800, lineHeight: 1,
                     color: highlight ? OG_GOLD : OG_FG }}>
        {value}
      </span>
      <span style={{ fontSize: 16, letterSpacing: 3, color: OG_MUTED, fontWeight: 600 }}>{label}</span>
    </div>
  );
}
