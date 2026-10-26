import { nearestWeather } from "./analysis.js";
export const WEATHER_MAX_AGE = 45 * 60000,
  STATION_MAX_AGE = 90 * 60000;
const nonnegative = (v) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
export function sourceFresh(time, now, maxAge) {
  const at = Date.parse(time);
  return Number.isFinite(at) && at <= now + 5 * 60000 && now - at <= maxAge;
}
export function normalizeWeather(raw, retrievedAt) {
  if (!Array.isArray(raw) || !raw.length)
    throw Error("Weather response has no cells");
  const cells = raw.map((c, i) => {
    if (
      !Number.isFinite(c.latitude) ||
      !Number.isFinite(c.longitude) ||
      !Number.isFinite(c.current?.time) ||
      !Number.isFinite(c.current?.interval) ||
      c.current.interval <= 0 ||
      c.current_units?.precipitation !== "mm" ||
      c.hourly_units?.precipitation !== "mm"
    )
      throw Error("Weather units, time or location are invalid");
    const time = new Date(c.current.time * 1000).toISOString(),
      interval = c.current.interval;
    const currentMm = nonnegative(c.current.precipitation),
      seen = new Set();
    const series = (c.hourly?.time ?? []).map((t, j) => {
      if (!Number.isFinite(t) || seen.has(t))
        throw Error("Invalid or duplicate hourly timestamp");
      seen.add(t);
      return {
        time: new Date(t * 1000).toISOString(),
        mm: nonnegative(c.hourly?.precipitation?.[j]),
      };
    });
    return {
      id: "live-" + i,
      coordinates: [c.longitude, c.latitude],
      time,
      interval,
      currentMm,
      rateMmH: currentMm === null ? null : (currentMm * 3600) / interval,
      weatherCode: c.current.weather_code,
      series,
    };
  });
  // Requested locations can resolve to the same actual weather cell.
  return {
    retrievedAt,
    kind: "weather_model",
    model: "ECMWF IFS",
    resolutionKm: 9,
    cells: [
      ...new Map(cells.map((c) => [c.coordinates.join(","), c])).values(),
    ],
  };
}
export function normalizeStation(raw, retrievedAt) {
  const r = Array.isArray(raw) ? raw.find((r) => r.icaoId === "SEGU") : null;
  if (
    !r ||
    !Number.isFinite(r.obsTime) ||
    !Number.isFinite(r.lon) ||
    !Number.isFinite(r.lat) ||
    typeof r.rawOb !== "string"
  )
    throw Error("No valid SEGU observation");
  return {
    id: "SEGU",
    name: "Guayaquil airport",
    coordinates: [r.lon, r.lat],
    observedAt: new Date(r.obsTime * 1000).toISOString(),
    retrievedAt,
    weather: r.wxString ?? "",
    raw: r.rawOb,
    kind: "station_observation",
  };
}
export function stationCondition(station, now = Date.now()) {
  if (!station)
    return { fresh: false, rain: null, label: "Airport report unavailable" };
  if (!sourceFresh(station.observedAt, now, STATION_MAX_AGE))
    return { fresh: false, rain: null, label: "Airport report is out of date" };
  const tokens = station.weather.split(/\s+/),
    atStation = tokens.some((t) => t.includes("RA") && !t.startsWith("VC")),
    nearby = tokens.some((t) => t.startsWith("VC") && t.includes("RA"));
  return {
    fresh: true,
    rain: atStation,
    label: atStation
      ? tokens.some((t) => t.startsWith("+") && t.includes("RA"))
        ? "Heavy rain reported at the airport"
        : "Rain reported at the airport"
      : nearby
        ? "Rain reported near the airport"
        : "No rain reported in this airport observation",
  };
}
export function liveRows(sectors, payload, now = Date.now()) {
  return sectors.map((sector) => {
    const { cell, distanceKm } = nearestWeather(
      sector.center,
      payload?.weather?.cells ?? [],
    );
    const fresh = !!cell && sourceFresh(cell.time, now, WEATHER_MAX_AGE);
    const rate = fresh ? cell.rateMmH : null;
    return {
      sector,
      assessment: { score: null, modelMm: rate, forecastMm: null },
      state: "insufficient",
      weatherCell: { ...cell, series: [{ mm: rate }] },
      liveCell: cell,
      distanceKm,
      fresh,
    };
  });
}
export function archivedForecastAt(events, station) {
  if (!station) return null;
  const time = Date.parse(station.observedAt),
    end = Math.ceil(time / 3600000) * 3600000;
  const ordered = events
    .filter(
      (e) =>
        e.status === "captured_forecast" &&
        Date.parse(e.forecast.retrievedAt) < time,
    )
    .sort(
      (a, b) =>
        Date.parse(b.forecast.retrievedAt) - Date.parse(a.forecast.retrievedAt),
    );
  for (const e of ordered) {
    const { cell } = nearestWeather(station.coordinates, e.forecast.grid);
    const hour = cell?.series.find(
      (h) => Date.parse(h.time + "-05:00") === end,
    );
    if (hour && nonnegative(hour.mm) !== null)
      return {
        eventId: e.id,
        capturedAt: e.forecast.retrievedAt,
        hourEnding: new Date(end).toISOString(),
        mm: hour.mm,
        coordinates: cell.coordinates,
      };
  }
  return null;
}
