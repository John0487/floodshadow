import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildAlerts, appendAlertHistory, scenarioRows } from "./findings.js";
import { createLedger } from "../../scripts/local-ledger.mjs";
import { createImpactPDF, buildReportSections } from "./impact-report.js";
const event = {
  id: "qa",
  start: "2020-01-01T00:00:00-05:00",
  end: "2020-01-02T00:00:00-05:00",
  windowStart: "2020-01-01T00:00",
  windowEnd: "2020-01-02T00:00",
  status: "historical",
  observations: [],
  forecast: {
    url: "https://example.org/forecast",
    grid: [{ id: "c", totalMm: 10, coordinates: [-80, -2] }],
  },
};
const sector = { id: "qa-sector", areaId: "area", historyOverlap: 1 };
const assessment = {
  score: 75,
  forecastMm: 10,
  forecastCellId: "c",
  modelMm: 20,
};
const area = { id: "area", name: "QA fixture only", sectorIds: [sector.id] };
const snapshot = {
  id: "qa-snapshot",
  eventId: event.id,
  kind: "retrospective",
  assessments: { [sector.id]: assessment },
  modelVersion: "qa",
  sha256: "fixture",
};
const data = {
  sectors: [sector],
  events: [event],
  snapshots: [snapshot],
  impacts: [],
  territories: { areas: [area] },
};
const check = {
  id: "test-only",
  eventId: event.id,
  sectorId: sector.id,
  result: "positive",
  scope: "point",
  observer: "QA fixture",
  method: "Test only",
  note: "Not a field observation",
  evidenceUrl: "https://example.org/test",
  observedAt: "2020-01-01T12:00:00-05:00",
  createdAt: "2020-01-02T12:00:00Z",
  validation: "accepted",
  reviewer: "QA",
  reviewedAt: "2020-01-03T12:00:00Z",
};
const input = (records) => ({
  sectors: [sector],
  assessments: snapshot.assessments,
  impacts: [],
  records,
  event,
  areas: [area],
});
test("findings distinguish watch, published evidence and reviewed checks and preserve history", () => {
  const pending = buildAlerts(input([]));
  assert.equal(pending[0].type, "Verification Needed");
  const accepted = buildAlerts(input([check]));
  assert.equal(accepted[0].type, "Confirmed Impact");
  const h = appendAlertHistory(appendAlertHistory([], pending), accepted);
  assert.equal(h.length, 2);
  assert.equal(h[1].previousType, "Verification Needed");
  assert.equal(appendAlertHistory(h, accepted).length, 2);
  const corrected = {
    ...check,
    id: "correction",
    result: "negative",
    supersedes: check.id,
  };
  assert.notEqual(
    buildAlerts(input([check, corrected]))[0].type,
    "Confirmed Impact",
  );
  assert.equal(
    buildAlerts({
      ...input([]),
      impacts: [
        { id: "news", sectorId: sector.id, source: "https://example.org/news" },
      ],
    })[0].type,
    "Documented Impact",
  );
});
test("scenarios use fixed real references, retain missingness and never mutate baseline evidence", () => {
  const row = { sector, assessment, impacts: [] };
  const original = JSON.stringify(row);
  const dry = scenarioRows([row], event, {
    rain: 0,
    duration: 100,
    shift: 0,
    coverage: 100,
  });
  const wet = scenarioRows([row], event, {
    rain: 200,
    duration: 100,
    shift: 0,
    coverage: 100,
  });
  assert.ok(wet[0].assessment.score > dry[0].assessment.score);
  assert.equal(
    scenarioRows([row], event, {
      rain: 100,
      duration: 100,
      shift: 0,
      coverage: 0,
    })[0].assessment.score,
    null,
  );
  assert.equal(JSON.stringify(row), original);
});
test("local file ledger survives a new instance, rejects stale writes, preserves corrections and previous file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "floodshadow-qa-"));
  try {
    const file = join(dir, "ledger.json");
    const store = createLedger(file, data);
    await store.save({ expectedRevision: 0, records: [] });
    await store.save({ expectedRevision: 1, records: [check] });
    const restarted = createLedger(file, data);
    assert.equal((await restarted.read()).records[0].id, check.id);
    await assert.rejects(
      () => restarted.save({ expectedRevision: 1, records: [check] }),
      /Another session/,
    );
    await assert.rejects(
      () => restarted.save({ expectedRevision: 2, records: [] }),
      /cannot be deleted/,
    );
    assert.ok(JSON.parse(await readFile(file + ".previous", "utf8")));
    assert.equal((await restarted.read()).revision, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("impact report has all eight sections and produces a real PDF without invented damage claims", () => {
  const report = {
    event,
    rows: [{ sector, assessment }],
    impacts: [],
    records: [],
    areas: [area],
    alerts: [],
    snapshot,
  };
  assert.equal(buildReportSections(report).length, 8);
  assert.ok(createImpactPDF(report).output().startsWith("%PDF-"));
  assert.ok(buildReportSections(report)[5][1][0].includes("0 of 1"));
});
