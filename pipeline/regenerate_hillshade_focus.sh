#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_MDT_DIR="$PROJECT_ROOT/pipeline/data/raw/cnig/mdt"
PROCESSED_DIR="$PROJECT_ROOT/pipeline/data/processed"
PUBLIC_TILES_DIR="$PROJECT_ROOT/public/tiles/hillshade"
DIST_TILES_DIR="$PROJECT_ROOT/dist/tiles/hillshade"

FOCUS_WEST="-8.65"
FOCUS_SOUTH="42.82"
FOCUS_EAST="-8.45"
FOCUS_NORTH="42.95"

mkdir -p "$PROCESSED_DIR"

VRT_PATH="$PROCESSED_DIR/dem_focus_catedral.vrt"
DEM_WGS84="$PROCESSED_DIR/dem_focus_catedral_wgs84.tif"
HILLSHADE_TIF="$PROCESSED_DIR/dem_focus_catedral_hillshade.tif"
HILLSHADE_3857="$PROCESSED_DIR/dem_focus_catedral_hillshade_3857.tif"

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

echo "[1/5] Creando VRT Focus Catedral"
gdalbuildvrt -overwrite "$VRT_PATH" "${MDT_FILES[@]}"

echo "[2/5] Recortando y normalizando DEM a WGS84"
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

echo "[3/5] Generando hillshade"
gdaldem hillshade \
  -compute_edges \
  -az 315 \
  -alt 45 \
  "$DEM_WGS84" \
  "$HILLSHADE_TIF"

echo "[4/5] Reproyectando hillshade a EPSG:3857 para tiles web"
gdalwarp \
  -overwrite \
  -t_srs EPSG:3857 \
  -r bilinear \
  -co COMPRESS=DEFLATE \
  -co TILED=YES \
  "$HILLSHADE_TIF" \
  "$HILLSHADE_3857"

echo "[5/5] Generando tiles TMS en public/tiles/hillshade"
rm -rf "$PUBLIC_TILES_DIR"
gdal2tiles.py \
  -p mercator \
  -z 10-15 \
  -w none \
  "$HILLSHADE_3857" \
  "$PUBLIC_TILES_DIR"

if [[ -d "$PROJECT_ROOT/dist" ]]; then
  rm -rf "$DIST_TILES_DIR"
  mkdir -p "$(dirname "$DIST_TILES_DIR")"
  cp -R "$PUBLIC_TILES_DIR" "$DIST_TILES_DIR"
fi

echo "[OK] Hillshade Focus Catedral regenerado"
echo "     DEM: $DEM_WGS84"
echo "     Tiles: $PUBLIC_TILES_DIR"
gdalinfo "$PUBLIC_TILES_DIR/tilemapresource.xml" >/dev/null 2>&1 || true
cat "$PUBLIC_TILES_DIR/tilemapresource.xml"
