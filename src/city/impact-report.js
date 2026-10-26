import { jsPDF } from "jspdf";
import { eventName, TYPE_LABELS } from "./format.js";
export function buildReportSections({
  event,
  rows,
  impacts,
  records,
  areas,
  alerts,
  snapshot,
}) {
  const values = rows.map((r) => r.assessment.modelMm).filter(Number.isFinite),
    forecasts = rows
      .map((r) => r.assessment.forecastMm)
      .filter(Number.isFinite);
  const latest = new Map();
  for (const r of records)
    if (
      r.eventId === event.id &&
      r.validation === "accepted" &&
      r.scope === "sector"
    )
      latest.set(r.sectorId, r);
  const selectedIds = new Set(rows.map((r) => r.sector.id));
  for (const id of latest.keys()) if (!selectedIds.has(id)) latest.delete(id);
  const range = (a) =>
    a.length
      ? `${Math.min(...a).toFixed(1)} to ${Math.max(...a).toFixed(1)} mm`
      : "Unavailable";
  const perArea = areas
    .filter((a) => a.sectorIds.some((id) => selectedIds.has(id)))
    .map(
      (a) =>
        `${a.name}: ${a.sectorIds.filter((id) => selectedIds.has(id)).length} smaller areas; ${impacts.filter((i) => a.sectorIds.includes(i.sectorId)).length} provisionally mapped records.`,
    );
  return [
    [
      "Event Overview",
      [
        `${eventName(event)}. Window: ${event.windowStart} to ${event.windowEnd}, UTC-5.`,
        `${rows.length} smaller areas in the selected geography. Prepared local evidence, not a live feed.`,
      ],
    ],
    [
      "Rainfall Conditions",
      [
        `Weather-model estimates: ${range(values)}. Expected rainfall: ${range(forecasts)}. Millimeters are rainfall accumulation, not floodwater depth.`,
        `${event.observations.length} published station totals are available for the episode; exact measurement windows and coordinates are not supplied. They are not assigned to every neighborhood.`,
      ],
    ],
    [
      "Documented Impacts",
      impacts.length
        ? impacts.map(
            (i) =>
              `${TYPE_LABELS[i.type] ?? "Reviewed observation"}: ${i.locationText ?? i.description}. Source: ${i.source}. ${i.sectorId ? "Provisional smaller-area assignment." : "Location unresolved."}`,
          )
        : [
            "No mapped records in this selection. Absence of reports is not a negative inspection.",
          ],
    ],
    [
      "Area-by-Area Findings",
      perArea.length
        ? perArea
        : ["No storm-specific assessment for this canton."],
    ],
    [
      "Forecast Comparison",
      [
        snapshot.kind === "prospective"
          ? "The preserved assessment predates its forecast window. Independent compatible observations are needed to evaluate it."
          : "The historical index was reconstructed after the storm and is not counted as a prior FLOODSHADOW prediction.",
        "Expected and later modeled totals are different products. Station windows are not sufficiently compatible for a rainfall accuracy claim.",
      ],
    ],
    [
      "Unverified Areas",
      [
        `${latest.size} of ${rows.length} smaller areas have an accepted whole-area check. ${[...latest.values()].filter((r) => r.result === "positive").length} of those checks record impacts. Empty denominators are not evaluable.`,
        ...alerts
          .filter(
            (a) =>
              a.type === "Verification Needed" || a.type === "Data Unavailable",
          )
          .map((a) => `${a.areaName}: ${a.type}. ${a.reason}`),
      ],
    ],
    [
      "Key Findings",
      [
        "No citywide impact percentage, damage estimate or calibrated flood probability is claimed. A point does not establish that a whole neighborhood flooded.",
        "The index is exploratory. Simulated scenarios never create real incident records.",
      ],
    ],
    [
      "Data Sources and Limitations",
      [
        `INEC 2022 census polygons; Guayaquil municipal nomenclature; ECMWF IFS via Open-Meteo; ESPOL published station totals; Ecuavisa attributed to Segura EP; documented susceptibility footprint. Forecast source: ${event.forecast.url}.`,
        "Municipal drainage geometry queries failed. Capacity, maintenance, terrain detail and tides are unavailable. Published locations can be incomplete or ambiguous. Operator review is not institutional authentication.",
        `Assessment: ${snapshot.id}. Method: ${snapshot.modelVersion}. Content checksum: ${snapshot.sha256}.`,
      ],
    ],
  ];
}
export function createImpactPDF(input) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = 22;
  const line = (text, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, 172);
    for (const s of lines) {
      if (y > 276) {
        pdf.addPage();
        y = 22;
      }
      pdf.text(s, 19, y);
      y += size * 0.47;
    }
    y += 3;
  };
  pdf.setFillColor("#153c54");
  pdf.rect(0, 0, 210, 8, "F");
  line("FLOODSHADOW", 21, true);
  line("Rainfall Impact Report", 15, true);
  line(eventName(input.event), 11);
  for (const [title, paragraphs] of buildReportSections(input)) {
    if (y > 250) {
      pdf.addPage();
      y = 22;
    }
    y += 4;
    pdf.setTextColor("#174b66");
    line(title, 13, true);
    pdf.setTextColor("#1e2d38");
    for (const text of paragraphs) line(text);
  }
  const count = pdf.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor("#526c7e");
    pdf.text(`3Jota | Local beta | ${i} / ${count}`, 19, 289);
  }
  return pdf;
}
export function saveImpactReport(input) {
  createImpactPDF(input).save(
    `floodshadow-${input.event.id}-impact-report.pdf`,
  );
}
