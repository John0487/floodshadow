import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simulate, SCENARIOS, infer, recommend } from "./engine.js";
import { rank as original } from "./model/legacy.js";
import {
  evaluate,
  selectMethod,
  compareEpisode,
  runBenchmark,
  bootstrap,
  sequentialExperiment,
} from "./model/evaluation.js";
import { addVerification, sanitizeRecords } from "./model/verification.js";
import {
  rainfallTotal,
  fetchDataset,
  validateDataset,
} from "./data/validation.js";
import { unionFootprints, overlapFraction } from "./data/geography.js";
import { polygon, featureCollection, area } from "@turf/turf";
const features = Array.from({ length: 12 }, (_, i) => ({
  properties: {
    id: i,
    name: `Sector ${i}`,
    code: String(i),
    center: [-79.94 + i * 0.001, -2.13],
    neighbors: [i - 1, i + 1].filter((j) => j >= 0 && j < 12),
    susceptibility: i / 12,
    district: i < 6 ? "N" : "S",
    inspectionCost: 1,
  },
}));
const exact = {
  particles: 32,
  occurrenceIntercept: 0,
  occurrenceSd: 0,
  rainMean: 0,
  rainSd: 0,
  historyMean: 0,
  historySd: 0,
  occurrenceSpatialSd: 0,
  reportIntercept: 0,
  reportSd: 0,
  reportSpatialSd: 0,
  falseMean: 0.1,
  falseLogSd: 0,
};
test("closed-form Poisson mixture matches posterior and reporting probability", () => {
  const row = { ...features[0].properties, reports: 0, rainfall: 70 };
  const p = infer([row], {}, exact).rows[0];
  assert.ok(Math.abs(p.probability - 1 / 3) < 1e-12);
  assert.ok(Math.abs(p.reportProbability - (1 - 0.5 * Math.exp(-0.1))) < 1e-12);
  assert.ok(Math.abs(p.interval[0] - 1 / 3) < 1e-12);
});
test("a missing report is not an observed zero", () => {
  const base = { ...features[0].properties, rainfall: 70 };
  assert.ok(
    Math.abs(
      infer([{ ...base, reports: null }], {}, exact).rows[0].probability - 0.5,
    ) < 1e-12,
  );
  assert.ok(
    infer([{ ...base, reports: 0 }], {}, exact).rows[0].probability < 0.5,
  );
});
test("reproducible simulation separates truth, coverage and missingness streams", () => {
  const a = simulate(features, { seed: 33 }),
    b = simulate(features, {
      seed: 33,
      coverage: 0,
      missingRate: 0.8,
      falseRate: 0,
    });
  assert.deepEqual(a, simulate(features, { seed: 33 }));
  assert.deepEqual(
    a.truth.map((s) => s.affected),
    b.truth.map((s) => s.affected),
  );
  assert.ok(
    a.observed.every(
      (s) =>
        !("affected" in s) &&
        !("reportingProbability" in s) &&
        !("falseReports" in s),
    ),
  );
  assert.ok(b.truth.every((s) => s.reports === 0));
});
test("false reports, missing inputs and episode variation are generated", () => {
  const a = simulate(features, { falseRate: 2, missingRate: 0.5 });
  assert.ok(a.truth.some((s) => s.falseReports > 0));
  assert.ok(a.observed.some((s) => s.reports === null));
  assert.notDeepEqual(a.truth, simulate(features, { seed: 77 }).truth);
});
test("positive and negative checks clamp selected state and update other sectors", () => {
  const obs = features.map((f) => ({
    ...f.properties,
    reports: 0,
    rainfall: 90,
  }));
  const before = infer(obs, {}, { particles: 1024 });
  const positive = infer(
      obs,
      { 5: { result: "affected" } },
      { particles: 1024 },
    ),
    negative = infer(obs, { 5: { result: "unaffected" } }, { particles: 1024 });
  assert.equal(positive.rows[5].probability, 1);
  assert.equal(negative.rows[5].probability, 0);
  assert.ok(positive.rows[6].probability > before.rows[6].probability);
  assert.ok(negative.rows[6].probability < before.rows[6].probability);
  assert.ok(
    Math.abs(
      negative.rows[6].reportProbability - before.rows[6].reportProbability,
    ) > 1e-5,
  );
  assert.ok(!recommend(positive.rows).some((s) => s.id === 5));
});
test("posterior respects bounds and reports missing assumptions", () => {
  const obs = simulate(features).observed;
  obs[0] = { ...obs[0], rainfall: null, susceptibility: null, reports: null };
  const p = infer(obs, {}, { particles: 512 });
  assert.ok(p.diagnostics.ess > 0 && p.diagnostics.ess <= 512.001);
  for (const s of p.rows) {
    assert.ok(s.probability >= 0 && s.probability <= 1.00000001);
    assert.ok(s.interval[0] <= s.interval[1]);
    assert.ok(s.informationGain >= 0 && s.informationGain <= 1.00001);
  }
  assert.equal(p.rows[0].missing.length, 3);
});
test("invalid counts, duplicate IDs and impossible covariates are rejected", () => {
  assert.throws(() => infer([{ id: 1, reports: -1 }]), /Reports/);
  assert.throws(
    () =>
      infer([
        { id: 1, reports: 0 },
        { id: 1, reports: 0 },
      ]),
    /Duplicate/,
  );
  assert.throws(() => infer([{ id: 1, reports: 0, rainfall: -1 }]), /rainfall/);
});
test("mutual information is zero for known parameters and verified nodes", () => {
  const s = { ...features[0].properties, reports: 0, rainfall: 90 };
  assert.ok(infer([s], {}, exact).rows[0].informationGain < 1e-10);
  assert.ok(
    infer([s], { 0: { result: "affected" } }, exact).rows[0].informationGain <
      1e-10,
  );
});
test("all methods share candidate pool and available capacity; ties reproducible", () => {
  const e = compareEpisode(features, {}, 5, { particles: 128, seed: 88 });
  for (const target of ["all", "hidden"]) {
    const group = e.pools[target];
    for (const result of Object.values(group.methods)) {
      assert.equal(result.selected, Math.min(5, group.candidates));
      assert.equal(new Set(result.ids).size, result.ids.length);
      if (target === "hidden")
        assert.ok(
          result.ids.every(
            (id) => e.observed.find((s) => s.id === id).reports === 0,
          ),
        );
    }
  }
  assert.deepEqual(
    e.pools,
    compareEpisode(features, {}, 5, { particles: 128, seed: 88 }).pools,
  );
});
test("metric denominators are explicit and undefined metrics are null", () => {
  const t = [
    { id: 0, affected: true, reports: 0 },
    { id: 1, affected: true, reports: 3 },
  ];
  const m = evaluate([{ id: 0, reports: 0, district: "N" }], t, 5);
  assert.equal(m.precision, 1);
  assert.equal(m.recall, 0.5);
  assert.equal(m.hiddenRecall, 1);
  assert.equal(evaluate([], [], 5).precision, null);
  assert.equal(evaluate([], [], 5).recall, null);
});
test('hidden discovery evaluation uses truth even when its report observation was missing',()=>{const m=evaluate([{id:1,reports:null}], [{id:1,affected:true,reports:0}],1);assert.equal(m.hidden,1);assert.equal(m.hiddenRecall,1)});
test("bootstrap and benchmark are reproducible, paired and bounded", () => {
  assert.deepEqual(bootstrap([1, 2, 3]), bootstrap([1, 2, 3]));
  const a = runBenchmark(features, {}, 3, 6, { particles: 128 });
  assert.deepEqual(a, runBenchmark(features, {}, 3, 6, { particles: 128 }));
  assert.ok(a.calibration.brier >= 0 && a.calibration.brier <= 1);
  assert.equal(a.pools.hidden.paired.random.hidden.n, 6);
});
test("verification correction supersedes once and preserves a provenance trail", () => {
  const sector = features[0].properties;
  let a = addVerification(
    { verified: {}, queue: [0], log: [] },
    sector,
    "affected",
    { origin: "synthetic-oracle", time: "2026-10-25T10:00:00Z" },
  );
  a = addVerification(a, sector, "unaffected", {
    note: "Correction",
    time: "2026-10-25T11:00:00Z",
  });
  assert.equal(a.log.length, 2);
  assert.equal(a.verified[0].result, "unaffected");
  assert.equal(a.log[0].supersedes, a.log[1].verificationId);
  assert.deepEqual(a.queue, []);
  assert.throws(() => addVerification(a, sector, "unknown"));
  assert.deepEqual(sanitizeRecords({ bad: { verified: "oops" } }), {});
});
test("union prevents duplicate and partial footprint double counting", () => {
  const square = polygon([
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ]);
  const half = polygon([
    [
      [0, 0],
      [0.5, 0],
      [0.5, 1],
      [0, 1],
      [0, 0],
    ],
  ]);
  assert.ok(
    Math.abs(overlapFraction(square, unionFootprints([half, half])) - 0.5) <
      0.001,
  );
  assert.ok(
    Math.abs(overlapFraction(square, unionFootprints([square, square])) - 1) <
      1e-12,
  );
});
test("meteorological aggregation validates exact local day and missing hours", () => {
  const time = Array.from(
    { length: 24 },
    (_, i) => `2026-10-19T${String(i).padStart(2, "0")}:00`,
  );
  assert.equal(
    rainfallTotal({ hourly: { time, precipitation: time.map(() => 2) } }),
    48,
  );
  assert.equal(
    rainfallTotal({
      hourly: { time, precipitation: time.map((_, i) => (i ? 2 : null)) },
    }),
    null,
  );
  assert.equal(
    rainfallTotal({
      hourly: { time: time.slice(1), precipitation: time.map(() => 2) },
    }),
    null,
  );
});
test("optional failed JSON fetch does not destroy core geography", async () => {
  const root = new URL("../public/data/", import.meta.url);
  const data = await fetchDataset(async (url) => {
    if (url.includes("weather") || url.includes("events"))
      throw Error("network");
    return {
      ok: true,
      json: async () =>
        JSON.parse(readFileSync(new URL(url.split("/").at(-1), root))),
    };
  });
  assert.equal(data.geo.features.length, 36);
  assert.equal(data.weather, null);
  assert.equal(data.warnings.length, 2);
});
test("snapshot has valid symmetric topology, two geographic labels and bounded overlap", () => {
  const geo = JSON.parse(
    readFileSync(new URL("../public/data/sectors.geojson", import.meta.url)),
  );
  validateDataset({ geo });
  assert.equal(new Set(geo.features.map((f) => f.properties.district)).size, 2);
  for (const f of geo.features)
    for (const id of f.properties.neighbors)
      assert.ok(
        geo.features
          .find((g) => g.id === id)
          .properties.neighbors.includes(f.id),
      );
});
test("sequential verification uses oracle only after selection and never repeats", () => {
  const r = sequentialExperiment(features, {}, { k: 3, particles: 128 });
  assert.equal(new Set(r.steps.map((s) => s.id)).size, r.steps.length);
  assert.ok(r.steps.every((s) => s.posterior === (s.affected ? 1 : 0)));
});
test("Bayesian update obeys total expectation for uninspected sectors", () => {
  const obs = features.map((f) => ({
      ...f.properties,
      reports: 0,
      rainfall: 90,
    })),
    options = { particles: 512, intervals: false };
  const before = infer(obs, {}, options),
    positive = infer(obs, { 5: { result: "affected" } }, options),
    negative = infer(obs, { 5: { result: "unaffected" } }, options);
  const p = before.rows[5].probability;
  for (let i = 0; i < obs.length; i++)
    if (i !== 5) {
      assert.ok(
        Math.abs(
          before.rows[i].probability -
            (p * positive.rows[i].probability +
              (1 - p) * negative.rows[i].probability),
        ) < 1e-10,
      );
    }
});
