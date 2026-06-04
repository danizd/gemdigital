# Cobertura del terreno: dos zonas anidadas (Focus 2 m + Contexto Galicia 25 m)

El GDT-Santiago no sirve un único MDE para todo el mundo: divide el alcance en dos zonas anidadas con dos terrain providers distintos, y nunca genera tiles en tiempo real. La zona **Focus** (Concello de Santiago + corredor del Camino) se sirve con LIDAR PNOA 2ª cobertura a 2 m; la zona **Contexto** (Galicia entera) se sirve con EUDEM 25 m de Copernicus. Los tiles de ambas zonas se pregeneran offline y se sirven como ficheros estáticos. Esto es un compromiso deliberado: con LIDAR 2 m de toda Galicia harían falta 150–200 GB de tiles comprimidos (no caben en 24 GB de RAM ni en el tiempo de generación), y con EUDEM 25 m de todo el alcance el Concello pierde el detalle que justifica el gemelo. Anidando dos resoluciones mantenemos el detalle en el "asunto" del gemelo y la continuidad visual hasta el horizonte.

**Considered options**
- Una sola resolución: 2 m para todo (rechazado — no cabe).
- Una sola resolución: 25 m para todo (rechazado — pierde el detalle del Concello, incumple "modelado preciso").
- Focus 2 m + Contexto Galicia 25 m (elegido) — ~10–13 GB de tiles, encaja en 24 GB con holgura para hidrografía y servicios.
- Focus 2 m + Contexto España 25 m (rechazado — ~20 GB solo de contexto, dejaría poco margen; puede añadirse después como mejora si la RAM lo permite).

**Consequences**
- El cliente CesiumJS alterna entre dos `TerrainProvider` según el bounding box de la vista; la transición se nota solo si se hace zoom abrupto en el borde de la zona Focus.
- Re-tiling (cambiar de fuente, ajustar extent, cambiar resolución) es un proceso offline de horas. Se documenta en pipeline, no en runtime.
- Hidrografía y otras capas vectoriales se sirven en la misma proyección (ETRS89 / UTM 29N) y se ajustan a la zona Focus sin discontinuidad aparente en la zona Contexto.
