import * as turf from "@turf/turf";
export function unionFootprints(features) {
  if (!features.length) return null;
  for (const f of features)
    if (!turf.booleanValid(f))
      throw Error(
        "Invalid historical geometry; repair at source before computing overlap",
      );
  return features.length === 1
    ? features[0]
    : turf.union(turf.featureCollection(features));
}
export function overlapFraction(sector, footprint) {
  const area = turf.area(sector);
  if (!Number.isFinite(area) || area <= 0)
    throw Error("Sector has no valid area");
  if (!footprint) return 0;
  const intersection = turf.intersect(
    turf.featureCollection([sector, footprint]),
  );
  return Math.max(
    0,
    Math.min(1, intersection ? turf.area(intersection) / area : 0),
  );
}
export function enrichSectors(features, footprint) {
  const mid = features
    .map((f) => turf.centroid(f).geometry.coordinates[1])
    .sort((a, b) => a - b)[Math.floor(features.length / 2)];
  const result = features.map((input, i) => {
    if (!turf.booleanValid(input)) throw Error(`Invalid census geometry ${i}`);
    const f = structuredClone(input),
      p = f.properties,
      center = turf.centroid(f).geometry.coordinates;
    const id = Number(p.id ?? p.objectid);
    if (!Number.isFinite(id)) throw Error("Missing sector ID");
    return {
      ...f,
      id,
      properties: {
        id,
        code: String(p.code ?? p.sec),
        name: p.name ?? `Sector ${String(i + 1).padStart(2, "0")}`,
        center,
        areaKm2: turf.area(f) / 1e6,
        susceptibility: overlapFraction(f, footprint),
        district:
          center[1] >= mid ? "Pilot · northern half" : "Pilot · southern half",
        neighbors: [],
      },
    };
  });
  for (let i = 0; i < result.length; i++)
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i],
        b = result[j];
      if (
        turf.booleanIntersects(a, b) ||
        turf.booleanIntersects(
          turf.buffer(a, 0.001, { units: "kilometers" }),
          b,
        )
      ) {
        a.properties.neighbors.push(b.id);
        b.properties.neighbors.push(a.id);
      }
    }
  return turf.featureCollection(result);
}
