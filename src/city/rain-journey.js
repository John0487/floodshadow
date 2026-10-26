import { nearestWeather } from "./analysis.js";
import {
  normalizeStation,
  sourceFresh,
  WEATHER_MAX_AGE,
} from "./live-weather.js";
export const INAMHI_URL =
  "https://inamhi.gob.ec/api_pronos/forecast/daily_forecast/list_by_date_now/";
export const HISTORY_URL =
  "https://aviationweather.gov/api/data/metar?ids=SEGU&format=json&hours=24";
export const BULLETINS_URL =
  "https://www.guayaquil.gob.ec/wp-json/wp/v2/posts?search=lluvias&per_page=8&_fields=id,date_gmt,link,title";
export const CHANCE_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=-2.17&longitude=-79.9&hourly=precipitation_probability&daily=precipitation_probability_max&forecast_days=2&timeformat=unixtime&timezone=America%2FGuayaquil";
export function normalizeChance(raw, retrievedAt) {
  if (
    raw?.hourly_units?.precipitation_probability !== "%" ||
    !Array.isArray(raw.hourly?.time) ||
    !Array.isArray(raw.daily?.time) ||
    raw.hourly.time.some((t) => !Number.isFinite(t)) ||
    raw.daily.time.some((t) => !Number.isFinite(t)) ||
    new Set(raw.hourly.time).size !== raw.hourly.time.length
  )
    throw Error("Invalid rain chance response");
  const probability = (v) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100
      ? v
      : null;
  return {
    source: CHANCE_URL,
    retrievedAt,
    scope: "Guayaquil reference point",
    hours: raw.hourly.time
      .filter((t) => Number.isFinite(t))
      .map((t) => ({
        time: new Date(t * 1000).toISOString(),
        chance: probability(
          raw.hourly.precipitation_probability[raw.hourly.time.indexOf(t)],
        ),
      })),
    days: raw.daily.time
      .filter((t) => Number.isFinite(t))
      .map((t, i) => ({
        date: new Date(t * 1000 - 18000000).toISOString().slice(0, 10),
        maxHourlyChance: probability(
          raw.daily.precipitation_probability_max?.[i],
        ),
      })),
  };
}
const finite = (v) => typeof v === "number" && Number.isFinite(v);
export function intensity(rate) {
  return !finite(rate) || rate < 0
    ? { label: "Not enough information", color: "#dce1e5" }
    : rate === 0
      ? { label: "No rain estimated", color: "#e8f1f3" }
      : rate <= 2.5
        ? { label: "Light rain estimated", color: "#b4d9e6" }
        : rate <= 7.6
          ? { label: "Moderate rain estimated", color: "#479fba" }
          : { label: "Heavy rain estimated", color: "#e7a05e" };
}
export const intensityExpression = [
  "case",
  ["<=", ["get", "value"], 0],
  "#e8f1f3",
  ["<=", ["get", "value"], 2.5],
  "#b4d9e6",
  ["<=", ["get", "value"], 7.6],
  "#479fba",
  "#e7a05e",
];
function englishCondition(text) {
  const s = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return s.includes("tormenta")
    ? "Thunderstorms"
    : s.includes("llovizna")
      ? "Drizzle"
      : s.includes("chubasco")
        ? "Rain showers"
        : s.includes("lluvia")
          ? "Rain"
          : s.includes("parcial")
            ? "Partly cloudy"
            : s.includes("mayormente")
              ? "Mostly cloudy"
              : s.includes("nublado")
                ? "Cloudy"
                : s.includes("nuboso")
                  ? "Some clouds"
                  : "See official forecast";
}
export function normalizeInamhi(raw, retrievedAt) {
  const g = Array.isArray(raw)
    ? raw.find(
        (x) => x.fk_locality_id === 901 && x.locality_name === "Guayaquil",
      )
    : null;
  if (!g || !/^\d{4}-\d{2}-\d{2}$/.test(g.date) || !Array.isArray(g.forecast))
    throw Error("Guayaquil daily forecast unavailable");
  return {
    source: INAMHI_URL,
    date: g.date,
    retrievedAt,
    issuedAt: null,
    periods: g.forecast
      .filter(
        (p) =>
          p.status &&
          Number.isFinite(Date.parse(p.period_start)) &&
          Date.parse(p.period_end) > Date.parse(p.period_start),
      )
      .map((p) => ({
        start: p.period_start,
        end: p.period_end,
        description: englishCondition(p.condition_name),
        original: p.condition_name,
      })),
  };
}
export function normalizeHistory(raw, retrievedAt) {
  if (!Array.isArray(raw)) throw Error("Invalid airport history");
  const unique = new Map();
  for (const r of raw) {
    try {
      const s = normalizeStation([r], retrievedAt);
      unique.set(s.observedAt, s);
    } catch {}
  }
  return {
    source: HISTORY_URL,
    retrievedAt,
    reports: [...unique.values()].sort(
      (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt),
    ),
  };
}
export function normalizeBulletins(raw, retrievedAt) {
  if (!Array.isArray(raw)) throw Error("Invalid municipal bulletin response");
  return {
    source: BULLETINS_URL,
    retrievedAt,
    items: raw
      .filter(
        (p) =>
          p.id &&
          typeof p.link === "string" &&
          /^https:\/\/(www\.)?guayaquil.gob.ec\//.test(p.link) &&
          Number.isFinite(Date.parse(p.date_gmt + "Z")),
      )
      .map((p) => ({
        id: p.id,
        url: p.link,
        publishedAt: p.date_gmt + "Z",
        originalTitle: p.title?.rendered ?? "",
        type: "municipal_bulletin",
        impactVerified: false,
      })),
  };
}
export function forecastRows(rows, now) {
  return rows.map((r) => {
    const hours = r.fresh
      ? (r.liveCell?.series
          .filter((h) => Date.parse(h.time) > now)
          .slice(0, 6) ?? [])
      : [];
    const total =
      hours.length === 6 && hours.every((h) => finite(h.mm))
        ? hours.reduce((s, h) => s + h.mm, 0)
        : null;
    return {
      ...r,
      assessment: { ...r.assessment, forecastMm: total },
      forecastHours: hours,
    };
  });
}
export function strongestAreas(areas, rows) {
  const byId = new Map(rows.map((r) => [r.sector.id, r]));
  return areas
    .filter((a) => a.kind !== "external_context")
    .map((a) => {
      const local = a.sectorIds.map((id) => byId.get(id)).filter(Boolean),
        known = local.filter((r) => finite(r.assessment.modelMm));
      const peak = known.length
        ? Math.max(...known.map((r) => r.assessment.modelMm))
        : null;
      const cellIds = [
        ...new Set(
          known
            .filter((r) => r.assessment.modelMm === peak)
            .map((r) => r.liveCell?.id),
        ),
      ];
      return {
        area: a,
        rate: peak,
        known: known.length,
        total: local.length,
        heavy: known.filter((r) => r.assessment.modelMm > 7.6).length,
        cellIds,
      };
    })
    .filter((a) => a.known > 0)
    .sort((a, b) => b.rate - a.rate || a.area.name.localeCompare(b.area.name));
}
export function evaluateRainReports(events, history, captures = []) {
  const candidates = [
    ...events
      .filter((e) => e.status === "captured_forecast")
      .map((e) => ({
        capturedAt: e.forecast.retrievedAt,
        grid: e.forecast.grid,
        local: true,
        id: e.id,
      })),
    ...captures.map((p) => ({
      capturedAt: p.weather?.retrievedAt,
      grid: p.weather?.cells ?? [],
      local: false,
      id: p.checkedAt,
    })),
  ];
  const rows = [];
  for (const observation of history?.reports ?? []) {
    const t = Date.parse(observation.observedAt),
      end = Math.ceil(t / 3600000) * 3600000,
      start = end - 3600000;
    if (!Number.isFinite(t)) continue;
    const eligible = candidates
      .filter((c) => Date.parse(c.capturedAt) < start)
      .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt));
    let saved = null;
    for (const c of eligible) {
      const { cell } = nearestWeather(observation.coordinates, c.grid);
      const h = cell?.series.find(
        (h) => Date.parse(h.time + (c.local ? "-05:00" : "")) === end,
      );
      if (finite(h?.mm) && h.mm >= 0) {
        saved = { capturedAt: c.capturedAt, mm: h.mm, id: c.id };
        break;
      }
    }
    if (!saved) {
      rows.push({
        observation,
        outcome: "unavailable",
        label: "No earlier forecast to compare",
      });
      continue;
    }
    const codes = observation.weather.split(/\s+/),
      vicinity = codes.some((x) => x.startsWith("VC") && x.includes("RA"));
    if (vicinity) {
      rows.push({
        observation,
        ...saved,
        outcome: "unavailable",
        label: "Rain nearby; station comparison inconclusive",
      });
      continue;
    }
    const rain = codes.some((x) => x.includes("RA") && !x.startsWith("VC")),
      expected = saved.mm > 0;
    rows.push({
      observation,
      ...saved,
      expected,
      rain,
      outcome: rain
        ? expected
          ? "anticipated"
          : "missed"
        : expected
          ? "not_observed"
          : "no_rain_report",
      label: rain
        ? expected
          ? "Rain was anticipated and later reported"
          : "Rain was reported but not anticipated"
        : expected
          ? "Rain was expected; this report contains no rain"
          : "No rain expected or reported at this instant",
    });
  }
  return {
    rows,
    anticipated: rows.filter((r) => r.outcome === "anticipated").length,
    missed: rows.filter((r) => r.outcome === "missed").length,
    notObserved: rows.filter((r) => r.outcome === "not_observed").length,
    comparable: rows.filter((r) => r.outcome !== "unavailable").length,
  };
}
export function recentReports(records, now, days = 2) {
  return (records ?? []).filter((r) => {
    const published = Date.parse(r.publishedAt),
      end = Date.parse(r.windowEnd);
    return (
      Number.isFinite(published) &&
      published <= now &&
      now - published <= days * 86400000 &&
      end >= now - days * 86400000
    );
  });
}
