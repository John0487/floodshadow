import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import {
  normalizeWeather,
  normalizeStation,
} from "../src/city/live-weather.js";
export const MODEL_URL =
  "https://api.open-meteo.com/v1/forecast?" +
  new URLSearchParams({
    latitude: "-2.1,-2.1,-2.2,-2.2,-2.3,-2.3",
    longitude: "-79.9,-80,-79.9,-80,-79.9,-80",
    current: "precipitation,rain,showers,weather_code",
    hourly: "precipitation",
    forecast_hours: "13",
    past_hours: "2",
    models: "ecmwf_ifs",
    timeformat: "unixtime",
    timezone: "UTC",
  });
export const STATION_URL =
  "https://aviationweather.gov/api/data/metar?ids=SEGU&format=json";
export function createLiveWeatherService({
  directory = new URL("../data-local/weather/", import.meta.url),
  fetcher = fetch,
  clock = Date.now,
  ttl = 60000,
} = {}) {
  let cached = null,
    pending = null,
    lastAttempt = 0;
  async function source(url) {
    const r = await fetcher(url, {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "FLOODSHADOW-local-beta/2.0" },
    });
    if (!r.ok) throw Error("Upstream HTTP " + r.status);
    return r.json();
  }
  async function refresh() {
    await mkdir(directory, { recursive: true });
    if (!cached)
      try {
        cached = JSON.parse(
          await readFile(new URL("latest.json", directory), "utf8"),
        );
      } catch {}
    const now = clock(),
      at = new Date(now).toISOString();
    lastAttempt = now;
    const results = await Promise.allSettled([
      source(MODEL_URL).then((d) => ({
        raw: d,
        value: normalizeWeather(d, at),
      })),
      source(STATION_URL).then((d) => ({
        raw: d,
        value: normalizeStation(d, at),
      })),
    ]);
    const errors = results.flatMap((r, i) =>
      r.status === "rejected"
        ? [
            {
              source: i === 0 ? "weather" : "station",
              message: r.reason.message,
            },
          ]
        : [],
    );
    const value = {
      checkedAt: at,
      refreshEverySeconds: ttl / 1000,
      weather:
        results[0].status === "fulfilled"
          ? results[0].value.value
          : (cached?.weather ?? null),
      station:
        results[1].status === "fulfilled"
          ? results[1].value.value
          : (cached?.station ?? null),
      errors,
      sources: { weather: MODEL_URL, station: STATION_URL },
      fallback: errors.length > 0,
    };
    if (results.some((r) => r.status === "fulfilled")) {
      const archive = {
        ...value,
        raw: results.map((r) =>
          r.status === "fulfilled" ? r.value.raw : null,
        ),
      };
      await writeFile(
        new URL("capture-" + now + ".json", directory),
        JSON.stringify(archive),
        { flag: "wx" },
      );
      await writeFile(new URL("latest.tmp", directory), JSON.stringify(value));
      await rename(
        new URL("latest.tmp", directory),
        new URL("latest.json", directory),
      );
    }
    cached = value;
    return value;
  }
  return {
    async get({ force = false } = {}) {
      if (cached && clock() - lastAttempt < (force ? 60000 : ttl))
        return cached;
      if (pending) return pending;
      pending = refresh();
      try {
        return await pending;
      } finally {
        pending = null;
      }
    },
  };
}
