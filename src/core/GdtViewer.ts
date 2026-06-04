import {
  Viewer,
  Cartesian3,
  Math as CesiumMath,
  Terrain,
  SceneMode,
  ScreenSpaceEventType,
  ScreenSpaceEventHandler,
  Color,
  UrlTemplateImageryProvider,
  ImageryLayer,
  Rectangle,
} from 'cesium';
import {
  CATEDRAL_COORDINATES,
  INITIAL_CAMERA_VIEW,
  VIEWER_OPTIONS,
} from '../config/app-config';

/**
 * Visor 3D principal del GDT-Santiago.
 * Encapsula toda la logica de CesiumJS: inicializacion, navegacion,
 * gestion de capas y eventos de interaccion.
 *
 * Responsabilidad unica: renderizado del globo terraqueo y control de camara.
 */
export class GdtViewer {
  private viewer: Viewer | null = null;
  private container: HTMLElement;
  private readonly catedralPosition: Cartesian3;

  constructor(containerId: string) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`No se encontro el contenedor con id: ${containerId}`);
    }
    this.container = element;

    this.catedralPosition = Cartesian3.fromDegrees(
      CATEDRAL_COORDINATES.longitude,
      CATEDRAL_COORDINATES.latitude,
      CATEDRAL_COORDINATES.height
    );
  }

  /**
   * Inicializa el visor CesiumJS con la configuracion del GDT.
   * En Fase 1, se usa el terreno por defecto de Cesium (globo azul).
   * En Fase 2/H1, se sustituira por tiles Quantized Mesh propios.
   */
  public async initialize(): Promise<void> {
    // NOTA: En produccion, configurar CESIUM_ION_TOKEN en .env
    // y establecer aqui: Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
    // Para desarrollo, CesiumJS usa un token por defecto con limites de rate.

    this.viewer = new Viewer(this.container, {
      // Fase 1: Usar elipsoide plano para carga rapida
      // Fase 2/H1: Cambiar a Terrain.fromWorldTerrain() o tiles propios
      terrain: undefined,
      shadows: false,              // Deshabilitar para mejor rendimiento inicial
      skyAtmosphere: undefined,    // Sin atmosfera (mas ligero)
      requestRenderMode: true,     // Renderizado por demanda
      sceneMode: SceneMode.SCENE3D,
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      // Deshabilitar elementos pesados de la UI
      infoBox: false,
      selectionIndicator: false,
    });

    this.configureScene();
    this.setupEventHandlers();
    await this.addBaseLayer();
    await this.addLocalHillshadeLayer();

    // Posicionar directamente en Santiago sin animacion inicial
    // (la animacion flyTo causa problemas de rendimiento al inicio)
    this.viewer.camera.setView({
      destination: Cartesian3.fromDegrees(
        CATEDRAL_COORDINATES.longitude,
        CATEDRAL_COORDINATES.latitude,
        25000
      ),
      orientation: {
        heading: 0.0,
        pitch: -CesiumMath.PI_OVER_TWO,
        roll: 0.0,
      },
    });

    this.viewer.scene.requestRender();
  }

  /**
   * Añade capa base de mapa (OpenStreetMap) para evitar globo azul vacio.
   * Se carga antes del hillshade para que el relieve se superponga encima.
   */
  private async addBaseLayer(): Promise<void> {
    if (!this.viewer) return;

    try {
      const { TileMapServiceImageryProvider } = await import('cesium');
      const baseProvider = await TileMapServiceImageryProvider.fromUrl(
        './cesium/Assets/Textures/NaturalEarthII'
      );

      this.viewer.imageryLayers.addImageryProvider(baseProvider);
      console.info('[GDT] Capa base NaturalEarthII añadida');
    } catch (error) {
      console.warn('[GDT] No se pudo cargar capa base:', error);
    }
  }

  /**
   * Añade capa de hillshade generada del DEM de alta resolución (2m CNIG).
   * Muestra el relieve detallado de Santiago superpuesto sobre el terreno base.
   */
  private async addLocalHillshadeLayer(): Promise<void> {
    if (!this.viewer) return;

    try {
      const { WebMercatorTilingScheme } = await import('cesium');
      const hillshadeRectangle = Rectangle.fromDegrees(-8.65, 42.82000247816661, -8.45000677156889, 42.95);

      // Provider para tiles TMS generados con gdal2tiles
      const hillshadeProvider = new UrlTemplateImageryProvider({
        url: './tiles/hillshade/{z}/{x}/{reverseY}.png',
        tilingScheme: new WebMercatorTilingScheme(),
        rectangle: hillshadeRectangle,
        minimumLevel: 10,
        maximumLevel: 15,
        tileWidth: 256,
        tileHeight: 256,
        hasAlphaChannel: false,
      });

      // Manejar errores de carga de tiles
      hillshadeProvider.errorEvent.addEventListener((error: any) => {
        // Silenciar errores 404 para tiles que no existen (zonas fuera del DEM)
        if (error?.statusCode !== 404) {
          console.warn('[GDT] Error cargando tile de hillshade:', error);
        }
      });

      const hillshadeLayer = new ImageryLayer(hillshadeProvider, {
        alpha: 0.5, // Semi-transparente para no tapar el terreno base
        brightness: 1.1,
        contrast: 1.2,
      });

      // Añadir despues de la capa base para que sea overlay
      this.viewer.imageryLayers.add(hillshadeLayer);
      console.info('[GDT] Capa de hillshade añadida (DEM 2m CNIG) - Santiago zona Focus');
    } catch (error) {
      console.warn('[GDT] No se pudo cargar capa de hillshade:', error);
    }
  }

  /**
   * Configura propiedades visuales de la escena para el criterio "epico".
   */
  private configureScene(): void {
    if (!this.viewer) return;

    const scene = this.viewer.scene;

    // Fondo espacial negro con estrellas
    scene.backgroundColor = Color.BLACK;
    scene.globe.baseColor = Color.fromCssColorString('#1f4f66');

    // Mejora la calidad visual de la atmosfera
    if (scene.skyAtmosphere) {
      scene.skyAtmosphere.hueShift = 0.0;
      scene.skyAtmosphere.saturationShift = 0.1;
    }

    // Habilita iluminacion del sol para sombras naturales
    scene.globe.enableLighting = false;

    // Oculta el credito de Cesium en esquina (cumple licencia mostrandolo en "Acerca de")
    (this.viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';
  }

  /**
   * Registra los manejadores de eventos de interaccion del usuario.
   */
  private setupEventHandlers(): void {
    if (!this.viewer) return;

    const handler = new ScreenSpaceEventHandler(this.viewer.scene.canvas);

    // Click izquierdo: podria usarse para seleccionar entidades en Fase 2
    handler.setInputAction((event: { position: { x: number; y: number } }) => {
      // TODO(Fase 2): Implementar seleccion de entidades (hitos, edificios)
      console.debug('Click en posicion:', event.position);
    }, ScreenSpaceEventType.LEFT_CLICK);
  }

  /**
   * Realiza un vuelo animado a la vista inicial centrada en la Catedral.
   * Genera la "primeira vista epica" requerida por Fase 1.
   */
  public async flyToInitialView(): Promise<void> {
    if (!this.viewer) return;

    const { destination, orientation, distance } = INITIAL_CAMERA_VIEW;

    // Posicion de la camara: 2 km al sur de la Catedral, mirando hacia el norte
    // Pitch -45 grados = mirando hacia abajo
    const cameraDestination = Cartesian3.fromDegrees(
      destination.longitude,
      destination.latitude - 0.018, // ~2 km al sur (1 grado ~ 111 km)
      destination.height + distance * 0.7 // Altura para ver la catedral desde arriba
    );

    this.viewer.camera.flyTo({
      destination: cameraDestination,
      orientation: {
        heading: 0.0, // Mirando al norte
        pitch: CesiumMath.toRadians(-45), // 45 grados hacia abajo
        roll: 0.0,
      },
      duration: 3.0,
      easingFunction: (t: number) => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      },
    });
  }

  /**
   * Recentra la camara en la Catedral de Santiago (ancla visual).
   * Invocado por el boton "Catedral" de la UI.
   */
  public async resetToCathedral(): Promise<void> {
    if (!this.viewer) return;

    await this.flyToInitialView();
  }

  /**
   * Obtiene la posicion actual de la camara en coordenadas geograficas.
   * Util para debugging y futuras funciones de guardado de vistas.
   */
  public getCameraPosition(): { longitude: number; latitude: number; height: number } | null {
    if (!this.viewer) return null;

    const cartographic = this.viewer.camera.positionCartographic;
    return {
      longitude: CesiumMath.toDegrees(cartographic.longitude),
      latitude: CesiumMath.toDegrees(cartographic.latitude),
      height: cartographic.height,
    };
  }

  /**
   * Libera los recursos del visor. Debe llamarse antes de destruir la instancia.
   */
  public destroy(): void {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
  }

  /** Acceso directo a la instancia de Cesium Viewer (uso interno) */
  public getViewer(): Viewer | null {
    return this.viewer;
  }
}
