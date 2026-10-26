import React from "react";
import { Info, ArrowRight, CheckCheck, RotateCcw } from "lucide-react";
const date = (s) =>
  s
    ? new Date(s).toLocaleString("en-GB", { timeZone: "America/Guayaquil" })
    : "Unknown";
export default function ScenarioLab({
  params,
  setParams,
  onExperiment,
  session,
  onReset,
}) {
  return (
    <>
      <p className="modal-lead">
        Explore how missing observations change the next decision. Incident data
        here is entirely synthetic.
      </p>
      <div className="lab-controls">
        {[
          [
            "rain",
            "Rainfall intensity",
            20,
            160,
            "mm",
            "Influences the synthetic incident process and contextual evidence.",
          ],
          [
            "coverage",
            "Baseline reporting",
            0,
            95,
            "%",
            "An experimental assumption, not an estimate of local reporting behavior.",
          ],
          [
            "disparity",
            "Reporting disparity",
            0,
            90,
            "%",
            "Spatially correlated coverage variation, independent of incident truth.",
          ],
          [
            "falseRate",
            "False-report intensity",
            0,
            0.5,
            "/ sector",
            "Poisson background intensity, including reports without incidents.",
          ],
          [
            "missingRate",
            "Missing observations",
            0,
            0.3,
            "fraction",
            "Missing reports are different from observed zeros.",
          ],
        ].map(([id, label, min, max, unit, description]) => (
          <label key={id}>
            <span>
              {label}
              <b>
                {params[id]} {unit}
              </b>
            </span>
            <input
              aria-label={label}
              type="range"
              min={min}
              max={max}
              step={max <= 1 ? 0.01 : 1}
              value={params[id]}
              onChange={(e) => {
                onExperiment();
                setParams({ ...params, [id]: +e.target.value });
              }}
            />
            <small>{description}</small>
          </label>
        ))}
      </div>
      <div className="lab-bottom">
        <label>
          Reproducible seed{" "}
          <input
            aria-label="Experiment seed"
            type="number"
            min="1"
            max="999999"
            value={params.seed}
            onChange={(e) =>
              setParams({
                ...params,
                seed: Math.max(1, Math.min(999999, +e.target.value || 1)),
              })
            }
          />
        </label>
        <button
          className="secondary"
          onClick={() => {
            onExperiment();
            setParams({ ...params, seed: params.seed + 1 });
          }}
        >
          New seed
          <ArrowRight size={15} />
        </button>
      </div>
      <div className="tradeoff">
        <Info size={18} />
        <p>
          The simulator and ranking share environmental inputs. This is a
          favorable experimental setting, not independent field validation.
          Changing parameters opens a separate local verification session.
        </p>
      </div>
      <h3>Local verification log</h3>
      <div className="log">
        {session.log.length ? (
          session.log.map((entry, i) => (
            <div key={i}>
              <CheckCheck size={15} />
              <span>
                <b>
                  {entry.name} · {entry.result}
                </b>
                <small>
                  {entry.note || "No evidence note supplied"} ·{" "}
                  {date(entry.time)}
                </small>
                <small>
                  {entry.observer || "Legacy observer"} ·{" "}
                  {entry.origin || "manual-demo"} ·{" "}
                  {entry.modelVersion || "legacy model"}
                  {entry.supersedes ? " · corrects an earlier entry" : ""}
                </small>
              </span>
            </div>
          ))
        ) : (
          <p>No field observations recorded for this experiment.</p>
        )}
      </div>
      <button className="text-button" onClick={onReset}>
        <RotateCcw size={14} />
        Clear this experiment’s local records
      </button>
    </>
  );
}
