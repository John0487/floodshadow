import EpisodeEvidence from "./EpisodeEvidence.jsx";
import CityBrief from "./CityBrief.jsx";
import AreaExplorer from "./AreaExplorer.jsx";
import AreaSummary from "./AreaSummary.jsx";
import { selectAreaSectors, rainfallScale } from "./territory.js";
import MapLegend from "./MapLegend.jsx";
import FindingsPanel from "./FindingsPanel.jsx";
import ScenarioExplorer from "./ScenarioExplorer.jsx";
import EmergencySupport from "./EmergencySupport.jsx";
import PostRainfallFindings from "./PostRainfallFindings.jsx";
import { buildAlerts, scenarioRows } from "./findings.js";
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Waves,
  ArrowLeft,
  ArrowUpRight,
  CloudRain,
  Search,
  Download,
  BookOpen,
  FlaskConical,
  MapPin,
  Eye,
  CheckCheck,
  Info,
  ChevronRight,
  X,
  ShieldCheck,
} from "lucide-react";
import {
  loadCity,
  loadRealRecords,
  saveRealRecords,
  downloadJSON,
  loadLocalLedger,
  persistLocalRecords,
} from "./data.js";
import {
  coverageMetrics,
  evidenceState,
  latestVerifications,
  postEventMetrics,
  shadowQueue,
  comparePriorWithOutcomes,
  describeDocumentedComparison,
} from "./analysis.js";
import {
  number,
  pct,
  localDate,
  PHASES,
  TYPE_LABELS,
  STATE_LABELS,
  eventName,
} from "./format.js";
import SectorPassport from "./SectorPassport.jsx";
import RainTimeline from "./RainTimeline.jsx";
import CityDialog from "./CityDialog.jsx";
import "./city.css";
const CityMap = lazy(() => import("./CityMap.jsx"));
const Laboratory = lazy(() => import("../App.jsx"));
const LiveRainView = lazy(() => import("./LiveRainView.jsx"));
class ViewBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { error: null, generation: 0 };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <div className="rain-failure" role="alert">
        <h2>This view could not be opened.</h2>
        <p>{this.state.error.message}</p>
        <p>
          Your saved evidence is preserved. Reopen this view without reloading
          the application.
        </p>
        <button
          onClick={() =>
            this.setState((s) => ({
              error: null,
              generation: s.generation + 1,
            }))
          }
        >
          Reopen this view
        </button>
      </div>
    ) : (
      <React.Fragment key={this.state.generation}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
export default function RainApp() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [phase, setPhase] = useState("live"),
    [eventId, setEventId] = useState("oct24"),
    [scope, setScope] = useState("urban"),
    [area, setArea] = useState(null),
    [geographyMode, setGeographyMode] = useState("areas"),
    [prepared, setPrepared] = useState(true),
    [important, setImportant] = useState(true),
    [mapReset, setMapReset] = useState(0),
    [locationFocus, setLocationFocus] = useState(null),
    [scenario, setScenario] = useState(false),
    [scenarioSettings, setScenarioSettings] = useState({
      rain: 100,
      duration: 100,
      shift: 0,
      coverage: 100,
    }),
    [alertHistory, setAlertHistory] = useState([]),
    [ledgerReady, setLedgerReady] = useState(false),
    [selected, setSelected] = useState(null),
    [zone, setZone] = useState(null),
    [focus, setFocus] = useState(null),
    [layer, setLayer] = useState("priority"),
    [search, setSearch] = useState(""),
    [tab, setTab] = useState("incidents"),
    [dialog, setDialog] = useState(null),
    [hour, setHour] = useState(null),
    [compareView, setCompareView] = useState("after"),
    [records, setRecords] = useState(loadRealRecords),
    [storageError, setStorageError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    const timeout = setTimeout(() => controller.abort(), 30000);
    loadCity(controller.signal)
      .then((d) => {
        if (mounted) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (mounted)
          setError(
            e.name === "AbortError"
              ? "Loading took too long. Check your connection and try again."
              : e.message,
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [attempt]);
  const changeRecords = useCallback((next) => {
    setRecords(next);
    try {
      saveRealRecords(next);
      setStorageError("Saving evidence to this computer…");
      persistLocalRecords(next)
        .then((d) => {
          setAlertHistory(d.alertHistory);
          setStorageError("");
        })
        .catch((e) =>
          setStorageError(
            e.message + " Your browser copy remains available for export.",
          ),
        );
    } catch {
      setStorageError(
        "This browser could not save your changes. Export the session to preserve the verifications.",
      );
    }
  }, []);
  useEffect(() => {
    let alive = true;
    loadLocalLedger()
      .then(async (d) => {
        const cache = loadRealRecords();
        if (!d.records.length && cache.length)
          d = await persistLocalRecords(cache);
        if (alive) {
          setRecords(d.records);
          setAlertHistory(d.alertHistory);
          setLedgerReady(true);
        }
      })
      .catch((e) => {
        if (alive) setStorageError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  const closeDialog = useCallback(() => setDialog(null), []);
  const goPhase = useCallback((p) => {
    setScenario(false);
    setPhase(p);
    setHour(null);
    setCompareView("after");
    if (p === "before") {
      setLayer("priority");
      setTab("priority");
    } else if (p === "during") {
      setLayer("rain");
      setTab("incidents");
    } else if (p === "after" || p === "summary") {
      setLayer(p === "summary" ? "priority" : "rain");
      setTab("incidents");
    }
  }, []);
  const selectSector = useCallback((id) => {
    setSelected(id);
    setFocus({ id, at: Date.now() });
  }, []);
  useEffect(() => {
    if (selected && window.innerWidth <= 760)
      requestAnimationFrame(() =>
        document
          .querySelector(".sector-passport")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
  }, [selected]);
  const event = data?.events.find((e) => e.id === eventId),
    snapshot = data?.snapshots.find((s) => s.eventId === eventId);
  const sectors = useMemo(
    () => (data ? selectAreaSectors(data.sectors, scope, area) : []),
    [data, scope, area],
  );
  const valid = useMemo(
    () => latestVerifications(records, eventId),
    [records, eventId],
  );
  const impacts = useMemo(() => {
    if (!data) return [];
    const pointMap = new Map();
    for (const r of records)
      if (
        r.eventId === eventId &&
        r.validation === "accepted" &&
        r.scope === "point"
      )
        pointMap.set(r.sectorId, r);
    const manual = [...pointMap.values()]
      .filter((r) => r.result === "positive")
      .map((r) => ({
        id: r.id,
        eventId,
        sectorId: r.sectorId,
        type: "verification",
        locationText: r.note,
        description: r.note,
        source: r.evidenceUrl,
        coordinates: null,
        confirmation: "operator_accepted",
      }));
    const sectorIds = new Set(sectors.map((s) => s.id));
    return [
      ...data.impacts.filter((i) => i.eventId === eventId),
      ...manual,
    ].filter((i) =>
      area
        ? sectorIds.has(i.sectorId)
        : scope === "canton" ||
          (i.parishCode ?? i.sectorId?.slice(0, 6)) === "090150",
    );
  }, [data, eventId, records, scope, area, sectors]);
  const forecastDisplay =
    phase === "before" ||
    (phase === "after" && compareView === "before") ||
    layer === "forecast";
  const rows = useMemo(
    () =>
      sectors.map((sector) => {
        const assessment = snapshot.assessments[sector.id],
          local = impacts.filter((i) => i.sectorId === sector.id),
          weatherCell = (
            forecastDisplay ? event.forecast.grid : event.modelRain.grid
          ).find(
            (c) =>
              c.id ===
              (forecastDisplay
                ? assessment.forecastCellId
                : assessment.modelCellId),
          );
        return {
          sector,
          assessment,
          impacts: local,
          state: evidenceState(assessment, local, valid.get(sector.id)),
          weatherCell,
        };
      }),
    [sectors, snapshot, event, impacts, valid, forecastDisplay],
  );
  const coverage = useMemo(
    () =>
      snapshot
        ? coverageMetrics(sectors, snapshot.assessments, event.observations)
        : null,
    [sectors, snapshot, event],
  );
  const metrics = useMemo(
    () => postEventMetrics(sectors, impacts, records, eventId),
    [sectors, impacts, records, eventId],
  );
  const shadows = useMemo(
    () =>
      snapshot
        ? shadowQueue(sectors, snapshot.assessments, impacts, records, eventId)
        : [],
    [sectors, snapshot, impacts, records, eventId],
  );
  const comparison = useMemo(
    () =>
      snapshot
        ? comparePriorWithOutcomes(snapshot, sectors, records, event)
        : null,
    [snapshot, sectors, records, event],
  );
  const descriptive = useMemo(
    () =>
      snapshot
        ? describeDocumentedComparison(snapshot.assessments, impacts, eventId)
        : null,
    [snapshot, impacts, eventId],
  );
  const ranked = useMemo(
    // Sorting is for presentation, never a calibrated probability.
    () =>
      rows
        .filter(
          (r) =>
            (!zone || r.sector.zoneId === zone) &&
            (!search ||
              [
                r.sector.id,
                r.sector.parishName,
                ...r.impacts.map((i) => i.locationText),
              ]
                .join(" ")
                .toLocaleLowerCase()
                .includes(search.toLocaleLowerCase())),
        )
        .sort(
          (a, b) => (b.assessment.score ?? -1) - (a.assessment.score ?? -1),
        ),
    [rows, zone, search],
  );
  const listImpacts = useMemo(
    () =>
      impacts.filter(
        (i) =>
          !search ||
          (i.locationText ?? "")
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()),
      ),
    [impacts, search],
  );
  const active = rows.find((r) => r.sector.id === selected),
    cell =
      active?.weatherCell ??
      (area
        ? rows.find((r) => r.weatherCell)?.weatherCell
        : (forecastDisplay
            ? event?.forecast.grid
            : event?.modelRain.grid)?.[0]);
  const scale = rainfallScale(rows, hour);
  const hypothetical = useMemo(
    () => (event ? scenarioRows(rows, event, scenarioSettings) : []),
    [rows, event, scenarioSettings],
  );
  const alerts = useMemo(
    () =>
      snapshot
        ? buildAlerts({
            sectors,
            assessments: snapshot.assessments,
            impacts,
            records,
            event,
            phase,
            areas: data.territories.areas,
          })
        : [],
    [sectors, snapshot, impacts, records, event, phase, data],
  );
  const chooseArea = (next) => {
    setArea(next);
    setSelected(null);
    setZone(null);
    setSearch("");
    setLocationFocus(null);
    setFocus(null);
    setScope(next ? "canton" : "urban");
  };
  const backToCity = () => {
    chooseArea(null);
    setZone(null);
    setSearch("");
    setSelected(null);
    setGeographyMode("areas");
    setMapReset((n) => n + 1);
  };
  const showIncident = (incident) => {
    const sector = data.sectors.find((s) => s.id === incident.sectorId);
    if (sector) {
      const group = data.territories.areas.find((a) => a.id === sector.areaId);
      if (group) chooseArea(group);
      selectSector(sector.id);
    }
    if (incident.coordinates)
      setLocationFocus({ coordinates: incident.coordinates, at: Date.now() });
  };
  if (error)
    return (
      <main className="rain-failure" role="alert">
        <Waves size={38} />
        <h1>The evidence could not be loaded.</h1>
        <p>{error}</p>
        <button
          className="rain-primary"
          onClick={() => {
            setError("");
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      </main>
    );
  if (!data)
    return (
      <main className="rain-loading">
        <Waves size={36} />
        <h1>FLOODSHADOW</h1>
        <p>Loading Guayaquil geography and documented storms…</p>
      </main>
    );
  if (phase === "live")
    return (
      <ViewBoundary>
        <Suspense
          fallback={
            <div className="rain-loading">Connecting to current weather…</div>
          }
        >
          <LiveRainView data={data} onHistorical={() => goPhase("summary")} />
        </Suspense>
      </ViewBoundary>
    );
  if (phase === "lab")
    return (
      <ViewBoundary>
        <div className="laboratory-return">
          <button onClick={() => goPhase("summary")}>
            <ArrowLeft size={16} /> Back to Guayaquil
          </button>
          <span>
            Experimental laboratory · synthetic incidents clearly identified ·
            original 36-sector pilot
          </span>
        </div>
        <div className="laboratory-frame">
          <Suspense
            fallback={<div className="rain-loading">Loading laboratory…</div>}
          >
            <Laboratory />
          </Suspense>
        </div>
      </ViewBoundary>
    );
  function exportSession() {
    downloadJSON(`floodshadow-${eventId}-2.0.json`, {
      version: "2.0.0",
      exportedAt: new Date().toISOString(),
      event,
      territoryScope: scope,
      namedArea: area
        ? { id: area.id, name: area.name, sectorIds: area.sectorIds }
        : null,
      manifest: data.manifest,
      assessmentSnapshot: snapshot,
      verifications: records.filter((r) => r.eventId === eventId),
      impacts,
      metrics,
      coverage,
      comparison,
      limitations: [
        "Documented evidence and weather model outputs are distinct.",
        "No calibrated flood probabilities are provided.",
        "Geocoded points are provisional candidates.",
        "Accepted verifications are declared by the local operator.",
      ],
    });
  }
  const isOutlook = event.status === "captured_forecast";
  const current = PHASES[phase],
    scopeName =
      scope === "urban"
        ? "Guayaquil main parish · code 090150"
        : "Guayaquil canton · main and rural parishes";
  return (
    <ViewBoundary>
      <div className="rain-app">
        <header className="rain-header">
          <a
            href="#"
            className="rain-brand"
            onClick={(e) => {
              e.preventDefault();
              goPhase("summary");
            }}
          >
            <Waves size={27} />
            <span>
              floodshadow<small>Rainfall intelligence for Guayaquil</small>
            </span>
          </a>
          <nav aria-label="Storm stages">
            <button onClick={() => setPhase("live")}>Rain now</button>
            {Object.entries(PHASES).map(([id, p]) => (
              <button
                key={id}
                aria-current={phase === id ? "page" : undefined}
                onClick={() => goPhase(id)}
              >
                {p.name}
              </button>
            ))}
            <button onClick={() => setPhase("lab")}>
              <FlaskConical size={14} /> Research lab
            </button>
            <button
              aria-pressed={scenario}
              onClick={() => {
                goPhase("before");
                setScenario(true);
                setLayer("priority");
              }}
            >
              Scenario Explorer
            </button>
          </nav>
          <div className="rain-header-actions">
            <button
              aria-label="Explore a Rainfall Event"
              title="Explore a Rainfall Event"
              onClick={() => setDialog("demo")}
            >
              <BookOpen size={18} />
            </button>
            <button
              className="rain-export"
              aria-label="Export storm analysis"
              onClick={exportSession}
            >
              <Download size={15} />
              <span>Export</span>
            </button>
          </div>
        </header>
        <div className="demo-mode-bar">
          <span>
            {prepared
              ? "Prepared Demo Mode · saved local evidence"
              : "Street basemap mode · internet required"}{" "}
            ·{" "}
            {ledgerReady
              ? "Evidence saved on this computer"
              : "Connecting to local evidence store"}
          </span>
          <button onClick={() => setPrepared((p) => !p)}>
            {prepared ? "Use online street map" : "Use offline demo map"}
          </button>
          <button
            disabled={scenario}
            title={
              scenario
                ? "Return to real evidence to export its report"
                : "Download the selected event’s evidence"
            }
            onClick={() =>
              import("./impact-report.js")
                .then((m) =>
                  m.saveImpactReport({
                    event,
                    rows,
                    impacts,
                    records,
                    areas: data.territories.areas,
                    alerts,
                    snapshot,
                  }),
                )
                .catch((e) => setStorageError(e.message))
            }
          >
            Generate Rainfall Impact Report
          </button>
        </div>
        <div className="episode-bar">
          <div>
            <span className="episode-status-dot" />
            <strong>{isOutlook ? "Saved forecast" : "Documented storm"}</strong>
            <label>
              <span className="sr-only">Rainfall episode</span>
              <select
                aria-label="Rainfall episode"
                value={eventId}
                onChange={(e) => {
                  setEventId(e.target.value);
                  setHour(null);
                  setSelected(null);
                  setFocus(null);
                  setZone(null);
                  setSearch("");
                  if (
                    data.events.find((x) => x.id === e.target.value)?.status ===
                    "captured_forecast"
                  )
                    goPhase("before");
                }}
              >
                {data.events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.status === "captured_forecast"
                      ? `${eventName(e)} (${localDate(e.forecast.retrievedAt)})`
                      : `${eventName(e)} · 2026`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="scope-selector">
            <MapPin size={14} />
            <select
              aria-label="Territorial coverage"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setArea(null);
                setSelected(null);
                setZone(null);
                setHour(null);
              }}
            >
              <option value="urban">Guayaquil · main parish</option>
              <option value="canton">Canton · include rural parishes</option>
            </select>
          </label>
          <button
            className="source-button"
            onClick={() => setDialog("sources")}
          >
            <ShieldCheck size={14} /> Sources and limitations
          </button>
        </div>
        <AreaExplorer
          catalog={data.territories}
          area={area}
          onArea={chooseArea}
          mode={geographyMode}
          onMode={setGeographyMode}
        />
        {(area || selected) && (
          <nav className="area-breadcrumb" aria-label="Current location">
            <button className="back-city" onClick={backToCity}>
              ← Back to Guayaquil
            </button>
            <span>Guayaquil</span>
            <span>›</span>
            <span>
              {area?.generalArea ??
                active?.sector.generalArea ??
                "Selected area"}
            </span>
            {area && (
              <>
                <span>›</span>
                <button
                  onClick={() => {
                    setSelected(null);
                    setFocus(null);
                    setLocationFocus(null);
                    setArea({ ...area });
                  }}
                >
                  {area.name}
                </button>
              </>
            )}
            {selected && (
              <>
                <span>›</span>
                <span>Selected subarea</span>
              </>
            )}
          </nav>
        )}
        <div className="stage-synopsis">
          <strong>
            {phase === "summary"
              ? "Start here"
              : phase === "before"
                ? "What was expected?"
                : phase === "during"
                  ? "How did the rain evolve?"
                  : "What was reported?"}
          </strong>
          <span>
            {phase === "summary"
              ? "Green, yellow and orange show increasing attention. Red markers show published impacts. Purple markers identify places to check. Select an area to explore."
              : phase === "before"
                ? "The saved forecast shows expected rain. Attention categories highlight places to check, not confirmed floods. Lower attention does not mean safe."
                : phase === "during"
                  ? "Replay hourly rainfall estimates. Darker blue means more rain; nearby polygons can share the same coarse weather cell."
                  : "Blue polygons show modeled rainfall after the storm. Red dots show reported locations. A dot does not mean the whole polygon flooded."}
          </span>
        </div>
        {phase === "summary" && (
          <div className="journey-cards">
            {[
              [
                "before",
                "Before the Rain",
                "Explore expected rainfall and places to watch.",
              ],
              [
                "during",
                "During the Rain",
                "Replay the available rainfall evidence.",
              ],
              [
                "after",
                "After the Rain",
                "Review documented impacts and what is missing.",
              ],
            ].map(([p, title, text]) => (
              <button key={p} onClick={() => goPhase(p)}>
                <strong>{title}</strong>
                <span>{text}</span>
              </button>
            ))}
          </div>
        )}
        {scenario && (
          <ScenarioExplorer
            settings={scenarioSettings}
            onChange={setScenarioSettings}
            rows={hypothetical}
            baseline={rows}
            onClose={() => {
              setScenario(false);
              goPhase("summary");
            }}
          />
        )}
        {storageError && (
          <p role="alert" className="rain-storage-error">
            {storageError}
          </p>
        )}
        <main className="city-workspace">
          <CityBrief
            view={{
              phase,
              event,
              zone,
              search,
              tab,
              selected,
              isOutlook,
              scopeName,
              area,
            }}
            analysis={{
              sectors,
              metrics,
              coverage,
              shadows,
              comparison,
              descriptive,
              listImpacts,
              ranked,
              rows,
            }}
            actions={{ setZone, setSearch, setTab, selectSector, setDialog }}
          />
          <section className="city-center">
            <div className="city-map-stage">
              <Suspense
                fallback={
                  <div className="rain-loading">
                    Preparing the Guayaquil map…
                  </div>
                }
              >
                <CityMap
                  key={prepared ? "prepared" : "online"}
                  data={data}
                  rows={scenario ? hypothetical : rows}
                  impacts={scenario ? [] : impacts}
                  selected={selected}
                  onSelect={selectSector}
                  onZone={setZone}
                  layer={layer}
                  scope={scope}
                  focus={focus}
                  phase={
                    phase === "after" && compareView === "before"
                      ? "before"
                      : phase
                  }
                  hour={hour}
                  area={area}
                  geographyMode={geographyMode}
                  onArea={chooseArea}
                  scale={scale}
                  prepared={prepared}
                  alerts={scenario ? [] : alerts}
                  important={important}
                  locationFocus={locationFocus}
                  onIncident={showIncident}
                  onReset={backToCity}
                  resetKey={mapReset}
                />
              </Suspense>
              <div
                className="city-layer-tabs"
                role="group"
                aria-label="Map information"
              >
                {[
                  ["priority", "Area Attention"],
                  ["forecast", "Rainfall · forecast"],
                  ["rain", "Rainfall · model estimate"],
                  ["impacts", "Documented Impacts"],
                  ["verification", "Verification Needed"],
                  ["support", "Emergency Support"],
                  ["history", "Past flood exposure"],
                ]
                  .filter(
                    ([id]) =>
                      phase !== "before" ||
                      [
                        "priority",
                        "forecast",
                        "history",
                        "verification",
                        "support",
                      ].includes(id),
                  )
                  .map(([id, name]) => (
                    <button
                      key={id}
                      aria-pressed={layer === id}
                      onClick={() => {
                        setLayer(id);
                        setHour(null);
                      }}
                    >
                      {name}
                    </button>
                  ))}
              </div>
              <label className="important-findings">
                <input
                  type="checkbox"
                  checked={important}
                  onChange={(e) => setImportant(e.target.checked)}
                />
                Show Important Findings
              </label>
              {phase === "after" && (
                <div className="before-after-switch">
                  <button
                    aria-pressed={compareView === "before"}
                    onClick={() => {
                      setCompareView("before");
                      setLayer("priority");
                      setHour(null);
                    }}
                  >
                    Expected conditions
                  </button>
                  <button
                    aria-pressed={compareView === "after"}
                    onClick={() => {
                      setCompareView("after");
                      setLayer("rain");
                      setHour(null);
                    }}
                  >
                    Rain and reported locations
                  </button>
                </div>
              )}
              <MapLegend
                layer={layer}
                hour={hour}
                scale={scale}
                showPoints={phase !== "before" && compareView !== "before"}
                showChecks={
                  layer === "verification" ||
                  (layer === "priority" && important)
                }
                rows={scenario ? hypothetical : rows}
              />
              <div className="map-evidence-note">
                <Info size={15} />
                <span>
                  {phase === "before"
                    ? isOutlook
                      ? `Forecast preserved ${localDate(snapshot.issuedAt)}. Window ${event.windowStart.replace("T", " ")} to ${event.windowEnd.replace("T", " ")}.`
                      : "Archived model run initialized before the storm. Index reconstructed later, not a previously issued prediction."
                    : `${impacts.filter((i) => i.coordinates).length} candidate locations on the map · ${impacts.filter((i) => !i.coordinates).length} records without coordinates. Points do not define flooded sector polygons.`}
                </span>
              </div>
            </div>
            <RainTimeline
              event={event}
              cell={cell}
              phase={forecastDisplay ? "before" : "during"}
              hour={hour}
              onHour={(n) => {
                setHour(n);
                setLayer(forecastDisplay ? "forecast" : "rain");
              }}
            />
          </section>
          {scenario ? (
            <aside className="sector-passport">
              <div className="evidence-introduction">
                <h2>A different rain scenario</h2>
                <p>
                  This map shows a hypothetical watch priority, not real
                  impacts. Return to real evidence to inspect sources or record
                  a field check.
                </p>
                <p>
                  The original forecast and incident collection are unchanged.
                </p>
              </div>
            </aside>
          ) : layer === "support" ? (
            <EmergencySupport
              data={data}
              area={area}
              active={active}
              impacts={impacts}
              onLocation={(f) =>
                setLocationFocus({
                  coordinates: f.geometry.coordinates,
                  at: Date.now(),
                })
              }
            />
          ) : active ? (
            <SectorPassport
              row={active}
              event={event}
              snapshot={snapshot}
              impacts={impacts}
              records={records}
              data={data}
              phase={phase}
              onRecords={changeRecords}
              onSources={() => setDialog("sources")}
              onLaboratory={() => setPhase("lab")}
            />
          ) : area?.kind === "external_context" ? (
            <aside className="sector-passport episode-evidence">
              <h2>Samborondón</h2>
              <p>
                A separate canton with 246 official census polygons. These
                boundaries are shown for geographic context.
              </p>
              <p>
                No storm-specific weather, impact collection or vulnerability
                index has been validated for this canton in this application.
                Guayaquil evidence is not transferred across the river.
              </p>
              <p>
                Select a Guayaquil area to return to the analyzed storm
                evidence.
              </p>
            </aside>
          ) : area ? (
            <AreaSummary
              area={area}
              rows={rows}
              impacts={impacts}
              phase={phase}
              onSelect={selectSector}
              data={data}
            />
          ) : (
            <EpisodeEvidence
              event={event}
              phase={phase}
              onSources={() => setDialog("sources")}
              onLab={() => setPhase("lab")}
            />
          )}
        </main>
        {phase === "after" && !scenario && (
          <PostRainfallFindings
            impacts={impacts}
            event={event}
            onIncident={showIncident}
            onSupport={() => setLayer("support")}
          />
        )}
        {!scenario && (
          <FindingsPanel
            alerts={alerts}
            history={alertHistory}
            onArea={(id) =>
              chooseArea(data.territories.areas.find((a) => a.id === id))
            }
          />
        )}
        <footer className="rain-footer">
          <span>
            {scopeName} · {number(sectors.length)} sectors
          </span>
          <span>
            Dated evidence and distinct models · processed{" "}
            {localDate(data.manifest.generatedAt)}
          </span>
          <button onClick={() => setDialog("sources")}>
            Provenance and methods <ArrowUpRight size={11} />
          </button>
        </footer>
        {dialog && (
          <CityDialog
            kind={dialog}
            onScenario={() => {
              goPhase("before");
              setScenario(true);
            }}
            data={data}
            event={event}
            onClose={closeDialog}
            onPhase={goPhase}
            onLab={() => setPhase("lab")}
          />
        )}
      </div>
    </ViewBoundary>
  );
}
