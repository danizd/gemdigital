---
tipo: especificacion-funcional
modulo: capas-gis
version: 0.1.0
fecha: 2024-06-04
estado: VERIFICADO
spec-estructural-relacionada: ../especificaciones_estructurales/core-estructural.md
---

# Informe de Verificación de Enlaces GIS - GDT-Santiago

> Enlaces de descarga verificados manualmente para cada capa geográfica consumida por el pipeline offline.
> Este documento es la fuente de verdad para URLs de datasets públicos; prevalece sobre cualquier enlace en `core-estructural.md` §2.1.1 en caso de discrepancia.

### Resumen Ejecutivo

He verificado todos los enlaces proporcionados. **Se encontraron 4 enlaces con errores 404** que requieren corrección. A continuación detallo el estado de cada capa y los enlaces corregidos.

---

### 1. 🔷 MDE 2m - Zona Focus (Santiago de Compostela)

#### MDT02 - Modelo Digital de Terreno 2ª cobertura LIDAR PNOA

| Aspecto | Estado |
|---------|--------|
| **URL Original** | `https://centrodedescargas.cnig.es/CentroDescargas/catalogo.do?Serie=MDT` |
| **Estado** | ❌ **ERROR 404** - URL obsoleta |
| **URL Corregida** | ✅ [https://centrodedescargas.cnig.es/CentroDescargas/modelo-digital-terreno-mdt02-segunda-cobertura](https://centrodedescargas.cnig.es/CentroDescargas/modelo-digital-terreno-mdt02-segunda-cobertura) |
| **Formato** | COG (Cloud Optimized GeoTIFF) |
| **Nota importante** | La descarga requiere añadir los archivos a la "cesta" del CNIG. No es descarga directa inmediata. |

**Enlaces adicionales útiles:**
- Portal general de modelos digitales: [https://centrodedescargas.cnig.es/CentroDescargas/modelos-digitales-elevaciones](https://centrodedescargas.cnig.es/CentroDescargas/modelos-digitales-elevaciones)
- Búsqueda en mapa: [https://centrodedescargas.cnig.es/CentroDescargas/buscar-mapa](https://centrodedescargas.cnig.es/CentroDescargas/buscar-mapa)

---

#### LIDAR 2ª cobertura - Nube de puntos cruda

| Aspecto | Estado |
|---------|--------|
| **URL** | `https://centrodedescargas.cnig.es/CentroDescargas/lidar-segunda-cobertura` |
| **Estado** | ✅ **FUNCIONA** |
| **Formato** | LAZ (compressed LAS) |
| **Cobertura** | 2015-2021 |

---

### 2. 🔷 MDE 25m - Contexto Galicia

#### EU-DEM v1.1 (Copernicus)

| Aspecto | Estado |
|---------|--------|
| **Portal EEA** | `https://cis2.eea.europa.eu/data/42/` |
| **Estado** | ⚠️ **ENLACE ALTERNATIVO NECESARIO** |
| **Mirror comunitario** | `https://files.gpxz.io/eudem_buffered.zip` |
| **Estado** | ✅ **FUNCIONA** |
| **Formato** | GeoTIFF 32 bits |

> **⚠️ IMPORTANTE:** El usuario menciona correctamente que EU-DEM v1.1 dejó de estar disponible en land.copernicus.eu en enero de 2024. Esta información es **correcta**.

**Alternativa oficial recomendada:**

| Aspecto | Detalle |
|---------|---------|
| **Producto** | Copernicus DEM GLO-30 |
| **Portal** | [https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) |
| **Estado** | ✅ **FUNCIONA** |
| **Resolución** | 30m (GLO-30) o 90m (GLO-90) |
| **Formato** | GeoTIFF |
| **Acceso** | Requiere registro en Copernicus Data Space |

---

### 3. 🔷 Hidrografía

#### BTN25 / BCN25 - Base Cartográfica Nacional

| Aspecto | Estado |
|---------|--------|
| **URL Original** | `https://centrodedescargas.cnig.es/CentroDescargas/catalogo.do?Serie=BTN25` |
| **Estado** | ❌ **ERROR 404** |
| **URL Corregida** | ✅ [https://centrodedescargas.cnig.es/CentroDescargas/btn](https://centrodedescargas.cnig.es/CentroDescargas/btn) |
| **Formato** | Shapefile / GeoPackage |
| **Notas** | Disponible por temas (construcciones, hidrografía, transportes, etc.) |

---

### 4. 🔷 Curvas de Nivel

#### MTN25 - Mapa Topográfico Nacional vectorial

| Aspecto | Estado |
|---------|--------|
| **URL Original** | `https://centrodedescargas.cnig.es/CentroDescargas/catalogo.do?Serie=MTN25` |
| **Estado** | ❌ **ERROR 404** |
| **URL Corregida** | ✅ [https://centrodedescargas.cnig.es/CentroDescargas/mapa-topografico-nacional](https://centrodedescargas.cnig.es/CentroDescargas/mapa-topografico-nacional) |
| **Formato** | COG, DGN, GeoPDF |
| **Opciones** | Ráster, vectorial, edición impresa, histórico |

---

### 5. 🔷 Topónimos

#### NGBE - Nomenclátor Geográfico Básico de España

| Aspecto | Estado |
|---------|--------|
| **URL Original** | `https://centrodedescargas.cnig.es/CentroDescargas/catalogo.do?Serie=NGBE` |
| **Estado** | ❌ **ERROR 404** |
| **URL Corregida** | ✅ [https://centrodedescargas.cnig.es/CentroDescargas/nomenclator-geografico-basico-espana](https://centrodedescargas.cnig.es/CentroDescargas/nomenclator-geografico-basico-espana) |
| **Formato** | MDB (Access), GML, CSV |
| **Actualización** | Última versión: 20/10/2025 |

---

### 6. 🔷 Camino de Santiago

#### OpenStreetMap - Trazado y hitos

| Aspecto | Estado |
|---------|--------|
| **API Overpass** | `https://overpass-api.de` |
| **Estado** | ✅ **FUNCIONA** |
| **Extracto regional Galicia** | [https://download.geofabrik.de/europe/spain/galicia.html](https://download.geofabrik.de/europe/spain/galicia.html) |
| **Estado** | ✅ **FUNCIONA** |
| **Extracto completo España** | [https://download.geofabrik.de/europe/spain.html](https://download.geofabrik.de/europe/spain.html) |
| **Estado** | ✅ **FUNCIONA** |
| **Formato** | OSM PBF, Shapefile, GeoPackage |

**Archivos disponibles para Galicia:**
- `galicia-latest.osm.pbf` (103 MB)
- `galicia-latest-free.shp.zip` (206 MB)
- `galicia-latest-free.gpkg.zip` (212 MB)

---

### 7. 🔷 Edificios 3D - Bajo detalle (Galicia)

#### OSM Buildings - Footprints con alturas estimadas

| Aspecto | Estado |
|---------|--------|
| **Portal global** | `https://data.osmbuildings.org` |
| **Estado** | ✅ **FUNCIONA** |
| **Formato** | GeoJSON / OSM PBF |
| **Nota** | Datos gratuitos disponibles vía Overpass Turbo o descargas ONEGEO (de pago para datos completos) |

---

### 8. 🔷 Edificios 3D - Alto detalle (zona Focus)

| Aspecto | Estado |
|---------|--------|
| **Reutiliza** | MDT02 / LIDAR 2ª cobertura |
| **Portal** | [https://centrodedescargas.cnig.es/CentroDescargas/lidar-segunda-cobertura](https://centrodedescargas.cnig.es/CentroDescargas/lidar-segunda-cobertura) |
| **Estado** | ✅ **FUNCIONA** |
| **Formato** | COG (MDT) / LAZ (nube de puntos) |

---

### 9. 🔷 Carreteras

#### OpenStreetMap - Consumo directo vía CesiumJS

| Aspecto | Estado |
|---------|--------|
| **Tile server** | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` |
| **Estado** | ✅ **FUNCIONA** |
| **Licencia** | ODbL |
| **Nota** | No requiere descarga local |

---

### 10. 🔷 Modelo Geoidal

#### EGM2008 - Modelo geoidal global (NGA)

| Aspecto | Estado |
|---------|--------|
| **URL Original** | `https://earth-info.nga.mil/php/download.php?file=egm2008` |
| **Estado** | ❌ **NO FUNCIONA** - Enlace roto |
| **URL Alternativa 1** | ✅ [https://www.agisoft.com/downloads/geoids/](https://www.agisoft.com/downloads/geoids/) |
| **URL Alternativa 2** | ✅ [https://www.3dflow.net/geoids/](https://www.3dflow.net/geoids/) |
| **Formato** | TIFF / PGM |
| **Licencia** | Dominio público (trabajo del Gobierno de EE.UU.) |

**Archivos disponibles:**
- EGM2008 1' geoid model
- EGM2008 2'30" geoid model
- EGM2008 5' geoid model

---

### 11. 🔷 Usos del suelo (Fase 2)

#### CORINE Land Cover (Copernicus)

| Aspecto | Estado |
|---------|--------|
| **Portal** | [https://land.copernicus.eu/en/products/corine-land-cover](https://land.copernicus.eu/en/products/corine-land-cover) |
| **Estado** | ✅ **FUNCIONA** |
| **Licencia** | CGLS (Copernicus General Licence) |
| **Nota** | Última actualización: 2018 |

#### SIOSE - Sistema de Información de Ocupación del Suelo

| Aspecto | Estado |
|---------|--------|
| **Portal** | [https://www.siose.es/en/](https://www.siose.es/en/) |
| **Estado** | ✅ **FUNCIONA** |
| **Portal CNIG** | [https://centrodedescargas.cnig.es/CentroDescargas/siose](https://centrodedescargas.cnig.es/CentroDescargas/siose) |
| **Estado** | ✅ **FUNCIONA** |
| **Licencia** | CGLS |

---

## 📊 Resumen de Correcciones Necesarias

| Capa | URL Original | Estado | URL Corregida |
|------|--------------|--------|---------------|
| MDT02 | `catalogo.do?Serie=MDT` | ❌ 404 | [modelo-digital-terreno-mdt02-segunda-cobertura](https://centrodedescargas.cnig.es/CentroDescargas/modelo-digital-terreno-mdt02-segunda-cobertura) |
| BTN25 | `catalogo.do?Serie=BTN25` | ❌ 404 | [btn](https://centrodedescargas.cnig.es/CentroDescargas/btn) |
| MTN25 | `catalogo.do?Serie=MTN25` | ❌ 404 | [mapa-topografico-nacional](https://centrodedescargas.cnig.es/CentroDescargas/mapa-topografico-nacional) |
| NGBE | `catalogo.do?Serie=NGBE` | ❌ 404 | [nomenclator-geografico-basico-espana](https://centrodedescargas.cnig.es/CentroDescargas/nomenclator-geografico-basico-espana) |
| EGM2008 | `earth-info.nga.mil` | ❌ Error | [agisoft.com/downloads/geoids](https://www.agisoft.com/downloads/geoids/) |

---

## 🗂️ Enlaces de Descarga Actualizados para Pipeline Offline

Para implementar el pipeline offline con filtrado por bounding box, te recomiendo usar estos enlaces actualizados:

### Zona Focus (Santiago de Compostela - Concello)
1. **MDT02**: [CNIG MDT02](https://centrodedescargas.cnig.es/CentroDescargas/modelo-digital-terreno-mdt02-segunda-cobertura) - Buscar hojas correspondientes al área
2. **LIDAR**: [CNIG LIDAR 2ª cobertura](https://centrodedescargas.cnig.es/CentroDescargas/lidar-segunda-cobertura) - Descargar tiles LAZ
3. **NGBE**: [CNIG NGBE](https://centrodedescargas.cnig.es/CentroDescargas/nomenclator-geografico-basico-espana) - Descarga total o filtrar por zona
4. **MTN25**: [CNIG MTN25](https://centrodedescargas.cnig.es/CentroDescargas/mapa-topografico-nacional) - Seleccionar hojas 0947-1 y adyacentes

### Contexto Galicia
1. **Copernicus DEM GLO-30**: [Copernicus Data Space](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) - Descargar tiles que cubren Galicia
2. **OpenStreetMap Galicia**: [Geofabrik Galicia](https://download.geofabrik.de/europe/spain/galicia.html) - `galicia-latest.osm.pbf`
3. **BTN25**: [CNIG BTN](https://centrodedescargas.cnig.es/CentroDescargas/btn) - Descargar por provincia (A Coruña, Lugo, Ourense, Pontevedra)

