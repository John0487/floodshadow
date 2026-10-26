# FLOODSHADOW

Understand rainfall. Anticipate impacts. Learn from every storm.

A local rainfall-evidence beta for Guayaquil and Hack2Impact 2026, by team 3Jota. It connects expected rain, territorial context, reported places and questions that still need a check. It does not issue official emergency alerts or calibrated flood probabilities.

## Main features

The main interface now follows **Before / During / After** in a sidebar, with a large map and one concise summary. Hourly rain probabilities, official INAMHI guidance, independent airport history and recent source-reviewed problems are connected. Details are available on demand. See [rainfall workflow, sources and limits](docs/RAIN_FLOW_AND_SOURCES.md).

- Connected English views before, during and after a storm.
- 6652 census polygons organized into 100 named analytical groups and municipal quadrants. Samborondón is separate geographic context.
- Prepared local map and labels, with an optional online street basemap.
- Findings with sources, scope, certainty and saved revision history.
- Rainfall Scenario Explorer based on saved real forecasts, always labeled as simulation.
- Evidence saved on disk with corrections, previous versions and conflicting-session detection.
- English PDF impact reports and a seven-step demonstration.
- Preserved experimental underreporting laboratory.

## Requirements

Node.js 22 or later, npm and a modern browser with WebGL. Python is only needed to rebuild geographic sources or presentation documents. No cloud service or API key is needed for the prepared demonstration.

## Installation

    npm install

## Run locally

    npm run demo:local

Open http://127.0.0.1:5174/. Prepared data are validated before Vite starts on the loopback interface and strict port 5174. Stop with Ctrl+C; restart with the same command. `npm run dev` also serves the evidence API. Static `preview` is not the supported evidence-writing command.

## Prepared demo

Keep Prepared Demo Mode selected. Boundaries, labels, weather series and findings use local files. Internet can be disconnected while localhost remains available. The online street map is explicitly separate. Opening the prepared demo does not query weather providers. No service worker or ability to run with the local server stopped is claimed.

    npm run demo:validate

The checksum manifest covers eight prepared input files. Sources are in `public/data/city`. Evidence and finding revisions are in `data-local/ledger.json`, with a retained previous file. Browser storage is only a cache/fallback. Failed disk saves are reported and the browser copy can be exported.

## Update data

    npm run data:update -- --check-only
    npm run data:update

The first command validates a staging copy without changing live data. The second explicitly captures a forecast, validates a staged set and promotes it while retaining the previous folder. A failed capture or validation leaves the prepared version unchanged. Restart the demo and reload after promotion. Raw captures are immutable. The staging dry run and failure path are verified; they do not alone prove a successful fresh provider update.

Geographic rebuilding is separate and needs Python plus `scripts/requirements-city.txt`:

    npm run data:areas:fetch
    npm run data:areas:build

Review changed sources and validate them in staging before resealing a prepared set. The historical SQLite query copy is not automatically synchronized by forecast updates.

## Data sources

The prepared October 25, 2026 collection uses INEC 2022 geography, Guayaquil municipal nomenclature, ECMWF IFS through Open-Meteo, ESPOL published totals, an Ecuavisa list attributed to Segura EP and a documented susceptibility footprint. Structured INAMHI observations, NASA IMERG, terrain detail and tides are not integrated. Municipal infrastructure queries failed. See [DATA_SOURCES.md](docs/DATA_SOURCES.md).

## How the analysis works

The watch index combines land fraction in a susceptibility footprint and relative expected rainfall among six sampled cells. Both factors must exist. A higher value suggests closer attention, not a measured flood probability. A point report does not establish whole-neighborhood flooding; missing reports never become negative inspections.

## AI and future learning

Data collection stores evidence; assessment updates change findings; model retraining fits parameters to independent outcomes. Only the first two operate on real beta evidence. The separate Bayesian laboratory uses synthetic outcomes. Future supervised training needs representative checks, multiple storms and independent evaluation. See [MODEL_AND_LEARNING.md](docs/MODEL_AND_LEARNING.md).

## Testing

    npm test
    npm run build
    npm run demo:validate

Tests cover geographic membership, missing values, integrity, scientific constraints, isolated scenarios, finding revisions, disk persistence across instances, stale-write rejection and real PDF output. A build warning remains for MapLibre size. Tests are not field validation.

## Troubleshooting

- Port 5174 occupied: stop the previous FLOODSHADOW server. Strict-port startup prevents opening the wrong process.
- Checksum mismatch: restore the previous validated set rather than fabricating values.
- WebGL unavailable: use area search, lists and evidence cards.
- Evidence API unavailable: use `demo:local` or `dev`, not a static file or `preview`.
- Another session changed evidence: export unsaved work, reload and append a correction.
- External provider unavailable: keep the prepared version and retry the explicit update later.

## Documentation

- [DEMO_GUIDE.md](docs/DEMO_GUIDE.md): plain-language walkthrough.
- [MODEL_AND_LEARNING.md](docs/MODEL_AND_LEARNING.md): current analysis and future learning.
- [DATA_SOURCES.md](docs/DATA_SOURCES.md): provenance and limits.
- [SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md): components and information flow.
- [FEATURE_STATUS.md](docs/FEATURE_STATUS.md): implemented, experimental and future features.
- `docs/entrega/FLOODSHADOW_3Jota_Presentation_EN.docx` and PDF: current visual presentation without IEEE formatting.

## Limitations

No field checks are preloaded. There is no calibrated operational flood prediction, official warning, citywide rain-gauge network, verified drainage capacity, detailed hydraulic/tidal model or demonstrated reduction in losses. Historical reconstructions cannot count as predictions issued before the storms. The October 24–25 descriptive comparison did not highlight any of six calculable candidate sectors; one additional candidate lacks an index. Records and geocoding are incomplete. Operator review is local, not institutional authentication. Earlier documents are retained as historical material; current manuals and presentation are English.
# Connected weather

The app now opens **Rain now & next hours**: periodically updated Open-Meteo estimates, the NOAA airport METAR, next-hour forecasts and a comparison with the earlier saved forecast. It checks every five minutes, displays source timestamps and separates estimates from observations. Open **Explore saved storms** for the prepared demonstration. See [connected weather, sources and limitations](docs/LIVE_WEATHER.md). Internet is required for new weather; local geometry and saved storms remain available offline.

# Map clarity update

Purple means **Needs a check — no flood confirmed**; red means **Reported problem — approximate location**. Use the **Back to Guayaquil** button inside the map to clear a local selection and restore the city view. Known local attention values remain visible while missing parts stay gray. See [map clarity verification](docs/MAP_CLARITY_FIX.md).

