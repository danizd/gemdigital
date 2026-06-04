---
tipo: especificacion-estructural
modulo: core
version: 0.1.0
fecha: 2024-06-04
estado: BORRADOR
origen-adrs: [ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005]
spec-funcional-relacionada: ../especificaciones_funcionales/core-funcional.md
---

# Especificación Estructural — Core del GDT-Santiago

## 1. Propósito y Alcance

Esta especificación define la arquitectura técnica, decisiones de despliegue, stack tecnológico y restricciones de infraestructura del Gemelo Digital Topográfico de Santiago.

**Dentro del alcance:**
- Arquitectura de despliegue (monolítico, dockerizado)
- Stack de renderizado y tecnologías frontend
- Estrategia de tiles y cache
- Pipeline de procesamiento de datos
- Sistemas de referencia espacial
- Flujo de despliegue operativo

**Fuera del alcance:**
- Definición de entidades del dominio geográfico (ver spec funcional)
- Casos de uso de usuario final (ver spec funcional)
- Reglas de negocio cartográficas (ver spec funcional)

---

## 2. Dependencias y Fronteras

### 2.1 Dependencias upstream (este módulo consume)

| Módulo / Servicio | Qué consume | Contrato / Referencia |
|---|---|---|
| Oracle Cloud Infrastructure | VM Free Tier (24 GB RAM, ARM Ampere A1, 4 OCPU, 200 GB) | Contrato de servicio cloud |
| Let's Encrypt | Certificados TLS vía ACME | Protocolo ACME v2 |
| IGN / CNIG | Datos cartográficos oficiales (PNOA, MTN25, BTN25) | Licencias abiertas |
| Copernicus | MDE EUDEM 25m | Licencia abiertas EU |
| OpenStreetMap | Datos vectoriales (carreteras, edificios, Camino) | ODbL |
| CesiumJS | Motor de renderizado 3D | Apache 2.0 |

#### 2.1.1 Orígenes de descarga de capas geográficas

Direcciones concretas de descarga para cada capa consumida por el pipeline offline. Todas las fuentes cumplen RN-001 (licencias abiertas). La selección concreta de tiles/hojas dentro de cada catálogo se hace por bounding box en el script de ingesta.

| Capa | Producto / Serie | Portal de descarga | Formato | Licencia |
|---|---|---|---|---|
| MDE 2 m Focus | **MDT02** (MDT 2ª cobertura LIDAR PNOA) | https://centrodedescargas.cnig.es/CentroDescargas/modelo-digital-terreno-mdt02-segunda-cobertura | COG (Cloud Optimized GeoTIFF) | CC-BY 4.0 IGN |
| MDE 2 m Focus (alternativa) | LIDAR 2ª cobertura (nube de puntos cruda) | https://centrodedescargas.cnig.es/CentroDescargas/lidar-segunda-cobertura | LAZ | CC-BY 4.0 IGN |
| MDE 25 m Contexto | EU-DEM v1.1 (Copernicus) | https://cis2.eea.europa.eu/data/42/ · mirror: https://files.gpxz.io/eudem_buffered.zip | GeoTIFF 32 bits | Copernicus (libre con atribución) — **ver alerta §2.1.1.1** |
| Hidrografía | BTN25 (antes BCN25) | https://centrodedescargas.cnig.es/CentroDescargas/catalogo (filtro serie `BTN25`) | Shapefile / GML | CC-BY 4.0 IGN |
| Curvas de nivel | MTN25 vectorial | https://centrodedescargas.cnig.es/CentroDescargas/catalogo (filtro serie `MTN25`) | Shapefile / GML | CC-BY 4.0 IGN |
| Topónimos | NGBE (Nomenclátor Geográfico Básico de España) | https://centrodedescargas.cnig.es/CentroDescargas/catalogo (filtro serie `NGBE`) | Shapefile | CC-BY 4.0 IGN |
| Edificios 3D alto detalle | MDT02 / LIDAR 2ª cobertura (reutilizado del Focus) | (mismo que MDE 2 m Focus) | COG / LAZ | CC-BY 4.0 IGN |
| Edificios 3D bajo detalle | OSM Buildings (footprints extruidos) | https://data.osmbuildings.org (Global) | GeoJSON / OSM PBF | ODbL |
| Camino de Santiago (trazado + hitos) | OpenStreetMap (Overpass: `route=camino_de_santiago`) | https://overpass-api.de · extracto regional: https://download.geofabrik.de/europe/spain.html | OSM PBF | ODbL |
| Carreteras | OpenStreetMap (consumido vía `OpenStreetMapImageryProvider`) | No requiere descarga local; tile server: https://tile.openstreetmap.org | Raster XYZ | ODbL |
| Modelo geoidal (conversión altitudes Alicante → WGS84) | EGM2008 | https://earth-info.nga.mil/php/download.php?file=egm2008 | World Geoid binario (.pgm) | Dominio público (NGA) |

> **Fuente verificada de enlaces:** Los enlaces anteriores son los originales del catálogo. Para las **URLs corregidas y verificadas** (algunos enlaces del catálogo CNIG devuelven 404), consultar `documentacion/especificaciones_funcionales/capas-gis.md`, que contiene los enlaces actualizados tras verificación manual junto con mirrors alternativos.

##### 2.1.1.1 Alerta: deprecación de EU-DEM v1.1

> El producto EU-DEM v1.1 (25 m) dejó de estar disponible en `land.copernicus.eu` en enero de 2024. La fuente operativa actual es el portal CIS2 de la EEA o el mirror mantenido por la comunidad (Open Topo Data). Si la accesibilidad del mirror falla, evaluar como reemplazo el **Copernicus DEM (COP-DEM) GLO-30** a 30 m (https://dataspace.copernicus.eu), sucesor oficial pero con resolución algo distinta a la declarada en la spec. Cualquier cambio de fuente DEBE documentarse en `CONTEXT.md` y en ADR-0002.

### 2.2 Dependencias downstream (este módulo produce)

| Módulo / Servicio | Qué produce | Contrato / Referencia |
|---|---|---|
| Cliente web | Tiles Quantized Mesh, 3D Tiles, MVT | URLs versionadas `/tiles/vN/{tipo}/{z}/{x}/{y}` |
| Navegador usuario | JavaScript bundle (SPA Vite+TypeScript) | Estructura estática servida por nginx |

### 2.3 Contratos que NO DEBEN romperse

- **Estructura de URL de tiles**: `/tiles/v{N}/{tipo}/{z}/{x}/{y}.{ext}` donde `N` es versión, `tipo` ∈ {terrain, 3dtiles, vector, imagery}
- **Headers HTTP cache**: Todos los tiles DEBEN incluir `Cache-Control: public, max-age=31536000, immutable`
- **Sistema de coordenadas**: Todos los datos espaciales DEBEN usar ETRS89 horizontal + WGS84 elipsoidal vertical
- **API interna nginx→pg_tileserv**: No expuesta públicamente; solo accesible desde red Docker interna

---

## 3. Decisiones de Arquitectura

### 3.1 Render stack: CesiumJS sobre navegador → ADR-0001

**Decisión:** El GDT-Santiago se renderiza íntegramente en el navegador del usuario con CesiumJS.

**Razón:** CesiumJS ofrece soporte nativo de Quantized Mesh y 3D Tiles, atmósfera/fábrica, y es cliente web puro. Alternativas como Three.js requerirían reimplementar proyecciones geográficas, LOD y streaming; motores de juego romperían la regla "cliente web".

**Trade-offs aceptados:**
- ✅ Server-side rendering coste cero en backend
- ✅ Soporte nativo de formatos óptimos para streaming
- ⚠️ Dependencia fuerte de CesiumJS; cambiar de motor implicaría reescribir todo el cliente
- ⚠️ Preprocesamiento obligatorio: MDE y assets deben convertirse a formatos Cesium antes de publicar

**Referencia completa:** `docs/adr/0001-render-stack-cesiumjs.md`

### 3.2 Cobertura: Focus + Contexto → ADR-0002

**Decisión:** Dos niveles de cobertura geográfica: Focus (Santiago a 2m LIDAR) y Contexto (Galicia a 25m EUDEM).

**Razón:** Optimizar entre calidad visual en zona de interés y capacidad de exploración regional. El usuario percibe calidad de detalle donde mira (Santiago) sin requerir tiles de alta resolución para toda Galicia.

**Trade-offs aceptados:**
- ✅ Experiencia "épica" en zona de interés
- ✅ Navegación contextual sin saltos bruscos
- ⚠️ Complejidad de gestión de dos datasets con diferentes características
- ⚠️ Frontera visual potencialmente visible si los MDE no se alinean perfectamente

**Referencia completa:** `docs/adr/0002-cobertura-focus-contexto.md`

### 3.3 Despliegue: Docker + NPM en monolito → ADR-0003

**Decisión:** Despliegue monolítico en servidor único (Oracle Free Tier) con contenedores Docker orquestados por docker-compose, incluyendo nginx proxy manager para TLS.

**Razón:** Simplicidad operativa para Fase 1. No se requiere alta disponibilidad ni escalabilidad horizontal; el objetivo es demostración funcional, no producción enterprise.

**Trade-offs aceptados:**
- ✅ Despliegue reproducible en cualquier máquina con Docker
- ✅ Un único punto de configuración
- ⚠️ Punto único de fallo (único servidor)
- ⚠️ Escalabilidad limitada a recursos de la VM (24 GB RAM / 200 GB disco)

**Referencia completa:** `docs/adr/0003-despliegue-docker-npm.md`

### 3.4 Sistema de referencia: ETRS89 + EGM2008 → ADR-0004

**Decisión:** Coordenadas horizontales ETRS89 (sin reproyección desde cartografía española), alturas elipsoidales WGS84 (convertidas desde ortométricas vía EGM2008).

**Razón:** ETRS89 es el sistema oficial español; la diferencia con WGS84 en Galicia es sub-métrica. Las alturas elipsoidales son requeridas por CesiumJS; usar ortométricas causaría desplazamientos de ~50m.

**Trade-offs aceptados:**
- ✅ Consistencia con cartografía oficial española
- ✅ Precisión geoidal ~10 cm con modelo libre (EGM2008)
- ⚠️ Pipeline offline obligatorio para conversión de alturas
- ⚠️ Dependencia de modelo geoidal global (EGM2008 ~10 MB)

**Referencia completa:** `docs/adr/0004-sistema-referencia-etrs89-egm2008.md`

### 3.5 Carreteras: OSM Imagery vs Vector Tiles → ADR-0005

**Decisión:** Las carreteras se pintan mediante `OpenStreetMapImageryProvider` de CesiumJS (tiles raster) en lugar de vector tiles desde PostGIS.

**Razón:** Satisfacer requisito visual inmediato con cero trabajo de pipeline adicional para Fase 1. La alternativa vector requería ~2-3 semanas adicionales.

**Trade-offs aceptados:**
- ✅ Implementación inmediata, cero coste de pipeline
- ✅ Visual equivalente para "primera vista épica"
- ⚠️ No interacción posible (hover, click, atributos)
- ⚠️ Deuda técnica: migración a vector tiles en Fase 2 si se requiere interacción

**Referencia completa:** `docs/adr/0005-carreteras-osm-imagery.md`

---

## 4. Restricciones Técnicas

| Restricción | Valor | Origen | Consecuencia de violar |
|---|---|---|---|
| Almacenamiento máximo | 200 GB | Oracle Free Tier | Tiles no caben; degradación de cobertura o resolución |
| RAM máxima | 24 GB | Oracle Free Tier | OOM en PostGIS o pg_tileserv; caída de servicios |
| VCPU máximos | 4 OCPU | Oracle Free Tier | Latencia en generación de tiles dinámicos (no usado en Fase 1) |
| Cache tiles | 1 año immutable | Decisión arquitectura | Correcciones requieren nueva versión completa |
| Tiempo carga Fase 1 | < 5 segundos @ 10 Mbps | Requisito Fase 1 | Rechazo del director si no se cumple |
| FPS mínimo Fase 1 | 30 FPS @ 2km Catedral | Requisito Fase 1 | Percepción de lentitud; rechazo potencial |

---

## 5. Patrones de Implementación

### 5.1 Patrón: Pipeline Offline

**Cuándo aplicar:** Todos los tiles de terreno, 3D, vector deben pregenerarse antes de desplegar.

**Cómo aplicar:**
1. Ejecutar scripts de procesamiento en WSL2 local (Windows)
2. Generar tiles en formato Cesium (Quantized Mesh, 3D Tiles, MVT)
3. Aplicar conversión EGM2008 a alturas si es necesario
4. Sincronizar vía `rsync` al servidor Oracle en `/data/gdt/tiles/v{N}/`
5. Actualizar configuración cliente para apuntar a nueva versión

**Cuándo NO aplicar:** Nunca se generan tiles en runtime en el servidor Oracle. El servidor solo sirve archivos estáticos.

### 5.2 Patrón: Versionado de Tiles

**Cuándo aplicar:** Cuando se publica una nueva generación de tiles (correcciones, mejoras, ampliación de cobertura).

**Cómo aplicar:**
1. Generar nuevos tiles en directorio `v{N+1}` paralelo a `v{N}`
2. Verificar calidad en local
3. Subir a servidor manteniendo `v{N}` operativo
4. Cambiar configuración cliente de `v{N}` a `v{N+1}`
5. (Opcional) Eliminar `v{N}` tras periodo de gracia

**Cuándo NO aplicar:** No se modifica contenido de `v{N}` tras publicar; `immutable` cache headers lo impiden.

### 5.3 Patrón: Despliegue Manual

**Cuándo aplicar:** Actualizaciones de código, configuración o datos en servidor Oracle.

**Cómo aplicar:**
1. `git pull` en repositorio del servidor
2. `rsync` de tiles desde local si hay nuevos
3. `docker-compose up -d` para recrear contenedores
4. Verificar en `gemelo.movilab.es`

**Cuándo NO aplicar:** No hay rollback automático; si falla, operador debe ejecutar `docker-compose down` y revertir manualmente.

---

## 6. Historial de Cambios

| Versión | Fecha | Cambio | Aprobado por |
|---|---|---|---|
| 0.1.0 | 2024-06-04 | Creación inicial | sixtema-sdd |
