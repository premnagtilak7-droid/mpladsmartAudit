'use client';

import {
  Circle,
  CircleMarker,
  LayersControl,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import { Fragment, useEffect } from 'react';
import { formatINR } from '@/lib/format';
import 'leaflet.heat';
import type { Project } from '@/lib/types';

export type MapAsset = Project & { mapLat: number; mapLng: number };
type MapMode = 'pins' | 'heatmap';

type LeafletWithHeat = typeof L & {
  heatLayer: (points: Array<[number, number, number]>, options?: Record<string, unknown>) => L.Layer;
};

// Pulsing user location icon
const userLocationIcon = typeof window !== 'undefined'
  ? L.divIcon({
      className: 'user-location-marker-wrapper',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute -top-7 whitespace-nowrap rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-md border border-blue-400">
            You Are Here
          </div>
          <span class="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg"></span>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })
  : undefined;

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

function MapSizeFix() {
  const map = useMap();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => map.invalidateSize(), 200);
    return () => window.clearTimeout(timeoutId);
  }, [map]);

  return null;
}

function SetBounds({ markers, userLocation }: { markers: MapAsset[]; userLocation?: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 13, { duration: 1.5 });
      return;
    }
    if (!markers.length) return;

    const bounds = L.latLngBounds(markers.map((marker) => [marker.mapLat, marker.mapLng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: markers.length === 1 ? 12 : 10 });
  }, [map, markers, userLocation]);

  return null;
}

export default function AssetMap({
  assets,
  onSelect,
  mode = 'pins',
  userLocation,
}: {
  assets: MapAsset[];
  onSelect: (asset: Project) => void;
  mode?: MapMode;
  userLocation?: { lat: number; lng: number } | null;
}) {
  const center: LatLngExpression = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [20.5937, 78.9629];
  const cartoKey = process.env.NEXT_PUBLIC_CARTO_API_KEY || 'cb1_3h01_1_8b1ab8cc98b1a6acf0813486';
  const cartoAttribution = '&copy; OpenStreetMap &copy; CARTO';

  return (
    <div
      className="relative h-[500px] w-full overflow-hidden rounded-xl border border-slate-700/60 bg-[#0b132b] shadow-lg map-touchpad-container"
      style={{ touchAction: 'none', pointerEvents: 'auto' }}
    >
      <MapContainer
        center={center}
        zoom={userLocation ? 13 : 5}
        minZoom={3}
        maxZoom={18}
        scrollWheelZoom={true}
        touchZoom={true}
        doubleClickZoom={true}
        dragging={true}
        zoomControl={true}
        style={{ height: '100%', width: '100%', background: '#0b132b' }}
        className="h-full w-full"
      >
        <MapSizeFix />
        <SetBounds markers={assets} userLocation={userLocation} />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Dark Command">
            <TileLayer
              attribution={cartoAttribution}
              url={`https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${cartoKey}`}
              minZoom={3}
              maxZoom={18}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Detailed Streets (CARTO Voyager)">
            <TileLayer
              attribution={cartoAttribution}
              url={`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${cartoKey}`}
              minZoom={3}
              maxZoom={18}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite Aerial (Esri Imagery)">
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              minZoom={3}
              maxZoom={18}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* Pulsing "You Are Here" user badge if geolocated */}
        {userLocation && userLocationIcon && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
            <Tooltip direction="top" permanent offset={[0, -18]}>
              <span className="font-bold text-xs text-blue-400">You Are Here</span>
            </Tooltip>
            <Popup>
              <div className="p-1 text-center font-semibold text-xs text-slate-100">
                Current Browser Geolocation
                <br />
                <span className="text-[10px] text-slate-400 font-mono">
                  {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                </span>
              </div>
            </Popup>
          </Marker>
        )}

        {mode === 'heatmap' && <HeatLayer assets={assets} />}
        {mode === 'pins' && assets.map((asset) => {
          const completed = /completed|success/i.test(`${asset.status || ''} ${asset.payment_status || ''}`);
          const highRisk = (asset.risk_score || 0) >= 80 || asset.anomaly_type === 'Duplicate Location';
          const statusLabel = highRisk ? 'Flagged Risk' : completed ? 'Completed' : 'In Progress';
          const color = highRisk ? '#ef4444' : completed ? '#22c55e' : '#f59e0b';
          const sanctionedCost = asset.sanctioned_amount ?? asset.amount;

          return (
            <Fragment key={asset.id}>
              {highRisk && (
                <Circle
                  center={[asset.mapLat, asset.mapLng]}
                  radius={50}
                  pathOptions={{
                    color: '#ef4444',
                    fillColor: '#ef4444',
                    fillOpacity: 0.12,
                    weight: 1,
                    dashArray: '4 4',
                  }}
                />
              )}
              <CircleMarker
                center={[asset.mapLat, asset.mapLng]}
                radius={highRisk ? 8 : completed ? 7 : 6}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.9,
                  weight: 2,
                  className: highRisk ? 'mplad-risk-pulse' : undefined,
                }}
                eventHandlers={{ click: () => onSelect(asset) }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <span className="text-xs font-semibold">{asset.work || 'MPLAD work'}</span>
                  <br />
                  <span className="text-xs">Cost: {formatINR(sanctionedCost)}</span>
                </Tooltip>
                <Popup className="mplad-map-popup">
                  <article className="min-w-[220px] space-y-3 text-slate-200">
                    <header>
                      <h3 className="text-sm font-black text-white">{asset.work || 'MPLAD work'}</h3>
                      <p className="mt-1 text-[11px] text-slate-400">{asset.work_id || `MPLAD-${asset.id}`}</p>
                    </header>
                    <dl className="space-y-1.5 text-xs">
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-400">Sanctioned cost</dt>
                        <dd className="font-bold">{formatINR(sanctionedCost)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-400">Vendor</dt>
                        <dd
                          className="max-w-[130px] truncate text-right font-semibold"
                          title={asset.vendor_name || 'Not recorded'}
                        >
                          {asset.vendor_name || 'Not recorded'}
                        </dd>
                      </div>
                    </dl>
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-black ${
                          highRisk
                            ? 'bg-rose-500/20 text-rose-300'
                            : completed
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {statusLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelect(asset)}
                        className="rounded-md bg-cyan-600 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-cyan-500"
                      >
                        Inspect Details
                      </button>
                    </div>
                  </article>
                </Popup>
              </CircleMarker>
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
