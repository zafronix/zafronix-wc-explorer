import { ImageResponse } from 'next/og';
import { OG_BG, OG_FG, OG_MUTED, OG_BRAND } from '@/lib/og-helpers';

export const runtime = 'edge';
export const alt = 'Compare World Cups side-by-side';
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
          Compare any
        </div>
        <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: -2,
                      color: OG_BRAND, marginBottom: 32 }}>
          two World Cups.
        </div>
        <div style={{ fontSize: 28, color: OG_MUTED, marginBottom: 'auto', maxWidth: 900 }}>
          Total goals · Goals-per-match · Attendance · Top scorer · Best player ·
          Champion · Runner-up · Third place — side-by-side
        </div>
        <div style={{ borderTop: `1px solid ${OG_MUTED}30`, paddingTop: 28,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 36, color: OG_FG, fontFamily: 'monospace' }}>
            ?years=<span style={{ color: OG_BRAND }}>1986,2022</span>
          </div>
          <span style={{ color: OG_BRAND, fontSize: 18, fontFamily: 'monospace' }}>
            /wc-explorer/compare/
          </span>
        </div>
      </div>
    ),
    size,
  );
}
