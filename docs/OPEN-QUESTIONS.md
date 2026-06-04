# Decisiones diferidas (pendientes de resolver)

> Decisiones que el equipo ha dejado abiertas explícitamente. Se resuelven más adelante; mientras tanto **ambas opciones** deben figurar en las especificaciones o el pipeline debe poder soportarlas sin reescritura.

## D1 — Pipeline de generación del terreno (Q5)

Tres opciones viables; se decide al empezar la fase de tiling.

- **A. PDAL + cesium-native (C++)** — oficial, rápido, lee LAZ nativo.
- **B. py3dtiles (Python)** — más portable, más lento, no genera Quantized Mesh.
- **C. Entwine + PDAL + pipeline manual** — más control, más trabajo, sin valor añadido frente a A.

**Implicación para la arquitectura:** el `docker-compose` y la app cliente asumen que el terreno sale de un directorio `tiles/` con Quantized Mesh. Da igual qué opción lo genere.

## D2 — Coloración del terreno (Q6)

- **A. Terreno con color por elevación** (mapa hipsométrico) — lo da CesiumJS con `globe.material` y rampas; cero coste adicional.
- **B. Terreno con CORINE Land Cover o SIOSE** — coloración real por uso del suelo; requiere ingesta de polígonos en PostGIS y un shader/overlay.

**Implicación para la arquitectura:** el terreno se publica como Quantized Mesh puro (con elevación) o con material RGB adicional. Si A: no hay trabajo extra. Si B: añadir pipeline de ingest CORINE/SIOSE y material en tiles.

## D3 — Edificios 3D: granularidad final (Q6)

- **A. Solo bajo detalle (OSM Buildings, Galicia)**
- **B. Solo alto detalle (LIDAR PNOA → 3D Tiles, Focus)**
- **C. Ambos (alto en Focus, bajo en Galicia) — preferido del equipo**

Se acepta C como intención, pero la granularidad del mallado alto detalle (LOD objetivo, densidad de puntos, filtrado de ruido) se afina al implementar.

## D4 — Subdominio concreto bajo movilab.es (ADR-0003) — RESUELTA en Q12

**Decisión: `gemelo.movilab.es`.** El GDT-Santiago se publica en el subdominio definitivo desde la Fase 1 (demo). No hay entorno `demo.` previo. Esto implica que la primera versión publicada es ya la URL pública; los cambios entre Fase 1 y Fase 2 (nuevos tiles, nuevas capas) se publican sobre la misma URL con versionado de tiles en la ruta.

## D5 — Mejoras de seguridad y observabilidad (Q15) — DEFERIDAS A FASE 2

Por decisión del operador, la Fase 1 sale sin instrumentación de producción. Estos elementos se añaden en Fase 2 si se observan problemas o si el director lo pide:

- **Rate limit por IP** en nginx (`limit_req_zone`, 10 req/s, burst 20).
- **Cabeceras de seguridad** (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).
- **CORS** restringido a `https://gemelo.movilab.es`.
- **Logs al host con `logrotate`** (en lugar de dentro del contenedor, donde se pierden al recrear el stack).
- **Healthcheck externo** (healthchecks.io o similar) que avise si el GDT deja de responder.
- **Métricas con Prometheus + Grafana** (CPU, RAM, requests/s, errores, cache hit ratio).
- **Cloudflare delante de NPM** si se observa DOS o scraping agresivo.

**Implicación para Fase 1:** el stack de Fase 1 funciona y se ve bien, pero se cae silenciosamente si sufre DOS o si un contenedor se reinicia y pierde logs. El operador supervisa con `docker stats` y `docker logs` ad-hoc.
