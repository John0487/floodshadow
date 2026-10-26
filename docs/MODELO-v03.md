# Modelo estadístico de FLOODSHADOW 0.3

FLOODSHADOW utiliza un modelo bayesiano de ocupación y observación con campos gaussianos espaciales y una verosimilitud de conteos Poisson. Es una implementación propia. No reproduce el modelo Ising y el procedimiento MCMC de Agostini, Pierson y Garg.

## Uso definido y separación de fuentes

El propósito es investigar posibles afectaciones insuficientemente observadas y recomendar verificaciones bajo incertidumbre en un piloto de Guayaquil. La interfaz permite experimentar con geografía real e incidentes sintéticos. No determina condiciones actuales, no despacha equipos y no recomienda rutas, evacuaciones ni respuestas de emergencia.

Source explorer muestra cartografía histórica, meteorología modelada y registros históricos fechados; no calcula probabilidades de afectación ni prioridades de inspección. Experiment calcula estimaciones sobre un episodio sintético claramente identificado. Los registros institucionales de 2025 no se asignan al episodio meteorológico de octubre de 2026.

## Dos procesos distintos

Para cada sector i:

- F_i es la afectación binaria desconocida.
- p_i es su probabilidad de ocurrencia condicionada a un campo latente y covariables.
- q_i es la probabilidad de al menos un reporte atribuible a una afectación existente.
- R_i es el número de reportes observados.
- lambda_0 es una intensidad de reportes falsos compartida, desconocida.

F_i | theta sigue una Bernoulli(p_i). Dados los campos latentes, las afectaciones son independientes; al integrar los campos compartidos resultan espacialmente dependientes.

La observación se modela como:

    R_i | F_i=0, theta ~ Poisson(lambda_0)
    R_i | F_i=1, theta ~ Poisson(lambda_0 - log(1-q_i))

Por tanto, la cantidad mostrada como P(report ≥ 1 | affected) es:

    1 - (1-q_i) * exp(-lambda_0)

Incluye tanto reportes atribuibles al incidente como el proceso de ruido. No es una estimación validada de la conducta de reporte de habitantes reales.

Un cero observado aporta evidencia mediante la verosimilitud; no fija F_i=0. Un reporte positivo tampoco fija F_i=1 porque existen falsos positivos. Si R_i falta, su factor de verosimilitud es 1: no se reemplaza por un cero.

## Priors y estructura espacial

La matriz W promedia los vecinos de cada sector, con diagonal nula. La lista se simetriza, elimina autorreferencias y descarta identificadores externos al piloto. Los campos espaciales son transformaciones lineales de gaussianas independientes:

    U = (0.25 I + 0.75 W)^2 Z_occ
    V = (0.20 I + 0.80 W)^3 Z_report

En nodos sin vecinos se conserva el valor propio en cada paso. Estas transformaciones definen priors gaussianos propios; no se presentan como un modelo CAR ni como una red hidráulica.

Las probabilidades se construyen mediante:

    logit(p_i) = intercepto_occ + beta_lluvia*(lluvia_normalizada-0.5)
                 + beta_historia*(solapamiento-0.3) + 1.5*U_i
    logit(q_i) = intercepto_report + 2.0*V_i

Priors por defecto, fijados antes de la evaluación:

| Parámetro | Distribución |
|---|---|
| Intercepto de ocurrencia | Normal(-0.5, 0.8²) |
| Coeficiente de lluvia | Normal(1.1, 0.45²) |
| Coeficiente de huella histórica | Normal(1.5, 0.55²) |
| Intercepto de reporte | Normal(0, 1.05²) |
| Intensidad de falsos reportes | Lognormal con media 0.10 y desviación logarítmica 0.65 |

Estos son supuestos del modelo, no coeficientes ajustados a Guayaquil. Se distribuyen como variables desconocidas y se actualizan sus pesos a partir de evidencia. No se usan covariables demográficas. La lluvia se normaliza como min(lluvia/140,1). Una covariable de lluvia o solapamiento ausente se integra con un prior Uniforme(0,1) en su escala normalizada, una decisión explícita y discutible que debe probarse con datos independientes.

## Inferencia y límites de identificación

Se muestrean 4096 partículas del prior en la interfaz; la evaluación principal usa 2048 y el benchmark interactivo 1024. La semilla numérica del modelo es 64319 y es independiente de la semilla del simulador.

Para sectores no verificados se integra F_i analíticamente:

    L_i(theta) = p_i * Poisson(R_i | lambda_1i)
                 + (1-p_i) * Poisson(R_i | lambda_0)

Los pesos de las partículas son proporcionales al producto de estas verosimilitudes y las observaciones verificadas. Se calculan en logaritmos y se normalizan con log-sum-exp. Las constantes factoriales Poisson se cancelan porque todos los parámetros usan los mismos conteos observados.

Dentro de cada partícula se calcula P(F_i=1 | R_i,theta); su media ponderada produce la estimación. Los percentiles ponderados 5 y 95 de esa probabilidad producen el intervalo creíble condicional del 90%. No es un intervalo sobre una variable binaria observada ni garantiza cobertura frecuentista o calibración local.

El diagnóstico ESS = 1 / suma(w²) mide concentración de pesos. Se muestra una advertencia si ESS < max(30, 1% de partículas). ESS alto no prueba que los supuestos sean correctos; ESS bajo indica inestabilidad numérica de la aproximación. La interfaz conserva este aviso y cada verificación exporta los diagnósticos de su actualización.

Ocurrencia y reporte no son identificables libremente a partir de reportes aislados. Aquí el prior ambiental, los campos espaciales, la distribución de ruido y las verificaciones suministran restricciones. La sensibilidad a esos supuestos es parte del resultado: cambiar el prior de ocurrencia modifica de forma importante las estimaciones. Ninguna probabilidad se declara calibrada para Guayaquil.

## Active Verification

La verificación experimental se supone exacta para el episodio y la unidad geográfica seleccionada. Un resultado positivo reemplaza el factor de mezcla por p_i*Poisson(R_i | lambda_1i); uno negativo lo reemplaza por (1-p_i)*Poisson(R_i | lambda_0). La evidencia repondera los campos compartidos y cambia las estimaciones de otros sectores y del proceso de reporte.

La interfaz permite revelar el resultado del simulador solo después de seleccionar el sector, o registrar una observación manual identificada como demostración. La verdad oculta nunca entra en la selección previa. Cada entrada guarda origen, observador, nota, fecha, episodio, versión del modelo, diagnóstico numérico, diferencias antes/después y referencia al registro corregido. Una corrección sustituye el estado vigente y conserva el historial; no cuenta dos veces la misma verificación.

Hay dos propósitos de selección:

- Descubrir incidentes sin reportes: candidatos con cero reportes efectivamente observados y sin verificación.
- Encontrar afectados en general: todos los sectores no verificados, incluyendo observaciones de reporte ausentes.

Y dos estrategias:

- Descubrimiento: probabilidad posterior de afectación / costo de inspección.
- Información: [H(media de p_i) - media ponderada de H(p_i)] / costo.

La segunda expresión es la información mutua entre el resultado de una verificación exacta y el índice latente del ensamble. Mide aprendizaje esperado sobre el modelo; no garantiza encontrar más afectados ni representa reducción de daños. Los experimentos publicados usan costo uniforme 1. La API admite costos positivos distintos; no se han estimado costos reales ni tiempos de desplazamiento.

## Simulador independiente

El generador produce incidentes mediante un modelo Ising espacial, distinto de la familia latente gaussiana usada para inferir. La ocurrencia depende de lluvia, huella histórica, una perturbación espacial y estados vecinos. La cobertura de reporte usa otro campo espacial aleatorio y conteos Poisson, más un proceso independiente de reportes falsos. También se introducen reportes y covariables ausentes.

Se utilizan flujos aleatorios separados para física, reporte y ausencia de datos. Cambiar cobertura o ausencia no modifica la verdad de afectación del mismo episodio. No se utilizan grupos por índice i % 3. Aunque las familias difieren, simulador y modelo comparten las covariables ambientales y la geografía; siguen siendo experimentos sintéticos, no validación independiente en territorio.

## Evaluación

La suite principal contiene cinco configuraciones de 500 episodios cada una. Dos configuraciones se reservan para generalización con otros niveles de ruido, ausencia, lluvia y correlación. El manifiesto se escribe antes de iniciar las ejecuciones. No hay búsqueda automática de parámetros ni selección de semillas por resultado.

Los cinco métodos son azar, cantidad de reportes, huella histórica, heurística original y modelo nuevo. Se comparan bajo las mismas observaciones, conjunto de candidatos y capacidad K=5. Se publican por separado el conjunto general y el de cero reportes observados. Los empates de conteo e historia usan una semilla fija; entre candidatos con cero reportes, el método de conteo coincide intencionalmente con el azar porque no dispone de información adicional.

Se miden afectados encontrados, Precision@K, Recall@K, incidentes ocultos encontrados, cobertura de incidentes ocultos, recall del conjunto de candidatos y afectados por unidad de costo. Un denominador vacío se registra como null/N/A. La identificación de un incidente oculto durante evaluación utiliza el conteo real del simulador incluso si faltaba su observación: esto no se filtra al algoritmo.

Los intervalos de resultados son percentiles de 600 remuestreos bootstrap de episodios independientes. Las diferencias entre métodos se calculan emparejadas por episodio. Las observaciones de sectores dentro de un episodio no se tratan como independientes. Las evaluaciones secuenciales agregan primero cada episodio antes de remuestrear. Los intervalos son exploratorios y no incluyen una corrección por comparaciones múltiples.

Se publican Brier score y bins de calibración sintética, estabilidad ESS y sensibilidad a priors y número de partículas. No se afirma calibración local por tener un Brier score determinado.

## Referencias y diferencias

- Agostini, Pierson y Garg, AAAI 2024: https://doi.org/10.1609/aaai.v38i20.30190. Fundamenta separar ocurrencia y observación con dependencia espacial. Su modelo usa Ising y MCMC y asume ausencia de falsos reportes; este proyecto usa una familia distinta, conteos con falsos positivos y condicionamiento por verificaciones.
- Código de los autores: https://github.com/gsagostini/networks_underreporting. Consultado como referencia; no se incorpora su implementación ni se declara reproducción.
- Modelos de ocupación con errores de detección: https://pubs.usgs.gov/publication/fs20053096 y https://research.fs.usda.gov/treesearch/50442. Fundamentan explicitar tanto falsos negativos como falsos positivos y el papel de verificaciones confirmadas.
- MacKay, Information-based objective functions for active data selection: https://authors.library.caltech.edu/records/efefp-2j353. Fundamenta distinguir aprendizaje esperado de cantidad de incidentes encontrados.

Las fuentes no validan este algoritmo para Guayaquil. La siguiente fase requiere verificaciones independientes, revisión de priors, error de verificación, costos reales y evaluación temporal/territorial fuera del piloto.
