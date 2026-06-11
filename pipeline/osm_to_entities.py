#!/usr/bin/env python3
"""
HITO 2B — Fase A: Extraccion OSM → JSON para Cesium.Entity (extrudedHeight).

Entrada:
    data/raw/osm/buildings_santiago.json (Overpass API)

Salida:
    public/data/buildings.json

Requisitos:
    Python 3.10+ (solo stdlib)
"""
import json
import re
from pathlib import Path

# Rutas
PROJECT_ROOT = Path(__file__).parent.parent
INPUT_FILE = PROJECT_ROOT / "data" / "raw" / "osm" / "buildings_santiago.json"
OUTPUT_FILE = PROJECT_ROOT / "public" / "data" / "buildings.json"

# Configuracion
FALLBACK_HEIGHT = 10.0  # m — altura tipica casco antiguo
LEVELS_HEIGHT_M = 3.5   # m por planta


def parse_height(tag_value: str) -> float | None:
    """Extrae un numero en metros de un tag OSM como '15', '12.5m', '8 m', etc."""
    if not tag_value:
        return None
    # Buscar numero al inicio (entero o decimal), opcionalmente seguido de unidades
    match = re.match(r"^\s*([0-9]+(?:\.[0-9]+)?)", tag_value.replace(",", "."))
    if match:
        return float(match.group(1))
    return None


def compute_height(tags: dict) -> float:
    """Deriva la altura de un edificio a partir de los tags OSM."""
    # Prioridad 1: building:levels
    levels_str = tags.get("building:levels")
    if levels_str is not None:
        try:
            levels = int(levels_str)
            return levels * LEVELS_HEIGHT_M
        except ValueError:
            pass

    # Prioridad 2: height explicito
    height_str = tags.get("height")
    if height_str is not None:
        parsed = parse_height(height_str)
        if parsed is not None:
            return parsed

    # Fallback
    return FALLBACK_HEIGHT


def load_osm_buildings(path: Path) -> list[dict]:
    """Parsea el JSON de Overpass y devuelve lista de edificios con geometria.

    Overpass devuelve nodos como elementos separados de tipo 'node' con lat/lon,
    y las ways referencian los nodos por ID. Debemos indexar nodos primero.
    """
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    # Indexar todos los nodos por ID
    node_index = {}
    for element in data.get("elements", []):
        if element["type"] == "node":
            node_index[element["id"]] = (element["lon"], element["lat"])

    buildings = []
    for element in data.get("elements", []):
        if element["type"] not in ("way", "relation"):
            continue

        tags = element.get("tags", {})
        if "building" not in tags:
            continue

        node_ids = element.get("nodes", [])
        if len(node_ids) < 3:
            continue

        # Resolver coordenadas [lon, lat]
        positions = []
        valid = True
        for nid in node_ids:
            if nid not in node_index:
                valid = False
                break
            lon, lat = node_index[nid]
            positions.append([lon, lat])

        if not valid or len(positions) < 3:
            continue

        height = compute_height(tags)
        name = tags.get("name")

        building = {
            "id": element.get("id"),
            "height": round(height, 2),
            "positions": positions,
        }
        if name:
            building["name"] = name

        buildings.append(building)

    return buildings


def main() -> int:
    print("=" * 60)
    print("HITO 2B — Fase A: OSM → Cesium.Entity JSON")
    print("=" * 60)

    if not INPUT_FILE.exists():
        print(f"[ERROR] No existe {INPUT_FILE}")
        return 1

    # 1. Cargar edificios
    print(f"[+] Cargando edificios desde {INPUT_FILE}...")
    buildings = load_osm_buildings(INPUT_FILE)
    print(f"    Encontrados {len(buildings)} edificios")

    # Estadisticas de altura
    heights = [b["height"] for b in buildings]
    if heights:
        print(f"    Alturas — min: {min(heights):.1f}m, max: {max(heights):.1f}m, "
              f"media: {sum(heights) / len(heights):.1f}m")

    # 2. Guardar salida
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(buildings, f, indent=2, ensure_ascii=False)

    print(f"[OK] Salida generada: {OUTPUT_FILE}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
