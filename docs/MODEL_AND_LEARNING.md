# Model and learning

## In everyday language

FLOODSHADOW joins a storm’s expected rain, available rainfall evidence and reported places. It suggests where to look more closely. It cannot establish that a neighborhood flooded from rain alone. Saving a new record is data collection; changing a finding after a reviewed check is an assessment update. Neither means a predictor has been retrained.

## Implemented in the beta

- External weather model: ECMWF IFS through Open-Meteo. Six distinct sampled cells have about 9 km nominal resolution. A detailed map does not increase this resolution.
- Own territorial analysis: geodesic intersection and union of a documented susceptible-land footprint with official census polygons. The footprint does not provide a dated flood history per neighborhood.
- Own watch index: `50 × land fraction + 50 × rainfall midrank percentile`. Both factors are required. Zero rain contributes zero rain points. Equal weights and the threshold 60 are declared conventions, not fitted coefficients or flood probabilities.
- Shadow Detection: high-index smaller areas without enough localized evidence are candidates for a check. The system never treats missing reports as observed negatives.
- Findings: Preventive Watch, Verification Needed and Data Unavailable describe uncertainty. Documented Impact means a published report with provisional geography. Confirmed Impact requires an accepted operator check and retains that check’s scope. No finding confirms an entire neighborhood from one point.
- Actual checks: review, corrections and a local file ledger change evidence states and recommendations. Previous records remain available. Operator acceptance is not independent institutional authentication.
- Preserved research laboratory: a Bernoulli hidden-impact model, spatial latent fields and Poisson reporting with false reports, approximated through importance sampling. Positive and negative synthetic checks update shared hypotheses. These probabilities and credible intervals are experimental and uncalibrated for Guayaquil.

## What the demonstration uses

Two documented October 2026 episodes, official INEC geography, municipal place names, six weather cells per episode, five published station totals for October 19, 78 typed source records for October 24–25 and a separate prospective capture are real source inputs. Historical watch scores were reconstructed afterward. They cannot count as predictions issued before the storms. The prospective capture preserves a genuinely earlier assessment but still needs independent outcome data.

The Scenario Explorer changes saved forecast totals hypothetically. Rain amount and duration multiply the baseline; the duration control assumes the original average rate continues. A north/south tilt changes cell totals. Weather availability removes a deterministic subset. Percentiles use the fixed original episode distribution. This permits sensitivity analysis without moving the reference along with the slider. The scenario makes no confirmed incidents and does not edit the original snapshot. It is not a hydraulic inundation simulation.

## Planned future capability

There is no automatic supervised retraining in this beta. A future model could estimate impact occurrence separately from the probability an impact gets reported. Without repeated observations or reliable inspections, these processes are weakly identifiable; a flexible classifier alone will not solve subreporting.

Needed inputs include independently reviewed positive and negative checks, inspection scope and timing, a known initial reporting collection, compatible station windows, source coverage and multiple independent storms. Drainage condition, useful terrain information and tides would require verifiable sources and documented transformations. Do not create target labels from unreported places.

Split training and evaluation by storm and spatial groups to limit leakage. Fit a simple logistic baseline before more complex models. Compare random selection, report count, susceptibility history and the original heuristic with the same candidate pool and inspection budget. Evaluate affected places generally and affected places with no initial reports separately. For probabilities, assess reliability plots, Brier score and log loss; for inspection ranking, report discoveries per budget, precision and recall on eligible verified outcomes. Report selection bias, missingness, calibration uncertainty and paired confidence intervals. Never evaluate on synthetic labels as if they were field outcomes.

## Results and limits

The real historical comparison is unfavorable: none of six calculable provisionally mapped sectors in the October 24–25 collection exceeds 60; a seventh lacks an index. This is descriptive, not forecast recall. The preserved 2500-episode synthetic benchmark has mixed results against history and the old heuristic. No real-world predictive superiority is claimed.

Methodological reference: D. I. MacKenzie et al., “Estimating site occupancy rates when detection probabilities are less than one,” Ecology 83(8), 2248–2255, 2002, https://pubs.usgs.gov/publication/5224176. This motivates separating state and imperfect detection; it does not validate a flood model.
