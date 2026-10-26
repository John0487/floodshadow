export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export const logit = (p) =>
  Math.log(clamp(p, 1e-8, 1 - 1e-8) / (1 - clamp(p, 1e-8, 1 - 1e-8)));
export function random(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function normal(rng) {
  return (
    Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) *
    Math.cos(2 * Math.PI * rng())
  );
}
export function poisson(lambda, rng) {
  if (lambda <= 0) return 0;
  const stop = Math.exp(-Math.min(lambda, 40));
  let p = 1,
    k = 0;
  do {
    k++;
    p *= rng();
  } while (p > stop && k < 100);
  return k - 1;
}
export function entropy(p) {
  return p <= 0 || p >= 1 ? 0 : -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}
export function normalize(logWeights) {
  const max = Math.max(...logWeights);
  const weights = Float64Array.from(logWeights, (x) => Math.exp(x - max));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || sum <= 0)
    throw Error("Posterior weights cannot be normalized");
  for (let i = 0; i < weights.length; i++) weights[i] /= sum;
  return weights;
}
export function weightedQuantile(values, weights, q) {
  const sorted = Array.from(values, (v, i) => [v, weights[i]]).sort(
    (a, b) => a[0] - b[0],
  );
  let mass = 0;
  for (const [v, w] of sorted) {
    mass += w;
    if (mass >= q) return v;
  }
  return sorted.at(-1)?.[0] ?? null;
}
export function graph(rows) {
  const ids = new Map(rows.map((s, i) => [s.id, i]));
  const edges = rows.map(() => new Set());
  rows.forEach((s, i) =>
    (s.neighbors || []).forEach((id) => {
      const j = ids.get(id);
      if (j !== undefined && j !== i) {
        edges[i].add(j);
        edges[j].add(i);
      }
    }),
  );
  return edges.map((s) => [...s].sort((a, b) => a - b));
}
// A finite linear transformation of independent Gaussians defines a proper spatial prior.
export function smooth(values, edges, passes = 3, strength = 0.8) {
  let v = values.slice();
  for (let t = 0; t < passes; t++)
    v = v.map((x, i) =>
      edges[i].length
        ? (1 - strength) * x +
          (strength * edges[i].reduce((sum, j) => sum + v[j], 0)) /
            edges[i].length
        : x,
    );
  return v;
}
