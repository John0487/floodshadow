import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  runBenchmark,
  sequentialExperiment,
  sequentialBaseline,
  bootstrap,
} from "../src/model/evaluation.js";
import { SCENARIOS } from "../src/model/simulator.js";
import { infer } from "../src/model/probabilistic.js";
import { simulate } from "../src/model/simulator.js";
const features = JSON.parse(
  await readFile(
    new URL("../public/data/sectors.geojson", import.meta.url),
    "utf8",
  ),
).features;
const runs = Number(process.env.FLOOD_EVAL_RUNS || 500),
  particles = 2048;
const cases = [
  ...SCENARIOS.map((s) => ({ ...s, split: "reference scenarios" })),
  {
    id: 901,
    label: "Held-out noisy and sparse",
    rain: 110,
    coverage: 45,
    disparity: 90,
    falseRate: 0.35,
    missingRate: 0.25,
    coupling: 0.35,
    split: "held-out generator configuration",
  },
  {
    id: 902,
    label: "Held-out weak rainfall / strong clustering",
    rain: 45,
    coverage: 55,
    disparity: 40,
    falseRate: 0.2,
    missingRate: 0.15,
    coupling: 1.8,
    split: "held-out generator configuration",
  },
];
await mkdir(new URL("../docs/", import.meta.url), { recursive: true });
// Manifest is written before experiments. No parameter search or outcome-based seed choice.
const manifest = {
  version: "0.3.0",
  runs,
  particles,
  k: 5,
  cases,
  seedStarts: cases.map((_, i) => 50000 + i * 10000),
  modelSeed: 64319,
  bootstrap:
    "600 paired resamples of independent episodes; percentile 95% intervals",
  metrics:
    "all affected and hidden incidents; all-sector and observed-zero-report pools",
  limitation:
    "Hand-specified priors; conditional posterior, not locally calibrated.",
};
await writeFile(
  new URL("../docs/evaluation-manifest.json", import.meta.url),
  JSON.stringify(manifest, null, 2),
);
const results = [];
for (let i = 0; i < cases.length; i++) {
  const cfg = cases[i];
  console.log(`Evaluating ${cfg.label}: ${runs} episodes…`);
  const result = runBenchmark(features, cfg, 5, runs, {
    startSeed: manifest.seedStarts[i],
    particles,
  });
  results.push({ configuration: cfg, ...result });
  await writeFile(
    new URL("../docs/evaluation-v03.json", import.meta.url),
    JSON.stringify({ manifest, results, complete: false }, null, 2),
  );
  console.log(
    JSON.stringify({
      scenario: cfg.label,
      hidden: Object.fromEntries(
        Object.entries(result.pools.hidden.methods).map(([m, s]) => [
          m,
          s.hidden,
        ]),
      ),
      pairedRandom: result.pools.hidden.paired.random.hidden,
      ess: result.diagnostics,
    }),
  );
}
const sequential = [];
for (const strategy of ["discovery", "information"]) {
  console.log(`Sequential validation: ${strategy}`);
  const episodes = Array.from({ length: 100 }, (_, i) =>
    sequentialExperiment(features, SCENARIOS[0], {
      seed: 110000 + i,
      k: 5,
      strategy,
      particles: 1024,
    }),
  );
  sequential.push({
    strategy,
    runs: 100,
    hiddenDiscoveries: bootstrap(episodes.map((e) => e.hits)),
    meanOtherChanges: bootstrap(
      episodes.map(
        (e) =>
          e.steps.reduce((sum, s) => sum + s.meanAbsoluteOtherChange, 0) /
          Math.max(1, e.steps.length),
      ),
    ),
    lowEssSteps: episodes.flatMap((e) => e.steps).filter((s) => s.ess < 30)
      .length,
  });
}
for (const method of ["random", "reports", "history", "original"]) {
  const episodes = Array.from({ length: 100 }, (_, i) =>
    sequentialBaseline(features, SCENARIOS[0], {
      method,
      seed: 110000 + i,
      k: 5,
    }),
  );
  sequential.push({
    strategy: method,
    runs: 100,
    hiddenDiscoveries: bootstrap(episodes.map((e) => e.hits)),
    note: "Same episode seeds, initially observed-zero-report candidates, no repeated inspections.",
  });
}
// Numerical and prior sensitivity on a fixed episode, distinct from evaluation seed ranges.
const e = simulate(features, { ...SCENARIOS[0], seed: 141414 });
const sensitivity = [
  { label: "default 2048", particles: 2048 },
  { label: "default 8192", particles: 8192 },
  {
    label: "lower occurrence prior",
    particles: 4096,
    occurrenceIntercept: -1.2,
  },
  {
    label: "higher occurrence prior",
    particles: 4096,
    occurrenceIntercept: 0.2,
  },
  { label: "lower assumed false rate", particles: 4096, falseMean: 0.03 },
  { label: "higher assumed false rate", particles: 4096, falseMean: 0.25 },
].map(({ label, ...options }) => {
  const p = infer(e.observed, {}, { ...options, intervals: false });
  return {
    label,
    diagnostics: p.diagnostics,
    meanAffected:
      p.rows.reduce((sum, s) => sum + s.probability, 0) / p.rows.length,
    probabilities: p.rows.map((s) => ({ id: s.id, p: s.probability })),
  };
});
await writeFile(
  new URL("../docs/evaluation-v03.json", import.meta.url),
  JSON.stringify(
    { manifest, results, sequential, sensitivity, complete: true },
    null,
    2,
  ),
);
console.log("Evaluation complete: docs/evaluation-v03.json");
await import("./stress-v03.mjs");
