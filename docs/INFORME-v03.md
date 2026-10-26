# Informe técnico FLOODSHADOW 0.3

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

Se ejecutaron 500 episodios por configuración, cinco configuraciones y K=5: 2500 episodios principales. Dos configuraciones están reservadas para generalización. El modelo utiliza 2048 partículas en esta suite. El manifiesto fija configuración y semillas antes de ejecutar. Se usan 600 resamples bootstrap emparejados por episodio; son intervalos exploratorios sin corrección por comparaciones múltiples.

### Incidentes ocultos encontrados entre candidatos con cero reportes observados

Medias por hasta cinco verificaciones. Cantidad de reportes coincide con azar en este conjunto: todos sus conteos son cero y los empates usan la misma semilla.

| Escenario | Azar | Reportes | Historia | Heurística original | Modelo nuevo |
|---|---:|---:|---:|---:|---:|
| Uneven reporting | 0.980 | 0.980 | 1.632 | 1.636 | 1.598 |
| Widespread observation | 0.354 | 0.354 | 0.634 | 0.664 | 0.622 |
| Limited visibility | 1.348 | 1.348 | 2.098 | 2.094 | 2.070 |
| Held-out noisy and sparse | 1.062 | 1.062 | 1.370 | 1.308 | 1.420 |
| Held-out weak rainfall / strong clustering | 0.238 | 0.238 | 0.436 | 0.466 | 0.414 |

### Afectados encontrados en el conjunto general

Se evalúa por separado el objetivo de encontrar afectados en general. Los métodos reciben el mismo conjunto de candidatos y K.

| Escenario | Azar | Reportes | Historia | Heurística original | Modelo nuevo |
|---|---:|---:|---:|---:|---:|
| Uneven reporting | 1.336 | 2.650 | 2.168 | 2.048 | 2.854 |
| Widespread observation | 1.160 | 4.232 | 2.070 | 1.704 | 4.348 |
| Limited visibility | 1.498 | 2.154 | 2.412 | 2.332 | 2.450 |
| Held-out noisy and sparse | 1.624 | 3.174 | 2.578 | 2.106 | 3.346 |
| Held-out weak rainfall / strong clustering | 0.476 | 1.516 | 0.890 | 0.870 | 1.624 |

### Diferencias emparejadas de descubrimientos ocultos

Modelo menos comparador; intervalo bootstrap del 95%. Si incluye cero, no se demuestra una diferencia clara en esa comparación.

| Escenario | Contra azar | Contra historia | Contra heurística |
|---|---|---|---|
| Uneven reporting | 0.618 [0.518, 0.720] | -0.034 [-0.082, 0.010] | -0.038 [-0.100, 0.020] |
| Widespread observation | 0.268 [0.198, 0.340] | -0.012 [-0.042, 0.018] | -0.042 [-0.080, -0.004] |
| Limited visibility | 0.722 [0.606, 0.836] | -0.028 [-0.092, 0.036] | -0.024 [-0.100, 0.054] |
| Held-out noisy and sparse | 0.358 [0.262, 0.452] | 0.050 [-0.032, 0.126] | 0.112 [0.040, 0.180] |
| Held-out weak rainfall / strong clustering | 0.176 [0.118, 0.234] | -0.022 [-0.056, 0.012] | -0.052 [-0.102, -0.012] |

El modelo supera al azar en los cinco escenarios de esta suite sintética. No demuestra superioridad frente a la huella histórica: sus diferencias con historia incluyen cero en todos los escenarios. Frente a la heurística, mejora en el escenario reservado de ruido alto, pero pierde en observación extendida y en correlación fuerte con lluvia baja. En el objetivo general mejora al conteo de reportes en estos escenarios; ello no equivale a mejorar la búsqueda de incidentes ocultos.

La huella histórica es un comparador fuerte porque el generador usa esta misma covariable para la ocurrencia. Con pocos reportes de un solo episodio, las tasas de observación siguen débilmente identificadas y las probabilidades dependen del prior. La familia gaussiana de inferencia tampoco reproduce necesariamente la concentración Ising de incidentes del simulador. Se publican estos límites sin ajustar semillas, criterios o parámetros para ocultarlos.

### Verificación secuencial

100 episodios adicionales con semillas 110000–110099, hasta cinco inspecciones sin repetir sectores, mismo conjunto inicialmente observado sin reportes. Los modelos actualizan su posterior después de cada observación. Los intervalos agregan por episodio.

| Estrategia | Afectados ocultos encontrados, media [95% CI] |
|---|---|
| discovery | 1.460 [1.270, 1.670] |
| information | 1.330 [1.150, 1.500] |
| random | 1.130 [0.930, 1.320] |
| reports | 1.130 [0.930, 1.320] |
| history | 1.430 [1.250, 1.610] |
| original | 1.540 [1.340, 1.760] |

La estrategia de información busca aprender sobre el ensamble, no maximizar directamente la cantidad de incidentes encontrados. Esta prueba no demuestra que Active Verification supere a la heurística o historia en descubrimientos; demuestra el ciclo de actualización y mide su utilidad bajo el escenario ensayado. No hay resultados de inspecciones reales de Guayaquil.

### Incertidumbre y estabilidad

| Escenario | Brier sintético | ESS medio | Episodios con aviso ESS |
|---|---:|---:|---:|
| Uneven reporting | 0.166 | 494.4 | 0/500 |
| Widespread observation | 0.092 | 258.7 | 11/500 |
| Limited visibility | 0.202 | 479.4 | 0/500 |
| Held-out noisy and sparse | 0.226 | 282.1 | 8/500 |
| Held-out weak rainfall / strong clustering | 0.133 | 540.0 | 0/500 |

Se incluyen bins de calibración completos en evaluation-v03.json. Un Brier determinado no prueba calibración. En la sensibilidad del episodio fijo, la probabilidad media cambia de 0.196 a 0.420 al modificar el prior de ocurrencia. Con 2048 frente a 8192 partículas pasa de 0.293 a 0.287. Esos cambios distinguen sensibilidad de supuestos de aproximación numérica.


### Pruebas suplementarias adversas

Se añadieron después de inspeccionar la suite principal, con el modelo sin cambios: son exploratorias y no forman parte de las afirmaciones de generalización previamente reservadas. Cada escenario contiene 250 episodios adicionales.

| Escenario | Ocultos azar | Ocultos historia | Ocultos heurística | Ocultos modelo | Diferencia modelo − azar [95% CI] |
|---|---:|---:|---:|---:|---|
| No false reports | 0.304 | 0.556 | 0.624 | 0.564 | 0.260 [0.176, 0.352] |
| Historical prior contradicted | 1.172 | 0.644 | 0.844 | 0.752 | -0.420 [-0.548, -0.280] |

Cuando la asociación histórica del generador contradice el prior, el modelo encuentra menos incidentes ocultos que el azar y menos afectados en general que el conteo de reportes. Esto demuestra dependencia de supuestos y ausencia de superioridad universal. El escenario sin falsos reportes evita que toda ventaja dependa de añadir ruido al comparador. No se interpreta ninguna de estas configuraciones como una estimación de condiciones reales de Guayaquil.

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
