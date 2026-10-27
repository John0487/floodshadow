import React, { lazy, Suspense, useState } from "react";
import SectorPassport from "./SectorPassport.jsx";
import EmergencySupport from "./EmergencySupport.jsx";
import ScenarioExplorer from "./ScenarioExplorer.jsx";
import { scenarioRows } from "./findings.js";
import { downloadJSON } from "./data.js";
const Lab = lazy(() => import("../App.jsx"));
export default function WeatherTools({
  kind,
  data,
  event,
  rows = [],
  active,
  area,
  records = [],
  onRecords,
  onNavigate,
  onEvent,
  onLocation,
  payload,
  reports = [],
}) {
  const [settings, setSettings] = useState({
    rain: 100,
    duration: 100,
    shift: 0,
    coverage: 100,
  });
  if (kind === "history")
    return (
      <>
        <p>
          Choose an event. The same map and Before / During / After windows stay
          in place.
        </p>
        <div className="unified-tool-list">
          <button onClick={() => onEvent("live")}>Current weather</button>
          {data.events.map((e) => (
            <button key={e.id} onClick={() => onEvent(e.id)}>
              {e.status === "captured_forecast"
                ? "Saved prospective forecast"
                : e.id === "oct24"
                  ? "October 24–25 rainfall"
                  : "October 19 rainfall"}
              <small>
                {e.windowStart.replace("T", " ")} to{" "}
                {e.windowEnd.replace("T", " ")}
              </small>
            </button>
          ))}
        </div>
      </>
    );
  if (kind === "tools")
    return (
      <div className="unified-tool-list">
        {[
          ["passport", "Evidence & verification"],
          ["support", "Emergency Support"],
          ["scenario", "Scenario Explorer"],
          ["lab", "Research laboratory"],
        ].map(([id, title]) => (
          <button key={id} onClick={() => onNavigate(id)}>
            {title}
          </button>
        ))}
        <button
          onClick={() =>
            downloadJSON("floodshadow-weather-evidence.json", {
              exportedAt: new Date().toISOString(),
              weather: payload,
              event,
              records,
            })
          }
        >
          Export weather & checks
        </button>
        {event && (
          <button
            onClick={async () => {
              const snapshot = data.snapshots.find(
                (s) => s.eventId === event.id,
              );
              const m = await import("./impact-report.js");
              m.saveImpactReport({
                event,
                rows: rows.map((r) => ({
                  ...r,
                  assessment: snapshot.assessments[r.sector.id],
                })),
                impacts: data.impacts.filter((i) => i.eventId === event.id),
                records,
                areas: data.territories.areas,
                alerts: [],
                snapshot,
              });
            }}
          >
            Download event PDF
          </button>
        )}
      </div>
    );
  if (kind === "support")
    return (
      <EmergencySupport
        data={data}
        area={area}
        active={active}
        impacts={reports}
        onLocation={onLocation}
      />
    );
  if (kind === "lab")
    return (
      <>
        <p>
          Experimental model. Its simulated incidents are separate from real
          weather.
        </p>
        <Suspense fallback={<p>Opening laboratory…</p>}>
          <Lab />
        </Suspense>
      </>
    );
  if (!event)
    return (
      <>
        <p>
          Choose a dated event to use saved evidence and checks. Current weather
          is kept separate.
        </p>
        <button onClick={() => onNavigate("history")}>Choose an event</button>
      </>
    );
  if (kind === "scenario")
    return (
      <ScenarioExplorer
        settings={settings}
        onChange={setSettings}
        rows={scenarioRows(rows, event, settings)}
        baseline={rows}
        onClose={() => onNavigate("tools")}
      />
    );
  if (kind === "passport")
    return active ? (
      <SectorPassport
        row={active}
        event={event}
        snapshot={data.snapshots.find((s) => s.eventId === event.id)}
        impacts={reports}
        records={records}
        data={data}
        phase="after"
        onRecords={onRecords}
        onSources={() => onNavigate("sources")}
        onLaboratory={() => onNavigate("lab")}
      />
    ) : (
      <p>
        Select a smaller map polygon first, then reopen Evidence & verification.
      </p>
    );
  return null;
}
