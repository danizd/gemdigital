import { GdtViewer } from '../core/GdtViewer';

/**
 * Gestor de la interfaz de usuario del GDT-Santiago.
 * Maneja eventos de botones, indicadores de carga y modales informativos.
 *
 * Responsabilidad unica: interaccion entre el DOM y el visor 3D.
 */
export class UIManager {
  private viewer: GdtViewer;
  private loadingElement: HTMLElement | null;
  private resetButton: HTMLElement | null;
  private aboutButton: HTMLElement | null;
  private layersButton: HTMLElement | null;

  constructor(viewer: GdtViewer) {
    this.viewer = viewer;
    this.loadingElement = document.getElementById('loading-indicator');
    this.resetButton = document.getElementById('btn-reset-camera');
    this.aboutButton = document.getElementById('btn-about');
    this.layersButton = document.getElementById('btn-toggle-layers');
  }

  /**
   * Inicializa todos los manejadores de eventos de la UI.
   */
  public initialize(): void {
    this.bindResetButton();
    this.bindAboutButton();
    this.bindLayersButton();
    this.hideLoadingAfterDelay();
  }

  /**
   * Oculta el indicador de carga cuando CesiumJS esté listo.
   * Verifica cada 500ms hasta que el viewer esté inicializado.
   */
  private hideLoadingAfterDelay(): void {
    console.log('[GDT] Iniciando verificacion de carga...');
    let attempts = 0;

    const checkInterval = setInterval(() => {
      attempts++;
      const viewer = this.viewer.getViewer();
      console.log(`[GDT] Intento ${attempts}: viewer=${!!viewer}, scene=${!!viewer?.scene}`);

      if (viewer && viewer.scene) {
        // Cesium está listo, ocultar spinner
        console.log('[GDT] Cesium listo! Ocultando spinner...');
        clearInterval(checkInterval);
        if (this.loadingElement) {
          this.loadingElement.classList.add('hidden');
          this.showWelcomeToast();
        }
      }
    }, 500); // Verificar cada 500ms

    // Timeout de seguridad: 10 segundos para testing
    setTimeout(() => {
      clearInterval(checkInterval);
      if (this.loadingElement && !this.loadingElement.classList.contains('hidden')) {
        console.warn('[GDT] Timeout alcanzado, forzando ocultamiento del spinner');
        this.loadingElement.classList.add('hidden');
        this.showWelcomeToast();
      }
    }, 10000); // 10 segundos maximo
  }

  /**
   * Muestra un mensaje efimero de bienvenida tras la carga.
   * NOT-002 del spec funcional.
   */
  private showWelcomeToast(): void {
    const toast = document.createElement('div');
    toast.className = 'welcome-toast';
    toast.textContent = 'Explora Santiago e Galicia en 3D';
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }

  /**
   * Vincula el boton "Catedral" para recentrar la camara.
   */
  private bindResetButton(): void {
    if (!this.resetButton) return;

    this.resetButton.addEventListener('click', async () => {
      this.resetButton?.classList.add('active');
      await this.viewer.resetToCathedral();
      setTimeout(() => this.resetButton?.classList.remove('active'), 300);
    });
  }

  /**
   * Vincula el boton "Acerca de" para mostrar informacion del proyecto.
   * NOT-005 del spec funcional.
   */
  private bindAboutButton(): void {
    if (!this.aboutButton) return;

    this.aboutButton.addEventListener('click', () => {
      this.showAboutModal();
    });
  }

  /**
   * Vincula el boton "Capas" para mostrar/ocultar el panel de capas activas.
   */
  private bindLayersButton(): void {
    if (!this.layersButton) return;

    this.layersButton.addEventListener('click', () => {
      this.toggleLayersPanel();
    });
  }

  /**
   * Definicion completa de todas las capas planificadas del GDT-Santiago.
   * Cada capa indica si esta implementada, si es toggleable y su estado actual.
   */
  private getLayersConfig(): Array<{
    id: string;
    name: string;
    category: string;
    implemented: boolean;
    alwaysOn?: boolean;
    checked: boolean;
    onToggle?: () => void;
  }> {
    return [
      {
        id: 'base-osm',
        name: 'Terreno base (OpenStreetMap)',
        category: 'Base',
        implemented: true,
        alwaysOn: true,
        checked: true,
      },
      {
        id: 'hillshade',
        name: 'Relieve (Hillshade DEM 2m)',
        category: 'Relieve',
        implemented: true,
        checked: this.viewer.isHillshadeVisible(),
        onToggle: () => this.viewer.toggleHillshade(),
      },
      {
        id: 'buildings-lidar',
        name: 'Edificios 3D - Alto detalle (LIDAR)',
        category: 'Edificios',
        implemented: false,
        checked: false,
      },
      {
        id: 'buildings-osm',
        name: 'Edificios 3D (OSM)',
        category: 'Edificios',
        implemented: true,
        checked: this.viewer.areBuildingsVisible(),
        onToggle: () => this.viewer.toggleBuildings(),
      },
      {
        id: 'hydrography',
        name: 'Hidrografia (rios)',
        category: 'Vectorial',
        implemented: false,
        checked: false,
      },
      {
        id: 'contours',
        name: 'Curvas de nivel',
        category: 'Vectorial',
        implemented: true,
        checked: this.viewer.areContoursVisible(),
        onToggle: () => this.viewer.toggleContours(),
      },
      {
        id: 'camino-hitos',
        name: 'Camino de Santiago (hitos)',
        category: 'Vectorial',
        implemented: false,
        checked: false,
      },
    ];
  }

  /**
   * Alterna la visibilidad del panel de capas.
   */
  private toggleLayersPanel(): void {
    const existingPanel = document.getElementById('layers-panel');
    if (existingPanel) {
      existingPanel.remove();
      return;
    }

    const layers = this.getLayersConfig();

    const panel = document.createElement('div');
    panel.id = 'layers-panel';
    panel.className = 'layers-panel';

    let currentCategory = '';
    let layersHtml = '';

    for (const layer of layers) {
      if (layer.category !== currentCategory) {
        currentCategory = layer.category;
        layersHtml += `<div class="layer-category">${currentCategory}</div>`;
      }

      const isDisabled = !layer.implemented || layer.alwaysOn;
      const disabledAttr = isDisabled ? 'disabled' : '';
      const checkedAttr = layer.checked ? 'checked' : '';
      const badge = layer.implemented ? '' : '<span class="layer-badge">Proximamente</span>';
      const cursorClass = layer.implemented ? '' : 'layer-item-disabled';

      layersHtml += `
        <label class="layer-item ${cursorClass}">
          <input type="checkbox" id="layer-${layer.id}" ${checkedAttr} ${disabledAttr} />
          <span class="layer-name">${layer.name}</span>
          ${badge}
        </label>
      `;
    }

    panel.innerHTML = `
      <div class="layers-header">
        <h3>Capas</h3>
        <button class="layers-close">&times;</button>
      </div>
      <div class="layers-list">
        ${layersHtml}
      </div>
    `;

    document.body.appendChild(panel);

    // Cerrar panel
    panel.querySelector('.layers-close')?.addEventListener('click', () => panel.remove());
    panel.addEventListener('click', (e) => {
      if (e.target === panel) panel.remove();
    });

    // Vincular toggles de capas implementadas
    for (const layer of layers) {
      if (layer.implemented && layer.onToggle) {
        const checkbox = panel.querySelector<HTMLInputElement>(`#layer-${layer.id}`);
        checkbox?.addEventListener('change', layer.onToggle);
      }
    }
  }

  /**
   * Muestra el modal informativo con creditos y licencias.
   */
  private showAboutModal(): void {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close">&times;</button>
        <h2>GDT-Santiago</h2>
        <p><strong>Gemelo Digital Topografico de Santiago de Compostela</strong></p>
        <p>Version 0.1.0 (Fase 1 - Demo)</p>
        <hr/>
        <h3>Fontes de datos</h3>
        <ul>
          <li>Terreno: Cesium World Terrain (temporal, Fase 1)</li>
          <li>Carreteras: OpenStreetMap</li>
        </ul>
        <h3>Licenzas</h3>
        <p>Codigo: Apache 2.0 | CesiumJS: Apache 2.0</p>
        <p>Datos: Licenzas abertas dos organismos oficiais</p>
        <hr/>
        <p><em>Construido con CesiumJS, Vite e TypeScript.</em></p>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close')?.addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }
}
