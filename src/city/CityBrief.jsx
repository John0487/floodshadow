import React from "react";
import {
  CloudRain,
  X,
  Search,
  ChevronRight,
  ArrowUpRight,
  Eye,
} from "lucide-react";
import {
  number,
  pct,
  localDate,
  PHASES,
  TYPE_LABELS,
  sectorName,
  parishName,
} from "./format.js";
export default function CityBrief({ view, analysis, actions }) {
  const {
    phase,
    event,
    zone,
    search,
    tab,
    selected,
    isOutlook,
    scopeName,
    area,
  } = view;
  const {
    sectors,
    metrics,
    coverage,
    shadows,
    comparison,
    descriptive,
    listImpacts,
    ranked,
    rows,
  } = analysis;
  const { setZone, setSearch, setTab, selectSector, setDialog } = actions;
  const rowById = new Map(rows.map((r) => [r.sector.id, r]));
  const current = PHASES[phase];
  if (area?.kind === "external_context")
    return (
      <section className="city-brief">
        <div className="city-brief-intro">
          <span className="phase-label">
            Separate canton · geographic context
          </span>
          <h1>Samborondón</h1>
          <p>
            246 official census polygons. This canton is outside the Guayaquil
            storm analysis. No weather estimates, impact counts or flood
            priorities are transferred here.
          </p>
          <p>
            Use the area filter to return to Urdesa, Samanes or another analyzed
            area.
          </p>
        </div>
      </section>
    );
  const showForecast = phase === "before" || isOutlook;
  const forecastTotals = (
    area
      ? rows.map((r) => r.assessment.forecastMm)
      : event.forecast.grid.map((c) => c.totalMm)
  ).filter((value) => typeof value === "number" && Number.isFinite(value));
  return (
    <section className="city-brief">
      <div className="city-brief-intro">
        <span className="phase-label">
          {phase === "summary"
            ? "One connected view of Guayaquil"
            : phase === "before"
              ? "Forecast and prevention"
              : phase === "during"
                ? "Rainfall and impact monitoring"
                : "Impact and learning"}
        </span>
        <h1>{current.title}</h1>
        <p>{current.description}</p>
      </div>
      <div className="event-measures">
        <div>
          <CloudRain size={18} />
          <span>
            {showForecast
              ? "Highest forecast total across sampled cells"
              : area
                ? "Published locations assigned to this area"
                : event.observations.length
                  ? "Highest published rainfall total"
                  : "Documented water accumulation"}
            <strong>
              {showForecast
                ? forecastTotals.length
                  ? number(Math.max(...forecastTotals), 1)
                  : "No data"
                : area
                  ? listImpacts.length
                  : event.observations.length
                    ? "181"
                    : "68"}
              <small>
                {showForecast
                  ? " mm · ECMWF IFS model"
                  : area
                    ? " locations · provisional mapping"
                    : event.observations.length
                      ? " mm · Cerro Santa Ana"
                      : " cited locations"}
              </small>
            </strong>
          </span>
        </div>
        <small>
          {isOutlook
            ? `Received ${localDate(event.forecast.retrievedAt)} · not a measurement`
            : phase === "before"
              ? `Model initialized ${localDate(event.forecast.initializedAt)} · reconstruction, not a prediction issued by FLOODSHADOW`
              : area
                ? "Only mapped records in the selected group; missing locations remain unresolved."
                : event.observations.length
                  ? "ESPOL / INAMHI · Oct 19, 2026"
                  : "Ecuavisa, attributed to Segura EP · Oct 25, 2026"}
        </small>
      </div>
      {phase === "after" ? (
        <section className="post-metrics">
          <h2>What is known and what is missing</h2>
          <dl>
            <div>
              <dt>Affected among verified sectors</dt>
              <dd>{pct(metrics.positiveAmongVerified)}</dd>
            </div>
            <div>
              <dt>Verification coverage</dt>
              <dd>{pct(metrics.verificationCoverage)}</dd>
            </div>
            <div>
              <dt>Sectors with provisional point records</dt>
              <dd>
                {metrics.documented} / {number(metrics.total)}
              </dd>
            </div>
            <div>
              <dt>Known records / sectors analyzed</dt>
              <dd>{pct(metrics.documentedShare)}</dd>
            </div>
          </dl>
          <p>
            This is not the true share of affected sectors. Only{" "}
            {metrics.verified} sectors have an accepted sector-wide
            verification.
          </p>
          <details>
            <summary>Definitions and evaluation</summary>
            <p>
              Affected among verified: {metrics.positives}/{metrics.verified};
              coverage: {metrics.verified}/{metrics.total}; known records:{" "}
              {metrics.documented}/{metrics.total}. Empty denominators cannot be
              evaluated.
            </p>
            <p>
              Discoveries without an initial report:{" "}
              {metrics.unreportedDiscoveryEvaluable
                ? metrics.unreportedDiscoveries
                : "not evaluable; the initial report collection is incomplete"}
              .
            </p>
            <p>{comparison.reason ?? comparison.warning}</p>
            {comparison.evaluable && (
              <p>
                Within the verified subset only: {comparison.n} sectors with an
                index; {comparison.tp} prioritized and affected, {comparison.fp}{" "}
                prioritized and unaffected, and {comparison.fn} affected but not
                prioritized. Precision within this subset:{" "}
                {pct(comparison.precision)}; recall: {pct(comparison.recall)}.
                These results cannot be generalized to uninspected areas.
              </p>
            )}
            <p>
              Exploratory comparison: {descriptive.highlighted} of{" "}
              {descriptive.evaluable} sectors with provisional point records
              exceed the vigilance threshold; {descriptive.notHighlighted} fall
              below it and {descriptive.missingIndex} have no index.{" "}
              {descriptive.warning}
            </p>
            <p>
              Learning: records build a reviewable evidence collection. A model
              is not retrained with an insufficient sample or without
              independent storms for validation.
            </p>
          </details>
        </section>
      ) : (
        <section className="coverage-summary">
          <div>
            <strong>{number(sectors.length)}</strong>
            <span>official sectors available</span>
          </div>
          <div>
            <strong>{pct(coverage.forecastSectorShare)}</strong>
            <span>can be assigned a forecast cell</span>
          </div>
          <div>
            <strong>{shadows.length}</strong>
            <span>candidates for evidence collection</span>
          </div>
          <details>
            <summary>What this coverage means</summary>
            <p>
              {scopeName}. By sector area: {pct(coverage.forecastAreaShare)}{" "}
              with weather assigned by representative point.{" "}
              {coverage.definition}
            </p>
            <p>
              {event.observations.length} stations with published totals;
              instrumental coverage by area is unknown. Municipal
              infrastructure: no data downloadable in this query.
            </p>
          </details>
        </section>
      )}
      <div className="brief-list-heading">
        <h2>
          {phase === "before" ? "Sectors to watch" : "Explore the evidence"}
        </h2>
        {zone && (
          <button title="Clear zone filter" onClick={() => setZone(null)}>
            Zone {zone.slice(-3)} <X size={12} />
          </button>
        )}
      </div>
      <label className="city-search">
        <Search size={15} />
        <input
          aria-label="Search sector or location"
          placeholder="INEC code or cited place"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="city-list-tabs">
        <button
          disabled={phase === "before"}
          aria-pressed={tab === "incidents"}
          onClick={() => setTab("incidents")}
        >
          Records
        </button>
        <button
          aria-pressed={tab === "priority"}
          onClick={() => setTab("priority")}
        >
          Vigilance
        </button>
        <button
          disabled={phase === "before"}
          aria-pressed={tab === "shadow"}
          onClick={() => setTab("shadow")}
        >
          Shadow Detection
        </button>
      </div>
      <div className="city-feature-list">
        {tab === "incidents" ? (
          <>
            {listImpacts.length ? (
              listImpacts.slice(0, 80).map((i) => (
                <button
                  key={i.id}
                  className={
                    "incident-list-row " +
                    (i.sectorId === selected ? "active" : "")
                  }
                  onClick={() =>
                    i.sectorId
                      ? selectSector(i.sectorId)
                      : setDialog("incidents")
                  }
                >
                  <i className={"incident-symbol " + i.type} />
                  <span>
                    <strong>{i.locationText}</strong>
                    <small>
                      {TYPE_LABELS[i.type] ?? "Verified observation"} ·{" "}
                      {i.sectorId
                        ? "candidate location"
                        : i.coordinates
                          ? "candidate intersection; ambiguous sector"
                          : "location pending review"}
                    </small>
                  </span>
                  <ChevronRight size={13} />
                </button>
              ))
            ) : (
              <p className="list-empty">
                No individual incidents have been added for this storm. Explore
                measurements and modeled rainfall; this does not imply an
                absence of impacts.
              </p>
            )}
            <button
              className="register-link"
              onClick={() => setDialog("incidents")}
            >
              View records and provenance <ArrowUpRight size={13} />
            </button>
          </>
        ) : (
          <>
            {(tab === "shadow"
              ? shadows
                  .map((x) => rowById.get(x.sector.id))
                  .filter(Boolean)
                  .filter(
                    (r) =>
                      (!zone || r.sector.zoneId === zone) &&
                      (!search || r.sector.id.includes(search)),
                  )
              : ranked
            )
              .slice(0, 30)
              .map((r) => (
                <button
                  key={r.sector.id}
                  className={
                    "sector-list-row " +
                    (r.sector.id === selected ? "active" : "")
                  }
                  onClick={() => selectSector(r.sector.id)}
                >
                  <span>
                    <strong>{sectorName(r.sector)}</strong>
                    <small>
                      {r.sector.id} · {parishName(r.sector)}
                    </small>
                  </span>
                  <b>
                    {number(r.assessment.score)}
                    <small>/100</small>
                  </b>
                </button>
              ))}
            {!(tab === "shadow" ? shadows : ranked).length && (
              <p className="list-empty">
                No sectors match the filter. Try another code or clear the zone
                filter.
              </p>
            )}
            {tab === "shadow" && (
              <p className="list-empty">
                Candidates with index ≥60, no localized record and no accepted
                sector-wide verification. Insufficient information: no confirmed
                flooding.
              </p>
            )}
          </>
        )}
      </div>
      <button className="brief-demo" onClick={() => setDialog("demo")}>
        <Eye size={17} />
        <span>
          Explore a complete storm
          <small>Before, during, after and verification</small>
        </span>
        <ChevronRight size={16} />
      </button>
    </section>
  );
}
