# Feature status

| Capability | Status | Evidence or limit |
|---|---|---|
| Compact Before / During / After interface | Implemented | Sidebar, large map, hourly probability chart, stage summary and on-demand sources/review drawers |
| INAMHI forecast, NOAA report history and municipal discovery | Implemented | Separate 15-minute context endpoint; bulletin discovery never automatically confirms incidents |
| Hourly rain probability | Implemented | Provider-supplied percentage at a city reference; daily value is explicitly the highest hourly probability |
| Rain now: connected weather | Implemented | Open-Meteo model estimates, one NOAA airport METAR, 5-minute polling, freshness and failure handling; see LIVE_WEATHER.md |
| Connected before/during/after views | Implemented | Same selected event, snapshots and smaller-area IDs |
| Recognizable areas and general-area quadrants | Implemented | 100 groups from municipal nomenclature and parish fallbacks |
| Progressive local map | Implemented | Named area overview, smaller boundaries revealed on closer views; local DOM labels |
| Prepared local demonstration | Implemented | No external weather/basemap requests in prepared mode; checksummed local inputs |
| Disk evidence persistence | Implemented | Local API, revision checking, atomic file replacement and previous copy |
| Finding history | Implemented | Source, event, area, scope, method and append-only state changes |
| Preventive Watch and Verification Needed | Experimental | Uncalibrated contextual rule, not official alerts |
| Documented Impact | Implemented | Published source with provisional point location |
| Confirmed Impact workflow | Implemented | Requires reviewed operator evidence; none preloaded as real checks |
| Rainfall Scenario Explorer | Experimental | Fixed-reference sensitivity analysis, not a hydraulic model |
| English impact PDF | Implemented | Eight required sections with sources and explicit denominators |
| English event walkthrough | Implemented | Seven linked steps including scenarios |
| Forecast update staging | Implemented | Validated dry run; failed-source path retains live data |
| Live station/radar monitoring | Unavailable | No compatible feed integrated |
| Municipal drainage condition and capacity | Unavailable | Source queries failed; unknown is not absent |
| Detailed terrain and tide effects | Unavailable | No compatible integrated dataset |
| Research Bayesian learning | Experimental | Preserved synthetic laboratory and comparators |
| Supervised automatic retraining | Planned | Requires independent reviewed labels and held-out storms |
| Calibrated operational flood prediction | Planned | Current real-event index has no demonstrated predictive superiority |
| Multiuser authenticated institutional deployment | Planned | Local beta has no institutional authentication |

Prior IEEE-formatted and Spanish documents are retained as historical files. The current presentation and the six current manuals are English and use plain language. The visual presentation has no IEEE manuscript format.
