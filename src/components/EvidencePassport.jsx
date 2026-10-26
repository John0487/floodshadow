import React, { useState } from "react";
import {
  Eye,
  Layers,
  CloudRain,
  CheckCircle2,
  ArrowUpRight,
  ShieldCheck,
  Plus,
  Check,
  ChevronDown,
  FlaskConical,
  Activity,
} from "lucide-react";
const pct = (v) => (v == null ? "Unknown" : `${Math.round(v * 100)}%`);
export default function EvidencePassport({
  sector: s,
  rows,
  mode,
  sources,
  session,
  diagnostics,
  onSelect,
  onQueue,
  onVerify,
  onSources,
}) {
  const [note, setNote] = useState(""),
    [observer, setObserver] = useState("Demo operator");
  const experimental = mode === "experiment",
    entry = session.verified[s.id],
    latest = session.log[0];
  return (
    <section className="evidence-panel">
      <div className="evidence-top">
        <span>
          <ShieldCheck size={15} /> Evidence Passport
        </span>
        <span className="location-code">GYE</span>
      </div>
      <div className="evidence-intro">
        <div className="eyebrow">{s.district} · geographic label</div>
        <h2>{s.name}</h2>
        <p>INEC {s.code}</p>
        <span className={`status-chip ${entry ? "verified" : ""}`}>
          {entry ? <CheckCircle2 size={12} /> : <Eye size={12} />}{" "}
          {experimental
            ? entry
              ? `Experimental verification: ${entry.result}`
              : "Unverified experimental state"
            : "Historical sources only"}
        </span>
      </div>
      {experimental ? (
        <div className="posterior-block">
          <div className="posterior-title">
            {entry
              ? "Conditioned experimental state"
              : "Inferred affected probability"}{" "}
            <strong>{pct(s.probability)}</strong>
          </div>
          <div className="uncertainty-track">
            <i
              style={{
                left: pct(s.interval?.[0] ?? 0),
                width: pct((s.interval?.[1] ?? 1) - (s.interval?.[0] ?? 0)),
              }}
            />
            <b style={{ left: pct(s.probability) }} />
          </div>
          <p>
            90% conditional credible interval: {pct(s.interval?.[0])}–
            {pct(s.interval?.[1])}
          </p>
          <p className="source-small">
            Model-based experimental estimate. Not calibrated for Guayaquil.
          </p>
          <div className="detection-line">
            <span>P(report ≥ 1 | affected)</span>
            <strong>{pct(s.reportProbability)}</strong>
          </div>
          <small>
            90% interval {pct(s.reportInterval?.[0])}–
            {pct(s.reportInterval?.[1])}
          </small>
        </div>
      ) : (
        <div className="tradeoff">
          <p>
            No affected probability or verification priority is computed in
            Source explorer. A historical footprint does not establish a current
            incident.
          </p>
        </div>
      )}
      <h3 className="passport-heading">What we observe</h3>
      <div className="evidence-grid">
        <div>
          <CloudRain size={16} />
          <small>
            {experimental
              ? "Simulated rainfall"
              : "Regional model · 19 Oct 2026"}
          </small>
          <strong>
            {s.rainfall == null ? "Unknown" : s.rainfall.toFixed(1)}
            <span>{s.rainfall != null ? " mm" : ""}</span>
          </strong>
        </div>
        <div>
          <Layers size={16} />
          <small>Historical union overlap</small>
          <strong>{pct(s.susceptibility)}</strong>
        </div>
        <div>
          <Eye size={16} />
          <small>
            {experimental ? "Simulated report count" : "Current incident feed"}
          </small>
          <strong>{s.reports == null ? "Unknown" : s.reports}</strong>
        </div>
        <div>
          <Activity size={16} />
          <small>Adjacent census sectors</small>
          <strong>{s.neighbors.length}</strong>
        </div>
      </div>
      <div className="why">
        <h3>
          {experimental
            ? "What we infer and why"
            : "What these sources establish"}
        </h3>
        <p>
          {experimental
            ? `${s.reports == null ? "The report observation is missing." : s.reports === 0 ? "No report was observed; this is not a negative verification." : `${s.reports} report(s) were observed and may include false positives.`} The posterior combines a spatial occurrence prior, a separate reporting process and all recorded experimental verifications.`
            : "The map establishes census boundaries and historical footprint overlap. Rainfall is a regional model value shared by the pilot, not a local sensor measurement."}
        </p>
        {experimental && (
          <div className="evidence-equation">
            Uncertainty <strong>{s.entropy?.toFixed(2)} bits</strong>
            <span>·</span>Expected information{" "}
            <strong>{s.informationGain?.toFixed(3)} bits</strong>
          </div>
        )}
      </div>
      <div className="passport-unknown">
        <h3>What remains unknown</h3>
        <p>
          {experimental
            ? `Actual conditions in Guayaquil are not inferred by this experiment. ${s.missing?.length ? `Missing inputs: ${s.missing.join(", ")}. Missing covariates are integrated under declared priors.` : "The probability depends on the assumed spatial structure, reporting model and priors."}`
            : "Current incident reports and independent field observations are not connected. Historical event dates are kept separate from the 2026 weather episode."}
        </p>
        {experimental && (
          <p>
            Numerical ESS: {Math.round(diagnostics?.ess || 0)} /{" "}
            {diagnostics?.particles}.{" "}
            {diagnostics?.warning || "ESS alone does not prove model adequacy."}
          </p>
        )}
      </div>
      {experimental && !entry && (
        <p className="passport-rationale">
          Under the model, an affected sector here would produce at least one
          report with probability {pct(s.reportProbability)}. Its affected
          estimate is {pct(s.probability)}; this is evidence for comparing
          candidate checks, not confirmation of a flood.
        </p>
      )}
      <div className="neighbors">
        <h3>
          Adjacent sectors <span>{s.neighbors.length}</span>
        </h3>
        <div>
          {s.neighbors.map((id) => {
            const n = rows.find((s) => s.id === id);
            return (
              n && (
                <button key={id} onClick={() => onSelect(id)}>
                  {n.name}
                  <ArrowUpRight size={11} />
                </button>
              )
            );
          })}
        </div>
      </div>
      {experimental && (
        <div className="verification">
          <h3>Active Verification</h3>
          <button
            className={`primary wide ${session.queue.includes(s.id) ? "queued" : ""}`}
            disabled={!!entry}
            onClick={() => onQueue(s.id)}
          >
            {session.queue.includes(s.id) ? (
              <Check size={15} />
            ) : (
              <Plus size={15} />
            )}{" "}
            {session.queue.includes(s.id)
              ? "In your verification plan"
              : "Plan a verification"}
          </button>
          <button
            className="secondary wide oracle-button"
            disabled={!!entry}
            onClick={() =>
              onVerify("oracle", {
                note: "Independent experimental outcome revealed by the simulator",
                observer: "Simulation oracle",
                origin: "synthetic-oracle",
              })
            }
          >
            <FlaskConical size={14} /> Inspect experimental sector
          </button>
          <details>
            <summary>
              Record a manual demo observation
              <ChevronDown size={13} />
            </summary>
            <label className="verification-observer">
              Observer
              <input
                aria-label="Verification observer"
                value={observer}
                maxLength={100}
                onChange={(e) => setObserver(e.target.value)}
              />
            </label>
            <textarea
              aria-label="Verification evidence note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Evidence note or reason for correction"
              maxLength={500}
            />
            <div className="verify-options">
              <button
                onClick={() => {
                  onVerify("affected", {
                    note,
                    observer,
                    origin: "manual-demo",
                  });
                  setNote("");
                }}
              >
                Affected
              </button>
              <button
                onClick={() => {
                  onVerify("unaffected", {
                    note,
                    observer,
                    origin: "manual-demo",
                  });
                  setNote("");
                }}
              >
                Unaffected
              </button>
            </div>
            <p>
              Both results update the posterior. Field checks are assumed exact
              within this experiment. A correction supersedes the current entry
              and remains in the audit log.
            </p>
          </details>
        </div>
      )}
      {entry && (
        <div className="passport-record">
          <h3>Latest verification for this sector</h3>
          <p>
            {entry.result} · {entry.origin || "legacy manual demo"}
            <br />
            {entry.observer || "Observer not recorded"} · {entry.time}
            <br />
            {entry.note || "No evidence note"}
          </p>
        </div>
      )}
      {experimental && latest?.changes && (
        <div className="update-diff">
          <h3>After the last verification</h3>
          <p>
            {latest.name}: {latest.result}. Changes elsewhere:
          </p>
          {latest.changes
            .filter((c) => c.id !== latest.id)
            .slice(0, 3)
            .map((c) => (
              <button key={c.id} onClick={() => onSelect(c.id)}>
                <span>{c.name}</span>
                <b>
                  {pct(c.before)} → {pct(c.after)}
                </b>
              </button>
            ))}
        </div>
      )}
      <details className="passport-provenance">
        <summary>Sector provenance and assumptions</summary>
        <p>
          Geometry: INEC 2022, code {s.code}. Historical area: union of
          municipal polygons. Snapshot: {sources.retrieved}. Display names and
          pilot halves are internal geographic labels.
        </p>
        <p>
          <a href={sources.census?.url} target="_blank" rel="noreferrer">
            INEC geometry source
          </a>
          <br />
          <a href={sources.flood?.url} target="_blank" rel="noreferrer">
            Municipal historical footprint source
          </a>
        </p>
        {experimental && (
          <p>
            Simulated observation seed: {s.simulationSeed}. Current real-world
            incident status: unknown.
          </p>
        )}
        <p>
          {experimental
            ? "Rainfall and report observations: seeded simulator v0.3, separate from hidden labels. Posterior: spatial-occupancy-poisson-1. No demographic reporting proxy."
            : "Weather: ECMWF IFS through Open-Meteo. Historical events: Gestión de Riesgos, dates retained in registry."}
        </p>
      </details>
      <button className="source-link" onClick={onSources}>
        <ShieldCheck size={13} /> Source registry & full method
        <ArrowUpRight size={13} />
      </button>
    </section>
  );
}
