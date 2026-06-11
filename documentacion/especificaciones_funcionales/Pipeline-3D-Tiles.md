Especificación funcional — Hito 2B: Pipeline 3D Tiles para gemelo digital
Proyecto: Gemelo digital del casco antiguo de Santiago de Compostela
Versión: 1.0
Estado: Activa
Sustituye a: Hito 2A (fracasado — pipeline manual B3DM/GLB desde Python)

1. Contexto y antecedentes
1.1 Qué se intentó en Hito 2A
Se implementó un pipeline manual para generar un tileset 3D Tiles v1.0 con 200 edificios OSM del casco antiguo. El approach consistía en:

Extruir geometrías OSM con trimesh y exportar GLB
Empaquetar el GLB en B3DM manualmente con struct.pack
Definir un tileset.json con transform ECEF columna-major
Cargar el tileset en Cesium con Cesium3DTileset

1.2 Por qué falló
El formato B3DM tiene invariantes implícitos que la especificación 3D Tiles v1.0 no documenta con suficiente claridad para una implementación manual. Los fallos fueron acumulativos e interdependientes:
#ErrorSíntoma observableCausa raíz22.1Motor de triangulación ausenteAdvertencias triangulate_polygonmapbox-earcut no instalado22.2Padding B3DM incorrectoGLB ilegible por CesiumPadding calculado relativo a JSON, no al inicio del archivo22.3Eje Z-up vs Y-upEdificios volcados o invisiblestrimesh exporta Z-up; glTF 2.0 asume Y-up22.4transform ECEF + coords localesDeveloperError: normalized result is not a numberBounding sphere con vector de longitud cero22.5Vértices ECEF sin transformCentro del tileset en lat=-90°, height=-6.3M mCesium interpreta vértices GLB como coords locales, no absolutas22.6Carga sin visibilidadtilesLoaded=true, commands=1, edificios invisiblesBounding sphere corrupto: cámara no converge al tileset
Diagnóstico de raíz: el error 22.4 y 22.5 son la misma causa vista desde dos ángulos opuestos. Cesium exige que el GLB esté siempre en coordenadas locales del tile, y que el transform del tileset sea la única fuente de verdad para la posición ECEF. Mezclar ambas aproximaciones destruye el bounding sphere y bloquea la navegación automática. El error 22.6 es consecuencia directa: tilesLoaded=true solo confirma parsing correcto, no posicionamiento válido en escena.
1.3 Decisión adoptada
No generar B3DM/GLB manualmente desde Python para producción. La complejidad de alineación, padding, sistemas de coordenadas y bounding volumes supera el valor de la implementación propia. Se adopta una estrategia en dos fases descritas en esta especificación.

2. Objetivos del Hito 2B

Visualizar correctamente los 200 edificios OSM del casco antiguo en Cesium con geometría 3D extruida.
Validar la cadena de datos completa: OSM → geometría → Cesium, antes de incorporar datos LIDAR reales.
Establecer el pipeline de producción con herramientas especializadas para la fase LIDAR.
Mantener rendimiento ≥ 30 FPS en la visualización de los edificios.


3. Solución aprobada
3.1 Fase A — Visualización inmediata con Cesium.Entity
Propósito: desacoplar la validación visual del formato de tile. Permite confirmar que la geometría, las alturas y la posición geográfica son correctas antes de invertir tiempo en el pipeline de tiles.
Approach:
OSM (Overpass API) → GeoJSON → Python (preprocessing) → JSON → Cesium.Entity
Cada edificio se renderiza como un polygon con extrudedHeight derivado del atributo building:levels o height de OSM. No requiere formato binario ni tileset.
Criterio de aceptación:

Los 200 edificios aparecen posicionados correctamente sobre el terreno de Cesium Ion
Las alturas son plausibles (planta baja ≈ 3.5 m, edificio típico casco antiguo ≈ 10–15 m)
FPS ≥ 30 con todos los edificios visibles en pantalla
viewer.zoomTo() navega correctamente al conjunto

Archivos afectados:

pipeline/osm_to_entities.py — extracción OSM y generación de JSON de edificios
public/data/buildings.json — datos de edificios procesados
src/core/GdtViewer.ts — carga e instanciación de Cesium.Entity por edificio

3.2 Fase B — Pipeline de producción con herramientas especializadas
Propósito: una vez validada la geometría en Fase A, migrar a 3D Tiles para soporte de LIDAR real, LOD, y escalabilidad a datasets mayores.
Stack de herramientas aprobado:
HerramientaRolInstalaciónpy3dtilesGeneración de B3DM/3D Tiles con validación integradapip install py3dtiles3d-tiles-tools (Cesium)Validación, optimización y conversión de tilesetsnpm install -g @cesium/3d-tiles-toolsgltf-transformValidación y reparación de GLB antes de empaquetadonpm install -g @gltf-transform/cli
Pipeline aprobado:
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
Criterios de aceptación:

3d-tiles-tools validate pasa sin errores
gltf-transform validate pasa sin warnings de coordenadas
viewer.zoomTo(tileset) navega correctamente (sin DeveloperError)
Bounding sphere con altura ≈ 260 m y radio plausible para el casco antiguo


4. Reglas de implementación
Las siguientes reglas se derivan directamente de los errores documentados en Hito 2A y son obligatorias en toda implementación futura de 3D Tiles en este proyecto.
4.1 Coordenadas en GLB

Los vértices de cualquier GLB embebido en B3DM deben estar siempre en coordenadas locales del tile (origen en el centroide del tile, unidades en metros). Nunca usar coordenadas ECEF absolutas como vértices.

4.2 Posicionamiento ECEF

El transform del tileset (o del tile raíz) es la única fuente de verdad para la posición en el mundo. Debe ser una matriz columna-major 4×4 con origen en el centroide ECEF del conjunto de tiles.

4.3 Bounding volumes

No calcular boundingSphere ni boundingBox manualmente. Usar las herramientas de la sección 3.2 para generarlos. Si se requiere un valor manual de referencia para Santiago de Compostela: latitud ≈ 42.88°, longitud ≈ -8.54°, altura ≈ 260 m s.n.m., radio estimado del casco antiguo ≈ 400 m.

4.4 Eje vertical

Todos los GLB generados para este proyecto deben estar en Y-up (estándar glTF 2.0). No usar "gltfUpAxis": "Z" en el tileset. Verificar con gltf-transform validate antes de empaquetar.

4.5 Diagnóstico de tilesLoaded=true sin visibilidad

Si el tileset carga sin errores pero los edificios no son visibles, el problema es siempre el bounding sphere, no el shader ni el material. Verificar primero con console.log(tileset.boundingSphere) y comparar con la posición esperada en ECEF.


5. Fuera de alcance
Los siguientes elementos quedan explícitamente fuera del alcance de Hito 2B:

Generación manual de B3DM con struct.pack o similar
Uso de "gltfUpAxis" como workaround de orientación
Carga de datos LIDAR reales (reservado para Hito 3)
LOD automático (reservado para Hito 3)
Integración con fuentes de datos en tiempo real


6. Archivos del proyecto
ArchivoEstadoDescripciónpipeline/buildings_simple_3dtiles.py❌ DeprecadoScript de generación manual (Hito 2A)pipeline/osm_to_entities.py🆕 NuevoExtracción OSM → JSON para Cesium.Entitypublic/data/buildings.json🆕 NuevoDatos de edificios procesados (Fase A)public/tiles/v1/3dtiles/buildings/buildings.glb❌ DeprecadoGLB generado por trimesh (Hito 2A)public/tiles/v1/3dtiles/buildings/tileset.json❌ DeprecadoTileset con transform ECEF incorrecto (Hito 2A)src/core/GdtViewer.ts🔧 ModificarReactivar con Cesium.Entity en Fase A; Cesium3DTileset en Fase B

