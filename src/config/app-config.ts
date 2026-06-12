/**
 * Configuracion centralizada del GDT-Santiago.
 * Todas las constantes del sistema estan definidas aqui para facilitar
 * el mantenimiento y evitar valores hardcodeados dispersos en el codigo.
 */

/** Coordenadas de la Catedral de Santiago de Compostela (ancla visual) */
export const CATEDRAL_COORDINATES = {
  longitude: -8.5446,
  latitude: 42.8806,
  height: 260, // Altura aproximada en metros (elipsoidal WGS84)
} as const;

/** Configuracion de la vista inicial para "primeira vista epica" */
export const INITIAL_CAMERA_VIEW = {
  destination: {
    longitude: -8.5446,
    latitude: 42.8806,
    height: 260,
  },
  orientation: {
    heading: 0.0,     // Norte (radians)
    pitch: -0.6109, // 35 grados de inclinacion (mirando hacia abajo)
    roll: 0.0,
  },
  distance: 900, // Vista cercana para forzar detalle del terreno
} as const;

/** Configuracion de conmutacion de edificios 3D (dos niveles) */
export const BUILDINGS_LOD = {
  highDetailDistanceMeters: 2000, // < 2 km: alto detalle (LIDAR)
  lowDetailDistanceMeters: 5000,  // > 5 km: bajo detalle (OSM)
} as const;

/** Parametros de asentamiento visual de los edificios 3D OSM */
export const BUILDINGS_RENDER = {
  // Falda enterrada bajo la cota mas baja de la huella: ancla el edificio al
  // terreno en pendiente sin que flote. La exageracion vertical la amplifica,
  // por lo que basta un valor pequeno para que nunca asome sobre el suelo.
  skirtMeters: 3,
} as const;

/** Parametros de render de las curvas de nivel (derivadas del DEM Focus) */
export const CONTOURS_RENDER = {
  masterIntervalMeters: 50,    // Curva maestra cada 50 m (resaltada)
  masterColorCss: '#c0392b',   // Rojo ladrillo: maximo contraste sobre terreno
  masterAlpha: 0.95,
  minorColorCss: '#2c2c2c',    // Gris pizarra oscuro: legible sobre cualquier fondo
  minorAlpha: 0.65,
  masterWidth: 4.0,
  minorWidth: 2.0,
  haloColorCss: '#ffffff',     // Halo blanco para resaltar contorno sobre fondos oscuros
  haloAlpha: 0.35,
  haloWidthOffset: 2.5,        // El halo es haloWidthOffset px mas grueso que la curva
} as const;

/** URLs de tiles (versionadas para cache agresivo) */
export const TILES_CONFIG = {
  baseUrl: '/tiles',
  version: 'v1',
  terrainPath: 'terrain',
  vectorPath: 'vector',
  buildings3DPath: '3dtiles',
} as const;

/** Opciones del visor CesiumJS */
export const VIEWER_OPTIONS = {
  terrainExaggeration: 4.0,
  shadows: true,          // Sombras para efecto "epico"
  skyAtmosphere: true,    // Atmosfera visible
  requestRenderMode: true, // Renderizado por demanda para mejor rendimiento
} as const;

/**
 * Exageracion vertical dinamica segun la altura de la camara.
 * Vista regional: relieve "epico" exagerado. Vista urbana: escala fiel
 * para que los edificios mantengan proporcion realista con el terreno.
 */
export const DYNAMIC_EXAGGERATION = {
  cameraAltitudeThresholdMeters: 5000, // Frontera regional / urbana
  regionalExaggeration: 4.0,           // Camara > umbral: efecto paisajistico
  urbanExaggeration: 1.2,              // Camara <= umbral: fidelidad urbana
  minChangeThreshold: 0.1,             // Histeresis para evitar parpadeo
} as const;

/** Umbrales de rendimiento para Fase 1 */
export const PERFORMANCE_TARGETS = {
  minFps: 30,
  maxLoadTimeSeconds: 5,
  targetConnectionMbps: 10,
} as const;
