import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { simulate, infer } from "./engine.js";
test("Evidence Passport and comparison integrate with real snapshot without source-mode inference", async () => {
  const server = await createServer({
    cacheDir: "node_modules/.vite-test",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });
  try {
    const { default: Passport } = await server.ssrLoadModule(
      "/src/components/EvidencePassport.jsx",
    );
    const { default: Comparison } = await server.ssrLoadModule(
      "/src/components/Comparison.jsx",
    );
    const geo = JSON.parse(
      readFileSync(new URL("../public/data/sectors.geojson", import.meta.url)),
    );
    const experiment = simulate(geo.features);
    const posterior = infer(experiment.observed, {}, { particles: 256 });
    const session = { verified: {}, queue: [], log: [] };
    const base = {
      sector: posterior.rows[0],
      rows: posterior.rows,
      sources: { retrieved: "2026-10-25" },
      session,
      diagnostics: posterior.diagnostics,
      onSelect: () => {},
      onQueue: () => {},
      onVerify: () => {},
      onSources: () => {},
    };
    const source = renderToStaticMarkup(
      React.createElement(Passport, {
        ...base,
        mode: "sources",
        sector: {
          ...geo.features[0].properties,
          reports: null,
          rainfall: null,
          score: null,
          probability: null,
        },
      }),
    );
    assert.match(
      source,
      /No affected probability or verification priority is computed/,
    );
    assert.doesNotMatch(source, /Inspect experimental sector/);
    assert.doesNotMatch(source, /Inferred affected probability/);
    const interactive = renderToStaticMarkup(
      React.createElement(Passport, { ...base, mode: "experiment" }),
    );
    assert.match(interactive, /90% conditional credible interval/);
    assert.match(interactive, /Inspect experimental sector/);
    assert.match(interactive, /P\(report/);
    const comparison = renderToStaticMarkup(
      React.createElement(Comparison, {
        features: geo.features,
        experiment,
        k: 5,
        params: { seed: 42 },
        onSelect: () => {},
      }),
    );
    for (const name of [
      "Random",
      "Report count",
      "Historical footprint",
      "Original heuristic",
      "Spatial occupancy model",
    ])
      assert.ok(comparison.includes(name));
  } finally {
    await server.close();
  }
});
