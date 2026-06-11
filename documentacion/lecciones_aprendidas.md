# Lecciones aprendidas — Pipeline de terreno GDT-Santiago

> Documento vivo para evitar repetir errores operativos durante la generación e integración de terrain tiles en CesiumJS.
> Última actualización: 2026-06-05

## 1. Contexto de la sesión

Se trabajó en el hito H1 de Fase 1: generar terreno 3D local para la zona Focus de Santiago a partir de MDT02 del CNIG y servirlo en el cliente CesiumJS desde `public/tiles/v1/terrain/`.

Datos usados:

- MDT02 WGS84 del CNIG en `pipeline/data/raw/cnig/mdt02/`.
- Mosaico generado como `pipeline/data/raw/cnig/mdt02_mosaic.tif`.
- GeoTIFF procesado como `pipeline/data/processed/mdt02_wgs84_elipsoidal.tif`.
- Tiles generados en `pipeline/data/processed/terrain/`.
- Tiles servidos por Vite desde `public/tiles/v1/terrain/`.

## 2. Rutas Windows vs WSL

En WSL se deben usar rutas Linux:

```bash
/mnt/c/Proyectos_local/gemdigital/...
```

No usar rutas Windows dentro de WSL:

```text
C:\Proyectos_local\gemdigital\...
```

Síntoma típico:

```text
No such file or directory
```

Ejemplo correcto:

```bash
cd /mnt/c/Proyectos_local/gemdigital/pipeline/data/raw/cnig/mdt02
```

## 3. `gdal_merge.py` deja el mosaico donde indica `-o`

Si se ejecuta desde `pipeline/data/raw/cnig/mdt02`:

```bash
gdal_merge.py -o ../mdt02_mosaic.tif *.tif
```

El resultado queda en:

```text
pipeline/data/raw/cnig/mdt02_mosaic.tif
```

No queda en:

```text
pipeline/data/raw/cnig/mdt02/mdt02_mosaic.tif
```

Este detalle causó errores de ruta en `gdalwarp`.

## 4. `gdalwarp` debe escribir con ruta absoluta o directorio existente

El directorio de salida debe existir antes de ejecutar `gdalwarp`.

Comando usado:

```bash
mkdir -p /mnt/c/Proyectos_local/gemdigital/pipeline/data/processed
cd /mnt/c/Proyectos_local/gemdigital/pipeline/data/raw/cnig

gdalwarp -t_srs EPSG:4326 -of GTiff \
  -co COMPRESS=LZW \
  -co TILED=YES \
  --config GDAL_CACHE_MAX 512 \
  mdt02_mosaic.tif \
  /mnt/c/Proyectos_local/gemdigital/pipeline/data/processed/mdt02_wgs84_elipsoidal.tif
```

## 5. `cesium-terrain-builder` no genera Quantized Mesh

Aunque se pensó inicialmente en Quantized Mesh, la herramienta `geo-data/cesium-terrain-builder` usada en esta sesión genera formato:

```text
heightmap-1.0
```

No genera:

```text
quantized-mesh-1.0
```

Esto se verificó en su README y código fuente (`TerrainTile.hpp`).

Consecuencia:

- El `layer.json` debe declarar `"format": "heightmap-1.0"`.
- Si se declara `"quantized-mesh-1.0"`, Cesium lanza errores de lectura binaria como:

```text
RangeError: Invalid typed array length
Offset is outside the bounds of the DataView
```

## 6. Parche necesario para compilar CTB con GDAL 3.8

Con GDAL 3.8.4, `cesium-terrain-builder` falló al compilar por referencia no resuelta:

```text
undefined reference to `GDALCreateOverviewDataset(GDALDataset*, int, bool)'
```

Se resolvió reemplazando el uso de `GDALCreateOverviewDataset` por `NULL` en `src/GDALTiler.cpp`:

```bash
cd /tmp/cesium-terrain-builder

perl -0pi -e 's/poSrcOvrDS\s*=\s*GDALCreateOverviewDataset\s*\(\s*poSrcDS\s*,\s*iOvr\s*,\s*(FALSE|false)\s*\)\s*;/poSrcOvrDS = NULL;/g' src/GDALTiler.cpp

grep -R "GDALCreateOverviewDataset" -n /tmp/cesium-terrain-builder/src --exclude="*.bak"
```

El último `grep` no debe devolver nada.

Luego recompilar limpio:

```bash
cd /tmp/cesium-terrain-builder
rm -rf build
mkdir build
cd build
cmake ..
make -j1
sudo make install
sudo ldconfig
```

Si `ctb-tile` no encuentra `libctb.so`, ejecutar:

```bash
sudo ldconfig
```

## 7. Flags correctos de `ctb-tile`

La versión compilada usa estos flags:

```bash
ctb-tile \
  --output-format Terrain \
  --profile geodetic \
  --start-zoom 15 \
  --end-zoom 0 \
  --thread-count 4 \
  --output-dir terrain \
  mdt02_wgs84_elipsoidal.tif
```

Importante:

- `--start-zoom` debe ser mayor que `--end-zoom`.
- El directorio de salida debe existir previamente.

Preparación:

```bash
cd /mnt/c/Proyectos_local/gemdigital/pipeline/data/processed
rm -rf terrain
mkdir -p terrain
```

## 8. Cesium pide niveles bajos aunque la zona sea pequeña

Cesium solicita tiles de niveles bajos como:

```text
Level 0, X 0, Y 0
Level 0, X 1, Y 0
```

No basta con generar niveles `10-15`. Hay que generar desde `0` hasta el nivel de detalle deseado.

Si faltan niveles base, Vite puede devolver `index.html`, y Cesium intentará parsear HTML como terrain binario.

Síntomas:

```text
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
Invalid typed array length
```

## 9. Tiles `.terrain` generados por CTB salen gzipados

Los `.terrain` generados por CTB empiezan con bytes:

```text
1f 8b
```

Esto indica gzip.

Verificación:

```bash
xxd -l 4 /mnt/c/Proyectos_local/gemdigital/public/tiles/v1/terrain/0/0/0.terrain
```

Si Vite sirve estos archivos sin `Content-Encoding: gzip`, Cesium los lee mal.

Para desarrollo local, se descomprimieron en `public`:

```bash
python3 - <<'PY'
from pathlib import Path
import gzip

root = Path("/mnt/c/Proyectos_local/gemdigital/public/tiles/v1/terrain")

count = 0
for path in root.rglob("*.terrain"):
    data = path.read_bytes()
    if data.startswith(b"\x1f\x8b"):
        path.write_bytes(gzip.decompress(data))
        count += 1

print(f"Tiles descomprimidos: {count}")
PY
```

Tras descomprimir, un tile de nivel 0 empezó por:

```text
8813 8813
```

Y pesó aproximadamente:

```text
8.3K
```

Esto encaja con un heightmap de `65 x 65` muestras.

## 10. No borrar `public/tiles/v1/terrain` sin regenerar `layer.json`

Al ejecutar:

```bash
rm -rf /mnt/c/Proyectos_local/gemdigital/public/tiles/v1/terrain
```

se borra también:

```text
layer.json
```

Si Cesium pide `layer.json` y Vite devuelve HTML, aparece:

```text
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

Después de copiar tiles a `public`, siempre recrear `layer.json`.

## 11. `layer.json` mínimo funcional para CTB heightmap

Para los tiles generados con CTB, usar:

```json
{
  "tilejson": "2.1.0",
  "format": "heightmap-1.0",
  "version": "1.0.0",
  "scheme": "tms",
  "tiles": [
    "{z}/{x}/{y}.terrain"
  ],
  "projection": "EPSG:4326",
  "bounds": [-8.65, 42.82, -8.45, 42.95],
  "heightmapWidth": 65
}
```

No declarar `quantized-mesh-1.0` para esta salida de CTB.

## 12. `available` debe reflejar tiles reales

Para datasets pequeños, Cesium puede pedir tiles fuera de cobertura. Conviene generar `available` escaneando los `.terrain` existentes.

Script usado:

```bash
python3 - <<'PY'
from pathlib import Path
import json
from collections import defaultdict

root = Path("/mnt/c/Proyectos_local/gemdigital/public/tiles/v1/terrain")

tiles_by_level = defaultdict(list)

for terrain_file in root.rglob("*.terrain"):
    try:
        z = int(terrain_file.parent.parent.name)
        x = int(terrain_file.parent.name)
        y = int(terrain_file.stem)
    except ValueError:
        continue

    tiles_by_level[z].append((x, y))

max_level = max(tiles_by_level) if tiles_by_level else 0
available = []

for level in range(max_level + 1):
    tiles = tiles_by_level.get(level, [])
    ranges = []

    if tiles:
        by_x = defaultdict(list)
        for x, y in tiles:
            by_x[x].append(y)

        for x in sorted(by_x):
            ys = sorted(set(by_x[x]))
            start_y = ys[0]
            prev_y = ys[0]

            for y in ys[1:]:
                if y == prev_y + 1:
                    prev_y = y
                else:
                    ranges.append({"startX": x, "startY": start_y, "endX": x, "endY": prev_y})
                    start_y = y
                    prev_y = y

            ranges.append({"startX": x, "startY": start_y, "endX": x, "endY": prev_y})

    available.append(ranges)

layer = {
    "tilejson": "2.1.0",
    "format": "heightmap-1.0",
    "version": "1.0.0",
    "scheme": "tms",
    "tiles": ["{z}/{x}/{y}.terrain"],
    "projection": "EPSG:4326",
    "bounds": [-8.65, 42.82, -8.45, 42.95],
    "heightmapWidth": 65,
    "available": available,
}

(root / "layer.json").write_text(json.dumps(layer, indent=2), encoding="utf-8")

print(f"layer.json generado con niveles 0-{max_level}")
for level in range(max_level + 1):
    print(f"Nivel {level}: {len(available[level])} rangos")
PY
```

Al probarlo se detectó una anomalía:

```text
Nivel 3: 0 rangos
```

Eso indica que faltaban tiles de nivel 3 y obliga a revisar o regenerar.

## 13. Cuidado con procesos pesados en `/mnt/c`

Procesar miles de tiles en `/mnt/c/...` desde WSL es lento por E/S entre Linux y Windows.

Síntoma:

```bash
ps aux | grep python
```

Muestra el proceso en estado `D+`, esperando disco.

Recomendación para futuras ejecuciones:

1. Procesar en filesystem Linux, por ejemplo `~/gemdigital-work/`.
2. Copiar resultados finales a `C:\Proyectos_local\gemdigital\public\...` solo al final.

## 14. Comandos Windows y WSL no son intercambiables

Dentro de WSL:

```bash
ls -lh /mnt/c/Proyectos_local/gemdigital/...
```

En CMD/PowerShell:

```cmd
dir C:\Proyectos_local\gemdigital\...
type C:\Proyectos_local\gemdigital\...\layer.json
```

No usar `ls` en CMD ni rutas `C:\...` sin escapar dentro de WSL.

## 15. Estado técnico al cierre de la sesión

Se llegó a estos aprendizajes firmes:

- CTB compila con parche sobre GDAL 3.8.
- CTB genera `heightmap-1.0`, no Quantized Mesh.
- Los `.terrain` de CTB salen gzipados.
- Para Vite en local, hay que descomprimir o configurar headers de gzip.
- `layer.json` debe existir siempre en `public/tiles/v1/terrain/layer.json`.
- Cesium falla con errores poco claros cuando recibe HTML, gzip sin header o formato declarado incorrecto.
- La integración cliente en `src/core/GdtViewer.ts` usa `CesiumTerrainProvider.fromUrl('./tiles/v1/terrain/')`.

## 16. Recomendación para el siguiente paso

Antes de seguir iterando manualmente, conviene crear scripts versionados para:

1. Crear mosaico MDT02.
2. Generar tiles CTB.
3. Copiar tiles a `public`.
4. Descomprimir `.terrain` para entorno Vite local.
5. Generar `layer.json` correcto.
6. Validar existencia/tamaño de tiles críticos (`0/0/0.terrain`, `0/1/0.terrain`, niveles intermedios).

Esto reducirá errores humanos y tiempos muertos.

## 17. Validación obligatoria de cobertura geográfica

Que Cesium cargue tiles sin errores no garantiza que el terreno corresponda a Santiago. En esta sesión se confirmó que el pipeline funcionaba técnicamente, pero los MDT02 descargados no cubrían la zona Focus.

Antes de generar tiles, validar siempre los bounds del GeoTIFF:

```bash
gdalinfo /mnt/c/Proyectos_local/gemdigital/pipeline/data/processed/mdt02_wgs84_elipsoidal.tif \
  | grep -E 'Upper Left|Lower Right|Center|Size is'
```

La zona Focus de Santiago debe cubrir aproximadamente:

```text
Longitud: -8.65 .. -8.45
Latitud:   42.82 .. 42.95
Centro:   cerca de -8.5448, 42.8805
```

Los archivos procesados durante esta sesión estaban realmente alrededor de:

```text
Longitud: -7.52 .. -3.18
Latitud:   37.74 .. 37.84
Centro:   cerca de -5.3549, 37.7916
```

Esto explica por qué:

- Cesium cargaba `layer.json` y `.terrain` con `200 OK`.
- No había errores de consola.
- La cámara centrada en la Catedral no refinaba a niveles altos.
- Visualmente no se apreciaba relieve en Santiago.

Regla operativa:

1. Validar bounds de cada GeoTIFF raw con `gdalinfo`.
2. Validar bounds del mosaico.
3. Validar bounds del GeoTIFF procesado.
4. Solo entonces generar tiles.
5. Si Cesium carga terreno pero no refina en la cámara esperada, comprobar si esa cámara cae dentro del rango de tiles generados.

Para depurar visualmente tiles fuera de Santiago, se puede centrar temporalmente la cámara en el centro real detectado:

```text
longitude: -5.3549
latitude: 37.7916
```

## 18. `heightmapStructure` correcto para CTB

Los valores binarios de los `.terrain` generados por CTB no son metros directos. Se detectaron muestras como:

```text
5000
```

Ese valor representa aproximadamente `0 m` si se aplica la estructura estándar:

```text
altura_m = valor * 0.2 - 1000
```

Por tanto, el `layer.json` debe incluir:

```json
{
  "heightmapStructure": {
    "heightScale": 0.2,
    "heightOffset": -1000.0,
    "elementsPerHeight": 1,
    "stride": 1,
    "elementMultiplier": 256.0,
    "isBigEndian": false
  }
}
```

Si falta esta estructura, Cesium puede cargar tiles sin errores pero interpretar las alturas de forma incorrecta o visualmente poco útil.

## 19. Cómo diagnosticar si Cesium refina niveles altos

Con Playwright/DevTools, revisar `Network` filtrando por:

```text
tiles/v1/terrain
```

Si la cámara está fuera de la cobertura real, Cesium puede quedarse en niveles bajos:

```text
0, 1, 2, 3, 4
```

Si la cámara está dentro de la cobertura real y el `available` está bien, debe pedir niveles altos:

```text
9, 10, 11, 12, 13, 14, 15
```

En la sesión se confirmó que al centrar la cámara en:

```text
longitude: -5.3549
latitude: 37.7916
```

Cesium solicitó tiles como:

```text
/tiles/v1/terrain/15/31794/23261.terrain
/tiles/v1/terrain/14/15896/11631.terrain
/tiles/v1/terrain/13/7947/5816.terrain
```

Esto validó que el pipeline, `layer.json`, `available`, descompresión y escala eran técnicamente correctos.

## 20. Pantalla marrón no implica fallo de terreno

Durante la prueba se vio toda la pantalla marrón. La causa no era un fallo del terrain, sino una combinación de:

- `hillshade` desactivado temporalmente.
- Capa base `NaturalEarthII` demasiado pobre para escala local.
- Cámara centrada en una zona de depuración fuera de Santiago.
- Falta de imagery detallada que aporte referencias visuales.

Para depuración visual se cambió temporalmente la capa base a OpenStreetMap:

```text
https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

Esto ayuda a orientarse, pero debe evaluarse para producción por dependencias externas, licencias, rendimiento y disponibilidad.

## 21. Cambios temporales de depuración que hay que revertir

Durante la validación se hicieron cambios útiles para diagnosticar, pero no deben confundirse con estado final de producto:

- Coordenadas de cámara/ancla cambiadas temporalmente de Santiago a `-5.3549, 37.7916`.
- `terrainExaggeration` subido a `4.0`.
- `hillshade` desactivado temporalmente.
- `requestRenderMode` cambiado a `false`.
- `scene.globe.maximumScreenSpaceError` reducido a `0.5`.
- Capa base cambiada a OpenStreetMap.

Cuando se descarguen los MDT02 correctos de Santiago, restaurar:

```text
longitude: -8.5448
latitude: 42.8805
```

Y revisar valores finales de exageración, refinamiento, renderizado y capas base según criterios de Fase 1.

## 22. Hito 2A: Generación manual de 3D Tiles (B3DM/GLB) desde Python — Fracaso documentado

### Contexto

Se intentó generar un tileset 3D Tiles v1.0 para 200 edificios OSM del casco antiguo de Santiago usando `trimesh` (extrusión + exportación GLB) y empaquetado manual B3DM con `struct.pack`. El objetivo era validar el pipeline antes de usar LIDAR real.

### Errores cometidos y resultados

#### 22.1. `trimesh` requiere motor de triangulación instalado

Sin un motor de triangulación, `trimesh` lanza advertencias sobre `triangulate_polygon` y licencias. La solución fue instalar:

```bash
pip install mapbox-earcut
```

#### 22.2. B3DM manual con `struct.pack` requiere alineación a 8 bytes

El header de B3DM ocupa 28 bytes. El feature table JSON debe estar **padded a múltiplo de 8 bytes contando desde el inicio del archivo**, no solo a múltiplo de 8 de su propia longitud.

```text
28 (header) + len(feature_table_json) + padding  ≡  0 (mod 8)
```

Si no se respeta, Cesium no puede leer el GLB embebido.

#### 22.3. `trimesh` exporta GLB en Z-up; Cesium asume Y-up para glTF 2.0

El GLB generado por `trimesh` usa coordenadas Z-up (X=Este, Y=Norte, Z=Arriba). Cesium, por defecto, interpreta glTF 2.0 como Y-up. Aunque el tileset permite `"gltfUpAxis": "Z"`, el comportamiento en la práctica fue inestable.

Solución aplicada (sin éxito final): rotar el mesh `-90°` en el eje X antes de exportar para convertir Z-up → Y-up y eliminar `"gltfUpAxis"`.

#### 22.4. Coordenadas locales + `transform` ECEF en tileset producen bounding sphere inválido

El tileset.json definía un `transform` columna-major ECEF para posicionar el modelo en el mundo. Cesium calculó un `boundingSphere` con altura `1061 m` (esperado: ~260 m) y radio `5699 m`. Al intentar `viewer.zoomTo(tileset)`, Cesium lanzó:

```text
DeveloperError: normalized result is not a number
```

Esto indica que el bounding sphere tenía un vector de longitud cero o NaN, bloqueando la navegación automática.

#### 22.5. Coordenadas ECEF absolutas en el GLB sin `transform` destruyen el bounding sphere

Se probó poner coordenadas ECEF directamente en los vértices del GLB y omitir el `transform` del tileset. El resultado fue un `boundingSphere` con centro en `lat=-90°, lon=0°, height=-6.290.762 m` (centro de la Tierra), demostrando que Cesium interpreta los vértices del GLB como **coordenadas locales del tile**, no como ECEF absolutas.

#### 22.6. El tileset carga sin errores pero no renderiza edificios visibles

A pesar de:
- `tileset.ready = true`
- `tileset.tilesLoaded = true`
- `commands = 1` (un comando de renderizado)
- Sin errores en consola

Los edificios nunca fueron visiblemente distinguibles en la escena, ni con color rojo brillante (`vec4(1.0, 0.0, 0.0, 1.0)`) como estilo de depuración.

### Conclusión y recomendación

**No generar B3DM/GLB manualmente desde Python para producción.** El formato 3D Tiles tiene requisitos de alineación, padding, coordenadas y bounding volumes que son propensos a errores sutiles cuando se hacen a mano.

Para futuros intentos (Hito 2B / LIDAR), usar herramientas especializadas:

- `py3dtiles` (Python): generación de B3DM/3D Tiles con validación integrada.
- `3d-tiles-tools` de Cesium (Node.js): toolchain oficial para validar, optimizar y generar tilesets.
- `gltf-transform` (Node.js): validar y reparar GLB antes de empaquetar.

**Alternativa viable para Hito 2A**: `Cesium.Entity` con `polygon` + `extrudedHeight` es más robusta, permite 200 edificios sin pérdida de rendimiento (FPS > 30) y no requiere dominar el formato binario de 3D Tiles.

### Archivos involucrados

- `pipeline/buildings_simple_3dtiles.py` — script de generación (fracasado).
- `public/tiles/v1/3dtiles/buildings/buildings.glb` — GLB generado por trimesh.
- `public/tiles/v1/3dtiles/buildings/tileset.json` — tileset con transform ECEF.
- `src/core/GdtViewer.ts` — integración `Cesium3DTileset` (desactivada tras el fracaso).
