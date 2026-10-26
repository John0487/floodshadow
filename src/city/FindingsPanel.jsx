import React, { useState } from "react";
import { Eye, CheckCircle2, FileText, Info, Clock } from "lucide-react";
import { localDate } from "./format.js";
export default function FindingsPanel({ alerts, onArea, onEvidence, history }) {
  const [filter, setFilter] = useState("All"),
    [expanded, setExpanded] = useState(false);
  const shown = alerts.filter(
    (a) =>
      a.type !== "No Added Watch" && (filter === "All" || a.type === filter),
  );
  return (
    <section className="findings-panel">
      <div className="findings-heading">
        <h2>Area Alerts & Findings</h2>
        <button onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : "See all findings"}
        </button>
      </div>
      <p>
        Informational findings for the selected storm. A published report and a
        reviewed field check are different kinds of evidence.
      </p>
      <div className="finding-filters">
        {[
          "All",
          "Preventive Watch",
          "Confirmed Impact",
          "Documented Impact",
          "Verification Needed",
          "Data Unavailable",
        ].map((t) => (
          <button
            key={t}
            aria-pressed={filter === t}
            onClick={() => setFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="finding-cards">
        {shown.slice(0, expanded ? 100 : 4).map((a) => {
          const Icon =
            a.type === "Confirmed Impact"
              ? CheckCircle2
              : a.type === "Documented Impact"
                ? FileText
                : a.type === "Data Unavailable"
                  ? Info
                  : Eye;
          const trail = history?.filter((h) => h.id === a.id) ?? [];
          return (
            <article
              className={
                "finding-card " + a.type.toLowerCase().replaceAll(" ", "-")
              }
              key={a.id}
            >
              <span>
                <Icon size={16} />
                {a.type}
              </span>
              <h3>{a.areaName}</h3>
              <p>{a.reason}</p>
              <small>
                {localDate(a.observedAt)} · {a.timeMeaning}
              </small>
              <small>{a.certainty}</small>
              <div>
                <button onClick={() => onArea(a.areaId)}>View Area</button>
                {a.source && (
                  <a href={a.source} target="_blank" rel="noreferrer">
                    View Evidence
                  </a>
                )}
              </div>
              {trail.length > 0 && (
                <details>
                  <summary>
                    <Clock size={12} /> Saved history · {trail.length}{" "}
                    version(s)
                  </summary>
                  {trail.map((h) => (
                    <p key={h.revision}>
                      {localDate(h.recordedAt)} ·{" "}
                      {h.previousType ? `${h.previousType} → ` : ""}
                      {h.current.type}. {h.reason}
                    </p>
                  ))}
                </details>
              )}
            </article>
          );
        })}
      </div>
      {!shown.length && (
        <p>
          No findings of this type in the current selection. This does not
          establish that the area was unaffected.
        </p>
      )}
    </section>
  );
}
