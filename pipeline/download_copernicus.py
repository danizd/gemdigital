#!/usr/bin/env python3
"""
Descarga Copernicus DEM (COP-DEM GLO-30) via Data Space API.

Requiere registro gratuito en https://dataspace.copernicus.eu
y generacion de credenciales OAuth2 (Client ID + Client Secret).

Requiere: pip install requests

Uso:
    export COPERNICUS_CLIENT_ID="tu-id"
    export COPERNICUS_CLIENT_SECRET="tu-secret"
    python3 download_copernicus.py --bbox-galicia -o ./data/raw/copernicus

    # O con archivo .env
    python3 download_copernicus.py --env ./.env --bbox-galicia
"""
import os
import sys
import json
import argparse
import time
from pathlib import Path
from datetime import datetime

import requests

# === CONFIGURACION ===
TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
CATALOG_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"

BBOX_GALICIA = {
    'lon_min': -9.5, 'lat_min': 41.8,
    'lon_max': -6.7, 'lat_max': 43.8,
}
BBOX_SANTIAGO = {
    'lon_min': -8.65, 'lat_min': 42.82,
    'lon_max': -8.45, 'lat_max': 42.93,
}

DEM_COLLECTION = "COP-DEM"
# Colecciones alternativas a probar si la principal falla:
DEM_COLLECTION_ALTERNATIVES = [
    "COP-DEM",
    "COP-DEM_GLO-30-DGED",
    "COP-DEM_GLO-30-DGED__2023_1",
    "COP-DEM_GLO-30-DGED__2024_1",
]
DEFAULT_OUTPUT = Path(__file__).parent.parent / "data" / "raw" / "copernicus"


def load_env_file(env_path: Path):
    if not env_path.exists():
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, val = line.split('=', 1)
            # Eliminar comillas si existen (simples o dobles)
            if (val.startswith('"') and val.endswith('"')) or \
               (val.startswith("'") and val.endswith("'")):
                val = val[1:-1]
            os.environ.setdefault(key, val)


def get_access_token(client_id: str, client_secret: str, username: str = None, password: str = None) -> str:
    """Obtiene token de acceso. Soporta client_credentials (client_id+secret) o password (usuario+pass)."""
    # Si hay username y password, usar grant_type=password (flujo para usuarios)
    if username and password:
        data = {
            'grant_type': 'password',
            'client_id': 'cdse-public',
            'username': username,
            'password': password,
        }
    # Si solo hay client_id y client_secret, intentar client_credentials
    elif client_id and client_secret:
        data = {
            'grant_type': 'client_credentials',
            'client_id': client_id,
            'client_secret': client_secret,
        }
    else:
        raise ValueError("Se requiere username/password o client_id/client_secret")

    response = requests.post(
        TOKEN_URL,
        data=data,
        timeout=30
    )
    response.raise_for_status()
    token_data = response.json()
    return token_data['access_token']


def search_dem(token: str, collection: str, bbox: dict) -> list:
    headers = {'Authorization': f'Bearer {token}'}
    # WKT requiere espacios después de las comas según la documentación
    polygon_wkt = (
        f"POLYGON(({bbox['lon_min']} {bbox['lat_min']}, "
        f"{bbox['lon_max']} {bbox['lat_min']}, "
        f"{bbox['lon_max']} {bbox['lat_max']}, "
        f"{bbox['lon_min']} {bbox['lat_max']}, "
        f"{bbox['lon_min']} {bbox['lat_min']}))"
    )
    bbox_filter = f"OData.CSC.Intersects(area=geography'SRID=4326;{polygon_wkt}')"
    collection_filter = f"Collection/Name eq '{collection}'"
    params = {
        '$filter': f"{collection_filter} and {bbox_filter}",
        '$top': 100,
        '$orderby': 'ContentDate/Start desc',
    }
    print(f"    Buscando en coleccion: {collection}")
    print(f"    BBOX: {bbox}")
    print(f"    URL: {CATALOG_URL}")
    print(f"    Query: {params['$filter'][:100]}...")

    response = requests.get(CATALOG_URL, headers=headers, params=params, timeout=60)

    # Debug: mostrar respuesta en caso de error
    if response.status_code != 200:
        print(f"    [DEBUG] Status: {response.status_code}")
        print(f"    [DEBUG] Response: {response.text[:500]}")

    response.raise_for_status()
    data = response.json()
    return data.get('value', [])


def download_product(token: str, product_id: str, product_name: str, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    safe_name = product_name.replace('/', '_').replace(' ', '_')
    output_file = output_dir / f"{safe_name}.zip"
    headers = {'Authorization': f'Bearer {token}'}
    # URL correcta para descarga según documentación
    download_url = f"https://download.dataspace.copernicus.eu/odata/v1/Products({product_id})/$value"
    existing_size = 0
    if output_file.exists():
        existing_size = output_file.stat().st_size
        headers['Range'] = f'bytes={existing_size}-'
        print(f"    Reanudando desde {existing_size/1024/1024:.1f} MB...")
    print(f"    Descargando {product_name}...")
    response = requests.get(download_url, headers=headers, stream=True, timeout=300)
    response.raise_for_status()
    mode = 'ab' if existing_size > 0 else 'wb'
    with open(output_file, mode) as f:
        downloaded = existing_size
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                if downloaded % (50 * 1024 * 1024) == 0:
                    print(f"      ... {downloaded/1024/1024:.0f} MB")
    final_size = output_file.stat().st_size
    print(f"    [OK] {output_file.name} ({final_size/1024/1024:.1f} MB)")
    return output_file


def main():
    parser = argparse.ArgumentParser(description='Descarga Copernicus DEM via Data Space API')
    parser.add_argument('--output', '-o', type=Path, default=DEFAULT_OUTPUT, help='Directorio de salida')
    parser.add_argument('--env', type=Path, help='Archivo .env con credenciales (COPERNICUS_CLIENT_ID, COPERNICUS_CLIENT_SECRET). Por defecto: raiz del proyecto/.env')
    parser.add_argument('--bbox-galicia', action='store_true', help='Descargar tiles que cubren Galicia completa')
    parser.add_argument('--bbox-santiago', action='store_true', help='Descargar tiles que cubren Santiago (zona Focus)')
    parser.add_argument('--collection', default=DEM_COLLECTION, help='Coleccion DEM a buscar')
    args = parser.parse_args()

    # Si no se especifica --env, buscar en la raiz del proyecto por defecto
    if args.env:
        load_env_file(args.env)
    else:
        # Buscar .env en la raiz del proyecto (padre del directorio del script)
        project_root = Path(__file__).parent.parent
        default_env = project_root / '.env'
        if default_env.exists():
            print(f"[INFO] Cargando credenciales desde: {default_env}")
            load_env_file(default_env)

    client_id = os.environ.get('COPERNICUS_CLIENT_ID', '')
    client_secret = os.environ.get('COPERNICUS_CLIENT_SECRET', '')
    username = os.environ.get('COPERNICUS_USERNAME', '')
    password = os.environ.get('COPERNICUS_PASSWORD', '')

    # Validar que tenemos al menos un método de autenticación
    has_client_credentials = client_id and client_secret
    has_user_credentials = username and password

    if not has_client_credentials and not has_user_credentials:
        print("[ERROR] Credenciales Copernicus no configuradas.")
        print("        Opciones (añade al .env en la raiz del proyecto):")
        print("        1. Usuario/Contraseña (recomendado):")
        print("           COPERNICUS_USERNAME=tu_usuario")
        print("           COPERNICUS_PASSWORD=tu_password")
        print("        2. Client Credentials (requiere registro especial en Sentinel Hub):")
        print("           COPERNICUS_CLIENT_ID=tu_client_id")
        print("           COPERNICUS_CLIENT_SECRET=tu_client_secret")
        print("")
        print("        Registrate en: https://dataspace.copernicus.eu")
        sys.exit(1)

    if args.bbox_santiago:
        bbox = BBOX_SANTIAGO
        print("[+] Modo: Zona Focus (Santiago de Compostela)")
    elif args.bbox_galicia:
        bbox = BBOX_GALICIA
        print("[+] Modo: Contexto completo (Galicia)")
    else:
        print("[ERROR] Especifica --bbox-galicia o --bbox-santiago")
        sys.exit(1)

    print("[+] Autenticando con Copernicus Data Space...")
    try:
        token = get_access_token(client_id, client_secret, username, password)
        print("    [OK] Token obtenido")
    except requests.HTTPError as e:
        print(f"[ERROR] Autenticacion fallida: {e}")
        if username and password:
            print("        Verifica que COPERNICUS_USERNAME y COPERNICUS_PASSWORD sean correctos.")
        else:
            print("        Verifica que COPERNICUS_CLIENT_ID y COPERNICUS_CLIENT_SECRET sean correctos.")
        sys.exit(1)

    print("[+] Buscando tiles DEM...")
    products = []
    collections_to_try = [args.collection] + [c for c in DEM_COLLECTION_ALTERNATIVES if c != args.collection]

    for collection in collections_to_try:
        try:
            products = search_dem(token, collection, bbox)
            if products:
                print(f"    [OK] Coleccion exitosa: {collection}")
                break
        except requests.HTTPError as e:
            if e.response.status_code == 400:
                print(f"    [!] Coleccion '{collection}' no valida, probando alternativa...")
                continue
            raise

    if not products and not args.collection:
        print(f"[ERROR] Ninguna coleccion valida encontrada.")
        print(f"        Probado: {collections_to_try}")
        sys.exit(1)

    print(f"[+] Encontrados {len(products)} tiles")
    if not products:
        print("[!] Ningun tile encontrado para el area seleccionada.")
        print("    Verifica el bounding box y la coleccion DEM.")
        sys.exit(0)

    print("\n  Tiles a descargar:")
    for i, p in enumerate(products[:20], 1):
        name = p.get('Name', 'N/A')
        size = p.get('ContentLength', 0)
        size_mb = size / 1024 / 1024 if size else '?' 
        print(f"    {i}. {name} ({size_mb} MB)")
    if len(products) > 20:
        print(f"    ... y {len(products) - 20} mas")

    if sys.stdin.isatty():
        total_est = sum(p.get('ContentLength', 0) for p in products) / 1024 / 1024
        print(f"\n  Total estimado: {total_est:.0f} MB")
        confirm = input("  Proceder con la descarga? [Y/n]: ").strip().lower()
        if confirm and confirm not in ('y', 'yes', 's', 'si'):
            print("  Cancelado por el usuario.")
            sys.exit(0)

    print("\n[+] Iniciando descargas...")
    success = 0
    failed = 0
    for product in products:
        product_id = product['Id']
        name = product.get('Name', product_id)
        try:
            download_product(token, product_id, name, args.output)
            success += 1
        except requests.HTTPError as e:
            if e.response.status_code == 401:
                print(f"    [ERROR] {name}: Acceso no autorizado (401)")
                print(f"            El token no tiene permisos para descargar este producto.")
                print(f"            Para datos Copernicus Contributing Missions (DEM), necesitas:")
                print(f"            1. Activar 'Contributing Missions access' en tu perfil CDSE:")
                print(f"               https://dataspace.copernicus.eu/profile")
                print(f"            2. O usar credenciales Client Credentials de Sentinel Hub")
            else:
                print(f"    [ERROR] {name}: {e}")
            failed += 1
            time.sleep(5)
        except Exception as e:
            print(f"    [ERROR] {name}: {e}")
            failed += 1
            time.sleep(5)

    print(f"\n[OK] Pipeline completado: {success} exitosos, {failed} fallidos")
    print(f"     Archivos en: {args.output}")

    if failed > 0:
        print("     Reintentar con: python3 download_copernicus.py [mismos argumentos]")
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
