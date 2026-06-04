# Render stack: CesiumJS sobre navegador

El GDT-Santiago se renderiza íntegramente en el navegador del usuario con CesiumJS (Apache 2.0) frente a alternativas como Three.js custom, motores de juego (Unreal/Godot/O3DE) o MapLibre GL. CesiumJS ofrece soporte nativo de Quantized Mesh y 3D Tiles, que es exactamente el formato óptimo para servir un MDE de precisión por streaming desde un servidor con 24 GB de RAM; aporta de fábrica atmósfera, sombras y sol, que satisfacen el criterio "épico" sin reescritura; y al ser cliente web puro, la GPU corre en el navegador y el servidor Oracle no invierte RAM en renderizar. Descartamos Three.js porque habría que reimplementar proyecciones geográficas, LOD y streaming de terreno; descartamos motores de juego por licencia/peso y porque exigirían cliente nativo (rompe "cliente web"); descartamos MapLibre con elevación raster porque el relieve queda plano y no cumple "épico".

**Considered options**
- CesiumJS (elegido) — Quantized Mesh nativo, 3D Tiles, atmósfera, open source, cliente web.
- Three.js custom — máximo control visual, pero hay que reimplementar geo-proyecciones, LOD, streaming y atmósfera; semanas de trabajo sin ventaja clara.
- Godot 4 / O3DE — calidad nativa excelente, pero cliente nativo pesado y rompe la regla "cliente web".
- MapLibre GL + DEM raster — ligero, pero el terreno queda visualmente plano, incumple el criterio épico.

**Consequences**
- El servidor Oracle solo sirve tiles y assets; el coste de CPU/render es cero en backend.
- El MDE debe preprocesarse a Quantized Mesh y los assets (edificios, vegetación) a 3D Tiles antes de publicarse, no en tiempo real.
- Cambiar de motor implicaría reescribir todo el cliente; este ADR existe para que nadie "optimice" a MapLibre pensando que es equivalente.
