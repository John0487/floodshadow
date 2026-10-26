import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
test("real-event passport, timeline and provenance render without invented probabilities or measurements", async () => {
  const server = await createServer({
    cacheDir: "node_modules/.vite-city-test",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });
  try {
    const read = async (name) =>
      JSON.parse(
        await readFile(
          new URL("../../public/data/city/" + name, import.meta.url),
          "utf8",
        ),
      );
    const [sectors, events, snapshots, manifest, impacts] = await Promise.all(
      [
        "sectors.json",
        "events.json",
        "assessments.json",
        "manifest.json",
        "impacts.json",
      ].map(read),
    );
    const { default: Passport } = await server.ssrLoadModule(
      "/src/city/SectorPassport.jsx",
    );
    const { default: Timeline } = await server.ssrLoadModule(
      "/src/city/RainTimeline.jsx",
    );
    const { default: Dialog } = await server.ssrLoadModule(
      "/src/city/CityDialog.jsx",
    );
    const sector = sectors.find(
      (s) => s.urban && snapshots[0].assessments[s.id].score !== null,
    );
    const base = {
      row: {
        sector,
        assessment: snapshots[0].assessments[sector.id],
        state: "insufficient",
      },
      event: events[0],
      snapshot: snapshots[0],
      impacts,
      records: [],
      data: { manifest, events, sectors },
      onRecords: () => {},
      onSources: () => {},
      onLaboratory: () => {},
    };
    const before = renderToStaticMarkup(
      React.createElement(Passport, { ...base, phase: "before" }),
    ).replace(/<span[^>]*>|<\/span>/g, '');
    assert.match(before, /Not a flood probability/);
    assert.match(before, /Retrospective analysis/);
    assert.doesNotMatch(before, /Record a verification/);
    assert.match(before, /HTTP 500/);
    assert.match(before, /SHA-256/);
    const after = renderToStaticMarkup(
      React.createElement(Passport, { ...base, phase: "after" }),
    );
    assert.match(after, /Before and after, the same sector/);
    assert.match(after, /Record a verification/);
    assert.doesNotMatch(after, /Cerro Santa Ana|Published measurements/);
    const chart = renderToStaticMarkup(
      React.createElement(Timeline, {
        event: events[0],
        cell: events[0].modelRain.grid[0],
        phase: "during",
        hour: 5,
        onHour: () => {},
      }),
    );
    assert.match(chart, /21\.3 mm\/h/);
    assert.equal((chart.match(/title="2026-/g) ?? []).length, 24);
    const source = renderToStaticMarkup(
      React.createElement(Dialog, {
        kind: "sources",
        data: { manifest, events, impacts },
        event: events[0],
        onClose: () => {},
        onPhase: () => {},
        onLab: () => {},
      }),
    );
    assert.match(source, /researched, not integrated/);
    assert.match(source, /NASA GPM/);
    assert.match(source, /without field review/);
    const { default: Brief } = await server.ssrLoadModule(
      "/src/city/CityBrief.jsx",
    );
    const { default: Evidence } = await server.ssrLoadModule(
      "/src/city/EpisodeEvidence.jsx",
    );
    const forecastBrief = renderToStaticMarkup(
      React.createElement(Brief, {
        view: {
          phase: "before",
          event: events[0],
          tab: "priority",
          search: "",
          scopeName: "Guayaquil",
        },
        analysis: { sectors, rows: [], ranked: [], shadows: [], coverage: {} },
        actions: {},
      }),
    );
    assert.match(forecastBrief, /Highest forecast total/);
    assert.doesNotMatch(
      forecastBrief,
      /181|Cerro Santa Ana|68 cited locations/,
    );
    const beforeEvidence = renderToStaticMarkup(
      React.createElement(Evidence, { event: events[0], phase: "before" }),
    );
    assert.doesNotMatch(beforeEvidence, /181|Published measurements/);
    assert.match(beforeEvidence, /Every sector stays visible/);
  } finally {
    await server.close();
  }
});
