import {
  random,
  normal,
  sigmoid,
  clamp,
  graph,
  smooth,
  normalize,
  weightedQuantile,
  entropy,
} from "./math.js";
export const MODEL_VERSION = "spatial-occupancy-poisson-1";
export const DEFAULT_PRIOR = {
  seed: 64319,
  particles: 4096,
  occurrenceIntercept: -0.5,
  occurrenceSd: 0.8,
  rainMean: 1.1,
  rainSd: 0.45,
  historyMean: 1.5,
  historySd: 0.55,
  occurrenceSpatialSd: 1.5,
  reportIntercept: 0,
  reportSd: 1.05,
  reportSpatialSd: 2,
  falseMean: 0.1,
  falseLogSd: 0.65,
};
const cache = new Map();
function validate(rows) {
  const ids = new Set();
  for (const s of rows) {
    if (!Number.isFinite(s.id)) throw Error("Sector ID must be numeric");
    if (ids.has(s.id)) throw Error("Duplicate sector ID");
    ids.add(s.id);
    if (
      s.reports !== null &&
      s.reports !== undefined &&
      (!Number.isInteger(s.reports) || s.reports < 0 || s.reports > 100)
    )
      throw Error("Reports must be missing or integer counts 0–100");
    if (s.rainfall != null && (!Number.isFinite(s.rainfall) || s.rainfall < 0))
      throw Error("Invalid rainfall");
    if (
      s.susceptibility != null &&
      (!Number.isFinite(s.susceptibility) ||
        s.susceptibility < 0 ||
        s.susceptibility > 1)
    )
      throw Error("Historical overlap must be missing or in [0,1]");
    if (
      s.inspectionCost != null &&
      (!Number.isFinite(s.inspectionCost) || s.inspectionCost <= 0)
    )
      throw Error("Inspection cost must be positive");
  }
}
function proposal(rows, prior) {
  const key = JSON.stringify([
    rows.map((s) => [s.id, s.neighbors, s.rainfall, s.susceptibility]),
    prior,
  ]);
  if (cache.has(key)) return cache.get(key);
  const rng = random(prior.seed),
    edges = graph(rows),
    n = rows.length,
    m = prior.particles;
  const p = new Float64Array(n * m),
    q = new Float64Array(n * m),
    falseRate = new Float64Array(m);
  for (let a = 0; a < m; a++) {
    const intercept =
        prior.occurrenceIntercept + prior.occurrenceSd * normal(rng),
      rainCoef = prior.rainMean + prior.rainSd * normal(rng),
      historyCoef = prior.historyMean + prior.historySd * normal(rng),
      reportMean = prior.reportIntercept + prior.reportSd * normal(rng);
    const occurrenceField = smooth(
        rows.map(() => normal(rng)),
        edges,
        2,
        0.75,
      ),
      reportField = smooth(
        rows.map(() => normal(rng)),
        edges,
        3,
        0.8,
      );
    falseRate[a] =
      prior.falseMean *
      Math.exp(prior.falseLogSd * normal(rng) - prior.falseLogSd ** 2 / 2);
    for (let i = 0; i < n; i++) {
      // Missing covariates are integrated under explicit uniform priors, not set to zero.
      const rain =
        rows[i].rainfall == null ? rng() : clamp(rows[i].rainfall / 140);
      const hist =
        rows[i].susceptibility == null ? rng() : rows[i].susceptibility;
      p[a * n + i] = sigmoid(
        intercept +
          rainCoef * (rain - 0.5) +
          historyCoef * (hist - 0.3) +
          prior.occurrenceSpatialSd * occurrenceField[i],
      );
      q[a * n + i] = sigmoid(
        reportMean + prior.reportSpatialSd * reportField[i],
      );
    }
  }
  const bank = { p, q, falseRate, n, m };
  if (cache.size > 6) cache.delete(cache.keys().next().value);
  cache.set(key, bank);
  return bank;
}
export function infer(rows, verified = {}, options = {}) {
  validate(rows);
  const { intervals = true, ...settings } = options;
  const prior = { ...DEFAULT_PRIOR, ...settings };
  if (!rows.length)
    return {
      rows: [],
      diagnostics: { ess: 0, particles: 0, warning: "No sectors" },
    };
  if (
    !Number.isInteger(prior.particles) ||
    prior.particles < 16 ||
    prior.particles > 32768
  )
    throw Error("Particle count must be 16–32768");
  const { p, q, falseRate, n, m } = proposal(rows, prior),
    logWeights = new Float64Array(m),
    conditional = new Float64Array(n * m);
  for (let a = 0; a < m; a++)
    for (let i = 0; i < n; i++) {
      const at = a * n + i,
        prob = p[at],
        background = falseRate[a],
        lambda = background - Math.log1p(-q[at]),
        r = rows[i].reports;
      // The Poisson factorial cancels in both the state odds and particle weights.
      const l0 = r == null ? 0 : r * Math.log(background) - background,
        l1 = r == null ? 0 : r * Math.log(lambda) - lambda;
      const v = verified[rows[i].id]?.result;
      if (v === "affected" || v === "unaffected") {
        const positive = v === "affected";
        logWeights[a] += positive
          ? Math.log(prob) + l1
          : Math.log1p(-prob) + l0;
        conditional[at] = positive ? 1 : 0;
      } else {
        const u = Math.log(prob) + l1,
          w = Math.log1p(-prob) + l0,
          largest = Math.max(u, w),
          logEvidence =
            largest + Math.log(Math.exp(u - largest) + Math.exp(w - largest));
        logWeights[a] += logEvidence;
        conditional[at] = Math.exp(u - logEvidence);
      }
    }
  const weights = normalize(logWeights),
    ess = 1 / weights.reduce((s, w) => s + w * w, 0);
  const posterior = rows.map((s, i) => {
    const values = Float64Array.from(
        { length: m },
        (_, a) => conditional[a * n + i],
      ),
      detections = Float64Array.from(
        { length: m },
        (_, a) => 1 - (1 - q[a * n + i]) * Math.exp(-falseRate[a]),
      );
    const probability =
        verified[s.id]?.result === "affected"
          ? 1
          : verified[s.id]?.result === "unaffected"
            ? 0
            : clamp(values.reduce((sum, v, a) => sum + v * weights[a], 0)),
      reportProbability = clamp(
        detections.reduce((sum, v, a) => sum + v * weights[a], 0),
      );
    const epistemic = values.reduce(
      (sum, v, a) => sum + weights[a] * (v - probability) ** 2,
      0,
    );
    const informationGain = Math.max(
      0,
      entropy(probability) -
        values.reduce((sum, v, a) => sum + weights[a] * entropy(v), 0),
    );
    const checked = verified[s.id]?.result || null;
    const interval = intervals
      ? [
          weightedQuantile(values, weights, 0.05),
          weightedQuantile(values, weights, 0.95),
        ]
      : null;
    return {
      ...s,
      probability,
      reportProbability,
      reportInterval: intervals
        ? [
            weightedQuantile(detections, weights, 0.05),
            weightedQuantile(detections, weights, 0.95),
          ]
        : null,
      interval,
      epistemicSd: Math.sqrt(epistemic),
      entropy: entropy(probability),
      informationGain,
      verified: checked,
      score: Math.round(probability * 100),
      spatial: null,
      gap: null,
      context: null,
      diagnosticEss: ess,
      missing: ["reports", "rainfall", "susceptibility"].filter(
        (k) => s[k] == null,
      ),
      modelVersion: MODEL_VERSION,
    };
  });
  return {
    rows: posterior,
    diagnostics: {
      ess,
      particles: m,
      maxWeight: Math.max(...weights),
      warning:
        ess < Math.max(30, m * 0.01)
          ? "Low importance-sampling ESS: posterior approximation is unstable; inspect prior sensitivity."
          : null,
      modelVersion: MODEL_VERSION,
      prior,
      calibration:
        "Not calibrated on Guayaquil observations; intervals are conditional on the stated prior and model.",
    },
  };
}
export function recommend(
  rows,
  { target = "hidden", strategy = "discovery" } = {},
) {
  return rows
    .filter((s) => !s.verified && (target !== "hidden" || s.reports === 0))
    .map((s) => ({
      ...s,
      utility:
        (strategy === "information" ? s.informationGain : s.probability) /
        Math.max(0.1, s.inspectionCost ?? 1),
    }))
    .sort((a, b) => b.utility - a.utility || a.id - b.id);
}
