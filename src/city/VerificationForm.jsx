import React, { useState } from "react";
import { ClipboardCheck, ExternalLink } from "lucide-react";
import { addRealVerification, acceptVerification } from "./analysis.js";
import { localDate } from "./format.js";
export default function VerificationForm({
  sector,
  event,
  records,
  data,
  onRecords,
}) {
  const [form, setForm] = useState({
      result: "positive",
      scope: "point",
      observer: "",
      method: "Field inspection",
      note: "",
      evidenceUrl: "",
      observedAt: event.windowStart,
      representative: false,
      completeEpisodeCoverage: false,
    }),
    [error, setError] = useState("");
  const change = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const mine = records.filter(
    (r) => r.sectorId === sector.id && r.eventId === event.id,
  );
  function submit(e) {
    e.preventDefault();
    try {
      const next = addRealVerification(
        records,
        {
          ...form,
          eventId: event.id,
          sectorId: sector.id,
          observedAt: form.observedAt + ":00-05:00",
        },
        data.sectors,
        data.events,
      );
      onRecords(next);
      setError("");
      change("note", "");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="real-verification">
      <h3>
        <ClipboardCheck size={16} /> Add storm evidence
      </h3>
      <p>
        Only real records with provenance. Use the laboratory to experiment with
        synthetic outcomes.
      </p>
      <details>
        <summary>Record a verification</summary>
        <form onSubmit={submit}>
          <label>
            Result
            <select
              value={form.result}
              onChange={(e) => change("result", e.target.value)}
            >
              <option value="positive">Impact observed</option>
              <option value="negative">No impact observed</option>
            </select>
          </label>
          <label>
            Scope
            <select
              value={form.scope}
              onChange={(e) => change("scope", e.target.value)}
            >
              <option value="point">
                Inspected point, not the entire sector
              </option>
              <option value="sector">
                Entire sector, with representative evidence
              </option>
            </select>
          </label>
          <label>
            Observer
            <input
              required
              value={form.observer}
              onChange={(e) => change("observer", e.target.value)}
              placeholder="Verifier name or identifier"
            />
          </label>
          <label>
            Method
            <input
              required
              value={form.method}
              onChange={(e) => change("method", e.target.value)}
            />
          </label>
          <label>
            Observation time · Guayaquil time
            <input
              required
              type="datetime-local"
              value={form.observedAt}
              onChange={(e) => change("observedAt", e.target.value)}
            />
          </label>
          <label>
            Evidence and inspection scope
            <textarea
              required
              value={form.note}
              onChange={(e) => change("note", e.target.value)}
              placeholder="What was observed, where and with what limitations"
            />
          </label>
          <label>
            Evidence link
            <input
              required
              type="url"
              value={form.evidenceUrl}
              onChange={(e) => change("evidenceUrl", e.target.value)}
              placeholder="https://…"
            />
          </label>
          {form.scope === "sector" && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={form.representative}
                onChange={(e) => change("representative", e.target.checked)}
              />
              The evidence represents the sector during the storm, not just a
              point or a later visit.
            </label>
          )}
          {form.scope === "sector" && form.result === "negative" && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={form.completeEpisodeCoverage}
                onChange={(e) =>
                  change("completeEpisodeCoverage", e.target.checked)
                }
              />
              The evidence rules out impacts throughout the completed storm
              window; this is not a single or subsequent visit.
            </label>
          )}
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <button className="rain-primary" type="submit">
            Save for review
          </button>
        </form>
      </details>
      {mine.length > 0 && (
        <div className="verification-ledger">
          {mine.map((r) => (
            <article key={r.id}>
              <strong>
                {r.result === "positive"
                  ? "Impact observed"
                  : "No impact observed"}{" "}
                · {r.scope === "sector" ? "sector" : "point"}
              </strong>
              <small>
                {r.validation === "accepted"
                  ? "Accepted in this session"
                  : "Pending review"}{" "}
                · {r.observer} · {localDate(r.observedAt)}
              </small>
              <p>{r.note}</p>
              <a href={r.evidenceUrl} target="_blank" rel="noreferrer">
                Review evidence <ExternalLink size={11} />
              </a>
              {r.supersedes && (
                <small>
                  Corrects record {r.supersedes.slice(0, 8)}; history is
                  preserved.
                </small>
              )}
              {r.validation === "pending" && (
                <button
                  className="rain-secondary"
                  onClick={() => {
                    try {
                      onRecords(acceptVerification(records, r.id, r.observer));
                      setError("");
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Evidence reviewed: accept in session
                </button>
              )}
            </article>
          ))}
          <p>
            Acceptance is declared by the local operator; FLOODSHADOW does not
            authenticate the inspection. Sector percentages exclude point-level
            and pending observations.
          </p>
        </div>
      )}
    </section>
  );
}
