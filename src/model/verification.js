import { MODEL_VERSION } from "./probabilistic.js";
export function addVerification(
  session,
  sector,
  result,
  {
    note = "",
    observer = "Demo operator",
    origin = "manual-demo",
    episodeId = null,
    time = new Date().toISOString(),
    before = [],
    after = [],
    diagnostics = null,
  } = {},
) {
  if (!["affected", "unaffected"].includes(result))
    throw Error("Verification must be positive or negative");
  if (!["manual-demo", "synthetic-oracle"].includes(origin))
    throw Error("Unsupported verification source");
  const changes = after
    .map((s) => {
      const old = before.find((b) => b.id === s.id);
      return old && old.probability != null
        ? {
            id: s.id,
            name: s.name,
            before: old.probability,
            after: s.probability,
            delta: s.probability - old.probability,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const entry = {
    verificationId: `${sector.id}:${time}:${(session.log || []).length}`,
    id: sector.id,
    name: sector.name,
    result,
    note: note.trim().slice(0, 500),
    observer: observer.trim().slice(0, 100) || "Demo operator",
    origin,
    episodeId,
    time,
    modelVersion: MODEL_VERSION,
    supersedes: session.verified?.[sector.id]?.verificationId || null,
    changes,
    diagnostics,
  };
  return {
    ...session,
    verified: { ...session.verified, [sector.id]: entry },
    queue: (session.queue || []).filter((id) => id !== sector.id),
    log: [entry, ...(session.log || [])],
  };
}
export function sanitizeRecords(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (
      !value ||
      typeof value !== "object" ||
      !Array.isArray(value.queue) ||
      !Array.isArray(value.log) ||
      !value.verified ||
      typeof value.verified !== "object"
    )
      continue;
    out[key] = {
      queue: [...new Set(value.queue.filter(Number.isFinite))],
      log: value.log.filter(
        (e) =>
          e &&
          ["affected", "unaffected"].includes(e.result) &&
          Number.isFinite(e.id),
      ),
      verified: Object.fromEntries(
        Object.entries(value.verified).filter(
          ([, e]) =>
            e &&
            ["affected", "unaffected"].includes(e.result) &&
            Number.isFinite(e.id),
        ),
      ),
    };
  }
  return out;
}
