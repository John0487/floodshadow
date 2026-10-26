import { readFile, writeFile } from "node:fs/promises";
import { runBenchmark } from "../src/model/evaluation.js";
const features = JSON.parse(
  await readFile(
    new URL("../public/data/sectors.geojson", import.meta.url),
    "utf8",
  ),
).features;
const runs = Number(process.env.FLOOD_STRESS_RUNS || 250);
const cases = [
  {
    label: "No false reports",
    rain: 95,
    coverage: 80,
    disparity: 15,
    falseRate: 0,
    missingRate: 0.05,
    coupling: 1,
  },
  {
    label: "Historical prior contradicted",
    rain: 90,
    coverage: 40,
    disparity: 75,
    falseRate: 0.1,
    missingRate: 0.12,
    coupling: 0.8,
    historyEffect: -1.5,
    rainEffect: 0.4,
  },
];
const manifest = {
  status:
    "Supplementary exploratory tests defined after inspecting the main suite; not confirmatory held-out claims.",
  runs,
  k: 5,
  particles: 2048,
  cases,
  seeds: [150000, 160000],
  model: "Unchanged v0.3 priors; no refitting to these conditions.",
};
await writeFile(
  new URL("../docs/stress-manifest.json", import.meta.url),
  JSON.stringify(manifest, null, 2),
);
const results = [];
for (let i = 0; i < cases.length; i++) {
  console.log(`Supplementary stress: ${cases[i].label}`);
  results.push({
    configuration: cases[i],
    ...runBenchmark(features, cases[i], 5, runs, {
      startSeed: manifest.seeds[i],
      particles: 2048,
    }),
  });
}
await writeFile(
  new URL("../docs/stress-v03.json", import.meta.url),
  JSON.stringify({ manifest, results, complete: true }, null, 2),
);
console.log("Supplementary stress complete");
