import React, { useEffect, useRef } from "react";
import EventWalkthrough from "./EventWalkthrough.jsx";
import { X, ExternalLink } from "lucide-react";
import {
  number,
  localDate,
  TYPE_LABELS,
  infrastructureName,
  sourceNote,
} from "./format.js";
export default function CityDialog({
  kind,
  data,
  event,
  onClose,
  onPhase,
  onLab,
  onScenario,
}) {
  const dialog = useRef();
  useEffect(() => {
    const old = document.activeElement;
    dialog.current?.querySelector("button")?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const list = [
          ...dialog.current.querySelectorAll("button,a,input,select"),
        ].filter((e) => !e.disabled);
        const first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      old?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="rain-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        className="rain-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="city-dialog-title"
      >
        <header>
          <h2 id="city-dialog-title">
            {kind === "sources"
              ? "Sources and evidence limitations"
              : kind === "incidents"
                ? "Documented storm records"
                : "Explore a Rainfall Event"}
          </h2>
          <button aria-label="Close dialog" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        {kind === "sources" ? (
          <div className="source-catalog">
            <p>
              Snapshot processed {localDate(data.manifest.generatedAt)}. Links
              allow provenance review. Consulting a source does not imply its
              data are integrated.
            </p>
            <article>
              <h3>Official geography · INEC 2022</h3>
              <p>
                {number(data.manifest.sectorCount)} canton sectors;{" "}
                {number(data.manifest.urbanSectorCount)} with main parish code
                090150 y {number(data.manifest.ruralSectorCount)} rural sectors.
                The main parish includes peripheral areas according to the
                service; it does not redefine the legal urban boundary.
              </p>
              <a
                href={data.manifest.census.source}
                target="_blank"
                rel="noreferrer"
              >
                INEC service <ExternalLink size={12} />
              </a>
              <p>
                Zero duplicate IDs or invalid sectors in the download. Map zones
                aggregate census prefixes. Territorial calculations use
                analytical geometries.
              </p>
              <p>
                Detected {data.manifest.geometryAudit.sourceOverlapCount}{" "}
                overlaps greater than 1 m² in the originals. A technical
                boundary partition removes analytical overlaps; it does not
                change legal boundaries.{" "}
                {data.manifest.geometryAudit.significantBoundaryCount} sectors
                with area changes above 1% have no territorial index due to
                uncertainty. Historical footprints required seven recorded
                topology repairs.
              </p>
              <a href="/data/city/geometry-audit.json" download>
                Download full geometry audit
              </a>
            </article>
            <article>
              <h3>Documented susceptibility footprints</h3>
              <p>
                {number(data.manifest.historical.count)} polygons, unioned
                within each sector to avoid double counting. Effective date and
                detailed reuse conditions are not published in the snapshot.
              </p>
              <a
                href={data.manifest.historical.url}
                target="_blank"
                rel="noreferrer"
              >
                Flood susceptibility service <ExternalLink size={12} />
              </a>
            </article>
            {data.territories && (
              <article>
                <h3>Recognizable named areas · municipal nomenclature</h3>
                <p>
                  {data.territories.municipalSourceCount} source areas. Every
                  Guayaquil census polygon is assigned to one whole-polygon
                  group by majority surface, with parish/peripheral fallback.
                  Group boundaries are analytical. Samborondón has separate INEC
                  context boundaries and no transferred storm estimates.
                </p>
                <a
                  href={data.territories.sourcePage}
                  target="_blank"
                  rel="noreferrer"
                >
                  Official municipal download page
                </a>
                <p>
                  Source SHA-256: <code>{data.territories.sourceSha256}</code>
                </p>
              </article>
            )}
            <article>
              <h3>
                {event.status === "captured_forecast"
                  ? "Saved forecast"
                  : "Expected rain for this storm"}{" "}
                · Open-Meteo / ECMWF
              </h3>
              <p>
                Initialization {localDate(event.forecast.initializedAt)}. ECMWF
                IFS HRES, nominal resolution 9 km, {event.forecast.grid.length}{" "}
                unique sampled cells. Exact publication time and probabilistic
                uncertainty unavailable. Retrieved{" "}
                {localDate(event.forecast.retrievedAt)}.
              </p>
              <a href={event.forecast.url} target="_blank" rel="noreferrer">
                Weather model source <ExternalLink size={12} />
              </a>
              <p>
                {event.status === "captured_forecast"
                  ? "Receipt and index are preserved before the forecast window. The response does not provide exact provider initialization or issue time."
                  : "Initialization is not issue time. A run initialized before the storm is used without an archived publication time; this does not claim FLOODSHADOW issued an assessment on that date."}
              </p>
            </article>
            <article>
              <h3>Estimated rainfall · ECMWF</h3>
              <p>
                Hourly model series obtained through the Historical Weather API.
                This is neither a rain gauge network nor a satellite product.
                The nearest cell within 12 km is assigned; sector detail does
                not increase the original resolution.
              </p>
              {!event.modelRain.grid.length && (
                <p>
                  No subsequent records exist for this window. They are not
                  replaced with forecast values.
                </p>
              )}
              {event.modelRain.url && (
                <a href={event.modelRain.url} target="_blank" rel="noreferrer">
                  Weather source response <ExternalLink size={12} />
                </a>
              )}
            </article>
            <article>
              <h3>Station totals · ESPOL / INAMHI</h3>
              <p>
                Five published totals for October 19: instrument coordinates and
                exact windows are unknown. Published measurements are preserved
                without interpolation or invented hourly series. The city
                average cited in the article is not reproduced as the mean of
                these five stations.
              </p>
              <a href={data.events[0].source} target="_blank" rel="noreferrer">
                ESPOL institutional publication <ExternalLink size={12} />
              </a>
            </article>
            <article>
              <h3>October 24–25 incidents</h3>
              <p>
                68 water accumulation locations and ten additional incidents,
                including three reported floods in Tenguel, extracted from
                Ecuavisa's list attributed to Segura EP. No direct Segura EP
                database was downloaded.
              </p>
              <a href={data.events[1].source} target="_blank" rel="noreferrer">
                Published list <ExternalLink size={12} />
              </a>
              <p>
                {data.manifest.impacts.coordinateCandidates} high-match geocoder
                intersections, still without field review.{" "}
                {data.manifest.impacts.pendingGeocoding} records with location
                pending. The incident is not attributed to the entire sector
                area. Only {data.manifest.impacts.sectorCandidates}{" "}
                intersections have alternatives compatible with one original
                sector; the others receive no sector assignment.
              </p>
            </article>
            {data.manifest.infrastructure.map((l) => (
              <article key={l.id}>
                <h3>
                  {l.id} · {infrastructureName(l.id)}
                </h3>
                <p>
                  Query HTTP {l.httpStatus}; geometry not downloaded. Identified
                  attributes: {l.fields.join(", ") || "not verifiable"}. Minimum
                  display scale: {l.minScale ?? "unknown"}; this is not
                  resolution or accuracy. Date unknown.
                </p>
                <a href={l.url} target="_blank" rel="noreferrer">
                  Municipal catalog <ExternalLink size={12} />
                </a>
              </article>
            ))}
            {data.manifest.otherSources.map((s) => (
              <article key={s.name}>
                <h3>{s.name} · researched, not integrated</h3>
                <p>{sourceNote(s)}</p>
                <a href={s.url} target="_blank" rel="noreferrer">
                  View source <ExternalLink size={12} />
                </a>
              </article>
            ))}
            <a href="/data/city/manifest.json" download>
              Download data manifest
            </a>
          </div>
        ) : kind === "incidents" ? (
          <div className="incident-register">
            <p>
              Records without coordinates remain pending. Geocoded intersections
              are candidate locations, not flood boundaries.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Published location</th>
                  <th>Type</th>
                  <th>GIS location</th>
                </tr>
              </thead>
              <tbody>
                {data.impacts
                  .filter((i) => i.eventId === event.id)
                  .map((i) => (
                    <tr key={i.id}>
                      <td>
                        <a href={i.source} target="_blank" rel="noreferrer">
                          {i.locationText}
                        </a>
                      </td>
                      <td>{TYPE_LABELS[i.type]}</td>
                      <td>
                        {i.coordinates
                          ? i.sectorId
                            ? "Candidate intersection, provisional sector"
                            : "Candidate intersection, ambiguous sector"
                          : "Pending review"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!data.impacts.some((i) => i.eventId === event.id) && (
              <p>
                No individual incidents were added for this storm. This does not
                indicate an absence of impacts.
              </p>
            )}
          </div>
        ) : (
          <EventWalkthrough
            onPhase={onPhase}
            onScenario={onScenario}
            onClose={onClose}
          />
        )}
      </section>
    </div>
  );
}
