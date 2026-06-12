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

# Altura representativa por tipo de edificio (building=*) cuando OSM no aporta
# height ni building:levels. Edificios monumentales del casco antiguo cuyo
# volumen real supera con creces el fallback generico de 10 m. La catedral se
# aproxima a la cota de sus torres del Obradoiro (~75 m) para que destaque como
# ancla visual; el resto a la cubierta de su cuerpo principal.
HEIGHT_BY_BUILDING_TYPE = {
    "cathedral": 75.0,
    "church": 18.0,
    "chapel": 12.0,
}


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

    # Prioridad 3: altura representativa segun el tipo de edificio
    type_height = HEIGHT_BY_BUILDING_TYPE.get(tags.get("building"))
    if type_height is not None:
        return type_height

    # Fallback
    return FALLBACK_HEIGHT


def resolve_ring(node_ids: list[int], node_index: dict) -> list[list[float]] | None:
    """Convierte una lista de IDs de nodo en un anillo de coordenadas [lon, lat].

    Devuelve None si algun nodo no esta indexado o el anillo no tiene al menos
    3 vertices (poligono degenerado).
    """
    positions: list[list[float]] = []
    for nid in node_ids:
        if nid not in node_index:
            return None
        lon, lat = node_index[nid]
        positions.append([lon, lat])

    if len(positions) < 3:
        return None
    return positions


def load_osm_buildings(path: Path) -> list[dict]:
    """Parsea el JSON de Overpass y devuelve lista de edificios con geometria.

    Overpass devuelve nodos como elementos separados de tipo 'node' con lat/lon,
    las ways referencian los nodos por ID, y las relaciones (multipolygon)
    referencian ways por ID en sus members. Indexamos nodos y ways primero.

    Se procesan dos topologias de edificio:
    - way con building=*: anillo directo desde sus nodos.
    - relation con building=* (type=multipolygon): se extrae cada miembro con
      role "outer" como un poligono independiente. Sin este caso, edificios
      mapeados como relacion (p.ej. la Catedral, relation/5386197) se perdian.
    """
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    # Indexar nodos por ID y ways por ID (para resolver geometria de relaciones)
    node_index: dict[int, tuple[float, float]] = {}
    way_index: dict[int, list[int]] = {}
    for element in data.get("elements", []):
        if element["type"] == "node":
            node_index[element["id"]] = (element["lon"], element["lat"])
        elif element["type"] == "way":
            way_index[element["id"]] = element.get("nodes", [])

    buildings: list[dict] = []
    for element in data.get("elements", []):
        element_type = element["type"]
        if element_type not in ("way", "relation"):
            continue

        tags = element.get("tags", {})
        if "building" not in tags:
            continue

        height = round(compute_height(tags), 2)
        name = tags.get("name")

        # Cada edificio puede generar uno o varios anillos (relaciones con
        # multiples outer). Se emite una entrada de edificio por anillo valido.
        rings: list[list[list[float]]] = []
        if element_type == "way":
            ring = resolve_ring(element.get("nodes", []), node_index)
            if ring is not None:
                rings.append(ring)
        else:  # relation (multipolygon)
            for member in element.get("members", []):
                if member.get("type") != "way" or member.get("role") != "outer":
                    continue
                ring = resolve_ring(way_index.get(member.get("ref"), []), node_index)
                if ring is not None:
                    rings.append(ring)

        for index, ring in enumerate(rings):
            building = {
                # Sufijo de parte para anillos multiples: id estable y unico.
                "id": element.get("id") if len(rings) == 1 else f"{element.get('id')}-{index}",
                "height": height,
                "positions": ring,
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
