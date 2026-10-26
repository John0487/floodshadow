# Implementación de FLOODSHADOW 0.2

FLOODSHADOW se reconstruyó como una aplicación cartográfica local para explorar información incompleta y orientar verificaciones. Esta versión demuestra el flujo completo de selección, explicación, registro y evaluación; todavía no valida detección real de inundaciones en Guayaquil.

## Qué cambió respecto de la primera beta

La pantalla de tarjetas y sectores ficticios fue reemplazada por una aplicación React con MapLibre. El mapa usa calles reales y polígonos censales descargados del INEC. La lista, la selección cartográfica, los vecinos y la ficha de evidencia están sincronizados. Las métricas se calculan con los mismos datos que utiliza el experimento, sin cifras decorativas.

Hay dos modos con propósitos distintos:

| Modo | Datos | Función |
|---|---|---|
| Experiment | Geometría real, huella histórica real, incidentes/reportes/lluvia simulados | Probar el método sabiendo cuáles incidentes se ocultaron |
| Source explorer | Geometría, huella histórica, meteorología modelada y registros institucionales históricos | Explorar fuentes y fechas sin declarar incidentes actuales |

La selección cambia de color según la variable elegida. Las fronteras azules marcan el sector seleccionado, las discontinuas azules sus vecinos y las discontinuas naranjas los primeros K candidatos.

## Fuentes descargadas

### Geometría oficial

Servicio: https://idgn.ecuadorencifras.gob.ec/server/rest/services/Hosted/Marco_Geoestadistico_2022/FeatureServer/7

Se consultó el rectángulo WGS84 [-79.955, -2.145, -79.905, -2.105]. El snapshot contiene una selección de 36 sectores de 696 polígonos devueltos por la consulta paginada. Se conservaron candidatos entre 0.015 y 1.8 km² y se ordenaron por distancia de su centroide al punto [-79.938, -2.136]. Se tomaron los primeros 36, antes de generar resultados experimentales.

Esta elección define un piloto por proximidad geográfica. No es una muestra representativa de toda la ciudad ni garantiza cobertura uniforme. El punto de referencia se fijó tras inspeccionar la disponibilidad de la cartografía histórica, sin consultar resultados de simulación. “Northern pilot” y “Southern pilot” son etiquetas internas derivadas de latitud, no divisiones municipales; los 36 sectores actuales pueden pertenecer a una sola etiqueta. “Sector 01–36” son alias de presentación. El código censal original es el identificador humano verificable.

Las áreas se calculan con Turf en geometría geográfica usando su cálculo geodésico aproximado; no mediante área plana en grados. Las distancias para seleccionar sectores son geográficas. No se utilizan características demográficas como prueba de afectación.

### Huella histórica municipal

Servicio: https://services7.arcgis.com/NWWHhu45fOJtCgG3/arcgis/rest/services/Zonas_Inundables_GYE/FeatureServer/0

Ficha: https://www.arcgis.com/home/item.html?id=315a96919144487fbe97932630b88b7b

Se descargaron 23 polígonos que intersectan el recorte, se calcularon intersecciones con cada sector y se guardó una versión recortada y simplificada para visualizar. El indicador es área de intersecciones sumada / área del sector, acotado a 1. Si existen polígonos superpuestos, la suma puede contar una porción más de una vez; es una limitación del índice actual. No es probabilidad de inundación.

Cero significa ausencia de solapamiento con esta capa particular, no evidencia de que el sector sea seguro. La cartografía resume estudios y antecedentes; no muestra extensión de inundación en tiempo real. Los metadatos públicos no especifican licencia de reutilización; deberá aclararse antes de redistribuir públicamente derivados a mayor escala.

### Eventos históricos

Servicio: https://sgrportal.gestionderiesgos.gob.ec/server/rest/services/Hosted/EVENTOS_X_LLUVIAS/FeatureServer/0

Se consultó una ventana mayor, [-80.05, -2.30, -79.84, -2.00], que incluye Guayaquil y cantones vecinos. El snapshot incluye 109 puntos de registro. Solo se conservaron identificador, cantón, parroquia, sector, tipo de evento, fecha y geometría. No se descargaron nombres de personas, edades, víctimas u otros campos personales del servicio.

Los registros tienen sus propias fechas históricas, incluidas fechas de 2025; no se asignan al episodio del 19 de octubre de 2026. Algunos nombres de sector y ubicaciones son aproximados o agregados. Los puntos aparecen en Source explorer; el botón regional amplía el mapa y un clic permite leer la fecha. También se pueden consultar en la tabla de fuentes. No alimentan el ranking porque no se validó una correspondencia temporal y espacial suficiente con el piloto.

### Meteorología

Documentación: https://open-meteo.com/en/docs/historical-weather-api

Se guardaron 72 valores horarios de precipitación modelada de ECMWF IFS para los días 18–20 de octubre de 2026, zona horaria America/Guayaquil. La URL exacta de consulta y el punto de grilla realmente devuelto están en weather.json. En Source explorer se suman las 24 horas del 19 de octubre y se comparte ese valor entre los sectores del piloto. La resolución aproximada de 9 km no permite atribuir mediciones independientes a cada calle.

El botón Refresh weather consulta nuevamente el mismo episodio histórico, no el tiempo actual. Conserva el snapshot anterior ante errores y actualiza la fecha de consulta en la sesión; Export permite retener la respuesta nueva. La actualización interactiva no modifica automáticamente los archivos del repositorio.

### Mapa base

OpenFreeMap Positron, con datos de OpenMapTiles y OpenStreetMap. Referencia: https://openfreemap.org/quick_start/

El mapa base requiere internet y no se descarga masivamente. Los GeoJSON y la meteorología de referencia están incluidos localmente. Si el estilo no está disponible se intenta una base plana con la geometría local. Si falla WebGL se informa al usuario y la lista permite seguir consultando evidencia.

## Cómo funciona la selección

El algoritmo recibe observaciones, geometría procesada y verificaciones manuales; nunca recibe las etiquetas ocultas de afectación del simulador.

1. Normaliza la lluvia con min(lluvia / 140, 1).
2. Toma la fracción histórica de solapamiento del sector.
3. Calcula la fracción de vecinos con reportes positivos o verificación manual de afectación. Los vecinos verificados como no afectados no aportan evidencia positiva.
4. Calcula Contexto = 0.45 × lluvia normalizada + 0.35 × solapamiento + 0.20 × evidencia vecinal.
5. Calcula Vacío = 1 − min(reportes / 6, 1).
6. Calcula Prioridad = redondear(100 × Contexto × (0.45 + 0.55 × Vacío)).
7. Ordena por prioridad y desempata por identificador numérico.
8. Excluye de pendientes a sectores verificados y selecciona los primeros K.

Los pesos son decisiones heurísticas declaradas, no parámetros aprendidos ni probabilidades calibradas. Falta de reportes sin contexto no produce por sí sola una puntuación alta. En Source explorer, los reportes no están conectados: se usa vacío 1 y no se afirma que los reportes sean cero. Si falta meteorología, su contribución es cero, no una medición ficticia.

Vecindad significa intersección entre polígonos o contacto con tolerancia de un metro. Puede incluir contactos por vértice; no representa una red de drenaje ni propagación hidráulica. Al registrar una verificación se actualizan las recomendaciones mediante estas reglas, sin reentrenar un modelo.

## Persistencia y base de datos

La aplicación consume archivos JSON/GeoJSON para servir una demo simple. Se construyó además public/data/floodshadow.sqlite como copia portable consultable de las fuentes. Las geometrías están guardadas como texto GeoJSON; no requiere PostGIS ni Spatialite.

| Tabla | Contenido del snapshot |
|---|---|
| sectors | 36 sectores, códigos, áreas, vecinos, geometría e índice histórico |
| historical_footprints | 23 geometrías recortadas |
| historical_events | 109 eventos con campos públicos seleccionados |
| weather_hourly | 72 registros horarios |
| source_metadata | Metadatos de geografía y meteorología |

Ejemplo de consulta: SELECT census_code, historical_overlap FROM sectors ORDER BY historical_overlap DESC;

La SQLite es una copia analítica de fuentes, no el backend transaccional de la interfaz. El plan y las notas de verificaciones se guardan en localStorage bajo floodshadow-v2. Cada combinación de modo, semilla y parámetros tiene una sesión separada. No existe sincronización entre navegadores, autenticación ni almacenamiento de notas en un servidor. El botón Export descarga observaciones, selección, procedencia y evaluación; en modo experimental incluye la verdad oculta identificada para auditoría.

## Simulación y resultados

Los incidentes se generan mediante lluvia, solapamiento y variación aleatoria. Cada sector afectado tiene diez oportunidades de reporte, con una tasa experimental que varía por grupos de índices. Estos grupos son artificiales y no representan características sociales de los sectores reales. No se simulan falsos reportes.

El comparador usa el mismo K y la misma verdad experimental para ambas estrategias. La selección tradicional ordena por reportes; FloodShadow usa el índice contextual. Se evalúan las selecciones iniciales antes de las verificaciones manuales para no mezclar distintos momentos de información.

- Precision@K: afectados seleccionados / seleccionados.
- Recall@K: afectados seleccionados / total de afectados.
- Descubrimientos ocultos: seleccionados afectados con cero reportes.
- Si un denominador está vacío, la implementación muestra cero.

Cada benchmark utiliza las semillas 1000–1099. El archivo experimental-results.json contiene resultados de los tres escenarios con K=5. Valores medios aproximados del snapshot:

| Escenario | Descubrimientos ocultos tradicionales | Descubrimientos ocultos FLOODSHADOW | Precisión FLOODSHADOW |
|---|---:|---:|---:|
| Reporte desigual | 0 | 0.88 | 34.4% |
| Observación extendida | 0 | 0 | 0.4% |
| Visibilidad limitada | 0 | 1.45 | 53.6% |

En estos experimentos el método tradicional obtiene 100% de precisión: el simulador no tiene falsos reportes y existen suficientes sectores reportados para llenar K. La heurística sacrifica detecciones conocidas para explorar sectores no observados. En cobertura alta resulta especialmente ineficiente. Esto es una limitación medida y visible, no un resultado que deba ocultarse ni una prueba de superioridad general de FLOODSHADOW.

El simulador comparte insumos ambientales con el índice y crea un entorno favorable. Aun así no garantiza mejora. Ninguna cifra valida desempeño real en Guayaquil. El siguiente paso científico sería modelar explícitamente la probabilidad de observación, incorporar costos de inspección y contrastar con verificaciones independientes.

## Verificación técnica

Las pruebas automatizadas comprueban reproducibilidad, separación de verdad y observaciones, cobertura cero, actualización espacial de verificación, exclusión de pendientes, denominadores de métricas y repetibilidad del benchmark. La generación SQLite verifica 36 sectores e índices entre cero y uno. Se compila con Vite y se revisan los flujos en el navegador.

Las dependencias se revisaron con npm audit. MapLibre se actualizó a una versión corregida; la revisión posterior no reportó vulnerabilidades conocidas. Esto no sustituye una auditoría de seguridad completa.

## Qué queda fuera

No hay un modelo bayesiano calibrado, predicción hidráulica, feed de denuncias en tiempo real, clasificación satelital, rutas seguras, sensórica ni despacho a instituciones. La literatura de Agostini, Pierson y Garg (AAAI 2024, https://doi.org/10.1609/aaai.v38i20.30190) es inspiración; su modelo no se reproduce aquí.

Para una siguiente fase: validar licencias y metadatos, revisar topología y solapamientos, construir correspondencia entre reportes y eventos, recoger verificaciones independientes, definir utilidad/costo de inspección y evaluar modelos probabilísticos con separación temporal y espacial. La presentación deberá distinguir lo implementado, lo simulado y lo propuesto.
