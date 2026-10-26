import React from "react";
import { number, TYPE_LABELS } from "./format.js";
export default function AreaSummary({
  area,
  rows,
  impacts,
  phase,
  onSelect,
  data,
}) {
  const forecast = phase === "before";
  const values = rows
    .map((r) => (forecast ? r.assessment.forecastMm : r.assessment.modelMm))
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  const known = rows.filter((r) => typeof r.sector.historyOverlap === "number");
  const land = known.reduce((sum, r) => sum + r.sector.areaKm2, 0);
  const footprint = known.reduce(
    (sum, r) => sum + r.sector.areaKm2 * r.sector.historyOverlap,
    0,
  );
  return (
    <aside className="sector-passport area-summary">
      <div className="sector-passport-head">Selected area</div>
      <h2>{area.name}</h2>
      <p>
        {rows.length} whole census polygons grouped under one recognizable name.
      </p>
      <section>
        <h3>
          {forecast
            ? "Rain expected for this storm"
            : "Rain estimated for this storm"}
        </h3>
        <strong>
          {values.length
            ? Math.min(...values) === Math.max(...values)
              ? `${number(values[0], 1)} mm · shared model value`
              : `${number(Math.min(...values), 1)}–${number(Math.max(...values), 1)} mm`
            : "No compatible rainfall cell"}
        </strong>
        <p>
          {values.length} of {rows.length} polygons have model rainfall
          assigned. This is a weather estimate, not a street measurement.
        </p>
      </section>
      <section>
        <h3>Documented flood-prone land in plain language</h3>
        <p>
          {land
            ? `${number(footprint, 2)} km² intersect the documented flood-prone footprint, out of ${number(land, 2)} km² with usable historical geometry.`
            : "Historical geometry is unavailable for this selection."}
        </p>
        <p>
          This describes land susceptibility. The source does not establish when
          each place flooded. It is not a list of confirmed past storms.
        </p>
      </section>
      {phase !== "before" && (
        <section>
          <h3>Published records in this area</h3>
          <p>
            {impacts.length} mapped records in this collection. Unresolved
            locations are excluded; zero records does not mean zero impacts.
          </p>
          {impacts.map((i) => (
            <p key={i.id}>
              {TYPE_LABELS[i.type]} · {i.locationText}
            </p>
          ))}
        </section>
      )}
      <section>
        <h3>Open a smaller polygon</h3>
        {rows.slice(0, 12).map((r) => (
          <button
            className="area-sector-link"
            key={r.sector.id}
            onClick={() => onSelect(r.sector.id)}
          >
            {area.name} · {r.sector.id.slice(-3)}
            <small>INEC {r.sector.id}</small>
          </button>
        ))}
      </section>
      <section>
        <h3>How this group was built</h3>
        <p>
          A polygon belongs to the municipal named area covering more than half
          of its original surface. Otherwise it stays in a parish or peripheral
          group. Whole polygons are preserved; this outline is not a new legal
          boundary.
        </p>
        <a href={data.territories.sourcePage} target="_blank" rel="noreferrer">
          Municipal nomenclature source
        </a>
      </section>
    </aside>
  );
}
