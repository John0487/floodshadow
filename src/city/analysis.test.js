import test from "node:test";
import {
  aggregateZones,
  describeDocumentedComparison,
  resolveSectorCandidates,
} from "./analysis.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  hourlySummary,
  nearestWeather,
  vigilanceIndex,
  evidenceState,
  postEventMetrics,
  coverageMetrics,
  shadowQueue,
  addRealVerification,
  acceptVerification,
  latestVerifications,
  comparePriorWithOutcomes,
} from "./analysis.js";
const sectors = [
  { id: "test-a", areaKm2: 1, center: [-79.9, -2.1] },
  { id: "test-b", areaKm2: 3, center: [-80, -2.1] },
];
test("geocoder alternatives must agree on one original sector, including outside and boundary ambiguity", () => {
  assert.equal(resolveSectorCandidates([["a"], ["a"]]), "a");
  assert.equal(resolveSectorCandidates([["a"], ["b"]]), null);
  assert.equal(resolveSectorCandidates([["a"], []]), null);
  assert.equal(resolveSectorCandidates([["a", "b"]]), null);
});
test("zone aggregation preserves zero, weights by area and never paints an incomplete zone as fully known", () => {
  const input = [
    { zoneId: "a", value: 20, areaKm2: 1 },
    { zoneId: "a", value: 0, areaKm2: 3 },
  ];
  assert.equal(aggregateZones(input).get("a").value, 5);
  assert.equal(
    aggregateZones([{ ...input[0], value: null }, input[1]]).get("a").value,
    null,
  );
});
test("descriptive comparisons deduplicate locations and do not become prospective validation", () => {
  const a = { "test-a": { score: 40 }, "test-b": { score: null } };
  const x = describeDocumentedComparison(
    a,
    [
      { eventId: "test", sectorId: "test-a" },
      { eventId: "test", sectorId: "test-a" },
      { eventId: "test", sectorId: "test-b" },
    ],
    "test",
  );
  assert.equal(x.evaluable, 1);
  assert.equal(x.highlighted, 0);
  assert.equal(x.notHighlighted, 1);
  assert.equal(x.missingIndex, 1);
  assert.ok(x.warning.includes("does not measure"));
});
const event = {
  id: "fixture-event",
  start: "2026-10-19T00:00:00-05:00",
  end: "2026-10-20T00:00:00-05:00",
};
const fixture = {
  eventId: event.id,
  sectorId: "test-a",
  result: "positive",
  scope: "sector",
  representative: true,
  completeEpisodeCoverage: true,
  observer: "Automated test fixture",
  method: "Synthetic fixture, never stored as real data",
  note: "Unit test only",
  evidenceUrl: "https://example.org/test",
  observedAt: "2026-10-19T08:00:00-05:00",
};
test("real-event hourly totals require exact complete windows, preserve zero and reject duplicates", () => {
  const hourly = {
    time: ["2026-10-19T00:00", "2026-10-19T01:00"],
    precipitation: [0, 3],
  };
  const result = hourlySummary(hourly, "2026-10-19T00:00", "2026-10-19T02:00");
  assert.equal(result.totalMm, 3);
  assert.equal(result.maxHourlyMm, 3);
  assert.equal(result.complete, true);
  assert.equal(
    hourlySummary(
      { ...hourly, precipitation: [0, null] },
      "2026-10-19T00:00",
      "2026-10-19T02:00",
    ).totalMm,
    null,
  );
  assert.equal(
    hourlySummary(hourly, "2026-10-19T00:00", "2026-10-19T03:00").totalMm,
    null,
  );
  assert.throws(
    () =>
      hourlySummary(
        { time: [hourly.time[0], hourly.time[0]], precipitation: [1, 2] },
        "2026-10-19T00:00",
        "2026-10-19T02:00",
      ),
    /Duplicate/,
  );
});
test("coarse-cell assignment has a maximum distance and does not imply station coverage", () => {
  const grid = [{ coordinates: [-79.9, -2.1], id: "g" }];
  assert.equal(nearestWeather([-79.9, -2.1], grid).cell.id, "g");
  assert.equal(nearestWeather([-81, -2.1], grid).cell, null);
  assert.equal(nearestWeather([-79.9, -2.1], []).cell, null);
});
test("vigilance contributions sum to the index; missing factors are not reweighted; dry rain scores zero", () => {
  const index = vigilanceIndex({
    historyOverlap: 0.8,
    rainMm: 30,
    rainPopulation: [10, 20, 30, 40],
  });
  assert.equal(index.score, 71.25);
  assert.equal(
    index.factors.reduce((s, f) => s + f.contribution, 0),
    index.score,
  );
  assert.equal(index.probability, false);
  assert.equal(
    vigilanceIndex({ historyOverlap: null, rainMm: 30, rainPopulation: [30] })
      .score,
    null,
  );
  assert.equal(
    vigilanceIndex({ historyOverlap: 1, rainMm: null, rainPopulation: [] })
      .score,
    null,
  );
  assert.equal(
    vigilanceIndex({ historyOverlap: 1, rainMm: 0, rainPopulation: [0, 0] })
      .factors[1].value,
    0,
  );
});
test("known point reports never imply entire-sector flooding; absence is never a negative check", () => {
  assert.equal(evidenceState({ score: 90 }, [], null), "possible");
  assert.equal(evidenceState({ score: 2 }, [], null), "insufficient");
  assert.equal(evidenceState({ score: 90 }, [{}], null), "documented_point");
  assert.equal(
    evidenceState({ score: 90 }, [], { result: "negative" }),
    "verified_negative",
  );
});
test("unreviewed and point checks do not enter sector denominators; corrections count once", () => {
  let records = addRealVerification([], fixture, sectors, [event]);
  assert.equal(postEventMetrics(sectors, [], records, event.id).verified, 0);
  records = acceptVerification(records, records[0].id, "QA fixture");
  assert.equal(
    postEventMetrics(sectors, [], records, event.id).positiveAmongVerified,
    100,
  );
  const corrected = addRealVerification(
    records,
    { ...fixture, result: "negative" },
    sectors,
    [event],
  );
  assert.equal(corrected[1].supersedes, records[0].id);
  assert.equal(
    latestVerifications(corrected, event.id).get("test-a").result,
    "positive",
  );
  const accepted = acceptVerification(corrected, corrected[1].id, "QA fixture");
  const metrics = postEventMetrics(sectors, [], accepted, event.id);
  assert.equal(metrics.verified, 1);
  assert.equal(metrics.positiveAmongVerified, 0);
  assert.equal(metrics.verificationCoverage, 50);
  assert.equal(metrics.unreportedDiscoveryEvaluable, false);
  const pendingPoint = addRealVerification(
    [],
    { ...fixture, scope: "point" },
    sectors,
    [event],
  );
  const point = acceptVerification(
    pendingPoint,
    pendingPoint[0].id,
    "reviewer",
  );
  assert.equal(postEventMetrics(sectors, [], point, event.id).verified, 0);
});
test("verification requires evidence, a valid event time, known sector and representative sector scope", () => {
  assert.throws(
    () =>
      addRealVerification(
        [],
        { ...fixture, result: "negative", completeEpisodeCoverage: false },
        sectors,
        [event],
      ),
    /window/,
  );
  assert.throws(() =>
    addRealVerification(
      [],
      { ...fixture, evidenceUrl: "javascript:alert(1)" },
      sectors,
      [event],
    ),
  );
  assert.throws(() =>
    addRealVerification([], { ...fixture, representative: false }, sectors, [
      event,
    ]),
  );
  assert.throws(() =>
    addRealVerification(
      [],
      { ...fixture, observedAt: "2026-10-21T00:00:00-05:00" },
      sectors,
      [event],
    ),
  );
  assert.throws(() =>
    addRealVerification([], { ...fixture, sectorId: "outside" }, sectors, [
      event,
    ]),
  );
});
test("empty denominators are unavailable and documented-sector percentage has an explicit known denominator", () => {
  const m = postEventMetrics(
    sectors,
    [
      { eventId: event.id, sectorId: "test-a" },
      { eventId: event.id, sectorId: "test-a" },
    ],
    [],
    event.id,
  );
  assert.equal(m.positiveAmongVerified, null);
  assert.equal(m.verificationCoverage, 0);
  assert.equal(m.documented, 1);
  assert.equal(m.documentedShare, 50);
});
test("shadow recommendations update after checks without treating missing reports as known zeros", () => {
  const a = { "test-a": { score: 80 }, "test-b": { score: 70 } };
  assert.equal(shadowQueue(sectors, a, [], [], event.id).length, 2);
  const records = [{ ...fixture, validation: "accepted" }];
  assert.deepEqual(
    shadowQueue(sectors, a, [], records, event.id).map((x) => x.sector.id),
    ["test-b"],
  );
  assert.deepEqual(
    shadowQueue(
      sectors,
      a,
      [{ eventId: event.id, sectorId: "test-b" }],
      records,
      event.id,
    ),
    [],
  );
});
test("area coverage differs from sector coverage and instrumental coverage remains separate", () => {
  const c = coverageMetrics(
    sectors,
    { "test-a": { forecastMm: 2 }, "test-b": { forecastMm: null } },
    [{}],
  );
  assert.equal(c.forecastSectorShare, 50);
  assert.equal(c.forecastAreaShare, 25);
  assert.equal(c.directStations, 1);
});
test("retrospective reconstruction cannot be counted as a successful prospective prediction", () => {
  const input = {
    issuedAt: "2026-10-25T00:00:00Z",
    kind: "retrospective_reconstruction",
    assessments: { "test-a": { score: 80 } },
  };
  const records = [{ ...fixture, validation: "accepted" }];
  assert.equal(
    comparePriorWithOutcomes(input, sectors, records, event).evaluable,
    false,
  );
  const prospective = {
    ...input,
    issuedAt: "2026-10-18T00:00:00Z",
    kind: "prospective",
  };
  const result = comparePriorWithOutcomes(prospective, sectors, records, event);
  assert.equal(result.evaluable, true);
  assert.equal(result.tp, 1);
  assert.equal(result.precision, 100);
});
test("production city snapshots are complete, immutable by checksum, and use no synthetic real incidents", async () => {
  const read = async (n) =>
    JSON.parse(
      await readFile(
        new URL("../../public/data/city/" + n, import.meta.url),
        "utf8",
      ),
    );
  const [manifest, city, events, snapshots, impacts, geo, zones] =
    await Promise.all(
      [
        "manifest.json",
        "sectors.json",
        "events.json",
        "assessments.json",
        "impacts.json",
        "sectors.map.geojson",
        "zones.map.geojson",
      ].map(read),
    );
  assert.equal(city.length, 6652);
  assert.equal(city.filter((s) => s.urban).length, 6416);
  assert.equal(new Set(city.map((s) => s.id)).size, city.length);
  assert.equal(geo.features.length, city.length);
  assert.equal(zones.features.length, 737);
  assert.equal(
    impacts.filter((i) => i.type === "water_accumulation").length,
    68,
  );
  assert.equal(impacts.length, 78);
  assert.ok(
    impacts.every(
      (i) =>
        (i.source && i.coordinates === null) ||
        i.geocoding?.status === "high_match_unreviewed",
    ),
  );
  for (const e of events) {
    if (e.forecast.initializedAt)
      assert.ok(Date.parse(e.forecast.initializedAt) < Date.parse(e.start));
    else assert.equal(e.status, "captured_forecast");
    assert.ok(e.forecast.grid.every((g) => g.complete));
    assert.ok(e.modelRain.grid.every((g) => g.complete));
    assert.equal(e.forecast.uncertainty, null);
  }
  for (const s of snapshots) {
    const { sha256, ...payload } = s;
    assert.equal(
      createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
      sha256,
    );
    assert.ok(["retrospective_reconstruction", "prospective"].includes(s.kind));
    if (s.kind === "prospective")
      assert.ok(
        Date.parse(s.issuedAt) <
          Date.parse(events.find((e) => e.id === s.eventId).start),
      );
    assert.equal(Object.keys(s.assessments).length, 6652);
  }
  assert.equal(manifest.geometryAudit.validAnalyticalSectors, 6652);
  assert.equal(manifest.geometryAudit.validRenderSectors, 6652);
  assert.equal(manifest.geometryAudit.validZones, 737);
});
