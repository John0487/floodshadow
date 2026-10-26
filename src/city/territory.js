export const normalizePlace = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function searchAreas(areas, query) {
  const q = normalizePlace(query);
  return areas
    .filter(
      (a) =>
        !q ||
        [a.name, ...(a.aliases ?? [])].some((n) =>
          normalizePlace(n).includes(q),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function selectAreaSectors(sectors, scope, area) {
  const ids = area ? new Set(area.sectorIds) : null;
  return sectors.filter(
    (s) => (scope === "canton" || s.urban) && (!ids || ids.has(s.id)),
  );
}
export function rainfallScale(rows, hour = null) {
  const values = rows
    .map((r) =>
      hour === null
        ? r.weatherCell?.totalMm
        : r.weatherCell?.series?.[hour]?.mm,
    )
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  const maximum = values.length ? Math.max(...values) : null;
  const step = hour === null ? 10 : 5;
  return {
    maximum,
    upper:
      maximum === null
        ? step
        : Math.max(step, Math.ceil(maximum / step) * step),
  };
}
