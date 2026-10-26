# Final beta delivery and verification

Verified on October 25, 2026. Product and current presentation language: English. The current six-page presentation uses natural language, Arial typography, a real application screenshot and visual comparison tables; it does not use IEEE formatting. Historical delivery files remain available separately.

## Implemented behavior

- A prepared local demonstration, with saved weather evidence and a local polygon map, is the default. The online street basemap is optional.
- Navigation follows city, municipal quadrant, named analytical group and smaller census polygon. All 6,652 Guayaquil polygons belong to exactly one of 100 groups. Samborondón's 246 boundaries remain separate context. Named groups are analytical aggregations, not new legal boundaries.
- The seven-step **Explore a Rainfall Event** guide connects the storm selector, before/during/after views, area search, scenarios and findings.
- Findings distinguish **Preventive Watch**, **Documented Impact**, **Confirmed Impact**, **Verification Needed** and **Data Unavailable**. A published location is not a reviewed field confirmation; a point does not establish whole-sector flooding. Each finding includes reasons, time context, sources and its saved revision trail.
- Verification records and finding history persist in a local file, with revision checking, input validation, atomic replacement and a previous-file copy. Corrections preserve the earlier evidence. The local store contains zero invented field checks.
- Four scenario controls vary rain amount, duration, spatial tilt and available weather cells. Every scenario carries an explicit simulation label. Original observations and stored assessments remain unchanged. Exporting a real impact report requires returning to real evidence.
- **Generate Rainfall Impact Report** downloads a real PDF with eight sections: event overview, rainfall conditions, documented impacts, area findings, forecast comparison, unverified areas, key findings, and sources/limitations.

## Architecture and modified files

React/Vite loads prepared GeoJSON and JSON snapshots. MapLibre draws geography; the existing analysis modules produce dated assessments. Findings and scenarios are separate projections. A loopback Vite API saves reviewed evidence to `data-local/ledger.json`. The scientific laboratory remains separate from the real-event interface. See `SYSTEM_ARCHITECTURE.md` for the complete flow.

New modules: `src/city/findings.js`, `FindingsPanel.jsx`, `ScenarioExplorer.jsx`, `EventWalkthrough.jsx`, `impact-report.js`, `final-beta.test.js`; `scripts/local-ledger.mjs`, `validate-demo.mjs`, `update-local-data.mjs`, `make-visual-presentation.py`.

Updated integration: `src/city/RainApp.jsx`, `CityMap.jsx`, `CityDialog.jsx`, `AreaExplorer.jsx`, `data.js`, `format.js`, `city.css`; `src/style.css`, `vite.config.js`, `package.json`, `package-lock.json`, `.gitignore`; `scripts/prepare-areas.py`, `build-city.mjs`, `render-documents-windows.py`; prepared territory outputs and `public/data/city/prepared-manifest.json`.

Current manuals: `README.md`, `docs/MODEL_AND_LEARNING.md`, `DATA_SOURCES.md`, `SYSTEM_ARCHITECTURE.md`, `DEMO_GUIDE.md`, `FEATURE_STATUS.md` and this report. Presentation outputs: `docs/entrega/FLOODSHADOW_3Jota_Presentation_EN.docx` and `.pdf`.

## Corrections and analysis

- Scenarios compare rain with the original six-cell distribution. Recomputing that reference after every uniform multiplier would cancel the intended sensitivity; the fixed reference preserves it.
- Missing weather inputs remain unknown. Removing weather coverage never produces invented zero rainfall.
- Newer accepted point corrections supersede older positive point checks. Source records and operator checks retain their different scopes.
- Named-area selection and smaller-polygon selection switch at the same zoom boundary, allowing drilldown instead of repeatedly selecting the enclosing group.
- Local-font labels and removal of the remote font import eliminate those external dependencies from prepared mode.
- Saved history is idempotent when a finding is unchanged. Stale writes, deletion of previous evidence and invalid accepted checks are rejected.
- Removed a duplicate JSX callback found during the final build. Production compilation then completed without that warning.

The real-event watch index is an exploratory prioritization method, not a calibrated flood probability. The preserved laboratory separates latent impact and reporting through a Bayesian Poisson-mixture model, with experimental spatial assumptions and sequential checks. Neither simulation performance nor a retrospective reconstruction demonstrates prospective field accuracy. Full assumptions are in `MODEL_AND_LEARNING.md`.

Real meteorology currently uses ECMWF through Open-Meteo. Published ESPOL station totals remain separate comparisons. INEC geography, municipal nomenclature and cited incident records provide territorial and documentary context. NASA GPM, INAMHI live feeds, detailed terrain and tides are researched possibilities, not integrated observations.

## Checked results

| Check | Actual result |
|---|---|
| `npm test` after final code edits | 42 passed; zero failed or skipped |
| `npm run build` after final code edits | Passed; MapLibre chunk-size advisory remains |
| `npm run demo:validate` | Passed: 6,652 sectors, 3 events, 78 impact records, 8 checksummed files |
| `data:update --check-only` | Staging built and validated; live data not promoted |
| Simulated update failure | Exit 1 as intended; live manifest unchanged |
| File ledger fixture | Fresh instance retained evidence; stale write/deletion rejected; previous copy retained |
| Local demo relaunched and browser reloaded | API matched disk revision 1, zero checks, 228 history entries |
| Browser checks | Prepared map, named-area selection, scenarios, seven-step guide and PDF download verified; latest console check had no errors |
| Current browser width | 760 CSS pixels; document content 745 pixels, no horizontal overflow |
| Downloaded event PDF | Two pages; all eight required sections present |
| Presentation layout | Six rendered pages inspected visually; no clipped or overlapping text |

For the prepared October 24–25 main-parish selection, with duration unchanged, no north/south tilt and full cell availability, 0%, 100% and 200% rainfall assumptions produced **0, 191 and 1,233 of 6,416** smaller areas at the watch threshold. These are sensitivity results, not flooded-area counts or an accuracy benchmark.

The existing real-event comparison remains unfavorable: the historical index highlighted **0 of 6** calculable candidate sectors; one further candidate lacked an index. Provisional incident locations and the absence of representative negative checks prevent a reliable real-world accuracy claim. The existing reproducible laboratory comparisons remain available, but they do not establish improved performance on Guayaquil field outcomes.

## Running and presenting

From the project folder run `npm install` once if dependencies are absent, then `npm run demo:local`. Open `http://127.0.0.1:5174/`. Keep the process running. Prepared mode uses saved evidence; an operating-system network-disconnection test was not performed. A static hosting build alone does not provide the local persistence API.

Read `DEMO_GUIDE.md` for the seven-step presentation. Open the new English presentation PDF for the jury and retain its editable Word file. No demonstration video was recorded. A backup of the earlier beta is stored at `data-cache/backups/beta-before-final-20261025-230606.zip`.

## Learning and remaining limits

Today the system collects evidence, revises findings and updates verification recommendations. It does not automatically retrain a calibrated flood model. That requires representative positive and negative checks from independent storms, compatible sources and evaluation against simple baselines before fitting more complex methods.

The beta is local, without institutional authentication or multi-user deployment. Coarse weather cells do not gain street precision from detailed polygons. Incident times and geocoded positions may be incomplete; named-group boundaries include review flags. Compatible live station coverage, drainage, terrain and tides remain unavailable. Prospective accuracy, user benefit and field outcomes have not been demonstrated. Full mobile-device testing, a physically disconnected-network trial and a recorded presentation remain pending. Data-update staging and failure recovery were tested; a fresh live-source promotion was not run in this delivery.
