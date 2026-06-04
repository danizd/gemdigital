# Carreteras: OpenStreetMap Imagery Provider vs Vector Tiles

Las carreteras del GDT-Santiago se pintan mediante `OpenStreetMapImageryProvider` de CesiumJS (tiles raster de OSM) en lugar de servirse como vector tiles (MVT) desde PostGIS. Esta decisión prioriza velocidad de implementación y simplicidad operativa sobre flexibilidad de estilizado y capacidad de interacción.

El coste de generar y servir vector tiles de carreteras desde PostGIS implicaba: (a) procesar la capa vial de OSM para toda Galicia y la zona Focus, (b) configurar pg_tileserv para servir MVT con estilos personalizados, (c) implementar un cliente de mapas vectoriales en CesiumJS con estilizado runtime. Esto sumaba ~2-3 semanas de trabajo adicional para un resultado visual equivalente en la Fase 1, donde el objetivo es "primera vista épica" y no interacción con carreteras.

La alternativa raster satisface el requisito visual inmediato con cero trabajo de pipeline adicional: CesiumJS consume directamente los tiles de OSM ya existentes. La desventaja es que las carreteras son píxeles, no datos: no se pueden consultar atributos (nombre, tipo, velocidad), no se pueden resaltar al hover, y no se puede alterar el estilo sin regenerar tiles.

**Considered options**

- OpenStreetMap Imagery Provider (elegido) — Tiles raster de OSM ya existentes, cero trabajo de pipeline, visualización inmediata. Limitación: no interacción, no atributos, estilo fijo.

- Vector tiles PostGIS + pg_tileserv — Mayor flexibilidad de estilizado, posibilidad de consulta e interacción. Coste: pipeline de procesamiento OSM, configuración de estilos MapLibre/Cesium, más tiempo de desarrollo (~2-3 semanas).

- IGN CartoRaster — Tiles oficiales del IGN con carreteras MTN25. Descartado: licencia más restrictiva que OSM, estilo cartográfico no optimizado para 3D, menor actualidad que OSM.

**Consequences**

- En Fase 1, las carreteras son puramente decorativas: el usuario ve la red viaria pero no puede interactuar ni consultar.

- Si en Fase 2 se requiere información de tráfico en tiempo real, rutas calculadas, o resaltado de carreteras, será necesario migrar a vector tiles. Esta decisión crea una deuda técnica documentada.

- El cambio a vector tiles en el futuro requiere: reprocesar datos OSM, implementar servicio de tiles vectoriales, y reescribir la capa de renderizado en el cliente. No es trivial pero está acotado.

- Este ADR existe para evitar que en Fase 2 alguien asuma que "las carreteras ya están en PostGIS" o intente consultar atributos que no existen.
