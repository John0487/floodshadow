export const number = (v, d = 0) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      }).format(v);
export const pct = (v) =>
  v === null || v === undefined ? "Not evaluable" : number(v, 1) + " %";
export const localDate = (t) =>
  t
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Guayaquil",
      }).format(new Date(t))
    : "Not published";
// English display labels preserve the original source text in data and exports.
export const eventName = (event) =>
  event.status === "captured_forecast"
    ? "Captured forecast · next 72 hours"
    : event.id === "oct19"
      ? "October 19 rainfall"
      : "October 24–25 thunderstorms";
export const sectorName = (sector) =>
  sector.areaName
    ? `${sector.areaName} — Analysis area ${sector.id.slice(-6, -3)}-${sector.id.slice(-3)}`
    : `Census polygon ${sector.id}`;
export const parishName = (sector) =>
  sector.parishCode === "090150" ? "Guayaquil main parish" : sector.parishName;
export const infrastructureName = (id) =>
  ({
    48: "Stormwater pipes",
    8: "Runoff",
    46: "Properties at risk",
    55: "Rivers and estuaries",
  })[id] ?? "Municipal infrastructure";
export const sourceNote = (source) =>
  source.name === "INAMHI"
    ? "Portal consulted. No structured instrumental series or bulletin integrated."
    : "Satellite product distinct from station measurements. No product has been downloaded for these storms.";
export const TYPE_LABELS = {
  documented_flood: "Flooding documented by the source",
  water_accumulation: "Water accumulation",
  tree: "Fallen tree",
  landslide: "Landslide",
  infrastructure_fall: "Fallen pole or infrastructure",
};
export const STATE_LABELS = {
  verified_positive: "Verified sector-wide impact",
  verified_negative: "No impact following verification",
  documented_point: "Documented point record",
  possible: "Conditions to watch · unconfirmed",
  insufficient: "Insufficient information",
};
export const PHASES = {
  summary: {
    name: "Overview",
    title: "Where did rain and reports meet?",
    description:
      "One city, one storm. Explore the forecast, the documented impacts and the gaps in our knowledge.",
  },
  before: {
    name: "Before the Rain",
    title: "Where to focus attention.",
    description:
      "Explore an earlier weather model run and an explained territorial index. Priority is not a flood probability.",
  },
  during: {
    name: "During the Rain",
    title: "Track the rain. Understand the evidence.",
    description:
      "Explore hourly model estimates and documented records. A weather estimate does not replace a station measurement.",
  },
  after: {
    name: "After the Rain",
    title: "What the evidence tells us.",
    description:
      "Compare subsequent evidence with the archived forecast. What could not be verified remains unknown.",
  },
};
