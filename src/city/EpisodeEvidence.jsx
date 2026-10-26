import React from "react";
import { BookOpen, CloudRain, ArrowUpRight, MapPin } from "lucide-react";
export default function EpisodeEvidence({ event, phase, onSources, onLab }) {
  if (phase === "before")
    return (
      <aside className="sector-passport episode-evidence">
        <div className="sector-passport-head">
          <span>
            <BookOpen size={15} /> Forecast evidence
          </span>
        </div>
        <div className="evidence-introduction">
          <h2>Read the forecast. Inspect the context.</h2>
          <p>
            {event.status === "captured_forecast"
              ? "This forecast and index were captured before their rainfall window. Independent observations are needed for evaluation."
              : "This is an archived run and a later reconstruction of the index. It is not a prediction issued by FLOODSHADOW before this storm."}
          </p>
        </div>
        <section className="event-source-note">
          <h3>Every sector stays visible</h3>
          <p>
            Select any sector polygon to inspect its forecast, historical
            footprint, index contributions and missing evidence. Gray means
            missing data, not safety.
          </p>
          <p>
            Weather cells have a nominal resolution of about 9 km. Sector
            polygons do not increase forecast precision.
          </p>
          <button className="rain-secondary" onClick={onSources}>
            View all sources
          </button>
        </section>
      </aside>
    );
  return (
    <aside className="sector-passport episode-evidence">
      <div className="sector-passport-head">
        <span>
          <BookOpen size={15} /> Storm evidence
        </span>
      </div>
      <div className="evidence-introduction">
        <h2>
          {event.status === "captured_forecast"
            ? "A forecast we can preserve and evaluate."
            : event.observations.length
              ? "Rainfall varied across the city."
              : "68 locations do not mean 68 flooded neighborhoods."}
        </h2>
        <p>
          {event.status === "captured_forecast"
            ? "This forecast was saved before its rainfall window. Receipt time is recorded; subsequent observations are not yet available."
            : event.observations.length
              ? "The stations published by ESPOL recorded different totals. These measurements are not extrapolated to streets or sectors without data."
              : "The list describes water accumulation at specific locations. These points do not define the affected area of a neighborhood."}
        </p>
      </div>
      {event.observations.length ? (
        <section className="station-list">
          <h3>
            <CloudRain size={16} /> Published measurements
          </h3>
          {event.observations.map((o) => (
            <div key={o.id}>
              <span>{o.name}</span>
              <strong>
                {o.mm}
                <small> mm</small>
              </strong>
            </div>
          ))}
          <p>
            October 19, 2026. Exact measurement windows and instrument
            coordinates were not published. These values were not interpolated.
          </p>
          <a href={event.source} target="_blank" rel="noreferrer">
            ESPOL institutional source <ArrowUpRight size={12} />
          </a>
        </section>
      ) : (
        <section className="evidence-key">
          <h3>How to read the map</h3>
          <p>
            <i className="key-dot red" />A red point is a candidate intersection
            from a published record; its location requires review.
          </p>
          <p>
            <i className="key-dot gray" />
            An area without a record remains unconfirmed. It is not classified
            as safe.
          </p>
          <p>
            <i className="key-dot amber" />
            The vigilance index highlights territorial context, not verified
            flooding.
          </p>
        </section>
      )}
      <section className="event-source-note">
        <h3>One storm, three perspectives</h3>
        <p>
          Before: archived weather model run.
          <br />
          During: modeled rainfall and available evidence.
          <br />
          After: records, verifications and evaluation limits.
        </p>
        <button className="rain-secondary" onClick={onSources}>
          View all sources
        </button>
      </section>
      <section className="event-source-note">
        <h3>What might we be missing?</h3>
        <p>
          Shadow Detection combines vigilance and incomplete information to
          prioritize evidence collection. Probabilistic adaptive verification is
          preserved in a separate experimental environment.
        </p>
        <button className="text-action" onClick={onLab}>
          Explore the laboratory <ArrowUpRight size={13} />
        </button>
      </section>
      <p className="select-prompt">
        <MapPin size={16} /> Select a sector polygon or search an INEC code to
        open its evidence passport.
      </p>
    </aside>
  );
}
