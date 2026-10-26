// Real-event analysis: indices and evidence states, never calibrated flood probabilities.
export const CITY_MODEL_VERSION = "vigilancia-explicable-2.0";
export const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
export const percentage = (n, d) => (d > 0 ? (100 * n) / d : null);
export function resolveSectorCandidates(memberships) {
  if (!memberships.length || memberships.some((ids) => ids.length !== 1))
    return null;
  const ids = new Set(memberships.map((x) => x[0]));
  return ids.size === 1 ? [...ids][0] : null;
}
export function describeDocumentedComparison(assessments, impacts, eventId) {
  const ids = [
    ...new Set(
      impacts
        .filter((i) => i.eventId === eventId && i.sectorId)
        .map((i) => i.sectorId),
    ),
  ];
  const known = ids.filter((id) => isNumber(assessments[id]?.score));
  return {
    locatedSectors: ids.length,
    evaluable: known.length,
    highlighted: known.filter((id) => assessments[id].score >= 60).length,
    notHighlighted: known.filter((id) => assessments[id].score < 60).length,
    missingIndex: ids.length - known.length,
    warning:
      "Descriptive comparison using candidate points and a reconstructed index; it does not measure precision, recall or hits of an issued prediction.",
  };
}
export const FACTOR_INFO = {
  history: {
    label: "Area intersecting the historical footprint",
    normalization: "Sector fraction intersected by the geometric union; 0–1.",
  },
  rain: {
    label: "Relative forecast rainfall across sampled cells",
    normalization:
      "Rainfall total percentile across unique weather cells for the storm; 0–1.",
  },
};
export function haversine(a, b) {
  const r = Math.PI / 180;
  const x = (b[1] - a[1]) * r,
    y = (b[0] - a[0]) * r;
  const h =
    Math.sin(x / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(y / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function aggregateZones(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.zoneId))
      groups.set(item.zoneId, {
        sum: 0,
        area: 0,
        known: 0,
        count: 0,
        knownCount: 0,
      });
    const a = groups.get(item.zoneId);
    a.count++;
    a.area += item.areaKm2;
    if (isNumber(item.value)) {
      a.sum += item.value * item.areaKm2;
      a.known += item.areaKm2;
      a.knownCount++;
    }
  }
  for (const a of groups.values()) {
    a.complete = a.count === a.knownCount;
    a.value = a.complete && a.known > 0 ? a.sum / a.known : null;
    a.coverage = percentage(a.known, a.area);
  }
  return groups;
}
export function hourlySummary(hourly, start, end) {
  const times = hourly?.time ?? [],
    values = hourly?.precipitation ?? [];
  const seen = new Set(),
    series = [];
  let missing = 0;
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (t < start || t >= end) continue;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(t))
      throw Error("Source timestamps are not aligned to whole hours");
    if (seen.has(t)) throw Error("Duplicate weather source hours");
    seen.add(t);
    const v = values[i];
    if (!isNumber(v) || v < 0) {
      missing++;
      series.push({ time: t, mm: null });
    } else series.push({ time: t, mm: v });
  }
  const expected = Math.round(
    (Date.parse(end + "-05:00") - Date.parse(start + "-05:00")) / 3600000,
  );
  const complete = expected > 0 && series.length === expected && missing === 0;
  series.sort((a, b) => a.time.localeCompare(b.time));
  return {
    series,
    expected,
    available: series.filter((x) => x.mm !== null).length,
    complete,
    totalMm: complete ? series.reduce((s, x) => s + x.mm, 0) : null,
    maxHourlyMm: complete ? Math.max(...series.map((x) => x.mm)) : null,
  };
}
export function nearestWeather(center, grid, maxDistanceKm = 12) {
  let cell = null,
    distanceKm = Infinity;
  for (const c of grid ?? []) {
    const d = haversine(center, c.coordinates);
    if (d < distanceKm) {
      cell = c;
      distanceKm = d;
    }
  }
  return distanceKm <= maxDistanceKm
    ? { cell, distanceKm }
    : { cell: null, distanceKm: isNumber(distanceKm) ? distanceKm : null };
}
export function percentile(value, values) {
  const valid = values.filter(isNumber);
  if (!isNumber(value) || !valid.length) return null;
  if (valid.length === 1) return 0.5;
  const less = valid.filter((v) => v < value).length,
    equal = valid.filter((v) => v === value).length;
  return (less + 0.5 * equal) / valid.length;
}
export function vigilanceIndex({ historyOverlap, rainMm, rainPopulation }) {
  const history =
    isNumber(historyOverlap) && historyOverlap >= 0 && historyOverlap <= 1
      ? historyOverlap
      : null;
  const rainRank =
    !isNumber(rainMm) || rainMm < 0
      ? null
      : rainMm === 0
        ? 0
        : percentile(rainMm, rainPopulation);
  const factors = [
    {
      key: "history",
      label: "Area intersecting the historical footprint",
      value: history,
      weight: 0.5,
      normalization: "Sector fraction intersected by the geometric union; 0–1.",
    },
    {
      key: "rain",
      label: "Relative forecast rainfall across sampled cells",
      value: rainRank,
      weight: 0.5,
      normalization:
        "Rainfall total percentile across unique weather cells for the storm; 0–1.",
    },
  ];
  return {
    score:
      history !== null && rainRank !== null
        ? 100 * (0.5 * history + 0.5 * rainRank)
        : null,
    factors: factors.map((f) => ({
      ...f,
      contribution: f.value === null ? null : 100 * f.weight * f.value,
    })),
    coverage: factors.filter((f) => f.value !== null).length / 2,
    method: CITY_MODEL_VERSION,
    probability: false,
    limitation:
      "Multicriteria index with declared equal importance. Uncalibrated, not a probability. Hydraulics, tides and elevation are not included.",
  };
}
export function latestVerifications(records, eventId) {
  const map = new Map();
  for (const r of records ?? []) {
    if (
      r.eventId === eventId &&
      r.validation === "accepted" &&
      r.scope === "sector" &&
      (r.result !== "negative" || r.completeEpisodeCoverage === true) &&
      ["positive", "negative"].includes(r.result)
    )
      map.set(r.sectorId, r);
  }
  return map;
}
export function evidenceState(assessment, impacts, verification) {
  if (verification)
    return verification.result === "positive"
      ? "verified_positive"
      : "verified_negative";
  if (impacts.length) return "documented_point";
  if (isNumber(assessment?.score) && assessment.score >= 60) return "possible";
  return "insufficient";
}
export function shadowQueue(sectors, assessments, impacts, records, eventId) {
  const v = latestVerifications(records, eventId),
    reported = new Set(
      impacts
        .filter((x) => x.eventId === eventId && x.sectorId)
        .map((x) => x.sectorId),
    );
  return sectors
    .filter(
      (s) =>
        !v.has(s.id) &&
        !reported.has(s.id) &&
        isNumber(assessments[s.id]?.score),
    )
    .map((s) => ({
      sector: s,
      score: assessments[s.id].score,
      reason:
        "No localized point record or valid sector-wide verification. The index provides context; it does not confirm an impact.",
    }))
    .filter((x) => x.score >= 60)
    .sort(
      (a, b) => b.score - a.score || a.sector.id.localeCompare(b.sector.id),
    );
}
export function postEventMetrics(sectors, impacts, records, eventId) {
  const ids = new Set(sectors.map((s) => s.id)),
    valid = latestVerifications(records, eventId),
    verified = [...valid.values()].filter((v) => ids.has(v.sectorId));
  const positives = verified.filter((v) => v.result === "positive").length;
  const documented = new Set(
    impacts
      .filter((x) => x.eventId === eventId && ids.has(x.sectorId))
      .map((x) => x.sectorId),
  );
  const discovered = verified.filter(
    (v) =>
      v.result === "positive" &&
      v.initialReportCount === 0 &&
      v.initialReportCompleteness === true,
  ).length;
  return {
    total: sectors.length,
    verified: verified.length,
    positives,
    positiveAmongVerified: percentage(positives, verified.length),
    verificationCoverage: percentage(verified.length, sectors.length),
    documented: documented.size,
    documentedShare: percentage(documented.size, sectors.length),
    unreportedDiscoveries: discovered,
    unreportedDiscoveryEvaluable: verified.some(
      (v) => v.initialReportCompleteness === true,
    ),
    limitation:
      "Sectors with documented points are not entirely affected sectors. Absence of a record is not a negative verification.",
  };
}
export function coverageMetrics(sectors, assessments, observations) {
  const totalArea = sectors.reduce((s, x) => s + x.areaKm2, 0),
    usable = sectors.filter((s) => isNumber(assessments[s.id]?.forecastMm));
  return {
    forecastSectors: usable.length,
    forecastSectorShare: percentage(usable.length, sectors.length),
    forecastAreaShare: percentage(
      usable.reduce((s, x) => s + x.areaKm2, 0),
      totalArea,
    ),
    directStations: observations.length,
    definition:
      "Assignment of the sector representative point to a sampled cell within 12 km; neither instrumental coverage nor street-level resolution.",
  };
}
export function validateVerification(input, knownSectors, events) {
  if (
    !knownSectors.some((s) => s.id === input.sectorId) ||
    !events.some((e) => e.id === input.eventId)
  )
    throw Error("Unknown sector or storm");
  if (!["positive", "negative"].includes(input.result))
    throw Error("Invalid result");
  if (!input.observer?.trim() || !input.method?.trim() || !input.note?.trim())
    throw Error("Complete the observer, method and descriptive evidence");
  let u;
  try {
    u = new URL(input.evidenceUrl);
  } catch {
    throw Error("Add a verifiable evidence link");
  }
  if (!["https:", "http:"].includes(u.protocol))
    throw Error("The link must use http or https");
  if (!["point", "sector"].includes(input.scope))
    throw Error("Specify the inspection scope");
  if (input.scope === "sector" && !input.representative)
    throw Error("Confirm that the inspection represents the entire sector");
  if (!isNumber(Date.parse(input.observedAt)))
    throw Error("Invalid observation date");
  const e = events.find((e) => e.id === input.eventId);
  if (
    input.scope === "sector" &&
    input.result === "negative" &&
    (!input.completeEpisodeCoverage || Date.parse(e.end) > Date.now())
  )
    throw Error(
      "A sector-wide negative requires representative evidence for the entire completed window; a single visit is insufficient",
    );
  const observed = Date.parse(input.observedAt);
  if (
    observed < Date.parse(e.start) ||
    observed > Date.parse(e.end) ||
    observed > Date.now() + 300000
  )
    throw Error(
      "The observation must fall within the storm window and cannot be in the future",
    );
  return {
    ...input,
    observer: input.observer.trim(),
    note: input.note.trim(),
    validation: "pending",
    modelVersion: CITY_MODEL_VERSION,
  };
}
export function addRealVerification(
  records,
  input,
  sectors,
  events,
  now = new Date().toISOString(),
) {
  const valid = validateVerification(input, sectors, events);
  const previous = [...records]
    .reverse()
    .find(
      (v) =>
        v.eventId === input.eventId &&
        v.sectorId === input.sectorId &&
        v.scope === input.scope,
    );
  return [
    ...records,
    {
      ...valid,
      id: globalThis.crypto.randomUUID(),
      createdAt: now,
      supersedes: previous?.id ?? null,
      initialReportCount: null,
      initialReportCompleteness: false,
    },
  ];
}
export function acceptVerification(records, id, reviewer) {
  if (!reviewer?.trim()) throw Error("Specify who reviews the evidence");
  const target = records.find((v) => v.id === id);
  if (!target) throw Error("Unknown verification");
  return records.map((v) =>
    v.id === id
      ? {
          ...v,
          validation: "accepted",
          reviewer: reviewer.trim(),
          reviewedAt: new Date().toISOString(),
        }
      : v,
  );
}
export function comparePriorWithOutcomes(snapshot, sectors, records, event) {
  const valid = latestVerifications(records, event.id),
    eligible = [...valid.values()].filter(
      (v) =>
        isNumber(snapshot?.assessments?.[v.sectorId]?.score) &&
        sectors.some((s) => s.id === v.sectorId),
    );
  // A newly generated retrospective index is not a forecast issued by this system before the storm.
  const eligiblePrior = Boolean(
    snapshot?.issuedAt &&
    Date.parse(snapshot.issuedAt) < Date.parse(event.start) &&
    snapshot.kind === "prospective",
  );
  if (!eligiblePrior)
    return {
      evaluable: false,
      n: eligible.length,
      reason:
        "No FLOODSHADOW assessment was issued before this storm. The archived forecast is available, but the index reconstructed later does not count as a prior prediction hit.",
    };
  if (!eligible.length)
    return {
      evaluable: false,
      n: 0,
      reason: "There are no accepted sector-wide verifications to compare.",
    };
  let tp = 0,
    fp = 0,
    fn = 0,
    tn = 0;
  for (const v of eligible) {
    const predicted = snapshot.assessments[v.sectorId].score >= 60,
      actual = v.result === "positive";
    if (predicted && actual) tp++;
    else if (predicted) fp++;
    else if (actual) fn++;
    else tn++;
  }
  return {
    evaluable: true,
    n: eligible.length,
    tp,
    fp,
    fn,
    tn,
    precision: percentage(tp, tp + fp),
    recall: percentage(tp, tp + fn),
    warning:
      "Evaluation is limited to verified sectors and may have selection bias. The threshold of 60 is a vigilance convention.",
  };
}
