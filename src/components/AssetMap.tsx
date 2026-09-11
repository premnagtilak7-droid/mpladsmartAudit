'use client';

import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import 'leaflet.heat';
import type { Project } from '@/lib/types';

export type MapAsset = Project & { mapLat: number; mapLng: number };
type MapMode = 'pins' | 'heatmap';

type LeafletWithHeat = typeof L & {
  heatLayer: (points: Array<[number, number, number]>, options?: Record<string, unknown>) => L.Layer;
};

function HeatLayer({ assets }: { assets: MapAsset[] }) {
  const map = useMap();
  useEffect(() => {
    const leaflet = L as LeafletWithHeat;
    const layer = leaflet.heatLayer(
      assets.map((asset) => [asset.mapLat, asset.mapLng, Math.max(0.35, Math.min(1, (asset.risk_score || 20) / 100))]),
      { radius: 30, blur: 22, maxZoom: 10, gradient: { 0.25: '#22c55e', 0.55: '#f59e0b', 0.85: '#ef4444' } },
    ).addTo(map);
    return () => { map.removeLayer(layer); };
  }, [assets, map]);
  return null;
}

export default function AssetMap({ assets, onSelect, mode = 'pins' }: { assets: MapAsset[]; onSelect: (asset: Project) => void; mode?: MapMode }) {
  const center: LatLngExpression = [22.5, 79];
  return (
    <MapContainer
      center={center}
      zoom={5}
      minZoom={3}
      maxZoom={18}
      scrollWheelZoom
      style={{ height: '100%', width: '100%', background: '#0b132b' }}
      className="h-[410px] w-full"
    >
      <TileLayer
        attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/attributions'>CARTO</a>"
        url={`https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY || 'cb1_3h01_1_8b1ab8cc98b1a6acf0813486'}`}
        minZoom={3}
        maxZoom={18}
      />
      {mode === 'heatmap' && <HeatLayer assets={assets} />}
      {mode === 'pins' && assets.map((asset) => {
        const completed = /completed|success/i.test(`${asset.status || ''} ${asset.payment_status || ''}`);
        const highRisk = (asset.risk_score || 0) >= 80 || asset.anomaly_type === 'Duplicate Location';
        const color = highRisk ? '#ef4444' : completed ? '#22c55e' : '#f59e0b';
        return (
          <span key={asset.id}>
            {highRisk && <Circle center={[asset.mapLat, asset.mapLng]} radius={50} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.12, weight: 1, dashArray: '4 4' }} />}
            <CircleMarker
              center={[asset.mapLat, asset.mapLng]}
              radius={highRisk ? 8 : completed ? 7 : 6}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.9, weight: 2, className: highRisk ? 'mplad-risk-pulse' : undefined }}
              eventHandlers={{ click: () => onSelect(asset) }}
            >
              <Popup>
                <strong>{asset.work || 'MPLAD work'}</strong><br />
                {asset.work_id || `MPLAD-${asset.id}`}<br />
                {highRisk ? 'High-risk / duplicate-location' : completed ? 'Completed' : 'In Progress'}
              </Popup>
            </CircleMarker>
          </span>
        );
      })}
    </MapContainer>
  );
}
