import React, { useEffect, useMemo, useRef, useState } from "react";
import * as maplibre from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { ZoomIn, ZoomOut, LocateFixed } from "lucide-react";
import {
  areaValue,
  rowValue,
  UNKNOWN,
  mapDetailPolicy,
  outlineGeometry,
} from "./map-model.js";
import { TYPE_LABELS, localDate } from "./format.js";
import { stationCondition } from "./live-weather.js";
import { intensityExpression } from "./rain-journey.js";
import {
  LIVE_RAIN_COLORS,
  LIVE_RAIN_OPACITY,
  reportMatchesArea,
} from "./unified-weather.js";
maplibre.setWorkerUrl(workerUrl);
const URBAN = [
    [-80.095, -2.315],
    [-79.84, -1.99],
  ],
  empty = { type: "FeatureCollection", features: [] };
const fc = (features) => ({ type: "FeatureCollection", features });
export default function CityMap({
  data,
  rows,
  impacts,
  selected,
  onSelect,
  onZone,
  layer,
  scope,
  focus,
  phase,
  hour,
  area,
  geographyMode = "areas",
  onArea,
  scale = { upper: 200 },
  prepared = true,
  alerts = [],
  important = true,
  locationFocus,
  onIncident,
  onReset,
  resetKey = 0,
  station = null,
}) {
  const host = useRef(),
    mapRef = useRef(),
    popup = useRef(),
    labels = useRef([]),
    cb = useRef(),
    [ready, setReady] = useState(false),
    [cameraTick, setCameraTick] = useState(0),
    [zoom, setZoom] = useState(10),
    [error, setError] = useState("");
  cb.current = {
    onSelect,
    onArea,
    onIncident,
    areas: data.territories.areas,
    geographyMode,
    impacts,
    alerts,
  };
  const geometry = useMemo(
    () => new Map(data.geo.features.map((f) => [f.properties.id, f])),
    [data.geo],
  );
  const featureData = useMemo(
    () =>
      fc(
        rows
          .map((r) => {
            const f = geometry.get(r.sector.id);
            return f
              ? {
                  ...f,
                  properties: {
                    ...f.properties,
                    value: rowValue(r, layer, hour),
                    systemWatch: impacts.some(
                      (i) =>
                        i.origin === "system" &&
                        i.sectorIds?.includes(r.sector.id),
                    ),
                  },
                }
              : null;
          })
          .filter(Boolean),
      ),
    [geometry, rows, layer, hour, impacts],
  );
  const areaData = useMemo(
    () =>
      fc(
        data.territories.areas
          .filter((a) => a.geometry)
          .map((a) => ({
            type: "Feature",
            geometry: a.geometry,
            properties: {
              id: a.id,
              name: a.name,
              value: areaValue(a, rows, layer, hour),
              reported: impacts.some(
                (i) => i.origin !== "system" && reportMatchesArea(i, a.id),
              ),
              userReported: impacts.some(
                (i) => i.origin === "user" && reportMatchesArea(i, a.id),
              ),
              publishedReported: impacts.some(
                (i) =>
                  i.origin !== "user" &&
                  i.origin !== "system" &&
                  reportMatchesArea(i, a.id),
              ),
            },
          })),
      ),
    [data.territories, rows, layer, hour, impacts],
  );
  useEffect(() => {
    let stopped = false,
      m;
    const resize = new ResizeObserver(() => m?.resize());
    resize.observe(host.current);
    (async () => {
      let style = {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#f3f5f1" },
          },
        ],
      };
      if (!prepared)
        try {
          const r = await fetch(
            "https://tiles.openfreemap.org/styles/positron",
            { signal: AbortSignal.timeout(12000) },
          );
          if (!r.ok) throw Error();
          style = await r.json();
        } catch {
          setError(
            "Online basemap unavailable. Prepared local context remains available.",
          );
        }
      if (stopped) return;
      try {
        m = new maplibre.Map({
          container: host.current,
          style,
          center: [-79.94, -2.16],
          zoom: 10.8,
          maxPitch: 0,
          attributionControl: { compact: true },
        });
        mapRef.current = m;
        m.addControl(
          new maplibre.ScaleControl({ maxWidth: 90 }),
          "bottom-left",
        );
        m.on("load", () => {
          if (stopped) return;
          for (const id of [
            "areas",
            "area-outlines",
            "sectors",
            "selected",
            "selection",
            "impacts",
            "checks",
            "facilities",
            "external",
            "context",
            "station",
          ])
            m.addSource(id, {
              type: "geojson",
              data: empty,
              attribution:
                id === "context"
                  ? "© OpenStreetMap contributors · ODbL"
                  : id === "facilities"
                    ? "GAD Municipal de Guayaquil"
                    : undefined,
            });
          const openPopup = () => {
            popup.current?.remove();
            popup.current = new maplibre.Popup();
            return popup.current;
          };
          const add = (id, type, source, paint, extra = {}) =>
            m.addLayer({ id, type, source, paint, ...extra });
          m.getSource("context").setData(data.context ?? empty);
          add(
            "water-fill",
            "fill",
            "context",
            { "fill-color": "#bfdee4", "fill-opacity": 1 },
            { filter: ["==", ["geometry-type"], "Polygon"] },
          );
          add(
            "water-line",
            "line",
            "context",
            {
              "line-color": "#a4cdd8",
              "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 14, 6],
            },
            {
              filter: [
                "all",
                ["==", ["get", "kind"], "water"],
                ["==", ["geometry-type"], "LineString"],
              ],
            },
          );
          add("area-fill", "fill", "areas", {
            "fill-color": UNKNOWN,
            "fill-opacity": 0.58,
          });
          add("area-line", "line", "area-outlines", {
            "line-color": "#869e9a",
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              9,
              0.2,
              13,
              0.65,
            ],
            "line-opacity": 0.45,
          });
          add(
            "sector-fill",
            "fill",
            "sectors",
            { "fill-color": UNKNOWN, "fill-opacity": 0.58 },
            { minzoom: 14 },
          );
          add(
            "sector-line",
            "line",
            "sectors",
            {
              "line-color": "#91a39f",
              "line-width": 0.45,
              "line-opacity": 0.65,
            },
            { minzoom: 14 },
          );
          add(
            "road-line",
            "line",
            "context",
            {
              "line-color": "#faf9f4",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                9,
                0.6,
                12,
                1.5,
                15,
                3,
              ],
              "line-opacity": 0.95,
            },
            { filter: ["==", ["get", "kind"], "road"] },
          );
          add("external-fill", "fill", "external", {
            "fill-color": "#d8e0e3",
            "fill-opacity": 0.4,
          });
          add("selection-line", "line", "selection", {
            "line-color": "#245e69",
            "line-width": 2.5,
          });
          add("selected-line", "line", "selected", {
            "line-color": "#172f42",
            "line-width": 3.5,
          });
          add("check-points", "circle", "checks", {
            "circle-color": "#8356b1",
            "circle-radius": 7,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          });
          add("impact-points", "circle", "impacts", {
            "circle-color": "#b9384a",
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10,
              4.5,
              14,
              7,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          });
          add("facility-points", "circle", "facilities", {
            "circle-color": [
              "match",
              ["get", "type"],
              "meeting",
              "#147d86",
              "#735a9d",
            ],
            "circle-radius": 8,
            "circle-stroke-width": 3,
            "circle-stroke-color": "#fff",
          });
          add("station-point", "circle", "station", {
            "circle-color": "#147d86",
            "circle-radius": 9,
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 3,
          });
          m.on("click", "station-point", (e) => {
            const p = e.features?.[0]?.properties;
            if (p)
              openPopup()
                .setLngLat(e.lngLat)
                .setText(
                  "Guayaquil airport observation: " +
                    p.condition +
                    ". Observed " +
                    localDate(p.observedAt) +
                    ". This is not a flood observation. " +
                    p.raw,
                )
                .addTo(m);
          });
          add(
            "reported-area-outline",
            "line",
            "area-outlines",
            {
              "line-color": "#b9384a",
              "line-width": 3,
              "line-dasharray": [3, 2],
            },
            { filter: ["==", ["get", "reported"], true] },
          );
          const hatch = new Uint8Array(8 * 8 * 4);
          for (let y = 0; y < 8; y++)
            for (let x = 0; x < 8; x++) {
              const i = (y * 8 + x) * 4;
              hatch[i] = 185;
              hatch[i + 1] = 56;
              hatch[i + 2] = 74;
              hatch[i + 3] = (x + y) % 8 < 2 ? 110 : 0;
            }
          m.addImage("user-report-hatch", { width: 8, height: 8, data: hatch });
          m.addLayer(
            {
              id: "reported-area-tint",
              type: "fill",
              source: "areas",
              filter: ["==", ["get", "reported"], true],
              paint: {
                "fill-color": "#b9384a",
                "fill-opacity": [
                  "case",
                  ["get", "publishedReported"],
                  0.24,
                  0.1,
                ],
              },
            },
            "selection-line",
          );
          m.addLayer(
            {
              id: "user-report-pattern",
              type: "fill",
              source: "areas",
              filter: ["==", ["get", "userReported"], true],
              paint: {
                "fill-pattern": "user-report-hatch",
                "fill-opacity": 0.8,
              },
            },
            "selection-line",
          );
          m.addLayer(
            {
              id: "system-watch-pattern",
              type: "fill",
              source: "sectors",
              filter: ["==", ["get", "systemWatch"], true],
              paint: {
                "fill-pattern": "user-report-hatch",
                "fill-opacity": 0.9,
              },
            },
            "selection-line",
          );
          m.on("click", "area-fill", (e) => {
            if (m.getZoom() >= 14) return;
            if (
              m.queryRenderedFeatures(e.point, {
                layers: [
                  "impact-points",
                  "check-points",
                  "facility-points",
                  "station-point",
                ],
              }).length
            )
              return;
            const a = cb.current.areas.find(
              (a) => a.id === e.features?.[0]?.properties.id,
            );
            if (a) cb.current.onArea(a);
          });
          m.on("click", "sector-fill", (e) => {
            if (m.getZoom() < 14) return;
            if (
              m.queryRenderedFeatures(e.point, {
                layers: ["impact-points", "check-points", "facility-points"],
              }).length
            )
              return;
            const id = e.features?.[0]?.properties.id;
            if (id) cb.current.onSelect(id);
          });
          m.on("click", "impact-points", (e) => {
            const item = cb.current.impacts.find(
              (i) => i.id === e.features?.[0]?.properties.id,
            );
            if (!item) return;
            const box = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = TYPE_LABELS[item.type] ?? "Documented impact";
            box.append(title);
            const note = document.createElement("p");
            note.textContent =
              (item.locationText ?? "") +
              " · Approximate location; extent unverified.";
            box.append(note);
            if (item.source) {
              const a = document.createElement("a");
              a.textContent = "Open evidence ↗";
              a.href = item.source;
              a.target = "_blank";
              a.rel = "noreferrer";
              box.append(a);
            }
            openPopup().setLngLat(e.lngLat).setDOMContent(box).addTo(m);
            cb.current.onIncident?.(item);
          });
          m.on("click", "check-points", (e) => {
            const id = e.features?.[0]?.properties.areaId,
              a = cb.current.areas.find((a) => a.id === id);
            const box = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = "Needs a check — no flood confirmed";
            box.append(title);
            const note = document.createElement("p");
            note.textContent =
              (a?.name ?? "This area") +
              ": expected rain and past flood exposure suggest a closer look, but evidence is incomplete. This marker is an area reference, not an observed flood location.";
            box.append(note);
            if (a) {
              const button = document.createElement("button");
              button.textContent = "Explore this area";
              button.className = "popup-explore";
              button.onclick = () => {
                popup.current?.remove();
                cb.current.onArea(a);
              };
              box.append(button);
            }
            openPopup().setLngLat(e.lngLat).setDOMContent(box).addTo(m);
          });
          m.on("click", "facility-points", (e) => {
            const p = e.features?.[0]?.properties;
            if (!p) return;
            const box = document.createElement("div");
            for (const value of [
              p.name,
              p.status,
              p.operationalStatus,
              "Last operational verification: not available",
              "Source updated: " + localDate(p.sourceUpdatedAt),
            ]) {
              const el = document.createElement("p");
              el.textContent = value;
              box.append(el);
            }
            const a = document.createElement("a");
            a.href = p.source;
            a.textContent = "Municipal source ↗";
            a.target = "_blank";
            a.rel = "noreferrer";
            box.append(a);
            openPopup().setLngLat(e.lngLat).setDOMContent(box).addTo(m);
          });
          for (const id of [
            "area-fill",
            "sector-fill",
            "impact-points",
            "check-points",
            "facility-points",
          ]) {
            m.on(
              "mouseenter",
              id,
              () => (m.getCanvas().style.cursor = "pointer"),
            );
            m.on("mouseleave", id, () => (m.getCanvas().style.cursor = ""));
          }
          m.on("moveend", () => {
            setZoom(m.getZoom());
            setCameraTick((n) => n + 1);
          });
          m.fitBounds(URBAN, { padding: 25, duration: 0 });
          setReady(true);
        });
      } catch {
        setError(
          "Map rendering is unavailable. Area lists and evidence panels remain available.",
        );
      }
    })();
    return () => {
      stopped = true;
      resize.disconnect();
      for (const x of labels.current) x.remove();
      m?.remove();
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const m = mapRef.current;
    m.getSource("areas").setData(areaData);
    m.getSource("area-outlines").setData(
      fc(
        areaData.features.map((f) => ({
          ...f,
          geometry: outlineGeometry(f.geometry),
        })),
      ),
    );
    m.getSource("sectors").setData(featureData);
    const rain = [
      "interpolate",
      ["linear"],
      ["coalesce", ["get", "value"], 0],
      0,
      "#ffffff",
      scale.upper * 0.5,
      "#6aadd8",
      scale.upper,
      "#082f64",
    ];
    const attention = [
      "step",
      ["coalesce", ["get", "value"], 0],
      "#b9d8bc",
      30,
      "#f3de8a",
      60,
      "#eda56b",
    ];
    const color = [
      "case",
      ["==", ["get", "value"], null],
      UNKNOWN,
      layer === "intensity"
        ? LIVE_RAIN_COLORS
        : layer === "priority" || layer === "aftermath"
          ? attention
          : layer === "history"
            ? [
                "interpolate",
                ["linear"],
                ["get", "value"],
                0,
                "#f8edd7",
                100,
                "#b89562",
              ]
            : rain,
    ];
    for (const id of ["area-fill", "sector-fill"])
      m.setPaintProperty(id, "fill-color", color);
    const policy = mapDetailPolicy(zoom, geographyMode),
      detailed = zoom >= 14;
    // Keep supported local values visible at every scale. Only borders depend on
    // zoom; one missing member must not conceal every known part of its area.
    m.setLayerZoomRange("sector-fill", 0, 24);
    m.setLayoutProperty("sector-fill", "visibility", "visible");
    m.setLayerZoomRange("sector-line", policy.boundaryZoom, 24);
    m.setLayoutProperty(
      "sector-line",
      "visibility",
      policy.showBoundaries ? "visible" : "none",
    );
    m.setPaintProperty(
      "sector-fill",
      "fill-opacity",
      ["intensity", "forecast"].includes(layer)
        ? LIVE_RAIN_OPACITY
        : ["support", "impacts", "verification"].includes(layer)
          ? 0.12
          : 0.72,
    );
    m.setPaintProperty(
      "area-fill",
      "fill-opacity",
      ["intensity", "forecast"].includes(layer)
        ? 0
        : detailed
          ? 0.12
          : ["support", "impacts", "verification"].includes(layer)
            ? 0.15
            : 0.58,
    );
    m.getSource("selection").setData(
      fc(
        area?.geometry
          ? [
              {
                type: "Feature",
                geometry: outlineGeometry(area.geometry),
                properties: {},
              },
            ]
          : [],
      ),
    );
    m.getSource("external").setData(
      area?.kind === "external_context" ? data.territories.external : empty,
    );
    const ids = new Set(rows.map((r) => r.sector.id));
    const pts = impacts
      .filter((i) => i.coordinates)
      .map((i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: i.coordinates },
        properties: { id: i.id, sectorId: i.sectorId },
      }));
    m.getSource("impacts").setData(fc(pts));
    m.setLayoutProperty(
      "impact-points",
      "visibility",
      !["before"].includes(phase) &&
        layer !== "forecast" &&
        (important ||
          layer === "impacts" ||
          layer === "support" ||
          layer === "aftermath")
        ? "visible"
        : "none",
    );
    const checks = alerts
      .filter((a) => a.type === "Verification Needed")
      .slice(0, important ? 10 : 30)
      .map((a) => {
        const g = data.territories.areas.find((g) => g.id === a.areaId);
        return g
          ? {
              type: "Feature",
              geometry: { type: "Point", coordinates: g.center },
              properties: { id: a.id, areaId: g.id },
            }
          : null;
      })
      .filter(Boolean);
    m.getSource("checks").setData(fc(checks));
    m.setLayoutProperty(
      "check-points",
      "visibility",
      layer === "verification" || (layer === "priority" && important)
        ? "visible"
        : "none",
    );
    m.getSource("facilities").setData(data.support ?? empty);
    m.setLayoutProperty(
      "facility-points",
      "visibility",
      layer === "support" || locationFocus ? "visible" : "none",
    );
    for (const x of labels.current) x.remove();
    labels.current = [];
    // Screen-space spacing keeps adjacent neighborhood names from overlapping.
    const used = [];
    const visible = data.territories.areas
      .filter((a) => a.center && m.getBounds().contains(a.center))
      .sort((a, b) =>
        a.id === area?.id ? -1 : b.id === area?.id ? 1 : b.count - a.count,
      );
    for (const a of visible) {
      const p = m.project(a.center);
      if (
        used.some((q) => Math.abs(q.x - p.x) < 110 && Math.abs(q.y - p.y) < 34)
      )
        continue;
      if (used.length >= (zoom < 12 ? 10 : 18)) break;
      used.push(p);
      const button = document.createElement("button");
      button.className = "local-area-label";
      button.textContent = a.name;
      button.setAttribute("aria-label", "Open " + a.name);
      button.onclick = (e) => {
        e.stopPropagation();
        cb.current.onArea(a);
      };
      labels.current.push(
        new maplibre.Marker({ element: button }).setLngLat(a.center).addTo(m),
      );
    }
  }, [
    ready,
    areaData,
    featureData,
    impacts,
    layer,
    phase,
    scale.upper,
    zoom,
    area,
    important,
    alerts,
    geographyMode,
    data,
    cameraTick,
    locationFocus,
  ]);
  useEffect(() => {
    if (!ready) return;
    const f = data.geo.features.find((f) => f.properties.id === selected);
    mapRef.current.getSource("selected").setData(fc(f ? [f] : []));
  }, [ready, selected, data.geo]);
  useEffect(() => {
    if (!ready) return;
    mapRef.current.getSource("station").setData(
      fc(
        station
          ? [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: station.coordinates },
                properties: {
                  raw: station.raw,
                  observedAt: station.observedAt,
                  condition: stationCondition(station).label,
                },
              },
            ]
          : [],
      ),
    );
  }, [ready, station]);
  useEffect(() => {
    if (!ready) return;
    const s = data.sectors.find((s) => s.id === focus?.id);
    if (s)
      mapRef.current.fitBounds(
        [
          [s.bbox[0], s.bbox[1]],
          [s.bbox[2], s.bbox[3]],
        ],
        { padding: 75, maxZoom: 15.5, duration: 500 },
      );
  }, [ready, focus, data.sectors]);
  useEffect(() => {
    if (!ready) return;
    if (area?.bbox)
      mapRef.current.fitBounds(
        [
          [area.bbox[0], area.bbox[1]],
          [area.bbox[2], area.bbox[3]],
        ],
        { padding: 55, maxZoom: 13.4, duration: 450 },
      );
    else mapRef.current.fitBounds(URBAN, { padding: 30, duration: 450 });
    popup.current?.remove();
  }, [ready, area, scope, resetKey]);
  useEffect(() => {
    if (ready && locationFocus?.coordinates)
      mapRef.current.easeTo({
        center: locationFocus.coordinates,
        zoom: 14.2,
        duration: 500,
      });
  }, [ready, locationFocus]);
  return (
    <div
      className="city-map"
      aria-label="Guayaquil evidence and infrastructure map"
    >
      <div ref={host} className="city-map-canvas" translate="no" />
      <div className="map-location">
        <strong>
          {zoom < 12
            ? "City view"
            : zoom < 14
              ? "Neighborhood view"
              : "Detailed view"}
        </strong>
        <small>
          {zoom < 14
            ? "Named areas · smaller boundaries appear closer in"
            : "Census boundaries · source detail available"}
        </small>
      </div>
      <div className="city-map-tools">
        <button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <ZoomIn size={18} />
        </button>
        <button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <ZoomOut size={18} />
        </button>
        <button
          className="map-back-city"
          aria-label="Back to Guayaquil"
          onClick={onReset}
        >
          <LocateFixed size={18} />
          <span>Back to Guayaquil</span>
        </button>
      </div>
      <div className="city-map-scale">
        {data.context?.features?.length
          ? "Prepared streets & waterways · orientation only"
          : "Prepared area boundaries · road context unavailable"}
      </div>
      {error && (
        <div className="city-map-error" role="status">
          {error}
        </div>
      )}
    </div>
  );
}
