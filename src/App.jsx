import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as satellite from 'satellite.js';

import GlobeView from './components/GlobeView';
import MapView from './components/MapView';
import TerminalLogs from './components/TerminalLogs';
import TargetLockPanel from './components/TargetLockPanel';
import { LeftPanel, RightPanel } from './components/Panels';

export default function App() {
  const [viewMode, setViewMode] = useState('globe'); 
  const [milOnly, setMilOnly] = useState(false);
  const [flights, setFlights] = useState([]);
  const [boats, setBoats] = useState([]);
  const [satellites, setSatellites] = useState([]);
  const [earthquakes, setEarthquakes] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTarget, setActiveTarget] = useState(null);
  const [places, setPlaces] = useState([]);

  // --- FLIGHT INTELLIGENCE ENGINE (OPENSKY + SIM FALLBACK) ---
  const fetchFlightData = useCallback(async () => {
    try {
      // Trying a different high-speed relay
      const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent('https://opensky-network.org/api/states/all')}`);
      if (!res.ok) throw new Error("Link Severed");
      const data = await res.json();
      
      const realFlights = (data.states || []).slice(0, 300).map(s => {
        const callsign = s[1]?.trim() || 'UNC-TARGET';
        const isMil = /^(RCH|REACH|JAKE|SPAR|DUKE|BONE|HOG|VIPER|FIGHTER|SLAM|GALAXY|DRAG|BOLT)/i.test(callsign);
        return {
          id: s[0],
          lat: s[6],
          lng: s[5],
          alt: s[7] || 0,
          vel: s[9] || 0,
          heading: s[10] || 0,
          callsign,
          type: 'flight',
          threatLevel: isMil ? 'HIGH' : 'LOW',
          isMil
        };
      });

      if (realFlights.length > 0) {
        setFlights(realFlights);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn("Signal lost. Running internal simulation.");
      const simFlights = Array.from({length: 120}, (_, i) => {
        const isMil = Math.random() > 0.9;
        return {
          id: `SIM-${i}`, lat: (Math.random() - 0.5) * 140, lng: (Math.random() - 0.5) * 360,
          alt: 10000, vel: 500, heading: 0, callsign: isMil ? `MIL-${i}` : `CIV-${i}`,
          type: 'flight', threatLevel: isMil ? 'HIGH' : 'LOW', isMil, desc: 'SIMULATED'
        };
      });
      setFlights(simFlights);
      setLoading(false);
    }
  }, []);

  const fetchSatelliteData = useCallback(async () => {
    try {
      const res = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle'));
      if (!res.ok) return;
      const tles = (await res.text()).split('\n').filter(line => line.trim() !== '');
      const activeSats = [];
      for (let i = 0; i < tles.length; i += 3) {
        if (!tles[i+2]) break;
        const name = tles[i].trim();
        if (['STARLINK', 'NOAA', 'COSMOS', 'USA', 'GPS', 'GLONASS', 'ISS'].some(k => name.includes(k))) {
          try {
            const satrec = satellite.twoline2satrec(tles[i+1], tles[i+2]);
            activeSats.push({ name, satrec });
          } catch (e) {}
        }
        if (activeSats.length >= 100) break;
      }
      const updatePositions = () => {
        const now = new Date();
        const posData = activeSats.map(s => {
          const positionAndVelocity = satellite.propagate(s.satrec, now);
          const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, satellite.gstime(now));
          return {
            id: s.name,
            callsign: s.name,
            lat: satellite.degreesLat(positionGd.latitude),
            lng: satellite.degreesLong(positionGd.longitude),
            alt: positionGd.height * 1000,
            type: 'satellite',
            threatLevel: 'LOW'
          };
        });
        setSatellites(posData);
      };
      updatePositions();
      return setInterval(updatePositions, 10000);
    } catch (err) {}
  }, []);

  const fetchEarthquakes = useCallback(async () => {
    try {
      const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
      const data = await res.json();
      setEarthquakes(data.features.slice(0, 15).map(f => ({
        id: f.id,
        callsign: f.properties.title,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        mag: f.properties.mag,
        type: 'earthquake',
        threatLevel: f.properties.mag >= 5 ? 'HIGH' : 'LOW'
      })));
    } catch (err) {}
  }, []);

  const fetchIntelligence = useCallback(async () => {
    try {
      let articles = [];
      const apiKey = import.meta.env.VITE_NEWS_API_KEY;
      
      // 1. Primary Source: NewsAPI (High Quality)
      if (apiKey) {
        const res = await fetch(`https://newsapi.org/v2/top-headlines?language=en&category=technology&pageSize=10&apiKey=${apiKey.trim().replace(/['"]/g, '')}`);
        if (res.ok) {
          const data = await res.json();
          articles = (data.articles || []).map(a => ({
            title: a.title,
            source: { name: a.source?.name || 'INTEL' },
            url: a.url,
            publishedAt: a.publishedAt
          }));
        }
      }

      // 2. Fallback/Augmentation: GDELT (Geopolitical Intelligence)
      if (articles.length < 5) {
        const gdeltUrl = 'https://api.gdeltproject.org/api/v2/doc/doc?query=(cyber OR military OR "security alert")&mode=artlist&maxrecords=10&format=json';
        const gRes = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(gdeltUrl));
        if (gRes.ok) {
          const gJson = await gRes.json();
          const gData = JSON.parse(gJson.contents);
          const gArticles = (gData.articles || []).map(a => ({
            title: a.title,
            source: { name: 'GDELT-SIGINT' },
            url: a.url,
            publishedAt: a.seendate
          }));
          articles = [...articles, ...gArticles];
        }
      }
      
      setNews(articles.slice(0, 15));
    } catch (err) {
      console.error("Intelligence fetch failure:", err);
    }
  }, []);

  useEffect(() => {
    const fleet = Array.from({length: 40}, (_, i) => ({
      id: `SIM-MMSI-${100000 + i}`, callsign: `VESSEL-${i}`,
      lat: (Math.random() - 0.5) * 140, lng: (Math.random() - 0.5) * 360,
      heading: Math.random() * 360, vel: Math.random() * 10 + 2,
      threatLevel: Math.random() > 0.98 ? 'HIGH' : 'LOW', type: 'boat'
    }));
    setBoats(fleet);
    const boatInterval = setInterval(() => {
      setBoats(prev => prev.map(b => ({ ...b, lat: b.lat + (Math.cos(b.heading) * 0.01), lng: b.lng + (Math.sin(b.heading) * 0.01) })));
    }, 5000);
    fetchFlightData(); fetchEarthquakes(); fetchIntelligence();
    const satInterval = fetchSatelliteData();
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_populated_places_simple.geojson')
      .then(res => res.json()).then(data => setPlaces(data.features));
    const i1 = setInterval(fetchFlightData, 30000);
    const i2 = setInterval(fetchEarthquakes, 120000);
    const i3 = setInterval(fetchIntelligence, 300000);
    return () => {
      clearInterval(boatInterval); clearInterval(i1); clearInterval(i2); clearInterval(i3);
      if (satInterval) satInterval.then(id => clearInterval(id));
    };
  }, [fetchFlightData, fetchSatelliteData, fetchEarthquakes, fetchIntelligence]);

  const points = useMemo(() => {
    let base = [...flights, ...boats, ...satellites];
    if (milOnly) return base.filter(p => p.isMil || p.threatLevel === 'CRITICAL' || p.type === 'satellite');
    return base;
  }, [flights, boats, satellites, milOnly]);

  const ringsData = useMemo(() => [...earthquakes], [earthquakes]);
  const counts = { flights: flights.length, boats: boats.length, earthquakes: earthquakes.length, news: news.length, satellites: satellites.length, hotspots: 0 };

  return (
    <div className="gods-eye-container">
      <div className="scanlines"></div>
      {viewMode === 'globe' ? (
        <GlobeView places={places} points={points} ringsData={ringsData} setActiveTarget={setActiveTarget} />
      ) : (
        <MapView points={points} ringsData={ringsData} setActiveTarget={setActiveTarget} />
      )}

      <div className="tactical-btn-container">
        <button onClick={() => setViewMode(prev => prev === 'globe' ? 'map' : 'globe')} className="tactical-btn">
          {viewMode === 'globe' ? '2D MAP' : '3D GLOBE'}
        </button>
        <button onClick={() => setMilOnly(!milOnly)} className={`tactical-btn ${milOnly ? 'active' : ''}`}>
          {milOnly ? 'SHOW ALL' : 'MILITARY ONLY'}
        </button>
      </div>
      
      <TargetLockPanel activeTarget={activeTarget} onClose={() => setActiveTarget(null)} />
      <LeftPanel loading={loading} counts={counts} points={points} />
      <RightPanel news={news} />
      <TerminalLogs />
    </div>
  );
}
