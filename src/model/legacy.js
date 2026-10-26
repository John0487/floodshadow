// Original v0.2 heuristic, retained unchanged for complete-data comparisons.
export function rank(observed, verified = {}) {
  const byId = new Map(observed.map((s) => [s.id, s]));
  return observed
    .map((s) => {
      const neighbors = s.neighbors.map((id) => byId.get(id)).filter(Boolean);
      const positive = neighbors.filter(
        (p) =>
          verified[p.id]?.result === "affected" ||
          (!verified[p.id] && p.reports > 0),
      ).length;
      const spatial = neighbors.length ? positive / neighbors.length : 0;
      const rain = Math.min(1, (s.rainfall ?? 0) / 140),
        sus = s.susceptibility;
      const gap = s.reports === null ? 1 : 1 - Math.min(1, s.reports / 6);
      const context = 0.45 * rain + 0.35 * sus + 0.2 * spatial;
      const score = Math.round(100 * context * (0.45 + 0.55 * gap));
      return {
        ...s,
        spatial,
        gap,
        context,
        score,
        verified: verified[s.id]?.result || null,
        contributions: {
          rain: 0.45 * rain,
          susceptibility: 0.35 * sus,
          neighbors: 0.2 * spatial,
        },
      };
    })
    .sort((a, b) => b.score - a.score || a.id - b.id);
}
export function eligible(rows) {
  return rows.filter((s) => !s.verified);
}
