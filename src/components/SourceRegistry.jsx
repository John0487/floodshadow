import React, { useState } from "react";
import { ExternalLink, RotateCcw, BookOpen, Download } from "lucide-react";
const date = (s) =>
  new Date(s).toLocaleString("en-GB", {
    timeZone: "America/Guayaquil",
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function SourceRegistry({ data, onWeather }) {
  const [refreshing, setRefreshing] = useState(false),
    [weatherNotice, setWeatherNotice] = useState("");
  return (
    <>
      <p className="modal-lead">
        Real geometry and historical evidence are separate from experimental
        incidents. Nothing here confirms a current flood.
      </p>
      <div className="source-card">
        <span className="source-type">Official geometry</span>
        <h3>INEC · Marco Geoestadístico 2022</h3>
        <p>
          {data.sources.pilot}. Display names “Sector 01–36” are aliases; the
          original census code is retained.
        </p>
        <p className="source-small">{data.sources.selection}</p>
        <a href={data.sources.census.url} target="_blank" rel="noreferrer">
          Inspect source
          <ExternalLink size={12} />
        </a>
      </div>
      <div className="source-card">
        <span className="source-type">Historical footprint</span>
        <h3>Municipality · Zonas Inundables_GYE</h3>
        <p>
          Area share is derived by intersecting census polygons with the
          geometric union of municipal footprints, avoiding duplicate area. Zero
          overlap means no overlap in this layer, not absence of flood
          susceptibility.
        </p>
        <p className="source-small">{data.sources.flood.limitation}</p>
        <a href={data.sources.flood.url} target="_blank" rel="noreferrer">
          Inspect source
          <ExternalLink size={12} />
        </a>
      </div>
      <div className="source-card">
        <span className="source-type">Historical event registry</span>
        <h3>Gestión de Riesgos · Events from rainfall</h3>
        <p>
          {data.events?.features.length || 0} registered historical points in
          the Guayaquil region, including neighboring cantons. Point locations
          and sector descriptions may be approximate. Dates belong to the source
          registry; these records do not represent current flooding and do not
          enter the priority model.
        </p>
        <a
          href="https://sgrportal.gestionderiesgos.gob.ec/server/rest/services/Hosted/EVENTOS_X_LLUVIAS/FeatureServer/0"
          target="_blank"
          rel="noreferrer"
        >
          Inspect registry
          <ExternalLink size={12} />
        </a>
        <details className="event-table">
          <summary>Browse dated records</summary>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Canton</th>
                <th>Sector</th>
                <th>Event</th>
              </tr>
            </thead>
            <tbody>
              {data.events?.features.map((f) => (
                <tr key={f.properties.objectid}>
                  <td>{f.properties.fechadelevento}</td>
                  <td>{f.properties.canton}</td>
                  <td>{f.properties.sector}</td>
                  <td>{f.properties.evento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
      <div className="source-card">
        <span className="source-type">Modelled rainfall</span>
        <h3>Open-Meteo · ECMWF IFS</h3>
        <p>
          18–20 October 2026 · regional model grid, approximately 9 km. Source
          explorer displays the 19 October total at a single reference point
          shared by all sectors. Experiment mode uses simulated rainfall.
        </p>
        <p className="source-small">
          {data.weather
            ? `Snapshot retrieved ${date(data.weather.retrieved)}. Grid point: ${data.weather.latitude}, ${data.weather.longitude}.`
            : "No weather snapshot available."}
        </p>
        {weatherNotice && <p>{weatherNotice}</p>}
        <div className="source-actions">
          <a
            href="https://open-meteo.com/en/docs/historical-weather-api"
            target="_blank"
            rel="noreferrer"
          >
            Documentation
            <ExternalLink size={12} />
          </a>
          <button
            className="secondary"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                const r = await fetch(
                  data.weather?.url ||
                    "https://archive-api.open-meteo.com/v1/archive?latitude=-2.136&longitude=-79.938&start_date=2026-10-18&end_date=2026-10-20&hourly=precipitation&models=ecmwf_ifs&timezone=America%2FGuayaquil",
                  { signal: AbortSignal.timeout(20000) },
                );
                if (!r.ok) throw Error(`HTTP ${r.status}`);
                const w = await r.json();
                onWeather({
                  ...w,
                  url: data.weather?.url,
                  retrieved: new Date().toISOString(),
                });
                setWeatherNotice(
                  "Weather refreshed for this session. Export to retain this snapshot.",
                );
              } catch (e) {
                setWeatherNotice(
                  `Refresh unavailable (${e.message}). Keeping the dated local snapshot.`,
                );
              } finally {
                setRefreshing(false);
              }
            }}
          >
            <RotateCcw size={13} />
            {refreshing ? "Refreshing…" : "Refresh weather"}
          </button>
        </div>
      </div>
      <details className="method-details">
        <summary>Read the full ranking method</summary>
        <p>
          The v0.2 context/gap index was the original heuristic, retained only
          as a comparator. The current selection uses a spatial latent-Gaussian
          occurrence model and a separate Poisson reporting process. Posterior
          probabilities and 90% conditional credible intervals are approximated
          by importance sampling under explicit priors. Source explorer computes
          no incident estimates.
        </p>
        <p>
          Positive and negative experimental verifications condition the full
          posterior, updating shared occurrence and reporting fields. Confirmed
          experimental states leave the candidate pool. Neighbor contact uses
          polygon intersection or a 1 m tolerance and does not model hydraulic
          propagation. Expected information is mutual information between a
          prospective exact verification and the latent ensemble.
        </p>
        <p>
          The independent simulator generates spatially correlated Ising
          incidents, spatial reporting heterogeneity, Poisson false reports and
          missing observations. Hidden labels never enter inference. Comparisons
          use five methods, identical candidate pools and paired episode
          bootstrap intervals. Empty denominators are N/A; hidden recall uses
          all actually affected sectors with zero generated reports.
        </p>
        <p>
          This Bayesian model is not calibrated on Guayaquil field observations.
          Priors and the observation likelihood provide identification
          assumptions; reports alone cannot identify occurrence and detection.
          Effective sample size and prior sensitivity must be inspected. No live
          report feed or generative AI service is connected. All manual entries
          remain local demonstration records.
        </p>
      </details>
      <div className="tradeoff">
        <BookOpen size={18} />
        <p>
          Research inspiration:{" "}
          <a
            href="https://doi.org/10.1609/aaai.v38i20.30190"
            target="_blank"
            rel="noreferrer"
          >
            Agostini, Pierson & Garg · AAAI 2024
          </a>
          . This application does not reproduce or validate their model for
          Guayaquil.
        </p>
      </div>
      <div className="source-actions">
        <a className="secondary" href="/data/floodshadow.sqlite" download>
          Download source database (.sqlite)
          <Download size={13} />
        </a>
        <a className="secondary" href="/data/sectors.geojson" download>
          Download census geometry
          <Download size={13} />
        </a>
      </div>
      <p className="source-small">
        Geometry snapshot retrieved {date(data.sources.retrieved)}. Basemap:
        OpenFreeMap, OpenMapTiles and OpenStreetMap contributors. Weather data:
        Open-Meteo, CC BY 4.0. Local records persist only in this browser.
      </p>
    </>
  );
}
