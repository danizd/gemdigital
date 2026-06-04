# GDT-Santiago

Gemelo Digital Topografico de Santiago de Compostela (GDT-Santiago).

**Lee primero:** [`AGENTS.md`](./AGENTS.md) — mapa de navegacion para agentes de IA.

**Documentos de referencia:**

- [`CONTEXT.md`](./CONTEXT.md) — glosario vivo (terminoloxia resolta).
- [`docs/adr/`](./docs/adr/) — decisions arquitectonicas irreversibles.
- [`documentacion/`](./documentacion/) — especificaciones estructurais e funcionais.

**Estado actual:** Fase 1 (Demo de aprobacion). Cliente web CesiumJS operativo. Capa base NaturalEarthII + hillshade Focus 2m funcionando. Terreno Quantized Mesh en desenvolvemento (pipeline offline).

**Licencia:** Apache 2.0.

---

## Requisitos

- Node.js 20+
- Docker e Docker Compose (para despliegue)
- Navegador compatible con WebGL (Chrome, Firefox, Edge)

---

## Comandos

### Desenvolvemento local

```bash
# Instalar dependencias
npm install

# Servidor de desenvolvemento con hot reload
npm run dev
# Accede a http://localhost:5173

# Compilar para producion
npm run build

# Previsualizar compilado
npm run preview
```

### Despliegue con Docker (Fase 1)

```bash
# Copiar variables de entorno
cp .env.example .env
# Editar .env cos valores reais

# Construir e levantar servicios
docker-compose up -d --build

# Acceder ao cliente web
# Local: http://localhost:8080
# Producion (Fase 2): https://gemelo.movilab.es
```

### Estrutura do proyecto

```
gemdigital/
├── AGENTS.md              # Mapa de navegacion para IA
├── CONTEXT.md             # Glosario vivo
├── package.json           # Dependencias Node.js
├── vite.config.ts         # Configuracion de Vite
├── tsconfig.json          # Configuracion de TypeScript
├── Dockerfile             # Imaxe Docker do cliente
├── docker-compose.yml     # Orquestracion de servizos
├── nginx.conf             # Configuracion de nginx
├── src/                   # Codigo fonte do cliente web
│   ├── main.ts            # Punto de entrada
│   ├── core/
│   │   └── GdtViewer.ts   # Visor 3D CesiumJS
│   ├── ui/
│   │   └── UIManager.ts   # Xestion da interfaz
│   ├── config/
│   │   └── app-config.ts  # Constantes do sistema
│   └── styles/
│       └── main.css       # Estilos da aplicacion
├── pipeline/              # Scripts de descarga datos (WSL2)
│   ├── download_cnig.py   # IGN/CNIG (MDT, BTN25, MTN25, NGBE)
│   ├── download_copernicus.py  # Copernicus DEM via Data Space API
│   ├── download_osm.py    # OpenStreetMap (Geofabrik + Overpass)
│   ├── download_egm2008.sh # Modelo geoidal EGM2008
│   ├── requirements.txt   # Dependencias Python
│   └── README.md          # Documentacion do pipeline
├── docs/
│   └── adr/               # Decisiones arquitectonicas
└── documentacion/
    ├── especificaciones_funcionales/
    └── especificaciones_estructurales/
```

---

## Fases do proxecto

### Fase 1 — Demo de Aprobacion (actual)

- [x] Cliente web Vite + TypeScript + CesiumJS
- [x] Vista inicial centrada na Catedral (ancla visual)
- [x] Navegacion 3D (zoom, rotar, inclinar)
- [x] Boton de recentrado na Catedral
- [x] Capa base NaturalEarthII (mapa global)
- [x] Hillshade Focus 2m (relieve detallado sobre Santiago)
- [x] Pipeline offline: scripts de descarga (CNIG, Copernicus, OSM, EGM2008)
- [x] Script regeneracion hillshade (regenerate_hillshade_focus.sh)
- [ ] Tiles Quantized Mesh terreno Focus 2m (H1)
- [ ] Docker Compose completo con PostGIS + pg_tileserv

**Criterios de aceptacion:**
- Tempo de carga inicial < 5 segundos @ 10 Mbps
- FPS minimo 30 @ 2 km da Catedral
- Cobertura territorial minima 50 km² con resolucion 2m

### Fase 2 — Producion

- Terreno completo: Focus (2m) + Contexto Galicia (25m EUDEM)
- Capas vectoriais: Hidrografia, curvas de nivel, Camino de Santiago
- Edificios 3D: alto detalle (LIDAR) + baixo detalle (OSM Buildings)
- Despliegue en `gemelo.movilab.es` con TLS
