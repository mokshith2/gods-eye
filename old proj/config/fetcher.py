#!/usr/bin/env python3
"""
God's Eye - Data Fetcher
------------------------
Pulls data from several free (or low-cost) open-source APIs and writes a single
JSON file (~/godseye/data/data.json) that the Nginx dashboard consumes.
"""

import os
import json
import time
import random
import schedule
from datetime import datetime, timezone
from threading import Thread
import requests
import logging

# No SDK needed - pure REST HTTP for Gemini

try:
    from FlightRadar24 import FlightRadar24API
    HAS_FR24 = True
except ImportError:
    HAS_FR24 = False

try:
    from skyfield.api import load
    HAS_SKYFIELD = True
except ImportError:
    HAS_SKYFIELD = False

try:
    import websocket
    import threading
    HAS_WEBSOCKET = True
except ImportError:
    HAS_WEBSOCKET = False

# ----------------------------------------------------------------------
# 1  CONFIGURATION & ENVIRONMENT
# ----------------------------------------------------------------------
DATA_FILE   = "/data/data.json"
LOG_DIR = os.path.expanduser("~/godseye/logs")
LOG_FILE = os.path.join(LOG_DIR, "fetcher.log")

os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_FILE)
    ]
)
log = logging.getLogger(__name__)

# ----------------------------------------------------------------------
# 2  ENVIRONMENT VARIABLES
# ----------------------------------------------------------------------
OPENSKY_USERNAME   = os.getenv("OPENSKY_USERNAME", "")
OPENSKY_PASSWORD   = os.getenv("OPENSKY_PASSWORD", "")
NEWSAPI_KEY        = os.getenv("NEWSAPI_KEY", "")
GEMINI_API_KEY     = os.getenv("GEMINI_API_KEY", "")
AISSTREAM_KEY      = os.getenv("AISSTREAM_KEY", "")

# ----------------------------------------------------------------------
# 3  HELPER FUNCTIONS & AIS WEBSOCKET
# ----------------------------------------------------------------------
ACTIVE_SHIPS = {}

def start_ais_thread():
    if not HAS_WEBSOCKET or not AISSTREAM_KEY:
        return
        
    def on_message(ws, message):
        try:
            parsed = json.loads(message)
            meta = parsed.get("MetaData", {})
            mmsi = meta.get("MMSI")
            if not mmsi: return
            
            lat, lon = meta.get("latitude"), meta.get("longitude")
            name = meta.get("ShipName", "").strip()
            
            if lat is not None and lon is not None:
                if mmsi not in ACTIVE_SHIPS:
                    ACTIVE_SHIPS[mmsi] = {"mmsi": mmsi, "name": name or f"Vessel-{mmsi}", "heading": 0, "speed": 0}
                
                ACTIVE_SHIPS[mmsi]["lat"] = round(lat, 4)
                ACTIVE_SHIPS[mmsi]["lon"] = round(lon, 4)
                ACTIVE_SHIPS[mmsi]["time"] = time.time()
                if name: ACTIVE_SHIPS[mmsi]["name"] = name
                
                if parsed.get("MessageType") == "PositionReport":
                    rep = parsed.get("Message", {}).get("PositionReport", {})
                    if rep.get("TrueHeading", 511) != 511: ACTIVE_SHIPS[mmsi]["heading"] = rep["TrueHeading"]
                    if rep.get("Sog", 102.3) != 102.3: ACTIVE_SHIPS[mmsi]["speed"] = rep["Sog"]

                if len(ACTIVE_SHIPS) > 400:
                    oldest = min(ACTIVE_SHIPS.keys(), key=lambda k: ACTIVE_SHIPS[k]["time"])
                    del ACTIVE_SHIPS[oldest]
        except Exception:
            pass

    def on_open(ws):
        sub = {"APIKey": AISSTREAM_KEY, "BoundingBoxes": [[[-90, -180], [90, 180]]]}
        ws.send(json.dumps(sub))

    def run_ws():
        log.info("AIS maritime WebSocket starting...")
        while True:
            try:
                ws = websocket.WebSocketApp("wss://stream.aisstream.io/v0/stream", on_message=on_message, on_open=on_open)
                ws.run_forever()
            except Exception as e:
                log.error(f"AIS WS error: {e}")
            time.sleep(5)
            
    threading.Thread(target=run_ws, daemon=True).start()

def fetch_ships():
    """Return the currently tracked real vessels with valid GPS locks."""
    return [s for s in ACTIVE_SHIPS.values() if s.get("lat") and s.get("lon")][:300]

def save_json(data: dict):
    """Write the combined data dict to DATA_FILE."""
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        log.info(f"Data saved to {DATA_FILE}")
    except Exception as e:
        log.error(f"Failed to write {DATA_FILE}: {e}")

# ----------------------------------------------------------------------
# 4  DATA SOURCES
# ----------------------------------------------------------------------
def fetch_airplanes_live():
    """Uncensored Global ADS-B Hook (Airplanes.live). Captures Blocked & Military targets."""
    try:
        # Pings the global aggregation node directly (User provided HTTP endpoint)
        r = requests.get("http://api.airplanes.live/v2/all", timeout=20)
        if r.status_code == 200:
            data = r.json()
            
            mil_squad = []
            civilians = []
            
            for ac in data.get("ac", []):
                lat = ac.get("lat")
                lon = ac.get("lon")
                if not lat or not lon: continue
                
                flight = ac.get("flight", "").strip() or ac.get("r", "UNKNOWN")
                
                # Airplanes.live uses dbFlags (bit 0) for military designation
                dbFlags = ac.get("dbFlags", 0)
                is_mil = (dbFlags & 1) != 0
                
                rec = {
                    "hex": ac.get("hex", "UNK"),
                    "callsign": flight,
                    "country": ac.get("t", "N/A"), # Actually the plane type/model in this API
                    "lat": round(lat, 4),
                    "lon": round(lon, 4),
                    "alt_m": int(ac.get("alt_geom", 0) * 0.3048) if isinstance(ac.get("alt_geom"), (int, float)) else 0,
                    "heading": round(ac.get("track", 0), 1) if isinstance(ac.get("track"), (int, float)) else 0,
                    "is_mil": is_mil
                }
                
                if is_mil:
                    mil_squad.append(rec)
                else:
                    civilians.append(rec)
                    
            # Prioritize all hidden military targets + 300 random civilians for map performance
            final_list = mil_squad + random.sample(civilians, min(300, len(civilians)))
            log.info(f"Airplanes.live: Plotted {len(final_list)} aircraft [{len(mil_squad)} MILITARY INTERCEPTS]")
            return final_list
    except Exception as e:
        log.error(f"Airplanes.live error: {e}")
    return []

def fetch_earthquakes():
    """USGS recent earthquakes (M2.5+ in the last 24h)."""
    quakes = []
    try:
        feeds = [
            "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
            "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/1.0_day.geojson",
            "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"
        ]
        for url in feeds:
            try:
                r = requests.get(url, timeout=10)
                if r.status_code == 200:
                    feed = r.json()
                    for feat in feed.get("features", []):
                        props = feat["properties"]
                        coords = feat["geometry"]["coordinates"]
                        quakes.append({
                            "id": feat["id"],
                            "place": props.get("place", "Unknown"),
                            "mag": props.get("mag", 0),
                            "type": props.get("type", "earthquake"),
                            "lat": coords[1],
                            "lon": coords[0],
                            "depth_km": coords[2],
                            "time": props.get("time"),
                            "url": props.get("url")
                        })
            except Exception as e:
                log.error(f"USGS feed error: {e}")
        log.info(f"USGS: {len(quakes)} earthquakes")
    except Exception as e:
        log.error(f"USGS error: {e}")
    return quakes

def fetch_weather_sample():
    """Sample a handful of world cities from Open-Meteo (free)."""
    cities = [
        (40.7128, -74.0060, "New York"),
        (51.5074, -0.1278, "London"),
        (35.6762, 139.6503, "Tokyo"),
        (-33.8688, 151.2093, "Sydney"),
        (48.8566, 2.3522, "Paris"),
        (-22.9068, -43.1729, "Rio"),
        (55.7558, 37.6173, "Moscow"),
        (28.6139, 77.2090, "Delhi"),
        (31.2304, 121.4737, "Shanghai"),
        (-1.2921, 36.8219, "Nairobi")
    ]
    weather = []
    try:
        for lat, lon, name in cities:
            try:
                url = "https://api.open-meteo.com/v1/forecast"
                params = {
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,weather_code,wind_speed_10m",
                    "timezone": "auto"
                }
                r = requests.get(url, params=params, timeout=5)
                if r.status_code == 200:
                    d = r.json()["current"]
                    weather.append({
                        "city": name,
                        "lat": lat,
                        "lon": lon,
                        "temp_c": round(d["temperature_2m"], 1),
                        "wind_kph": round(d["wind_speed_10m"], 1),
                        "weather_code": d["weather_code"]
                    })
            except Exception:
                pass
        log.info(f"Open-Meteo: {len(weather)} cities")
    except Exception as e:
        log.error(f"Weather error: {e}")
    return weather

def fetch_news():
    """Fetch from NewsAPI if key exists, otherwise fallback to GDELT."""
    articles = []
    if NEWSAPI_KEY:
        try:
            url = f"https://newsapi.org/v2/top-headlines?category=general&pageSize=10&apiKey={NEWSAPI_KEY}"
            r = requests.get(url, timeout=10)
            if r.status_code == 200:
                for art in r.json().get("articles", [])[:10]:
                    articles.append({
                        "title": art.get("title", ""),
                        "url": art.get("url", ""),
                        "source": art.get("source", {}).get("name", "NewsAPI")
                    })
                log.info(f"NewsAPI: {len(articles)} articles")
                return articles
        except Exception as e:
            log.error(f"NewsAPI error: {e}")
            
    # Fallback to GDELT
    try:
        url = "https://api.gdeltproject.org/api/v2/doc/doc"
        params = {"query": "cyber OR military OR global", "mode": "artlist", "maxrecords": 10, "format": "json"}
        r = requests.get(url, params=params, timeout=10)
        if r.status_code == 200:
            for art in r.json().get("articles", []):
                articles.append({
                    "title": art.get("title", ""),
                    "url": art.get("url", ""),
                    "source": art.get("source", {}).get("name", "GDELT")
                })
            log.info(f"GDELT: {len(articles)} articles")
    except Exception as e:
        log.error(f"GDELT error: {e}")
    return articles

def fetch_iss_position():
    """Current ISS location (wheretheiss.at)."""
    try:
        r = requests.get("https://api.wheretheiss.at/v1/satellites/25544", timeout=10)
        if r.status_code == 200:
            d = r.json()
            return {
                "lat": d["latitude"],
                "lon": d["longitude"],
                "alt_km": d["altitude"],
                "timestamp": d["timestamp"]
            }
    except Exception as e:
        log.error(f"ISS error: {e}")
    return {"lat": None, "lon": None, "alt_km": None, "timestamp": None}

def fetch_rainviewer_radar():
    """Retrieve the latest timestamp path for RainViewer Global Radar."""
    try:
        r = requests.get("https://api.rainviewer.com/public/weather-maps.json", timeout=5)
        if r.status_code == 200:
            return r.json()["radar"]["past"][-1]["path"]
    except Exception as e:
        log.error(f"Rainviewer error: {e}")
    return ""

def fetch_active_satellites():
    """Compute current positions of active intelligence/weather/comms satellites."""
    if not HAS_SKYFIELD:
        return []
    try:
        ts = load.timescale()
        t = ts.now()
        # Download and cache TLE dynamically
        sats = load.tle_file('https://celestrak.org/NORAD/elements/active.txt', filename='/tmp/active_sats.txt')
        
        interesting = []
        for s in sats:
            name = s.name.upper()
            if any(x in name for x in ['STARLINK', 'NOAA', 'GOES', 'COSMOS', 'USA ', 'GPS ', 'GLONASS']):
                interesting.append(s)
                
        # Use a stable slice instead of random sample to prevent 'teleporting' satellites
        interesting.sort(key=lambda x: x.name)
        sampled = interesting[:500]
        
        results = []
        for sat in sampled:
            geocentric = sat.at(t)
            subpoint = geocentric.subpoint()
            results.append({
                "name": sat.name,
                "lat": round(subpoint.latitude.degrees, 4),
                "lon": round(subpoint.longitude.degrees, 4),
                "alt_km": round(subpoint.elevation.km, 1)
            })
        log.info(f"Skyfield: Tracking {len(results)} multi-role satellites")
        return results
    except Exception as e:
        log.error(f"Skyfield error: {e}")
        return []

# ----------------------------------------------------------------------
# 4b  GEMINI AI INTELLIGENCE (structured hotspot output)
# ----------------------------------------------------------------------
def generate_gemini_intel(data_dict):
    """Pings Gemini and returns structured hotspot data with coordinates."""
    quakes = data_dict.get("earthquakes", [])
    q_count = len(quakes)
    news_titles = [n.get("title", "") for n in data_dict.get("news", [])]

    def build_offline_hotspots():
        """Fallback: build hotspots from raw telemetry when Gemini is unavailable."""
        hotspots = []
        if quakes:
            strongest = max(quakes, key=lambda q: q.get("mag", 0))
            hotspots.append({
                "label": "SEISMIC ANOMALY",
                "lat": strongest["lat"],
                "lon": strongest["lon"],
                "summary": f"M{strongest.get('mag', '?')} event near {strongest.get('place', 'Unknown')}. {q_count} total quakes in last 24h. Monitoring tectonic drift patterns."
            })
        else:
            hotspots.append({
                "label": "TECTONIC BASELINE",
                "lat": 35.6762, "lon": 139.6503,
                "summary": "Global seismic arrays nominal. Zero anomalous vibrations in designated patrol sectors."
            })
        hotspots.append({
            "label": "GPS JAMMING ZONE",
            "lat": 48.0, "lon": 37.0,
            "summary": "Sustained GPS spoofing arrays detected pulsing across Eastern Europe and Baltic shipping lanes. Assets advised to switch to INS navigation."
        })
        if news_titles:
            hotspots.append({
                "label": "SIGINT INTERCEPT",
                "lat": 33.0, "lon": 35.0,
                "summary": f"High-frequency news chatter: '{news_titles[0][:60]}...'. Assessing strategic impact vectors."
            })
        else:
            hotspots.append({
                "label": "COMMS ISOLATION",
                "lat": 10.0, "lon": 110.0,
                "summary": "Global news networks returning sparse datastreams. Monitoring South China Sea corridor."
            })
        return hotspots

    if not GEMINI_API_KEY:
        log.warning("No Gemini API Key. Using offline hotspot generator.")
        return {"text": None, "hotspots": build_offline_hotspots()}

    try:
        prompt = f"""You are 'God's Eye', a classified planetary monitoring AI. Analyze this telemetry:
        - Earthquakes: {q_count} detected recently
        - GPS Jamming Alerts: Eastern Europe, Baltic Sea, Middle East, South China Sea.
        - News Events: {'; '.join(news_titles[:10])}

        Return ONLY valid JSON (no markdown, no code fences) in this exact format:
        {{
          "hotspots": [
            {{"label": "SHORT TITLE", "lat": 0.0, "lon": 0.0, "summary": "2 sentence max assessment in cyber-military tone."}},
            {{"label": "SHORT TITLE", "lat": 0.0, "lon": 0.0, "summary": "2 sentence max assessment."}},
            {{"label": "SHORT TITLE", "lat": 0.0, "lon": 0.0, "summary": "2 sentence max assessment."}}
          ]
        }}
        Identify exactly 3 hotspots with real geographic coordinates. Be precise with lat/lon."""

        # Using stable model format. Fallback automatically if API limit reached.
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        headers = {"Content-Type": "application/json"}
        body = {"contents": [{"parts": [{"text": prompt}]}]}

        resp = requests.post(url, headers=headers, json=body, timeout=20)

        if resp.status_code == 200:
            raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            clean = raw_text.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1]
            if clean.endswith("```"):
                clean = clean.rsplit("```", 1)[0]
            parsed = json.loads(clean)
            log.info(f"Gemini returned {len(parsed.get('hotspots', []))} hotspots")
            return {"text": None, "hotspots": parsed.get("hotspots", build_offline_hotspots())}
        else:
            log.error(f"Gemini HTTP {resp.status_code}. Using offline fallback.")
            return {"text": None, "hotspots": build_offline_hotspots()}

    except (json.JSONDecodeError, KeyError, IndexError) as e:
        log.error(f"Gemini returned invalid JSON: {e}. Using offline fallback.")
        return {"text": None, "hotspots": build_offline_hotspots()}
    except Exception as e:
        log.error(f"Gemini network error: {e}. Using offline fallback.")
        return {"text": None, "hotspots": build_offline_hotspots()}

# ----------------------------------------------------------------------
# 5  MAIN DATA COMBINER
# ----------------------------------------------------------------------
def build_full_payload():
    """Collect everything and write to DATA_FILE."""
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "aircraft": fetch_airplanes_live(),
        "ships": fetch_ships(),
        "earthquakes": fetch_earthquakes(),
        "weather": fetch_weather_sample(),
        "news": fetch_news(),
        "iss": fetch_iss_position(),
        "radar_path": fetch_rainviewer_radar(),
        "satellites": fetch_active_satellites()
    }
    payload["gemini_intel"] = generate_gemini_intel(payload)
    save_json(payload)
    log.info("Full data cycle completed.")

def schedule_jobs():
    """Set up periodic calls."""
    schedule.every(15).seconds.do(lambda: payload_update_section("ships", fetch_ships))
    schedule.every(30).seconds.do(lambda: payload_update_section("aircraft", fetch_airplanes_live))
    schedule.every(60).seconds.do(lambda: payload_update_section("satellites", fetch_active_satellites))
    schedule.every(5).minutes.do(lambda: payload_update_section("radar_path", fetch_rainviewer_radar))
    schedule.every(3).minutes.do(lambda: payload_update_section("earthquakes", fetch_earthquakes))
    schedule.every(15).minutes.do(lambda: payload_update_section("weather", fetch_weather_sample))
    schedule.every(5).minutes.do(lambda: payload_update_section("news", fetch_news))
    schedule.every(5).minutes.do(build_full_payload)

    while True:
        schedule.run_pending()
        time.sleep(1)

def payload_update_section(section: str, fetcher):
    """Refresh a single section inside the JSON file."""
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        data[section] = fetcher()
        data["timestamp"] = datetime.now(timezone.utc).isoformat()
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        log.debug(f"Updated section '{section}'")
    except Exception as e:
        log.error(f"Error updating {section}: {e}")

# ----------------------------------------------------------------------
# 7  ENTRY POINT
# ----------------------------------------------------------------------
if __name__ == "__main__":
    log.info("God's Eye fetcher starting.")
    log.info(f"AIS Config: Active={bool(AISSTREAM_KEY)}")
    start_ais_thread()

    build_full_payload()
    schedule_jobs()

    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        log.info("Stopping fetcher.")


