// Capture a genuinely prospective assessment; each capture is immutable and preserved.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  hourlySummary,
  nearestWeather,
  vigilanceIndex,
  CITY_MODEL_VERSION,
} from "../src/city/analysis.js";
const root = new URL("../public/data/city/", import.meta.url),
  vault = new URL("../data-cache/city/forecast-vault/", import.meta.url);
await mkdir(vault, { recursive: true });
const url =
  "https://api.open-meteo.com/v1/forecast?" +
  new URLSearchParams({
    latitude: "-2.1,-2.1,-2.2,-2.2,-2.3,-2.3",
    longitude: "-79.9,-80,-79.9,-80,-79.9,-80",
    hourly: "precipitation",
    models: "ecmwf_ifs",
    forecast_hours: "73",
    timezone: "America/Guayaquil",
  });
const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
if (!r.ok) throw Error("Forecast HTTP " + r.status);
const raw = await r.json();
if (!Array.isArray(raw) || raw.some((c) => !c.hourly))
  throw Error("Invalid forecast response");
const capturedAt = new Date().toISOString();
const now = Date.now(),
  available = raw[0].hourly.time.filter((t) => Date.parse(t + "-05:00") > now);
if (available.length < 72)
  throw Error(
    "The source does not provide 72 future hours from the capture time",
  );
const start = available[0],
  end = new Date(Date.parse(start + "-05:00") + 72 * 3600000 - 5 * 3600000)
    .toISOString()
    .slice(0, 16),
  id = "forecast-" + capturedAt.replace(/[:.]/g, "-");
const unique = [
  ...new Map(raw.map((c) => [[c.longitude, c.latitude].join(","), c])).values(),
];
const grid = unique.map((c, i) => ({
  id: `operational-${id}-${i}`,
  coordinates: [c.longitude, c.latitude],
  kind: "operational_forecast",
  model: "ECMWF IFS HRES",
  nominalResolutionKm: 9,
  url,
  ...hourlySummary(c.hourly, start, end),
}));
if (grid.some((c) => !c.complete))
  throw Error("Forecast has incomplete future windows");
const sectors = JSON.parse(
    await readFile(new URL("sectors.json", root), "utf8"),
  ),
  rainPopulation = grid.map((c) => c.totalMm),
  assessments = {};
for (const s of sectors) {
  const f = nearestWeather(s.center, grid),
    index = vigilanceIndex({
      historyOverlap: s.historyOverlap,
      rainMm: f.cell?.totalMm ?? null,
      rainPopulation,
    });
  assessments[s.id] = {
    score: index.score,
    coverage: index.coverage,
    probability: false,
    factors: index.factors.map(({ key, value, weight, contribution }) => ({
      key,
      value,
      weight,
      contribution,
    })),
    forecastMm: f.cell?.totalMm ?? null,
    forecastCellId: f.cell?.id ?? null,
    forecastDistanceKm: f.cell ? f.distanceKm : null,
    modelMm: null,
    modelCellId: null,
  };
}
const event = {
  id,
  name: "Pronóstico capturado · próximas 72 horas",
  shortDate: start.slice(0, 10),
  start: start + ":00-05:00",
  end: end + ":00-05:00",
  windowStart: start,
  windowEnd: end,
  status: "captured_forecast",
  source: url,
  scope: "Guayaquil",
  note: "Pronóstico guardado en la fecha indicada. No representa observaciones. Se conserva el original para evaluación posterior.",
  forecast: {
    kind: "operational_forecast",
    initializedAt: null,
    issuedAt: null,
    retrievedAt: capturedAt,
    url,
    model: "ECMWF IFS HRES",
    resolutionKm: 9,
    uncertainty: null,
    grid,
  },
  modelRain: {
    retrievedAt: null,
    url: null,
    kind: "unavailable",
    model: null,
    resolutionKm: null,
    grid: [],
  },
  observations: [],
  reportedWaterLocations: null,
};
const payload = {
  id: "prospective-" + id,
  eventId: id,
  kind: "prospective",
  issuedAt: capturedAt,
  inputForecastInitializedAt: null,
  forecastAvailabilityNote:
    "Hora de recepción archivada; inicialización y emisión del proveedor no informadas en esta respuesta.",
  modelVersion: CITY_MODEL_VERSION,
  assessments,
  limitation:
    "Índice no calibrado. Antecedente documental sin fecha de vigencia. Solo puede evaluarse con verificaciones posteriores independientes y representativas.",
};
const snapshot = {
  ...payload,
  sha256: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
};
const result = {
  event,
  snapshot,
  geographyIdsHash: createHash("sha256")
    .update(sectors.map((s) => s.id).join("|"))
    .digest("hex"),
  raw,
};
await writeFile(new URL(id + ".json", vault), JSON.stringify(result), {
  flag: "wx",
});
console.log(JSON.stringify({ id, capturedAt, start, end, cells: grid.length }));
