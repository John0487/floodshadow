import React from "react";
import { localDate, number } from "./format.js";
import {
  intensity,
  strongestAreas,
  evaluateRainReports,
} from "./rain-journey.js";
// The stages follow evidence, never turn a weather estimate into damage.
export default function RainJourney({
  stage,
  onStage,
  payload,
  context,
  rows,
  areas,
  events,
  reports,
  onArea,
  onHistorical,
  now,
}) {
  const ranking = strongestAreas(areas, rows);
  const periods = context?.inamhi?.periods ?? [],
    period = periods.find(
      (p) => Date.parse(p.start) <= now && Date.parse(p.end) > now,
    );
  const steps = [
    ["forecast", "What was expected?"],
    ["now", "Where is rain stronger?"],
    ["check", "Did the forecast match?"],
    ["impacts", "Where were problems reported?"],
  ];
  return (
    <section className="rain-journey" aria-label="Follow this rainfall event">
      <nav aria-label="Rainfall evidence steps">
        {steps.map(([id, label], i) => (
          <button
            key={id}
            aria-pressed={stage === id}
            onClick={() => onStage(id)}
          >
            <span>{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="journey-explanation">
        {stage === "forecast" ? (
          <>
            <h2>First, read what was expected.</h2>
            <p>
              The map now shows the next six hourly rainfall amounts added
              together. The saved connection time lets us compare these
              expectations with evidence that arrives later.
            </p>
            {period ? (
              <p>
                <strong>
                  INAMHI's forecast for this period: {period.description}.
                </strong>{" "}
                Valid {localDate(period.start)} to {localDate(period.end)}.{" "}
                <a
                  href={context.inamhi.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Official source
                </a>
                . Its issue time is not supplied; it cannot be scored as an
                earlier warning simply because we retrieved it today.
              </p>
            ) : (
              <p>
                No current INAMHI period is available. The weather-model
                forecast remains a separate source.
              </p>
            )}
          </>
        ) : null}
        {stage === "now" ? (
          <>
            <h2>
              {ranking.length
                ? `The strongest available estimate is ${number(ranking[0].rate, 1)} mm/h.`
                : "Waiting for fresh rainfall data."}
            </h2>
            <p>
              Blue shades mean light or moderate estimated rain. Orange means a
              heavy estimated rate above 7.6 mm/h. These are weather estimates,
              not flooded neighborhoods; the airport card below is an
              independent observation.
            </p>
            <div className="journey-area-list">
              {ranking.slice(0, 5).map((r) => (
                <button key={r.area.id} onClick={() => onArea(r.area)}>
                  <strong>{r.area.name}</strong>
                  <span>
                    {intensity(r.rate).label} · up to {number(r.rate, 1)} mm/h
                  </span>
                  <small>
                    {r.known} of {r.total} smaller areas have data. The peak can
                    apply to only part of this group.
                  </small>
                </button>
              ))}
            </div>
            <small>
              Equal values can come from the same weather cell. Named areas do
              not create extra measuring stations.
            </small>
          </>
        ) : null}
        {stage === "check" ? (
          <ForecastCheck context={context} events={events} now={now} />
        ) : null}
        {stage === "impacts" ? (
          <>
            <h2>Published problems are a different kind of evidence.</h2>
            <p>
              Red markers and outlines identify areas mentioned in recent
              sources. An outline means “a problem was reported somewhere here”,
              not “this whole area flooded”. More rain alone does not establish
              worse damage.
            </p>
            {reports.length ? (
              <div className="journey-area-list">
                {reports.map((r) => (
                  <article key={r.id}>
                    <button
                      onClick={() =>
                        onArea(areas.find((a) => a.id === r.areaId))
                      }
                    >
                      <strong>{r.areaName}</strong>
                      <span>
                        Published flooding report · exact streets not specified
                      </span>
                    </button>
                    <p>{r.description}</p>
                    <small>
                      Published {localDate(r.publishedAt)} · {r.publisher}.
                      Report window: {localDate(r.windowStart)} to{" "}
                      {localDate(r.windowEnd)}. No individual incident time.
                    </small>
                    <p>
                      <a href={r.source} target="_blank" rel="noreferrer">
                        Read the evidence
                      </a>
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p>
                No recent geolocated impact evidence is integrated. This is an
                information gap, not proof that no one was affected.
              </p>
            )}
            <p>
              The available reports do not establish which neighborhood suffered
              the most damage. The historical register is available separately.
            </p>
            <button onClick={onHistorical}>
              Review saved impacts and verification history
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
export function ForecastCheck({ context, events }) {
  const result = evaluateRainReports(
      events,
      context?.history,
      context?.captures,
    ),
    latest = result.rows.filter((r) => r.outcome !== "unavailable").at(-1);
  return (
    <>
      <h2>
        {latest
          ? latest.label
          : "We need an earlier forecast and later evidence."}
      </h2>
      <p>
        We compare a forecast saved before the hour began with what the airport
        later reported. This checks whether rain was anticipated at that
        location; it does not validate the amount or every neighborhood.
      </p>
      {latest && (
        <p>
          Saved {localDate(latest.capturedAt)}: {number(latest.mm, 1)} mm
          expected for that hour. Airport report at{" "}
          {localDate(latest.observation.observedAt)}:{" "}
          {latest.rain
            ? "rain was reported"
            : "no rain was included in this report"}
          .
        </p>
      )}
      <div className="journey-score">
        <span>
          <b>{result.anticipated}</b> reports of rain that had been anticipated
        </span>
        <span>
          <b>{result.missed}</b> reports of rain not anticipated
        </span>
        <span>
          <b>{result.notObserved}</b> times rain was expected but absent from
          that report
        </span>
      </div>
      <small>
        These are report-level comparisons at one station. Repeated reports are
        not independent storms. No rainfall-total accuracy score can be computed
        without matching measured totals. No rain in one report does not prove
        the whole hour was dry.
      </small>
      <details>
        <summary>Inspect the comparison trail</summary>
        {result.rows
          .slice(-12)
          .reverse()
          .map((r) => (
            <p key={r.observation.observedAt}>
              <time>{localDate(r.observation.observedAt)}</time> · {r.label}
              {r.mm != null ? ` · saved forecast ${number(r.mm, 1)} mm` : ""}
            </p>
          ))}
      </details>
    </>
  );
}
