import {
  vigilanceIndex,
  evidenceState,
  latestVerifications,
} from "./analysis.js";
export const ORIGINAL_INTENSITY = [
  "case",
  ["<=", ["get", "value"], 2.5],
  "#b9d8bc",
  ["<=", ["get", "value"], 7.6],
  "#f3de8a",
  "#eda56b",
];
export const LIVE_RAIN_COLORS = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "value"], 0],
  0,
  "#ffffff",
  0.1,
  "#eaf7fe",
  0.5,
  "#b8dff2",
  1,
  "#6aadd8",
  2.5,
  "#2878b7",
  7.6,
  "#104e91",
  15,
  "#082f64",
];
export const LIVE_RAIN_OPACITY = ["case", ["==", ["get", "value"], 0], 0, 0.78];
export function selectForecastHour(rows, time, allowHistorical = false) {
  return !time
    ? rows
    : rows.map((r) => {
        const h = r.liveCell?.series?.find((h) => h.time === time);
        return {
          ...r,
          assessment: {
            ...r.assessment,
            forecastMm:
              (r.fresh || allowHistorical) &&
              typeof h?.mm === "number" &&
              Number.isFinite(h.mm) &&
              h.mm >= 0
                ? h.mm
                : null,
          },
        };
      });
}
export function attentionRows(rows, forecast = false) {
  const cells = [
    ...new Map(
      rows.filter((r) => r.liveCell).map((r) => [r.liveCell.id, r]),
    ).values(),
  ];
  const population = cells
    .map((r) => (forecast ? r.assessment.forecastMm : r.assessment.modelMm))
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  return rows.map((r) => ({
    ...r,
    assessment: {
      ...r.assessment,
      ...vigilanceIndex({
        historyOverlap: r.sector.historyOverlap,
        rainMm: forecast ? r.assessment.forecastMm : r.assessment.modelMm,
        rainPopulation: population,
      }),
    },
  }));
}
export function archivedRows(data, event, sectors, stage, records = []) {
  const snapshot = data.snapshots.find((s) => s.eventId === event.id),
    checks = latestVerifications(records, event.id);
  return sectors.map((sector) => {
    const assessment = snapshot.assessments[sector.id],
      grid = stage === "forecast" ? event.forecast.grid : event.modelRain.grid;
    const weather = grid.find(
      (c) =>
        c.id ===
        (stage === "forecast"
          ? assessment.forecastCellId
          : assessment.modelCellId),
    );
    const local = data.impacts.filter(
      (i) => i.eventId === event.id && i.sectorId === sector.id,
    );
    const values =
        weather?.series
          ?.map((h) => h.mm)
          .filter((v) => typeof v === "number" && Number.isFinite(v)) ?? [],
      peak = values.length ? Math.max(...values) : null;
    return {
      sector,
      assessment: {
        ...assessment,
        modelMm: stage === "now" ? peak : assessment.modelMm,
      },
      liveCell: weather,
      weatherCell: weather ? { ...weather, series: [{ mm: peak }] } : null,
      fresh: false,
      state: evidenceState(assessment, local, checks.get(sector.id)),
      impacts: local,
    };
  });
}
export function reportMatchesArea(report, id) {
  return report.areaId === id || report.areaIds?.includes(id);
}
export function systemWarnings(rows, areas) {
  const assessed = attentionRows(rows),
    byArea = new Map();
  for (const r of assessed) {
    if (!(
      r.fresh &&
      r.assessment.modelMm > 0 &&
      r.assessment.score >= 60 &&
      r.sector.historyOverlap > 0
    ))
      continue;
    const id = r.sector.areaId;
    if (!byArea.has(id)) byArea.set(id, []);
    byArea.get(id).push(r);
  }
  return [...byArea]
    .map(([id, list]) => {
      const a = areas.find((a) => a.id === id);
      return {
        id: "system-watch-" + id,
        areaId: id,
        areaName: a?.name ?? list[0].sector.areaName,
        sectorIds: list.map((r) => r.sector.id),
        origin: "system",
        type: "possible_impact",
        coordinates: null,
        publishedAt: list[0].liveCell?.time,
        reason:
          "Stronger estimated rainfall overlaps past flood exposure in parts of this area.",
        status: "Possible impact — needs verification",
        infrastructure: "Drainage condition unknown",
        score: Math.max(...list.map((r) => r.assessment.score)),
      };
    })
    .sort((a, b) => b.score - a.score);
}
export function explainRain(mm, hours = 1) {
  if (typeof mm !== "number" || !Number.isFinite(mm))
    return "Rain amount unavailable";
  if (mm === 0) return "No rain estimated for this period";
  return `${mm > 7.6 * hours ? "Heavy" : mm > 2.5 * hours ? "Moderate" : "Light"} rain estimated${hours > 1 ? ` across ${hours} hours` : ""}`;
}
