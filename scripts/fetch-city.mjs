import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as turf from "@turf/turf";
const out = new URL("../data-cache/city/", import.meta.url);
await mkdir(out, { recursive: true });
const base =
  "https://idgn.ecuadorencifras.gob.ec/server/rest/services/Hosted/Marco_Geoestadistico_2022/FeatureServer/7";
async function cached(name, url) {
  const file = new URL(name + ".json", out);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {}
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw Error(`${r.status} ${url}`);
  const data = await r.json();
  if (data.error) throw Error(JSON.stringify(data.error));
  const result = { url, retrieved: new Date().toISOString(), data };
  await writeFile(file, JSON.stringify(result));
  return result;
}
let census = [];
const queries = [];
for (let offset = 0; offset < 7000; offset += 1000) {
  const params = new URLSearchParams({
    where: "sec LIKE '0901%'",
    f: "geojson",
    outFields: "objectid,sec",
    outSR: "4326",
    returnGeometry: "true",
    resultOffset: String(offset),
    resultRecordCount: "1000",
    orderByFields: "objectid",
    geometryPrecision: "6",
  });
  const r = await cached("census-page-" + offset, base + "/query?" + params);
  queries.push({ url: r.url, retrieved: r.retrieved });
  census.push(...r.data.features);
  console.log("census", census.length);
  if (r.data.features.length < 1000 && !r.data.exceededTransferLimit) break;
}
const censusCount = await cached(
  "census-count",
  base +
    "/query?" +
    new URLSearchParams({
      f: "json",
      where: "sec LIKE '0901%'",
      returnCountOnly: "true",
    }),
);
if (census.length !== censusCount.data.count) {
  throw Error(
    `Incomplete INEC download: ${census.length}/${censusCount.data.count}. Existing prepared geometry was not replaced.`,
  );
}
const seen = new Set();
const duplicates = [];
const invalid = [];
census = census.filter((f) => {
  const code = f.properties.sec;
  if (seen.has(code)) {
    duplicates.push(code);
    return false;
  }
  seen.add(code);
  if (!turf.booleanValid(f)) {
    invalid.push(code);
    return false;
  }
  return true;
});
const groups = {};
for (const f of census) {
  const k = f.properties.sec.slice(0, 6);
  groups[k] = (groups[k] ?? 0) + 1;
}
console.log("parish codes", groups);
await writeFile(
  new URL("census-full.geojson", out),
  JSON.stringify(turf.featureCollection(census)),
);
await writeFile(
  new URL("census-manifest.json", out),
  JSON.stringify(
    {
      source: base,
      queries,
      rawCount: seen.size + duplicates.length,
      validCount: census.length,
      duplicates,
      invalid,
      groups,
    },
    null,
    2,
  ),
);
const floodBase =
  "https://services7.arcgis.com/NWWHhu45fOJtCgG3/arcgis/rest/services/Zonas_Inundables_GYE/FeatureServer/0";
let flood = [];
for (let offset = 0; offset < 10000; offset += 1000) {
  const q = new URLSearchParams({
    f: "geojson",
    where: "1=1",
    outFields: "*",
    outSR: "4326",
    returnGeometry: "true",
    resultOffset: String(offset),
    resultRecordCount: "1000",
    orderByFields: "FID",
  });
  try {
    const r = await cached("flood-page-" + offset, floodBase + "/query?" + q);
    flood.push(...r.data.features);
    console.log("flood page", offset, r.data.features.length);
    if (r.data.features.length < 1000 && !r.data.exceededTransferLimit) break;
  } catch (e) {
    throw Error(
      `Historical footprint download incomplete at offset ${offset}: ${e.message}`,
    );
  }
}
const floodCount = await cached(
  "flood-count",
  floodBase +
    "/query?" +
    new URLSearchParams({
      f: "json",
      where: "1=1",
      returnCountOnly: "true",
    }),
);
if (flood.length !== floodCount.data.count) {
  throw Error(
    `Incomplete footprint download: ${flood.length}/${floodCount.data.count}. Existing footprints were not replaced.`,
  );
}
await writeFile(
  new URL("historical-footprints.geojson", out),
  JSON.stringify(turf.featureCollection(flood)),
);
console.log("historical polygons", flood.length);
const muni =
  "https://geoportalcat.guayaquil.gob.ec/arcgis/rest/services/Geoportal_Actualizado/GEOPORTAL_ACTUALIZADO/MapServer";
await Promise.all(
  [8, 46, 48, 55].map(async (id) => {
    const q = new URLSearchParams({
      f: "geojson",
      where: "1=1",
      outFields: "*",
      geometry: "-80.15,-2.36,-79.82,-1.94",
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      returnGeometry: "true",
      resultRecordCount: "1000",
    });
    try {
      const r = await cached(
        "infrastructure-" + id,
        muni + "/" + id + "/query?" + q,
      );
      console.log(
        "infrastructure",
        id,
        r.data.features?.length,
        r.data.exceededTransferLimit,
      );
    } catch (e) {
      console.log("infrastructure", id, e.message.slice(0, 120));
    }
  }),
);
await Promise.all(
  [
    ["a", "2026-10-18", "2026-10-19"],
    ["b", "2026-10-24", "2026-10-25"],
  ].map(async ([id, start, end]) => {
    const q = new URLSearchParams({
      latitude: "-2.1,-2.1,-2.2,-2.2,-2.3,-2.3",
      longitude: "-79.9,-80,-79.9,-80,-79.9,-80",
      hourly: "precipitation",
      models: "ecmwf_ifs",
      start_date: start,
      end_date: end,
      timezone: "America/Guayaquil",
    });
    try {
      const r = await cached(
        "weather-" + id,
        "https://archive-api.open-meteo.com/v1/archive?" + q,
      );
      console.log("weather", id, Array.isArray(r.data) ? r.data.length : 1);
    } catch (e) {
      console.log("weather", id, e.message);
    }
  }),
);
