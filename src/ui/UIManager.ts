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
   * Vincula el boton "Capas" (placeholder para Fase 2).
   */
  private bindLayersButton(): void {
    if (!this.layersButton) return;

    this.layersButton.addEventListener('click', () => {
      // TODO(Fase 2): Implementar panel de capas (Hidrografia, Curvas, Camino)
      alert('Panel de capas disponible en Fase 2.\nActualmente se muestra terreno base.');
    });
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
