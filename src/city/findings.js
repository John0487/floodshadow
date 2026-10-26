import { latestVerifications, vigilanceIndex, isNumber } from "./analysis.js";
export const ALERT_VERSION = "area-findings-1";
export function buildAlerts({
  sectors,
  assessments,
  impacts,
  records,
  event,
  phase = "after",
  areas,
}) {
  const valid = latestVerifications(records, event.id),
    ids = new Set(sectors.map((s) => s.id));
  return areas
    .filter((a) => a.sectorIds.some((id) => ids.has(id)))
    .map((a) => {
      const local = a.sectorIds.filter((id) => ids.has(id)),
        evidence = impacts.filter((i) => local.includes(i.sectorId));
      const checks = local.map((id) => valid.get(id)).filter(Boolean),
        positive = checks.find((v) => v.result === "positive");
      const pointHistory = records.filter(
        (v) =>
          v.eventId === event.id &&
          v.validation === "accepted" &&
          v.scope === "point" &&
          local.includes(v.sectorId),
      );
      const pointLatest = new Map(pointHistory.map((v) => [v.sectorId, v]));
      const accepted =
        positive ??
        [...pointLatest.values()].find((v) => v.result === "positive");
      const scores = local.map((id) => assessments[id]?.score).filter(isNumber),
        high = scores.some((v) => v >= 60);
      let type =
        phase === "before"
          ? high
            ? "Preventive Watch"
            : scores.length
              ? "No Added Watch"
              : "Data Unavailable"
          : accepted
            ? "Confirmed Impact"
            : evidence.length
              ? "Documented Impact"
              : high
                ? "Verification Needed"
                : scores.length
                  ? "No Added Watch"
                  : "Data Unavailable";
      const before = phase === "before";
      const reason =
        type === "Confirmed Impact"
          ? "A reviewed check documents an impact. Its stated scope applies; it does not confirm flooding throughout this neighborhood."
          : type === "Documented Impact"
            ? "A published source reports an incident at a candidate location. Exact location and extent still need review."
            : type === "Preventive Watch"
              ? "Expected rainfall and the flood-prone land footprint suggest closer attention. No flood is confirmed."
              : type === "Verification Needed"
                ? "The available context suggests checking this area. There is not enough evidence to say what happened."
                : type === "Data Unavailable"
                  ? "Essential information is missing. This is not evidence that the area was safe."
                  : "The current rule adds no watch. Limited reporting means this is not a safety assessment.";
      return {
        id: `${event.id}:${a.id}:${before ? "before" : "after"}`,
        eventId: event.id,
        areaId: a.id,
        areaName: a.name,
        sectorId: accepted?.sectorId ?? evidence[0]?.sectorId ?? local[0],
        type,
        reason,
        methodVersion: ALERT_VERSION,
        scope: accepted?.scope ?? "point evidence or contextual area review",
        certainty: accepted
          ? "Accepted by the local operator"
          : evidence.length && !before
            ? "Published source; location provisional"
            : "Exploratory context, not calibrated",
        source:
          accepted?.evidenceUrl ??
          (!before ? evidence[0]?.source : null) ??
          event.forecast.url,
        evidenceIds: before
          ? []
          : accepted
            ? [accepted.id]
            : evidence.map((i) => i.id),
        observedAt: accepted?.observedAt ?? event.start,
        timeMeaning: accepted
          ? "Observation time"
          : "Storm window begins; individual incident time may be unknown",
        status: before
          ? "reconstructed_context"
          : accepted
            ? "operator_reviewed"
            : evidence.length
              ? "published_record"
              : "unverified",
      };
    });
}
export function appendAlertHistory(
  history,
  alerts,
  at = new Date().toISOString(),
) {
  const out = [...history],
    latest = new Map(history.map((x) => [x.id, x]));
  for (const a of alerts) {
    const previous = latest.get(a.id);
    if (previous && JSON.stringify(previous.current) === JSON.stringify(a))
      continue;
    const entry = {
      id: a.id,
      revision: (previous?.revision ?? 0) + 1,
      recordedAt: at,
      previousType: previous?.current.type ?? null,
      reason: previous
        ? "New evidence or source assessment changed this finding."
        : "Finding generated from the prepared evidence.",
      current: a,
    };
    out.push(entry);
    latest.set(a.id, entry);
  }
  return out;
}
export function scenarioRows(
  rows,
  event,
  { rain = 100, duration = 100, shift = 0, coverage = 100 },
) {
  const baseline = event.forecast.grid.map((c) => c.totalMm).filter(isNumber);
  const cellIds = event.forecast.grid.map((c) => c.id).sort();
  const keep = Math.ceil((cellIds.length * coverage) / 100);
  return rows.map((r) => {
    const cell = event.forecast.grid.find(
      (c) => c.id === r.assessment.forecastCellId,
    );
    const visible = cell && cellIds.indexOf(cell.id) < keep;
    const spatial = cell
      ? Math.max(0, 1 + ((cell.coordinates[1] > -2.2 ? 1 : -1) * shift) / 100)
      : 0;
    const mm =
      visible && isNumber(r.assessment.forecastMm)
        ? ((((r.assessment.forecastMm * rain) / 100) * duration) / 100) *
          spatial
        : null;
    const index = vigilanceIndex({
      historyOverlap: r.sector.historyOverlap,
      rainMm: mm,
      rainPopulation: baseline,
    });
    return {
      ...r,
      assessment: { ...r.assessment, ...index, forecastMm: mm },
      state: "insufficient",
      impacts: [],
      scenario: true,
    };
  });
}
