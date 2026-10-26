import { readFile, writeFile } from "node:fs/promises";
import {
  coverageMetrics,
  postEventMetrics,
  shadowQueue,
  describeDocumentedComparison,
} from "../src/city/analysis.js";
const read = async (name) =>
  JSON.parse(
    await readFile(
      new URL("../public/data/city/" + name, import.meta.url),
      "utf8",
    ),
  );
const [manifest, sectors, events, snapshots, impacts] = await Promise.all(
  [
    "manifest.json",
    "sectors.json",
    "events.json",
    "assessments.json",
    "impacts.json",
  ].map(read),
);
const urban = sectors.filter((s) => s.urban),
  format = (v) =>
    v === null
      ? "No evaluable"
      : new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 }).format(v);
const rows = events.map((e) => {
  const a = snapshots.find((s) => s.eventId === e.id);
  const c = coverageMetrics(urban, a.assessments, e.observations),
    m = postEventMetrics(urban, impacts, [], e.id),
    d = describeDocumentedComparison(a.assessments, impacts, e.id);
  return {
    e,
    a,
    c,
    m,
    d,
    queue: shadowQueue(urban, a.assessments, impacts, [], e.id).length,
  };
});
const historical = rows.filter((x) => x.e.status !== "captured_forecast"),
  future = rows.find((x) => x.e.status === "captured_forecast");
const report = `# FLOODSHADOW 2.0 — Implementación y auditoría

Se implementó la evolución sobre el proyecto existente: inteligencia meteorológica, territorio, evidencias y verificación conectadas por episodio. La pantalla inicial es Overview; la navegación sigue Before, During, After y Laboratory. Toda la interfaz está en inglés, según la última corrección del usuario. Los nombres propios y los textos originales de las fuentes se conservan. El Laboratorio 0.3 sigue funcionando con sus 36 sectores experimentales y su interfaz anterior en inglés.

## Sistema final y recorrido funcional

La aplicación contiene dos episodios documentados —19 y 24–25 de octubre de 2026— y ${manifest.prospectiveCaptures} captura prospectiva real de pronóstico. El mapa principal ya no está limitado al piloto: permite explorar la cabecera y las parroquias rurales compatibles del cantón, seleccionar zonas o sectores, buscar códigos y lugares citados, consultar la ficha de evidencia y exportar el análisis.

Antes muestra la lluvia prevista y un índice explicado. Durante reproduce series horarias del modelo y conserva separadas las mediciones publicadas y los incidentes. Después presenta el resultado conocido, los datos pendientes y la comparación temporal sobre el mismo sector. Shadow Detection ordena sectores con contexto de vigilancia pero evidencia insuficiente. Una verificación real puede guardarse, revisarse, aceptarse y corregirse con historial; cambia estados, métricas y la siguiente cola de comprobación. El Laboratorio conserva la actualización probabilística espacial positiva/negativa y los cinco comparadores experimentales.

Los datos reales no se mezclan con incidentes sintéticos. No se añadieron modelos generativos ni afirmaciones de inundación basadas solamente en lluvia.

## Cobertura conseguida

| Medida | Resultado |
|---|---:|
| Sectores INEC del cantón, IDs únicos | ${sectors.length} |
| Código de cabecera 090150 | ${urban.length} |
| Sectores de parroquias rurales adicionales | ${sectors.length - urban.length} |
| Agregaciones por prefijo censal de zona | ${manifest.zoneCount} |
| Huellas de susceptibilidad descargadas | ${manifest.historical.count} |
| Reparaciones de huellas registradas | ${manifest.geometryAudit.repairs.length} |
| Pares de solapamiento originales >1 m² | ${manifest.geometryAudit.sourceOverlapCount} |
| Pares de solapamiento analítico restantes >1 m² | ${manifest.geometryAudit.overlapsOver1m2.length} |
| Sectores armonizados en bordes | ${manifest.geometryAudit.harmonization.count} |
| Sectores sin índice por cambio geométrico >1% | ${manifest.geometryAudit.significantBoundaryCount} |

El código 090150 incluye periferia según la fuente; no se presenta como un nuevo límite urbano legal. Las parroquias adicionales son Juan Gómez Rendón, El Morro, Posorja, Puná y Tenguel. Los alias «Sector INEC 005» son identificadores de visualización, no nombres inventados de barrios. Siempre se conserva el código completo.

Los pequeños solapamientos originales se resuelven para análisis mediante una partición técnica determinista que asigna el borde compartido al código lexicográficamente menor. No modifica límites legales. Se conserva el original, se cuantifica el cambio por sector y se excluye el índice territorial donde el cambio supera 1%. El máximo cambio individual es ${format(100 * manifest.geometryAudit.harmonization.maxRelativeAreaChange)}%. Ese umbral es una política conservadora de calidad, no una estimación de precisión cartográfica. Las ubicaciones candidatas se contrastan con la ambigüedad del original, no se vuelven ciertas por la armonización.

GEOS/Shapely valida y repara; pyproj.Geod calcula áreas WGS84. Las huellas se intersectan y unen dentro de cada sector antes de medir, evitando contar dos veces áreas comunes. El render simplifica preservando topología individual; 12 simplificaciones inválidas vuelven a la geometría analítica válida y los 6652 sectores son válidos en el render. Las estadísticas no se calculan sobre el render. Todos los polígonos se muestran y permiten selección desde la vista inicial, con bordes visibles y colores de vigilancia; los puntos son una superposición adicional. La agregación por zonas es opcional. Los agregados de zona solo se colorean cuando todos sus sectores tienen el dato de esa capa. Un agregado incompleto queda gris y se puede acercar para consultar sus componentes.

## Fuentes integradas y consultadas

| Fuente | Integración y límites |
|---|---|
| [INEC, Marco Geoestadístico 2022](${manifest.census.source}) | Geometrías e identificadores; descarga paginada, validación y niveles de detalle |
| [Zonas Inundables GYE](${manifest.historical.url}) | 5746 huellas documentales; fecha de vigencia y licencia detallada desconocidas; no son afectaciones del episodio |
| [Open-Meteo Single Runs](https://open-meteo.com/en/docs/single-runs-api) / ECMWF IFS | Corridas inicializadas el 18 y 23 de octubre, resolución nominal 9 km; seis celdas por episodio |
| [Open-Meteo Historical Weather](https://open-meteo.com/en/docs/historical-weather-api) | Series horarias del modelo para las ventanas de análisis; no son pluviómetros ni radar |
| [Open-Meteo Forecast](https://open-meteo.com/en/docs) | Captura actual de 72 horas guardada antes de su ventana, con datos y evaluación originales preservados |
| [ESPOL FIMCM](${events[0].source}) | Cinco acumulados publicados, atribuidos a INAMHI/ESPOL: 181, 141, 132, 117 y 112 mm; sin coordenadas instrumentales ni ventanas exactas publicadas |
| [Ecuavisa, atribución a Segura EP](${events[1].source}) | 68 ubicaciones de acumulación de agua y diez novedades adicionales, incluidas tres inundaciones reportadas en Tenguel. Colección periodística atribuida, no base directa de Segura EP |
| Esri World Geocoding | 11 cruces candidatos de coincidencia alta; los restantes ${manifest.impacts.pendingGeocoding} registros siguen sin coordenadas. Solo siete asignaciones sectoriales coinciden para todas las alternativas de cruce; cuatro quedan ambiguas. Puntaje de coincidencia no equivale a exactitud ni validación de campo |
| GIS municipal, capas 8/46/48/55 | Consultas devolvieron HTTP 500. Se muestran catálogo, atributos verificados parcialmente y desconocimiento; no se inventa geometría, capacidad, obstrucción, mantenimiento o bombeo |
| [INAMHI](https://www.inamhi.gob.ec/) | Portal consultado; no se integró una serie instrumental estructurada ni se atribuyen alertas no descargadas |
| [NASA GPM IMERG](https://gpm.nasa.gov/data/imerg) | Documentación consultada; sin producto descargado para los episodios. No se presenta como integrado |

La lista de tipos conserva acumulación de agua, árboles, deslizamiento e infraestructura caída por separado. No convierte los 68 registros en 68 polígonos completamente inundados. Una ubicación extensa, un pasaje ambiguo o una calle sin cruce no recibe coordenadas inventadas. Se conservan el texto de ubicación, URL, fecha de publicación, ventana aproximada, tipo, estado y detalles de geocodificación.

Los cinco acumulados del 19 no se promedian como lluvia uniforme para Guayaquil, no se interpolan y no se convierten en una curva horaria inventada. El promedio urbano mencionado por la publicación no se reproduce como promedio de estos cinco datos. No se calcula error meteorológico contra estaciones sin una ventana instrumental compatible.

## Métodos y separación temporal

El motor meteorológico exige horas completas, únicas, ordenadas y sin valores faltantes para publicar un acumulado completo. Cero es distinto de ausente. Se utiliza la celda más cercana al punto representativo del sector, con distancia máxima de 12 km. Esta asignación no aumenta la resolución original ni demuestra cobertura instrumental de toda la superficie.

El índice de vigilancia tiene dos contribuciones: 50 × fracción del sector dentro de la unión histórica, más 50 × rango percentil de lluvia prevista entre las celdas únicas consultadas. El percentil utiliza (cantidad menor + 0,5 × empates) / número de celdas. Lluvia cero aporta cero puntos. Ambos factores deben existir; no se redistribuyen los pesos ante una ausencia. Un borde geométrico incierto deja el índice sin calcular.

La ponderación igual y el umbral de vigilancia 60/100 son convenciones explicadas, no coeficientes calibrados con los incidentes. El índice no es una probabilidad ni una alarma oficial. No incorpora topografía, hidráulica o marea cuando no existen datos utilizables. La ficha desglosa contribuciones, fuentes y exclusiones.

Las corridas históricas se inicializaron antes de los episodios, pero la hora exacta de publicación no se archivó. Para el caso A hay 23 horas entre inicialización y comienzo aproximado del episodio; para el B hay 41. El índice se reconstruyó hoy con estas corridas y antecedentes sin vigencia suficiente; no puede declararse una predicción emitida por FLOODSHADOW antes del evento.

${future ? `La captura prospectiva se recibió en ${future.e.forecast.retrievedAt}, antes de la ventana ${future.e.start} — ${future.e.end}. Se conserva como snapshot original, sin usar observaciones posteriores. La respuesta no informa hora exacta de inicialización o emisión del proveedor; el tiempo de recepción del sistema sí está registrado.` : "No se obtuvo una captura prospectiva en esta revisión."}

Las capturas prospectivas se guardan con creación exclusiva, versión, factores y SHA-256, y se conservan en el almacén local. El hash permite comprobar consistencia de contenido; no es una firma ni prueba de autenticidad o de tiempo certificada. Registrar nuevas observaciones no modifica la evaluación inicial. Los índices históricos son reconstrucciones explícitas.

## Resultados y métricas reales

| Episodio o ventana | Celdas únicas | Asignación por sectores de cabecera | Asignación por área de sectores | Estaciones publicadas | Registros localizados candidatos | Candidatos Shadow |
|---|---:|---:|---:|---:|---:|---:|
${rows.map((x) => `| ${x.e.name} | ${x.e.forecast.grid.length} | ${format(x.c.forecastSectorShare)}% | ${format(x.c.forecastAreaShare)}% | ${x.e.observations.length} | ${x.m.documented} | ${x.queue} |`).join("\n")}

La cobertura por área y por sectores tiene denominadores diferentes. Es cobertura de asignación del modelo según la regla de distancia, no porcentaje del territorio con medición directa. Las estaciones no tienen cobertura espacial cuantificada. Las zonas rurales sin celda compatible permanecen sin lluvia asignada.

En la colección del 24–25, los ${historical[1].m.documented} sectores con registros puntuales candidatos representan ${format(historical[1].m.documentedShare)}% de los 6416 sectores de cabecera. Esto solo describe registros conocidos y localizados provisionalmente; no estima el porcentaje real de sectores afectados. No hay verificaciones sectoriales reales precargadas: cobertura 0%, afectados entre verificados no evaluable. Los sectores sin denuncias no cuentan como negativos.

El contraste exploratorio del caso B devuelve ${historical[1].d.highlighted}/${historical[1].d.evaluable} sectores candidatos con índice ≥60, ${historical[1].d.notHighlighted} por debajo y ${historical[1].d.missingIndex} sin índice. Este resultado desfavorable queda visible en Después. No es recall ni precisión predictiva: las ubicaciones son candidatas, la colección es parcial y el índice se reconstruyó después. No se bajó el umbral ni se cambiaron pesos para aparentar aciertos. El pronóstico de ese caso varía entre 8,4 y 16,4 mm en las celdas consultadas; la estimación posterior del modelo es otra fuente, no validación instrumental.

Se calculan: afectados entre verificaciones sectoriales aceptadas; cobertura de verificación; porcentaje de sectores con registros conocidos; y comparación previa/posterior solo si existe una evaluación prospectiva y observaciones aceptadas. Los descubrimientos sin reporte inicial siguen no evaluables porque la colección inicial de incidentes no es completa. No se inventan pérdidas económicas, profundidades o viviendas afectadas.

Los experimentos sintéticos y comparadores de 0.3 se conservan en el Laboratorio y en INFORME-v03.md. No se reutilizan sus cifras para afirmar desempeño real del índice 2.0. No hay una mejora predictiva demostrada sobre Guayaquil.

## Verificación y aprendizaje

Cada registro exige episodio, sector, fecha del fenómeno dentro de la ventana, resultado, responsable, método, descripción, evidencia HTTP(S) y alcance. Una inspección puntual no se cuenta como verificación de todo el sector. Para alcance sectorial se exige declarar representatividad. El registro empieza pendiente y requiere aceptación explícita en sesión. La aceptación es declarada por el operador; todavía no existe autenticación ni revisión institucional independiente.

Las correcciones conservan la entrada anterior. La observación aceptada más reciente se utiliza una sola vez; mientras una corrección sigue pendiente, la aceptada anterior continúa vigente. Una verificación negativa sectorial exige declarar evidencia de toda la ventana ya terminada. No se deduce de la falta de reportes ni de una visita posterior cuando la lluvia ya terminó.

Los nuevos datos cambian el estado sectorial, las métricas y las recomendaciones de evidencia. No se reentrena automáticamente un predictor con muestras insuficientes. Para aprendizaje supervisado útil se necesitan episodios independientes, inspecciones representativas positivas/negativas, geometrías y tiempos compatibles, y evaluación fuera del entrenamiento. El Laboratorio demuestra el aprendizaje bayesiano espacial con datos experimentales separados.

## Arquitectura y archivos

| Grupo | Archivos principales |
|---|---|
| Entrada | src/main.jsx, index.html, package.json, package-lock.json |
| Coordinación | src/city/RainApp.jsx, data.js, format.js |
| Motores reales | src/city/analysis.js: meteorología, índice, agregación, Shadow, verificación, métricas y separación temporal |
| Interfaz | CityBrief.jsx, EpisodeEvidence.jsx, SectorPassport.jsx, VerificationForm.jsx, RainTimeline.jsx, CityDialog.jsx, MapLegend.jsx, city.css |
| Cartografía | src/city/CityMap.jsx: fuentes separadas, geometría simplificada, todos los sectores visibles; agregación opcional por zoom, ausencia gris y selección |
| Adquisición | scripts/research-city.mjs, fetch-city.mjs, geocode-city.mjs, capture-forecast.mjs |
| GIS y datos | scripts/prepare-city-geometry.py, requirements-city.txt, build-city.mjs, build-city-database.py |
| Pruebas | src/city/analysis.test.js, ui.test.js; src/ui.integration.test.js ajustado para no abrir WebSocket en SSR |
| Documentación | scripts/report-city.mjs, docs/FLOODSHADOW-2.0.md, VERIFICACION-2.0.md, DEMO-EN.md, README.md |
| Snapshots | public/data/city/: sectores, zonas, eventos, índices, incidentes, auditoría, manifiesto y SQLite |

El motor experimental, sus datos y resultados previos se conservan. La interfaz principal y el Laboratorio se cargan por separado; la cartografía es una carga diferida. Se muestran hasta 30 sectores de vigilancia en la lista y se filtra el conjunto completo, evitando miles de nodos DOM. Los datos originales voluminosos se guardan en data-cache/city, fuera de la distribución pública, sin borrarlos.

La SQLite portable contiene StormEvent, GeographicSector, WeatherObservation, series meteorológicas, ImpactObservation, SectorAssessment, esquema de Verification y manifiesto. Las entidades se vinculan por episodio y código de sector. La geometría fuente se distingue del área analítica armonizada. La SQLite es una copia de consulta; las verificaciones de la aplicación se guardan en localStorage y se exportan en JSON, no se escriben automáticamente en esa base.

## Pruebas y validación

La suite actual incluye 35 pruebas automatizadas: las 20 anteriores y 15 nuevas de meteorología, distancia de asignación, índice, faltantes, agregación incompleta, estados de evidencia, verificación/correcciones, denominadores, cambios de cola, cobertura, separación temporal, contraste exploratorio, checksums y render integrado del pasaporte/línea de tiempo/fuentes. Las fixtures sintéticas de pruebas no se guardan en los datos reales.

El procesamiento GEOS registra validez analítica, validez del render, unión espacial, geometrías reparadas y cero solapamientos analíticos mayores de 1 m². La SQLite se comprueba mediante integrity_check y foreign_key_check. Los resultados finales de npm test, build, dependencias y recorridos del navegador están en VERIFICACION-2.0.md. El informe no sustituye una validación hidrometeorológica de campo.

## Criterios de aceptación

| Criterio | Estado y alcance |
|---|---|
| Mapa general y distintas zonas | Funcional, 6652 sectores y 737 agregaciones; cabecera y rurales |
| Episodio documentado | Dos casos reales, más captura prospectiva separada |
| Lluvia con fecha/unidad/fuente | Funcional; pronóstico, modelo y medición publicada diferenciados |
| Mediciones frente a estimaciones | Funcional; cinco acumulados sin interpolación inventada |
| Sector, antecedentes e infraestructura | Sector y huella funcionales; infraestructura explícitamente pendiente por HTTP 500 |
| Índice explicado | Funcional y no calibrado; exclusiones visibles |
| Afectaciones del episodio | ${manifest.impacts.total} registros documentados, 11 ubicaciones candidatas, resto pendiente; no se afirma confirmación de campo de polígonos completos |
| Antes/después sin información futura | Comparación funcional; reconstrucción histórica no se cuenta como acierto; captura prospectiva preservada |
| Posibles puntos ciegos | Cola explicada y actualizable por verificaciones |
| Interfaz comprensible | Navegación, fichas, formularios, errores y ayudas en inglés; Laboratorio anterior separado |
| Reproducción y pruebas | Scripts y snapshots incluidos; registro de verificaciones de ejecución |
| Separación real/modelado/sintético | Etiquetas, entidades y modos separados |

## Ejecutar y actualizar

Node.js 22 o posterior:

    npm install
    npm run dev

Abrir http://127.0.0.1:5174/. No se requieren API keys. WebGL y acceso a internet permiten el mapa base; las fichas y los snapshots locales siguen disponibles si falla ese mapa.

    npm test
    npm run build
    npm audit

Los snapshots están listos para usar. Para reproducir la adquisición y el procesamiento completo, Python 3.12 con los paquetes fijados en scripts/requirements-city.txt:

    python -m pip install -r scripts/requirements-city.txt
    npm run data:city:fetch
    npm run data:city:geometry
    npm run data:city:build
    python scripts/build-city-database.py
    node scripts/report-city.mjs

La adquisición reutiliza cachés para reproducir el snapshot; no equivale a una actualización continua. Para una captura nueva del pronóstico operativo:

    npm run forecast:capture
    python scripts/build-city-database.py
    node scripts/report-city.mjs

Recargar el navegador tras actualizar archivos. Las capturas anteriores permanecen en la caché; la interfaz conserva las diez más recientes compatibles por IDs. No hay automatización programada ni backend de ingestión continua.

## Demostración sencilla

1. Abrir Overview con el caso 24–25: 68 ubicaciones publicadas, mapa de la ciudad, 11 cruces candidatos y limitaciones de georreferenciación.
2. Seleccionar el 19 de octubre y During: comparar los cinco acumulados de estaciones con la serie del modelo; recorrer horas sin inventar observaciones de estación.
3. Abrir Before y seleccionar un sector: revisar pronóstico archivado, contribuciones del índice y datos excluidos.
4. Cambiar a After sin cambiar el sector: alternar mapa antes/después y abrir definiciones de métricas; observar por qué no se anuncian aciertos retrospectivos.
5. Seleccionar la captura de 72 horas: mostrar una evaluación realmente guardada antes de su ventana y su procedencia.
6. Volver al caso B, abrir Shadow Detection y elegir un candidato: distinguir contexto preocupante de información insuficiente. Registrar evidencia real solo si existe; nunca inventar una para la presentación.
7. Para demostrar propagación probabilística, abrir Laboratory, inspeccionar un sector sintético y mostrar los cambios vecinos; volver al mapa real con el botón superior.
8. Exportar el episodio para revisar fuentes, factores, snapshot original, verificaciones y métricas. Guía breve de presentación en inglés: DEMO-EN.md.

## Limitaciones pendientes

No hay probabilidades de inundación calibradas, modelo hidráulico, topografía de detalle, marea integrada ni capacidad/estado de drenajes. No hay serie instrumental horaria o cobertura espacial suficiente para validar lluvia por sector. La información periodística es parcial y las ubicaciones candidatas necesitan revisión. Los antecedentes carecen de vigencia verificable para un backtest estricto. El índice actual no mostró utilidad demostrada para los registros candidatos del caso B y necesita investigación, no ajuste cosmético de umbrales.

La plataforma es una base funcional de análisis y evidencia. No es un sistema oficial de alertas, no afirma operación en tiempo real, no coordina rescates y no ofrece rutas seguras. Persistencia local, ausencia de autenticación/sincronización y verificación institucional, carga cartográfica grande, validación en dispositivos físicos siguen pendientes.
`;
await writeFile(new URL("../docs/FLOODSHADOW-2.0.md", import.meta.url), report);
console.log("Generated docs/FLOODSHADOW-2.0.md");
