import { ImageResponse } from 'next/og';
import { OG_BG, OG_FG, OG_MUTED, OG_BRAND } from '@/lib/og-helpers';

export const runtime = 'edge';
export const alt = 'World Cup Teams — every nation';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: `linear-gradient(135deg, ${OG_BG} 0%, #1a1632 50%, ${OG_BG} 100%)`,
        color: OG_FG, display: 'flex', flexDirection: 'column',
        padding: '80px', fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ fontSize: 22, letterSpacing: 4, textTransform: 'uppercase',
                      color: OG_BRAND, fontWeight: 700, marginBottom: 32, display: 'flex',
                      alignItems: 'center', gap: 16 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: OG_BRAND }} />
          Zafronix WC Explorer
        </div>
        <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: -2 }}>
          Every nation,
        </div>
        <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: -2,
                      color: OG_BRAND, marginBottom: 32 }}>
          across every World Cup.
        </div>
        <div style={{ fontSize: 28, color: OG_MUTED, marginBottom: 'auto', maxWidth: 900 }}>
          Most appearances · Best finishes · Confederation breakdown · Debutants ·
          Distance traveled · Squad ages · Repeat coaches
        </div>
        <div style={{ borderTop: `1px solid ${OG_MUTED}30`, paddingTop: 28,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 60 }}>
            <Stat v="80+" l="DISTINCT NATIONS" />
            <Stat v="490+" l="TEAM-APPEARANCES" />
            <Stat v="6" l="CONFEDERATIONS" />
          </div>
          <span style={{ color: OG_BRAND, fontSize: 18, fontFamily: 'monospace' }}>
            /wc-explorer/teams/
          </span>
        </div>
      </div>
    ),
    size,
  );
}
function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: OG_FG }}>{v}</span>
      <span style={{ fontSize: 14, letterSpacing: 3, color: OG_MUTED, fontWeight: 600 }}>{l}</span>
    </div>
  );
}
