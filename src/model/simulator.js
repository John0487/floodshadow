import {
  random,
  normal,
  poisson,
  sigmoid,
  logit,
  clamp,
  graph,
  smooth,
} from "./math.js";
export const SCENARIOS = [
  {
    id: 42,
    label: "Uneven reporting",
    rain: 95,
    coverage: 30,
    disparity: 70,
    falseRate: 0.1,
    missingRate: 0.06,
    coupling: 1.0,
  },
  {
    id: 108,
    label: "Widespread observation",
    rain: 75,
    coverage: 75,
    disparity: 15,
    falseRate: 0.06,
    missingRate: 0.03,
    coupling: 0.8,
  },
  {
    id: 257,
    label: "Limited visibility",
    rain: 125,
    coverage: 12,
    disparity: 85,
    falseRate: 0.12,
    missingRate: 0.1,
    coupling: 1.2,
  },
];
export function simulate(features, options = {}) {
  const cfg = {
    seed: 42,
    rain: 95,
    coverage: 30,
    disparity: 70,
    falseRate: 0.1,
    missingRate: 0.06,
    coupling: 1,
    ...options,
  };
  const rows = features.map((f) => f.properties),
    edges = graph(rows),
    n = rows.length;
  // Independent streams: changing coverage/missingness never changes hidden incident truth.
  const physical = random(cfg.seed),
    reporting = random(cfg.seed + 713),
    missing = random(cfg.seed + 9123);
  const wet = smooth(
      rows.map(() => normal(physical)),
      edges,
      2,
      0.7,
    ),
    cover = smooth(
      rows.map(() => normal(reporting)),
      edges,
      4,
      0.85,
    );
  const rain = rows.map((s, i) =>
    Math.max(0, cfg.rain * (0.9 + 0.14 * wet[i] + 0.1 * normal(physical))),
  );
  const h = rows.map(
    (s, i) =>
      -0.65 +
      (cfg.rainEffect ?? 1.1) * (rain[i] / 140 - 0.5) +
      (cfg.historyEffect ?? 1.5) * ((s.susceptibility ?? 0.3) - 0.3) +
      0.35 * wet[i],
  );
  const f = rows.map(() => (physical() < 0.5 ? 1 : 0));
  // Ising simulator; inference deliberately uses a different latent-Gaussian model.
  for (let pass = 0; pass < 160; pass++)
    for (let i = 0; i < n; i++) {
      const spatial = edges[i].reduce(
        (sum, j) =>
          sum +
          (2 * f[j] - 1) /
            Math.sqrt(Math.max(1, edges[i].length * edges[j].length)),
        0,
      );
      f[i] = physical() < sigmoid(h[i] + cfg.coupling * spatial) ? 1 : 0;
    }
  const truth = [],
    observed = [];
  rows.forEach((s, i) => {
    const q =
      cfg.coverage <= 0
        ? 0
        : sigmoid(
            logit(clamp(cfg.coverage / 100, 0.001, 0.99)) +
              (cfg.disparity / 100) * 3.2 * cover[i],
          );
    const trueReports = f[i]
      ? poisson(-Math.log(1 - Math.min(0.995, q)), reporting)
      : 0;
    const falseReports = poisson(Math.max(0, cfg.falseRate), reporting);
    const reports = trueReports + falseReports;
    truth.push({
      id: s.id,
      affected: !!f[i],
      reportingProbability: q,
      reports,
      trueReports,
      falseReports,
      rainfall: rain[i],
    });
    observed.push({
      ...s,
      rainfall:
        missing() < cfg.missingRate ? null : Math.round(rain[i] * 10) / 10,
      reports: missing() < cfg.missingRate ? null : reports,
      susceptibility: missing() < cfg.missingRate / 2 ? null : s.susceptibility,
      inspectionCost: Number.isFinite(s.inspectionCost) ? s.inspectionCost : 1,
      dataKind: "synthetic observations",
      simulationSeed: cfg.seed,
    });
  });
  return { observed, truth, configuration: cfg };
}
