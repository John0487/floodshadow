# Registro de verificación — FLOODSHADOW 0.3

Revisión ejecutada el 25 de octubre de 2026 sobre el proyecto local. El directorio no contiene un repositorio Git; la lista de cambios corresponde a archivos del workspace, sin inventar commits ni una comparación Git.

## Automatización

| Comprobación | Resultado |
|---|---|
| `npm test` | 20 pruebas aprobadas, 0 fallidas, 0 omitidas; última ejecución 3,88 s |
| `npm run build` | Vite 7.3.7: 1913 módulos; compilación de producción correcta en 19,71 s |
| `npm audit` | 0 vulnerabilidades conocidas en dependencias de producción y desarrollo |
| Evaluación principal | 2500 episodios completos, cinco métodos, mismos candidatos y K=5 |
| Evaluación secuencial | 100 episodios con verificaciones sucesivas, comparadores y dos estrategias |
| Pruebas adversas | 500 episodios suplementarios completos; resultados negativos publicados |
| Sensibilidad | Priors y cantidad de partículas comparados en episodio fijo |
| Datos | 36 geometrías, topología simétrica, unión histórica sin duplicación; SQLite regenerada |

Las pruebas automatizadas cubren mezcla Poisson analítica, falta de observación frente a cero, reproducibilidad y flujos aleatorios independientes, actualización positiva/negativa, incertidumbre, entradas inválidas, información mutua, conjuntos candidatos comunes, denominadores, definición de ocultos, bootstrap, correcciones, unión espacial, meteorología, errores de fuentes, topología, selección secuencial, ley de esperanza total e integración del pasaporte y comparador.

La compilación deja una advertencia de tamaño: el JavaScript principal pesa aproximadamente 1,37 MB sin gzip (387 KB comprimido) y el worker cartográfico 517 KB. No es un fallo de compilación; queda pendiente dividir y optimizar la carga cartográfica.

## Revisión en navegador

Aplicación comprobada en `http://127.0.0.1:5174/`, navegador integrado con WebGL.

| Recorrido | Evidencia observada |
|---|---|
| Estado inicial, semilla 42 | Sector 03: afectación inferida 44%, intervalo condicional 9–83%, probabilidad de reporte dado afectación 34% |
| Inspección del sector 03 | Resultado experimental negativo; probabilidad condicionada 0%; sector 05 cambia 40→31%, sector 14 32→24% y sector 02 25→18% |
| Observación positiva manual, sector 05 | Cambian otros sectores: 11 de 30→39%, 14 de 24→33%, 06 de 21→28% |
| Corrección negativa del mismo sector | Se conserva la entrada anterior y su referencia de corrección; se usa una sola observación vigente |
| Comparación | Cinco métodos visibles, capacidad común, benchmark de 100 episodios terminado; selección inicial de candidatos con cero reportes por defecto |
| Source explorer | No calcula probabilidades ni prioridades; cuenta actual desconocida, contexto histórico separado del episodio meteorológico |
| Exportación experimental | JSON versión 0.3.0, modelo spatial-occupancy-poisson-1, 36 filas y verdad sintética identificada en experimentalEvaluation |
| Exportación de fuentes | experimentalEvaluation y diagnósticos null; selección vacía; ninguna probabilidad calculada |
| Escritorio 1280×900 y 1440×950 | Sin desbordamiento horizontal; mapa y panel de evidencia visibles |
| Móvil 390×844 | Sin desbordamiento horizontal; mapa, pasaporte y controles/lista en flujo vertical; captura revisada |
| Consola | Sin errores capturados al finalizar los recorridos |
| Teclado | Enter abre el comparador; Escape lo cierra y devuelve el foco al botón de apertura |

Los registros creados únicamente para esta revisión se retiraron de la sesión experimental de prueba. La aplicación queda con cero verificaciones y cero sectores planificados. No se eliminaron notas previas del usuario. La modificación temporal del viewport se restableció.

Capturas: [escritorio](screenshots/workspace-v03.png) y [móvil](screenshots/mobile-v03.png).
El resultado legible por máquina de la revisión de dependencias está en [dependency-audit-v03.json](dependency-audit-v03.json).

## Alcance y pendientes

Estas comprobaciones validan implementación y recorridos experimentales; no prueban precisión sobre inundaciones reales. La validación local con observaciones independientes, fiabilidad de inspecciones, interoperabilidad entre operadores, accesibilidad formal y pruebas en dispositivos físicos siguen pendientes. Los intervalos experimentales son exploratorios y no corrigen comparaciones múltiples.

Para repetir: `npm test`, `npm run build`, `npm run evaluate`, `node scripts/report-v03.mjs` y `npm audit`. La suite completa es costosa y los archivos JSON guardados contienen manifiestos y resultados para inspección reproducible.
