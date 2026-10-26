export async function loadCity(signal) {
  const names = [
    "manifest.json",
    "sectors.json",
    "events.json",
    "impacts.json",
    "assessments.json",
    "sectors.map.geojson",
    "zones.map.geojson",
    "areas.json",
  ];
  const result = await Promise.all(
    names.map(async (name) => {
      const r = await fetch("/data/city/" + name, { signal });
      if (!r.ok) throw Error(`Could not load ${name} (HTTP ${r.status})`);
      return r.json();
    }),
  );
  const [
    manifest,
    sourceSectors,
    events,
    impacts,
    snapshots,
    geo,
    zones,
    territories,
  ] = result;
  const sectors = sourceSectors.map((s) => ({
    ...s,
    ...territories.assignments[s.id],
  }));
  const [support, context] = await Promise.all(['locations.geojson','context.geojson'].map(async name => {
    try { const r=await fetch('/data/support/'+name,{signal}); if(!r.ok) return null; const d=await r.json(); return d.type==='FeatureCollection'?d:null; } catch {return null;}
  }));
  if (
    !Array.isArray(sectors) ||
    !Array.isArray(events) ||
    !Array.isArray(impacts) ||
    !Array.isArray(snapshots) ||
    !Array.isArray(geo?.features) ||
    !Array.isArray(zones?.features)
  )
    throw Error("Invalid snapshot structure");
  if (
    !sectors.length ||
    new Set(sectors.map((s) => s.id)).size !== sectors.length ||
    geo.features.length !== sectors.length
  )
    throw Error("Map geography has duplicate IDs or is incomplete");
  if (
    manifest.sectorCount !== sectors.length ||
    snapshots.some((s) => Object.keys(s.assessments).length !== sectors.length)
  )
    throw Error("Analysis and geography do not match the same snapshot");
  const ids = new Set(sectors.map((s) => s.id));
  if (
    events.some(
      (e) =>
        !e.id ||
        !Array.isArray(e.forecast?.grid) ||
        !Array.isArray(e.modelRain?.grid) ||
        !snapshots.some((s) => s.eventId === e.id),
    ) ||
    snapshots.some(
      (s) =>
        !events.some((e) => e.id === s.eventId) ||
        Object.keys(s.assessments).some((id) => !ids.has(id)),
    )
  )
    throw Error("Storms, sectors and assessments do not match");
  if (Object.keys(territories.assignments).length !== sectors.length)
    throw Error("Named area membership is incomplete");
  const areaIds = new Set(territories.areas.map((a) => a.id));
  if (sectors.some((s) => !areaIds.has(s.areaId)))
    throw Error("Unknown named area membership");
  return {
    manifest,
    sectors,
    events,
    impacts,
    snapshots,
    geo,
    zones,
    territories,
    support,
    context,
  };
}
export function loadRealRecords() {
  try {
    const d = JSON.parse(
      localStorage.getItem("floodshadow-real-verifications-v2") ?? "[]",
    );
    if (!Array.isArray(d)) return [];
    return d.filter(
      (v) =>
        v &&
        typeof v.id === "string" &&
        typeof v.eventId === "string" &&
        typeof v.sectorId === "string" &&
        ["positive", "negative"].includes(v.result) &&
        ["pending", "accepted"].includes(v.validation) &&
        ["point", "sector"].includes(v.scope),
    );
  } catch {
    return [];
  }
}
export function saveRealRecords(records) {
  localStorage.setItem(
    "floodshadow-real-verifications-v2",
    JSON.stringify(records),
  );
}
let ledgerRevision = 0;
export async function loadLocalLedger() {
  const r = await fetch("/api/ledger");
  if (!r.ok)
    throw Error(
      "The local evidence service is unavailable. Use npm run demo:local.",
    );
  const data = await r.json();
  ledgerRevision = data.revision;
  return data;
}
export async function persistLocalRecords(records) {
  const r = await fetch("/api/ledger", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision: ledgerRevision, records }),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error ?? "Evidence could not be saved.");
  ledgerRevision = data.revision;
  return data;
}
export function downloadJSON(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
