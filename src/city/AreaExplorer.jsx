import React, { useState } from "react";
import { Search, X, Layers, MapPin } from "lucide-react";
import { searchAreas } from "./territory.js";
export default function AreaExplorer({ catalog, area, onArea, mode, onMode }) {
  const [query, setQuery] = useState("");
  const matches = searchAreas(catalog.areas, query).slice(0, 12);
  const regions = [
    ...new Set(catalog.areas.map((a) => a.generalArea).filter(Boolean)),
  ].sort();
  return (
    <section className="area-explorer" aria-label="Named area explorer">
      <select
        aria-label="General area"
        value={area?.kind === "general_area" ? area.name : ""}
        onChange={(e) => {
          if (!e.target.value) {
            onArea(null);
            return;
          }
          const list = catalog.areas.filter(
              (a) => a.generalArea === e.target.value,
            ),
            ids = list.flatMap((a) => a.sectorIds);
          onArea({
            id: "region-" + e.target.value,
            name: e.target.value,
            kind: "general_area",
            sectorIds: ids,
            count: ids.length,
            bbox: [
              Math.min(...list.map((a) => a.bbox[0])),
              Math.min(...list.map((a) => a.bbox[1])),
              Math.max(...list.map((a) => a.bbox[2])),
              Math.max(...list.map((a) => a.bbox[3])),
            ],
          });
        }}
      >
        <option value="">Guayaquil · all general areas</option>
        {regions.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <div className="area-search">
        <Search size={15} />
        <input
          aria-label="Find a named area"
          placeholder="Find an area · Urdesa, Samanes, Samborondón…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <div
            className="area-results"
            role="listbox"
            aria-label="Matching areas"
          >
            {matches.length ? (
              matches.map((a) => (
                <button
                  key={a.id}
                  role="option"
                  aria-selected={area?.id === a.id}
                  onClick={() => {
                    onArea(a);
                    setQuery("");
                  }}
                >
                  <strong>{a.name}</strong>
                  <small>
                    {a.count} census polygons
                    {a.kind === "external_context"
                      ? " · separate canton, context only"
                      : ""}
                  </small>
                </button>
              ))
            ) : (
              <p>No matching area. Try an official name.</p>
            )}
          </div>
        )}
      </div>
      {area ? (
        <button
          className="area-active"
          onClick={() => onArea(null)}
          title="Clear area filter"
        >
          <MapPin size={13} />
          {area.name} · {area.count} polygons
          <X size={13} />
        </button>
      ) : (
        <span className="area-help">All areas · search to isolate one</span>
      )}
      <div
        className="area-mode"
        role="group"
        aria-label="Territorial subdivision"
      >
        <Layers size={14} />
        <button
          aria-pressed={mode === "polygons"}
          onClick={() => onMode("polygons")}
        >
          Census polygons
        </button>
        <button aria-pressed={mode === "areas"} onClick={() => onMode("areas")}>
          Named areas
        </button>
      </div>
    </section>
  );
}
