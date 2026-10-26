import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizePlace,
  searchAreas,
  selectAreaSectors,
  rainfallScale,
} from "./territory.js";
const areas = JSON.parse(
  readFileSync(new URL("../../public/data/city/areas.json", import.meta.url)),
);
const sectors = JSON.parse(
  readFileSync(new URL("../../public/data/city/sectors.json", import.meta.url)),
);
test("named groups partition all 6652 official polygons exactly once and retain traceable municipal assignments", () => {
  const groups = areas.areas.filter((a) => a.kind !== "external_context");
  const ids = groups.flatMap((a) => a.sectorIds);
  assert.equal(ids.length, 6652);
  assert.equal(new Set(ids).size, 6652);
  assert.equal(Object.keys(areas.assignments).length, 6652);
  for (const s of sectors) {
    const a = areas.assignments[s.id];
    assert.ok(groups.find((g) => g.id === a.areaId).sectorIds.includes(s.id));
    if (a.assignmentMethod === "municipal_majority")
      assert.ok(a.assignmentShare > 0.5);
  }
  assert.equal(areas.municipalSourceCount, 95);
  assert.equal(areas.external.features.length, 246);
});
test("area search handles accents and San Borondon without silently merging cantons", () => {
  assert.equal(normalizePlace("San Borondón"), "sanborondon");
  assert.equal(
    searchAreas(areas.areas, "San Borondón")[0].id,
    "external-samborondon",
  );
  const urdesa = searchAreas(areas.areas, "urdesa")[0];
  const filtered = selectAreaSectors(sectors, "canton", urdesa);
  assert.equal(filtered.length, 89);
  assert.ok(filtered.every((s) => urdesa.sectorIds.includes(s.id)));
  assert.equal(
    selectAreaSectors(
      sectors,
      "canton",
      searchAreas(areas.areas, "samborondon")[0],
    ).length,
    0,
  );
});
test("rain color scale follows actual window and preserves absence instead of generating values", () => {
  assert.equal(rainfallScale([{ weatherCell: { totalMm: 39 } }]).upper, 40);
  assert.equal(rainfallScale([{ weatherCell: { totalMm: 0 } }]).maximum, 0);
  assert.equal(rainfallScale([{ weatherCell: null }]).maximum, null);
  assert.equal(
    rainfallScale([{ weatherCell: { series: [{ mm: 21.3 }] } }], 0).upper,
    25,
  );
});
