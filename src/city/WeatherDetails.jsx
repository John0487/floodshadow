import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ForecastCheck } from "./RainJourney.jsx";
import { localDate } from "./format.js";
export default function WeatherDetails({
  kind,
  onClose,
  context,
  payload,
  data,
  onNavigate,
  onHistorical,
}) {
  const close = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const elements = close.current
          ?.closest("[role=dialog]")
          ?.querySelectorAll("button,a[href],summary");
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="weather-overlay" onClick={onClose}>
      <section
        className="weather-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={
          kind === "check"
            ? "Forecast review"
            : kind === "climate"
              ? "El Niño context"
              : "Sources and evidence"
        }
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>
            {kind === "check"
              ? "Forecast review"
              : kind === "climate"
                ? "El Niño context"
                : "Sources & evidence"}
          </h2>
          <button ref={close} aria-label="Close details" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {kind === "check" ? (
          <ForecastCheck context={context} events={data.events} />
        ) : kind === "climate" ? (
          <>
            <p>
              The official October outlook describes wetter-than-usual
              conditions for the Coast.
            </p>
            <p>
              El Niño provides seasonal context. It does not determine the hour
              or street where a storm will occur.
            </p>
            <a
              href="https://www.agricultura.gob.ec/estado-del-evento-el-nino/"
              target="_blank"
              rel="noreferrer"
            >
              Official summary referencing ERFEN · October 1, 2026
            </a>
            <p>
              <a
                href="https://alertasecuador.gob.ec/el_nino/boletines-emitidos-por-el-nino/"
                target="_blank"
                rel="noreferrer"
              >
                Check the official bulletin collection
              </a>
            </p>
          </>
        ) : (
          <>
            <h3>Rain estimates & chance</h3>
            <p>
              Open-Meteo supplies model estimates at approximately 9 km
              resolution. Rain chance is a separate city-reference forecast, not
              a percentage computed by FLOODSHADOW.
            </p>
            <a
              href={
                payload?.sources?.weather ?? "https://open-meteo.com/en/docs"
              }
              target="_blank"
              rel="noreferrer"
            >
              Current model data
            </a>
            <p>
              <a
                href={
                  context?.chance?.source ?? "https://open-meteo.com/en/docs"
                }
                target="_blank"
                rel="noreferrer"
              >
                Hourly rain probability
              </a>{" "}
              · received {localDate(context?.chance?.retrievedAt)}
            </p>
            <h3>Airport observations</h3>
            <p>{payload?.station?.raw ?? "No observation available"}</p>
            <p>
              Observed {localDate(payload?.station?.observedAt)}. The airport
              does not represent every neighborhood.
            </p>
            <a
              href={
                payload?.sources?.station ??
                "https://aviationweather.gov/data/api/"
              }
              target="_blank"
              rel="noreferrer"
            >
              NOAA METAR source
            </a>
            <h3>INAMHI city forecast</h3>
            <p>
              Valid date: {context?.inamhi?.date ?? "Unavailable"}. Issue time
              not provided.
            </p>
            {context?.inamhi?.periods?.map((p) => (
              <p key={p.start}>
                {localDate(p.start)}: {p.description}
              </p>
            ))}
            <a
              href={
                context?.inamhi?.source ??
                "https://servicios.inamhi.gob.ec/aplicaciones-web/"
              }
              target="_blank"
              rel="noreferrer"
            >
              Official INAMHI source
            </a>
            <h3>Municipal updates</h3>
            {context?.bulletins?.items?.slice(0, 4).map((p) => (
              <p key={p.id}>
                <a href={p.url} target="_blank" rel="noreferrer">
                  Bulletin · {localDate(p.publishedAt)}
                </a>
              </p>
            ))}
            <p>
              Bulletins are source discovery, not automatically verified
              incidents. Recent map reports include a dated, source-reviewed
              Urdesa mention; exact streets and damage extent remain unverified.
            </p>
            <h3>Coverage gaps</h3>
            <p>
              The checked RainViewer mask has no coverage at central Guayaquil.
              INAMHI's station-list request timed out. Neither failure means
              there is no rain.
            </p>
            <p>
              Old model data and station reports are labeled or excluded. “No
              rain reported” at one moment does not prove an entire hour was
              dry.
            </p>
            {context?.errors?.map((e) => (
              <p role="status" key={e.source}>
                {e.source}: {e.message}
              </p>
            ))}
          </>
        )}
        <footer className="drawer-navigation">
          <button onClick={() => onNavigate?.("check")}>Forecast review</button>
          <button onClick={onHistorical}>Saved storms</button>
        </footer>
      </section>
    </div>
  );
}
