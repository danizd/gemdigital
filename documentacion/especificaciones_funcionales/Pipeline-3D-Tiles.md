# Especificación funcional — Hito 2B: Pipeline 3D Tiles para gemelo digital

**Proyecto:** Gemelo digital del casco antiguo de Santiago de Compostela  
**Versión:** 1.1  
**Estado:** Activa  
**Sustituye a:** Hito 2A (fracasado — pipeline manual B3DM/GLB desde Python)  
**Cambios v1.1:** Fase A migrada de `Cesium.Entity` a `Primitive` + `GeometryInstance` por razones de rendimiento (sección 3.1)

---

## 1. Contexto y antecedentes

### 1.1 Qué se intentó en Hito 2A

Se implementó un pipeline manual para generar un tileset 3D Tiles v1.0 con 200 edificios OSM del casco antiguo. El approach consistía en:

- Extruir geometrías OSM con `trimesh` y exportar GLB
- Empaquetar el GLB en B3DM manualmente con `struct.pack`
- Definir un `tileset.json` con `transform` ECEF columna-major
- Cargar el tileset en Cesium con `Cesium3DTileset`

### 1.2 Por qué falló

El formato B3DM tiene invariantes implícitos que la especificación 3D Tiles v1.0 no documenta con suficiente claridad para una implementación manual. Los fallos fueron acumulativos e interdependientes:

| # | Error | Síntoma observable | Causa raíz |
|---|---|---|---|
| 22.1 | Motor de triangulación ausente | Advertencias `triangulate_polygon` | `mapbox-earcut` no instalado |
| 22.2 | Padding B3DM incorrecto | GLB ilegible por Cesium | Padding calculado relativo a JSON, no al inicio del archivo |
| 22.3 | Eje Z-up vs Y-up | Edificios volcados o invisibles | `trimesh` exporta Z-up; glTF 2.0 asume Y-up |
| 22.4 | `transform` ECEF + coords locales | `DeveloperError: normalized result is not a number` | Bounding sphere con vector de longitud cero |
| 22.5 | Vértices ECEF sin `transform` | Centro del tileset en lat=-90°, height=-6.3M m | Cesium interpreta vértices GLB como coords locales, no absolutas |
| 22.6 | Carga sin visibilidad | `tilesLoaded=true`, `commands=1`, edificios invisibles | Bounding sphere corrupto: cámara no converge al tileset |

**Diagnóstico de raíz:** el error 22.4 y 22.5 son la misma causa vista desde dos ángulos opuestos. Cesium exige que el GLB esté siempre en coordenadas locales del tile, y que el `transform` del tileset sea la única fuente de verdad para la posición ECEF. Mezclar ambas aproximaciones destruye el bounding sphere y bloquea la navegación automática. El error 22.6 es consecuencia directa: `tilesLoaded=true` solo confirma parsing correcto, no posicionamiento válido en escena.

### 1.3 Decisión adoptada

**No generar B3DM/GLB manualmente desde Python para producción.** La complejidad de alineación, padding, sistemas de coordenadas y bounding volumes supera el valor de la implementación propia. Se adopta una estrategia en dos fases descritas en esta especificación.

---

## 2. Objetivos del Hito 2B

1. Visualizar correctamente los 7.791 edificios OSM de Santiago en Cesium con geometría 3D extruida.
2. Mantener rendimiento ≥ 30 FPS en iGPU moderna con todos los edificios en viewport.
3. Establecer el pipeline de producción con herramientas especializadas para la fase LIDAR.
4. Mantener rendimiento ≥ 30 FPS en la visualización de los edificios.

---

## 3. Solución aprobada

### 3.1 Fase A — Visualización con `Primitive` + `GeometryInstance`

**Propósito:** desacoplar la validación visual del formato de tile. Permite confirmar que la geometría, las alturas y la posición geográfica son correctas antes de invertir tiempo en el pipeline de tiles.

**Approach:**

```
OSM (Overpass API) → GeoJSON → Python (preprocessing) → JSON → Primitive + GeometryInstance
```

Cada edificio se representa como un `GeometryInstance` con `PolygonGeometry` + `extrudedHeight` y un `ColorGeometryInstanceAttribute`. Todos los edificios se agrupan en un único `Primitive` con `PerInstanceColorAppearance`, lo que permite a Cesium hacer batching de geometría estática en un solo buffer de GPU.

> **Por qué no `Cesium.Entity`:** con 7.000+ edificios, `Cesium.Entity` genera un draw call por entidad. `Primitive` agrupa toda la geometría estática en un único draw call, obteniendo 5×–10× mejor rendimiento con resultado visual idéntico. `GroundPrimitive` queda descartado porque no soporta `extrudedHeight`; la clase correcta para edificios extruidos es `Primitive`.

**Criterios de aceptación:**
- Los edificios aparecen posicionados correctamente sobre el terreno de Cesium Ion
- Las alturas son plausibles (planta baja ≈ 3.5 m, edificio típico casco antiguo ≈ 10–15 m)
- FPS ≥ 30 con 7.000+ edificios visibles en pantalla en iGPU moderna (Intel Iris Xe / AMD RDNA)
- `viewer.camera.flyTo()` o `viewer.zoomTo()` navega correctamente al conjunto
- Un único `Primitive` en escena (verificable con `scene.primitives.length === 1` para edificios)

**Archivos afectados:**
- `pipeline/osm_to_entities.py` — extracción OSM y generación de `buildings.json`
- `public/data/buildings.json` — datos de edificios procesados (~3 MB para 7.791 edificios)
- `src/core/GdtViewer.ts` — función `addBuildingsOSMEntities()` migrada a `Primitive`

### 3.2 Fase B — Pipeline de producción con herramientas especializadas

**Propósito:** una vez validada la geometría en Fase A, migrar a 3D Tiles para soporte de LIDAR real, LOD, y escalabilidad a datasets mayores.

**Stack de herramientas aprobado:**

| Herramienta | Rol | Instalación |
|---|---|---|
| `py3dtiles` | Generación de B3DM/3D Tiles con validación integrada | `pip install py3dtiles` |
| `3d-tiles-tools` (Cesium) | Validación, optimización y conversión de tilesets | `npm install -g @cesium/3d-tiles-tools` |
| `gltf-transform` | Validación y reparación de GLB antes de empaquetado | `npm install -g @gltf-transform/cli` |

**Pipeline aprobado:**

```
LIDAR (.las/.laz)
    ↓
py3dtiles (Python)
    → B3DM con coords locales + transform ECEF correcto
    → boundingSphere calculado automáticamente
    ↓
gltf-transform validate
    → confirmar Y-up, sin NaN en vértices
    ↓
3d-tiles-tools validate + optimize
    → tileset.json final
    ↓
Cesium3DTileset (GdtViewer.ts)
```

**Criterios de aceptación:**
- `3d-tiles-tools validate` pasa sin errores
- `gltf-transform validate` pasa sin warnings de coordenadas
- `viewer.zoomTo(tileset)` navega correctamente (sin `DeveloperError`)
- Bounding sphere con altura ≈ 260 m y radio plausible para el casco antiguo

---

## 3.3 Consideraciones de rendimiento

| Escenario | Fase A (`Primitive`) | Fase B (3D Tiles) |
|---|---|---|
| GPU dedicada / iGPU moderna | ✅ FPS ≥ 30 con 7.000+ edificios | ✅ Fluido |
| iGPU básica / PC antiguo | ⚠️ Límite ≈ 2.000–3.000 edificios | ✅ Fluido (LOD automático) |
| Tablet / Chromebook | ❌ No recomendado | ✅ Fluido |

**Separación de responsabilidades:**

| Tarea | Responsable | Recurso consumido |
|---|---|---|
| Servir `buildings.json` (≈ 3 MB) | Servidor / Vite | Ancho de banda (trivial) |
| Parsear JSON y construir `GeometryInstance` | Navegador (JS) | CPU cliente — operación única al cargar |
| Renderizar polígonos extruidos en 3D | GPU del cliente | VRAM + potencia gráfica |

El cuello de botella en Fase A es exclusivamente la GPU del cliente, no el servidor. Un servidor Oracle Free Tier (1 CPU, 1 GB RAM) sirve los mismos 3 MB sin diferencia observable.

**Optimización disponible sin esperar Fase B:** si se necesita reducir la carga en hardware modesto, añadir un filtro por bounding box en `osm_to_entities.py` para limitar el dataset al casco antiguo estricto. El cambio es exclusivamente en el pipeline Python, sin tocar el cliente.



Las siguientes reglas se derivan directamente de los errores documentados en Hito 2A y son obligatorias en toda implementación futura de 3D Tiles en este proyecto.

### 4.1 Coordenadas en GLB

> Los vértices de cualquier GLB embebido en B3DM deben estar siempre en **coordenadas locales del tile** (origen en el centroide del tile, unidades en metros). Nunca usar coordenadas ECEF absolutas como vértices.

### 4.2 Posicionamiento ECEF

> El `transform` del tileset (o del tile raíz) es la única fuente de verdad para la posición en el mundo. Debe ser una matriz columna-major 4×4 con origen en el centroide ECEF del conjunto de tiles.

### 4.3 Bounding volumes

> No calcular `boundingSphere` ni `boundingBox` manualmente. Usar las herramientas de la sección 3.2 para generarlos. Si se requiere un valor manual de referencia para Santiago de Compostela: latitud ≈ 42.88°, longitud ≈ -8.54°, altura ≈ 260 m s.n.m., radio estimado del casco antiguo ≈ 400 m.

### 4.4 Eje vertical

> Todos los GLB generados para este proyecto deben estar en **Y-up** (estándar glTF 2.0). No usar `"gltfUpAxis": "Z"` en el tileset. Verificar con `gltf-transform validate` antes de empaquetar.

### 4.5 Diagnóstico de `tilesLoaded=true` sin visibilidad

> Si el tileset carga sin errores pero los edificios no son visibles, el problema es siempre el bounding sphere, no el shader ni el material. Verificar primero con `console.log(tileset.boundingSphere)` y comparar con la posición esperada en ECEF.

---

## 5. Fuera de alcance

Los siguientes elementos quedan explícitamente fuera del alcance de Hito 2B:

- Generación manual de B3DM con `struct.pack` o similar
- Uso de `"gltfUpAxis"` como workaround de orientación
- Carga de datos LIDAR reales (reservado para Hito 3)
- LOD automático (reservado para Hito 3)
- Integración con fuentes de datos en tiempo real

---

## 6. Archivos del proyecto

| Archivo | Estado | Descripción |
|---|---|---|
| `pipeline/buildings_simple_3dtiles.py` | ❌ Deprecado | Script de generación manual (Hito 2A) |
| `pipeline/osm_to_entities.py` | 🆕 Nuevo | Extracción OSM → JSON para Cesium.Entity |
| `public/data/buildings.json` | 🆕 Nuevo | Datos de edificios procesados (Fase A) |
| `public/tiles/v1/3dtiles/buildings/buildings.glb` | ❌ Deprecado | GLB generado por trimesh (Hito 2A) |
| `public/tiles/v1/3dtiles/buildings/tileset.json` | ❌ Deprecado | Tileset con transform ECEF incorrecto (Hito 2A) |
| `src/core/GdtViewer.ts` | 🔧 Modificar | `addBuildingsOSMEntities()` migrada de Entity a Primitive; Cesium3DTileset en Fase B |

---

## 7. Referencias

- [3D Tiles specification v1.0](https://github.com/CesiumGS/3d-tiles/tree/main/specification)
- [py3dtiles documentation](https://py3dtiles.org)
- [Cesium 3d-tiles-tools](https://github.com/CesiumGS/3d-tiles-tools)
- [glTF-Transform CLI](https://gltf-transform.dev/cli)
- [Cesium Primitive API](https://cesium.com/learn/cesiumjs/ref-doc/Primitive.html)
- [Cesium PerInstanceColorAppearance](https://cesium.com/learn/cesiumjs/ref-doc/PerInstanceColorAppearance.html)
- [Cesium PolygonGeometry con extrudedHeight](https://cesium.com/learn/cesiumjs/ref-doc/PolygonGeometry.html)