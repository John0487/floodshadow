import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const folder = process.env.FLOODSHADOW_OUTPUT_DIR
  ? pathToFileURL(resolve(process.env.FLOODSHADOW_OUTPUT_DIR) + "/")
  : new URL("../public/data/city/", import.meta.url);
const files = [
  "manifest.json",
  "sectors.json",
  "events.json",
  "impacts.json",
  "assessments.json",
  "sectors.map.geojson",
  "zones.map.geojson",
  "areas.json",
];
const raw = await Promise.all(files.map((f) => readFile(new URL(f, folder))));
const data = raw.map((b) => JSON.parse(b));
const [manifest, sectors, events, impacts, snapshots, geo, zones, areas] = data;
if (
  sectors.length !== 6652 ||
  new Set(sectors.map((s) => s.id)).size !== 6652 ||
  geo.features.length !== sectors.length
)
  throw Error("Invalid prepared geography");
const groupIds = areas.areas
  .filter((a) => a.kind !== "external_context")
  .flatMap((a) => a.sectorIds);
if (groupIds.length !== 6652 || new Set(groupIds).size !== 6652)
  throw Error("Invalid area partition");
for (const snapshot of snapshots) {
  const { sha256, ...payload } = snapshot;
  if (
    createHash("sha256").update(JSON.stringify(payload)).digest("hex") !==
    sha256
  )
    throw Error("Assessment checksum mismatch");
  if (!events.some((e) => e.id === snapshot.eventId))
    throw Error("Unknown snapshot event");
}
const seal = Object.fromEntries(
  files.map((f, i) => [f, createHash("sha256").update(raw[i]).digest("hex")]),
);
if (process.argv.includes("--seal"))
  await writeFile(
    new URL("prepared-manifest.json", folder),
    JSON.stringify(
      { sealedAt: new Date().toISOString(), files: seal },
      null,
      2,
    ),
  );
else {
  const expected = JSON.parse(
    await readFile(new URL("prepared-manifest.json", folder), "utf8"),
  );
  for (const f of files)
    if (expected.files[f] !== seal[f])
      throw Error(
        `Prepared file changed: ${f}. Validate the update before sealing.`,
      );
}
console.log(
  JSON.stringify({
    valid: true,
    sectors: sectors.length,
    events: events.length,
    impacts: impacts.length,
    files: files.length,
  }),
);
