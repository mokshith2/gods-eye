import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const GODS_EYE_GREEN = '#00ff88';
const THREAT_RED = '#ff4444';
const ISS_ORANGE = '#ff8800';
const BOAT_BLUE = '#4488ff';

export default function MapView({ points, ringsData, setActiveTarget }) {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
      <MapContainer 
        center={[20, 0]} 
        zoom={3} 
        zoomControl={false}
        style={{ height: '100%', width: '100%', background: '#0a0a0f' }}
      >
        {/* High-res Esri Satellite Tiles */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        />
        {/* Optional Dark Overlay to keep the vibe */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          opacity={0.7}
        />
        
        <ZoomControl position="bottomright" />

        {points.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={p.threatLevel === 'CRITICAL' ? 12 : (p.type === 'hotspot' ? 10 : (p.threatLevel === 'HIGH' ? 5 : 3))}
            pathOptions={{
              color: p.threatLevel === 'CRITICAL' ? '#ff00ff' : (p.type === 'hotspot' ? THREAT_RED : (p.threatLevel === 'HIGH' ? THREAT_RED : (p.type === 'satellite' ? ISS_ORANGE : (p.type === 'boat' ? BOAT_BLUE : GODS_EYE_GREEN)))),
              fillColor: p.threatLevel === 'CRITICAL' ? '#ff00ff' : (p.type === 'hotspot' ? THREAT_RED : (p.threatLevel === 'HIGH' ? THREAT_RED : (p.type === 'satellite' ? ISS_ORANGE : (p.type === 'boat' ? BOAT_BLUE : GODS_EYE_GREEN)))),
              fillOpacity: 0.7,
              weight: p.threatLevel === 'CRITICAL' || p.threatLevel === 'HIGH' ? 2 : 1
            }}
            eventHandlers={{
              click: () => setActiveTarget(p)
            }}
          />
        ))}

        {ringsData.filter(r => r.type === 'earthquake').map((r, i) => (
           <CircleMarker
           key={`eq-${i}`}
           center={[r.lat, r.lng]}
           radius={r.mag * 4}
           pathOptions={{
             color: THREAT_RED,
             fillColor: 'transparent',
             weight: 2,
             dashArray: '5, 5'
           }}
         />
        ))}
      </MapContainer>
    </div>
  );
}
