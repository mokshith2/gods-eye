import React, { useRef, useEffect } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';

const GODS_EYE_GREEN = '#00ff88';
const THREAT_RED = '#ff4444';
const ISS_ORANGE = '#ff8800';
const BOAT_BLUE = '#4488ff';

export default function GlobeView({ places, points, ringsData, setActiveTarget }) {
  const globeRef = useRef();
  const rotationTimeoutRef = useRef(null);

  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      controls.enableDamping = true;

      // Use a more reliable cloud texture URL
      const CLOUDS_URL = 'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/clouds.png';
      const CLOUDS_ALT = 0.004;
      const CLOUDS_ROTATION_SPEED = -0.006; // deg/frame

      new THREE.TextureLoader().load('https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg', (cloudsTexture) => {
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(globeRef.current.getGlobeRadius() * (1 + CLOUDS_ALT), 75, 75),
          new THREE.MeshPhongMaterial({ map: cloudsTexture, transparent: true })
        );
        globeRef.current.scene().add(clouds);

        (function rotateClouds() {
          clouds.rotation.y += CLOUDS_ROTATION_SPEED * Math.PI / 180;
          requestAnimationFrame(rotateClouds);
        })();
      });
    }
  }, []);

  const handleInteraction = () => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      controls.autoRotate = false;
      clearTimeout(rotationTimeoutRef.current);
      rotationTimeoutRef.current = setTimeout(() => {
        if (globeRef.current) {
          globeRef.current.controls().autoRotate = true;
        }
      }, 30000);
    }
  };

  return (
    <div 
      onPointerDown={handleInteraction} 
      onWheel={handleInteraction}
      onTouchStart={handleInteraction}
      style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}
    >
      <Globe
        ref={globeRef}
        // Higher Res Textures
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
      
        atmosphereColor={GODS_EYE_GREEN}
        atmosphereAltitude={0.2}

        labelsData={places}
        labelLat={d => d.properties.latitude}
        labelLng={d => d.properties.longitude}
        labelText={d => d.properties.name}
        labelSize={d => Math.max(0.3, Math.sqrt(d.properties.pop_max) * 4e-4)}
        labelDotRadius={d => Math.max(0.1, Math.sqrt(d.properties.pop_max) * 2e-4)}
        labelColor={() => 'rgba(255, 255, 255, 0.6)'}
        labelResolution={1}
        
        onPointClick={setActiveTarget}
        pointLabel={d => `
          <div style="background: rgba(10,10,15,0.95); padding: 10px; border: 1px solid ${d.threatLevel === 'HIGH' || d.threatLevel === 'CRITICAL' ? THREAT_RED : GODS_EYE_GREEN}; backdrop-filter: blur(10px); font-family: 'JetBrains Mono', monospace; min-width: 160px; box-shadow: 0 0 20px rgba(0,0,0,0.8); border-radius: 4px;">
            <div style="border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 6px; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
               <b style="color: ${d.threatLevel === 'HIGH' || d.threatLevel === 'CRITICAL' ? THREAT_RED : GODS_EYE_GREEN}; font-size: 13px; text-shadow: 0 0 5px ${d.threatLevel === 'HIGH' || d.threatLevel === 'CRITICAL' ? THREAT_RED : GODS_EYE_GREEN}88;">${d.callsign || d.id || 'UNKNOWN'}</b>
               <span style="font-size: 8px; color: #888; border: 1px solid rgba(255,255,255,0.2); padding: 1px 3px;">${d.type?.toUpperCase()}</span>
            </div>
            <div style="font-size: 10px; color: #fff; line-height: 1.5; font-family: 'JetBrains Mono';">
              ${d.alt ? `ALT: <span style="color: ${GODS_EYE_GREEN}">${Math.floor(d.alt)}m</span><br/>` : ''}
              ${d.vel ? `VEL: <span style="color: ${GODS_EYE_GREEN}">${Math.floor(d.vel)}kts</span><br/>` : ''}
              ${d.mag ? `MAG: <span style="color: ${THREAT_RED}">${d.mag.toFixed(1)}M</span><br/>` : ''}
              LAT: ${d.lat.toFixed(3)} | LNG: ${d.lng.toFixed(3)}
            </div>
          </div>
        `}

        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={d => d.threatLevel === 'CRITICAL' ? '#ff00ff' : (d.type === 'hotspot' ? 'rgba(255,0,0,0.6)' : (d.threatLevel === 'HIGH' ? THREAT_RED : (d.type === 'satellite' ? ISS_ORANGE : d.type === 'boat' ? BOAT_BLUE : GODS_EYE_GREEN)))}
        pointAltitude={0.01}
        pointRadius={d => d.threatLevel === 'CRITICAL' ? 1.0 : (d.type === 'hotspot' ? d.intensity * 1.5 : 0.3)}
        pointsMerge={false}
        
        ringsData={ringsData}
        ringLat="lat"
        ringLng="lng"
        ringColor={d => d.type === 'earthquake' ? (d.mag >= 5 ? THREAT_RED : ISS_ORANGE) : THREAT_RED}
        ringMaxRadius={d => d.type === 'earthquake' ? d.mag * 1.5 : 3}
        ringPropagationSpeed={d => d.type === 'earthquake' ? d.mag / 2 : 3}
        ringRepeatPeriod={d => d.type === 'earthquake' ? Math.max(200, 1000 - (d.mag * 100)) : 1000}
      />
    </div>
  );
}
