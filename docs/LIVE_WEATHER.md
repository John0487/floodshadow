# Rain now: connected weather

The application opens one unified **Before / During / After** workspace. The event history changes the dated evidence inside this same workspace. Launch remains `npm run demo:local`, at `http://127.0.0.1:5174/`. See [the current interface and validation](UNIFIED_INTERFACE.md).

## Sources and meaning

- **NOAA Aviation Weather Center, SEGU METAR:** an independent observation at Guayaquil airport. `+TSRA` means thunderstorm with heavy rain; `TSRA` indicates thunderstorm with rain. Vicinity reports have a separate label. The original code and observation timestamp are visible. This does not measure rainfall amounts across neighborhoods, and it does not confirm flooding. A teal point marks the station.
- **Open-Meteo ECMWF IFS:** current estimates and hourly forecasts at the six existing requested locations. Actual returned cells are deduplicated. The model's approximate resolution is 9 km; sector assignment retains the 12 km distance limit. An area without a fresh nearby cell remains unknown.
- **Units:** current precipitation preserves the provider's millimeters and interval. The map displays an equivalent rate, `amount × 3600 / interval seconds`, in mm/h. This is not an observed hourly total. Future hourly millimeters cover the hour ending at the displayed timestamp.
- **Earlier forecast:** a prospective saved forecast received before the station observation is matched to its nearest covered cell and hour. That snapshot is never rewritten. A point report cannot validate the predicted amount or neighborhood distribution.

## Refresh and failures

The existing local Vite server provides `GET /api/weather/live`. No extra service or API key is needed. Requests use fixed public URLs, run independently, coalesce concurrent callers and are cached for one minute. The open view checks automatically every minute. A manual refresh respects the same shared cache. The page displays the connection time separately from source observation/model times.

Raw responses and normalized data are archived in `data-local/weather/capture-<timestamp>.json`; the latest response is atomically saved as `latest.json`. Partial failures retain the previous source's original timestamps and display an explicit warning. A fresh server can recover disk data when sources fail. These files never overwrite historical assessments or verifications.

Model values older than 45 minutes are hidden from the current map. Airport reports older than 90 minutes are labeled out of date and do not affirm current rain. Timestamps more than five minutes ahead are not fresh. Missing, invalid and negative amounts remain unknown; zero retains its meaning. Internet failure does not imply dry weather. Obtaining new weather requires Internet; the map geography and saved demonstration remain local.

## Practical limits

This is periodic near-current monitoring, not instantaneous street sensing. Refreshing every minute does not force a new model run. Open-Meteo current conditions are model output; Ecuador's sub-hourly values are interpolated from hourly output. The model can miss a local downpour. A single airport observation does not cover every neighborhood. INAMHI station feeds and local radar are not integrated. Rain is not proof of flooding or safe travel.

Source documentation: [Open-Meteo](https://open-meteo.com/en/docs), [NOAA API](https://aviationweather.gov/data/api/), [SEGU endpoint](https://aviationweather.gov/api/data/metar?ids=SEGU&format=json). [INAMHI applications](https://servicios.inamhi.gob.ec/aplicaciones-web/) were researched. Official daily guidance is connected separately; local station precipitation readings remain unavailable to this integration (viewer-only endpoint returned HTTP 403).

## Validation and actual observations

The earlier connected-weather milestone contained 50 passing tests; the current unified-interface milestone is documented in [UNIFIED_INTERFACE.md](UNIFIED_INTERFACE.md). Five new checks cover amount/rate conversion, deduplication, source units, invalid/zero/missing values, station weather codes, vicinity versus station rain, freshness/future times, spatial limits, prior-forecast matching, concurrency, cache lifetime, independent failures, original timestamps, archives and restart recovery. The production build passed with the existing MapLibre bundle-size advisory; prepared-data integrity validation passed. In the in-app browser, the live source timestamps and station rain appeared, selecting Urdesa updated all 89 local polygons and its assigned cell/forecast, and navigation to saved storms and back succeeded. Manual refresh was executed. Screenshot: `docs/screenshots/live-rain-connected.jpg`.

Both upstream endpoints returned HTTP 200 on October 26, 2026. Initial research found a 15:00 local `+TSRA` airport observation; the integrated endpoint later returned a 15:30 `TSRA` observation, six weather cells and no source errors. These are dated reports, not a claim that those exact conditions persist indefinitely. The preserved forecast expected 1.2 mm for the hour ending 15:00 near the airport and 1.1 mm for the hour ending 16:00. This anticipates some rain; it does not establish accurate intensity. The METAR supplied no observed hourly rainfall total for a numerical accuracy calculation.

Changed files: `src/city/live-weather.js`, `LiveRainView.jsx`, `live-weather.test.js`, `RainApp.jsx`, `CityMap.jsx`, `city.css`; `scripts/live-weather-service.mjs`, `vite.config.js`, `package.json`, `README.md`, `docs/FEATURE_STATUS.md` and this document. Historical event files and checksums remain unchanged.
