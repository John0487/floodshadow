import React, { useEffect, useMemo, useState } from "react";
import {
  Waves,
  Map,
  FlaskConical,
  Layers,
  ArrowUpRight,
  ChevronRight,
  Search,
  CloudRain,
  Download,
  SlidersHorizontal,
  Info,
  X,
  Check,
  CheckCircle2,
  HelpCircle,
  Compass,
  GitCompareArrows,
  MapPin,
  Target,
  BookOpen,
} from "lucide-react";
import MapView, { PRIORITY, color } from "./MapView.jsx";
import {
  SCENARIOS,
  simulate,
  infer,
  recommend,
  MODEL_VERSION,
} from "./engine.js";
import ScenarioLab from "./components/ScenarioLab.jsx";
import SourceRegistry from "./components/SourceRegistry.jsx";
import EvidencePassport from "./components/EvidencePassport.jsx";
import Comparison from "./components/Comparison.jsx";
import { fetchDataset, rainfallTotal } from "./data/validation.js";
import { addVerification, sanitizeRecords } from "./model/verification.js";
const EMPTY_SESSION = { verified: {}, queue: [], log: [] };

function load() {
  try {
    return sanitizeRecords(
      JSON.parse(localStorage.getItem("floodshadow-v2") || "{}"),
    );
  } catch {
    return {};
  }
}
function exportJson(name, data) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [mode, setMode] = useState("experiment"),
    [params, setParams] = useState({ ...SCENARIOS[0], seed: 42 }),
    [k, setK] = useState(5),
    [selected, setSelected] = useState(null),
    [layer, setLayer] = useState("priority"),
    [historical, setHistorical] = useState(true),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [modal, setModal] = useState(null),
    [records, setRecords] = useState(load),
    [toast, setToast] = useState(""),
    [guide, setGuide] = useState(false),
    [focusSignal, setFocusSignal] = useState(0),
    [target, setTarget] = useState("hidden"),
    [strategy, setStrategy] = useState("discovery");
  useEffect(() => {
    let alive = true;
    fetchDataset()
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("floodshadow-v2", JSON.stringify(records));
    } catch {
      setToast(
        "Browser storage is unavailable; export your work before closing.",
      );
    }
  }, [records]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement;
    const dialog = document.querySelector('[role="dialog"]');
    const selector =
      "button:not([disabled]),a[href],input,textarea,select,summary";
    dialog?.querySelector(selector)?.focus();
    function keydown(e) {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const nodes = [...(dialog?.querySelectorAll(selector) || [])].filter(
          (el) => el.getClientRects().length,
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus?.();
    };
  }, [modal]);
  const scenarioKey = `v3:${mode}:${params.seed}:${params.rain}:${params.coverage}:${params.disparity}:${params.falseRate}:${params.missingRate}`;
  const session = records[scenarioKey] || EMPTY_SESSION;
  const experiment = useMemo(
    () => (data ? simulate(data.geo.features, params) : null),
    [data, params],
  );
  const observed = useMemo(() => {
    if (!data) return [];
    if (mode === "experiment") return experiment.observed;
    const realRain = rainfallTotal(data.weather);
    return data.geo.features.map((f) => ({
      ...f.properties,
      reports: null,
      rainfall: realRain,
      score: null,
      probability: null,
      verified: null,
      inspectionCost: 1,
    }));
  }, [data, mode, experiment]);
  const posterior = useMemo(() => {
    if (mode !== "experiment") return { rows: observed, diagnostics: null };
    try {
      return infer(observed, session.verified);
    } catch (e) {
      return {
        rows: observed.map((s) => ({ ...s, score: null, probability: null })),
        diagnostics: { warning: e.message },
        error: e.message,
      };
    }
  }, [observed, session.verified, mode]);
  const rows = posterior.rows;
  const pending =
    mode === "experiment" && !posterior.error
      ? recommend(rows, { target, strategy })
      : rows;
  const topIds =
    mode === "experiment" && !posterior.error
      ? pending.slice(0, k).map((s) => s.id)
      : [];
  const active = rows.find((s) => s.id === selected) || rows[0];
  useEffect(() => {
    if (!selected && pending.length) setSelected(pending[0].id);
  }, [rows, selected]);
  if (error)
    return (
      <div className="boot">
        <Waves />
        <h1>Geographic data could not load</h1>
        <p>{error}</p>
        <button onClick={() => location.reload()}>Retry</button>
      </div>
    );
  if (!data || !active)
    return (
      <div className="boot">
        <Waves size={48} />
        <h1>FloodShadow</h1>
        <p>Opening the Guayaquil intelligence workspace…</p>
        <span className="loader" />
      </div>
    );
  function updateSession(next) {
    setRecords({ ...records, [scenarioKey]: { ...session, ...next } });
  }
  function select(id) {
    setSelected(id);
    setFocusSignal((n) => n + 1);
  }
  function queue(id) {
    if (session.queue.includes(id)) {
      updateSession({ queue: session.queue.filter((x) => x !== id) });
      return;
    }
    if (session.queue.length >= k) {
      setToast(
        "Inspection capacity reached. Remove a sector or increase capacity.",
      );
      return;
    }
    updateSession({ queue: [...session.queue, id] });
    setToast("Sector added to your verification plan");
  }
  function verify(result, details = {}) {
    if (mode !== "experiment" || posterior.error) return;
    const actual =
      result === "oracle"
        ? experiment.truth.find((t) => t.id === active.id)
        : null;
    const outcome = actual
      ? actual.affected
        ? "affected"
        : "unaffected"
      : result;
    const nextVerified = {
      ...session.verified,
      [active.id]: { result: outcome },
    };
    const after = infer(observed, nextVerified);
    const next = addVerification(session, active, outcome, {
      ...details,
      episodeId: scenarioKey,
      before: rows,
      after: after.rows,
      diagnostics: after.diagnostics,
    });
    updateSession(next);
    setToast(
      "Evidence recorded. Occurrence and reporting estimates updated across the pilot.",
    );
  }
  function reset() {
    updateSession({ verified: {}, queue: [], log: [] });
    setToast("This experiment’s local verifications and queue were cleared.");
  }
  const list = pending.filter(
    (s) =>
      (filter === "silent"
        ? s.reports === 0
        : filter === "planned"
          ? session.queue.includes(s.id)
          : true) &&
      `${s.name} ${s.code}`.toLowerCase().includes(query.toLowerCase()),
  );
  const exportAll = () =>
    exportJson("floodshadow-analysis.json", {
      version: "0.3.0",
      exported: new Date().toISOString(),
      mode,
      params,
      k,
      sources: data.sources,
      weather: data.weather,
      ranking: rows,
      selection: topIds,
      session,
      model: {
        version: MODEL_VERSION,
        diagnostics: posterior.diagnostics,
        target,
        strategy,
      },
      experimentalEvaluation:
        mode === "experiment"
          ? {
              hiddenTruth: experiment.truth,
              configuration: experiment.configuration,
            }
          : null,
      limitation:
        "Conditional model estimates under explicit priors. Not calibrated for Guayaquil. Experimental incident labels are synthetic.",
    });
  return (
    <div className="app-shell">
      <nav className="rail" aria-label="Workspace">
        <div className="rail-brand">
          <Waves size={28} />
        </div>
        <button
          className={!modal ? "selected" : ""}
          title="Territory workspace"
          aria-label="Territory workspace"
          onClick={() => setModal(null)}
        >
          <Map size={21} />
        </button>
        <button
          title="Compare decisions"
          aria-label="Compare decisions"
          onClick={() => {
            if (mode === "sources") {
              setMode("experiment");
              setLayer("priority");
            }
            setModal("compare");
          }}
        >
          <GitCompareArrows size={21} />
        </button>
        <button
          title="Scenario laboratory"
          aria-label="Scenario laboratory"
          onClick={() => setModal("lab")}
        >
          <FlaskConical size={21} />
        </button>
        <div className="rail-spacer" />
        <button
          title="Sources and method"
          aria-label="Sources and method"
          onClick={() => setModal("sources")}
        >
          <BookOpen size={20} />
        </button>
        <button
          title="Guide to the workspace"
          aria-label="Guide to the workspace"
          onClick={() => setGuide(!guide)}
        >
          <HelpCircle size={21} />
        </button>
        <div className="team-avatar">FS</div>
      </nav>
      <div className="workspace">
        <header className="topbar">
          <a className="wordmark" href="/">
            flood<span>shadow</span>
            <small>Research beta</small>
          </a>
          <div className="top-divider" />
          <div className="city">
            <MapPin size={15} />
            Guayaquil <span>Ecuador</span>
          </div>
          <div className="mode-switch" aria-label="Data mode">
            <button
              className={mode === "experiment" ? "on" : ""}
              onClick={() => {
                setMode("experiment");
                setLayer("priority");
              }}
            >
              <FlaskConical size={13} /> Experiment
            </button>
            <button
              className={mode === "sources" ? "on" : ""}
              onClick={() => {
                setMode("sources");
                setLayer("susceptibility");
                setFilter("all");
                setQuery("");
              }}
            >
              <Layers size={13} /> Source explorer
            </button>
          </div>
          <button className="icon-button export" onClick={exportAll}>
            <Download size={16} />
            <span>Export</span>
          </button>
        </header>
        <section className="contextbar">
          <div>
            <span className="live-dot" />
            <strong>
              {mode === "experiment"
                ? "Real territory. Hidden information."
                : "Explore the source evidence."}
            </strong>
            <span className="context-sub">
              {mode === "experiment"
                ? "Decide where to verify next."
                : "Historical context, not a current flood assessment."}
            </span>
          </div>
          <button onClick={() => setModal("sources")} className="data-status">
            <span
              className={mode === "experiment" ? "amber-dot" : "live-dot"}
            />
            {mode === "experiment"
              ? "Synthetic incidents · official geometry"
              : "Official geometry · modelled rainfall"}
            <Info size={13} />
          </button>
        </section>
        <>
          {posterior.error && (
            <div role="alert" className="model-warning">
              Inference unavailable: {posterior.error}. No recommendation is
              valid.
            </div>
          )}
          {!posterior.error && posterior.diagnostics?.warning && (
            <div role="status" className="model-warning">
              {posterior.diagnostics.warning}
            </div>
          )}
          {data.warnings?.map((w) => (
            <div key={w} role="status" className="model-warning">
              {w}
            </div>
          ))}
        </>
        <div className="mission-layout">
          <section className="ranking-panel">
            <div className="panel-title">
              <div className="eyebrow">Verification workspace</div>
              <h1>
                Look beyond
                <br />
                the reports.
              </h1>
              <p>Find the gaps. Follow the evidence.</p>
            </div>
            <div className="scenario-select">
              <CloudRain size={18} />
              <div>
                <small>
                  {mode === "experiment"
                    ? "Experimental episode"
                    : "Historical rainfall window"}
                </small>
                {mode === "experiment" ? (
                  <select
                    aria-label="Experimental episode"
                    value={params.id}
                    onChange={(e) => {
                      const s = SCENARIOS.find((s) => s.id === +e.target.value);
                      setParams({ ...s, seed: s.id });
                    }}
                  >
                    {SCENARIOS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <strong>19 October 2026</strong>
                )}
              </div>
              <button
                title="Scenario settings"
                aria-label="Scenario settings"
                onClick={() => setModal("lab")}
              >
                <SlidersHorizontal size={15} />
              </button>
            </div>
            <div className="mini-stats">
              <div>
                <strong>{rows.length}</strong>
                <span>real sectors</span>
              </div>
              <div>
                <strong>
                  {mode === "experiment"
                    ? observed.reduce((n, s) => n + (s.reports ?? 0), 0)
                    : (data.events?.features.length ?? "—")}
                </strong>
                <span>
                  {mode === "experiment"
                    ? "simulated reports"
                    : "historical events in region"}
                </span>
              </div>
              <div>
                <strong>
                  {mode === "experiment"
                    ? observed.filter((s) => s.reports === 0).length
                    : "—"}
                </strong>
                <span>observed zero reports</span>
              </div>
            </div>
            <div className="mission-controls">
              <label>
                Verification purpose
                <select
                  aria-label="Verification purpose"
                  disabled={mode !== "experiment"}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="hidden">Discover unreported incidents</option>
                  <option value="all">Find affected sectors overall</option>
                </select>
              </label>
              <label>
                Selection strategy
                <select
                  aria-label="Selection strategy"
                  disabled={mode !== "experiment"}
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                >
                  <option value="discovery">
                    Expected affected / inspection cost
                  </option>
                  <option value="information">
                    Expected information / inspection cost
                  </option>
                </select>
              </label>
            </div>
            <div className="capacity">
              <div>
                <Target size={15} />
                <span>Verification capacity</span>
                <strong>{k}</strong>
              </div>
              <input
                aria-label="Verification capacity"
                disabled={mode !== "experiment"}
                type="range"
                min="1"
                max="12"
                value={k}
                onChange={(e) => {
                  const next = +e.target.value;
                  setK(next);
                  if (session.queue.length > next)
                    updateSession({ queue: session.queue.slice(0, next) });
                }}
              />
              <div className="capacity-note">
                {mode === "experiment"
                  ? `${session.queue.length} planned · ${Object.keys(session.verified).length} verified`
                  : "Historical context · no selection computed"}
              </div>
            </div>
            <div className="list-heading">
              <h2>
                {mode === "experiment"
                  ? "Candidate next checks"
                  : "Census sectors"}
              </h2>
              <span>
                {pending.length} {mode === "experiment" ? "eligible" : "loaded"}
              </span>
            </div>
            <label className="search">
              <Search size={14} />
              <input
                aria-label="Find sector"
                placeholder="Find a sector or census code"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="filter-tabs">
              {[
                ["all", "All sectors"],
                ["silent", "No reports"],
                ["planned", "My plan"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  disabled={mode === "sources" && id !== "all"}
                  className={filter === id ? "active" : ""}
                  onClick={() => setFilter(id)}
                >
                  {label}
                  {id === "planned" && session.queue.length > 0
                    ? ` (${session.queue.length})`
                    : ""}
                </button>
              ))}
            </div>
            <div className="sector-list">
              {list.map((s, i) => (
                <button
                  className={`sector-row ${active.id === s.id ? "active" : ""}`}
                  key={s.id}
                  onClick={() => select(s.id)}
                >
                  <span className="row-number">
                    {String(pending.indexOf(s) + 1).padStart(2, "0")}
                  </span>
                  <span className="sector-name">
                    <strong>
                      {s.name}
                      {session.queue.includes(s.id) && <Check size={12} />}
                    </strong>
                    <small>
                      {s.code}{" "}
                      <span>
                        ·{" "}
                        {s.reports === null
                          ? mode === "experiment"
                            ? "Missing report data"
                            : "Not connected"
                          : `${s.reports} reports`}
                      </span>
                    </small>
                  </span>
                  <span
                    className="row-score"
                    style={{
                      background: color(s.score) + "36",
                      color: s.score >= 60 ? "#9f4f2d" : "#8d6b35",
                    }}
                  >
                    {s.score == null ? "—" : `${s.score}%`}
                  </span>
                  <ChevronRight size={13} />
                </button>
              ))}
              {!list.length && (
                <div className="empty">
                  {pending.length
                    ? "No sectors match this filter."
                    : "No eligible unverified sectors. Change the purpose or record a new experiment."}
                </div>
              )}
            </div>
            <button
              className="compare-cta"
              onClick={() => {
                setMode("experiment");
                setModal("compare");
              }}
            >
              <GitCompareArrows size={18} />
              <span>
                Compare the decisions
                <small>Same capacity. Measurable outcomes.</small>
              </span>
              <ArrowUpRight size={17} />
            </button>
          </section>
          <section className="map-stage">
            <MapView
              geo={data.geo}
              flood={data.flood}
              events={data.events}
              eventsVisible={mode === "sources"}
              rows={rows}
              selected={active.id}
              onSelect={select}
              layer={layer}
              showFlood={historical}
              topIds={topIds}
              queued={session.queue}
              focusSignal={focusSignal}
            />
            <div className="map-top">
              <div className="layer-tabs">
                {[
                  ["priority", "Affected estimate"],
                  ["reports", "Reports"],
                  ["susceptibility", "Historical footprint"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    disabled={mode === "sources" && id !== "susceptibility"}
                    className={layer === id ? "active" : ""}
                    onClick={() => setLayer(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                className={`layer-toggle ${historical ? "on" : ""}`}
                title="Toggle municipal historical flood footprint"
                aria-label="Toggle municipal historical flood footprint"
                onClick={() => setHistorical(!historical)}
              >
                <Layers size={16} />
              </button>
            </div>
            <div className="map-legend">
              <strong>
                {layer === "priority"
                  ? "Model-based affected estimate"
                  : layer === "reports"
                    ? "Observed report count"
                    : "Historical area overlap"}
              </strong>
              <div className="legend-swatches">
                {(layer === "priority"
                  ? PRIORITY
                  : layer === "reports"
                    ? ["#e6e8e5", "#bac9e3", "#7d9bc9", "#3b62a0"]
                    : ["#d8e7ed", "#afcbd8", "#7faac0", "#558ba7", "#326c8d"]
                ).map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </div>
              <div className="legend-labels">
                <span>
                  {layer === "reports"
                    ? "0"
                    : layer === "susceptibility"
                      ? "0%"
                      : "0%"}
                </span>
                <span>
                  {layer === "reports"
                    ? "6+"
                    : layer === "susceptibility"
                      ? "100%"
                      : "100%"}
                </span>
              </div>
              <small>
                {layer === "priority"
                  ? "Experimental posterior · not locally calibrated"
                  : layer === "reports"
                    ? "Experiment observations only"
                    : "Share intersecting unioned historical zones"}
              </small>
              <div className="legend-lines">
                {mode === "experiment" && (
                  <span>
                    <i className="dash" />
                    Suggested check
                  </span>
                )}
                <span>
                  <i className="dash blue" />
                  Neighbor
                </span>
                <span>
                  <i className="missing-key" />
                  Missing
                </span>
              </div>
            </div>
            <div className="map-bottom-card">
              <div>
                <span className="radar-icon">
                  <Compass size={21} />
                </span>
                <div>
                  <strong>
                    {mode === "experiment"
                      ? `${topIds.length} candidate verifications · ${strategy === "information" ? "learn" : "discover"}`
                      : "Historical evidence, in context"}
                  </strong>
                  <p>
                    {mode === "experiment"
                      ? "Positive and negative checks update the next decision."
                      : "Rainfall is modelled at a regional grid scale, not measured per street."}
                  </p>
                </div>
              </div>
              <button
                aria-label="Open method"
                onClick={() => setModal("sources")}
              >
                <ArrowUpRight size={17} />
              </button>
            </div>
          </section>
          <EvidencePassport
            key={`${scenarioKey}:${active.id}`}
            sector={active}
            rows={rows}
            mode={mode}
            sources={data.sources}
            session={session}
            diagnostics={posterior.diagnostics}
            onSelect={select}
            onQueue={queue}
            onVerify={verify}
            onSources={() => setModal("sources")}
          />
        </div>
        <footer>
          <span>
            <span className="live-dot" />
            Guayaquil pilot · {rows.length} census sectors
          </span>
          <span>
            Geometry: INEC 2022 · Footprint: Municipality · Rainfall: Open-Meteo
          </span>
          <button onClick={() => setModal("sources")}>
            Source registry <ArrowUpRight size={11} />
          </button>
        </footer>
      </div>
      {guide && (
        <div className="guide">
          <button aria-label="Close guide" onClick={() => setGuide(false)}>
            <X size={15} />
          </button>
          <Compass size={24} />
          <h3>Three steps to a clearer decision</h3>
          <p>
            <b>1.</b> Select a sector in the list or on the map.
          </p>
          <p>
            <b>2.</b> Read its evidence and inspect its neighbors.
          </p>
          <p>
            <b>3.</b> Plan checks, record observations, then compare outcomes.
          </p>
          <small>
            Experiments use synthetic incidents on official census geometry.
          </small>
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "compare"
                ? "Decision comparison"
                : modal === "lab"
                  ? "Scenario laboratory"
                  : "Sources and methodology"
            }
            className={`modal ${modal === "sources" ? "sources-modal" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">FloodShadow research workspace</span>
                <h2>
                  {modal === "compare"
                    ? "Make the trade-off visible."
                    : modal === "lab"
                      ? "Change the conditions."
                      : "Know what the evidence can say."}
                </h2>
              </div>
              <button
                aria-label="Close dialog"
                className="icon-button"
                onClick={() => setModal(null)}
              >
                <X size={22} />
              </button>
            </div>
            {modal === "compare" && (
              <Comparison
                initialTarget={target}
                features={data.geo.features}
                experiment={experiment}
                k={k}
                params={params}
                onSelect={(id) => {
                  select(id);
                  setModal(null);
                }}
              />
            )}
            {modal === "lab" && (
              <ScenarioLab
                params={params}
                setParams={setParams}
                onExperiment={() => setMode("experiment")}
                session={session}
                onReset={reset}
              />
            )}
            {modal === "sources" && (
              <SourceRegistry
                data={data}
                onWeather={(weather) => setData({ ...data, weather })}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
