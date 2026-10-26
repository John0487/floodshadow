import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as turf from "@turf/turf";
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {
  hourlySummary,
  nearestWeather,
  vigilanceIndex,
  CITY_MODEL_VERSION,
  resolveSectorCandidates,
} from "../src/city/analysis.js";
const root = process.env.FLOODSHADOW_OUTPUT_DIR?pathToFileURL(resolve(process.env.FLOODSHADOW_OUTPUT_DIR)+'/'):new URL("../public/data/city/", import.meta.url);
await mkdir(root, { recursive: true });
const read = async (n) => JSON.parse(await readFile(new URL(n, root), "utf8"));
const cache = new URL("../data-cache/city/", import.meta.url);
const readCache = async (n) =>
  JSON.parse(await readFile(new URL(n, cache), "utf8"));
const save = async (n, d) => writeFile(new URL(n, root), JSON.stringify(d));
const geometry = await readCache("geometry-geos-cache.json");
const {
  sectors,
  maps: mapFeatures,
  zones,
  impacts: cachedImpacts,
  audit: geometryAudit,
} = geometry;
const byImpactId = new Map(cachedImpacts.map((i) => [i.id, i]));
const impacts = (await read("impacts.json")).map((i) => {
  const cached = byImpactId.get(i.id),
    sameCoordinates =
      JSON.stringify(i.coordinates) === JSON.stringify(cached?.coordinates);
  return {
    ...i,
    sectorId: sameCoordinates ? (cached?.sectorId ?? null) : null,
    geocoding: {
      ...i.geocoding,
      sectorAssignment: sameCoordinates
        ? (cached?.geocoding?.sectorAssignment ?? null)
        : "pending_source_change",
    },
  };
});
const generatedAt = new Date().toISOString();
const originalCensus = (await readCache("census-full.geojson")).features.map(
  (f) => ({ ...f, bbox: turf.bbox(f) }),
);
for (const impact of impacts) {
  if (!impact.coordinates) continue;
  const alternatives = impact.geocoding.candidateCoordinates?.length
    ? impact.geocoding.candidateCoordinates
    : [impact.coordinates];
  const memberships = alternatives.map((c) =>
    originalCensus
      .filter(
        (f) =>
          c[0] >= f.bbox[0] &&
          c[0] <= f.bbox[2] &&
          c[1] >= f.bbox[1] &&
          c[1] <= f.bbox[3] &&
          turf.booleanPointInPolygon(turf.point(c), f),
      )
      .map((f) => f.properties.sec),
  );
  impact.sectorId = resolveSectorCandidates(memberships);
  impact.geocoding.candidateSectorIds = [...new Set(memberships.flat())];
  impact.geocoding.sectorAssignment = impact.sectorId
    ? "consistent_candidate_alternatives"
    : "ambiguous_geocoder_alternatives";
}
const problems = geometryAudit.problems;
const flood = await readCache("historical-footprints.geojson");
const boundaryChanges = new Map(
  geometryAudit.harmonization.changes.map((c) => [c.id, c]),
);
for (const s of sectors) {
  s.boundaryAreaChange = boundaryChanges.get(s.id)?.relativeAreaChange ?? 0;
  s.boundaryQuality =
    s.boundaryAreaChange > 0.01
      ? "significant_harmonization"
      : "harmonized_source";
  if (s.boundaryAreaChange > 0.01) {
    s.historyOverlap = null;
    s.historyQuality = "boundary_uncertainty";
  }
}
geometryAudit.significantBoundaryCount = sectors.filter(
  (s) => s.boundaryAreaChange > 0.01,
).length;
const espol =
  "https://www.fimcm.espol.edu.ec/es/noticias/analisis-meteorologico-y-oceanografico-el-impacto-de-las-inusuales-precipitaciones-de";
const sourceEcuavisa =
  "https://www.ecuavisa.com/amp/guayaquil/68-sectores-afectados-lluvias-guayaquil-tormenta-electrica-20261025-0011.html";
const observations = [
  ["santa-ana", "Cerro Santa Ana", 181],
  ["cisne", "Cisne II", 141],
  ["martha", "Martha de Roldós", 132],
  ["espol", "ESPOL", 117],
  ["airport", "Aeropuerto José Joaquín de Olmedo", 112],
].map(([id, name, mm]) => ({
  id,
  eventId: "oct19",
  name,
  mm,
  unit: "mm",
  kind: "published_station_accumulation",
  source: espol,
  coordinates: null,
  spatialQuality:
    "Ubicación textual de la estación; coordenadas instrumentales no publicadas.",
  period:
    "Acumulado publicado para el 19 de octubre de 2026; ventana instrumental exacta no especificada.",
  start: null,
  end: null,
  quality:
    "Medición atribuida a INAMHI/ESPOL por publicación institucional; no serie instrumental descargada.",
  updatedAt: generatedAt,
}));
const definitions = [
  {
    id: "oct19",
    name: "Lluvias del 19 de octubre",
    shortDate: "19 oct 2026",
    start: "2026-10-18T18:00:00-05:00",
    end: "2026-10-20T00:00:00-05:00",
    windowStart: "2026-10-19T00:00",
    windowEnd: "2026-10-20T00:00",
    run: "2026-10-18",
    weather: "a",
    status: "documented_past",
    source: espol,
    scope: "Guayaquil",
    note: "La ventana meteorológica de 24 horas no se iguala automáticamente a los acumulados publicados de estaciones.",
  },
  {
    id: "oct24",
    name: "Tormentas del 24–25 de octubre",
    shortDate: "24–25 oct 2026",
    start: "2026-10-24T12:00:00-05:00",
    end: "2026-10-25T06:00:00-05:00",
    windowStart: "2026-10-24T12:00",
    windowEnd: "2026-10-25T06:00",
    run: "2026-10-23",
    weather: "b",
    status: "reported_episode",
    source: sourceEcuavisa,
    scope: "Guayaquil",
    note: "Ventana de análisis aproximada según tarde, noche y madrugada publicadas; horas individuales no disponibles.",
  },
];
const events = [],
  snapshots = [];
for (const e of definitions) {
  const forecast = await readCache(`research/forecast-${e.run}.json`),
    weather = await readCache(`weather-${e.weather}.json`);
  const makeGrid = (raw, type, url) => {
    const seen = new Set();
    return (Array.isArray(raw) ? raw : [raw])
      .filter((c) => {
        const k = [c.longitude, c.latitude].join(",");
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((c, i) => ({
        id: `${type}-${e.id}-${i}`,
        coordinates: [c.longitude, c.latitude],
        kind: type,
        model: "ECMWF IFS HRES",
        nominalResolutionKm: 9,
        url,
        ...hourlySummary(c.hourly, e.windowStart, e.windowEnd),
      }));
  };
  const forecastGrid = makeGrid(
      forecast.data,
      "archived_forecast",
      forecast.url,
    ),
    modelGrid = makeGrid(weather.data, "model_estimate", weather.url);
  const rainPopulation = forecastGrid.map((c) => c.totalMm);
  const assessments = {};
  for (const s of sectors) {
    const f = nearestWeather(s.center, forecastGrid),
      m = nearestWeather(s.center, modelGrid);
    const index = vigilanceIndex({
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
      modelMm: m.cell?.totalMm ?? null,
      modelCellId: m.cell?.id ?? null,
    };
  }
  const snapshot = {
    id: `reconstruction-${e.id}-2`,
    eventId: e.id,
    kind: "retrospective_reconstruction",
    issuedAt: generatedAt,
    inputForecastInitializedAt: e.run + "T00:00:00Z",
    forecastAvailabilityNote: `Inicialización ${Math.round((Date.parse(e.start) - Date.parse(e.run + "T00:00:00Z")) / 3600000)} horas antes del comienzo aproximado. No equivale a publicación; disponibilidad efectiva no archivada.`,
    modelVersion: CITY_MODEL_VERSION,
    assessments,
    limitation:
      "Análisis reconstruido hoy con una corrida archivada anterior. FLOODSHADOW no emitió este índice antes del episodio. Historia sin fecha de vigencia suficiente: no apto para afirmar aciertos retrospectivos.",
  };
  const hash = createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
  snapshots.push({ ...snapshot, sha256: hash });
  events.push({
    ...e,
    forecast: {
      initializedAt: e.run + "T00:00:00Z",
      issuedAt: null,
      retrievedAt: forecast.retrieved,
      url: forecast.url,
      model: "ECMWF IFS HRES",
      resolutionKm: 9,
      uncertainty: null,
      grid: forecastGrid,
    },
    modelRain: {
      retrievedAt: weather.retrieved,
      url: weather.url,
      kind: "model_estimate",
      model: "ECMWF IFS",
      resolutionKm: 9,
      grid: modelGrid,
    },
    observations: observations.filter((o) => o.eventId === e.id),
    reportedWaterLocations: e.id === "oct24" ? 68 : null,
  });
}
const geographyIdsHash = createHash("sha256")
  .update(sectors.map((s) => s.id).join("|"))
  .digest("hex");
let vaultFiles = [];
try {
  vaultFiles = (await readdir(new URL("forecast-vault/", cache)))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .slice(-10);
} catch {}
for (const file of vaultFiles) {
  const capture = await readCache("forecast-vault/" + file);
  if (capture.geographyIdsHash !== geographyIdsHash) {
    problems.push({ kind: "incompatibleForecastGeography", file });
    continue;
  }
  events.push(capture.event);
  snapshots.push(capture.snapshot);
}
const infrastructureChecks = Object.fromEntries(
  await Promise.all(
    [8, 46, 48, 55].map(async (id) => [
      id,
      await readCache(`research/municipal-${id}.json`),
    ]),
  ),
);
const manifest = {
  version: "2.0.0",
  analysisMethod: {
    version: CITY_MODEL_VERSION,
    formula:
      "50 × historical_union_fraction + 50 × within-episode rain midrank percentile; zero rain contributes zero",
    weights: { history: 0.5, rain: 0.5 },
    rainNormalization: "(less + 0.5 × equal) / unique queried cells",
    missing:
      "Both factors required; boundary area change >1% excludes historical factor",
    threshold: 60,
    thresholdMeaning: "Exploratory vigilance convention, not an official alert",
    calibratedProbability: false,
    weatherAssignment:
      "Nearest representative sector point to queried grid center within 12 km",
    unknownFactors: [
      "hydraulic capacity",
      "drain maintenance",
      "elevation",
      "tide",
    ],
  },
  prospectiveCaptures: events.filter((e) => e.status === "captured_forecast")
    .length,
  generatedAt,
  census: await readCache("census-manifest.json"),
  sectorCount: sectors.length,
  urbanSectorCount: sectors.filter((s) => s.urban).length,
  ruralSectorCount: sectors.filter((s) => !s.urban).length,
  zoneCount: zones.length,
  geometryAudit: {
    ...geometryAudit,
    sourceOverlapPairsOver1m2: undefined,
    sourceOverlapCount: geometryAudit.sourceOverlapPairsOver1m2.length,
    harmonization: {
      method: geometryAudit.harmonization.method,
      count: geometryAudit.harmonization.changes.length,
      maxRelativeAreaChange: geometryAudit.harmonization.maxRelativeAreaChange,
    },
  },
  geometry:
    "Sectores INEC por código 0901. Cabecera 090150; incluye periferia según el servicio. No equivale a un nuevo límite legal urbano.",
  simplification:
    "Originales INEC conservados en caché. Partición técnica sin solapamientos: prioridad lexicográfica del código oficial en bordes compartidos; no cambia límites legales. Cambios de área >1% excluyen el índice histórico por incertidumbre. Render simplificado preservando topología a 0.000012° y zonas a 0.00004°; los índices usan geometrías analíticas armonizadas.",
  historical: {
    count: flood.features.length,
    validCount: flood.features.length,
    url: "https://services7.arcgis.com/NWWHhu45fOJtCgG3/arcgis/rest/services/Zonas_Inundables_GYE/FeatureServer/0",
    date: null,
    limitation:
      "Huella documental, no observación del episodio. Ausencia de intersección no significa ausencia de peligro. Vigencia y licencia detallada no informadas.",
  },
  infrastructure: [
    {
      id: 48,
      name: "Tuberías aguas lluvias",
      geometryType: "Polyline",
      fields: ["OBJECTID", "TIPO", "Shape.STLength()"],
      minScale: 30000,
    },
    {
      id: 8,
      name: "Escorrentías",
      geometryType: null,
      fields: [],
      minScale: null,
    },
    {
      id: 46,
      name: "Predios en riesgo",
      geometryType: "Polygon",
      fields: ["OBJECTID", "AFECT_GRAL", "Gest_Rie_1", "last_edited_date"],
      minScale: 0,
    },
    {
      id: 55,
      name: "Ríos y esteros",
      geometryType: "Polygon",
      fields: ["OBJECTID_12", "DESCRIPCIO"],
      minScale: 100000,
    },
  ].map((l) => ({
    ...l,
    url: `https://geoportalcat.guayaquil.gob.ec/arcgis/rest/services/Geoportal_Actualizado/GEOPORTAL_ACTUALIZADO/MapServer/${l.id}`,
    status: "unavailable",
    httpStatus: 500,
    checkedAt: infrastructureChecks[l.id]?.retrieved ?? null,
    updatedAt: null,
    limitation:
      "Consulta fallida. Metadatos parciales consultados; sin geometría descargada, fecha ni resolución verificadas. No implica ausencia de infraestructura.",
  })),
  otherSources: [
    {
      name: "INAMHI",
      url: "https://www.inamhi.gob.ec/",
      status: "consulted_not_integrated",
      note: "Portal consultado. Sin serie instrumental o boletín estructurado integrado.",
    },
    {
      name: "NASA GPM IMERG",
      url: "https://gpm.nasa.gov/data/imerg",
      status: "documented_not_integrated",
      note: "Producto satelital distinto de una medición de estación. No se ha descargado un producto para los episodios.",
    },
  ],
  impacts: {
    total: impacts.length,
    waterAccumulation: 68,
    coordinateCandidates: impacts.filter((x) => x.coordinates).length,
    sectorCandidates: impacts.filter((x) => x.sectorId).length,
    pendingGeocoding: impacts.filter((x) => !x.coordinates).length,
    source: sourceEcuavisa,
  },
  problems,
};
await Promise.all([
  save("sectors.json", sectors),
  save("sectors.map.geojson", turf.featureCollection(mapFeatures)),
  save("zones.map.geojson", turf.featureCollection(zones)),
  save("events.json", events),
  save("assessments.json", snapshots),
  save("impacts.json", impacts),
  save("manifest.json", manifest),
  save("geometry-audit.json", geometryAudit),
]);
console.log(
  "Built city",
  JSON.stringify({
    sectors: sectors.length,
    zones: zones.length,
    impacts: manifest.impacts,
    problems: problems.length,
  }),
);
