import React from "react";
import {
  MapPin,
  CloudRain,
  Layers,
  Link2,
  ArrowUpRight,
  Info,
  History,
  Workflow,
} from "lucide-react";
import {
  number,
  localDate,
  TYPE_LABELS,
  STATE_LABELS,
  sectorName,
  parishName,
  infrastructureName,
} from "./format.js";
import VerificationForm from "./VerificationForm.jsx";
import { FACTOR_INFO } from "./analysis.js";
export default function SectorPassport({
  row,
  event,
  snapshot,
  impacts,
  records,
  data,
  phase,
  onRecords,
  onSources,
  onLaboratory,
}) {
  if (!row)
    return (
      <aside className="sector-passport">
        <div className="passport-empty">
          <MapPin size={32} />
          <h2>Explore a sector.</h2>
          <p>
            Select a map polygon or search an INEC code. Explore its data,
            sources and information gaps here.
          </p>
        </div>
      </aside>
    );
  const { sector, assessment, state } = row;
  const located = impacts.filter((i) => i.sectorId === sector.id);
  const forecast = event.forecast.grid.find(
      (c) => c.id === assessment.forecastCellId,
    ),
    modeled = event.modelRain.grid.find((c) => c.id === assessment.modelCellId);
  return (
    <aside
      className="sector-passport"
      aria-label="Selected sector evidence passport"
    >
      <div className="sector-passport-head">
        <span>
          <MapPin size={14} /> Evidence passport
        </span>
        <button onClick={onSources} title="View sources">
          <Link2 size={15} />
        </button>
      </div>
      <div className="sector-identity">
        <small>{parishName(sector)}</small>
        <h2>{sectorName(sector)}</h2>
        {sector.areaName && (
          <p>
            Named group: {sector.areaName}. The INEC polygon keeps its official
            identity inside this analytical grouping.
          </p>
        )}
        <p>
          INEC {sector.id} · {number(sector.areaKm2, 3)} km²
        </p>
        {sector.boundaryAreaChange > 0.01 && (
          <p className="boundary-warning">
            Uncertain analytical boundary: harmonization changes{" "}
            {number(sector.boundaryAreaChange * 100, 1)}% of the original area.
            The territorial index is unavailable. See the geometry audit.
          </p>
        )}
        <span
          className={
            "evidence-badge " + (phase === "before" ? "reconstruction" : state)
          }
        >
          {phase === "before"
            ? snapshot.kind === "prospective"
              ? "Index captured before the rainfall window"
              : "Retrospective analysis, not issued beforehand"
            : STATE_LABELS[state]}
        </span>
      </div>
      <section className="sector-rain">
        <h3>
          <CloudRain size={16} />{" "}
          {phase === "before"
            ? "Forecast rainfall in this cell"
            : "Model-estimated rainfall"}
        </h3>
        <div className="sector-rain-value">
          {number(
            phase === "before" ? assessment.forecastMm : assessment.modelMm,
            1,
          )}{" "}
          <span>mm</span>
        </div>
        <p>
          {event.windowStart.replace("T", " ")} —{" "}
          {event.windowEnd.replace("T", " ")} · UTC−5
        </p>
        <small>
          {phase === "before"
            ? snapshot.kind === "prospective"
              ? "Saved ECMWF IFS forecast"
              : "Earlier ECMWF IFS weather forecast"
            : "ECMWF IFS estimate, not a rain gauge"}{" "}
          · nominal resolution ≈9 km.{" "}
          {forecast
            ? `Cell ${number(assessment.forecastDistanceKm, 1)} km from the representative point.`
            : "No cell within 12 km."}
        </small>
        {(phase === "before" ? forecast : modeled) && (
          <a
            href={phase === "before" ? event.forecast.url : event.modelRain.url}
            target="_blank"
            rel="noreferrer"
          >
            View source response <ArrowUpRight size={12} />
          </a>
        )}
      </section>
      <section className="sector-index">
        <h3>
          <Layers size={16} /> Vigilance index
        </h3>
        <div className="index-value">
          <strong>{number(assessment.score)}</strong>
          <span>/ 100</span>
          <small>Limited evidence</small>
        </div>
        <p>
          Explained relative priority. <b>Not a flood probability.</b>
        </p>
        {assessment.factors.map((f) => (
          <div className="factor-row" key={f.key}>
            <div>
              <span>{FACTOR_INFO[f.key]?.label ?? f.label}</span>
              <b>
                {f.value === null
                  ? "No data"
                  : `${number(f.contribution, 1)} points`}
              </b>
            </div>
            <div className="factor-track">
              <i style={{ width: `${f.contribution ?? 0}%` }} />
            </div>
          </div>
        ))}
        <details>
          <summary>Calculation and missing factors</summary>
          <p>
            50% historical footprint area fraction and 50% forecast rainfall
            percentile across sampled cells. Equal weights are an explicit
            convention, not fitted to these incidents. Zero rainfall contributes
            zero rain points. Both factors are required.
          </p>
          {assessment.factors.map((f) => (
            <p key={f.key}>
              {FACTOR_INFO[f.key]?.normalization ?? f.normalization}
            </p>
          ))}
          <p>
            Topography, drainage condition, hydraulics and tides are not
            integrated. Water depth, losses and affected homes are not
            estimated. The vigilance threshold of 60/100 is an interface
            convention, not an official alert.
          </p>
        </details>
      </section>
      <section className="sector-history">
        <h3>
          <History size={16} /> Documented flood-prone land
        </h3>
        <p>
          <strong>
            {number(
              sector.historyOverlap === null
                ? null
                : 100 * sector.historyOverlap,
              1,
            )}{" "}
            %
          </strong>{" "}
          of the area intersects the union of documented flood susceptibility
          footprints.
        </p>
        <small>
          Effective date not published. This does not indicate that this area
          flooded during the storm. Zero intersection does not demonstrate
          absence of danger.
        </small>
      </section>
      <section className="sector-infrastructure">
        <h3>
          <Workflow size={16} /> Documented infrastructure
        </h3>
        <p>
          Municipal queries failed. Presence, capacity, maintenance,
          obstructions and pumping remain unknown.
        </p>
        <details>
          <summary>Status of the four queried layers</summary>
          {data.manifest.infrastructure.map((l) => (
            <p key={l.id}>
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.id} · {infrastructureName(l.id)}
              </a>
              <br />
              No geometry available · HTTP {l.httpStatus}. Update date not
              verified.
            </p>
          ))}
        </details>
      </section>
      {phase !== "before" && (
        <section className="sector-incidents">
          <h3>What was documented here</h3>
          {located.length ? (
            located.map((i) => (
              <article key={i.id}>
                <strong>{TYPE_LABELS[i.type] ?? "Added observation"}</strong>
                <p>{i.locationText ?? i.description}</p>
                <small>
                  {i.geocoding
                    ? "Provisional assignment from a geocoded intersection. It does not represent the entire polygon."
                    : "Location and scope declared by the operator."}
                </small>
                <a href={i.source} target="_blank" rel="noreferrer">
                  Original evidence <ArrowUpRight size={12} />
                </a>
              </article>
            ))
          ) : (
            <p>
              This collection has no localized records in this sector. Its
              situation during the storm remains unconfirmed.
            </p>
          )}
        </section>
      )}
      <section className="sector-shadow">
        <h3>
          <Info size={16} /> Shadow Detection
        </h3>
        <p>
          {phase === "before"
            ? "The index helps prioritize vigilance. Subsequent records do not enter this calculation."
            : state === "verified_negative"
              ? "The operator accepted a negative sector-wide verification. Absence of reports alone is not used as a negative result."
              : state === "verified_positive"
                ? "Accepted sector-wide evidence changes the status and removes this sector from the verification queue."
                : located.length
                  ? "Point evidence exists; its extent, duration and sector-wide representativeness remain limited."
                  : assessment.score >= 60
                    ? "The context warrants checking this sector, but the collection does not establish what happened. Collect further evidence; flooding is not confirmed."
                    : "The information does not establish whether an impact occurred. A low index does not demonstrate safety."}
        </p>
        <button className="text-action" onClick={onLaboratory}>
          Explore the underreporting model in the laboratory{" "}
          <ArrowUpRight size={13} />
        </button>
      </section>
      {phase === "after" && (
        <section className="sector-temporal">
          <h3>Before and after, the same sector</h3>
          <div>
            <span>
              Expected rain for this storm
              <strong>{number(assessment.forecastMm, 1)} mm</strong>
            </span>
            <span>
              Subsequent rainfall estimate
              <strong>{number(assessment.modelMm, 1)} mm</strong>
            </span>
          </div>
          <p>
            Reconstructed index: {number(assessment.score)}/100. Subsequent
            status: {STATE_LABELS[state]}.{" "}
            {snapshot.kind === "prospective"
              ? "The capture is preserved for subsequent evaluation; independent observations are still required."
              : "This is not counted as a prior FLOODSHADOW prediction."}
          </p>
        </section>
      )}
      {phase !== "before" && (
        <VerificationForm
          key={sector.id + event.id}
          sector={sector}
          event={event}
          records={records}
          data={data}
          onRecords={onRecords}
        />
      )}
      <details className="passport-provenance">
        <summary>Full evidence provenance</summary>
        <p>
          Geometry: INEC 2022. ID {sector.id}; object {sector.officialObjectId}.
          Analytical geometry is distinct from simplified map rendering.
        </p>
        <p>
          Index: {assessment.method ?? snapshot.modelVersion}. Created{" "}
          {localDate(snapshot.issuedAt)}. Model initialized{" "}
          {localDate(event.forecast.initializedAt)}; exact publication time
          unavailable.
        </p>
        <p>
          Snapshot: {snapshot.id}. SHA-256: <code>{snapshot.sha256}</code>.
        </p>
        <p>
          The incident collection is partial. There is no calibrated local
          reporting rate. Probabilistic weather uncertainty is unavailable; no
          confidence interval is invented.
        </p>
        <button onClick={onSources}>Open source register</button>
      </details>
    </aside>
  );
}
