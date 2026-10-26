export const ATTENTION = [
  { min: 0, label: "Lower attention", color: "#b9d8bc" },
  { min: 30, label: "Preventive watch", color: "#f3de8a" },
  { min: 60, label: "Priority monitoring", color: "#eda56b" },
];
export const UNKNOWN = "#dce1e5";
// Display outlines omit internal gaps; analytical and filled geometry stay intact.
export function outlineGeometry(g) {
  if (g?.type === "Polygon")
    return { ...g, coordinates: g.coordinates.slice(0, 1) };
  if (g?.type === "MultiPolygon")
    return { ...g, coordinates: g.coordinates.map((p) => p.slice(0, 1)) };
  return g;
}
export function mapDetailPolicy(zoom, mode = "areas") {
  const boundaryZoom = mode === "polygons" ? 12 : 14;
  return {
    showValues: true,
    boundaryZoom,
    showBoundaries: zoom >= boundaryZoom,
  };
}
export function attentionCategory(score) {
  return !Number.isFinite(score)
    ? { label: "Not enough information", color: UNKNOWN }
    : ATTENTION[score >= 60 ? 2 : score >= 30 ? 1 : 0];
}
export function attentionCounts(rows) {
  const counts = { lower: 0, watch: 0, priority: 0, unknown: 0 };
  for (const r of rows ?? []) {
    const s = r.assessment.score;
    counts[
      !Number.isFinite(s)
        ? "unknown"
        : s >= 60
          ? "priority"
          : s >= 30
            ? "watch"
            : "lower"
    ]++;
  }
  return counts;
}
export function areaValue(area, rows, layer, hour = null) {
  const members = new Set(area.sectorIds),
    local = rows.filter((r) => members.has(r.sector.id));
  const values = local.map((r) => ({
    weight: r.sector.areaKm2 ?? 1,
    value: rowValue(r, layer, hour),
  }));
  // Unknown member inputs are not silently removed from an area's estimate.
  if (!values.length || values.some((v) => !Number.isFinite(v.value)))
    return null;
  const total = values.reduce((s, v) => s + v.weight, 0);
  return total
    ? values.reduce((s, v) => s + v.value * v.weight, 0) / total
    : null;
}
export function rowValue(r, layer, hour = null) {
  if (layer === "priority") return r.assessment.score;
  if (layer === "history")
    return r.sector.historyOverlap == null
      ? null
      : r.sector.historyOverlap * 100;
  if (["impacts", "verification", "support"].includes(layer)) return null;
  return hour === null
    ? layer === "forecast"
      ? r.assessment.forecastMm
      : r.assessment.modelMm
    : (r.weatherCell?.series?.[hour]?.mm ?? null);
}
export function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180,
    dlat = rad(b[1] - a[1]),
    dlon = rad(b[0] - a[0]);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function nearbyLocations(collection, center, radius = 8) {
  return (collection?.features ?? [])
    .map((f) => ({
      ...f,
      distance: center ? distanceKm(center, f.geometry.coordinates) : null,
    }))
    .filter((f) => !center || f.distance <= radius)
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}
