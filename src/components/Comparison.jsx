import React, { useMemo, useState, useEffect } from "react";
import { FlaskConical, Eye, EyeOff, Info } from "lucide-react";
import { infer } from "../model/probabilistic.js";
import {
  METHODS,
  LABELS,
  selectMethod,
  evaluate,
  pool,
} from "../model/evaluation.js";
const pct = (n) => (n == null ? "N/A" : `${Math.round(n * 100)}%`),
  num = (n) => (n == null ? "N/A" : n.toFixed(2));
export default function Comparison({
  features,
  experiment,
  k,
  params,
  onSelect,
  initialTarget = "hidden",
}) {
  const [target, setTarget] = useState(initialTarget),
    [bench, setBench] = useState(null),
    [running, setRunning] = useState(false),
    [failure, setFailure] = useState(""),
    [reveal, setReveal] = useState(false);
  const posterior = useMemo(
    () => infer(experiment.observed, {}, { particles: 2048, intervals: false }),
    [experiment],
  );
  const candidates = new Set(
    pool(experiment.observed, target).map((s) => s.id),
  );
  const results = METHODS.map((method) => {
    const selection = selectMethod(method, experiment.observed, posterior, k, {
      target,
      seed: params.seed + 778,
    });
    return {
      method,
      selection,
      metrics: evaluate(selection, experiment.truth, k, {
        candidateIds: candidates,
      }),
    };
  });
  useEffect(() => {
    setBench(null);
    setRunning(false);
    worker.current?.terminate();
  }, [experiment, k]);
  useEffect(() => () => worker.current?.terminate(), []);
  const worker = React.useRef(null);
  function run() {
    setRunning(true);
    setFailure("");
    worker.current?.terminate();
    worker.current = new Worker(
      new URL("../model/evaluation.worker.js", import.meta.url),
      { type: "module" },
    );
    worker.current.onmessage = (e) => {
      if (e.data.error) setFailure(e.data.error);
      else setBench(e.data.result);
      setRunning(false);
      worker.current.terminate();
    };
    worker.current.onerror = () => {
      setFailure(
        "Evaluation worker failed. Run npm run evaluate to reproduce from the terminal.",
      );
      setRunning(false);
    };
    worker.current.postMessage({ features, params, k, runs: 100 });
  }
  return (
    <>
      <p className="modal-lead">
        Initial selection before verification. Same observations, capacity,
        candidate pool and truth for every method.
      </p>
      <div className="filter-tabs comparison-pools">
        <button
          className={target === "all" ? "active" : ""}
          onClick={() => setTarget("all")}
        >
          All unverified sectors
        </button>
        <button
          className={target === "hidden" ? "active" : ""}
          onClick={() => setTarget("hidden")}
        >
          Observed zero reports only
        </button>
        <span>
          {candidates.size} candidates · up to {Math.min(k, candidates.size)}{" "}
          checks
        </span>
      </div>
      <div className="table-scroll">
        <table className="evaluation-table">
          <thead>
            <tr>
              <th>Selection</th>
              <th>Affected</th>
              <th>Precision@K</th>
              <th>Recall@K</th>
              <th>Hidden found</th>
              <th>Hidden recall</th>
            </tr>
          </thead>
          <tbody>
            {results.map(({ method, metrics: m }) => (
              <tr
                key={method}
                className={method === "model" ? "model-result" : ""}
              >
                <th>{LABELS[method]}</th>
                <td>
                  {m.hits}/{m.selected}
                </td>
                <td>{pct(m.precision)}</td>
                <td>{pct(m.recall)}</td>
                <td>{m.hidden}</td>
                <td>{pct(m.hiddenRecall)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chosen-sectors">
        {results.at(-1).selection.map((s) => (
          <button key={s.id} onClick={() => onSelect(s.id)}>
            {s.name}
          </button>
        ))}
      </div>
      <div className="tradeoff">
        <Info size={18} />
        <p>
          Missing report observations are excluded from the zero-report pool.
          Count-based selection ties are randomized with a fixed seed.
          Empty-denominator metrics are N/A. Discovering hidden incidents and
          maximizing all affected detections are different objectives.
        </p>
      </div>
      <div className="benchmark-head">
        <div>
          <h3>Evaluate across 100 independent episodes</h3>
          <p>
            Seeds 20000–20099 · paired bootstrap intervals · current assumptions
          </p>
        </div>
        <button className="secondary" disabled={running} onClick={run}>
          <FlaskConical size={15} />
          {running ? "Evaluating…" : "Run 100 experiments"}
        </button>
      </div>
      {failure && <p role="alert">{failure}</p>}
      {bench && (
        <>
          <div className="table-scroll">
            <table className="evaluation-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Hidden mean [95% CI]</th>
                  <th>Affected mean</th>
                  <th>Precision mean</th>
                </tr>
              </thead>
              <tbody>
                {METHODS.map((m) => {
                  const s = bench.pools[target].methods[m];
                  return (
                    <tr key={m}>
                      <th>{LABELS[m]}</th>
                      <td>
                        {num(s.hidden.mean)} [{num(s.hidden.lo)},{" "}
                        {num(s.hidden.hi)}]
                      </td>
                      <td>{num(s.hits.mean)}</td>
                      <td>{pct(s.precision.mean)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="source-small">
            Model − random hidden discoveries:{" "}
            {num(bench.pools[target].paired.random.hidden.mean)} [
            {num(bench.pools[target].paired.random.hidden.lo)},{" "}
            {num(bench.pools[target].paired.random.hidden.hi)}].{" "}
            {bench.pools[target].paired.random.hidden.lo > 0
              ? "Positive paired interval: more discoveries than random in this synthetic setting."
              : bench.pools[target].paired.random.hidden.hi < 0
                ? "Negative paired interval: fewer discoveries than random in this synthetic setting."
                : "Interval includes zero: no clear improvement over random in these runs."}
          </p>
          <p className="source-small">
            Synthetic Brier score: {num(bench.calibration.brier)}. Mean ESS:{" "}
            {Math.round(bench.diagnostics.meanEss)}; low-ESS episodes:{" "}
            {bench.diagnostics.lowEssEpisodes}/{bench.runs}. These results do
            not establish calibration in Guayaquil.
          </p>
        </>
      )}
      <button className="text-button" onClick={() => setReveal(!reveal)}>
        {reveal ? <EyeOff size={15} /> : <Eye size={15} />}{" "}
        {reveal ? "Hide" : "Reveal"} experimental truth
      </button>
      {reveal && (
        <div className="truth-grid">
          {experiment.observed.map((s) => {
            const t = experiment.truth.find((t) => t.id === s.id);
            return (
              <span key={s.id} className={t.affected ? "truth-affected" : ""}>
                {s.name}
                <b>{t.affected ? "Affected" : "Unaffected"}</b>
                <small>
                  {s.reports ?? "Missing"} report observations ·{" "}
                  {t.falseReports} false reports
                </small>
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}
