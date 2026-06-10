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

/** Umbrales de rendimiento para Fase 1 */
export const PERFORMANCE_TARGETS = {
  minFps: 30,
  maxLoadTimeSeconds: 5,
  targetConnectionMbps: 10,
} as const;
