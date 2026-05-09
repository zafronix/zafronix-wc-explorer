'use client';

/**
 * Per-tournament stadium map. Plots each venue used in a single
 * World Cup with marker color by capacity quintile + an info window
 * showing capacity, elevation, match count, and city.
 *
 * Powered by the same Google Maps SDK script the admin uses
 * (loaded globally via the layout). Falls back to a flat list when
 * Google isn't available — graceful degradation rather than a
 * broken-looking empty box.
 */

import { useEffect, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const google: any;

export interface StadiumMapPoint {
  id:         string;
  name:       string;
  city:       string;
  country:    string;
  lat:        number;
  lng:        number;
  capacity:   number | null;
  elevationM: number | null;
  matchCount: number;
}

// Dark map style — matches the explorer's ink palette.
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0e0c1c' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0e0c1c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b87a3' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2a2547' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#3d3666' }] },
  { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
  { featureType: 'road',    stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1a1632' }] },
  { featureType: 'water',     elementType: 'geometry', stylers: [{ color: '#070612' }] },
];

// Capacity → color. Five quintiles, brand-purple → gold gradient,
// computed live from the visible window so a 1930 stadium with 50k
// capacity isn't dwarfed by a modern 90k-seater on the same map.
function capacityColor(capacity: number | null, max: number): string {
  if (capacity == null || max <= 0) return '#5d5876';
  const pct = capacity / max;
  if (pct >= 0.85) return '#facc15';   // gold
  if (pct >= 0.65) return '#fb923c';   // orange
  if (pct >= 0.45) return '#f472b6';   // pink
  if (pct >= 0.25) return '#a384ff';   // brand purple
  return '#60a5fa';                    // blue
}

export function StadiumMap({
  points, height = 420,
}: {
  points: StadiumMapPoint[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Wait for google.maps. Loaded by the layout; here we just poll
  // until it shows up or give up after 10s.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const tick = () => {
      if (cancelled) return;
      if (typeof google !== 'undefined' && google.maps) {
        setReady(true); return;
      }
      attempts++;
      if (attempts > 50) {
        setScriptError('Google Maps script did not load within 10s.');
        return;
      }
      setTimeout(tick, 200);
    };
    tick();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || points.length === 0) return;

    if (!mapRef.current) {
      // Auto-fit on the first render. Subsequent updates re-bound
      // (so changing tournaments re-zooms). Using bounds rather than
      // a fixed center because hosts are scattered (1930 Uruguay vs
      // 1994 USA vs 2002 Korea+Japan).
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      mapRef.current = new google.maps.Map(containerRef.current, {
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        gestureHandling: 'cooperative',
        styles: DARK_STYLE,
        backgroundColor: '#0e0c1c',
      });
      mapRef.current.fitBounds(bounds, 60);
    }

    // Wipe previous markers (the picker / year change can re-render).
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    const infoWindow = new google.maps.InfoWindow();
    const maxCap = Math.max(...points.map((p) => p.capacity ?? 0), 1);

    for (const p of points) {
      const color = capacityColor(p.capacity, maxCap);
      const scale = 6 + Math.min(14, (p.capacity ?? 0) / maxCap * 14);
      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: mapRef.current,
        title: `${p.name} — ${p.matchCount} match${p.matchCount === 1 ? '' : 'es'}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale,
          fillColor: color,
          fillOpacity: 0.65,
          strokeColor: color,
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => {
        const cap = p.capacity != null ? p.capacity.toLocaleString() : '—';
        const elev = p.elevationM != null ? `${p.elevationM.toLocaleString()} m` : '—';
        infoWindow.setContent(
          `<div style="font-family:system-ui;color:#0f172a;min-width:180px;padding:2px">
            <div style="font-weight:700;font-size:14px;margin-bottom:2px">${escapeHtml(p.name)}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:8px">${escapeHtml(p.city)}, ${escapeHtml(p.country)}</div>
            <div style="display:grid;grid-template-columns:auto auto;gap:2px 12px;font-size:12px">
              <span style="color:#64748b">Matches</span><strong>${p.matchCount}</strong>
              <span style="color:#64748b">Capacity</span><strong>${cap}</strong>
              <span style="color:#64748b">Elevation</span><strong>${elev}</strong>
            </div>
          </div>`,
        );
        infoWindow.open(mapRef.current, marker);
      });
      markersRef.current.push(marker);
    }
  }, [ready, points]);

  if (points.length === 0) {
    return (
      <div className="bg-ink-900 border border-ink-800 rounded-xl p-8 text-center text-sm text-ink-400">
        No stadium data for this tournament.
      </div>
    );
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="rounded-xl overflow-hidden border border-ink-800 bg-ink-950"
        style={{ height }}
      >
        {!ready && !scriptError && (
          <div className="h-full flex items-center justify-center text-ink-400 text-xs">
            Loading map…
          </div>
        )}
        {scriptError && (
          <div className="h-full flex items-center justify-center text-amber-300/80 text-xs px-6 text-center">
            {scriptError} Falling back to the table below.
          </div>
        )}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-[11px] text-ink-400">
        <span className="text-[10px] uppercase tracking-widest text-ink-500">Capacity:</span>
        <Dot color="#60a5fa"  label="<25%" />
        <Dot color="#a384ff"  label="25-45%" />
        <Dot color="#f472b6"  label="45-65%" />
        <Dot color="#fb923c"  label="65-85%" />
        <Dot color="#facc15"  label="≥85%" />
        <span className="text-ink-500">·</span>
        <span className="text-ink-500">Marker size also scales with capacity</span>
      </div>
    </div>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 0 1px ${color}` }} />
      <span className="text-ink-200">{label}</span>
    </span>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
