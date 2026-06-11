# AGENTS.md — Mapa de Navegación de Especificaciones

> Generado por sixtema-sdd. No editar manualmente.
> Última actualización: 2024-06-04

Este archivo enruta a cada agente de IA hacia las especificaciones que necesita
leer antes de implementar una funcionalidad. **Lee solo las secciones indicadas.**
Leer specs innecesarias introduce ruido y puede crear inconsistencias.

---

## Índice de Funcionalidades

- [FEAT-001: Renderizado de Terreno 3D](#feat-001)
- [FEAT-002: Capas Vectoriales (Hidrográfica, Curvas, Camino)](#feat-002)
- [FEAT-003: Edificios 3D](#feat-003)
- [FEAT-004: Navegación y Ancla Visual](#feat-004)
- [FEAT-005: Pipeline de Generación de Tiles](#feat-005)
- [FEAT-006: Despliegue y Operaciones](#feat-006)
- [FEAT-007: Evaluación Fase 1 (Demo)](#feat-007)

**Especificación adicional obligatoria para FEAT-003:**
- `documentacion/especificaciones_funcionales/Pipeline-3D-Tiles.md` — Hito 2B (reemplaza Hito 2A fallido)

---

## Spec global del proyecto

Antes de cualquier trabajo en este repositorio, leer:
1. `CONTEXT.md` — Glosario vivo con términos resueltos
2. `documentacion/especificaciones_funcionales/core-funcional.md` — Dominio y reglas de negocio
3. `documentacion/especificaciones_estructurales/core-estructural.md` — Arquitectura y decisiones técnicas
4. `documentacion/especificaciones_funcionales/capas-gis.md` — Enlaces verificados de descarga de capas geográficas (fuentes de datos)
5. `documentacion/lecciones_aprendidas.md` — Incidencias reales y decisiones operativas ya aprendidas durante la generación de terreno

---

## FEAT-001: Renderizado de Terreno 3D {#feat-001}

**Descripción:** Visualización del Modelo Digital de Elevaciones en 3D mediante CesiumJS con streaming de tiles Quantized Mesh.
**Módulos involucrados:** Cliente web, Pipeline offline (generación de terrain tiles)

### Especificaciones obligatorias (en este orden)

| Orden | Documento | Secciones a leer | Por qué |
|---|---|---|---|
| 1 | `documentacion/especificaciones_funcionales/core-funcional.md` | §2 Glosario (Terreno, Focus, Contexto), §4 CU-001, §5 RN-005 | Entender el concepto de Terreno y su separación de overlays |
| 2 | `documentacion/especificaciones_estructurales/core-estructural.md` | §3.1 ADR-0001 (Render stack CesiumJS), §4 Restricciones técnicas | Conocer el stack de renderizado y límites de rendimiento |
| 3 | `documentacion/especificaciones_estructurales/core-estructural.md` | §5.1 Patrón Pipeline Offline, §5.2 Patrón Versionado de Tiles | Entender cómo se generan y sirven los tiles |
| 4 | `documentacion/lecciones_aprendidas.md` | §§2–12 | Evitar repetir errores conocidos de rutas WSL, formato CTB, gzip, `layer.json` y niveles faltantes |

### Contratos que NO debes romper

```
- Estructura de URL de tiles: `/tiles/v{N}/terrain/{z}/{x}/{y}.terrain`
- Sistema de coordenadas: ETRS89 horizontal + WGS84 elipsoidal vertical
- Headers HTTP cache: `Cache-Control: public, max-age=31536000, immutable`
- Quantized Mesh v1.0: Formato binario compatible con CesiumJS
```

### Señales de alerta

- Si necesitas modificar la resolución del MDE en zona Focus → consultar ADR-0002 (Cobertura Focus+Contexto)
- Si el terreno "flota" o se hunde en edificios → verificar conversión EGM2008 (ADR-0004)
- Si quieres cambiar de CesiumJS a otra librería → este es un cambio arquitectónico mayor; revisar ADR-0001

---

## FEAT-002: Capas Vectoriales (Hidrográfica, Curvas, Camino) {#feat-002}

**Descripción:** Visualización de capas vectoriales (ríos, curvas de nivel, Camino de Santiago) como overlays drapados sobre el terreno.
**Módulos involucrados:** Cliente web, PostGIS, pg_tileserv, Pipeline offline

### Especificaciones obligatorias (en este orden)

| Orden | Documento | Secciones a leer | Por qué |
|---|---|---|---|
| 1 | `documentacion/especificaciones_funcionales/core-funcional.md` | §2 Glosario (Hidrográfica, Curvas de nivel, Camino, entidades), §5 RN-005 | Entender las entidades y su relación con el Terreno |
| 2 | `documentacion/especificaciones_estructurales/core-estructural.md` | §3.5 ADR-0005 (Carreteras OSM Imagery) | Entender por qué algunas capas son vector y otras raster |
| 3 | `documentacion/especificaciones_estructurales/core-estructural.md` | §2.3 Contratos (API interna nginx→pg_tileserv) | Conocer límites de la interfaz |

### Contratos que NO debes romper

```
- Formato de tiles vectoriales: MVT (Mapbox Vector Tiles)
- Atributos obligatorios en entidades:
  - Tramo de río: id, nombre, tipo, jerarquía
  - Curva de nivel: id, elevacion_m, indice
  - Hito del Camino: id, nombre, tipo, km_desde_inicio
- Proyección: ETRS89 para geometrías (almacenadas en PostGIS como 25829)
```

### Señales de alerta

- Si quieres hacer interactivos los hitos del Camino (click, hover) → es posible, no hay restricción
- Si quieres hacer interactivas las carreteras → NO es posible en Fase 1; ver ADR-0005 para Fase 2
- Si necesitas añadir un nuevo tipo de entidad → añadir al glosario antes de crear tabla PostGIS

---

## FEAT-003: Edificios 3D {#feat-003}

**Descripción:** Visualización de edificios en dos niveles de detalle (alto en Focus vía LIDAR, bajo en Contexto vía OSM Buildings) con conmutación automática por distancia. **Hito 2B define la estrategia en dos fases:** Fase A (visualización inmediata con Cesium.Entity para 200 edificios OSM) y Fase B (pipeline de producción con herramientas especializadas para LIDAR/3D Tiles).
**Módulos involucrados:** Cliente web, Pipeline offline (3D Tiles generation)

### Especificaciones obligatorias (en este orden)

| Orden | Documento | Secciones a leer | Por qué |
|---|---|---|---|
| 1 | `documentacion/especificaciones_funcionales/Pipeline-3D-Tiles.md` | §1 Contexto y antecedentes (fracaso Hito 2A), §3 Solución aprobada | Entender por qué falló el pipeline manual y qué estrategia reemplaza |
| 2 | `documentacion/especificaciones_funcionales/core-funcional.md` | §2 Glosario (Edificios 3D dos niveles) | Entender el concepto de conmutación por distancia |
| 3 | `documentacion/especificaciones_estructurales/core-estructural.md` | §3.2 ADR-0002 (Cobertura Focus+Contexto) | Saber qué zonas tienen qué nivel de detalle |
| 4 | `documentacion/especificaciones_estructurales/core-estructural.md` | §4 Restricciones (almacenamiento 200 GB) | Los 3D Tiles son pesados; verificar espacio disponible |
| 5 | `documentacion/lecciones_aprendidas.md` | §22 Hito 2A — Fracaso documentado | Evitar repetir errores de padding, Z-up, transform ECEF y boundingSphere |

### Contratos que NO debes romper

```
- Formato: 3D Tiles v1.0 (Batched 3D Model o Instanced 3D Model)
- Criterio de conmutación: Distancia cámara < 2 km → alto detalle; > 2 km → bajo detalle
- CRS: WGS84 elipsoidal para posiciones 3D (Cesium requiere esto)
- Alturas: Elipsoidales WGS84 (no ortométricas)
- Fase A (Entity): 200 edificios OSM con extrudedHeight, FPS >= 30, viewer.zoomTo() funcional
- Fase B (3D Tiles): py3dtiles + gltf-transform + 3d-tiles-tools (NO generación manual)
- Regla de coordenadas GLB: SIEMPRE coordenadas locales del tile; ECEF va en transform del tileset
- Regla de eje vertical: SIEMPRE Y-up (estándar glTF 2.0); nunca usar "gltfUpAxis": "Z"
- Regla de bounding volumes: NO calcular manualmente; usar herramientas especializadas
```

### Señales de alerta

- Si los edificios aparecen "hundidos" en terrenos en pendiente → verificar corrección EGM2008 en pipeline
- Si la conmutación entre niveles es brusca → ajustar distancia umbral en configuración cliente
- Si quieres añadir interiores de edificios → fuera de alcance actual; requiere nuevos datos (Fase 3+)
- Si intentas generar B3DM manualmente con `struct.pack` → **PARAR**. Ver `Pipeline-3D-Tiles.md` §4.1–4.5
- Si `tilesLoaded=true` pero edificios invisibles → problema es el bounding sphere, no el shader. Ver `Pipeline-3D-Tiles.md` §4.5
- Si usas coordenadas ECEF como vértices del GLB → el tileset se romperá. Ver `Pipeline-3D-Tiles.md` §4.1

---

## FEAT-004: Navegación y Ancla Visual {#feat-004}

**Descripción:** Controles de navegación del usuario (zoom, rotar, inclinar) y botón de recentrado en la Catedral.
**Módulos involucrados:** Cliente web (Vite + TypeScript + CesiumJS)

### Especificaciones obligatorias (en este orden)

| Orden | Documento | Secciones a leer | Por qué |
|---|---|---|---|
| 1 | `documentacion/especificaciones_funcionales/core-funcional.md` | §2 Glosario (Catedral como ancla visual), §4 CU-001, §5 RN-004 | Entender el requisito de ancla visual |
| 2 | `documentacion/especificaciones_estructurales/core-estructural.md` | §3.1 ADR-0001 (Render stack) | Saber que CesiumJS proporciona controles nativos |

### Contratos que NO debes romper

```
- Posición ancla visual: Catedral de Santiago (coordenadas fijas en config)
- Vista inicial: Azimut, pitch, distancia predefinidos para "primera vista épica"
- Controles disponibles: Zoom, rotate, tilt, pan (todos nativos de Cesium)
```

### Señales de alerta

- Si quieres cambiar el punto de ancla a otro lugar → requiere aprobación; es identidad del producto
- Si quieres guardar/recuperar posiciones de cámara del usuario → no está en Fase 1; feature nueva
- Si la navegación es lenta en dispositivos móviles → Fase 1 optimiza para PC; móvil es Fase 2+

---

## FEAT-005: Pipeline de Generación de Tiles {#feat-005}

**Descripción:** Scripts y procesos para convertir datos crudos (LIDAR PNOA, EUDEM, OSM, etc.) en tiles listos para servir (Quantized Mesh, 3D Tiles, MVT).
**Módulos involucrados:** Pipeline offline (WSL2 local), scripts Python/Node

### Especificaciones obligatorias (en este orden)

| Orden | Documento | Secciones a leer | Por qué |
|---|---|---|---|
| 1 | `documentacion/especificaciones_estructurales/core-estructural.md` | §5.1 Patrón Pipeline Offline | Entender el flujo completo de procesamiento |
| 2 | `documentacion/especificaciones_estructurales/core-estructural.md` | §3.4 ADR-0004 (ETRS89 + EGM2008) | Conversión de alturas es crítica |
| 3 | `documentacion/especificaciones_funcionales/core-funcional.md` | §2 Glosario (Capa de datos pública) | Restricciones de licencias en fuentes de datos |
| 4 | `documentacion/especificaciones_funcionales/capas-gis.md` | Completo (URLs verificadas §1–11) | Enlaces de descarga verificados y corregidos para cada capa |
| 5 | `documentacion/lecciones_aprendidas.md` | Completo | Recoge comandos, errores y decisiones reales del pipeline MDT02→Cesium para no repetir trabajo costoso |

### Contratos que NO debes romper

```
- Entrada pipeline: Datos en CRS origen (ETRS89 para cartografía española, WGS84 para OSM)
- Salida terrain tiles: Quantized Mesh v1.0 con WGS84 elipsoidal
- Salida 3D Tiles: 3D Tiles v1.0 con WGS84 elipsoidal
- Salida vector tiles: MVT con geometrías ETRS89 (25829)
- Pipeline corre en WSL2 local; servidor Oracle NO genera tiles
```

### Señales de alerta

- Si necesitas procesar un dataset nuevo → verificar licencia (RN-001: solo datos públicos)
- Si el proceso es muy lento → es aceptable; pipeline es offline, no realtime
- Si descubres un error en tiles ya publicados → requiere nueva versión completa (ver §5.2 Patrón Versionado)

---

## FEAT-006: Despliegue y Operaciones {#feat-006}

**Descripción:** Proceso de despliegue manual en servidor Oracle Free Tier con Docker Compose.
**Módulos involucrados:** Docker, docker-compose, nginx, nginx proxy manager, PostGIS

### Especificaciones obligatorias (en este orden)

| Orden | Documento | Secciones a leer | Por qué |
|---|---|---|---|
| 1 | `documentacion/especificaciones_estructurales/core-estructural.md` | §3.3 ADR-0003 (Despliegue Docker + NPM) | Arquitectura de contenedores |
| 2 | `documentacion/especificaciones_estructurales/core-estructural.md` | §5.3 Patrón Despliegue Manual | Procedimiento exacto de despliegue |
| 3 | `documentacion/especificaciones_estructurales/core-estructural.md` | §4 Restricciones técnicas | Límites de Oracle Free Tier |

### Contratos que NO debes romper

```
- Servicios en docker-compose: nginx, postgis, pg_tileserv, app-cliente, nginx-proxy-manager
- Red interna Docker: GDT expone HTTP plano; NPM es único punto TLS
- Volumen de datos: `/data/gdt/tiles/` montado en nginx
- Configuración: Todas las variables en `.env` o `docker-compose.yml`; nunca hardcoded en imágenes
```

### Señales de alerta

- Si necesitas añadir un nuevo servicio → verificar RAM disponible (24 GB total para todos los contenedores)
- Si quieres automatizar despliegue (CI/CD) → Fase 1 es manual; CI/CD es Fase 2+
- Si hay problemas de certificado TLS → verificar nginx proxy manager, no el stack GDT directamente

---

## FEAT-007: Evaluación Fase 1 (Demo) {#feat-007}

**Descripción:** Criterios de aceptación y proceso de evaluación para aprobación de Fase 1 por el director del proyecto.
**Módulos involucrados:** Validación manual, métricas de rendimiento

### Especificaciones obligatorias (en este orden)

| Orden | Documento | Secciones a leer | Por qué |
|---|---|---|---|
| 1 | `documentacion/especificaciones_funcionales/core-funcional.md` | §2 Glosario (Fase 1), §4 CU-002, §5 RN-002, RN-003 | Entender los criterios medibles |
| 2 | `documentacion/especificaciones_estructurales/core-estructural.md` | §4 Restricciones técnicas | Límites numéricos específicos |

### Contratos que NO debes romper

```
- Tiempo carga inicial: < 5 segundos @ 10 Mbps
- FPS mínimo: 30 FPS @ 2 km de Catedral en PC estándar
- Cobertura mínima: 50 km² con resolución 2m en zona Focus
- Prioridad: Calidad visual sobre rendimiento mientras se cumplan métricas mínimas
```

### Señales de alerta

- Si alguna métrica no se cumple → Fase 1 es rechazada; no hay excepciones
- Si el director pide más calidad a costa de FPS → negociar: RN-002 dice que calidad tiene prioridad sobre rendimiento extra
- Si quieres añadir nuevas métricas → documentar en glosario y RN; no improvisar durante evaluación

---

## ADRs relevantes para todo el proyecto

Antes de decisiones arquitectónicas significativas, leer ADRs completos:
- `docs/adr/0001-render-stack-cesiumjs.md`
- `docs/adr/0002-cobertura-focus-contexto.md`
- `docs/adr/0003-despliegue-docker-npm.md`
- `docs/adr/0004-sistema-referencia-etrs89-egm2008.md`
- `docs/adr/0005-carreteras-osm-imagery.md`

---

## Reglas de oro para agentes de IA

1. **Nunca inventes términos.** Si no está en el glosario de `documentacion/especificaciones_funcionales/core-funcional.md`, no lo uses.
2. **No rompas contratos.** Las URLs de tiles, sistemas de coordenadas, y headers de cache son sagrados.
3. **Respeta las fases.** Fase 1 ≠ Fase 2. No implementes features de Fase 2 en código de Fase 1.
4. **Pipeline es offline.** El servidor Oracle nunca genera tiles; solo sirve archivos estáticos.
5. **Todo es público.** No uses datos con licencia restrictiva; verifica RN-001.

---

*Generado por sixtema-sdd. Para modificaciones, ejecutar el skill nuevamente.*
