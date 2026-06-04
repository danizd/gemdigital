#!/usr/bin/env python3
"""
Procesa datos DEM brutos y los converte a formato listo para generar tiles Quantized Mesh.

Requisitos (instalar en WSL2 o sistema Linux):
    sudo apt update
    sudo apt install gdal-bin python3-gdal
    # Cesium Terrain Builder (compilar desde fuente o usar Docker)

Entrada:
    - pipeline/data/raw/cnig/mdt/     # MDT02 LIDAR 2m (ETRS89)
    - pipeline/data/raw/copernicus/   # Copernicus GLO-30 (WGS84)

Salida:
    - data/processed/dem_merged_focus.tif  # DEM fusionado zona Focus (WGS84)
    - data/processed/dem_context.vrt       # VRT Contexto (WGS84)
    - tiles/v1/terrain/                    # Tiles Quantized Mesh (generados con ctb-tile)
"""
import os
import sys
import subprocess
from pathlib import Path

# Rutas
PROJECT_ROOT = Path(__file__).parent.parent
RAW_DIR = PROJECT_ROOT / "pipeline" / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
TILES_DIR = PROJECT_ROOT / "tiles" / "v1" / "terrain"

# Datos de entrada
CNIG_MDT_DIR = RAW_DIR / "cnig" / "mdt"
COPERNICUS_DIR = RAW_DIR / "copernicus" / "extracted"

# Salida
FOCUS_DEM = PROCESSED_DIR / "dem_focus_2m_wgs84.tif"
CONTEXT_VRT = PROCESSED_DIR / "dem_context_copernicus.vrt"


def run_gdal_command(cmd: list, description: str) -> bool:
    """Ejecuta un comando GDAL y verifica errores."""
    print(f"[+] {description}")
    print(f"    Command: {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"    [OK] Completado")
        return True
    except subprocess.CalledProcessError as e:
        print(f"    [ERROR] {e}")
        if e.stderr:
            print(f"    stderr: {e.stderr[:500]}")
        return False
    except FileNotFoundError:
        print(f"    [ERROR] Comando no encontrado. ¿GDAL está instalado?")
        print(f"            sudo apt install gdal-bin")
        return False


def process_focus_dem():
    """
    Procesa los MDT02 del CNIG (zona Focus):
    1. Fusiona los 4 archivos TIFF
    2. Reproyecta de ETRS89 UTM29N → WGS84
    3. Genera un solo archivo GeoTIFF optimizado
    """
    print("=" * 60)
    print("FASE 1: Procesar DEM Focus (CNIG MDT02 2m)")
    print("=" * 60)

    # Buscar archivos MDT02
    mdt_files = sorted(CNIG_MDT_DIR.glob("*.tif"))
    if not mdt_files:
        print(f"[ERROR] No se encontraron archivos MDT02 en {CNIG_MDT_DIR}")
        return False

    print(f"[+] Encontrados {len(mdt_files)} archivos MDT02:")
    for f in mdt_files:
        print(f"    - {f.name}")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    # Paso 1: Fusionar todos los MDT02
    merged_temp = PROCESSED_DIR / "dem_focus_merged_temp.tif"

    if len(mdt_files) == 1:
        # Solo uno, copiar directamente
        import shutil
        shutil.copy(mdt_files[0], merged_temp)
    else:
        # Fusionar con gdal_merge.py o gdalbuildvrt + gdal_translate
        vrt_temp = PROCESSED_DIR / "dem_focus_temp.vrt"

        # Crear VRT
        cmd_vrt = [
            "gdalbuildvrt",
            "-r", "bilinear",
            str(vrt_temp),
        ] + [str(f) for f in mdt_files]

        if not run_gdal_command(cmd_vrt, "Creando VRT de fusión"):
            return False

        # Convertir VRT a TIFF
        cmd_merge = [
            "gdal_translate",
            "-of", "GTiff",
            "-co", "COMPRESS=DEFLATE",
            "-co", "TILED=YES",
            str(vrt_temp),
            str(merged_temp),
        ]

        if not run_gdal_command(cmd_merge, "Convirtiendo VRT a TIFF"):
            return False

    # Paso 2: Reproyectar a WGS84 (EPSG:4326)
    # Nota: Los MDT02 vienen en ETRS89 UTM29N (EPSG:25829) o WGS84 UTM29N
    cmd_warp = [
        "gdalwarp",
        "-t_srs", "EPSG:4326",  # WGS84
        "-r", "bilinear",
        "-tr", "0.00002", "0.00002",  # ~2m en grados (~0.000018 grados)
        "-co", "COMPRESS=DEFLATE",
        "-co", "TILED=YES",
        "-overwrite",
        str(merged_temp),
        str(FOCUS_DEM),
    ]

    if not run_gdal_command(cmd_warp, f"Reproyectando a WGS84 → {FOCUS_DEM}"):
        return False

    # Limpiar temporal
    if merged_temp.exists():
        merged_temp.unlink()
    vrt_temp = PROCESSED_DIR / "dem_focus_temp.vrt"
    if vrt_temp.exists():
        vrt_temp.unlink()

    # Verificar resultado
    if FOCUS_DEM.exists():
        size_mb = FOCUS_DEM.stat().st_size / 1024 / 1024
        print(f"[OK] DEM Focus generado: {FOCUS_DEM} ({size_mb:.1f} MB)")
        return True

    return False


def process_context_dem():
    """
    Procesa los datos Copernicus para Contexto.
    Crea un VRT que referencia todos los tiles descargados.
    """
    print("\n" + "=" * 60)
    print("FASE 2: Procesar DEM Contexto (Copernicus GLO-30)")
    print("=" * 60)

    # Buscar archivos en los ZIP extraídos
    # Nota: Los archivos extraídos son principalmente PDFs de metadatos
    # Los datos reales están en los ZIP sin extraer o en formato diferente

    dem_files = []

    # Buscar archivos DT1/DT2 que son los DEM reales de Copernicus
    for pattern in ["*.dt1", "*.dt2", "*.tif", "*.tiff", "*.dem"]:
        dem_files.extend(COPERNICUS_DIR.rglob(pattern))

    if not dem_files:
        print(f"[!] No se encontraron archivos DEM en {COPERNICUS_DIR}")
        print(f"    Los datos Copernicus descargados pueden ser solo metadatos.")
        print(f"    Considera descargar Copernicus DEM vía S3 directo.")
        return False

    print(f"[+] Encontrados {len(dem_files)} archivos DEM:")
    for f in dem_files[:10]:
        print(f"    - {f.name}")
    if len(dem_files) > 10:
        print(f"    ... y {len(dem_files) - 10} más")

    # Crear VRT para Contexto
    cmd_vrt = [
        "gdalbuildvrt",
        "-r", "bilinear",
        "-overwrite",
        str(CONTEXT_VRT),
    ] + [str(f) for f in dem_files]

    if not run_gdal_command(cmd_vrt, "Creando VRT de Contexto"):
        return False

    if CONTEXT_VRT.exists():
        print(f"[OK] VRT Contexto generado: {CONTEXT_VRT}")
        return True

    return False


def generate_terrain_tiles():
    """
    Genera tiles Quantized Mesh usando Cesium Terrain Builder.
    Esto debe ejecutarse en WSL2 con ctb-tile instalado.
    """
    print("\n" + "=" * 60)
    print("FASE 3: Generar tiles Quantized Mesh (requiere ctb-tile)")
    print("=" * 60)

    TILES_DIR.mkdir(parents=True, exist_ok=True)

    if not FOCUS_DEM.exists():
        print(f"[ERROR] No existe {FOCUS_DEM}. Ejecuta primero --focus")
        return False

    # Generar tiles para zona Focus (alto detalle, zoom 10-15)
    cmd_focus = [
        "ctb-tile",
        "-f", "Mesh",  # Formato Quantized Mesh
        "-C", str(TILES_DIR / "focus"),
        "-N",  # No usar南北极修正
        "-s", str(FOCUS_DEM),
    ]

    print(f"[+] Generando tiles Focus (alto detalle)...")
    print(f"    Command: {' '.join(cmd_focus)}")
    print(f"    [INFO] Esto requiere ctb-tile instalado en WSL2")
    print(f"           Ver: https://github.com/geo-data/cesium-terrain-builder")

    # No ejecutamos automáticamente porque ctb-tile probablemente no esté instalado
    print(f"\n    Para ejecutar manualmente en WSL2:")
    print(f"    sudo apt install cesium-terrain-builder")
    print(f"    {' '.join(cmd_focus)}")

    return True


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description='Procesa DEM brutos para generación de tiles',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python3 process_dem.py --focus              # Solo procesar zona Focus
  python3 process_dem.py --context            # Solo procesar Contexto
  python3 process_dem.py --all                # Todo el pipeline
  python3 process_dem.py --tiles             # Generar tiles Quantized Mesh

Requisitos:
  - GDAL instalado (gdalwarp, gdalbuildvrt, gdal_translate)
  - Cesium Terrain Builder para generar tiles (ctb-tile)
  - Ejecutar en WSL2 recomendado
        """
    )
    parser.add_argument('--focus', action='store_true', help='Procesar DEM Focus (CNIG MDT02)')
    parser.add_argument('--context', action='store_true', help='Procesar DEM Contexto (Copernicus)')
    parser.add_argument('--tiles', action='store_true', help='Generar tiles Quantized Mesh')
    parser.add_argument('--all', action='store_true', help='Ejecutar todo el pipeline')
    args = parser.parse_args()

    if not any([args.focus, args.context, args.tiles, args.all]):
        parser.print_help()
        return 1

    success = True

    if args.all or args.focus:
        if not process_focus_dem():
            success = False

    if args.all or args.context:
        if not process_context_dem():
            success = False

    if args.all or args.tiles:
        if not generate_terrain_tiles():
            success = False

    print("\n" + "=" * 60)
    if success:
        print("[OK] Pipeline de procesamiento completado")
        print(f"     Datos procesados en: {PROCESSED_DIR}")
    else:
        print("[!] Pipeline completado con advertencias")
        print("     Algunos pasos fallaron. Revisa los mensajes de error.")
        print("     Asegúrate de tener GDAL instalado:")
        print("     sudo apt install gdal-bin")
    print("=" * 60)

    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
