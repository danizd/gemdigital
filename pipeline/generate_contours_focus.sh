#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_MDT_DIR="$PROJECT_ROOT/pipeline/data/raw/cnig/mdt"
PROCESSED_DIR="$PROJECT_ROOT/pipeline/data/processed"
PUBLIC_DATA_DIR="$PROJECT_ROOT/public/data"

FOCUS_WEST="-8.65"
FOCUS_SOUTH="42.82"
FOCUS_EAST="-8.45"
FOCUS_NORTH="42.95"
CONTOUR_INTERVAL="10"   # metros entre curvas

mkdir -p "$PROCESSED_DIR" "$PUBLIC_DATA_DIR"

VRT_PATH="$PROCESSED_DIR/dem_focus_contours.vrt"
DEM_WGS84="$PROCESSED_DIR/dem_focus_contours_wgs84.tif"
CONTOURS_RAW="$PROCESSED_DIR/contours_raw.geojson"
CONTOURS_OUT="$PUBLIC_DATA_DIR/contours.geojson"

MDT_FILES=(
  "$RAW_MDT_DIR/MDT02-WGS84-0094-2-COB2.tif"
  "$RAW_MDT_DIR/MDT02-WGS84-0094-4-COB2.tif"
  "$RAW_MDT_DIR/MDT02-WGS84-0095-1-COB2.tif"
  "$RAW_MDT_DIR/MDT02-WGS84-0095-3-COB2.tif"
)

for file in "${MDT_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "[ERROR] No existe DEM requerido: $file" >&2
    exit 1
  fi
done

echo "[1/4] Creando VRT Focus"
gdalbuildvrt -overwrite "$VRT_PATH" "${MDT_FILES[@]}"

echo "[2/4] Recortando y normalizando DEM a WGS84"
gdalwarp \
  -overwrite \
  -t_srs EPSG:4326 \
  -te "$FOCUS_WEST" "$FOCUS_SOUTH" "$FOCUS_EAST" "$FOCUS_NORTH" \
  -te_srs EPSG:4326 \
  -r bilinear \
  -co COMPRESS=DEFLATE \
  -co TILED=YES \
  "$VRT_PATH" \
  "$DEM_WGS84"

echo "[3/4] Generando curvas de nivel (intervalo ${CONTOUR_INTERVAL} m)"
gdal_contour -a elevacion_m -i "$CONTOUR_INTERVAL" -f GeoJSON -nln contours "$DEM_WGS84" "$CONTOURS_RAW"

echo "[4/4] Simplificando y reduciendo precision"
ogr2ogr -f GeoJSON -simplify 0.00003 -lco COORDINATE_PRECISION=6 "$CONTOURS_OUT" "$CONTOURS_RAW"

echo "[OK] Curvas de nivel generadas: $CONTOURS_OUT"
wc -l "$CONTOURS_OUT" >/dev/null 2>&1 || true
