import { mkdir, readFile, writeFile, rename, readdir } from "node:fs/promises";
import {
  normalizeInamhi,
  normalizeHistory,
  normalizeBulletins,
  INAMHI_URL,
  HISTORY_URL,
  BULLETINS_URL,
  CHANCE_URL,
  normalizeChance,
} from "../src/city/rain-journey.js";
export function createJourneySourceService({
  directory = new URL("../data-local/journey/", import.meta.url),
  weatherDirectory = new URL("../data-local/weather/", import.meta.url),
  fetcher = fetch,
  clock = Date.now,
  ttl = 900000,
} = {}) {
  let cached,
    pending,
    attempt = 0;
  async function refresh() {
    await mkdir(directory, { recursive: true });
    if (!cached)
      try {
        cached = JSON.parse(
          await readFile(new URL("latest.json", directory), "utf8"),
        );
      } catch {}
    attempt = clock();
    const at = new Date(attempt).toISOString(),
      configs = [
        ["inamhi", INAMHI_URL, normalizeInamhi],
        ["history", HISTORY_URL, normalizeHistory],
        ["bulletins", BULLETINS_URL, normalizeBulletins],
        ["chance", CHANCE_URL, normalizeChance],
      ];
    const results = await Promise.allSettled(
      configs.map(async ([key, url, normalize]) => {
        const r = await fetcher(url, {
          signal: AbortSignal.timeout(15000),
          headers: { "User-Agent": "FLOODSHADOW-local-beta/2.0" },
        });
        if (!r.ok) throw Error("HTTP " + r.status);
        const raw = await r.json();
        return { raw, value: normalize(raw, at) };
      }),
    );
    const value = { checkedAt: at, errors: [], captures: [] };
    configs.forEach(([key], i) => {
      const r = results[i];
      if (r.status === "fulfilled") value[key] = r.value.value;
      else {
        value[key] = cached?.[key] ?? null;
        value.errors.push({ source: key, message: r.reason.message });
      }
    });
    // Recent immutable captures supply genuine earlier forecasts for later reports.
    try {
      const files = (await readdir(weatherDirectory))
        .filter((n) => /^capture-\d+\.json$/.test(n))
        .sort()
        .slice(-288);
      for (const f of files) {
        try {
          const p = JSON.parse(
            await readFile(new URL(f, weatherDirectory), "utf8"),
          );
          if (p.weather && p.checkedAt)
            value.captures.push({ checkedAt: p.checkedAt, weather: p.weather });
        } catch {}
      }
    } catch {}
    await writeFile(
      new URL("sources-" + attempt + ".json", directory),
      JSON.stringify({
        ...value,
        raw: results.map((r) =>
          r.status === "fulfilled" ? r.value.raw : null,
        ),
      }),
    );
    await writeFile(new URL("latest.tmp", directory), JSON.stringify(value));
    await rename(
      new URL("latest.tmp", directory),
      new URL("latest.json", directory),
    );
    cached = value;
    return value;
  }
  return {
    async get() {
      if (cached && clock() - attempt < ttl) return cached;
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
