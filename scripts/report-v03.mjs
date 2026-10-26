import { readFile, writeFile } from "node:fs/promises";
const e = JSON.parse(
  await readFile(
    new URL("../docs/evaluation-v03.json", import.meta.url),
    "utf8",
  ),
);
if (!e.complete) throw Error("Evaluation is incomplete");
const f = (n) => (n == null ? "N/A" : n.toFixed(3)),
  ci = (s) => `${f(s.mean)} [${f(s.lo)}, ${f(s.hi)}]`;
const methods = ["random", "reports", "history", "original", "model"];
const hidden = e.results
  .map(
    (r) =>
      `| ${r.configuration.label} | ${methods.map((m) => f(r.pools.hidden.methods[m].hidden.mean)).join(" | ")} |`,
  )
  .join("\n");
const affected = e.results
  .map(
    (r) =>
      `| ${r.configuration.label} | ${methods.map((m) => f(r.pools.all.methods[m].hits.mean)).join(" | ")} |`,
  )
  .join("\n");
const paired = e.results
  .map(
    (r) =>
      `| ${r.configuration.label} | ${ci(r.pools.hidden.paired.random.hidden)} | ${ci(r.pools.hidden.paired.history.hidden)} | ${ci(r.pools.hidden.paired.original.hidden)} |`,
  )
  .join("\n");
const sequential = e.sequential
  .map((s) => `| ${s.strategy} | ${ci(s.hiddenDiscoveries)} |`)
  .join("\n");
const diagnostics = e.results
  .map(
    (r) =>
      `| ${r.configuration.label} | ${f(r.calibration.brier)} | ${r.diagnostics.meanEss.toFixed(1)} | ${r.diagnostics.lowEssEpisodes}/${r.runs} |`,
  )
  .join("\n");
let stressText = "";
try {
  const stress = JSON.parse(
    await readFile(new URL("../docs/stress-v03.json", import.meta.url), "utf8"),
  );
  if (stress.complete)
    stressText = `
### Pruebas suplementarias adversas

Se añadieron después de inspeccionar la suite principal, con el modelo sin cambios: son exploratorias y no forman parte de las afirmaciones de generalización previamente reservadas. Cada escenario contiene 250 episodios adicionales.

| Escenario | Ocultos azar | Ocultos historia | Ocultos heurística | Ocultos modelo | Diferencia modelo − azar [95% CI] |
|---|---:|---:|---:|---:|---|
${stress.results.map((r) => `| ${r.configuration.label} | ${f(r.pools.hidden.methods.random.hidden.mean)} | ${f(r.pools.hidden.methods.history.hidden.mean)} | ${f(r.pools.hidden.methods.original.hidden.mean)} | ${f(r.pools.hidden.methods.model.hidden.mean)} | ${ci(r.pools.hidden.paired.random.hidden)} |`).join("\n")}

Cuando la asociación histórica del generador contradice el prior, el modelo encuentra menos incidentes ocultos que el azar y menos afectados en general que el conteo de reportes. Esto demuestra dependencia de supuestos y ausencia de superioridad universal. El escenario sin falsos reportes evita que toda ventaja dependa de añadir ruido al comparador. No se interpreta ninguna de estas configuraciones como una estimación de condiciones reales de Guayaquil.
`;
} catch {
  stressText =
    "\nPruebas suplementarias no disponibles; ejecutar scripts/stress-v03.mjs.\n";
}
const report = `# Informe técnico FLOODSHADOW 0.3

Se implementó un motor probabilístico espacial, Active Verification y Evidence Passport sobre la aplicación existente. Se preservaron mapa, fuentes, búsqueda, planificación, escenarios, exportación y almacenamiento local. El uso defendible sigue siendo estudiar puntos ciegos y orientar verificaciones; no detectar inundaciones actuales ni coordinar emergencias.

## 1 Archivos modificados y añadidos

| Grupo | Archivos | Función |
|---|---|---|
| Integración | src/App.jsx, src/main.jsx, src/engine.js | Estado, modos, propósito de selección y API modular |
| Motor nuevo | src/model/probabilistic.js, math.js | Modelo de ocurrencia y reporte, incertidumbre, información y ESS |
| Simulación y comparadores | src/model/simulator.js, legacy.js, evaluation.js, evaluation.worker.js | Generador espacial independiente, baseline original, métricas y ejecución sin bloquear UI |
| Verificaciones | src/model/verification.js | Ledger, correcciones, procedencia y cambios de estimaciones |
| Interfaz | src/components/EvidencePassport.jsx, Comparison.jsx, ScenarioLab.jsx, SourceRegistry.jsx | Pasaporte, cinco métodos, laboratorio y fuentes separados |
| Datos | src/data/geography.js, validation.js; scripts/prepare-data.mjs | Unión geométrica, etiquetas, validación, fallos y datos faltantes |
| Cartografía y estilos | src/MapView.jsx, src/science.css, style.css, responsive.css | Nulos grises, estimaciones experimentales, intervalos y adaptación |
| Pruebas | src/engine.test.js, src/ui.integration.test.js | Casos estadísticos, espaciales, trazabilidad e integración |
| Reproducción | scripts/evaluate-v03.mjs, stress-v03.mjs, evaluate.mjs, report-v03.mjs; package.json, package-lock.json | Evaluación, pruebas adversas, entrada compatible y herramientas de formato |
| Snapshots | public/data/sectors.geojson, sources.json, raw-footprints.geojson, susceptibility.geojson, events.geojson, weather.json, floodshadow.sqlite | Datos regenerados y base portable actualizada |
| Documentación | MODELO-v03.md, AUDITORIA-v03.md, VERIFICACION-v03.md, evaluation-manifest.json, evaluation-v03.json, stress-manifest.json, stress-v03.json, README e IMPLEMENTACION.md | Supuestos, auditoría y resultados reproducibles |

La implementación previa y resultados v0.2 se conservan como archivos históricos identificados; sus números no se comparan directamente con los del nuevo simulador.

## 2 Funciones nuevas

- Estimaciones separadas de afectación y probabilidad de reporte dado que existe afectación.
- Intervalos creíbles condicionales del 90%, entropía, ganancia esperada de información y diagnóstico ESS.
- Propósitos separados para descubrir incidentes sin reportes y encontrar afectados en general.
- Estrategias por probabilidad o información esperada, por unidad de costo asumido.
- Inspección experimental que revela la verdad solo del sector seleccionado; observaciones manuales positivas y negativas.
- Reponderación bayesiana de los campos compartidos al verificar; cambios antes/después visibles en otros sectores.
- Ledger con observador, origen, episodio, hora, versión, nota y referencia de corrección.
- Evidence Passport que separa fuentes, observaciones, inferencias y desconocimiento.
- Cinco comparadores, dos conjuntos candidatos, intervalos bootstrap y worker para la evaluación interactiva.

## 3 Errores corregidos

Se eliminó la cobertura por índice i % 3. La simulación ahora incluye correlación espacial, falsos positivos y datos ausentes, con flujos aleatorios separados. Se evita el doble conteo de huellas mediante unión geométrica y se dejan de ocultar errores de intersección. Las mitades del piloto se asignan por mediana geográfica y se declaran internas. Source explorer ya no emite prioridades sin reportes actuales. La lluvia requiere las 24 horas válidas del día local y no convierte valores ausentes en cero. Los fallos de fuentes opcionales no destruyen la cartografía. Los denominadores vacíos son N/A. La evaluación de incidentes ocultos utiliza la verdad del simulador incluso cuando falta su observación, sin filtrarla al motor. Las verificaciones corregidas no se contabilizan dos veces.

## 4 Algoritmo y justificación

Se utiliza un modelo bayesiano de ocupación/observación: afectación Bernoulli condicionada a campos gaussianos espaciales, y reportes Poisson con intensidades diferentes según exista o no afectación. Una intensidad de ruido permite falsos reportes. Se integra analíticamente el estado desconocido por partícula y se aproximan los parámetros mediante importance sampling. Las verificaciones reemplazan el factor de mezcla por el correspondiente estado observado; así actualizan ocurrencia y reporte, incluidos otros sectores.

El modelo es propio y diferente al Ising/MCMC de AAAI 2024. Los priors, la correlación y la distribución de ruido son supuestos explícitos. Los reportes aislados no identifican ambos procesos sin restricciones adicionales. Los detalles, fórmulas, parámetros y referencias están en MODELO-v03.md. Los intervalos y las probabilidades no están calibrados para Guayaquil.

## 5 Resultados experimentales

Se ejecutaron ${e.manifest.runs} episodios por configuración, cinco configuraciones y K=5: ${e.manifest.runs * e.results.length} episodios principales. Dos configuraciones están reservadas para generalización. El modelo utiliza ${e.manifest.particles} partículas en esta suite. El manifiesto fija configuración y semillas antes de ejecutar. Se usan 600 resamples bootstrap emparejados por episodio; son intervalos exploratorios sin corrección por comparaciones múltiples.

### Incidentes ocultos encontrados entre candidatos con cero reportes observados

Medias por hasta cinco verificaciones. Cantidad de reportes coincide con azar en este conjunto: todos sus conteos son cero y los empates usan la misma semilla.

| Escenario | Azar | Reportes | Historia | Heurística original | Modelo nuevo |
|---|---:|---:|---:|---:|---:|
${hidden}

### Afectados encontrados en el conjunto general

Se evalúa por separado el objetivo de encontrar afectados en general. Los métodos reciben el mismo conjunto de candidatos y K.

| Escenario | Azar | Reportes | Historia | Heurística original | Modelo nuevo |
|---|---:|---:|---:|---:|---:|
${affected}

### Diferencias emparejadas de descubrimientos ocultos

Modelo menos comparador; intervalo bootstrap del 95%. Si incluye cero, no se demuestra una diferencia clara en esa comparación.

| Escenario | Contra azar | Contra historia | Contra heurística |
|---|---|---|---|
${paired}

El modelo supera al azar en los cinco escenarios de esta suite sintética. No demuestra superioridad frente a la huella histórica: sus diferencias con historia incluyen cero en todos los escenarios. Frente a la heurística, mejora en el escenario reservado de ruido alto, pero pierde en observación extendida y en correlación fuerte con lluvia baja. En el objetivo general mejora al conteo de reportes en estos escenarios; ello no equivale a mejorar la búsqueda de incidentes ocultos.

La huella histórica es un comparador fuerte porque el generador usa esta misma covariable para la ocurrencia. Con pocos reportes de un solo episodio, las tasas de observación siguen débilmente identificadas y las probabilidades dependen del prior. La familia gaussiana de inferencia tampoco reproduce necesariamente la concentración Ising de incidentes del simulador. Se publican estos límites sin ajustar semillas, criterios o parámetros para ocultarlos.

### Verificación secuencial

100 episodios adicionales con semillas 110000–110099, hasta cinco inspecciones sin repetir sectores, mismo conjunto inicialmente observado sin reportes. Los modelos actualizan su posterior después de cada observación. Los intervalos agregan por episodio.

| Estrategia | Afectados ocultos encontrados, media [95% CI] |
|---|---|
${sequential}

La estrategia de información busca aprender sobre el ensamble, no maximizar directamente la cantidad de incidentes encontrados. Esta prueba no demuestra que Active Verification supere a la heurística o historia en descubrimientos; demuestra el ciclo de actualización y mide su utilidad bajo el escenario ensayado. No hay resultados de inspecciones reales de Guayaquil.

### Incertidumbre y estabilidad

| Escenario | Brier sintético | ESS medio | Episodios con aviso ESS |
|---|---:|---:|---:|
${diagnostics}

Se incluyen bins de calibración completos en evaluation-v03.json. Un Brier determinado no prueba calibración. En la sensibilidad del episodio fijo, la probabilidad media cambia de ${f(e.sensitivity.find((s) => s.label === "lower occurrence prior").meanAffected)} a ${f(e.sensitivity.find((s) => s.label === "higher occurrence prior").meanAffected)} al modificar el prior de ocurrencia. Con 2048 frente a 8192 partículas pasa de ${f(e.sensitivity[0].meanAffected)} a ${f(e.sensitivity[1].meanAffected)}. Esos cambios distinguen sensibilidad de supuestos de aproximación numérica.

${stressText}
## 6 Pruebas y reproducción

Comandos:

    npm test
    npm run build
    npm run evaluate
    node scripts/report-v03.mjs
    npm audit

La suite automatizada contiene 20 pruebas: caso cerrado de mezcla Poisson; ausencia frente a cero; reproducibilidad; separación de verdad; falsos reportes; actualización positiva y negativa; límites; validación de entradas; información mutua; candidatos comunes; denominadores; incidentes ocultos con reporte faltante; bootstrap; correcciones; unión espacial; meteorología; errores opcionales; topología y etiquetas; secuencia sin repetición; ley de esperanza total; e integración del render de pasaporte y comparador. Algunas pruebas reúnen más de una comprobación. El registro final de ejecución está en VERIFICACION-v03.md.

Se revisan además en navegador inspección por oráculo, observación positiva y negativa, historial de corrección, separación del modo de fuentes, comparación y benchmark, exportación, teclado y adaptación responsive. npm audit no reportó vulnerabilidades conocidas en la revisión realizada; no sustituye una auditoría de seguridad.

## 7 Limitaciones pendientes

- No existen etiquetas independientes locales para validar el modelo en Guayaquil.
- Priors y ruido son supuestos; la identificación por reportes sigue siendo limitada.
- Los intervalos son condicionales al modelo y al ensamble; algunas verificaciones producen ESS bajo.
- Las verificaciones se suponen exactas y representativas del sector en el episodio; no se modelan errores de inspección, severidad ni duración.
- Todos los costos experimentales son 1; no se infieren tiempos ni rutas.
- El simulador difiere del modelo, pero comparte covariables y geografía. Los casos reservados siguen siendo sintéticos.
- Los registros históricos pueden tener puntos aproximados y condiciones de reutilización por confirmar. La lluvia es regional, no por calle.
- Persistencia local de notas; no hay sincronización entre operadores ni autenticación.
- El aprendizaje actualiza el posterior dentro de cada configuración experimental; no reentrena automáticamente los priors entre episodios ni constituye aprendizaje validado con observaciones de campo.
- El mapa base necesita internet y WebGL; el bundle cartográfico sigue siendo grande.

El resultado defendible es una plataforma experimental con inferencia explícita, trazabilidad y evaluación honesta. No una demostración de detección operativa ni de superioridad universal.
`;
await writeFile(new URL("../docs/INFORME-v03.md", import.meta.url), report);
console.log("Generated docs/INFORME-v03.md");
