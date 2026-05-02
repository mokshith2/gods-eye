/** [SYS] GOD'S EYE CORE v7.0 - ULTIMATE RESTORATION **/
let map, layers;
const registry = { aircraft: {}, ships: {}, satellites: {}, quakes: {}, weather: {}, sim: [] };

// ============== ASSETS & ICONS ==============
const createIcon = (color, baseClass, size=6) => L.divIcon({
    className: `custom-icon ${baseClass}`,
    html: `<div style="width:${size}px; height:${size}px; background:${color}; border-radius:50%; box-shadow:0 0 5px ${color}; border:1px solid #fff;"></div>`,
    iconSize: [size, size], iconAnchor: [size/2, size/2]
});

const icons = {
    aircraft: createIcon('#00ff88', 'aircraft-icon'),
    ship: createIcon('#4488ff', 'ship-icon', 8),
    military: createIcon('#ff3333', 'military-icon', 8),
    quake: createIcon('#ff4444', 'quake-icon', 10),
    storm: createIcon('#ffaa00', 'storm-icon', 12)
};

function sysLog(msg) {
    const term = document.getElementById('terminal-lines');
    if(!term) return;
    const d = document.createElement('div');
    d.innerText = `> [${new Date().toLocaleTimeString()}] ${msg}`;
    term.prepend(d);
    if(term.children.length > 15) term.removeChild(term.lastChild);
}

// ============== SIMULATION FALLBACK ==============
function runSim() {
    // Moves existing sim units slightly
    registry.sim.forEach(s => {
        s.lat += (Math.random() - 0.5) * 0.01;
        s.lon += (Math.random() - 0.5) * 0.01;
        s.m.setLatLng([s.lat, s.lon]);
    });
}

function initSim() {
    for(let i=0; i<100; i++) {
        let lat = (Math.random() * 140) - 70;
        let lon = (Math.random() * 360) - 180;
        const m = L.marker([lat, lon], {icon: icons.aircraft, opacity: 0.4}).addTo(layers.aircraft);
        registry.sim.push({m, lat, lon});
    }
}

// ============== TELEMETRY ENGINE ==============
async function poll() {
    try {
        const res = await fetch('data/data.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();

        if (data.timestamp) document.getElementById('last-update').innerText = 'LINK: ' + data.timestamp.substring(11, 19);

        // 1. AIRCRAFT
        if (data.aircraft && data.aircraft.length > 0) {
            const ids = new Set();
            data.aircraft.forEach(ac => {
                const id = String(ac.hex || ac.callsign);
                ids.add(id);
                const pos = [ac.lat, ac.lon];
                const icon = ac.is_mil ? icons.military : icons.aircraft;
                if (registry.aircraft[id]) {
                    registry.aircraft[id].setLatLng(pos);
                } else {
                    registry.aircraft[id] = L.marker(pos, { icon }).bindPopup(`<b>[${ac.is_mil?'MIL':'AIR'}] ${ac.callsign}</b>`).addTo(layers.aircraft);
                }
            });
            Object.keys(registry.aircraft).forEach(id => { if(!ids.has(id)) { layers.aircraft.removeLayer(registry.aircraft[id]); delete registry.aircraft[id]; }});
            document.getElementById('aircraft-count').innerText = data.aircraft.length;
        }

        // 2. SHIPS
        if (data.ships && data.ships.length > 0) {
            const ids = new Set();
            data.ships.forEach(sh => {
                const id = String(sh.mmsi);
                ids.add(id);
                if (registry.ships[id]) {
                    registry.ships[id].setLatLng([sh.lat, sh.lon]);
                } else {
                    registry.ships[id] = L.marker([sh.lat, sh.lon], { icon: icons.ship }).bindPopup(`<b>[SEA] ${sh.name}</b>`).addTo(layers.ships);
                }
            });
            Object.keys(registry.ships).forEach(id => { if(!ids.has(id)) { layers.ships.removeLayer(registry.ships[id]); delete registry.ships[id]; }});
            document.getElementById('ships-count').innerText = data.ships.length;
        }

        // 3. QUAKES & STORMS
        if (data.earthquakes) {
            layers.quakes.clearLayers();
            data.earthquakes.forEach(eq => {
                L.circleMarker([eq.lat, eq.lon], { radius: eq.mag*3, color: '#ff4444', fillOpacity: 0.3 }).bindPopup(`<b>[QUAKE] ${eq.mag}</b><br>${eq.place}`).addTo(layers.quakes);
            });
            document.getElementById('quakes-count').innerText = data.earthquakes.length;
        }
        if (data.news && data.news.length > 0) {
            const newsList = document.getElementById('news-list');
            newsList.innerHTML = data.news.map((n, i) => {
                const safeTitle = n.title.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                return `
                <div class="news-item" id="news-${i}">
                    <div class="news-title">${safeTitle}</div>
                    <div class="news-source">${n.source} // ${n.published || ''}</div>
                </div>`;
            }).join('');
            
            // Add safe listeners
            data.news.forEach((n, i) => {
                const el = document.getElementById(`news-${i}`);
                if (el) el.onclick = () => window.open(n.url, '_blank');
            });
            document.getElementById('news-count').innerText = data.news.length;
        }
        if (data.weather) {
            layers.weather.clearLayers();
            data.weather.forEach(w => {
                L.circle([w.lat, w.lon], { radius: 150000, color: '#ffaa00', fillOpacity: 0.1 }).bindPopup(`<b>[STORM] ${w.type}</b>`).addTo(layers.weather);
            });
            document.getElementById('weather-count').innerText = data.weather.length;
        }

        // 4. SATS & ISS
        if (data.satellites) {
            const ids = new Set();
            data.satellites.forEach(sat => {
                ids.add(sat.name);
                if (registry.satellites[sat.name]) { registry.satellites[sat.name].setLatLng([sat.lat, sat.lon]); }
                else { registry.satellites[sat.name] = L.circleMarker([sat.lat, sat.lon], { radius: 1, color: '#fff' }).addTo(layers.satellites); }
            });
            Object.keys(registry.satellites).forEach(id => { if(!ids.has(id)) { layers.satellites.removeLayer(registry.satellites[id]); delete registry.satellites[id]; }});
            document.getElementById('sats-count').innerText = data.satellites.length;
        }
        if (data.iss) {
            document.getElementById('stat-iss-lat').innerText = data.iss.lat.toFixed(2);
            document.getElementById('stat-iss-lon').innerText = data.iss.lon.toFixed(2);
        }

        // 5. AI INTEL
        if (data.gemini_intel && data.gemini_intel.hotspots) {
            layers.hotspots.clearLayers();
            const g = data.gemini_intel;
            document.getElementById('gemini-output').innerHTML = g.hotspots.map(hs => `<div class="hotspot-card" onclick="map.flyTo([${hs.lat}, ${hs.lon}], 6)"><div class="hotspot-label">${hs.label}</div><div class="hotspot-summary">${hs.summary}</div></div>`).join('');
            g.hotspots.forEach(hs => { L.circle([hs.lat, hs.lon], { radius: 100000, color: '#ff4444', fillOpacity: 0.1, pane: 'hotspotPane' }).addTo(layers.hotspots); });
            document.getElementById('hotspot-count').innerText = g.hotspots.length;
        }

    } catch (e) { console.error(e); }
}

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    map.createPane('hotspotPane');
    map.getPane('hotspotPane').style.zIndex = 450;
    map.getPane('hotspotPane').style.pointerEvents = 'none';

    layers = {
        aircraft: L.layerGroup().addTo(map),
        ships: L.layerGroup().addTo(map),
        quakes: L.layerGroup().addTo(map),
        weather: L.layerGroup().addTo(map),
        satellites: L.layerGroup().addTo(map),
        hotspots: L.layerGroup().addTo(map)
    };

    sysLog("GODSEYE INITIALIZED");
    initSim();
    setInterval(runSim, 100);
    setInterval(poll, 4000);
    poll();
}

function togglePanel(panel) { panel.classList.toggle('collapsed'); }
window.onload = init;

