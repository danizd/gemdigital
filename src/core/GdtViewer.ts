import {
  Viewer,
  Cartesian3,
  Math as CesiumMath,
  CesiumTerrainProvider,
  SceneMode,
  ScreenSpaceEventType,
  ScreenSpaceEventHandler,
  Color,
  UrlTemplateImageryProvider,
  ImageryLayer,
  Rectangle,
  Primitive,
  GeometryInstance,
  PolygonGeometry,
  PolygonHierarchy,
  Cartographic,
  ColorGeometryInstanceAttribute,
  PerInstanceColorAppearance,
  Ellipsoid,
  sampleTerrainMostDetailed,
} from 'cesium';
import {
  CATEDRAL_COORDINATES,
  INITIAL_CAMERA_VIEW,
  VIEWER_OPTIONS,
  DYNAMIC_EXAGGERATION,
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
  private hillshadeLayer: ImageryLayer | null = null;
  private hillshadeVisible = false;
  private buildingsVisible = true;
  private buildingsPrimitive: Primitive | null = null;

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

    const terrainProvider = await CesiumTerrainProvider.fromUrl('./tiles/v1/terrain/', {
      requestVertexNormals: false,
      requestWaterMask: false,
    });
    console.info('[GDT] Terreno local heightmap cargado desde /tiles/v1/terrain/');

    this.viewer = new Viewer(this.container, {
      terrainProvider,
      shadows: false,              // Deshabilitar para mejor rendimiento inicial
      skyAtmosphere: undefined,    // Sin atmosfera (mas ligero)
      requestRenderMode: false,    // Renderizado continuo para validar refinamiento de terreno
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
    this.setupDynamicExaggeration();
    this.setupEventHandlers();
    await this.addBaseLayer();

    await this.addLocalHillshadeLayer();
    this.showHillshade();

    await this.addBuildingsOSMEntities();

    const { destination, distance } = INITIAL_CAMERA_VIEW;
    const initialCameraDestination = Cartesian3.fromDegrees(
      destination.longitude,
      destination.latitude - 0.02,
      destination.height + distance
    );

    this.viewer.camera.setView({
      destination: initialCameraDestination,
      orientation: {
        heading: 0.0,
        pitch: INITIAL_CAMERA_VIEW.orientation.pitch,
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
      const baseProvider = new UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        minimumLevel: 0,
        maximumLevel: 19,
        tileWidth: 256,
        tileHeight: 256,
      });

      this.viewer.imageryLayers.addImageryProvider(baseProvider);
      console.info('[GDT] Capa base OpenStreetMap añadida');
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

      this.hillshadeLayer = new ImageryLayer(hillshadeProvider, {
        alpha: 0.0, // Inicialmente invisible; se activa via showHillshade
        brightness: 1.1,
        contrast: 1.2,
      });

      // Añadir despues de la capa base para que sea overlay
      this.viewer.imageryLayers.add(this.hillshadeLayer);
      console.info('[GDT] Capa de hillshade añadida (DEM 2m CNIG) - Santiago zona Focus');
    } catch (error) {
      console.warn('[GDT] No se pudo cargar capa de hillshade:', error);
    }
  }

  /**
   * Activa la visibilidad de la capa de hillshade.
   */
  public showHillshade(): void {
    if (this.hillshadeLayer) {
      this.hillshadeLayer.alpha = 0.5;
      this.hillshadeVisible = true;
    }
  }

  /**
   * Oculta la capa de hillshade.
   */
  public hideHillshade(): void {
    if (this.hillshadeLayer) {
      this.hillshadeLayer.alpha = 0.0;
      this.hillshadeVisible = false;
    }
  }

  /**
   * Alterna la visibilidad de la capa de hillshade.
   * Devuelve el estado actual despues del toggle.
   */
  public toggleHillshade(): boolean {
    if (this.hillshadeVisible) {
      this.hideHillshade();
    } else {
      this.showHillshade();
    }
    return this.hillshadeVisible;
  }

  /**
   * Indica si la capa de hillshade esta visible actualmente.
   */
  public isHillshadeVisible(): boolean {
    return this.hillshadeVisible;
  }

  /**
   * Muestra la capa de edificios 3D OSM.
   */
  public showBuildings(): void {
    if (this.buildingsPrimitive) {
      this.buildingsPrimitive.show = true;
    }
    this.buildingsVisible = true;
  }

  /**
   * Oculta la capa de edificios 3D OSM.
   */
  public hideBuildings(): void {
    if (this.buildingsPrimitive) {
      this.buildingsPrimitive.show = false;
    }
    this.buildingsVisible = false;
  }

  /**
   * Alterna la visibilidad de la capa de edificios 3D OSM.
   * Devuelve el estado actual despues del toggle.
   */
  public toggleBuildings(): boolean {
    if (this.buildingsVisible) {
      this.hideBuildings();
    } else {
      this.showBuildings();
    }
    return this.buildingsVisible;
  }

  /**
   * Indica si la capa de edificios 3D OSM esta visible actualmente.
   */
  public areBuildingsVisible(): boolean {
    return this.buildingsVisible;
  }

  /**
   * Añade capa de edificios 3D via Cesium.Primitive con GeometryInstance (Hito 2B Fase A).
   *
   * Se utiliza Primitive con PerInstanceColorAppearance en lugar de Entity porque:
   * - El batching de geometria estatica reduce los draw calls de N a 1, eliminando
   *   el overhead de un Entity por edificio (7.791 objetos de escena individuales).
   * - Cesium agrupa todas las geometrias en un solo Primitive, procesandolas
   *   en un web worker (asynchronous: true) sin bloquear el hilo principal.
   * - Con 7.791 edificios, EntityCollection generaria ~7.791 draw calls,
   *   mientras que Primitive con GeometryInstance mantiene FPS estables.
   *
   * Carga un JSON preprocesado desde ./data/buildings.json y crea un polygon
   * extruido por edificio agrupado en un unico Primitive.
   */
  private async addBuildingsOSMEntities(): Promise<Primitive | undefined> {
    if (!this.viewer) return;

    try {
      const response = await fetch('./data/buildings.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buildings = await response.json() as Array<{
        id: number | string;
        name?: string;
        height: number | null;
        positions: number[][];
      }>;

      // Solo edificios con anillo poligonal valido (>= 3 vertices)
      const validBuildings = buildings.filter(
        (b) => Array.isArray(b.positions) && b.positions.length >= 3
      );

      // Muestreo de la elevacion del terreno bajo el primer vertice de cada
      // edificio. Se hace en lote para minimizar peticiones al terrainProvider.
      const groundSamples = validBuildings.map((b) =>
        Cartographic.fromDegrees(b.positions[0][0], b.positions[0][1])
      );
      await sampleTerrainMostDetailed(this.viewer.terrainProvider, groundSamples);

      const instances: GeometryInstance[] = [];
      const color = ColorGeometryInstanceAttribute.fromColor(
        Color.SANDYBROWN.withAlpha(0.85)
      );

      for (let i = 0; i < validBuildings.length; i++) {
        const b = validBuildings[i];

        const positions = b.positions.map(([lon, lat]) => {
          const cartographic = Cartographic.fromDegrees(lon, lat);
          return Ellipsoid.WGS84.cartographicToCartesian(cartographic);
        });

        const polygonHierarchy = new PolygonHierarchy(positions);
        const buildingHeight = b.height ?? 10.0;
        // Altura del terreno muestreada (NaN si el tile no tiene dato): base 0.
        const groundHeight = groundSamples[i].height || 0;

        // Alturas reales en metros. Cesium aplica verticalExaggeration
        // internamente tanto al terreno como a esta primitiva, por lo que NO
        // se debe multiplicar manualmente: el edificio queda anclado al terreno.
        const geometry = new PolygonGeometry({
          polygonHierarchy,
          height: groundHeight,
          extrudedHeight: groundHeight + buildingHeight,
          vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
        });

        const instance = new GeometryInstance({
          geometry,
          id: `building-${b.id}`,
          attributes: {
            color,
          },
        });

        instances.push(instance);
      }

      const primitive = new Primitive({
        geometryInstances: instances,
        appearance: new PerInstanceColorAppearance({
          flat: false,
          translucent: true,
        }),
        asynchronous: true,
      });

      this.viewer.scene.primitives.add(primitive);
      this.buildingsPrimitive = primitive;

      console.info(`[GDT] ${instances.length} edificios OSM añadidos como Primitive (GeometryInstance batching, anclados al terreno)`);

      return primitive;
    } catch (error) {
      console.warn('[GDT] No se pudieron cargar edificios OSM:', error);
      return undefined;
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
    scene.verticalExaggeration = VIEWER_OPTIONS.terrainExaggeration;
    scene.globe.maximumScreenSpaceError = 0.5;

    // Oculta el credito de Cesium en esquina (cumple licencia mostrandolo en "Acerca de")
    (this.viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';
  }

  /**
   * Ajusta la exageracion vertical de la escena segun la altura de la camara.
   *
   * Vista regional (camara alta): exageracion fuerte para un relieve "epico".
   * Vista urbana (camara baja): escala fiel para que los edificios mantengan
   * proporcion realista con el terreno. Cesium aplica verticalExaggeration en
   * runtime tanto al terreno como a las primitivas, por lo que los edificios
   * permanecen anclados al suelo en cualquier nivel de exageracion.
   *
   * Se aplica una histeresis (minChangeThreshold) para evitar parpadeo cuando
   * la camara oscila cerca del umbral de altura.
   */
  private setupDynamicExaggeration(): void {
    if (!this.viewer) return;

    const {
      cameraAltitudeThresholdMeters,
      regionalExaggeration,
      urbanExaggeration,
      minChangeThreshold,
    } = DYNAMIC_EXAGGERATION;

    const scene = this.viewer.scene;
    const camera = this.viewer.camera;

    const updateExaggeration = (): void => {
      const altitude = camera.positionCartographic.height;
      const target =
        altitude > cameraAltitudeThresholdMeters
          ? regionalExaggeration
          : urbanExaggeration;

      // Histeresis: solo aplicar si el cambio es significativo.
      if (Math.abs(scene.verticalExaggeration - target) >= minChangeThreshold) {
        scene.verticalExaggeration = target;
      }
    };

    // Evaluacion inicial y suscripcion a cambios de camara.
    updateExaggeration();
    camera.changed.addEventListener(updateExaggeration);
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
