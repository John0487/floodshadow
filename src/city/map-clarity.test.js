import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  outlineGeometry,
  attentionCategory,
  attentionCounts,
  mapDetailPolicy,
  areaValue,
  rowValue,
} from "./map-model.js";
test("reported-area outlines show exterior only without changing source or filled geometry", async () => {
  const d = JSON.parse(
    await readFile(
      new URL("../../public/data/city/areas.json", import.meta.url),
      "utf8",
    ),
  );
  const a = d.areas.find((a) => a.name === "Urdesa"),
    original = JSON.stringify(a.geometry),
    outline = outlineGeometry(a.geometry);
  assert.equal(a.geometry.type, "Polygon");
  assert.ok(a.geometry.coordinates.length > 1);
  assert.equal(outline.coordinates.length, 1);
  assert.deepEqual(outline.coordinates[0], a.geometry.coordinates[0]);
  assert.equal(JSON.stringify(a.geometry), original);
  const multi = {
    type: "MultiPolygon",
    coordinates: [a.geometry.coordinates, a.geometry.coordinates],
  };
  assert.ok(outlineGeometry(multi).coordinates.every((p) => p.length === 1));
  assert.equal(multi.coordinates[0].length, a.geometry.coordinates.length);
});
test("attention has distinct categories, including zero and unknown, at the actual thresholds", () => {
  assert.equal(attentionCategory(0).label, "Lower attention");
  assert.equal(attentionCategory(29.9).color, "#b9d8bc");
  assert.equal(attentionCategory(30).label, "Preventive watch");
  assert.equal(attentionCategory(60).label, "Priority monitoring");
  assert.equal(attentionCategory(null).label, "Not enough information");
  assert.notEqual(attentionCategory(0).color, attentionCategory(null).color);
});
test("city map preserves known local values while zoom only gates census borders", () => {
  for (const z of [9, 11, 13, 15])
    assert.equal(mapDetailPolicy(z).showValues, true);
  assert.equal(mapDetailPolicy(11).showBoundaries, false);
  assert.equal(mapDetailPolicy(13).showBoundaries, false);
  assert.equal(mapDetailPolicy(14).showBoundaries, true);
  assert.equal(mapDetailPolicy(12, "polygons").showBoundaries, true);
  const rows = [
    { sector: { id: "a", areaKm2: 1 }, assessment: { score: 0 } },
    { sector: { id: "b", areaKm2: 1 }, assessment: { score: null } },
  ];
  assert.equal(areaValue({ sectorIds: ["a", "b"] }, rows, "priority"), null);
  assert.equal(rowValue(rows[0], "priority"), 0);
  assert.equal(rowValue(rows[1], "priority"), null);
  assert.deepEqual(attentionCounts(rows), {
    lower: 1,
    watch: 0,
    priority: 0,
    unknown: 1,
  });
});
test("prepared October event contains multiple supported categories rather than uniform unknown", async () => {
  const read = async (name) =>
    JSON.parse(
      await readFile(
        new URL("../../public/data/city/" + name, import.meta.url),
        "utf8",
      ),
    );
  const sectors = await read("sectors.json"),
    assessments = (await read("assessments.json")).find(
      (a) => a.eventId === "oct24",
    ).assessments;
  const rows = sectors
    .filter((s) => s.urban)
    .map((sector) => ({ sector, assessment: assessments[sector.id] }));
  assert.deepEqual(attentionCounts(rows), {
    lower: 4220,
    watch: 1096,
    priority: 191,
    unknown: 909,
  });
  assert.equal(rows.length, 6416);
});
