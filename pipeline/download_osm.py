#!/usr/bin/env python3
"""
Descarga datos OpenStreetMap via Geofabrik (extractos regionales)
y Overpass API (consultas puntuales).

Geofabrik: descarga directa estable, resume soportado.
Overpass: rate limit agresivo (max 2 consultas/segundo).
           Para grandes volumenes, preferir extracto Geofabrik + filtrado local.

Requiere: pip install requests

Uso:
    python3 download_osm.py --source geofabrik --region galicia -o ./data/raw/osm
    python3 download_osm.py --source overpass --query camino -o ./data/raw/osm
    python3 download_osm.py --source all -o ./data/raw/osm
"""
import os
import sys
import time
import argparse
from pathlib import Path

import requests

# === CONFIGURACION ===
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
GEOFABRIK_BASE = "https://download.geofabrik.de/europe/spain"

GEOFABRIK_REGIONS = {
    'galicia': 'galicia-latest.osm.pbf',
    'spain': 'spain-latest.osm.pbf',
}

DEFAULT_OUTPUT = Path(__file__).parent.parent / "data" / "raw" / "osm"


def download_geofabrik(region: str, output_dir: Path) -> Path:
    filename = GEOFABRIK_REGIONS.get(region)
    if not filename:
        print(f"[ERROR] Region '{region}' no disponible. Opciones: {list(GEOFABRIK_REGIONS.keys())}")
        sys.exit(1)
    url = f"{GEOFABRIK_BASE}/{filename}"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / filename
    headers = {}
    existing_size = 0
    if output_file.exists():
        existing_size = output_file.stat().st_size
        headers['Range'] = f'bytes={existing_size}-'
        print(f"[!] Archivo parcial encontrado ({existing_size/1024/1024:.0f} MB), reanudando...")
    print(f"[+] Descargando {filename} desde Geofabrik...")
    print(f"    URL: {url}")
    response = requests.get(url, headers=headers, stream=True, timeout=300)
    response.raise_for_status()
    if response.status_code == 206:
        mode = 'ab'
        downloaded = existing_size
        print(f"    Reanudando descarga...")
    else:
        mode = 'wb'
        downloaded = 0
        if existing_size > 0:
            print(f"    El servidor no soporta reanudacion. Descargando desde el inicio...")
            output_file.unlink(missing_ok=True)
    with open(output_file, mode) as f:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                if downloaded % (50 * 1024 * 1024) == 0:
                    print(f"    ... {downloaded/1024/1024:.0f} MB")
    final_mb = output_file.stat().st_size / 1024 / 1024
    print(f"[OK] Guardado: {output_file} ({final_mb:.1f} MB)")
    return output_file


def query_overpass(overpass_ql: str, output_file: Path, timeout: int = 120) -> bool:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    print(f"[+] Consultando Overpass API (timeout={timeout}s)...")
    print(f"    Query length: {len(overpass_ql)} chars")
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.post(
                OVERPASS_URL,
                data={'data': overpass_ql},
                headers={
                    'User-Agent': 'GDT-Santiago/1.0 (gemdigital research)',
                    'Accept': 'application/json',
                },
                timeout=timeout
            )
            if response.status_code == 429:
                wait = 30 * (attempt + 1)
                print(f"[!] Rate limit (429). Esperando {wait}s...")
                time.sleep(wait)
                continue
            response.raise_for_status()
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(response.text)
            size_kb = output_file.stat().st_size / 1024
            print(f"[OK] Guardado: {output_file} ({size_kb:.1f} KB)")
            return True
        except requests.Timeout:
            print(f"[!] Timeout en intento {attempt + 1}/{max_retries}")
            if attempt < max_retries - 1:
                time.sleep(10)
            else:
                print("[ERROR] Maximos reintentos alcanzados.")
                return False
        except requests.HTTPError as e:
            print(f"[ERROR] HTTP {e.response.status_code}: {e}")
            return False
    return False


def build_camino_query() -> str:
    return """
[out:json][timeout:120];
area["name:es"="Galicia"]->.searchArea;
(
  relation["route"="camino_de_santiago"](area.searchArea);
  way["route"="camino_de_santiago"](area.searchArea);
  node["pilgrimage"="camino_de_santiago"](area.searchArea);
  way["highway"]["name"~"Camino|camino"](area.searchArea);
);
out body;
>;
out skel qt;
"""


def build_buildings_query() -> str:
    return """
[out:json][timeout:120];
(
  way["building"](42.87,-8.56,42.90,-8.52);
  relation["building"](42.87,-8.56,42.90,-8.52);
);
out body;
>;
out skel qt;
"""


def main():
    parser = argparse.ArgumentParser(
        description='Descarga datos OpenStreetMap',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  # Descargar extracto completo de Galicia
  python3 download_osm.py --source geofabrik --region galicia

  # Descargar solo el Camino de Santiago via Overpass
  python3 download_osm.py --source overpass --query camino

  # Todo (Geofabrik + consultas Overpass)
  python3 download_osm.py --source all
        """
    )
    parser.add_argument('--output', '-o', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--source', choices=['geofabrik', 'overpass', 'all'], default='all')
    parser.add_argument('--region', choices=['galicia', 'spain'], default='galicia')
    parser.add_argument('--query', choices=['camino', 'buildings', 'all'], default='all',
                        help='Tipo de consulta Overpass a ejecutar')
    args = parser.parse_args()

    success = True

    if args.source in ('geofabrik', 'all'):
        print("=" * 60)
        print("FASE 1: Descarga Geofabrik (extracto regional)")
        print("=" * 60)
        try:
            download_geofabrik(args.region, args.output)
        except Exception as e:
            print(f"[ERROR] Geofabrik fallo: {e}")
            success = False

    if args.source in ('overpass', 'all'):
        print("\n" + "=" * 60)
        print("FASE 2: Consultas Overpass (datos puntuales)")
        print("=" * 60)
        print("[!] Nota: Overpass tiene rate limit. Si falla, espera 1 minuto y reintenta.")

        if args.query in ('camino', 'all'):
            print("\n--- Camino de Santiago ---")
            camino_file = args.output / 'camino_santiago.json'
            if not query_overpass(build_camino_query(), camino_file):
                success = False
            time.sleep(2)

        if args.query in ('buildings', 'all'):
            print("\n--- Edificios (Santiago, zona pequena) ---")
            buildings_file = args.output / 'buildings_santiago.json'
            if not query_overpass(build_buildings_query(), buildings_file):
                success = False

    print("\n" + "=" * 60)
    if success:
        print("[OK] Pipeline OSM completado.")
    else:
        print("[!] Pipeline OSM completado con errores. Revisar mensajes anteriores.")
    print("=" * 60)
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
