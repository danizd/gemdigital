#!/usr/bin/env python3
"""
Extrae los archivos ZIP descargados de Copernicus DEM.
"""
import os
import sys
import zipfile
from pathlib import Path

# Directorio donde se descargaron los ZIP
DEFAULT_INPUT = Path(__file__).parent.parent / "data" / "raw" / "copernicus"
DEFAULT_OUTPUT = Path(__file__).parent.parent / "data" / "raw" / "copernicus" / "extracted"


def extract_zip(zip_path: Path, output_dir: Path) -> bool:
    """Extrae un archivo ZIP al directorio especificado."""
    try:
        # Crear subdirectorio con el nombre del ZIP (sin extensión)
        extract_dir = output_dir / zip_path.stem
        extract_dir.mkdir(parents=True, exist_ok=True)

        print(f"  Extrayendo: {zip_path.name}")

        with zipfile.ZipFile(zip_path, 'r') as zf:
            file_count = 0
            for member in zf.namelist():
                # Ignorar directorios y archivos de metadados XML
                if member.endswith('/'):
                    continue
                if member.endswith('.xml') or member.endswith('.xsd'):
                    continue

                try:
                    # Nombre corto: reemplazar separadores de ruta por guiones bajos
                    short_name = member.replace('/', '_').replace('\\', '_')
                    # Eliminar prefijos redundantes
                    if short_name.startswith('_'):
                        short_name = short_name[1:]

                    target_path = extract_dir / short_name

                    # Extraer el contenido
                    with zf.open(member) as source:
                        with open(target_path, 'wb') as target:
                            target.write(source.read())
                    file_count += 1

                except (OSError, FileNotFoundError) as e:
                    print(f"      [AVISO] No se pudo extraer {member}: {e}")
                    continue

        print(f"    [OK] {file_count} archivos extraídos")
        return file_count > 0

    except Exception as e:
        print(f"    [ERROR] {zip_path.name}: {e}")
        return False


def main():
    input_dir = DEFAULT_INPUT
    output_dir = DEFAULT_OUTPUT

    # Buscar archivos ZIP
    zip_files = sorted(input_dir.glob("*.zip"))

    if not zip_files:
        print(f"[ERROR] No se encontraron archivos ZIP en: {input_dir}")
        sys.exit(1)

    print(f"[+] Encontrados {len(zip_files)} archivos ZIP")
    print(f"    Directorio: {input_dir}")
    print(f"    Destino: {output_dir}")
    print()

    success = 0
    failed = 0

    for zip_path in zip_files:
        if extract_zip(zip_path, output_dir):
            success += 1
        else:
            failed += 1

    print()
    print(f"[OK] Extracción completada: {success} exitosos, {failed} fallidos")
    print(f"     Archivos en: {output_dir}")

    # Listar subdirectorios creados
    if output_dir.exists():
        subdirs = [d.name for d in output_dir.iterdir() if d.is_dir()]
        if subdirs:
            print(f"\n  Directorios creados:")
            for name in sorted(subdirs)[:10]:
                print(f"    - {name}")
            if len(subdirs) > 10:
                print(f"    ... y {len(subdirs) - 10} más")

    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
