# GOD'S EYE | TACTICAL OSINT TERMINAL

High-fidelity global monitoring interface for real-time situational awareness. This isn't some weak dashboard; it's a telemetry-driven engine for tracking maritime, flight, and satellite assets across the globe in one unified view.

## CORE INTEL PIPELINES

- **MARITIME ENFORCEMENT**: Real-time AIS vessel tracking (Blue Markers). Hardened telemetry streams for global maritime traffic.
- **FLIGHT TELEMETRY**: High-speed ADSB integration for flight pathing and aircraft identification.
- **ORBITAL SURVEILLANCE**: Integrated `satellite.js` propagation for real-time tracking of satellite constellations and orbital debris.
- **SIGNAL INTELLIGENCE (SIGINT)**: AI-driven news and intelligence panels powered by Google's Generative AI to distill global events into actionable data points.

## ARCHITECTURE

Built for performance. Zero-latency relays and high-fidelity rendering.

- **Frontend**: React + Vite (Optimized for HMR and rapid deployment).
- **Visualization**: `react-globe.gl` + `three.js` for 3D orbital views, `leaflet` for 2D tactical maps.
- **Telemetry**: Purely telemetry-driven pipelines ensuring data integrity from source to UI.
- **UI/UX**: Tactical OSINT style. High-fidelity popups and telemetry-driven stats panels.

## SETUP

Stop talking and run it.

```bash
# Install the damn dependencies
npm install

# Fire up the terminal
npm run dev
```

## CONFIGURATION

Environment variables for the intelligence feeds go in `.env.local`.

- `VITE_GEMINI_API_KEY`: For the SIGINT/AI processing.
- `VITE_FLIGHT_API_KEY`: ADSB data.
- `VITE_MARITIME_API_KEY`: AIS data.

---
*Developed by cook45 & clack. If you break it, fix it.*
