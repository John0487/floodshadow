# One workspace: rainfall, forecast and evidence

The app remains in English. Before, During and After share one map and sidebar. Event history changes the selected evidence; it no longer opens a second interface. Named areas and their underlying census polygons remain available. Search isolates an area; Back to Guayaquil clears that selection.

## What the colors mean

- **Before — Expected rain (default):** choose the next six-hour total or an individual future hour. Each sector uses its assigned weather cell at that exact hour. Zero has no fill; unknown remains gray. The optional Places to watch layer retains the original green/yellow/orange attention index, which combines forecast rain and historical exposure. That index is not a flood probability.
- **During:** transparent at zero, then pale blue through distinct darker blues for increasing estimated equivalent rain rate. This is a fixed scale, so its meaning does not change when one sector is selected. Area aggregate fill is disabled here to prevent an unknown aggregate from covering a dry underlying polygon. Missing or stale cells remain unknown, not dry. Airport rainfall is shown separately as a station observation.
- **After:** solid red identifies an area with a published problem somewhere inside it; it does not establish the flood extent. Patterned red identifies specific census polygons suggested for verification by fresh estimated rain overlapping past exposure. Those are system inferences, not confirmed damage. Drainage quality is unknown. Red zones are never inserted merely to match a requested neighborhood name.

Rain amounts remain available as underlying data and tooltips; the summary uses natural descriptions. An equivalent model rate is not a measured street water depth. Future hourly amounts describe the hour ending at the selected time.

## Data and refresh

The browser checks `/api/weather/live` every minute and upon returning to the tab. The shared server cache limits upstream checks to once per minute. Concurrent requests coalesce; focus changes do not cancel an in-flight request. Manual refresh uses the same minimum interval. Source observation time, model time and retrieval time remain distinct. Polling cannot force a new upstream observation or model run.

Open-Meteo ECMWF IFS provides spatial estimates and hourly forecasts at six requested locations (actual returned cells are deduplicated). The model resolution is about 9 km and assignment is limited to nearby cells; it cannot independently detect every street or neighborhood. Some areas can legitimately share a value. Spatial variation is taken from returned data, never invented for appearance. Airport METAR provides independent point observations, not citywide measurements. Supplementary city probability, INAMHI daily guidance, airport history and municipal source links refresh separately every 15 minutes.

Source documentation reviewed: [Open-Meteo](https://open-meteo.com/en/docs), [NOAA Aviation Weather Center](https://aviationweather.gov/data/api/). INAMHI's station catalog and parameter metadata responded, but its station precipitation endpoint returned `403 origin_not_allowed`, explicitly restricted to its own viewer. No protected endpoint was bypassed and no gauge readings were invented. Local radar observations are not integrated.

A real check on October 26 at 19:13 local returned six model cells, a 19:00 model timestamp, an airport observation at 19:00 and no endpoint errors. Later browser checks at 19:17–19:18 showed model time advancing to 19:15 and stronger estimates in northern groups. These are dated checks, not permanent conditions. Raw API captures are retained in `data-local/weather/`.

## Preserved functionality

Analysis tools open evidence passports and dated-event verification, emergency-support information, saved-forecast scenarios, the experimental laboratory, evidence export and dated-event PDF reports in a details drawer. The laboratory remains explicitly experimental. Saved-event views suppress current city guidance and current rain probabilities; they expose the saved forecast hours and separate historical peak hourly rainfall from event totals. Ledger persistence and source dates are preserved. Advanced tools still require further usability review in the narrower drawer.

## Verification

Automated checks cover spatial assignment, stale/future/missing/zero values, report scope, immutable snapshots, forecast-hour changes, source normalization, failure recovery and cache behavior. A mounted-hook regression test checks minute refresh, focus coalescing, payload replacement, manual refresh routing and cleanup. Browser review checks the one-shell history flow, future-hour selection, English labels, desktop layout and mobile overflow. Production build and prepared-data integrity validation are required after final edits. Current run results are recorded below.

## Files

Main implementation: `src/city/RainApp.jsx`, `LiveRainView.jsx`, `WeatherDetails.jsx`, `WeatherTools.jsx`, `CityMap.jsx`, `unified-weather.js`, `useWeatherFeed.js`, `weather-command.css`; server refresh: `scripts/live-weather-service.mjs`, `vite.config.js`; tests: `unified-weather.test.js`, `weather-feed.test.js`, `package.json`. Report provenance: `public/data/flow/recent-reports.json`. Source documentation: this file, `LIVE_WEATHER.md`, `RAIN_FLOW_AND_SOURCES.md`, `README.md`.

Final verification: `npm test` **66/66 passed**; `npm run build` **passed** (existing MapLibre chunk-size advisory); `npm run demo:validate` **passed** — 6652 sectors, 3 events, 78 prepared impacts, 8 integrity-checked files. Browser review: one workspace in live and archived modes, future-hour selection, Urdesa isolation and return, visible checked/model times, no console errors in the inspected tab, no horizontal overflow at 390 × 844. Screenshots: `docs/screenshots/unified-before.png`, `unified-during.png`, `unified-after.png`, `unified-mobile.png`. These checks verify implementation behavior, not neighborhood rainfall accuracy or flood-prediction skill. No new statistical performance claim is made.
