import React, { useEffect, useState } from "react";
import { Clock3, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { number } from "./format.js";
export default function RainTimeline({ event, cell, phase, hour, onHour }) {
  const series = cell?.series ?? [];
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setPlaying(false);
  }, [event.id]);
  useEffect(() => {
    if (!playing || !series.length) return;
    const timer = setTimeout(() => {
      const next = hour === null ? 0 : hour + 1;
      if (next >= series.length) {
        setPlaying(false);
        return;
      }
      onHour(next);
    }, 1300);
    return () => clearTimeout(timer);
  }, [playing, hour, series.length, onHour]);
  const maximum = Math.max(1, ...series.map((x) => x.mm ?? 0));
  const value = hour === null ? null : series[hour];
  return (
    <section className="rain-timeline" aria-label="Hourly rainfall timeline">
      <div className="timeline-heading">
        <span>
          <Clock3 size={16} />
          {phase === "before"
            ? event.status === "captured_forecast"
              ? "Saved forecast"
              : "Expected rain for this storm"
            : "Modeled rainfall"}{" "}
          <small>
            {cell
              ? "Reference cell · " +
                cell.coordinates.map((x) => number(x, 3)).join(", ")
              : "No cell available"}
          </small>
        </span>
        <strong>
          {value ? `${number(value.mm, 1)} mm/h` : "Window total"}
        </strong>
      </div>
      <div
        className="timeline-chart"
        role="img"
        aria-label="Hourly rainfall bars in millimeters per hour"
      >
        {series.map((p, i) => (
          <button
            key={p.time}
            aria-label={`${p.time}: ${p.mm === null ? "no data" : number(p.mm, 1) + " mm per hour"}`}
            className={hour === i ? "active" : ""}
            onClick={() => onHour(i)}
            title={`${p.time} · ${number(p.mm, 1)} mm/h`}
          >
            <i
              style={{
                height:
                  p.mm === null
                    ? "3px"
                    : `${Math.max(3, (100 * p.mm) / maximum)}%`,
              }}
            />
          </button>
        ))}
      </div>
      <div className="timeline-controls">
        <button
          aria-label={
            playing ? "Pause rainfall replay" : "Play rainfall replay"
          }
          disabled={!series.length}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button
          aria-label="Previous hour"
          disabled={!series.length}
          onClick={() => onHour(Math.max(0, (hour ?? 1) - 1))}
        >
          <ChevronLeft size={15} />
        </button>
        <input
          aria-label="Storm hour"
          type="range"
          min="0"
          max={Math.max(0, series.length - 1)}
          value={hour ?? 0}
          disabled={!series.length}
          onChange={(e) => onHour(Number(e.target.value))}
        />
        <button
          aria-label="Next hour"
          disabled={!series.length}
          onClick={() => onHour(Math.min(series.length - 1, (hour ?? -1) + 1))}
        >
          <ChevronRight size={15} />
        </button>
        <button
          className="timeline-total"
          aria-pressed={hour === null}
          onClick={() => onHour(null)}
        >
          Show total
        </button>
      </div>
      <p>
        {value
          ? value.time.replace("T", " · ")
          : `${event.windowStart.replace("T", " ")} — ${event.windowEnd.replace("T", " ")}`}{" "}
        · UTC−5.{" "}
        {phase === "before"
          ? "Model output, not a measurement."
          : "Incidents have no individual timestamps: they remain visible throughout the storm window."}
      </p>
    </section>
  );
}
