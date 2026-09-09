'use client';

import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import type { Project } from '@/lib/types';

export type MapAsset = Project & { mapLat: number; mapLng: number };

export default function AssetMap({ assets, onSelect }: { assets: MapAsset[]; onSelect: (asset: Project) => void }) {
  const center: LatLngExpression = [22.5, 79];
  return (
    <MapContainer center={center} zoom={5} scrollWheelZoom className="h-[410px] w-full bg-[#0b132b]">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {assets.map((asset) => {
        const completed = /completed|success/i.test(`${asset.status || ''} ${asset.payment_status || ''}`);
        return (
          <CircleMarker
            key={asset.id}
            center={[asset.mapLat, asset.mapLng]}
            radius={completed ? 7 : 6}
            pathOptions={{
              color: completed ? '#22c55e' : '#f59e0b',
              fillColor: completed ? '#22c55e' : '#f59e0b',
              fillOpacity: 0.9,
              weight: 2,
            }}
            eventHandlers={{ click: () => onSelect(asset) }}
          >
            <Popup>
              <strong>{asset.work || 'MPLAD work'}</strong><br />
              {asset.work_id || `MPLAD-${asset.id}`}<br />
              {completed ? 'Completed' : 'In Progress'}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
