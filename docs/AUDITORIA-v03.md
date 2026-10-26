# Auditoría de cambios FLOODSHADOW 0.3

Cada modificación se vinculó a un defecto y una comprobación. El estilo y los flujos útiles de mapa, búsqueda, fuentes, exportación y almacenamiento local se conservaron.

| Archivo o módulo | Defecto concreto | Cambio | Verificación |
|---|---|---|---|
| engine.js / model/legacy.js | Heurística presentada como selección principal; simulador por índice | Fachada estable y conservación del ranking anterior solo como baseline | Cinco métodos evaluados bajo las mismas condiciones |
| model/simulator.js | Ausencia de correlación espacial en ocurrencia, falsos reportes y datos ausentes | Generador Ising espacial, campos de cobertura, Poisson de ruido y flujos aleatorios separados | Reproducibilidad, cobertura cero, ruido, ausencia e invariancia de verdad ante cambios de reporte |
| model/probabilistic.js | No separaba ocurrencia y observación ni incorporaba incertidumbre | Modelo jerárquico de ocupación/reporte y posterior por importance sampling | Fórmula cerrada, límites, datos ausentes, ESS, actualización positiva y negativa |
| model/verification.js | Verificaciones sin identidad, procedencia completa ni correcciones auditables | Ledger con origen, observador, episodio, hora, versión, cambios y supersesión | Prueba de corrección sin doble conteo; flujo manual/oráculo en navegador |
| model/evaluation.js | Comparación sin azar ni historia; conjuntos y denominadores ambiguos | Cinco métodos, dos conjuntos candidatos, bootstrap emparejado, métricas N/A cuando corresponde | Igualdad de candidatos/K, empates deterministas, métricas con verdad oculta, reproducibilidad |
| scripts/evaluate-v03.mjs | Sin prueba de generalización ni sensibilidad | Manifiesto previo, 2500 episodios, casos reservados, evaluación secuencial y sensibilidad | Archivo de resultados completo y comando reproducible |
| data/geography.js / prepare-data.mjs | Área histórica podía sumarse dos veces y errores de intersección se ocultaban | Unión antes de intersectar, validación y fallos explícitos | Geometrías duplicadas/parcialmente superpuestas y regeneración del snapshot |
| sectors.geojson | Todos los sectores se etiquetaban Southern pilot | Mitades del piloto por mediana geográfica, identificadas como etiquetas internas | Dos etiquetas y vecinos simétricos; códigos INEC preservados |
| data/validation.js | JSON opcional fallido destruía la carga; nulos de lluvia se trataban como cero | Fuentes opcionales aisladas; día local completo de 24 horas o desconocido | Fallos de red simulados, datos faltantes y agregación horaria |
| App.jsx / MapView.jsx | Source explorer calculaba prioridades sin denuncias | No se ejecuta inferencia ni selección en fuentes; celdas ausentes grises | Prueba de integración de render y revisión de modo de fuentes |
| components/EvidencePassport.jsx | Ficha mezclaba índice y evidencia sin incertidumbre | Fuentes, observaciones, inferencias, desconocimiento, intervalos y diferencias tras verificar | Render de ambas modalidades, pruebas en navegador y exportación |
| components/Comparison.jsx / evaluation.worker.js | Solo dos estrategias; benchmark bloqueaba la interfaz | Cinco comparadores y evaluación en worker cancelable | Integración de tabla y benchmark interactivo |
| components/ScenarioLab.jsx / SourceRegistry.jsx | Componente principal muy extenso | Separación de laboratorio y registro de fuentes | Compilación, integración y navegación conservada |
| CSS / diseño responsive | Nuevos controles necesitaban adaptación sin reemplazar estilo | Estilos científicos, selección de propósito, intervalos, advertencias y tabla desplazable | Revisión de escritorio y móvil |

## Incidencias encontradas durante pruebas

- La media ponderada de un estado fijado podía ser 0.9999999999999994: se devuelve exactamente 0 o 1 cuando existe una verificación exacta experimental.
- La evaluación de incidentes ocultos utilizaba el reporte observado; con observaciones faltantes esto podía subcontar descubrimientos. Ahora utiliza el conteo de verdad solo en el evaluador. Se repitió la suite completa tras corregirlo.
- Los intervalos de cambios durante verificaciones secuenciales deben remuestrear episodios, no pasos dependientes. Se agregan primero por episodio.
- El servidor Vite usado por las pruebas de render podía cerrar mientras escaneaba dependencias. Se aisló su caché y se desactivó el escaneo en ese entorno de prueba.

## Alcance de la auditoría

Se revisaron los datos y casos del piloto incluido, no toda la cartografía nacional ni todos los episodios reales de Guayaquil. Los polígonos públicos tienen metadatos y condiciones de reutilización que deben confirmarse antes de ampliar una publicación. El sistema sigue siendo local y experimental.
