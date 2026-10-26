import { mkdir, readFile, writeFile } from "node:fs/promises";
const out = new URL("../public/data/city/", import.meta.url);
const geocodeCache = new URL("../data-cache/city/geocodes/", import.meta.url);
await mkdir(geocodeCache, { recursive: true });
const source =
  "https://www.ecuavisa.com/amp/guayaquil/68-sectores-afectados-lluvias-guayaquil-tormenta-electrica-20261025-0011.html";
const locations = [
  "Alborada, tercera etapa, avenida Segundo Cueva Celi",
  "Avenida 25 de Julio, entrada al Puerto Marítimo",
  "Avenida Barcelona",
  "Avenida Barcelona, bajando el paso a desnivel",
  "Avenida del Bombero",
  "Avenida de las Américas y Elías Jácome Guerrero",
  "Avenida Doctor Enrique Ortega Moreira y segundo pasaje 32",
  "Avenida Domingo Comín y monseñor Daniel Comboni",
  "Avenida Don Bosco y 25 de Julio",
  "Avenida Francisco de Orellana y vía Perimetral",
  "Avenida Francisco de Orellana y Guillermo Pareja",
  "Avenida Francisco Rizzo y avenida Isidro Ayora",
  "Avenida Francisco Segura y calle Washington",
  "Avenida Gastón Thoret Jager y tercer callejón",
  "Avenida John Fitzgerald Kennedy",
  "Avenida Kennedy, exteriores de Guayarte",
  "Avenida Kennedy, parque Matilde Hidalgo",
  "Avenida Kennedy y avenida San Jorge",
  "Avenida Machala y Argentina",
  "Avenida Quito y Primero de Mayo",
  "Avenida Víctor Emilio Estrada y Laureles",
  "Calle 13 y Diez de Agosto",
  "Calle 25 y la F",
  "Calle 29 y García Goyena",
  "Calle 44 y la B",
  "Calle César Andrade y Primera Oeste",
  "Calle César Andrade López y Francisco Urbina Jado",
  "Calle Francisco Urbina Jado",
  "Calle Francisco Urbina Jado y Francisco Arizaga",
  "Calle Santa Lucía e Ismael Pérez Castro",
  "Calle Vicente de Piedrahita Carbo y Rafael Ximena",
  "Cedros y Manuel Rendón",
  "Ceibos, calle Francisco Martínez Aguirre",
  "Ciudadela Atarazana, avenida de la Democracia",
  "Ciudadela La Atarazana, segundo callejón",
  "Ciudadela La FAE, calle Coronel Luis López Morales",
  "Ciudadela Miraflores y calle Octava",
  "Ciudadela Samanes 1",
  "Ciudadela Santa Mónica, avenida 25 de Julio",
  "Ciudadela Urbasur, Hugo Cortez Cadena",
  "Cooperativa Luchadores del Norte",
  "Floresta 1, calle Roberto Serrano Rolando",
  "Floresta 2, calle 51 E",
  "Garzota, etapa 1, avenida Hermano Miguel y primer pasaje",
  "Guasmo Oeste",
  "Km 5,5 de la vía a Daule",
  "La Ladrillera, calle 27",
  "Malvinas, avenida Ernesto Albán y tercer pasaje",
  "Malvinas Sur, calle Lucía Porres Marín",
  "Mapasingue Oeste, cooperativa 12 de Octubre J",
  "Mapasingue Oeste, segundo pasaje 43",
  "Miraflores, doctor Ignacio Cuesta y doctor Humberto Ferreti",
  "Paraíso de la Flor, avenida Modesto Luque y Perimetral",
  "Prosperina, sector El Prado, avenida Séptima y calle Tercera",
  "Samanes 2, calle Francisco de Garaycoa",
  "Samanes 3, calle José Martínez Queirolo",
  "Samanes 6, avenida Roberto Costa Prats",
  "Samanes, avenida Isidro Ayora Cueva",
  "Sauces 6, avenida Gabriel Roldós Garcés y Antonio Parra Velasco",
  "Sauces 7, avenida José María Roura y quinto pasaje",
  "Sauces 8, avenida Los Tulipanes",
  "Tungurahua y Aurora Estrada",
  "Urdesa, Costanera y calle 9",
  "Urdesa, Ficus y Costanera",
  "Urdesa, Víctor Emilio Estrada y Costanera",
  "Víctor Emilio Estrada y Jiguas",
  "Víctor Emilio Estrada y Manuel Rendón Seminario",
  "Vía Perimetral y avenida Honorato Vázquez",
];
export async function geocode(id, address) {
  const file = new URL(id + ".json", geocodeCache);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {}
  const url =
    "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?" +
    new URLSearchParams({
      f: "json",
      SingleLine: address + ", Guayaquil, Ecuador",
      outFields: "Match_addr,Addr_type,City,Region,Score",
      outSR: "4326",
      maxLocations: "3",
      sourceCountry: "ECU",
    });
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw Error("HTTP " + r.status);
    const data = await r.json();
    const value = { url, retrieved: new Date().toISOString(), data };
    await writeFile(file, JSON.stringify(value));
    return value;
  } catch (e) {
    return { url, error: e.message, data: { candidates: [] } };
  }
}
const impacts = [];
for (let i = 0; i < locations.length; i++) {
  const address = locations[i];
  const g = await geocode("impact-" + (i + 1), address);
  const candidate = g.data.candidates?.[0];
  const a = candidate?.attributes ?? {};
  const good =
    candidate?.score >= 99 &&
    a.Addr_type === "StreetInt" &&
    /guayaquil/i.test(a.City ?? candidate.address) &&
    candidate.location.x > -80.15 &&
    candidate.location.x < -79.82 &&
    candidate.location.y > -2.36 &&
    candidate.location.y < -1.94;
  impacts.push({
    id: "segura-20261025-" + String(i + 1).padStart(2, "0"),
    eventId: "oct24",
    locationText: address,
    type: "water_accumulation",
    confirmation: "documented",
    verificationStatus: "source_report_only",
    source,
    sourceTitle: "Ecuavisa, atribuye el reporte a Segura EP",
    sourcePublished: "2026-10-25T10:55:00-05:00",
    occurredStart: "2026-10-24T12:00:00-05:00",
    occurredEnd: "2026-10-25T06:00:00-05:00",
    timePrecision: "Ventana del episodio; hora individual no publicada",
    updatedAt: "2026-10-25T10:55:00-05:00",
    description:
      "Acumulación de agua incluida en el listado publicado; extensión y profundidad no informadas.",
    coordinates: good ? [candidate.location.x, candidate.location.y] : null,
    geocoding: {
      candidateCoordinates: (g.data.candidates ?? [])
        .filter((c) => c.score >= 99 && c.attributes?.Addr_type === "StreetInt")
        .map((c) => [c.location.x, c.location.y]),
      retrievedAt: g.retrieved ?? null,
      status: good ? "high_match_unreviewed" : "pending_review",
      method: "Esri World Geocoding",
      score: candidate?.score ?? null,
      addressType: a.Addr_type ?? null,
      matchedAddress: candidate?.address ?? null,
      url: g.url,
      limitation:
        "Puntaje del geocodificador, no probabilidad ni validación de campo. Cruces candidatos; las ubicaciones amplias o ambiguas quedan pendientes.",
    },
  });
  if ((i + 1) % 10 === 0)
    console.log("geocoded", i + 1, impacts.filter((x) => x.coordinates).length);
}
const extras = [
  ["tree", "Avenida Chucho Benítez"],
  ["tree", "Calle Atuntaqui, Pascuales"],
  ["tree", "Alborada, tercera etapa"],
  ["tree", "Avenida Barcelona"],
  ["tree", "Los Ríos y Primero de Mayo"],
  ["landslide", "Avenida Chucho Benítez"],
  ["infrastructure_fall", "Avenida Chucho Benítez"],
  ["documented_flood", "Recinto Pedregal, parroquia Tenguel"],
  ["documented_flood", "Recinto San Rafael, parroquia Tenguel"],
  ["documented_flood", "Ciudadela La Floresta, parroquia Tenguel"],
];
extras.forEach(([type, location], i) =>
  impacts.push({
    id: "segura-other-" + i,
    eventId: "oct24",
    locationText: location,
    type,
    confirmation: "documented",
    verificationStatus: "source_report_only",
    source,
    sourceTitle: "Ecuavisa, atribuye el reporte a Segura EP",
    sourcePublished: "2026-10-25T10:55:00-05:00",
    occurredStart: "2026-10-24T12:00:00-05:00",
    occurredEnd: "2026-10-25T06:00:00-05:00",
    timePrecision: "Hora individual no publicada",
    updatedAt: "2026-10-25T10:55:00-05:00",
    description:
      "Tipo de novedad informado por la fuente; ubicación pendiente de revisión.",
    coordinates: null,
    geocoding: { status: "pending_review" },
  }),
);
for (const impact of impacts)
  impact.parishCode = impact.type === "documented_flood" ? "090158" : "090150";
await writeFile(new URL("impacts.json", out), JSON.stringify(impacts, null, 2));
console.log(
  "impacts",
  impacts.length,
  "candidate points",
  impacts.filter((x) => x.coordinates).length,
);
