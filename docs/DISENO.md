# Diseño de la experiencia de FLOODSHADOW

La tarea principal es elegir dónde verificar información incompleta después de un episodio de lluvias. El mapa y la evidencia constituyen el producto; no hay una pantalla de bienvenida separada.

- Base: papel frío `#f6f7fa`, texto `#28364d`, navegación azul pizarra `#26354d`.
- Interacción: azul `#415b91`, selección territorial `#263e78`.
- Prioridad: cinco clases secuenciales `#f5e4b4`, `#ebc76e`, `#e3a348`, `#d77435`, `#b94f30`.
- Contexto histórico: azul grisáceo, separado del naranja de prioridad.
- Tipografía: Manrope en títulos y valores; DM Sans para instrucciones, evidencia y navegación. Fallback sans-serif si Google Fonts no está disponible.
- Estructura: navegación estrecha, lista operativa, mapa dominante y ficha de evidencia. En pantallas medianas la ficha pasa debajo; en móvil el mapa va primero.
- Color y contornos tienen funciones diferentes: relleno representa la variable elegida; contorno azul representa selección; línea azul discontinua representa vecinos; línea naranja discontinua representa candidatos.
- Los alias Sector 01–36 no se presentan como barrios oficiales. El código INEC permanece visible.
- Cada modo declara su naturaleza. Las simulaciones nunca se presentan como datos actuales de inundación.
- Estados de fallo: geometría local utilizable sin calles remotas, mensaje ante WebGL no disponible, snapshot conservado ante error meteorológico y navegación alternativa por lista.
