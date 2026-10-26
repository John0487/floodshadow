import React, { lazy, Suspense, useMemo, useState, useCallback } from "react";
import {
  CloudSun,
  CloudRain,
  MapPinned,
  Waves,
  History,
  Database,
  RefreshCw,
  ChartNoAxesCombined,
  Search,
  Layers,
  Info,
  ArrowLeft,
  CloudLightning,
  ChevronRight,
} from "lucide-react";
import useWeatherFeed from "./useWeatherFeed.js";
import WeatherDetails from "./WeatherDetails.jsx";
import { liveRows, stationCondition, sourceFresh } from "./live-weather.js";
import {
  forecastRows,
  recentReports,
  strongestAreas,
  intensity,
  evaluateRainReports,
} from "./rain-journey.js";
import { searchAreas } from "./territory.js";
import { number, localDate } from "./format.js";
import "./weather-command.css";
const CityMap = lazy(() => import("./CityMap.jsx"));
const clock = (t) =>
  t
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Guayaquil",
      }).format(new Date(t))
    : "—";
const STAGES = [
  ["forecast", "Before", "The forecast", CloudSun],
  ["now", "During", "Rain right now", CloudRain],
  ["impacts", "After", "Reported problems", MapPinned],
];
export default function LiveRainView({ data, onHistorical }) {
  const {
    payload,
    context,
    reports: sourceReports,
    error,
    contextError,
    busy,
    now,
    refresh,
  } = useWeatherFeed();
  const [stage, setStage] = useState("now"),
    [area, setArea] = useState(null),
    [mode, setMode] = useState("areas"),
    [selected, setSelected] = useState(null),
    [focus, setFocus] = useState(null),
    [reset, setReset] = useState(0),
    [query, setQuery] = useState(""),
    [details, setDetails] = useState(null),
    [layersOpen, setLayersOpen] = useState(false);
  const closeDetails = useCallback(() => setDetails(null), []);
  const chooseArea = (a) => {
    setArea(a);
    setSelected(null);
    setFocus(null);
    setQuery("");
  };
  const resetCity = () => {
    chooseArea(null);
    setReset((n) => n + 1);
  };
  const allRows = useMemo(
    () =>
      liveRows(
        data.sectors.filter((s) => s.urban),
        payload,
        now,
      ),
    [data.sectors, payload, now],
  );
  const rows = useMemo(
    () =>
      area
        ? liveRows(
            data.sectors.filter((s) => area.sectorIds.includes(s.id)),
            payload,
            now,
          )
        : allRows,
    [area, data.sectors, payload, now, allRows],
  );
  const projected = useMemo(() => forecastRows(rows, now), [rows, now]);
  const reports = recentReports(sourceReports, now),
    shownReports = area ? reports.filter((r) => r.areaId === area.id) : reports;
  const ranking = useMemo(
    () => strongestAreas(data.territories.areas, allRows),
    [data.territories.areas, allRows],
  );
  const active = rows.find((r) => r.sector.id === selected),
    cell = active?.liveCell ?? rows.find((r) => r.fresh)?.liveCell;
  const forecast =
    cell && sourceFresh(cell.time, now, 45 * 60000)
      ? cell.series.filter((h) => Date.parse(h.time) > now).slice(0, 6)
      : [];
  const condition = stationCondition(payload?.station, now);
  const evaluation = useMemo(
    () => evaluateRainReports(data.events, context?.history, context?.captures),
    [data.events, context],
  );
  const latestCheck = evaluation.rows
    .filter((r) => r.outcome !== "unavailable")
    .at(-1);
  const chanceFresh =
    context?.chance && sourceFresh(context.chance.retrievedAt, now, 90 * 60000);
  const chances = chanceFresh
    ? context.chance.hours.filter((h) => Date.parse(h.time) > now).slice(0, 6)
    : [];
  const today = new Date(now - 18000000).toISOString().slice(0, 10),
    dayChance = chanceFresh
      ? context.chance.days.find((d) => d.date === today)?.maxHourlyChance
      : null;
  const maxChance = chances.some((h) => h.chance !== null)
    ? Math.max(...chances.filter((h) => h.chance !== null).map((h) => h.chance))
    : null;
  const period = context?.inamhi?.periods.find(
    (p) => Date.parse(p.start) <= now && Date.parse(p.end) > now,
  );
  const mapLayer =
    stage === "forecast"
      ? "forecast"
      : stage === "impacts"
        ? "impacts"
        : "intensity";
  const mapRows =
    stage === "forecast"
      ? projected
      : stage === "impacts"
        ? rows.map((r) => ({
            ...r,
            assessment: { ...r.assessment, modelMm: null },
            weatherCell: { series: [{ mm: null }] },
          }))
        : rows;
  const upper =
    stage === "forecast"
      ? Math.max(10, ...projected.map((r) => r.assessment.forecastMm ?? 0))
      : Math.max(10, ...rows.map((r) => r.assessment.modelMm ?? 0));
  const headline =
    stage === "forecast"
      ? maxChance !== null
        ? `Up to ${number(maxChance)}% chance in the next hours`
        : "Checking the next hours"
      : stage === "impacts"
        ? reports.length
          ? `${new Set(reports.map((r) => r.areaId)).size} area with a recent published report`
          : "No recent mapped reports available"
        : condition.fresh && condition.rain
          ? "Rain reported at Guayaquil airport"
          : ranking.some((r) => r.rate > 0)
            ? "Rain is estimated across the city"
            : "Checking current rain conditions";
  const subtitle =
    stage === "forecast"
      ? "Hourly rain chance and the expected six-hour total."
      : stage === "impacts"
        ? "Reported locations, not the extent of flooding."
        : "Select a neighborhood to see its conditions.";
  const matches = query
    ? searchAreas(data.territories.areas, query).slice(0, 7)
    : [];
  return (
    <div className="command-app">
      <aside className="command-rail">
        <a
          href="#"
          className="command-brand"
          aria-label="FLOODSHADOW · Back to Guayaquil"
          onClick={(e) => {
            e.preventDefault();
            resetCity();
          }}
        >
          <Waves size={30} />
          <span>
            FLOOD
            <br />
            SHADOW
          </span>
        </a>
        <nav aria-label="Rainfall stages">
          {STAGES.map(([id, label, sub, Icon]) => (
            <button
              key={id}
              aria-pressed={stage === id}
              onClick={() => setStage(id)}
            >
              <Icon size={21} />
              <span>
                <strong>{label}</strong>
                <small>{sub}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className="rail-tools">
          <button
            aria-label="Forecast review"
            onClick={() => setDetails("check")}
          >
            <ChartNoAxesCombined size={18} />
            <span>Forecast review</span>
          </button>
          <button aria-label="Sources" onClick={() => setDetails("sources")}>
            <Database size={18} />
            <span>Sources</span>
          </button>
          <button aria-label="Saved storms" onClick={onHistorical}>
            <History size={18} />
            <span>Saved storms</span>
          </button>
        </div>
        <span className="rail-footer">Guayaquil · Ecuador</span>
      </aside>
      <main className="command-main">
        <header className="command-header">
          <div>
            <div className="command-location">
              Guayaquil{" "}
              {area && (
                <>
                  <ChevronRight size={12} />
                  <span>{area.name}</span>
                </>
              )}
            </div>
            <h1>{headline}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="command-update">
            <span className={error ? "connection-warning" : "connection-dot"} />{" "}
            <span>
              {busy
                ? "Updating…"
                : error
                  ? "Update unavailable"
                  : payload
                    ? `Checked ${clock(payload.checkedAt)}`
                    : "Connecting…"}
            </span>
            <button
              aria-label="Refresh weather"
              title="Check weather sources; shared cache refreshes every 5 minutes"
              onClick={refresh}
              disabled={busy}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        {(error || contextError || payload?.errors?.length > 0) && (
          <div className="command-warning">
            Some information could not update.{" "}
            <button onClick={() => setDetails("sources")}>
              Check sources and dates
            </button>
          </div>
        )}
        <section className="command-workspace">
          <div className="command-map-column">
            <div className="command-map-toolbar">
              <div className="command-search">
                <Search size={15} />
                <input
                  aria-label="Find a named area"
                  placeholder="Find a neighborhood…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <div
                    className="command-results"
                    role="listbox"
                    aria-label="Matching areas"
                  >
                    {matches.length ? (
                      matches.map((a) => (
                        <button
                          key={a.id}
                          role="option"
                          aria-selected={area?.id === a.id}
                          onClick={() => chooseArea(a)}
                        >
                          {a.name}
                        </button>
                      ))
                    ) : (
                      <span>No matching area</span>
                    )}
                  </div>
                )}
              </div>
              <div className="command-layers">
                <button
                  aria-label="Map detail options"
                  aria-expanded={layersOpen}
                  onClick={() => setLayersOpen((v) => !v)}
                >
                  <Layers size={16} />
                  <span>Map detail</span>
                </button>
                {layersOpen && (
                  <div role="group" aria-label="Map detail">
                    <button
                      aria-pressed={mode === "areas"}
                      onClick={() => {
                        setMode("areas");
                        setLayersOpen(false);
                      }}
                    >
                      Named areas
                    </button>
                    <button
                      aria-pressed={mode === "polygons"}
                      onClick={() => {
                        setMode("polygons");
                        setLayersOpen(false);
                      }}
                    >
                      Census boundaries
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="command-map">
              <Suspense
                fallback={
                  <div className="command-map-loading">
                    Preparing Guayaquil…
                  </div>
                }
              >
                <CityMap
                  data={data}
                  rows={mapRows}
                  impacts={stage === "impacts" ? shownReports : []}
                  selected={selected}
                  onSelect={(id) => {
                    setSelected(id);
                    setFocus({ id, at: Date.now() });
                  }}
                  onZone={() => {}}
                  layer={mapLayer}
                  scope="urban"
                  focus={focus}
                  phase="live"
                  hour={stage === "forecast" ? null : 0}
                  area={area}
                  geographyMode={mode}
                  onArea={chooseArea}
                  scale={{ upper }}
                  prepared={true}
                  alerts={[]}
                  important={false}
                  onReset={resetCity}
                  resetKey={reset}
                  station={stage === "now" ? (payload?.station ?? null) : null}
                  onIncident={(r) => {
                    const a = data.territories.areas.find(
                      (a) => a.id === r.areaId,
                    );
                    if (a) chooseArea(a);
                  }}
                />
              </Suspense>
              <div className="command-legend" aria-label="Map legend">
                <strong>
                  {stage === "forecast"
                    ? "Expected rain · next 6 hours"
                    : stage === "impacts"
                      ? "Published reports"
                      : "Estimated rain intensity"}
                </strong>
                {stage === "now" ? (
                  <div>
                    {[
                      ["#b4d9e6", "Light"],
                      ["#479fba", "Moderate"],
                      ["#e7a05e", "Heavy"],
                      ["#dce1e5", "Unknown"],
                    ].map(([color, label]) => (
                      <span key={label}>
                        <i style={{ background: color }} />
                        {label}
                      </span>
                    ))}
                  </div>
                ) : stage === "forecast" ? (
                  <>
                    <div className="command-rain-scale" />
                    <small>0 — {number(upper, 1)} mm · gray = unknown</small>
                  </>
                ) : (
                  <small>
                    <i className="reported-key" />
                    Reported somewhere in this area. Exact extent unknown.
                  </small>
                )}
                <button
                  aria-label="Explain the map"
                  onClick={() => setDetails("sources")}
                >
                  <Info size={14} />
                </button>
              </div>
            </div>
            <footer className="command-map-footer">
              <span>
                {stage === "now"
                  ? "Model estimate · ≈9 km cells"
                  : stage === "forecast"
                    ? "Forecast, not an observation"
                    : "Dated sources, not a damage ranking"}
              </span>
              <span>Weather checks every 5 min</span>
            </footer>
          </div>
          <aside
            className="command-insights"
            aria-label="Selected stage summary"
          >
            <div className="insight-place">
              <MapPinned size={16} />
              <h2>{active?.sector.areaName ?? area?.name ?? "Guayaquil"}</h2>
              {area && (
                <button aria-label="Clear selected area" onClick={resetCity}>
                  <ArrowLeft size={16} />
                </button>
              )}
            </div>
            {stage === "forecast" ? (
              <>
                <div className="chance-lead">
                  <CloudSun size={32} />
                  <div>
                    <strong>
                      {dayChance == null ? "—" : number(dayChance) + "%"}
                    </strong>
                    <span>Today's highest hourly rain chance</span>
                  </div>
                </div>
                <small className="subtle-note">
                  City reference · not flood probability
                </small>
                <h3>Next hours</h3>
                <div className="chance-chart">
                  {chances.map((h) => (
                    <div key={h.time}>
                      <span>{h.chance === null ? "—" : h.chance + "%"}</span>
                      <i style={{ height: (h.chance ?? 0) * 0.65 + 4 }} />
                      <time>{clock(h.time)}</time>
                    </div>
                  ))}
                </div>
                {!chances.length && (
                  <p className="quiet-empty">
                    Rain probability is unavailable.
                  </p>
                )}
                <h3>Expected rain near this selection</h3>
                {forecast.slice(0, 3).map((h) => (
                  <div className="insight-line" key={h.time}>
                    <span>{clock(h.time)}</span>
                    <strong>
                      {h.mm === null ? "Unknown" : number(h.mm, 1) + " mm"}
                    </strong>
                  </div>
                ))}
                <div className="official-mini">
                  <CloudSun size={17} />
                  <p>
                    {period
                      ? `INAMHI: ${period.description.toLowerCase()} for this period.`
                      : "Official city forecast pending."}
                  </p>
                </div>
                <button
                  className="insight-link"
                  onClick={() => setDetails("climate")}
                >
                  How does El Niño affect the outlook?{" "}
                  <ChevronRight size={14} />
                </button>
              </>
            ) : stage === "now" ? (
              <>
                <div className="observed-mini">
                  <CloudLightning size={26} />
                  <div>
                    <strong>
                      {condition.fresh && condition.rain
                        ? "Rain observed"
                        : condition.fresh
                          ? "No rain in this report"
                          : "Observation unavailable"}
                    </strong>
                    <span>
                      Airport station · {clock(payload?.station?.observedAt)}
                    </span>
                  </div>
                </div>
                <h3>
                  {area ? "Around this selection" : "Stronger rain estimates"}
                </h3>
                {(area
                  ? strongestAreas([area], rows)
                  : ranking.slice(0, 4)
                ).map((r) => (
                  <button
                    className="rain-place-row"
                    key={r.area.id}
                    onClick={() => chooseArea(r.area)}
                  >
                    <span
                      className="rain-intensity-dot"
                      style={{ background: intensity(r.rate).color }}
                    />
                    <div>
                      <strong>{r.area.name}</strong>
                      <small>
                        {intensity(r.rate).label.replace(" estimated", "")}
                      </small>
                    </div>
                    <b>
                      {number(r.rate, 1)}
                      <small>mm/h</small>
                    </b>
                  </button>
                ))}
                {!ranking.length && (
                  <p className="quiet-empty">Waiting for fresh model data.</p>
                )}
                <p className="subtle-note">
                  Peak estimate in parts of each area. Shared cells can have the
                  same value.
                </p>
                <h3>Next hour near this selection</h3>
                <div className="next-hour-mini">
                  <CloudRain size={24} />
                  <strong>
                    {forecast[0]?.mm == null
                      ? "—"
                      : number(forecast[0].mm, 1) + " mm"}
                  </strong>
                  <span>by {clock(forecast[0]?.time)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="reported-count">
                  <strong>{shownReports.length}</strong>
                  <span>
                    recent source{" "}
                    {shownReports.length === 1 ? "report" : "reports"} in this
                    selection
                  </span>
                </div>
                {shownReports.map((r) => (
                  <article className="incident-mini" key={r.id}>
                    <button
                      onClick={() =>
                        chooseArea(
                          data.territories.areas.find((a) => a.id === r.areaId),
                        )
                      }
                    >
                      <span className="incident-dot" />
                      <strong>{r.areaName}</strong>
                      <ChevronRight size={14} />
                    </button>
                    <p>
                      Flooding reported. Exact streets and extent need review.
                    </p>
                    <small>
                      {r.publisher} · {localDate(r.publishedAt)}
                    </small>
                    <a href={r.source} target="_blank" rel="noreferrer">
                      Read evidence
                    </a>
                  </article>
                ))}
                {!shownReports.length && (
                  <p className="quiet-empty">
                    No recent mapped report is integrated here. This does not
                    mean there were no impacts.
                  </p>
                )}
                <div className="forecast-result-mini">
                  <ChartNoAxesCombined size={20} />
                  <strong>
                    {latestCheck?.label ?? "Forecast comparison pending"}
                  </strong>
                  <button onClick={() => setDetails("check")}>
                    See the comparison
                  </button>
                </div>
                <p className="subtle-note">
                  Reports do not establish which area suffered the most damage.
                </p>
                <button className="insight-link" onClick={onHistorical}>
                  Earlier events & verification history{" "}
                  <ChevronRight size={14} />
                </button>
              </>
            )}
          </aside>
        </section>
      </main>
      {details && (
        <WeatherDetails
          kind={details}
          onClose={closeDetails}
          context={context}
          payload={payload}
          data={data}
          onNavigate={setDetails}
          onHistorical={onHistorical}
        />
      )}
    </div>
  );
}
