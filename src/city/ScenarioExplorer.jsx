import React from "react";
export default function ScenarioExplorer({
  settings,
  onChange,
  rows,
  baseline,
  onClose,
}) {
  const high = rows.filter((r) => r.assessment.score >= 60).length,
    prior = baseline.filter((r) => r.assessment.score >= 60).length;
  return (
    <section
      className="scenario-explorer"
      aria-label="Rainfall Scenario Explorer"
    >
      <div>
        <strong>Simulation — Not a real-time observation</strong>
        <button onClick={onClose}>Return to real evidence</button>
      </div>
      <h2>What if the rain were different?</h2>
      <p>
        Start with the saved forecast. Change one assumption and see which
        smaller areas may deserve attention. No simulated impacts are added to
        the real map. The timeline below keeps the original saved forecast.
      </p>
      {[
        ["rain", "Rain amount", 0, 200, "% of the saved forecast"],
        ["duration", "Storm duration", 50, 200, "% of the original window"],
        ["shift", "North / south shift", -50, 50, "% tilt toward the north"],
        [
          "coverage",
          "Available weather cells",
          0,
          100,
          "% kept for this scenario",
        ],
      ].map(([key, label, min, max, unit]) => (
        <label key={key}>
          {label}
          <strong>
            {settings[key]} {unit}
          </strong>
          <input
            aria-label={label}
            type="range"
            min={min}
            max={max}
            step="10"
            value={settings[key]}
            onChange={(e) =>
              onChange({ ...settings, [key]: Number(e.target.value) })
            }
          />
        </label>
      ))}
      <p>
        <b>{high}</b> of {rows.length} smaller areas reach the watch threshold
        in this scenario; <b>{prior}</b> in the original forecast. Missing
        values stay unknown.
      </p>
      <details>
        <summary>How this scenario works</summary>
        <p>
          Rain and duration multiply the original total; duration assumes the
          original average rate continues. The spatial control tilts the six
          sampled cells north or south. Coverage removes a deterministic subset
          of cells. Rain is compared with the original episode’s fixed cell
          distribution, so the reference does not move with the slider. This is
          a sensitivity experiment, not a hydraulic flood model.
        </p>
      </details>
    </section>
  );
}
