# A simpler rainfall workflow

The connected screen now uses three stages in a sidebar: **Before**, **During**, and **After**. The map is the primary view. A compact side panel changes with the selected stage; source and methodology details open in a separate drawer. Event history changes the evidence in this same workspace. Verification, laboratory, scenarios and reports remain in the **Analysis tools** drawer. See [the current unified-interface notes](UNIFIED_INTERFACE.md).

## Before

By default the map shows the sum of the next six available hourly precipitation forecasts; a selector also exposes each individual future hour. Incomplete sums remain unavailable. The side panel shows the next six hourly rain probabilities and today's highest hourly probability from Open-Meteo's separate city-reference probability endpoint. The daily maximum is not presented as the probability of any rain throughout the whole day, and none of these percentages is a flood probability.

The current INAMHI period is summarized in English using a small deterministic condition dictionary, with source wording retained in the data. INAMHI does not publish an issue timestamp in this response, so retrieval today cannot prove it was available before an earlier downpour. El Niño context is available on request, based on the official Ministry/ERFEN October summary with its source date; it does not become an automatic street-level risk multiplier.

## During

The map distinguishes light, moderate and heavy estimated rainfall rates. Rates up to 2.5 mm/h are light, above 2.5 through 7.6 moderate, and above 7.6 heavy, following a rate-based classification. These are equivalent rates calculated from the model interval, not measured hourly totals. The airport's independent point observation is shown separately.

The compact area list ranks the highest supported rate in parts of each named group and retains coverage information in the calculation. Ties can arise from shared weather cells. The ranking is not a measured neighborhood rainfall ranking or a damage ranking. Selecting a name focuses its polygons; the map return button clears the selection.

## After

Red markers and dashed outlines identify source-mentioned areas, without claiming complete inundation. One source-reviewed recent record concerns Urdesa during October 25–26, based on Diario Extra's October 26 article. The marker is an area reference, not a geocoded flooded street. Individual incident time and affected extent are unknown. Recent mentions expire after two days; they do not follow future storms indefinitely. No “worst damage” ranking is invented from rainfall or report counts.

**Forecast review** compares saved forecasts with the later 24-hour SEGU report history. A forecast must have been received before the start of the hour being compared. Only the nearest covered cell is used. Rain mentioned in a station report can support rain occurrence at that instant; it cannot establish the hourly amount, the absence of rain throughout an hour or all neighborhood conditions. Report comparisons are explicitly not independent storm trials or a calibrated accuracy percentage. Missing earlier forecasts and vicinity-only reports remain inconclusive.

## New connected data

- INAMHI daily Guayaquil forecast: `https://inamhi.gob.ec/api_pronos/forecast/daily_forecast/list_by_date_now/`.
- NOAA SEGU history: `https://aviationweather.gov/api/data/metar?ids=SEGU&format=json&hours=24`.
- Open-Meteo hourly probability and daily maximum: the city-reference URL is preserved as `CHANCE_URL` in `src/city/rain-journey.js`.
- Municipal rainfall-related bulletin discovery: `https://www.guayaquil.gob.ec/wp-json/wp/v2/posts?search=lluvias&per_page=8&_fields=id,date_gmt,link,title`. A bulletin is not automatically classified as a current incident.
- Recent source review: `https://www.extra.ec/noticia/guayaquil/tormenta-electrica-guayaquil-segura-ep-pide-permanecer-hogares-166090.html`.

The local `/api/weather/context` endpoint refreshes these additional sources every 15 minutes, independently of the one-minute current-weather connection. It stores raw responses and normalized snapshots under `data-local/journey/`. Partial failures retain each previous source's dates and appear in the Sources drawer. Recent immutable local weather captures are loaded for forecast comparison. Historical prepared snapshots remain unchanged.

Research also checked RainViewer's coverage mask: the central Guayaquil pixel was opaque black, meaning no supported radar coverage there. Empty radar tiles were therefore not used to imply dry weather. The INAMHI station-list request timed out. The municipal `Eventos` layer concerns cultural events; the flood-events layer's most recent Guayaquil event is January 15, 2025. Neither was imported as live storm evidence.

## Design and validation

`frontend-design` guided the redesign. A navy navigation rail, local-font headings, a large geographic canvas, a compact intensity key and one stage-specific summary replace the long stack of explanatory cards. Hourly probability bars provide a real data visualization. Source details and the forecast comparison remain accessible by keyboard and Escape-close drawers. No decorative photograph or extra plugin is required for the map-centered interface.

Browser review covered all three stage switches, hourly probabilities, selecting the Urdesa report, its exterior-only outline, the comparison drawer, source drawer opening/closing on mobile, and return navigation. At a tested 1280×800 viewport, the rail, map and summary occupy separate columns. At 390×844, stages become a compact top bar and the summary follows the map; document width was 375 CSS pixels within a 390-pixel viewport, without horizontal overflow. Temporary viewport overrides were reset after testing. The mobile source-button focus layout was corrected during this review.

The full suite passes 58 tests. New checks cover source probabilities, daily-peak semantics, official forecast validity, intensity thresholds, partial coverage, incomplete future sums, forecast receipt chronology, vicinity reports, bulletin classification, report expiry and exterior-only display outlines without modifying analytical geometry. Production compilation and prepared-data validation passed. A real `/api/weather/context` response returned four INAMHI periods, 33 airport reports, eight municipal bulletins and 48 hourly probabilities, with no errors during the check. This is a dated integration check, not a guarantee of future source availability.

Changed modules: `rain-journey.js`, `rain-journey.test.js`, `RainJourney.jsx` (the comparison detail), `useWeatherFeed.js`, `LiveRainView.jsx`, `WeatherDetails.jsx`, `weather-command.css`, `CityMap.jsx`; `scripts/journey-source-service.mjs`, `vite.config.js`, `package.json`, `public/data/flow/recent-reports.json`, and this documentation. Run `npm run demo:local`, then open `http://127.0.0.1:5174/`.

Sources for interpretation: [NOAA rate-of-fall guidance](https://www.weather.gov/media/directives/010_pdfs_archived/pd01013011a.pdf), [Open-Meteo documentation](https://open-meteo.com/en/docs), [RainViewer coverage-mask documentation](https://www.rainviewer.com/api/weather-maps-api.html), [official El Niño context](https://www.agricultura.gob.ec/estado-del-evento-el-nino/).
