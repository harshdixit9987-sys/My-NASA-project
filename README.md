# SARscope — Earth Observation Console

An interactive, worldwide earth-hazard monitoring dashboard inspired by Google Maps. The live view combines NASA EONET's curated global natural-event catalog, USGS earthquake reports, and active U.S. NOAA/NWS tsunami and flood alerts. A separate demo mode shows clearly labelled synthetic overlays.

> **Safety:** Earthquakes cannot be predicted reliably by this app or by SAR imagery. Live earthquake points are reports of events that have already occurred. NOAA/NWS alerts in this prototype are U.S.-focused official alert products; they do not represent worldwide alert coverage. This dashboard is informational, not an emergency warning service. Follow your local authorities.

## Features

- Pan and zoom a worldwide Esri basemap with English map labels; switch between streets, satellite, and terrain in Map settings.
- Live global USGS earthquake reports (monthly feed, filterable to 24 hours, 7 days, or 30 days), including source links, magnitude, and depth.
- NASA EONET global active natural-event catalog for reported wildfires, floods, landslides, severe storms, volcanoes, drought, and other catalogued events, with source links.
- Active NOAA/NWS U.S. tsunami and flood alerts, with alert polygons where the source provides geometry.
- Automatic refresh every five minutes, a manual refresh button, and per-feed error status.
- Search event names and locations; filter by event type and observation window.
- Search any worldwide place or latitude/longitude coordinates with the map search and zoom directly to its location.
- Filter reported events within 25, 50, 100, 250, or 500 km of a searched location and see the selected radius on the map.
- Start with an approximate Nepal–Bihar–southern Tibet watch area, filter reported events to it, and switch to a worldwide view.
- Firebase Authentication with email/password signup, Google sign-in, email verification, password reset, and sign-out.
- Export the currently filtered live reports or demo samples as GeoJSON.
- Separate synthetic demo overlays for interface demonstrations.
- A map-aware assistant that explains official report fields and explicitly avoids forecasting claims.
- Responsive layout for desktop and mobile.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Internet access is needed for Esri basemap tiles, USGS/NWS feeds, OpenStreetMap location search, Firebase Authentication, and the optional Google Fonts stylesheet. Location search runs only when submitted and uses OpenStreetMap Nominatim. If a data provider is unavailable, the UI shows the feed error; it does not substitute sample events in live mode.

The map opens in a worldwide view. NASA EONET is a curated catalog of natural events, not a comprehensive or instantaneous emergency warning system; source coverage, event categories, and reporting times vary. USGS provides global earthquake reports. NOAA/NWS active alerts are U.S.-focused and do not provide worldwide warning coverage. The Nepal–Bihar–southern Tibet view is an approximate rectangular map filter, not an administrative boundary. No synthetic demo overlays are presented as live reports.

## Set up accounts and sign-in

1. Create a Firebase project and register a Web app in the Firebase console.
2. In **Authentication → Sign-in method**, enable **Email/Password** and **Google**. Add the local and production app domains under **Authorized domains**.
3. Copy `.env.example` to `.env.local` and fill in the Web app values from Firebase project settings (`apiKey`, `authDomain`, `projectId`, `appId`, and `messagingSenderId`).
4. Restart the Vite dev server after editing `.env.local`.

The profile button opens sign-in or the signed-in account menu. Email signup sends a verification link; Google sign-in, sign-out, and password reset use Firebase Authentication. Without Firebase configuration, the sign-in form shows setup instructions and does not simulate successful authentication. Vite `VITE_` variables are public client configuration, not private server credentials; never put service-account keys or other secrets in them.

## Validate

```bash
npm run build
npm run lint
```

## Project structure

```text
src/
  data/incidents.ts   Synthetic map events and their types
  data/liveFeeds.ts   NASA EONET, USGS earthquake, and NOAA/NWS alert adapters
  firebase.ts         Optional Firebase app/auth configuration
  components/AssistantPanel.tsx  Map-aware demo assistant
  components/AccountMenu.tsx    Firebase account menu and sign-in UI
  assistant.ts        Local assistant response logic
  App.tsx             Dashboard, event filters, map, and export behavior
  App.css             Dashboard layout and responsive styles
  index.css           Global theme and typography
  main.tsx            React entry point and Leaflet styles
```

## SAR and hazard limitations

This project does **not** currently download or process NISAR/SAR scenes, derive flood extent, or detect landslides. NASA EONET displays events catalogued by its sources; it is not SAR-derived detection and does not guarantee every event is shown. The demo mode's polygons are synthetic and are never presented as live detections. No exact earthquake or tsunami prediction is made: SAR observes surface changes and cannot provide a reliable prediction of when or where an earthquake will occur. Tsunami warnings must come from the responsible official warning center.

Flood and tsunami alerts currently come from U.S. NOAA/NWS active-alert products, which have limited geographic coverage. There is no live global landslide feed connected in this prototype; the landslide option is demo-only. Before claiming SAR-derived hazard detection, connect a documented authorized SAR product and implement a validated, locally calibrated processing workflow with acquisition metadata, quality controls, uncertainty, ground validation, and source provenance.

The built-in assistant provides local, rule-based explanations of selected reports. It does not call an AI model or send data to a service.
