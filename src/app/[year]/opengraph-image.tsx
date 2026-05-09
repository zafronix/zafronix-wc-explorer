/**
 * Per-tournament Open Graph image. Renders a 1200×630 card with
 * the year, host countries (with flags), champion (with flag), and
 * the headline stats. Twitter / Facebook / LinkedIn / Slack will use
 * this when someone shares the tournament URL.
 *
 * Edge runtime + next/og's ImageResponse so the card is rendered on
 * demand and cached at the edge — no pre-built PNG to maintain.
 */

import { ImageResponse } from 'next/og';
import { getTournament } from '@/lib/wc-api';
import { OG_BG, OG_FG, OG_MUTED, OG_BRAND, OG_GOLD, flagCdnUrl, hostIso } from '@/lib/og-helpers';

export const runtime = 'edge';
export const alt = 'World Cup tournament summary';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const t = await getTournament(Number(year)).catch(() => null);

  // Fallback card when the year isn't loadable (e.g. data outage at
  // build/render time). Better than throwing — Twitter will still
  // get an image, just a generic-branded one.
  if (!t) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: OG_BG, color: OG_FG, fontSize: 64,
                      fontWeight: 800 }}>
          {year} World Cup · Zafronix
        </div>
      ),
      size,
    );
  }

  const m = t.tournament;
  const teamsCount = m.teamsCount ?? t.teams?.length ?? '?';
  const matchesCount = m.matchesCount ?? '?';
  const totalGoals = m.totalGoals ?? '?';
  const champion = m.champion;
  const championIso = champion ? hostIso(champion) : '';

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: `linear-gradient(135deg, ${OG_BG} 0%, #1a1632 50%, ${OG_BG} 100%)`,
        color: OG_FG, display: 'flex', flexDirection: 'column',
        padding: '64px 80px', fontFamily: 'system-ui, sans-serif',
        position: 'relative',
      }}>
        {/* Top tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 22,
                      letterSpacing: 4, textTransform: 'uppercase', color: OG_BRAND,
                      fontWeight: 700, marginBottom: 24 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: OG_BRAND }} />
          Zafronix WC Explorer
        </div>

        {/* Year + host */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 32, marginBottom: 12 }}>
          <span style={{ fontSize: 220, fontWeight: 900, lineHeight: 0.9,
                         color: OG_FG, letterSpacing: -8 }}>
            {m.year}
          </span>
          <span style={{ fontSize: 36, color: OG_MUTED, fontWeight: 500 }}>
            FIFA World Cup
          </span>
        </div>

        {/* Hosts with flags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          {m.host.map((h, i) => {
            const iso = hostIso(h);
            return (
              <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {iso && <img src={flagCdnUrl(iso, 80)} width={56} height={36} alt="" style={{ borderRadius: 4 }} />}
                <span style={{ fontSize: 32, color: OG_FG, fontWeight: 600 }}>{h}</span>
                {i < m.host.length - 1 && <span style={{ fontSize: 28, color: OG_MUTED, marginLeft: 4 }}>+</span>}
              </div>
            );
          })}
        </div>

        {/* Champion or TBD */}
        {champion ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18,
                        background: 'rgba(250, 204, 21, 0.1)',
                        border: `2px solid ${OG_GOLD}40`,
                        borderRadius: 16, padding: '18px 28px',
                        marginBottom: 'auto', alignSelf: 'flex-start' }}>
            <span style={{ fontSize: 36 }}>🏆</span>
            {championIso && <img src={flagCdnUrl(championIso, 80)} width={56} height={36} alt="" style={{ borderRadius: 4 }} />}
            <span style={{ fontSize: 36, color: OG_GOLD, fontWeight: 700 }}>{champion}</span>
            <span style={{ fontSize: 22, color: OG_MUTED, fontWeight: 500, marginLeft: 8 }}>champion</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14,
                        background: 'rgba(163, 132, 255, 0.1)',
                        border: `2px solid ${OG_BRAND}40`,
                        borderRadius: 16, padding: '18px 28px',
                        marginBottom: 'auto', alignSelf: 'flex-start' }}>
            <span style={{ fontSize: 32, color: OG_BRAND, fontWeight: 700 }}>UPCOMING</span>
            <span style={{ fontSize: 24, color: OG_MUTED }}>champion TBD</span>
          </div>
        )}

        {/* Bottom stat strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      borderTop: `1px solid ${OG_MUTED}30`, paddingTop: 28 }}>
          <Stat label="TEAMS" value={String(teamsCount)} />
          <Stat label="MATCHES" value={String(matchesCount)} />
          <Stat label="GOALS" value={String(totalGoals)} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                        gap: 6, color: OG_MUTED, fontSize: 18 }}>
            <span style={{ fontFamily: 'monospace', color: OG_BRAND }}>
              api.zafronix.com/wc-explorer/{m.year}/
            </span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 56, fontWeight: 800, color: OG_FG, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 16, letterSpacing: 3, color: OG_MUTED, fontWeight: 600 }}>{label}</span>
    </div>
  );
}
