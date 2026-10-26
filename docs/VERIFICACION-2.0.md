# Verificación FLOODSHADOW 2.0

Registro de la entrega local del 25 de octubre de 2026, zona America/Guayaquil. La última corrección del usuario prevalece sobre el documento inicial: **interfaz en inglés y todos los sectores visibles como polígonos**.

## Pruebas automatizadas

`npm test`: **35 aprobadas, 0 fallidas, 0 omitidas**. Se conservan 20 pruebas del motor anterior y se añaden 15 del análisis y render de episodios reales. La ejecución final comprobó también las nuevas aserciones de idioma, ausencia de observaciones posteriores en Before y validez de los 6652 sectores del render.

Se verifican geometrías e IDs, horas completas y duplicadas, cero frente a faltante, distancia máxima de asignación meteorológica, contribuciones del índice, agregación incompleta, punto frente a polígono, resultados positivos/negativos, revisión y correcciones, cambios de cola, denominadores, cobertura por área, protección temporal, integridad de snapshots y render integrado de fuentes, ficha y línea de tiempo. Los datos inventados de pruebas permanecen aislados de los registros reales.

## Datos y geometrías

- Descarga paginada contrastada con `returnCountOnly`: 6652 sectores INEC y 5746 huellas. Una descarga incompleta falla antes de reemplazar el archivo correspondiente; no depende de que GeoJSON publique `exceededTransferLimit`.
- GEOS/Shapely: 6652 geometrías analíticas válidas, 6652 geometrías de render válidas y 737 zonas válidas.
- Siete huellas reparadas; cero solapamientos analíticos mayores de 1 m² tras la partición técnica documentada. Los originales se conservan.
- Doce simplificaciones sectoriales inválidas utilizan la geometría analítica válida; 21 zonas tienen su propio respaldo de simplificación.
- 897 sectores con ajuste de superficie superior al 1% no reciben índice. No se encubre la incertidumbre del borde.
- 78 registros tipificados; 11 cruces candidatos, de los cuales siete permiten asignación sectorial provisional y cuatro siguen ambiguos. Los restantes 67 no reciben coordenadas.
- SQLite: `integrity_check = ok`; `foreign_key_check` sin filas. Contiene 3 episodios/ventanas, 6652 sectores, 5 acumulados instrumentales publicados, 30 series, 78 registros y 3 snapshots; cero verificaciones precargadas.

## Revisión de navegador

Se recorrió la aplicación local en el navegador de Codex. No se guardaron inspecciones reales ficticias para probar la interfaz.

| Recorrido | Resultado observado |
|---|---|
| Overview | Polígonos con bordes y colores de vigilancia visibles desde el comienzo; puntos superpuestos |
| Selección directa en mapa | Un clic sobre polígono abrió INEC 090150251010 y su ficha |
| Cobertura | 6416 sectores en cabecera; al activar cantón aparecen 6652 |
| Before | Pronóstico e índice diferenciados de probabilidad; no se muestran mediciones posteriores como contexto previo |
| During, 19 de octubre | Cinco acumulados publicados: 181, 141, 132, 117, 112 mm; línea de tiempo de modelo de 24 horas |
| Selección horaria | 05:00 muestra 21.3 mm/h del modelo; los acumulados de estaciones permanecen sin interpolar |
| After | Conserva el sector seleccionado; muestra 8.4 mm previstos y 22.3 mm modelados después en el sector probado |
| Métricas | Cero verificaciones; afectados entre verificados no evaluable; siete sectores con puntos candidatos; contraste exploratorio 0/6 y uno sin índice |
| Captura prospectiva | 72 barras horarias, máximo entre celdas 75.7 mm, recepción Oct 25, 2026, 6:34 PM; sin observaciones posteriores inventadas |
| Fuentes | Catálogo y límites en inglés, con GIS municipal HTTP 500 y fuentes investigadas no integradas identificadas |
| Laboratory | Carga la aplicación experimental conservada y permite volver a Guayaquil |
| Exportación | JSON 2.0.0 analizado: alcance urban, 6416 sectores, 75 registros del alcance y cero verificaciones; snapshot retrospectivo identificado |
| Adaptación | Revisión a 1280 px, ancho disponible 710 px y móvil 390 × 844; sin desbordamiento horizontal del documento; modal móvil dentro del ancho |
| Consola | Cero errores en el recorrido revisado |

Las capturas están en `docs/screenshots/city-english-sectors.png` y `mobile-english-sectors.png`. La revisión utiliza emulación de tamaño, no certificación en dispositivos físicos.

## Compilación y dependencias

`npm run build`: **correcta**, 1927 módulos, 9.22 segundos en la ejecución final. Entrada de 287.09 kB (89.47 kB gzip); mapa de 8.37 kB más el paquete MapLibre de 1073.62 kB (293.63 kB gzip) y su worker. Se conserva el aviso de tamaño de MapLibre. El mapa y el Laboratorio se cargan de forma diferida; no se ocultó el aviso aumentando el umbral.

`npm audit`: **cero vulnerabilidades informadas**. El resultado está en [dependency-audit-2.0.json](dependency-audit-2.0.json). Esta revisión de dependencias no sustituye una auditoría de seguridad de la aplicación.

## Límites de la verificación

No hay validación de inundaciones en campo ni probabilidades calibradas. El resultado desfavorable del índice exploratorio no se presenta como precisión o recall. No se reentrena un predictor con las pocas ubicaciones candidatas. Las comparaciones sintéticas anteriores se conservan y no se reutilizan como prueba de desempeño real. Falta backend compartido, autenticación, revisión institucional, series instrumentales compatibles, topografía/hidráulica/marea y acceso a infraestructura municipal. Los datos originales y los nombres propios permanecen en su idioma de fuente; las etiquetas y explicaciones de la interfaz están en inglés.

## Actualización de áreas y entrega 3Jota

Suite ampliada: 38 pruebas aprobadas. Las tres pruebas nuevas verifican partición territorial, búsqueda con acentos y alias San Borondón, aislamiento del cantón externo y escala de lluvia sin valores inventados. 100 contornos de agrupaciones y 246 polígonos externos válidos. Urdesa: 89 unidades, tres registros mapeados; Samborondón: cero barras meteorológicas y aviso explícito de cobertura no analizada. Vista móvil de 390 px sin desbordamiento horizontal; consola sin errores. Reported impacts abre Rain estimate.

Propuesta inglesa de cuatro páginas y guía española de nueve páginas revisadas íntegramente mediante PNGs del renderer de documentos, con conversión PDF de Word nativo porque LibreOffice no está disponible en Windows. Tipografía Times New Roman incrustada, PDFs sin contraseña y autores comprobados; referencias numeradas por primera aparición. Registro en `entrega-validation.json`.
