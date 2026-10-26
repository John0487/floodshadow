export function validateDataset(data) {
  const ids = new Set();
  if (!data?.geo?.features?.length) throw Error("No census sectors available");
  for (const f of data.geo.features) {
    const p = f.properties;
    if (!p || ids.has(p.id))
      throw Error("Missing or duplicate census identity");
    ids.add(p.id);
    if (
      !["Polygon", "MultiPolygon"].includes(f.geometry?.type) ||
      !Array.isArray(p.center) ||
      p.center.length !== 2 ||
      p.center.some((v) => !Number.isFinite(v))
    )
      throw Error("Invalid census geometry or center");
    if (
      !Number.isFinite(p.susceptibility) ||
      p.susceptibility < 0 ||
      p.susceptibility > 1
    )
      throw Error("Historical overlap outside [0,1]");
  }
  for (const f of data.geo.features)
    for (const id of f.properties.neighbors || [])
      if (!ids.has(id)) throw Error("Neighbor outside loaded pilot");
  return data;
}
export function rainfallTotal(weather, day = "2026-10-19") {
  const hours = weather?.hourly;
  if (!Array.isArray(hours?.time) || !Array.isArray(hours.precipitation))
    return null;
  const values = hours.time
    .map((time, i) => ({ time, value: hours.precipitation[i] }))
    .filter((v) => v.time.startsWith(day + "T"));
  if (
    values.length !== 24 ||
    new Set(values.map((v) => v.time)).size !== 24 ||
    values.some(
      (v) => v.value == null || !Number.isFinite(v.value) || v.value < 0,
    )
  )
    return null;
  return values.reduce((sum, v) => sum + v.value, 0);
}
export async function fetchDataset(fetcher = fetch) {
  const names = [
    "sectors.geojson",
    "susceptibility.geojson",
    "sources.json",
    "weather.json",
    "events.geojson",
  ];
  const warnings = [];
  const responses = await Promise.all(
    names.map(async (name, i) => {
      try {
        const r = await fetcher(`/data/${name}`, {
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw Error(`HTTP ${r.status}`);
        return await r.json();
      } catch (e) {
        if (i < 3) throw Error(`Cannot load ${name}: ${e.message}`);
        warnings.push(`${name} unavailable; no synthetic replacement used.`);
        return null;
      }
    }),
  );
  const [geo, flood, sources, weather, events] = responses;
  return validateDataset({ geo, flood, sources, weather, events, warnings });
}
