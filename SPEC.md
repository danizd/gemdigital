# GDT-Santiago — Especificación

> Gemelo Digital Topográfico de Santiago de Compostela.
> Documento de referencia único. Se complementa con [`CONTEXT.md`](./CONTEXT.md) (glosario) y [`docs/adr/`](./docs/adr/) (decisiones arquitectónicas irreversibles).

---

## 1. Resumen ejecutivo

El **GDT-Santiago** es un gemelo digital de Santiago de Compostela centrado en el **modelado topográfico preciso** del territorio: relieve, hidrografía y desniveles. Se construye **exclusivamente con datos públicos** (IGN, CNIG, Copernicus, OSM), se ejecuta en un **único servidor Oracle Cloud Free Tier** (24 GB RAM) y se publica en `https://gemelo.movilab.es`.

La primera versión (Fase 1) es una **demo de aprobación** orientada a un director de proyecto: optimiza para una primera vista cinemática y un acabado visual impactante, no para rendimiento máximo. Una vez aprobado, se pasa a Fase 2 con más recursos.

**Licencia:** Apache 2.0.
**Stack cliente:** CesiumJS (Apache 2.0), Vite, Vanilla TypeScript.
**Stack servidor:** nginx + PostgreSQL/PostGIS + pg_tileserv, orquestado con docker-compose, expuesto vía Nginx Proxy Manager (NPM) con Let's Encrypt.
**Generación de datos:** pipeline offline en WSL2 Ubuntu local; el servidor Oracle solo recibe tiles pregenerados.

---

## 2. Objetivos y no-objetivos

### Objetivos

- Modelar el relieve de Santiago y su entorno con precisión submétrica (LIDAR 2 m) en la zona de detalle.
- Cubrir Galicia entera como contexto visual (EUDEM 25 m).
- Ofrecer un visor 3D **épico** en primera vista: terreno iluminado, hidrográfica visible, Camino de Santiago y curvas de nivel legibles.
- Servir el gemelo desde un único servidor de 24 GB de RAM, en código abierto, sin dependencias privativas en tiempo de ejecución.
- Aprobar Fase 1 con el director; extender a Fase 2 con el presupuesto firmado.

### No-objetivos

- Render nativo (escritorio o móvil). Solo web.
- Tiempo real, IoT, sensores, simulación dinámica.
- Edición colaborativa del modelo. Es de solo lectura.
- Cobertura global. Solo Santiago y Galicia.
- Datos comerciales, privados o con licencia restrictiva.
- Múltiples usuarios diferenciados (no hay auth en Fase 1).

---

## 3. Alcance por fases

### Fase 1 — Demo de aprobación (Fase actual)

| Capa / capacidad | Incluida |
|---|---|
| Terreno LIDAR 2 m en el Focus (Concello + corredor del Camino) | ✅ |
| Terreno EUDEM 25 m en Contexto (Galicia) | ✅ |
| Curvas de nivel (maestras, secundarias, auxiliares) | ✅ |
| Hidrográfica CNIG (ríos, regatos, masas de agua) | ✅ |
| Camino de Santiago + hitos clickables | ✅ |
| Topónimos principales (parroquias, montes, lugares) | ✅ |
| Edificios 3D bajo detalle (OSM Buildings, Galicia) | ✅ |
| Vista cinemática de apertura sobre la catedral, hora dorada | ✅ |
| Geometría ETRS89 + corrección EGM2008 | ✅ |

### Diferido a Fase 2 (tras aprobación)

- Edificios 3D alto detalle (LIDAR PNOA → 3D Tiles en el Focus).
- Coloración del terreno con CORINE Land Cover o SIOSE (en Fase 1: hipsométrica por elevación).
- Contexto de España peninsular (Fase 1: solo Galicia).
- Métricas Prometheus + Grafana, healthcheck externo, rate limit, CORS estricto, Cloudflare.
- CI/CD (en Fase 1: despliegue manual).
- Móvil / tablet optimizado (Fase 1: solo desktop).
- SLO / uptime firmado.

**Decisiones aún sin cerrar dentro de Fase 1 (registradas en `docs/OPEN-QUESTIONS.md`):**

- **D1** — herramienta del pipeline de generación: PDAL + cesium-native (A) / py3dtiles (B) / Entwine + manual (C).
- **D2** — coloración del terreno: hipsométrica (A) / CORINE-SIOSE (B). Por defecto A.
- **D3** — granularidad del mallado LIDAR 3D para Fase 2 (LOD objetivo, densidad).

---

## 4. Arquitectura

Diagrama lógico:

```
┌──────────────────────────────────────────────────────────────────┐
│  Navegador del usuario (desktop, GPU integrada o dedicada)      │
│  └─ CesiumJS (cliente web, render WebGL)                         │
│      ├─ TerrainProvider Focus: Quantized Mesh LIDAR 2 m          │
│      ├─ TerrainProvider Contexto: Quantized Mesh EUDEM 25 m     │
│      ├─ Imagery: OSM roads                                       │
│      └─ Vector tiles: hidrográfica, curvas, Camino, topónimos    │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS (TLS vía NPM)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Nginx Proxy Manager (NPM) — host, puerto 443                    │
│  └─ Terminación TLS, Let's Encrypt, proxy → :80                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTP (red Docker interna)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Docker Compose en Oracle Free Tier                              │
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   nginx    │  │  pg_tileserv│  │  postgis    │  │   app      │ │
│  │  :80       │◄─┤  :7800      │◄─┤  :5432      │  │  (estática)│ │
│  │  tiles +   │  │  MVT API    │  │  PostGIS 3  │  │            │ │
│  │  assets    │  │             │  │             │  │            │ │
│  └────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                             ▲
                             │ rsync desde WSL2 local
┌────────────────────────────┴─────────────────────────────────────┐
│  WSL2 Ubuntu (Windows local)                                     │
│  /home/<user>/gdt/                                               │
│    ├── raw/         ← descargas CNIG, Copernicus, OSM            │
│    ├── pipeline/    ← scripts PDAL, cesium-native, ogr2ogr       │
│    ├── postgis/     ← SQL de carga                               │
│    └── tiles/       ← artefactos (Quantized Mesh, 3D Tiles, MVT) │
└──────────────────────────────────────────────────────────────────┘
```

### Decisiones arquitectónicas irreversibles (ADRs)

- **ADR-0001** — Render stack: CesiumJS sobre navegador ([docs/adr/0001-render-stack-cesiumjs.md](./docs/adr/0001-render-stack-cesiumjs.md))
- **ADR-0002** — Cobertura del terreno: dos zonas anidadas (Focus 2 m + Contexto 25 m) ([docs/adr/0002-cobertura-focus-contexto.md](./docs/adr/0002-cobertura-focus-contexto.md))
- **ADR-0003** — Despliegue: Docker en Oracle Free Tier, TLS y publicación vía NPM ([docs/adr/0003-despliegue-docker-npm.md](./docs/adr/0003-despliegue-docker-npm.md))
- **ADR-0004** — Sistema de referencia: ETRS89 horizontal + EGM2008 vertical ([docs/adr/0004-sistema-referencia-etrs89-egm2008.md](./docs/adr/0004-sistema-referencia-etrs89-egm2008.md))

---

## 5. Datos

### Fuentes públicas

| Dato | Fuente | Licencia | Resolución | Volumen estimado |
|---|---|---|---|---|
| MDE LIDAR 2 m (Focus) | CNIG (Centro de Descargas) — LIDAR PNOA 2ª cobertura | CC-BY 4.0 IGN | 2 m | ~3 GB Quantized Mesh |
| MDE EUDEM 25 m (Contexto) | Copernicus Land Monitoring Service | Libre | 25 m | ~1.5 GB Quantized Mesh |
| Curvas de nivel | IGN — MTN25 vectorial | Abierta | — | ~150 MB PostGIS |
| Ríos, regatos, embalses | CNIG — BTN25 / BCN25 | Abierta | — | <100 MB PostGIS |
| Camino de Santiago | OpenStreetMap (`route=camino_de_santiago`) | ODbL | — | <10 MB PostGIS |
| Topónimos | IGN — NGBE / MTN25 | Abierta | — | ~20 MB PostGIS |
| Edificios 3D | OSM Buildings extruidos (vía `osm2world` o `pyrosm`) | ODbL | — | ~80–150 MB tiles |
| Geoid | EGM2008 (NGA) | Libre | 1'×1' | ~10 MB |

**Total estimado en disco:** ~120 GB con margen (tiles, BD, logs, espacio para regeneraciones).

### Pipeline de generación (offline, en WSL2)

```
1. Descarga
   - LIDAR PNOA 2ª cobertura: MDT 2 m (.asc o .tif) por hojas 1:5000
   - EUDEM 25 m: GeoTIFF por hojas
   - BTN25 hidrográfica: shapefile/GeoPackage
   - MTN25 curvas: shapefile vectorial
   - OSM: geofabrik.de → extract de Galicia
   - EGM2008: 1 archivo .pgm (~10 MB)

2. Pre-procesado
   - PDAL / gdalwarp: clip al AOI del Focus y Contexto
   - gdalwarp: ortométrico → elipsoidal (con EGM2008 vía `dem_geoid` o `GeographicLib`)
   - postgis: carga de capas vectoriales con SRID ETRS89 UTM 29N
   - postgis: MVT pre-tileados con `ST_AsMVT` por zoom level (si se elige pre-tiling)

3. Tiling
   - cesium-native: GeoTIFF → Quantized Mesh por `TilingScheme.GeographicTilingScheme`
   - cesium-native: LIDAR LAZ → 3D Tiles (cuando se activen edificios 3D)
   - ogr2ogr / tippecanoe: hidrográfica, Camino, topónimos → MVT

4. Empaquetado
   - tiles/quantized-mesh/focus/
   - tiles/quantized-mesh/context/
   - tiles/3d-tiles/buildings/
   - tiles/mvt/{hydro,curves,camino,toponyms}/

5. Sync
   - rsync -avz --delete /home/user/gdt/tiles/ usuario@oracle:/data/gdt/tiles/
```

La elección de la herramienta principal (D1 — PDAL+cesium-native vs py3dtiles vs Entwine+manual) se difiere hasta el primer re-tiling. La **A** (PDAL + cesium-native) es la recomendación por defecto.

### Modelo de dominio (PostGIS)

| Entidad | Geometría | Atributos | Origen de altitud |
|---|---|---|---|
| Tramo de río / regato | LineString Z | `id`, `nombre`, `tipo` (río, regato, embalse), `jerarquía` (Strahler 1–5) | EGM2008 |
| Masa de agua | Polygon | `id`, `nombre`, `tipo` (embalse, lago) | MDE Focus o EGM2008 |
| Curva de nivel | LineString Z | `id`, `elevacion_m`, `indice` (maestra / secundaria / auxiliar) | atributo Z de MTN25 + EGM2008 |
| Tramo del Camino | LineString | `id`, `nombre`, `etapa`, `km_desde_inicio` | — |
| Hito del Camino | Point | `id`, `nombre`, `tipo` (albergue, iglesia, cruce, fuente), `km_desde_inicio` | EGM2008 |
| Topónimo | Point | `id`, `nombre`, `tipo` (parroquia, monte, río, lugar), `poblacion` | EGM2008 |

---

## 6. Identidad visual

- **Vista de apertura:** cámara sobre la **catedral de Santiago**, a ~600 m, pitch 35°, heading NE hacia la Praza do Obradoiro.
- **Hora de simulación por defecto:** **golden hour** (1 h antes del ocaso) para dramatizar el relieve con sombras largas.
- **Estado de capas al cargar:** terreno + curvas + hidrográfica + Camino + topónimos **activados**; edificios 3D y carreteras OSM **desactivados** (disponibles en la leyenda).
- **Botones fijos en la UI:**
  - "Catedral" — recentra la cámara en la vista de apertura.
  - "Sígueme por el Camino" — activa una cámara animada que recorre el Camino de Santiago.
  - "Vista Galicia" — zoom-out a la zona Contexto.
- **Panel lateral (leyenda):** toggles por capa, con contadores y descripciones breves.
- **Estilo de capas (valores por defecto, ajustables):**
  - Curvas de nivel: marrón clásico, grosor por `indice` (maestra 1.5 px, secundaria 0.8 px, auxiliar 0.4 px).
  - Camino: amarillo-vieira (#FFC107), 4 px, glow suave.
  - Ríos: azul Galicia (#3D85C6), grosor por Strahler.
  - Topónimos: sans-serif, halo blanco, escala por zoom.
  - UI: fondo blanco semi-transparente, sans-serif del sistema.

---

## 7. Presupuesto de rendimiento (Fase 1, demo)

Optimizado para "primera vista épica", no para producción.

| Métrica | Objetivo | Mínimo aceptable |
|---|---|---|
| Frame rate (cámara parada) | 60 FPS | 30 FPS |
| Frame rate (cámara en movimiento) | 45–60 FPS | 25 FPS |
| Latencia interacción (click → ficha) | <100 ms | <300 ms |
| Tiempo a primer tile (TTFT, 50 Mbps) | <3 s | <8 s |
| Sesión típica 5 min (Concello) | <80 MB | <200 MB |
| RAM proceso en servidor | <10 GB | <18 GB |
| Disco en servidor | <120 GB | <180 GB |
| Disponibilidad | best-effort | — |

Palancas principales: `requestRenderMode = true`, `maximumScreenSpaceError = 2` (Focus) / `8` (Contexto), `sendfile` en nginx, cache HTTP `immutable` 1 año, Quantized Mesh con `Accept-Encoding: gzip/br`.

---

## 8. Build, despliegue y operación

### Estructura del repositorio

```
gemdigital/
├── README.md
├── SPEC.md                          ← este documento
├── CONTEXT.md                       ← glosario
├── LICENSE                          ← Apache 2.0
├── docker-compose.yml               ← orquestación servidor
├── .env.example                     ← plantilla de secretos
├── app/                             ← app cliente Vite + TypeScript
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
├── pipeline/                        ← scripts de generación offline
│   ├── README.md
│   ├── terrain/                     ← LIDAR + EUDEM → Quantized Mesh
│   ├── buildings/                   ← LIDAR → 3D Tiles (Fase 2)
│   ├── postgis/                     ← SQL de carga
│   │   ├── 01_schema.sql
│   │   ├── 02_hydro.sql
│   │   ├── 03_curves.sql
│   │   ├── 04_camino.sql
│   │   ├── 05_toponyms.sql
│   │   └── 06_mvt_functions.sql
│   └── scripts/                     ← bash/python de orquestación
├── docs/
│   ├── adr/                         ← decisiones arquitectónicas
│   ├── OPEN-QUESTIONS.md            ← decisiones diferidas
│   └── SPEC.md                      ← (este archivo)
└── tiles/                           ← [gitignored] artefactos generados
    └── v1/
```

### Flujo de despliegue

1. **Desarrollo local (H0–H1):** todo en WSL2, sin servidor. La app se sirve con `vite dev` en `http://localhost:5173`.
2. **Publicación de H1 (terreno Focus):** `git init`, primer commit, `git push` a GitHub público.
3. **Despliegue:** `ssh oracle "cd /data/gdt && git pull && docker-compose up -d"`.
4. **Publicación de nuevos tiles:** `rsync` desde WSL2 a `/data/gdt/tiles/vN/` en el servidor; reinicio de nginx si el FS no se autorrecarga.
5. **Cambio de versión de tiles:** la app cliente cambia su `VITE_TILES_VERSION` en `.env`, se rebuildea, se re-despliega.

### Secretos y configuración

- `.env.example` lista todas las variables esperadas (BD user/pass, version de tiles, etc.).
- En el servidor, el `.env` real vive en `/data/gdt/.env` con permisos `600`.
- NPM guarda los certificados Let's Encrypt en su propio volumen.

### Seguridad y observabilidad (Fase 1 — versión simple)

- Sin rate limit, sin cabeceras de seguridad, sin CORS estricto.
- Sin healthcheck externo.
- Logs **dentro** de los contenedores (`docker logs`).
- **Mejoras deferidas a Fase 2:** rate limit, cabeceras, CORS, logs al host + `logrotate`, healthcheck, Prometheus + Grafana, Cloudflare. Detalle en `docs/OPEN-QUESTIONS.md` (sección D5).

---

## 9. Roadmap de hitos

| # | Hito | Entregable visible | Tiempo | Bloquea |
|---|---|---|---|---|
| H0 | Skeleton | Globo azul de CesiumJS en local con crédito "GDT-Santiago" | 1 día | todo lo demás |
| H1 | Terreno Focus | Relieve 2 m del Concello sobre la catedral, hora dorada | 3–4 días | resto de capas |
| H2 | Contexto Galicia | Zoom-out muestra Galicia con EUDEM 25 m | 1 día | sensación de "amplio" |
| H3 | Hidrográfica | Ríos CNIG visibles, clickables, grosor por Strahler | 2 días | patrón PostGIS+MVT |
| H4 | Curvas de nivel | Líneas drapeadas con grosor por `indice` | 1 día | firma topográfica |
| H5 | Camino de Santiago | Línea + hitos clickables, botón "Sígueme por el Camino" | 2 días | narrativa |
| H6 | Topónimos | Nombres principales a densidad por zoom | 1 día | legibilidad humana |
| H7 | Edificios OSM + polish | Edificios 3D bajo detalle, leyenda, botón catedral, deploy a `gemelo.movilab.es` | 2–3 días | **demo al director** |

**Total estimado: ~13–15 días de trabajo en solitario** desde H0 hasta la demo.

Hasta H1 incluido, el trabajo es **100 % local** (no se publica en `gemelo.movilab.es`). A partir de H2, se publica cada hito. H7 marca el fin de Fase 1.

---

## 10. Glosario y referencias

- **Glosario vivo:** [`CONTEXT.md`](./CONTEXT.md)
- **Decisiones arquitectónicas:** [`docs/adr/`](./docs/adr/)
- **Decisiones diferidas:** [`docs/OPEN-QUESTIONS.md`](./docs/OPEN-QUESTIONS.md)
- **CesiumJS docs:** https://cesium.com/learn/cesiumjs/
- **Centro de Descargas CNIG:** https://centrodedescargas.cnig.es
- **Copernicus EUDEM:** https://land.copernicus.eu/imagery-in-situ/eu-dem
- **EGM2008 geoid:** https://earth-info.nga.mil/GandG/wgs84/gravitymod/egm2008

---

## 11. Cómo se modifica esta spec

- Cambios cosméticos (numerar, errores tipográficos) → PR directo.
- Cambios que afectan a un ADR existente → nuevo ADR que **`superseded by ADR-NNNN`** al anterior, y actualización aquí.
- Cambios que contradicen `CONTEXT.md` → actualizar el término en `CONTEXT.md` en el mismo PR.
- Cambios que abren nuevas decisiones → nueva entrada en `docs/OPEN-QUESTIONS.md` y, si pasan a ser resueltas, nuevo ADR.
