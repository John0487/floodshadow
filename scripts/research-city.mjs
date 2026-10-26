import { mkdir, writeFile } from "node:fs/promises";
const out = new URL("../data-cache/city/research/", import.meta.url);
await mkdir(out, { recursive: true });
const census =
  "https://idgn.ecuadorencifras.gob.ec/server/rest/services/Hosted/Marco_Geoestadistico_2022/FeatureServer/7";
const muni =
  "https://geoportalcat.guayaquil.gob.ec/arcgis/rest/services/Geoportal_Actualizado/GEOPORTAL_ACTUALIZADO/MapServer";
const jobs = [
  [
    "urban-count",
    `${census}/query?` +
      new URLSearchParams({
        f: "json",
        where: "sec LIKE '090150%'",
        returnCountOnly: "true",
      }),
  ],
  [
    "canton-count",
    `${census}/query?` +
      new URLSearchParams({
        f: "json",
        where: "sec LIKE '0901%'",
        returnCountOnly: "true",
      }),
  ],
  ...[8, 46, 48, 55].map((id) => ["municipal-" + id, `${muni}/${id}?f=pjson`]),
  ...["2026-10-18", "2026-10-23"].map((date) => [
    "forecast-" + date,
    "https://single-runs-api.open-meteo.com/v1/forecast?" +
      new URLSearchParams({
        latitude: "-2.1,-2.1,-2.2,-2.2,-2.3,-2.3",
        longitude: "-79.9,-80,-79.9,-80,-79.9,-80",
        hourly: "precipitation",
        models: "ecmwf_ifs",
        run: date + "T00:00",
        forecast_days: "4",
        timezone: "America/Guayaquil",
      }),
  ]),
  ["ecuameteo", "https://www.inamhi.gob.ec/"],
];
await Promise.all(
  jobs.map(async ([id, url]) => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(40000) });
      const t = await r.text();
      let data;
      try {
        data = JSON.parse(t);
      } catch {
        data = { nonJson: true, status: r.status, sample: t.slice(0, 400) };
      }
      await writeFile(
        new URL(id + ".json", out),
        JSON.stringify(
          { retrieved: new Date().toISOString(), url, status: r.status, data },
          null,
          2,
        ),
      );
      console.log(id, JSON.stringify(data).slice(0, 1100));
    } catch (e) {
      console.log(id, e.message);
      await writeFile(
        new URL(id + ".json", out),
        JSON.stringify({
          url,
          error: e.message,
          retrieved: new Date().toISOString(),
        }),
      );
    }
  }),
);
