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

interface BarSeriesPoint { label: string; value: number; }
interface LineSeriesPoint { label: string; value: number; }
interface MultiLinePoint { label: string; [series: string]: string | number; }

export function BarSeries({
  data, height = 240, color = SERIES_COLORS.brand, valueLabel,
}: {
  data: BarSeriesPoint[]; height?: number; color?: string; valueLabel?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={GRID_COLOR} />
        <XAxis dataKey="label" tick={{ fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis tick={{ fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'rgba(163,132,255,0.08)' }}
          formatter={(v: number) => [v.toLocaleString(), valueLabel ?? '']}
        />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineSeries({
  data, height = 240, color = SERIES_COLORS.brand, valueLabel,
}: {
  data: LineSeriesPoint[]; height?: number; color?: string; valueLabel?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={GRID_COLOR} />
        <XAxis dataKey="label" tick={{ fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis tick={{ fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: number) => [v.toLocaleString(), valueLabel ?? '']}
        />
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
  data, height = 240, color = SERIES_COLORS.brand,
}: {
  data: LineSeriesPoint[]; height?: number; color?: string;
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
        <Tooltip contentStyle={TOOLTIP_STYLE} />
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

export function Donut({
  data, height = 260, centerLabel,
}: {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  centerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
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
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          stroke="none"
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
