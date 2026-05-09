'use client';

/**
 * Chart primitives. Recharts under the hood with a tight visual
 * vocabulary so every chart in the explorer feels like it belongs
 * to the same dashboard:
 *   - Brand purple for primary series (#a384ff)
 *   - Gold for "winner / champion" highlights (#facc15)
 *   - Green for advancing / positive deltas
 *   - Red for losers / negative deltas
 *   - Subtle grid (rgba 0.06)
 *   - No legends for single-series; tooltip labels carry context
 */

import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { flagUrlAtSize, flagFor } from '@/lib/flags';

const TICK_COLOR = '#a8a4c0';
const GRID_COLOR = 'rgba(255,255,255,0.05)';

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#1a1730',
  border: '1px solid #2a2547',
  borderRadius: 12,
  color: '#e9e7f1',
  fontSize: 12,
  padding: '8px 12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

export const SERIES_COLORS = {
  brand:  '#a384ff',
  gold:   '#facc15',
  green:  '#22c55e',
  red:    '#ef4444',
  blue:   '#60a5fa',
  pink:   '#f472b6',
  cyan:   '#22d3ee',
  orange: '#fb923c',
} as const;

export const PALETTE = [
  SERIES_COLORS.brand, SERIES_COLORS.gold, SERIES_COLORS.green,
  SERIES_COLORS.blue, SERIES_COLORS.pink, SERIES_COLORS.cyan,
  SERIES_COLORS.orange, SERIES_COLORS.red,
];

interface BarSeriesPoint {
  label: string;
  value: number;
  /** Optional host country (used for tooltip enrichment — chart
   *  surfaces "year, <flag> host, value" instead of "year, value"). */
  host?: string | string[];
}
interface LineSeriesPoint extends BarSeriesPoint {}
interface MultiLinePoint { label: string; host?: string | string[]; [series: string]: string | number | string[] | undefined; }

/**
 * Tooltip renderer that pulls the host country (or hosts, plural for
 * co-hosted tournaments) out of the data point and renders flags
 * inline. Used by every series chart; the bare year-and-value
 * tooltip is reserved for charts that don't have a tournament host.
 */
function YearHostTooltip({ active, payload, label, valueLabel, valueFormatter }: {
  active?: boolean;
  payload?: Array<{ value: number; color?: string; payload?: { host?: string | string[] } }>;
  label?: string | number;
  valueLabel?: string;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  const hostRaw = p.payload?.host;
  const hosts = !hostRaw ? [] : Array.isArray(hostRaw) ? hostRaw : [hostRaw];
  const value = p.value;
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: hosts.length ? 4 : 0 }}>
        <span style={{ fontWeight: 600, color: '#e9e7f1' }}>{String(label)}</span>
      </div>
      {hosts.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 11, color: '#a8a4c0', flexWrap: 'wrap' }}>
          {hosts.map((h, i) => {
            const f = flagFor(h);
            const url = flagUrlAtSize(f, 20);
            return (
              <span key={`${h}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={url} alt="" width={16} height={11} style={{ borderRadius: 2, display: 'inline-block' }} />
                )}
                <span>{h}</span>
                {i < hosts.length - 1 && <span style={{ color: '#5d5876' }}>/</span>}
              </span>
            );
          })}
        </div>
      )}
      <div style={{ color: p.color ?? '#a384ff', fontWeight: 600 }}>
        {(valueFormatter ? valueFormatter(value) : value.toLocaleString())}
        {valueLabel && <span style={{ color: '#a8a4c0', fontWeight: 400, marginLeft: 4 }}>{valueLabel}</span>}
      </div>
    </div>
  );
}

export function BarSeries({
  data, height = 240, color = SERIES_COLORS.brand, valueLabel, valueFormatter,
}: {
  data: BarSeriesPoint[]; height?: number; color?: string;
  valueLabel?: string; valueFormatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={GRID_COLOR} />
        <XAxis dataKey="label" tick={{ fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis tick={{ fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <Tooltip
          cursor={{ fill: 'rgba(163,132,255,0.08)' }}
          content={<YearHostTooltip valueLabel={valueLabel} valueFormatter={valueFormatter} />}
        />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineSeries({
  data, height = 240, color = SERIES_COLORS.brand, valueLabel, valueFormatter,
}: {
  data: LineSeriesPoint[]; height?: number; color?: string;
  valueLabel?: string; valueFormatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={GRID_COLOR} />
        <XAxis dataKey="label" tick={{ fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis tick={{ fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <Tooltip content={<YearHostTooltip valueLabel={valueLabel} valueFormatter={valueFormatter} />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          dot={{ r: 3, fill: color }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AreaSeries({
  data, height = 240, color = SERIES_COLORS.brand, valueLabel, valueFormatter,
}: {
  data: LineSeriesPoint[]; height?: number; color?: string;
  valueLabel?: string; valueFormatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_COLOR} />
        <XAxis dataKey="label" tick={{ fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis tick={{ fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <Tooltip content={<YearHostTooltip valueLabel={valueLabel} valueFormatter={valueFormatter} />} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#grad-${color})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MultiLine({
  data, series, height = 280,
}: {
  data: MultiLinePoint[];
  series: Array<{ key: string; label: string; color?: string }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={GRID_COLOR} />
        <XAxis dataKey="label" tick={{ fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis tick={{ fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ paddingTop: 8 }} iconType="line" />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? PALETTE[i % PALETTE.length]}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Donut chart for country-keyed data — renders a flag + name + value
 * directly on each slice instead of a legend off to the side.
 *
 * Recharts' standard `label` prop accepts a function that returns
 * SVG. We use `<image>` (SVG image element, takes any URL via href)
 * for the flag, plus `<text>` for the country name and count. Slices
 * smaller than ~3% suppress their label to avoid overlapping.
 *
 * Hover tooltip stays for precision: `country (n) — pct%`.
 */
export function Donut({
  data, height = 320, centerLabel,
}: {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  centerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  // Recharts label-render callback. Recharts hands us geometry
  // (cx, cy, midAngle, innerRadius, outerRadius) — we project a
  // point ~120% out from the slice center for the label position.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  function renderLabel(props: any) {
    const { cx, cy, midAngle, outerRadius, payload } = props;
    if (!payload || total === 0) return null;
    const pct = payload.value / total;
    if (pct < 0.03) return null;             // hide tiny slices' labels

    const RADIAN = Math.PI / 180;
    const r = outerRadius + 20;              // 20px out from rim
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);

    const f = flagFor(payload.label);
    const flagUrl = flagUrlAtSize(f, 40);
    const isLeftSide = x < cx;

    // Flag rendered to the left or right of the text depending on
    // which side of the chart the slice sits on, so the text always
    // points outward.
    const flagX = isLeftSide ? x - 22 : x;
    const textX = isLeftSide ? x - 26 : x + 22;
    const textAnchor = isLeftSide ? 'end' : 'start';
    return (
      <g>
        {flagUrl && (
          <image
            href={flagUrl}
            x={flagX}
            y={y - 7}
            width={20}
            height={14}
            preserveAspectRatio="xMidYMid slice"
          />
        )}
        <text
          x={textX} y={y - 1} textAnchor={textAnchor}
          fill="#e9e7f1" fontSize={11} fontWeight={600}
        >
          {payload.label}
        </text>
        <text
          x={textX} y={y + 11} textAnchor={textAnchor}
          fill="#a8a4c0" fontSize={10}
        >
          {payload.value.toLocaleString()} · {(pct * 100).toFixed(0)}%
        </text>
      </g>
    );
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 24, right: 60, bottom: 24, left: 60 }}>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: number, name) => [
            `${v.toLocaleString()} (${total > 0 ? ((v * 100) / total).toFixed(1) : 0}%)`,
            name,
          ]}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="45%"
          outerRadius="70%"
          paddingAngle={2}
          stroke="none"
          label={renderLabel}
          labelLine={{ stroke: 'rgba(168,164,192,0.4)', strokeWidth: 1 }}
        >
          {data.map((d, i) => (
            <Cell key={d.label} fill={d.color ?? PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        {centerLabel && (
          <text x="50%" y="50%" dy={6} textAnchor="middle" fill="#e9e7f1" fontSize={20} fontWeight={700}>
            {centerLabel}
          </text>
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
