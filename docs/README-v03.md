# FLOODSHADOW 0.3

Plataforma experimental para estudiar afectaciones por inundación insuficientemente observadas y orientar verificaciones en un piloto de Guayaquil. Conserva el mapa y las fuentes de la versión anterior e incorpora un modelo bayesiano espacial propio, Active Verification y Evidence Passport.

## Ejecutar

Node.js 22 o posterior:

```powershell
npm install
npm run dev
```

Abrir http://127.0.0.1:5174/. El mapa base requiere internet; los snapshots de geometría e historia están incluidos. No se necesitan API keys. Ctrl+C detiene el servidor.

## Recorrido de demostración

1. Elegir el propósito: descubrir incidentes sin reportes o encontrar afectados en general.
2. Seleccionar una estrategia: probabilidad de afectación o información esperada por costo supuesto.
3. Elegir un sector en el mapa/lista y revisar Evidence Passport. Distingue observación, inferencia, desconocimiento, fuentes e intervalos.
4. Pulsar **Inspect experimental sector**: revela solo el resultado de ese sector y actualiza el posterior. El resultado puede ser positivo o negativo; ninguna recomendación garantiza descubrir una afectación.
5. Revisar **After the last verification** para ver cómo cambiaron otros sectores. También se pueden registrar observaciones manuales de demostración y corregirlas con trazabilidad.
6. Abrir **Compare decisions**: cinco métodos, mismos candidatos y capacidad, conjuntos general y de cero reportes separados. El benchmark de 100 episodios se ejecuta en un worker.
7. Cambiar condiciones en **Scenario laboratory**: lluvia, cobertura, desigualdad espacial, reportes falsos, datos faltantes y semilla. El historial tiene una sesión por configuración.
8. Usar **Source explorer** para explorar datos reales históricos. Este modo no calcula probabilidades de afectación ni prioridades porque no hay reportes actuales conectados.
9. Exportar el análisis para conservar parámetros, fuentes, diagnósticos y verificaciones. En Experiment incluye la verdad sintética identificada para evaluación.

## Pruebas y evaluación

```powershell
npm test
npm run build
npm run evaluate
node scripts/report-v03.mjs
npm audit
```

La evaluación principal ejecuta 2500 episodios, 500 por configuración, más evaluación secuencial, sensibilidad y 500 episodios suplementarios adversos. Puede tardar varios minutos. El manifiesto se guarda antes de ejecutar. Para una comprobación rápida se pueden definir las variables FLOOD_EVAL_RUNS y FLOOD_STRESS_RUNS; esos resultados no son equivalentes a la suite completa.

## Documentación actual

- [Informe técnico y resultados](docs/INFORME-v03.md): archivos, funciones, correcciones, algoritmo, experimentos, pruebas y límites.
- [Modelo y supuestos](docs/MODELO-v03.md): fórmulas, priors, inferencia, información esperada e identificación.
- [Auditoría de cambios](docs/AUDITORIA-v03.md): defecto, solución y comprobación por módulo.
- [Registro de verificación](docs/VERIFICACION-v03.md): pruebas, compilación y revisión de interfaz.
- [Resultados completos](docs/evaluation-v03.json), [manifiesto principal](docs/evaluation-manifest.json), [pruebas suplementarias](docs/stress-v03.json).
- [Diseño](docs/DISENO.md).

IMPLEMENTACION-v02.md y experimental-results-v02.json son referencias históricas de la versión anterior. No describen el motor actual y sus métricas no deben compararse directamente con el nuevo simulador.

## Datos y actualización

```powershell
npm run data:refresh
python scripts/build-database.py
```

El snapshot contiene 36 sectores INEC, 23 huellas municipales originales en el recorte, 109 eventos históricos regionales y 72 valores horarios de precipitación modelada. Los sectores se seleccionan por tamaño y distancia a un punto fijo, antes de generar resultados. La huella se une geométricamente antes de calcular su fracción dentro de cada sector. Las dos mitades del piloto son etiquetas geográficas internas, no barrios oficiales. Los códigos INEC permanecen visibles.

`public/data/floodshadow.sqlite` es una copia analítica portable de las fuentes con geometrías JSON. No es el backend de las verificaciones. Las notas se guardan exclusivamente en localStorage del navegador, con claves de configuración v3; los registros v2 se conservan separados.

## Arquitectura

| Módulo | Responsabilidad |
|---|---|
| src/model/probabilistic.js | Ocurrencia, reporte, posterior e incertidumbre |
| src/model/simulator.js | Verdad experimental separada de observaciones |
| src/model/evaluation.js | Comparadores, bootstrap, calibración sintética y secuencias |
| src/model/verification.js | Ledger y correcciones |
| src/model/legacy.js | Heurística original, solo baseline |
| src/data | Geometría y validación de fuentes |
| src/components | Pasaporte, comparación, laboratorio y fuentes |
| src/MapView.jsx | Cartografía y selección |
| src/App.jsx | Integración de estado y navegación |

## Alcance y atribución

Los incidentes de Experiment son sintéticos. Las probabilidades son posteriores condicionadas a supuestos, no estimaciones calibradas para Guayaquil. El sistema no dirige emergencias ni recomienda rutas. Las verificaciones se suponen exactas dentro del experimento; todos los costos evaluados son 1. El modelo puede perder frente a métodos simples y se publican esos casos.

React, Vite, MapLibre GL JS, Turf, Lucide y Prettier. Geometría INEC 2022; huellas municipales; eventos de Gestión de Riesgos; meteorología Open-Meteo/ECMWF IFS (CC BY 4.0); mapa base OpenFreeMap/OpenMapTiles/OpenStreetMap. Las condiciones de reutilización municipal deben confirmarse antes de ampliar la redistribución pública. Codex asistió en implementación; no se conectó una IA generativa al análisis ni se copió el modelo científico citado. El equipo debe comprender y revisar sus decisiones antes de presentarlo.
