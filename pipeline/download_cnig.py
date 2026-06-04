#!/usr/bin/env python3
"""
Descarga datasets del CNIG/IGN.

IMPORTANTE: El portal centrodedescargas.cnig.es NO ofrece descarga directa
programatica sin interaccion web (requiere navegador, sesion, y "cesta" de
descarga). Este script intenta primero los servicios WCS/WFS oficiales del
IDEe; si fallan, documenta el proceso de descarga manual obligatoria.

Requiere: pip install owslib requests

Uso:
    python3 download_cnig.py --dataset mdt2 -o ./data/raw/cnig
    python3 download_cnig.py --dataset all -o ./data/raw/cnig
"""
import os
import sys
import argparse
import time
from pathlib import Path

try:
    from owslib.wcs import WebCoverageService
    from owslib.wfs import WebFeatureService
    OWS_AVAILABLE = True
except ImportError:
    OWS_AVAILABLE = False
    print("[!] owslib no instalado. Ejecuta: pip install owslib requests")

# Bounding box zona Focus (Santiago) en EPSG:25829
BBOX_FOCUS_25829 = {
    'minx': 525000, 'miny': 4745000,
    'maxx': 545000, 'maxy': 4765000,
}

WCS_URL = "https://servicios.idee.es/wcs-mtde"
WFS_BTN25 = "https://servicios.idee.es/wfs-cnig-btn25"
DEFAULT_OUTPUT = Path(__file__).parent.parent / "data" / "raw" / "cnig"


def download_mdt_wcs(output_dir: Path, resolution: str = "2") -> bool:
    if not OWS_AVAILABLE:
        return False
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"mdt{resolution}m_focus.tif"
    try:
        print(f"[+] Conectando a WCS: {WCS_URL}")
        wcs = WebCoverageService(WCS_URL, version='1.0.0', timeout=30)
        layers = list(wcs.contents.keys())
        print(f"    Capas detectadas: {layers[:10]}...")
        target_layer = None
        for name in layers:
            upper = name.upper()
            if 'MDT' in upper and resolution in name:
                target_layer = name
                break
            if 'MDE' in upper and resolution in name:
                target_layer = name
                break
        if not target_layer:
            print(f"[!] No se encontro capa MDT/MDE con resolucion {resolution}m")
            print(f"    Capas disponibles: {layers}")
            return False
        print(f"[+] Solicitando cobertura: {target_layer}")
        print(f"    BBOX: {BBOX_FOCUS_25829}")
        response = wcs.getCoverage(
            identifier=target_layer,
            bbox=(
                BBOX_FOCUS_25829['minx'], BBOX_FOCUS_25829['miny'],
                BBOX_FOCUS_25829['maxx'], BBOX_FOCUS_25829['maxy']
            ),
            crs='urn:ogc:def:crs:EPSG::25829',
            format='image/tiff',
            width=10000, height=10000,
        )
        with open(output_file, 'wb') as f:
            f.write(response.read())
        size_mb = output_file.stat().st_size / 1024 / 1024
        print(f"[OK] Guardado: {output_file} ({size_mb:.1f} MB)")
        return True
    except Exception as e:
        print(f"[ERROR] WCS fallo: {e}")
        print("[INFO] El servicio WCS del CNIG puede requerir certificado, estar")
        print("       limitado en resolucion, o no exponer la capa exacta.")
        return False


def download_vector_wfs(service_url: str, typename: str, output_dir: Path, output_name: str) -> bool:
    if not OWS_AVAILABLE:
        return False
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"{output_name}.geojson"
    try:
        print(f"[+] Conectando a WFS: {service_url}")
        wfs = WebFeatureService(url=service_url, version='2.0.0', timeout=30)
        if typename not in wfs.contents:
            print(f"[!] Capa '{typename}' no encontrada en WFS")
            print(f"    Capas disponibles: {list(wfs.contents.keys())[:20]}")
            return False
        print(f"[+] Descargando {typename}...")
        response = wfs.getfeature(
            typename=typename,
            bbox=(
                BBOX_FOCUS_25829['minx'], BBOX_FOCUS_25829['miny'],
                BBOX_FOCUS_25829['maxx'], BBOX_FOCUS_25829['maxy']
            ),
            srsname='urn:ogc:def:crs:EPSG::25829',
            outputFormat='application/json'
        )
        with open(output_file, 'wb') as f:
            f.write(response.read())
        size_kb = output_file.stat().st_size / 1024
        print(f"[OK] Guardado: {output_file} ({size_kb:.1f} KB)")
        return True
    except Exception as e:
        print(f"[ERROR] WFS fallo: {e}")
        return False


def print_manual_instructions(dataset: str, output_base: Path):
    print("\n" + "=" * 60)
    print("INSTRUCCIONES DE DESCARGA MANUAL (CNIG)")
    print("=" * 60)
    if dataset in ('mdt2', 'all'):
        print("\n--- MDT02 (MDT 2m LIDAR PNOA, 2a cobertura) ---")
        print("1. Abre: https://centrodedescargas.cnig.es/CentroDescargas/buscar-mapa")
        print("2. Localiza Santiago de Compostela en el mapa")
        print("3. En 'Modelos Digitales del Terreno', selecciona 'MDT02'")
        print("4. Selecciona las hojas que cubren Santiago (busca hoja 0947-1)")
        print("5. Anadelas a la cesta y descarga")
        print(f"6. Coloca los .tif en: {output_base / 'mdt'}")
    if dataset in ('lidar', 'all'):
        print("\n--- LIDAR 2a cobertura (nube de puntos LAZ) ---")
        print("1. Abre: https://centrodedescargas.cnig.es/CentroDescargas/lidar-segunda-cobertura")
        print("2. Selecciona las hojas LIDAR que cubren Santiago")
        print(f"3. Coloca los .LAZ en: {output_base / 'lidar'}")
    if dataset in ('btn25', 'all'):
        print("\n--- BTN25 (Base Cartografica Nacional vectorial) ---")
        print("1. Abre: https://centrodedescargas.cnig.es/CentroDescargas/btn")
        print("2. Selecciona tema 'Hidrografia'")
        print("3. Descarga por provincia: A Coruna, Lugo, Ourense, Pontevedra")
        print(f"4. Coloca los Shapefiles en: {output_base / 'vector'}")
    if dataset in ('mtn25', 'all'):
        print("\n--- MTN25 (Mapa Topografico Nacional, vectorial) ---")
        print("1. Abre: https://centrodedescargas.cnig.es/CentroDescargas/mapa-topografico-nacional")
        print("2. Selecciona formato 'Vectorial'")
        print("3. Descarga las hojas que cubren Santiago (0947-1, 0947-2)")
        print(f"4. Coloca los archivos en: {output_base / 'vector'}")
    if dataset in ('ngbe', 'all'):
        print("\n--- NGBE (Nomenclator Geografico Basico de Espana) ---")
        print("1. Abre: https://centrodedescargas.cnig.es/CentroDescargas/nomenclator-geografico-basico-espana")
        print("2. Descarga la version completa (MDB/CSV/GML)")
        print(f"3. Coloca en: {output_base / 'toponimos'}")
    print("\n" + "=" * 60)
    print("Nota: Guarda los archivos descargados manualmente para evitar")
    print("      repetir el proceso. El pipeline los procesara en el paso 2.")
    print("=" * 60 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description='Pipeline de descarga CNIG/IGN',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python3 download_cnig.py --dataset mdt2
  python3 download_cnig.py --dataset all -o ./data/cnig

IMPORTANTE: La descarga automatica via WCS/WFS puede fallar por limitaciones
del servicio. En ese caso, el script muestra instrucciones de descarga manual.
        """
    )
    parser.add_argument('--dataset', choices=['mdt2', 'lidar', 'btn25', 'mtn25', 'ngbe', 'all'], default='all')
    parser.add_argument('--output', '-o', type=Path, default=DEFAULT_OUTPUT, help='Directorio de salida')
    parser.add_argument('--manual-only', action='store_true', help='Omitir intento WCS/WFS; mostrar solo instrucciones manuales')
    args = parser.parse_args()

    success_count = 0
    attempted = []

    if not args.manual_only:
        print("=" * 60)
        print("FASE 1: Intento de descarga automatica via WCS/WFS")
        print("=" * 60)
        if args.dataset in ('mdt2', 'all'):
            attempted.append('mdt2')
            if download_mdt_wcs(args.output / 'mdt', resolution='2'):
                success_count += 1
        if args.dataset in ('btn25', 'all'):
            attempted.append('btn25')
            if download_vector_wfs(
                WFS_BTN25,
                'btn25:HIDROGRAFIA',
                args.output / 'vector',
                'btn25_hidrografia'
            ):
                success_count += 1
        print(f"\n[Resumen] Descargas automaticas exitosas: {success_count}/{len(attempted)}")
        if success_count == len(attempted) and len(attempted) > 0:
            print("[OK] Todas las descargas automaticas completadas.")
            return 0
        print("\n[!] Algunas descargas automaticas fallaron. Pasando a instrucciones manuales.\n")
        time.sleep(1)

    print_manual_instructions(args.dataset, args.output)
    return 1


if __name__ == '__main__':
    sys.exit(main())
