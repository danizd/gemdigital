# Pipeline Offline — GDT-Santiago

Scripts de descarga y procesamiento de datos geoespaciales para el Gemelo Digital de Santiago.

## Requisitos del Sistema

- **WSL2 (Ubuntu 22.04+)** o sistema Linux nativo
- **Python 3.10+**
- **GDAL** (para procesamiento DEM)
- **Cesium Terrain Builder** (para generar tiles Quantized Mesh)

## Instalacion

### 1. Entorno Python

```bash
cd pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. GDAL (requerido para procesamiento DEM)

```bash
# En WSL2/Ubuntu:
sudo apt update
sudo apt install gdal-bin python3-gdal

# Verificar instalacion:
gdalinfo --version
```

### 3. Cesium Terrain Builder (requerido para tiles 3D)

```bash
# Opcion A: Compilar desde fuente
git clone https://github.com/geo-data/cesium-terrain-builder.git
cd cesium-terrain-builder && mkdir build && cd build
cmake .. && make && sudo make install

# Opcion B: Docker (recomendado)
docker pull tumgis/ctb-quantized-mesh
```

## Datos Disponibles

### Estado Actual del Pipeline

| Fuente | Estado | Ubicacion | Notas |
|--------|--------|-----------|-------|
| **CNIG MDT02** | Descargado | `pipeline/data/raw/cnig/mdt/` | 5 hojas LIDAR 2m (ETRS89/WGS84) |
| **Copernicus GLO-30** | Descargado | `pipeline/data/raw/copernicus/` | 46 tiles (solo metadatos PDF) |
| **OSM** | Pendiente | `pipeline/data/raw/osm/` | Ejecutar `download_osm.py` |
| **EGM2008** | Pendiente | `pipeline/data/raw/egm2008/` | Ejecutar `download_egm2008.sh` |

## Flujo de Trabajo

### Paso 1: Descarga de Datos

#### CNIG (MDT, vectoriales)

**Descarga manual requerida** desde https://centrodedescargas.cnig.es:

1. Abre el buscador de mapas
2. Localiza **Santiago de Compostela**
3. Selecciona **"MDT02 - 2ª Cobertura LIDAR"** (resolución 2m)
4. Descarga hojas: **0094-2, 0095-1, 0095-3** (y 0094-3 si es necesario)
5. Coloca los archivos `.tif` en: `pipeline/data/raw/cnig/mdt/`

**Datos ya disponibles:**
- `MDT02-ETRS89-HU29-0094-2-COB2.tif` (136 MB)
- `MDT02-ETRS89-HU29-0095-1-COB2.tif` (120 MB)
- `MDT02-WGS84-0094-2-COB2.tif` (145 MB)
- `MDT02-WGS84-0095-1-COB2.tif` (143 MB)
- `MDT02-WGS84-0095-3-COB2.tif` (142 MB)

#### Copernicus DEM (GLO-30)

```bash
# Requiere credenciales en .env (ver seccion Credenciales)
python3 download_copernicus.py --bbox-galicia
```

**Nota:** Los datos descargados de Copernicus OData son principalmente metadatos PDF. Para datos raster reales, usar S3 directo o considerar que el MDT02 del CNIG tiene mejor resolución (2m vs 30m).

#### OSM (Geofabrik + Overpass)

```bash
python3 download_osm.py --source all -o ./data/raw/osm
```

#### EGM2008 (geoides)

```bash
bash download_egm2008.sh ./data/raw/egm2008
```

### Paso 2: Procesamiento DEM

Fusionar MDT02 del CNIG y convertir a formato Cesium-compatible:

```bash
# Procesar solo zona Focus (CNIG MDT02)
python3 process_dem.py --focus

# Procesar todo el pipeline
python3 process_dem.py --all
```

**Salida generada:**
- `data/processed/dem_focus_2m_wgs84.tif` - DEM fusionado en WGS84

### Paso 3: Generar Tiles Quantized Mesh

```bash
# Usar ctb-tile (requiere instalacion previa)
ctb-tile -f Mesh -C ./tiles/v1/terrain/focus -s data/processed/dem_focus_2m_wgs84.tif

# O con Docker:
docker run -v $(pwd)/data:/data -v $(pwd)/tiles:/tiles \
  tumgis/ctb-quantized-mesh \
  ctb-tile -f Mesh -C /tiles/v1/terrain/focus -s /data/processed/dem_focus_2m_wgs84.tif
```

## Credenciales

### Copernicus Data Space

1. Registrate en https://dataspace.copernicus.eu
2. Añade a tu `.env` en la raiz del proyecto:

```env
COPERNICUS_USERNAME=tu_email@ejemplo.com
COPERNICUS_PASSWORD=tu_password
```

**Nota:** Para descargar datos Contributing Missions (DEM), activa el permiso en tu perfil:
https://dataspace.copernicus.eu/profile → "Copernicus Contributing Missions access"

## Notas Importantes

- **CNIG:** El portal oficial NO permite descarga directa programática. Los scripts intentan WCS/WFS primero, pero generalmente requieren descarga manual.

- **Copernicus:** Los tiles OData devuelven metadatos, no datos raster. Considerar S3 directo o usar CNIG para mejor resolución.

- **Proyecciones:**
  - **Entrada:** ETRS89 UTM29N (EPSG:25829) para datos CNIG
  - **Salida:** WGS84 (EPSG:4326) elipsoidal para CesiumJS
  - **Conversión alturas:** Ortométricas (EGM2008) → Elipsoidales WGS84

- **Cesium Terrain Builder:** Requiere compilación o Docker. Alternativa: usar ` quantized-mesh-tile` de Cesium Ion (requiere token).
