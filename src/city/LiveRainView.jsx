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
import {
  attentionRows,
  archivedRows,
  reportMatchesArea,
  explainRain,
  systemWarnings,
  selectForecastHour,
} from "./unified-weather.js";
import "./weather-command.css";
const CityMap = lazy(() => import("./CityMap.jsx"));
const clock = (t) =>
  t
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Guayaquil",
      }).format(
        new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t) ? t + "-05:00" : t),
      )
    : "—";
const STAGES = [
  ["forecast", "Before", "The forecast", CloudSun],
  ["now", "During", "Rain right now", CloudRain],
  ["impacts", "After", "Reported problems", MapPinned],
];
export default function LiveRainView({
  data,
  records = [],
  onRecords,
  alertHistory = [],
  storageError = "",
}) {
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
  const [forecastHour, setForecastHour] = useState(-1),
    [forecastLayer, setForecastLayer] = useState("forecast");
  const [locationFocus, setLocationFocus] = useState(null);
  const [archiveId, setArchiveId] = useState("live");
  const archivedEvent = data.events.find((e) => e.id === archiveId);
  const onHistorical = () => setDetails("history");
  const closeDetails = useCallback(() => setDetails(null), []);
  const chooseArea = (a) => {
    setArea(a);
    setLocationFocus(null);
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
      archivedEvent
        ? archivedRows(
            data,
            archivedEvent,
            data.sectors.filter((s) => s.urban),
            stage,
            records,
          )
        : liveRows(
            data.sectors.filter((s) => s.urban),
            payload,
            now,
          ),
    [data, payload, now, archivedEvent, stage, records],
  );
  const rows = useMemo(
    () =>
      area
        ? archivedEvent
          ? archivedRows(
              data,
              archivedEvent,
              data.sectors.filter((s) => area.sectorIds.includes(s.id)),
              stage,
              records,
            )
          : liveRows(
              data.sectors.filter((s) => area.sectorIds.includes(s.id)),
              payload,
              now,
            )
        : allRows,
    [area, data, payload, now, allRows, archivedEvent, stage, records],
  );
  const active = rows.find((r) => r.sector.id === selected),
    cell =
      active?.liveCell ??
      rows.find((r) => (archivedEvent ? r.liveCell : r.fresh))?.liveCell;
  const projected = useMemo(
    () => (archivedEvent ? rows : forecastRows(rows, now)),
    [rows, now, archivedEvent],
  );
  const selectedForecastTime =
    forecastHour < 0
      ? null
      : (cell?.series
          ?.filter((h) => archivedEvent || Date.parse(h.time) > now)
          .slice(0, archivedEvent ? undefined : 6)[forecastHour]?.time ?? null);
  const hourlyProjected = useMemo(
    () => selectForecastHour(projected, selectedForecastTime, !!archivedEvent),
    [projected, selectedForecastTime, archivedEvent],
  );
  const reports = archivedEvent
      ? data.impacts
          .filter((i) => i.eventId === archivedEvent.id)
          .map((i) => ({
            ...i,
            areaId: data.sectors.find((s) => s.id === i.sectorId)?.areaId,
            areaName:
              data.sectors.find((s) => s.id === i.sectorId)?.areaName ??
              i.locationText,
            publisher: "Published source",
            publishedAt: i.observedAt ?? archivedEvent.start,
          }))
      : recentReports(sourceReports, now),
    shownReports = area
      ? reports.filter((r) => reportMatchesArea(r, area.id))
      : reports;
  const ranking = useMemo(
    () => strongestAreas(data.territories.areas, allRows),
    [data.territories.areas, allRows],
  );
  const warnings = useMemo(
    () =>
      archivedEvent ? [] : systemWarnings(allRows, data.territories.areas),
    [allRows, data.territories.areas, archivedEvent],
  );
  const localWarnings = area
    ? warnings.filter((w) => w.areaId === area.id)
    : warnings;
  const forecast =
    cell && (archivedEvent || sourceFresh(cell.time, now, 45 * 60000))
      ? (archivedEvent
          ? cell.series
          : cell.series.filter((h) => Date.parse(h.time) > now)
        ).slice(0, archivedEvent ? undefined : 6)
      : [];
  const condition = archivedEvent
    ? { fresh: false, rain: null, label: "Saved event" }
    : stationCondition(payload?.station, now);
  const evaluation = useMemo(
    () =>
      evaluateRainReports(
        data.events,
        archivedEvent
          ? {
              ...context?.history,
              reports:
                context?.history?.reports?.filter(
                  (r) =>
                    Date.parse(r.observedAt) >=
                      Date.parse(archivedEvent.start) &&
                    Date.parse(r.observedAt) <= Date.parse(archivedEvent.end),
                ) ?? [],
            }
          : context?.history,
        context?.captures,
      ),
    [data.events, context, archivedEvent],
  );
  const latestCheck = evaluation.rows
    .filter((r) => r.outcome !== "unavailable")
    .at(-1);
  const chanceFresh =
    !archivedEvent &&
    context?.chance &&
    sourceFresh(context.chance.retrievedAt, now, 90 * 60000);
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
      ? forecastLayer
      : stage === "impacts"
        ? "aftermath"
        : "intensity";
  const mapRows =
    stage === "forecast"
      ? archivedEvent && forecastHour < 0
        ? hourlyProjected
        : attentionRows(hourlyProjected, true)
      : stage === "impacts"
        ? archivedEvent
          ? rows
          : attentionRows(rows)
        : rows;
  const upper =
    stage === "forecast"
      ? Math.max(1, ...hourlyProjected.map((r) => r.assessment.forecastMm ?? 0))
      : Math.max(10, ...rows.map((r) => r.assessment.modelMm ?? 0));
  const headline = archivedEvent
    ? `Saved event: ${archivedEvent.id === "oct24" ? "October 24–25" : archivedEvent.id === "oct19" ? "October 19" : "Captured forecast"}`
    : stage === "forecast"
      ? maxChance !== null
        ? `Up to ${number(maxChance)}% chance in the next hours`
        : "Checking the next hours"
      : stage === "impacts"
        ? reports.length
          ? "Reported problems and places needing a check"
          : "No recent mapped reports available"
        : condition.fresh && condition.rain
          ? "Rain reported at Guayaquil airport"
          : ranking.some((r) => r.rate > 0)
            ? "Rain is estimated across the city"
            : condition.fresh
              ? "No rain in the latest airport report"
              : "Checking current rain conditions";
  const subtitle =
    stage === "forecast"
      ? archivedEvent
        ? "Saved forecast for the selected event."
        : "Hourly rain chance and the expected six-hour total."
      : stage === "impacts"
        ? "Red: published problems. Patterned red: a system estimate to verify."
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
            aria-label="Analysis tools"
            onClick={() => setDetails("tools")}
          >
            <Layers size={18} />
            <span>Analysis tools</span>
          </button>
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
          <button aria-label="Event history" onClick={onHistorical}>
            <History size={18} />
            <span>Event history</span>
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
          <button className="event-context" onClick={onHistorical}>
            {archivedEvent
              ? "Saved event · change date"
              : "Current weather · event history"}
          </button>
          <div className="command-update">
            <span className={error ? "connection-warning" : "connection-dot"} />{" "}
            <span>
              {archivedEvent
                ? "Saved evidence · not live weather"
                : busy
                  ? "Updating…"
                  : error
                    ? "Update unavailable"
                    : payload
                      ? `Checked ${clock(payload.checkedAt)} · model ${clock(payload.weather?.cells?.[0]?.time)}`
                      : "Connecting…"}
            </span>
            <button
              aria-label="Refresh weather"
              title="Check weather sources; refreshed at most once per minute"
              onClick={() => refresh(true)}
              disabled={busy}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        {(error ||
          contextError ||
          storageError ||
          payload?.errors?.length > 0) && (
          <div className="command-warning">
            {storageError || "Some information could not update."}{" "}
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
              {stage === "forecast" && (
                <label className="forecast-time-control">
                  <span>Forecast time</span>
                  <select
                    aria-label="Forecast time"
                    value={forecastHour}
                    onChange={(e) => setForecastHour(Number(e.target.value))}
                  >
                    <option value={-1}>
                      {archivedEvent ? "Event total" : "Next 6 hours total"}
                    </option>
                    {forecast.map((h, i) => (
                      <option value={i} key={h.time}>
                        {clock(h.time)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {stage === "forecast" && (
                <select
                  className="forecast-mode-control"
                  aria-label="Forecast map information"
                  value={forecastLayer}
                  onChange={(e) => setForecastLayer(e.target.value)}
                >
                  <option value="priority">Places to watch</option>
                  <option value="forecast">Expected rain</option>
                </select>
              )}
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
                  impacts={
                    stage === "impacts"
                      ? [...shownReports, ...localWarnings]
                      : []
                  }
                  selected={selected}
                  onSelect={(id) => {
                    setSelected(id);
                    setFocus({ id, at: Date.now() });
                  }}
                  onZone={() => {}}
                  layer={mapLayer}
                  scope="urban"
                  focus={focus}
                  locationFocus={locationFocus}
                  phase="live"
                  hour={stage === "now" ? 0 : null}
                  area={area}
                  geographyMode={mode}
                  onArea={chooseArea}
                  scale={{ upper }}
                  prepared={true}
                  alerts={[]}
                  important={false}
                  onReset={resetCity}
                  resetKey={reset}
                  station={
                    stage === "now" && !archivedEvent
                      ? (payload?.station ?? null)
                      : null
                  }
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
                    ? forecastLayer === "priority"
                      ? "Places to watch"
                      : "Expected rain"
                    : stage === "impacts"
                      ? "Reports & follow-up"
                      : "Estimated rain intensity"}
                </strong>
                {stage === "now" ? (
                  <div>
                    {[
                      ["#ffffff", "No rain estimated"],
                      ["#b8dff2", "Less rain"],
                      ["#2878b7", "More rain"],
                      ["#082f64", "Stronger rain"],
                      ["#dce1e5", "Unknown"],
                    ].map(([color, label]) => (
                      <span key={label}>
                        <i style={{ background: color }} />
                        {label}
                      </span>
                    ))}
                  </div>
                ) : stage === "forecast" && forecastLayer === "priority" ? (
                  <>
                    <div>
                      <span>
                        <i style={{ background: "#b9d8bc" }} />
                        Lower attention
                      </span>
                      <span>
                        <i style={{ background: "#f3de8a" }} />
                        Watch
                      </span>
                      <span>
                        <i style={{ background: "#eda56b" }} />
                        Priority
                      </span>
                    </div>
                    <small>
                      Attention, not certainty of flooding. Gray = missing data.
                    </small>
                  </>
                ) : stage === "forecast" ? (
                  <>
                    <div className="command-rain-scale" />
                    <small>
                      {forecastHour < 0
                        ? archivedEvent
                          ? "Saved event total"
                          : "Next six hours"
                        : `Hour ending ${clock(selectedForecastTime)}`}{" "}
                      · white = no rain expected
                    </small>
                  </>
                ) : (
                  <small>
                    <i className="reported-key" />
                    Published problem · patterned red = system estimate to
                    verify · orange = watch conditions
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
              <span>Weather checks every minute</span>
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
                      {archivedEvent
                        ? "Saved"
                        : dayChance == null
                          ? "—"
                          : number(dayChance) + "%"}
                    </strong>
                    <span>
                      {archivedEvent
                        ? "Forecast for this event"
                        : "Today's highest hourly rain chance"}
                    </span>
                  </div>
                </div>
                <small className="subtle-note">
                  {archivedEvent
                    ? "Archived amounts; no probability captured"
                    : "City reference · not flood probability"}
                </small>
                <h3>
                  {archivedEvent ? "Saved hourly forecast" : "Next hours"}
                </h3>
                <div className="chance-chart">
                  {chances.map((h) => (
                    <div key={h.time}>
                      <span>{h.chance === null ? "—" : h.chance + "%"}</span>
                      <i style={{ height: (h.chance ?? 0) * 0.65 + 4 }} />
                      <time>{clock(h.time)}</time>
                    </div>
                  ))}
                </div>
                {!archivedEvent && !chances.length && (
                  <p className="quiet-empty">
                    Rain probability is unavailable.
                  </p>
                )}
                <h3>Expected rain near this selection</h3>
                {forecast.slice(0, 3).map((h) => (
                  <div className="insight-line" key={h.time}>
                    <span>{clock(h.time)}</span>
                    <strong>{explainRain(h.mm)}</strong>
                  </div>
                ))}
                <div className="official-mini">
                  <CloudSun size={17} />
                  <p>
                    {archivedEvent
                      ? "Saved forecast amounts are estimates, not rainfall observations."
                      : period
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
                      {archivedEvent
                        ? "Saved weather evidence"
                        : condition.fresh && condition.rain
                          ? "Rain observed"
                          : condition.fresh
                            ? "No rain in this report"
                            : "Observation unavailable"}
                    </strong>
                    <span>
                      {archivedEvent
                        ? "Dated event, not current conditions"
                        : `Airport station · ${clock(payload?.station?.observedAt)}`}
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
                      <small>Parts of this area · estimated</small>
                    </div>
                    <b
                      title={`${number(r.rate, 1)} mm/h equivalent model rate`}
                    >
                      {intensity(r.rate).label.replace(" rain estimated", "")}
                      <small>rain</small>
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
                <h3>
                  {archivedEvent
                    ? "Saved rainfall evidence"
                    : "Next hour near this selection"}
                </h3>
                <div className="next-hour-mini">
                  <CloudRain size={24} />
                  <strong>{explainRain(forecast[0]?.mm)}</strong>
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
                {shownReports.slice(0, 4).map((r) => (
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
                    {r.source && (
                      <a href={r.source} target="_blank" rel="noreferrer">
                        Read evidence
                      </a>
                    )}
                  </article>
                ))}
                {!shownReports.length && (
                  <p className="quiet-empty">
                    No recent mapped report is integrated here. This does not
                    mean there were no impacts.
                  </p>
                )}
                <h3>System watch zones</h3>
                {localWarnings.slice(0, 4).map((w) => (
                  <button
                    className="rain-place-row"
                    key={w.id}
                    onClick={() =>
                      chooseArea(
                        data.territories.areas.find((a) => a.id === w.areaId),
                      )
                    }
                  >
                    <span className="watch-pattern-key" />
                    <div>
                      <strong>{w.areaName}</strong>
                      <small>Rain + past flood exposure · verify</small>
                    </div>
                  </button>
                ))}
                {!localWarnings.length && (
                  <p className="subtle-note">
                    No additional watch zone meets the current rule.
                  </p>
                )}
                <p className="subtle-note">
                  Drainage condition is unknown. Past flood exposure does not
                  prove that infrastructure is damaged.
                </p>
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
          event={archivedEvent}
          rows={rows}
          active={active}
          area={area}
          records={records}
          onRecords={onRecords}
          reports={reports}
          onLocation={(f) => {
            setLocationFocus({
              coordinates: f.geometry.coordinates,
              at: Date.now(),
            });
            closeDetails();
          }}
          onEvent={(id) => {
            setArchiveId(id);
            setLocationFocus(null);
            setForecastHour(-1);
            setArea(null);
            setSelected(null);
            setFocus(null);
            setReset((n) => n + 1);
            closeDetails();
          }}
        />
      )}
    </div>
  );
}
