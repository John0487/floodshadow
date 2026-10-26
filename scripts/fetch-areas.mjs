import { mkdir, writeFile } from "node:fs/promises";
const folder = new URL("../data-cache/areas/", import.meta.url);
await mkdir(folder, { recursive: true });
const base =
  "https://idgn.ecuadorencifras.gob.ec/server/rest/services/Hosted/Marco_Geoestadistico_2022/FeatureServer/7/query";
const sources = [
  [
    "nomenclature.zip",
    "https://sil.guayaquil.gob.ec/wp-content/uploads/SECTORES_DE_NOMENCLATURA-1.zip",
  ],
  [
    "planning.zip",
    "https://sil.guayaquil.gob.ec/wp-content/uploads/SECTORES_DE_PLANIFICACION-1.zip",
  ],
  [
    "aga.zip",
    "https://sil.guayaquil.gob.ec/wp-content/uploads/AREAS_DE_GESTION_ADMINISTRATIVA-1.zip",
  ],
  [
    "samborondon.geojson",
    base +
      "?" +
      new URLSearchParams({
        f: "geojson",
        where: "sec LIKE '0916%'",
        outFields: "objectid,sec",
        outSR: "4326",
        returnGeometry: "true",
        resultRecordCount: "1000",
        orderByFields: "objectid",
      }),
  ],
];
const provenance = [];
for (const [file, url] of sources) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw Error(`${file}: HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length < 100) throw Error("Empty source " + file);
  await writeFile(new URL(file, folder), body);
  provenance.push({
    file,
    url,
    retrievedAt: new Date().toISOString(),
    bytes: body.length,
  });
  console.log(file, body.length);
}
await writeFile(
  new URL("sources.json", folder),
  JSON.stringify(provenance, null, 2),
);
