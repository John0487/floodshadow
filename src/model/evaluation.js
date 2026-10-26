import { random, clamp } from "./math.js";
import { simulate } from "./simulator.js";
import { infer, recommend } from "./probabilistic.js";
import { rank as originalRank } from "./legacy.js";
export const METHODS = ["random", "reports", "history", "original", "model"];
export const LABELS = {
  random: "Random",
  reports: "Report count",
  history: "Historical footprint",
  original: "Original heuristic",
  model: "Spatial occupancy model",
};
export function pool(rows, target = "all", verified = {}) {
  return rows.filter(
    (s) => !verified[s.id] && (target !== "hidden" || s.reports === 0),
  );
}
export function selectMethod(
  method,
  observed,
  posterior,
  k,
  { target = "all", seed = 1, verified = {} } = {},
) {
  const candidates = pool(observed, target, verified),
    ids = new Set(candidates.map((s) => s.id));
  const rng = random(seed);
  const tie = new Map(observed.map((s) => [s.id, rng()]));
  const fallback = (a, b) => tie.get(a.id) - tie.get(b.id);
  let ranked;
  if (method === "model") ranked = recommend(posterior.rows, { target });
  else if (method === "original")
    ranked = originalRank(
      observed.map((s) => ({
        ...s,
        reports: s.reports ?? 0,
        rainfall: s.rainfall ?? 0,
        susceptibility: s.susceptibility ?? 0,
      })),
      verified,
    );
  else
    ranked = [...candidates].sort(
      method === "random"
        ? fallback
        : method === "reports"
          ? (a, b) => (b.reports ?? -1) - (a.reports ?? -1) || fallback(a, b)
          : (a, b) =>
              (b.susceptibility ?? -1) - (a.susceptibility ?? -1) ||
              fallback(a, b),
    );
  return ranked.filter((s) => ids.has(s.id)).slice(0, k);
}
export function evaluate(
  selection,
  truth,
  k = selection.length,
  { candidateIds = null, exclude = [] } = {},
) {
  const selected = [
    ...new Map(selection.slice(0, k).map((s) => [s.id, s])).values(),
  ];
  const labels = new Map(truth.map((t) => [t.id, t]));
  const omitted = new Set(exclude);
  const affected = truth.filter((t) => t.affected && !omitted.has(t.id)),
    hidden = affected.filter((t) => t.reports === 0);
  const hits = selected.filter((s) => labels.get(s.id)?.affected).length;
  const hiddenHits = selected.filter(
    (s) => labels.get(s.id)?.affected && labels.get(s.id)?.reports === 0,
  ).length;
  const eligibleAffected = candidateIds
    ? affected.filter((t) => candidateIds.has(t.id)).length
    : affected.length;
  return {
    selected: selected.length,
    hits,
    precision: selected.length ? hits / selected.length : null,
    recall: affected.length ? hits / affected.length : null,
    hidden: hiddenHits,
    hiddenRecall: hidden.length ? hiddenHits / hidden.length : null,
    candidateRecall: eligibleAffected ? hits / eligibleAffected : null,
    cost: selected.reduce((sum, s) => sum + (s.inspectionCost ?? 1), 0),
    utility: selected.length
      ? hits / selected.reduce((sum, s) => sum + (s.inspectionCost ?? 1), 0)
      : null,
    clusters: new Set(selected.map((s) => s.district)).size,
  };
}
function mean(values) {
  const usable = values.filter((v) => v != null && Number.isFinite(v));
  return usable.length
    ? usable.reduce((a, b) => a + b, 0) / usable.length
    : null;
}
export function bootstrap(values, { seed = 817, resamples = 600 } = {}) {
  const usable = values.filter((v) => v != null && Number.isFinite(v));
  if (!usable.length) return { mean: null, lo: null, hi: null, n: 0 };
  const rng = random(seed),
    draws = [];
  for (let b = 0; b < resamples; b++) {
    let total = 0;
    for (let i = 0; i < usable.length; i++)
      total += usable[Math.floor(rng() * usable.length)];
    draws.push(total / usable.length);
  }
  draws.sort((a, b) => a - b);
  return {
    mean: mean(usable),
    lo: draws[Math.floor(0.025 * resamples)],
    hi: draws[Math.floor(0.975 * resamples)],
    n: usable.length,
  };
}
export function compareEpisode(
  features,
  params,
  k = 5,
  { particles = 2048, seed = 1000 } = {},
) {
  const experiment = simulate(features, { ...params, seed }),
    posterior = infer(experiment.observed, {}, { particles, intervals: false });
  const pools = {};
  for (const target of ["all", "hidden"]) {
    const candidateIds = new Set(
      pool(experiment.observed, target).map((s) => s.id),
    );
    pools[target] = {
      candidates: candidateIds.size,
      methods: Object.fromEntries(
        METHODS.map((method) => {
          const selection = selectMethod(
            method,
            experiment.observed,
            posterior,
            k,
            { target, seed: seed + 778 },
          );
          return [
            method,
            {
              ...evaluate(selection, experiment.truth, k, { candidateIds }),
              ids: selection.map((s) => s.id),
            },
          ];
        }),
      ),
    };
  }
  return { ...experiment, posterior, pools };
}
export function runBenchmark(
  features,
  params,
  k = 5,
  runs = 100,
  { startSeed = 20000, particles = 1024 } = {},
) {
  const episodes = [],
    bins = Array.from({ length: 10 }, () => ({ n: 0, p: 0, y: 0 }));
  let brier = 0,
    total = 0,
    lowEss = 0;
  for (let i = 0; i < runs; i++) {
    const e = compareEpisode(features, params, k, {
      particles,
      seed: startSeed + i,
    });
    episodes.push(e);
    if (e.posterior.diagnostics.warning) lowEss++;
    for (const s of e.posterior.rows) {
      const y = +e.truth.find((t) => t.id === s.id).affected;
      brier += (s.probability - y) ** 2;
      total++;
      const b = bins[Math.min(9, Math.floor(s.probability * 10))];
      b.n++;
      b.p += s.probability;
      b.y += y;
    }
  }
  const pools = {};
  for (const target of ["all", "hidden"]) {
    const methods = {};
    for (const method of METHODS) {
      methods[method] = Object.fromEntries(
        [
          "hits",
          "hidden",
          "precision",
          "recall",
          "hiddenRecall",
          "candidateRecall",
          "utility",
        ].map((metric) => [
          metric,
          bootstrap(
            episodes.map((e) => e.pools[target].methods[method][metric]),
          ),
        ]),
      );
    }
    const paired = Object.fromEntries(
      METHODS.filter((m) => m !== "model").map((method) => [
        method,
        {
          hidden: bootstrap(
            episodes.map(
              (e) =>
                e.pools[target].methods.model.hidden -
                e.pools[target].methods[method].hidden,
            ),
          ),
          hits: bootstrap(
            episodes.map(
              (e) =>
                e.pools[target].methods.model.hits -
                e.pools[target].methods[method].hits,
            ),
          ),
        },
      ]),
    );
    pools[target] = {
      methods,
      paired,
      meanCandidates: mean(episodes.map((e) => e.pools[target].candidates)),
    };
  }
  return {
    runs,
    startSeed,
    particles,
    k,
    pools,
    calibration: {
      brier: total ? brier / total : null,
      bins: bins.map((b) => ({
        n: b.n,
        predicted: b.n ? b.p / b.n : null,
        observed: b.n ? b.y / b.n : null,
      })),
      limitation:
        "Synthetic held-out diagnostics only; not evidence of local calibration.",
    },
    diagnostics: {
      lowEssEpisodes: lowEss,
      meanEss: mean(episodes.map((e) => e.posterior.diagnostics.ess)),
    },
  };
}
export function sequentialExperiment(
  features,
  params,
  { seed = 70000, k = 5, strategy = "discovery", particles = 2048 } = {},
) {
  const { observed, truth } = simulate(features, { ...params, seed }),
    verified = {},
    steps = [];
  for (let t = 0; t < k; t++) {
    const before = infer(observed, verified, { particles, intervals: false }),
      next = recommend(before.rows, { target: "hidden", strategy })[0];
    if (!next) break;
    const actual = truth.find((s) => s.id === next.id);
    verified[next.id] = {
      result: actual.affected ? "affected" : "unaffected",
      origin: "synthetic-oracle",
    };
    const after = infer(observed, verified, { particles, intervals: false });
    steps.push({
      id: next.id,
      affected: actual.affected,
      informationGain: next.informationGain,
      prior: next.probability,
      posterior: after.rows.find((s) => s.id === next.id).probability,
      meanAbsoluteOtherChange: mean(
        after.rows
          .filter((s) => s.id !== next.id)
          .map((s) =>
            Math.abs(
              s.probability -
                before.rows.find((b) => b.id === s.id).probability,
            ),
          ),
      ),
      ess: after.diagnostics.ess,
    });
  }
  return { steps, hits: steps.filter((s) => s.affected).length, verified };
}
export function sequentialBaseline(
  features,
  params,
  { method = "random", seed = 110000, k = 5 } = {},
) {
  const { observed, truth } = simulate(features, { ...params, seed }),
    verified = {},
    steps = [];
  for (let t = 0; t < k; t++) {
    const next = selectMethod(method, observed, null, 1, {
      target: "hidden",
      seed: seed + 778,
      verified,
    })[0];
    if (!next) break;
    const label = truth.find((s) => s.id === next.id);
    verified[next.id] = { result: label.affected ? "affected" : "unaffected" };
    steps.push({ id: next.id, affected: label.affected });
  }
  return { steps, hits: steps.filter((s) => s.affected).length };
}
