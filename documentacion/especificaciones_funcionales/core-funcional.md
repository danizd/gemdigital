---
tipo: especificacion-funcional
modulo: core
version: 0.1.0
fecha: 2024-06-04
estado: BORRADOR
spec-estructural-relacionada: ../especificaciones_estructurales/core-estructural.md
---

# Especificación Funcional — Core del GDT-Santiago

## 1. Propósito de Negocio

El Gemelo Digital Topográfico de Santiago (GDT-Santiago) permite a cualquier usuario con un navegador web explorar visualmente el territorio de Santiago de Compostela y su entorno gallego con precisión cartográfica, centrado en el relieve del terreno y elementos geográficos relevantes (hidrografía, Camino de Santiago, edificios). El producto busca generar una "primera vista épica" que destaque la identidad territorial del lugar, priorizando calidad visual sobre rendimiento máximo en esta primera fase.

---

## 2. Glosario del Dominio

| Término | Definición canónica | Términos NO equivalentes |
|---|---|---|
| **GDT-Santiago** | Gemelo Digital Topográfico de Santiago de Compostela. Réplica virtual del territorio centrada en el modelado preciso del relieve, hidrografía y desniveles del terreno. Construido exclusivamente a partir de capas de datos públicas. Código abierto. | "Mapa de Santiago" (implica 2D plano); "Visor GIS" (implica herramienta profesional, no producto de consumo) |
| **Terreno** | Modelo Digital de Elevaciones (MDE/MDT) que define la superficie 3D del territorio. Es la capa base geométrica sobre la cual se drapean otras capas vectoriales. | "Relieve" (más abstracto, no incluye la precisión geométrica); "Mapa de alturas" (implica representación 2D) |
| **Focus** | Concello de Santiago y el corredor del Camino que llega a la ciudad (cabeceras del Sar, Sarela y Tambre, sierras del Leste). Se sirve con MDE 2 m LIDAR PNOA. | "Centro de Santiago" (más pequeño, urbano); "Zona de interés" (demasiado vago) |
| **Contexto** | Galicia entera. Se sirve con MDE EUDEM 25 m. | "Fondo" (implica decorativo, no funcional); "Entorno amplio" (no especifica Galicia) |
| **Épico** | Criterio estético del producto: el GDT debe ser visualmente impactante en primera vista. No se sacrifica calidad visual por rendimiento. | "Bonito" (subjetivo, no medible); "Atractivo" (más amplio, no especifica impacto visual inicial) |
| **Hidrográfica** | Ríos, regatos, embalses y masas de agua del CNIG (BTN25 / BCN25), servida como vector tiles sobre el terreno. Es una capa explícita del GDT, no se deduce únicamente del MDE. | "Aguas" (incluye mar, que no está en esta capa); "Hidrología" (estudio científico, no la capa visual) |
| **Curvas de nivel** | Líneas 2D drapeadas sobre el terreno con elevación como atributo, extraídas de la cartografía MTN25 vectorial del IGN. Es la firma visual del gemelo topográfico. | "Isohipsa" (término técnico equivalente, pero no usado en glosario); "Líneas de contorno" (más genérico) |
| **Tramo de río / regato** | Entidad lineal de la capa Hidrográfica. Atributos: `id`, `nombre`, `tipo` (río, regato, embalse), `jerarquía` (Strahler 1–5). | "Curso de agua" (no incluye la clasificación por jerarquía); "Arroyo" (solo un tipo, no el concepto genérico) |
| **Masa de agua** | Entidad poligonal de la capa Hidrográfica. Atributos: `id`, `nombre`, `tipo` (embalse, lago). | "Cuerpo de agua" (incluye ríos, que son lineales); "Superficie hídrica" (más amplio) |
| **Curva de nivel** | Entidad lineal de la capa Curvas. Atributos: `id`, `elevacion_m`, `indice` (maestra / secundaria / auxiliar). | "Línea de cotas" (equivalente técnico, no usado); "Nivel" (ambiguo: puede ser altura, no línea) |
| **Camino de Santiago** | Trazado del Camino (OSM `route=camino_de_santiago`) y sus hitos relevantes, servido como vector tile y como POIs. | "Ruta jacobeo" (más amplio, no especifica el camino histórico); "Peregrinación" (actividad, no trazado) |
| **Tramo del Camino** | Entidad lineal de la capa Camino de Santiago. Atributos: `id`, `nombre`, `etapa`, `km_desde_inicio`. | "Etapa" (solo una parte, no el tramo genérico); "Sendero" (no especifica el Camino) |
| **Hito del Camino** | Entidad puntual de la capa Camino. Atributos: `id`, `nombre`, `tipo` (albergue, iglesia, cruce, fuente), `km_desde_inicio`. | "Punto de interés" (demasiado genérico); "Monumento" (solo un tipo de hito) |
| **Topónimo** | Entidad puntual de la capa Topónimos. Atributos: `id`, `nombre`, `tipo` (parroquia, monte, río, lugar), `poblacion` cuando aplique. | "Lugar" (más coloquial, no incluye clasificación); "Nombre geográfico" (más amplio, incluye regiones) |
| **Edificios 3D (dos niveles)** | Doble capa: alto detalle (LIDAR PNOA → 3D Tiles en la zona Focus) y bajo detalle (OSM Buildings extruidos en toda Galicia). Ambas capas están cargadas simultáneamente; CesiumJS decide cuál renderizar según distancia de la cámara al edificio. | "Construcciones" (incluye infraestructura no edificios); "Modelos 3D" (demasiado genérico) |
| **Carreteras** | Red viaria pintada vía `OpenStreetMapImageryProvider` de CesiumJS. Visualización decorativa sin interacción posible. | "Vías" (incluye caminos, senderos, carreteras); "Calles" (solo urbano) |
| **Catedral como ancla visual** | La vista de apertura y el botón de recentrado de cámara apuntan siempre a la catedral de Santiago de Compostela. Es el icono que da identidad al gemelo y el punto de retorno tras cualquier navegación. | "Centro del mapa" (geométrico, no identitario); "Punto de interés principal" (más genérico) |
| **Fase 1 (demo de aprobación)** | Primera entrega del GDT-Santiago, orientada a conseguir la aprobación del director del proyecto. Optimiza para "primera vista épica" con criterios de aceptación medibles: (a) tiempo de carga inicial menor a 5 segundos en conexión 10 Mbps, (b) FPS mínimo de 30 en cámara a 2 km de la Catedral en PC estándar, (c) cobertura territorial mínima de 50 km² con resolución 2m en zona Focus. | "MVP" (no especifica el criterio de aprobación por director); "Beta" (implica versión pública, Fase 1 es interna hasta H1) |
| **Fase 2 (producción)** | Alcance completo: Focus + Contexto Galicia, edificios 3D alto detalle, coloración CORINE/SIOSE, presupuesto de rendimiento firmado. Se ejecuta tras la aprobación de la Fase 1. | "Versión final" (no implica el proceso de aprobación previo); "Lanzamiento" (demasiado genérico) |
| **Capa de datos pública** | Dataset publicado por organismo oficial (IGN, CNIG, Xunta, Concello, Copernicus, OSM, NASA, USGS…) con licencia abierta o sin restricción de uso. No se incorporarán datasets privados, comerciales o con licencia restrictiva. | "Open data" (no garantiza licencia abierta); "Datos oficiales" (no especifica licencia) |
| **Trabajo local hasta H1** | La app no se publica en `gemelo.movilab.es` hasta que el primer hito entregable (terreno Focus a 2 m sobre la catedral) esté listo. Antes de H1 todo se desarrolla en local; H0 (globo azul de CesiumJS) no se expone públicamente. | "Desarrollo privado" (no especifica el hito H1); "Pre-lanzamiento" (implica actividad pública previa) |

**Regla de uso:** Los términos definidos en este glosario DEBEN usarse con los significados exactos aquí especificados en todo documento del proyecto. Desviaciones DEBEN ser explicitadas y justificadas.

---

## 3. Actores

| Actor | Descripción | Capacidades en este módulo |
|---|---|---|
| **Usuario explorador** | Cualquier persona con acceso a un navegador web moderno y conexión a internet. Sin autenticación requerida. | Navegar el terreno 3D, zoom, rotar, inclinar cámara; ver capas de información (hidrografía, curvas, Camino); recentrar en Catedral |
| **Director del proyecto** | Responsable de aprobar la Fase 1 y autorizar recursos para Fase 2. Evalúa calidad visual y funcionalidad. | Evaluar criterios de aceptación de Fase 1; decidir aprobación/rechazo; solicitar modificaciones |
| **Operador del sistema** | Persona técnica encargada del despliegue, mantenimiento y actualización del GDT en producción. | Ejecutar despliegues manuales; sincronizar tiles; gestionar versiones; monitorizar estado |

---

## 4. Casos de Uso

### CU-001: Explorar territorio 3D

**Actor principal:** Usuario explorador
**Objetivo:** Visualizar el relieve del terreno y elementos geográficos de Santiago y Galicia

**Precondiciones:**
- El sistema DEBE estar publicado en `gemelo.movilab.es` (post-H1)
- El usuario DEBE tener un navegador web compatible con WebGL
- El usuario DEBE tener conexión a internet mínima de 10 Mbps

**Flujo principal:**
1. Usuario accede a la URL del GDT
2. Sistema carga la vista inicial centrada en la Catedral de Santiago (ancla visual)
3. Usuario ve el terreno 3D con relieve, cielo y elementos de contexto
4. Usuario navega: zoom in/out, rota, inclina cámara
5. Sistema carga dinámicamente tiles según posición y nivel de detalle
6. Usuario visualiza capas superpuestas (hidrografía, curvas de nivel, Camino) según zoom

**Flujos alternativos:**
- **FA-1** (cuando usuario hace click en botón "Centrar en Catedral"): La cámara vuelve a posición inicial sobre la Catedral con ángulo predeterminado
- **FA-2** (cuando usuario navega desde Focus hacia Contexto): Sistema transiciona automáticamente entre MDE de alta resolución (2m) y baja resolución (25m)

**Flujos de error:**
- **FE-1** (conexión lenta < 10 Mbps): Sistema DEBE mostrar indicador de carga y degradar progresivamente calidad de tiles
- **FE-2** (WebGL no disponible): Sistema DEBE mostrar mensaje "Navegador no compatible. Se requiere WebGL habilitado."
- **FE-3** (tiles no disponibles para zona): Sistema DEBE mostrar terreno genérico de Cesium y log error para operador

**Postcondiciones:**
- El usuario ha visualizado el territorio con nivel de detalle apropiado a su navegación
- Los tiles consultados están cacheados en navegador para futura navegación

---

### CU-002: Evaluar primera vista épica (Fase 1)

**Actor principal:** Director del proyecto
**Objetivo:** Determinar si el GDT cumple criterios de aceptación para aprobar Fase 1

**Precondiciones:**
- El sistema DEBE estar desplegado en entorno accesible (local o gemelo.movilab.es)
- El hito H1 DEBE estar completado (terreno Focus a 2m sobre Catedral)

**Flujo principal:**
1. Director accede al GDT con conexión de 10 Mbps
2. Director evalúa tiempo de carga inicial (< 5 segundos)
3. Director navega a vista de la Catedral a 2 km de distancia
4. Director evalúa fluidez de movimiento (FPS mínimo 30)
5. Director verifica cobertura mínima de 50 km² en zona Focus
6. Director emite veredicto de aprobación/rechazo

**Flujos de error:**
- **FE-1** (tiempo de carga > 5 segundos): Director rechaza Fase 1; equipo debe optimizar
- **FE-2** (FPS < 30): Director rechaza Fase 1; equipo debe reducir calidad o cobertura
- **FE-3** (cobertura < 50 km²): Director rechaza Fase 1; equipo debe ampliar generación de tiles

**Postcondiciones:**
- Si aprobado: Se autoriza inicio de Fase 2 (producción)
- Si rechazado: Se documentan incumplimientos y se planifican correcciones

---

## 5. Reglas de Negocio

### RN-001: Exclusividad de datos públicos

**Enunciado:** El GDT-Santiago DEBE construirse exclusivamente a partir de capas de datos públicas. No se incorporarán datasets privados, comerciales o con licencia restrictiva.

**Criterios de aceptación:**
- DADO un dataset candidato CUANDO se evalúa para inclusión ENTONCES su licencia DEBE permitir redistribución y modificación (OSI-approved o equivalente)
- DADO un dataset con licencia comercial CUANDO se propone ENTONCES el sistema DEBE rechazarlo explícitamente

**Origen:** Decisión de equipo - modelo de código abierto
**Módulos afectados:** Pipeline de ingesta, selección de fuentes de datos
**Referencia de fuentes verificadas:** `documentacion/especificaciones_funcionales/capas-gis.md` — enlaces de descarga comprobados para cada dataset público (IGN/CNIG, Copernicus, OSM, NGA).

### RN-002: Prioridad de calidad visual sobre rendimiento (Fase 1)

**Enunciado:** En Fase 1, el criterio "épico" (impacto visual en primera vista) tiene prioridad sobre la optimización máxima de rendimiento.

**Criterios de aceptación:**
- DADO un trade-off entre calidad de textura/terreno y FPS CUANDO FPS > 30 ENTONCES se mantiene calidad superior
- DADO un requisito de reducir calidad CUANDO aún se cumplen métricas mínimas ENTONCES la reducción es opcional, no obligatoria

**Origen:** Requisito de negocio - "primera vista épica"
**Módulos afectados:** Configuración de renderizado, selección de niveles de detalle

### RN-003: Cobertura mínima Fase 1

**Enunciado:** La Fase 1 DEBE incluir cobertura territorial mínima de 50 km² con resolución 2m en zona Focus.

**Criterios de aceptación:**
- DADO el despliegue de Fase 1 CUANDO se mide la extensión de tiles disponibles ENTONCES el área cubierta DEBE ser ≥ 50 km²
- DADO un tile en zona Focus CUANDO se verifica su resolución ENTONCES DEBE provenir de MDE 2m LIDAR PNOA

**Origen:** Requisito de aceptación Fase 1
**Módulos afectados:** Pipeline de generación de tiles, validación de cobertura

### RN-004: Ancla visual permanente

**Enunciado:** La Catedral de Santiago DEBE ser el punto de retorno visual del GDT: la vista de apertura y el botón de recentrado siempre apuntan a ella.

**Criterios de aceptación:**
- DADO el inicio de la aplicación CUANDO se carga la vista inicial ENTONCES la cámara DEBE estar centrada en coordenadas de la Catedral
- DADO un click en "Centrar en Catedral" CUANDO la cámara está en cualquier posición ENTONCES DEBE animar suavemente hacia la Catedral

**Origen:** Decisión de equipo - identidad visual del producto
**Módulos afectados:** Cliente web, configuración de cámara inicial

### RN-005: Separación Terreno vs Overlays

**Enunciado:** El Terreno (MDE 3D) es la capa base geométrica; las capas vectoriales (Hidrográfica, Curvas de nivel, Camino) son overlays que se drapean sobre él.

**Criterios de aceptación:**
- DADO un punto en el Terreno CUANDO se consulta su elevación ENTONCES el valor DEBE provenir exclusivamente del MDE
- DADO una capa vectorial (ej: río) CUANDO se renderiza ENTONCES DEBE ajustarse a la geometría del Terreno bajo ella
- DADO una Curva de nivel CUANDO se consulta su atributo `elevacion_m` ENTONCES DEBE coincidir con la elevación del Terreno en esa línea

**Origen:** Decisión arquitectónica - modelo de composición
**Módulos afectados:** Pipeline de procesamiento, renderizado cliente

---

## 6. Notificaciones y Comunicación al Usuario

| ID | Trigger | Canal | Contenido |
|---|---|---|---|
| NOT-001 | Inicio de carga inicial | UI overlay | "Cargando Gemelo Digital..." con barra de progreso |
| NOT-002 | Carga completada | UI (efímero) | "Explora Santiago y Galicia en 3D" que desaparece tras 3 segundos |
| NOT-003 | Error WebGL | UI modal | "Tu navegador no soporta WebGL. Intenta con Chrome, Firefox o Edge actualizado." |
| NOT-004 | Conexión lenta detectada | UI banner | "Conexión lenta. La calidad visual se ajustará automáticamente." |
| NOT-005 | Click en "Acerca de" | UI modal | Información de créditos: fuentes de datos, licencias, versión |

---

## 7. Historial de Cambios

| Versión | Fecha | Cambio | Aprobado por |
|---|---|---|---|
| 0.1.0 | 2024-06-04 | Creación inicial | sixtema-sdd |
