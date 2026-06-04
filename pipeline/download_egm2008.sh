#!/usr/bin/env bash
# Descarga EGM2008 para conversion de alturas ortometricas a elipsoidales
# Fuente: NGA (Dominio publico)

set -euo pipefail

OUTPUT_DIR="${1:-./data/raw/egm2008}"
mkdir -p "$OUTPUT_DIR"

echo "[+] Descargando EGM2008..."

# NGA Earth Gravity Model 2008 (5 minuto de arco)
URL="https://earth-info.nga.mil/php/download.php?file=egm-08-spherical-harmonics"

# Descarga con redirect following
wget --no-verbose --tries=3 --timeout=60 \
     --content-disposition \
     -P "$OUTPUT_DIR" \
     "$URL" || {
    echo "[!] Fallo descarga NGA. Intentando mirror alternativo..."
    
    # GeographicLib mirror (solo geoid file, no los coeficientes completos)
    MIRROR="https://sourceforge.net/projects/geographiclib/files/geoid-distrib/egm2008-5.zip/download"
    wget --no-verbose --tries=3 --timeout=60 \
         -O "$OUTPUT_DIR/egm2008-5.zip" \
         "$MIRROR"
}

echo "[OK] EGM2008 descargado en $OUTPUT_DIR"
echo "    Archivos:"
ls -lh "$OUTPUT_DIR"
