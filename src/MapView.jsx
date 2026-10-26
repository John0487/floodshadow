import React, { useEffect, useRef, useState } from "react";
import * as maplibre from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { bbox, featureCollection, point } from "@turf/turf";
import { LocateFixed, Maximize2, MapPin } from "lucide-react";
maplibre.setWorkerUrl(workerUrl);
export const PRIORITY = ["#f5e4b4", "#ebc76e", "#e3a348", "#d77435", "#b94f30"];
export function color(value) {
  return value == null || !Number.isFinite(value)
    ? "#a7afb8"
    : PRIORITY[Math.max(0, Math.min(4, Math.floor(value / 20)))];
}
const empty = () => ({ type: "FeatureCollection", features: [] });
export default function MapView({
  geo,
  flood,
  events,
  eventsVisible,
  rows,
  selected,
  onSelect,
  layer,
  showFlood,
  topIds,
  queued,
  focusSignal,
}) {
  const container = useRef(),
    mapRef = useRef(),
    current = useRef({
      rows,
      selected,
      onSelect,
      layer,
      showFlood,
      topIds,
      queued,
    });
  current.current = {
    rows,
    selected,
    onSelect,
    layer,
    showFlood,
    topIds,
    queued,
  };
  const [ready, setReady] = useState(false),
    [baseError, setBaseError] = useState(false),
    [fatal, setFatal] = useState(false);
  useEffect(() => {
    let disposed = false;
    let map;
    async function init() {
      let style;
      try {
        const r = await fetch("https://tiles.openfreemap.org/styles/positron", {
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw Error("Basemap unavailable");
        style = await r.json();
      } catch {
        setBaseError(true);
        style = {
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#e8eee9" },
            },
          ],
        };
      }
      if (disposed) return;
      try {
        map = new maplibre.Map({
          container: container.current,
          style,
          center: [-79.938, -2.136],
          zoom: 13.7,
          attributionControl: true,
          maxPitch: 0,
          canvasContextAttributes: { antialias: true },
        });
        mapRef.current = map;
        map.addControl(
          new maplibre.NavigationControl({ showCompass: false }),
          "bottom-right",
        );
        map.addControl(
          new maplibre.ScaleControl({ maxWidth: 90 }),
          "bottom-left",
        );
        map.on("load", () => {
          const before = map
            .getStyle()
            .layers.find((l) => l.type === "symbol")?.id;
          map.addSource("historical", { type: "geojson", data: flood });
          map.addLayer(
            {
              id: "historical",
              type: "fill",
              source: "historical",
              paint: { "fill-color": "#538fa4", "fill-opacity": 0.18 },
            },
            before,
          );
          map.addSource("sectors", { type: "geojson", data: geo });
          map.addLayer(
            {
              id: "sector-fill",
              type: "fill",
              source: "sectors",
              paint: { "fill-color": "#d9b264", "fill-opacity": 0.65 },
            },
            before,
          );
          map.addLayer(
            {
              id: "sector-line",
              type: "line",
              source: "sectors",
              paint: { "line-color": "#ffffff", "line-width": 1.5 },
            },
            before,
          );
          map.addLayer(
            {
              id: "top-lines",
              type: "line",
              source: "sectors",
              paint: {
                "line-color": "#a7502d",
                "line-width": 2,
                "line-dasharray": [2, 2],
              },
              filter: ["in", "id", -1],
            },
            before,
          );
          map.addLayer(
            {
              id: "neighbor-line",
              type: "line",
              source: "sectors",
              paint: {
                "line-color": "#5269a1",
                "line-width": 2,
                "line-dasharray": [3, 2],
              },
              filter: ["in", "id", -1],
            },
            before,
          );
          map.addLayer({
            id: "selected-line",
            type: "line",
            source: "sectors",
            paint: { "line-color": "#263e78", "line-width": 3.5 },
            filter: ["==", "id", -1],
          });
          map.addSource("labels", { type: "geojson", data: empty() });
          map.addLayer({
            id: "sector-dots",
            type: "circle",
            source: "labels",
            paint: {
              "circle-radius": 13,
              "circle-color": "#ffffff",
              "circle-stroke-color": "#c9c7bc",
              "circle-stroke-width": 1,
            },
          });
          // Local font fallback keeps sector labels available if remote glyphs fail.
          map.addLayer({
            id: "sector-labels",
            type: "symbol",
            source: "labels",
            layout: {
              "text-field": ["get", "number"],
              "text-size": 10,
              "text-font": ["Noto Sans Regular"],
              "text-allow-overlap": false,
            },
            paint: {
              "text-color": "#31425a",
              "text-halo-color": "rgba(255,255,255,.85)",
              "text-halo-width": 1,
            },
          });
          map.addSource("events", { type: "geojson", data: events || empty() });
          map.addLayer({
            id: "event-points",
            type: "circle",
            source: "events",
            paint: {
              "circle-color": "#547e9c",
              "circle-radius": 5,
              "circle-stroke-color": "white",
              "circle-stroke-width": 1.5,
            },
          });
          map.on("click", "event-points", (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const p = f.properties;
            new maplibre.Popup()
              .setLngLat(e.lngLat)
              .setText(
                `${p.evento} · ${p.fechadelevento} · ${p.canton} · ${p.sector}. Historical registry; not a current alert.`,
              )
              .addTo(map);
          });
          map.on("click", "sector-fill", (e) => {
            if (e.features?.length)
              current.current.onSelect(Number(e.features[0].properties.id));
          });
          map.on("mouseenter", "sector-fill", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "sector-fill", () => {
            map.getCanvas().style.cursor = "";
          });
          map.fitBounds(bbox(geo), {
            padding: { top: 80, bottom: 110, left: 55, right: 55 },
            duration: 0,
          });
          setReady(true);
        });
        map.on("error", (e) => {
          if (/tile|fetch|network/i.test(e.error?.message || ""))
            setBaseError(true);
        });
      } catch {
        setFatal(true);
      }
    }
    init();
    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [geo, flood]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const indexed = new Map(rows.map((s) => [s.id, s]));
    const fc = {
      ...geo,
      features: geo.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          ...indexed.get(f.properties.id),
          neighbors: undefined,
          contributions: undefined,
        },
      })),
    };
    map.getSource("sectors").setData(fc);
    const raw =
      layer === "priority"
        ? [
            "step",
            ["coalesce", ["get", "score"], 0],
            ...PRIORITY.flatMap((c, i) => (i === 0 ? [c] : [i * 20, c])),
          ]
        : layer === "susceptibility"
          ? [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "susceptibility"], 0],
              0,
              "#d8e7ed",
              0.5,
              "#7faac0",
              1,
              "#326c8d",
            ]
          : [
              "step",
              ["coalesce", ["get", "reports"], 0],
              "#e6e8e5",
              1,
              "#bac9e3",
              3,
              "#7d9bc9",
              6,
              "#3b62a0",
            ];
    const variable =
      layer === "priority"
        ? "score"
        : layer === "reports"
          ? "reports"
          : "susceptibility";
    const expression = [
      "case",
      ["==", ["get", variable], null],
      "#b4bcc3",
      raw,
    ];
    map.setPaintProperty("sector-fill", "fill-color", [
      "case",
      ["==", ["get", "verified"], "affected"],
      "#ba5c57",
      ["==", ["get", "verified"], "unaffected"],
      "#81a48c",
      expression,
    ]);
    map.setLayoutProperty(
      "historical",
      "visibility",
      showFlood ? "visible" : "none",
    );
    map.setFilter("selected-line", ["==", "id", selected ?? -1]);
    map.setFilter("top-lines", ["in", "id", ...topIds, -1]);
    const s = indexed.get(selected);
    map.setFilter("neighbor-line", ["in", "id", ...(s?.neighbors || []), -1]);
    map
      .getSource("labels")
      .setData(
        featureCollection(
          rows.map((s) =>
            point(s.center, {
              number: s.name.replace("Sector ", ""),
              id: s.id,
            }),
          ),
        ),
      );
    map.setLayoutProperty(
      "event-points",
      "visibility",
      eventsVisible ? "visible" : "none",
    );
  }, [
    ready,
    rows,
    selected,
    layer,
    showFlood,
    eventsVisible,
    topIds,
    queued,
    geo,
  ]);
  useEffect(() => {
    const s = rows.find((s) => s.id === selected);
    if (ready && s) mapRef.current?.easeTo({ center: s.center, duration: 600 });
  }, [selected, ready, focusSignal]);
  const reset = () =>
    mapRef.current?.fitBounds(bbox(geo), { padding: 70, duration: 700 });
  return (
    <div className="map-canvas-wrap">
      <div
        ref={container}
        className="map-canvas"
        aria-label="Interactive map of INEC sectors in northern Guayaquil"
      />
      {!ready && !fatal && (
        <div className="map-loading">
          <span className="loader" />
          Preparing the territory…
        </div>
      )}
      {fatal && (
        <div className="map-loading">
          WebGL is unavailable. Use the sector list to inspect all evidence.
        </div>
      )}
      {baseError && (
        <div className="map-warning">
          Street tiles unavailable or incomplete. Census geometry remains
          available.
        </div>
      )}
      <div className="map-tools">
        <button
          title="Fit pilot area"
          aria-label="Fit pilot area"
          onClick={reset}
        >
          <LocateFixed size={17} />
        </button>
        <button
          title="Expand map"
          aria-label="Expand map"
          onClick={() => container.current?.requestFullscreen?.()}
        >
          <Maximize2 size={17} />
        </button>
      </div>
      <div className="map-location">
        <MapPin size={13} /> Guayaquil, Ecuador{" "}
        <span>INEC census geometry</span>
      </div>
      {eventsVisible && (
        <button
          className="event-context"
          onClick={() =>
            events?.features.length &&
            mapRef.current?.fitBounds(bbox(events), {
              padding: 65,
              duration: 800,
            })
          }
        >
          View {events?.features.length || 0} historical events in the region
        </button>
      )}
    </div>
  );
}
