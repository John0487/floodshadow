import React from "react";
import { number } from "./format.js";
import { ATTENTION, UNKNOWN, attentionCounts } from "./map-model.js";
export default function MapLegend({
  layer,
  hour,
  scale = { upper: 200 },
  showPoints = true,
  showChecks = false,
  rows = [],
}) {
  const rain = ["rain", "forecast"].includes(layer);
  const counts = attentionCounts(rows);
  return (
    <div className={"city-legend " + layer}>
      <strong>
        {
          {
            priority: "Area Attention",
            forecast: "Forecast rain",
            rain: "Modeled rain",
            impacts: "Documented Impacts",
            verification: "Verification Needed",
            support: "Emergency Support",
            history: "Past flood exposure",
          }[layer]
        }
      </strong>
      {layer === "priority" ? (
        <>
          {ATTENTION.map((c) => (
            <span key={c.min}>
              <i className="legend-box" style={{ background: c.color }} />
              {c.label} ·{" "}
              {c.min === 0 ? "0–29" : c.min === 30 ? "30–59" : "60–100"}
            </span>
          ))}
          <small>
            Priority to gather evidence, not chance of flooding. Lower attention
            does not mean safe.
          </small>
        </>
      ) : rain ? (
        <>
          <div className="legend-gradient" />
          <div className="legend-values">
            <span>0</span>
            <span>
              {number(scale.upper)} {hour === null ? "mm" : "mm/h"}
            </span>
          </div>
          <small>
            {layer === "forecast"
              ? "Saved weather-model forecast"
              : "Later weather-model estimate; not a rain gauge"}
            . Darker blue means more rain. Nearby areas can share one ≈9 km
            model cell.
          </small>
        </>
      ) : layer === "support" ? (
        <>
          <span>
            <i className="legend-dot" style={{ background: "#147d86" }} />
            Official meeting point
          </span>
          <span>
            <i className="legend-dot" style={{ background: "#735a9d" }} />
            Potential shelter · activation unknown
          </span>
          <small>
            No destination or travel route has been confirmed available for this
            event.
          </small>
        </>
      ) : layer === "verification" ? (
        <>
          <span>
            <i className="legend-dot" style={{ background: "#8356b1" }} />
            Place needing an evidence check
          </span>
          <small>Area reference point; not an observed flood location.</small>
        </>
      ) : layer === "impacts" ? (
        <small>
          Red markers show published candidate locations. No fill claims an
          entire area flooded. Open a marker to inspect its evidence.
        </small>
      ) : (
        <small>
          Land inside a documented past flood-prone footprint. This is not the
          flooded area of this storm.
        </small>
      )}
      {!["impacts", "verification", "support"].includes(layer) && (
        <span>
          <i className="legend-box" style={{ background: UNKNOWN }} />
          Not enough information
        </span>
      )}
      {(showPoints || layer === "impacts" || layer === "support") && (
        <span>
          <i className="legend-dot red" />
          Reported problem · approximate location
        </span>
      )}
      {showChecks && layer !== "verification" && (
        <>
          <span>
            <i className="legend-dot" style={{ background: "#8356b1" }} />
            Needs a check · no flood confirmed
          </span>
          <small>
            Purple marks an area to review. Click for the reason; choose Explore
            this area to zoom in.
          </small>
        </>
      )}
      {layer === "priority" && (
        <small>
          Smaller areas: {counts.lower} lower · {counts.watch} preventive ·{" "}
          {counts.priority} priority · {counts.unknown} unknown. Known parts
          retain their colors; missing parts stay gray.
        </small>
      )}
    </div>
  );
}
