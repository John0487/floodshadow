import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  systemWarnings,
  attentionRows,
  archivedRows,
  ORIGINAL_INTENSITY,
  explainRain,
  selectForecastHour,
} from "./unified-weather.js";
const row = (id, rate, history, fresh = true) => ({
  sector: { id, areaId: id, historyOverlap: history },
  assessment: { score: null, modelMm: rate },
  fresh,
  liveCell: { id, time: "2026-10-26T23:45:00Z" },
});
test("system follow-up is inferred from fresh rain and past exposure, never from a requested place name", () => {
  const rows = [
    row("south", 10, 1),
    row("north", 1, 0),
    row("missing", null, 1),
    row("old", 100, 1, false),
  ];
  const w = systemWarnings(rows, [
    { id: "south", name: "South" },
    { id: "north", name: "North" },
  ]);
  assert.equal(
    w.some((w) => w.areaId === "north"),
    false,
  );
  assert.ok(w.some((w) => w.areaId === "south"));
  assert.ok(w.every((w) => w.origin === "system" && w.coordinates === null));
  assert.ok(w.every((w) => w.status.includes("needs verification")));
  assert.ok(w.every((w) => w.infrastructure.includes("unknown")));
});
test("no rain, stale values and missing exposure cannot produce possible-impact zones", () => {
  assert.deepEqual(systemWarnings([row("a", 0, 1)], []), []);
  assert.deepEqual(systemWarnings([row("a", 50, 1, false)], []), []);
  assert.deepEqual(systemWarnings([row("a", 50, null)], []), []);
});
test("attention uses the declared index without mutating rain observations", () => {
  const rows = [row("a", 5, 0.8), row("b", 1, 0.1)],
    before = JSON.stringify(rows);
  const r = attentionRows(rows);
  assert.equal(r[0].assessment.modelMm, 5);
  assert.ok(r[0].assessment.score >= 60);
  assert.equal(JSON.stringify(rows), before);
  assert.equal(r[0].assessment.probability, false);
});
test("saved event reuses immutable assessments and labels its peak hourly values separately from live weather", async () => {
  const read = async (name) =>
    JSON.parse(
      await readFile(
        new URL("../../public/data/city/" + name, import.meta.url),
        "utf8",
      ),
    );
  const [events, sectors, snapshots, impacts] = await Promise.all(
    ["events.json", "sectors.json", "assessments.json", "impacts.json"].map(
      read,
    ),
  );
  const event = events.find((e) => e.id === "oct24"),
    data = { events, sectors, snapshots, impacts };
  const s = sectors.find(
    (s) =>
      s.urban &&
      snapshots.find((x) => x.eventId === event.id).assessments[s.id]
        .modelCellId,
  );
  const saved = JSON.stringify(snapshots);
  const r = archivedRows(data, event, [s], "now")[0];
  assert.equal(r.fresh, false);
  assert.ok(Number.isFinite(r.assessment.modelMm));
  assert.equal(r.weatherCell.series[0].mm, r.assessment.modelMm);
  assert.equal(JSON.stringify(snapshots), saved);
});
test("plain-language rain descriptions retain technical values only as underlying data", () => {
  assert.equal(explainRain(40), "Heavy rain estimated");
  assert.equal(explainRain(null), "Rain amount unavailable");
  assert.equal(explainRain(0), "No rain estimated for this period");
  assert.ok(
    ORIGINAL_INTENSITY.includes("#b9d8bc") &&
      ORIGINAL_INTENSITY.includes("#f3de8a") &&
      ORIGINAL_INTENSITY.includes("#eda56b"),
  );
});

test("future-hour maps change with each location series; dry remains zero and missing or stale is unknown", () => {
  const rows = [
    {
      ...row("a", 2, 1),
      liveCell: {
        series: [
          { time: "first", mm: 0 },
          { time: "second", mm: 8 },
        ],
      },
    },
    { ...row("b", 2, 1), liveCell: { series: [{ time: "first", mm: 3 }] } },
    {
      ...row("stale", 2, 1, false),
      liveCell: { series: [{ time: "first", mm: 8 }] },
    },
  ];
  const before = JSON.stringify(rows);
  assert.deepEqual(
    selectForecastHour(rows, "first").map((r) => r.assessment.forecastMm),
    [0, 3, null],
  );
  assert.deepEqual(
    selectForecastHour(rows, "second").map((r) => r.assessment.forecastMm),
    [8, null, null],
  );
  assert.equal(JSON.stringify(rows), before);
  assert.equal(
    selectForecastHour(rows, "first", true)[2].assessment.forecastMm,
    8,
  );
});

test("invalid future-hour values never become rain observations or dry weather", () => {
  const rows = [NaN, -1, null, Infinity].map((mm, i) => ({
    ...row(String(i), 0, 1),
    liveCell: { series: [{ time: "future", mm }] },
  }));
  assert.ok(
    selectForecastHour(rows, "future").every(
      (r) => r.assessment.forecastMm === null,
    ),
  );
});
