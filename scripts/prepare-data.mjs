import { writeFile, readFile, mkdir, stat } from "node:fs/promises";
import * as turf from "@turf/turf";
import { unionFootprints, enrichSectors } from "../src/data/geography.js";
const out = new URL("../public/data/", import.meta.url);
await mkdir(out, { recursive: true });
const sources = {
  census:
    "https://idgn.ecuadorencifras.gob.ec/server/rest/services/Hosted/Marco_Geoestadistico_2022/FeatureServer/7",
  flood:
    "https://services7.arcgis.com/NWWHhu45fOJtCgG3/arcgis/rest/services/Zonas_Inundables_GYE/FeatureServer/0",
};
const envelope = [-79.955, -2.145, -79.905, -2.105];
async function query(base, fields) {
  const features = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const params = new URLSearchParams({
      f: "geojson",
      where: "1=1",
      outFields: fields,
      geometry: envelope.join(","),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      returnGeometry: "true",
      resultRecordCount: "500",
      resultOffset: String(offset),
      orderByFields: fields.split(",")[0],
    });
    const r = await fetch(`${base}/query?${params}`, {
      signal: AbortSignal.timeout(90000),
    });
    if (!r.ok) throw Error(`${base}: ${r.status}`);
    const j = await r.json();
    if (!j.features) throw Error(JSON.stringify(j).slice(0, 300));
    features.push(...j.features);
    if (!j.exceededTransferLimit) return turf.featureCollection(features);
  }
  throw Error("Too many results");
}
const [census, flood] = await Promise.all([
  query(sources.census, "objectid,sec"),
  query(sources.flood, "FID,Descrip"),
]);
console.log(
  "Fetched",
  census.features.length,
  "census polygons and",
  flood.features.length,
  "flood polygons",
);
const center = turf.point([-79.938, -2.136]);
const candidates = census.features
  .filter((f) => turf.area(f) > 15000 && turf.area(f) < 1800000)
  .sort(
    (a, b) =>
      turf.distance(turf.centroid(a), center) -
      turf.distance(turf.centroid(b), center),
  )
  .slice(0, 36);
const unified = unionFootprints(flood.features);
const sectors = enrichSectors(candidates, unified);
const clip = turf.bboxPolygon(envelope);
const clipped = flood.features
  .map((f) => turf.intersect(turf.featureCollection([f, clip])))
  .filter(Boolean)
  .map((f) => turf.simplify(f, { tolerance: 0.000015, highQuality: true }));
const retrieved = new Date().toISOString();
const metadata = {
  retrieved,
  pilot:
    "Northwest Guayaquil pilot · 36 nearest eligible census sectors to [-79.938, -2.136]",
  selection:
    "Area between 0.015 and 1.8 km², ordered by centroid distance; independent of simulation outcomes.",
  census: {
    url: sources.census,
    title: "INEC · Marco Geoestadístico 2022",
    type: "official geometry",
  },
  flood: {
    url: sources.flood,
    title: "Municipal Zonas Inundables_GYE",
    type: "historical susceptibility footprint",
    limitation:
      "Public query service; reuse terms are not specified in item metadata. Not a current flood observation.",
  },
  method:
    "Historical overlap = intersection with the geometric union of municipal polygons divided by sector area; no double counting. Pilot halves split at median sector-centroid latitude; not administrative units. Neighbor contact uses intersection or a 1 m tolerance. Sector 01…36 are display aliases, not official neighborhood names.",
};
await Promise.all([
  writeFile(new URL("sectors.geojson", out), JSON.stringify(sectors)),
  writeFile(
    new URL("susceptibility.geojson", out),
    JSON.stringify(turf.featureCollection(clipped)),
  ),
  writeFile(new URL("sources.json", out), JSON.stringify(metadata, null, 2)),
  writeFile(new URL("raw-footprints.geojson", out), JSON.stringify(flood)),
]);
console.log(
  "Saved",
  candidates.length,
  "sectors. Area shares:",
  sectors.features.map((f) => f.properties.susceptibility.toFixed(2)).join(","),
);
try {
  const url =
    "https://sgrportal.gestionderiesgos.gob.ec/server/rest/services/Hosted/EVENTOS_X_LLUVIAS/FeatureServer/0/query?" +
    new URLSearchParams({
      f: "geojson",
      where: "1=1",
      geometry: "-80.05,-2.30,-79.84,-2.00",
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "objectid,canton,parroquia,sector,evento,fechadelevento",
      returnGeometry: "true",
      resultRecordCount: "1000",
    });
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!j.features || j.exceededTransferLimit)
    throw Error("Missing or truncated event records");
  await writeFile(new URL("events.geojson", out), JSON.stringify(j));
  console.log("Historical event records saved:", j.features.length);
} catch (e) {
  console.log("Event source unavailable:", e.message);
}
try {
  const url =
    "https://archive-api.open-meteo.com/v1/archive?latitude=-2.125&longitude=-79.927&start_date=2026-10-18&end_date=2026-10-20&hourly=precipitation&models=ecmwf_ifs&timezone=America%2FGuayaquil";
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw Error(`Weather HTTP ${r.status}`);
  const weather = await r.json();
  await writeFile(
    new URL("weather.json", out),
    JSON.stringify({ retrieved: new Date().toISOString(), url, ...weather }),
  );
  console.log("Weather snapshot saved");
} catch (e) {
  console.log("Weather snapshot unavailable:", e.message);
}

// Preserve provenance for the optional event snapshot, including safe field selection.
try {
  const records = JSON.parse(
    await readFile(new URL("events.geojson", out), "utf8"),
  );
  metadata.events = {
    url: "https://sgrportal.gestionderiesgos.gob.ec/server/rest/services/Hosted/EVENTOS_X_LLUVIAS/FeatureServer/0",
    title: "Gestión de Riesgos · historical rainfall events",
    extent: [-80.05, -2.3, -79.84, -2.0],
    recordCount: records.features.length,
    retrieved: (await stat(new URL("events.geojson", out))).mtime.toISOString(),
    fields: [
      "objectid",
      "canton",
      "parroquia",
      "sector",
      "evento",
      "fechadelevento",
    ],
    limitation:
      "Historical registry, not a live incident feed; includes adjacent cantons and approximate locations.",
  };
  await writeFile(
    new URL("sources.json", out),
    JSON.stringify(metadata, null, 2),
  );
} catch {
  /* Event source is optional; the core pilot remains usable. */
}
