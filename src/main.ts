/// <reference types="vite/client" />

// Establecer ruta base para assets de CesiumJS antes de cualquier importacion
(window as any).CESIUM_BASE_URL = './cesium/';

import { GdtViewer } from './core/GdtViewer';
import { UIManager } from './ui/UIManager';
import 'cesium/Build/Cesium/Widgets/widgets.css';

/**
 * Punto de entrada principal del GDT-Santiago.
 *
 * Inicializa el visor 3D (CesiumJS) y la interfaz de usuario,
 * estableciendo la "primeira vista epica" centrada na Catedral.
 */
async function main(): Promise<void> {
  try {
    const viewer = new GdtViewer('cesium-container');
    await viewer.initialize();

    const uiManager = new UIManager(viewer);
    uiManager.initialize();

    // Exponer viewer globalmente en desarrollo para debugging y tests E2E
    if (import.meta.env.DEV) {
      (window as any).__GDT_VIEWER__ = viewer;
      console.info('GDT-Santiago inicializado. Posicion da camara:', viewer.getCameraPosition());
    }
  } catch (error) {
    console.error('Erro ao inicializar o GDT-Santiago:', error);

    // NOT-003: Mensaje de error si WebGL no esta disponible
    const container = document.getElementById('cesium-container');
    if (container) {
      container.innerHTML = `
        <div class="error-message">
          <h2>Erro de inicializacion</h2>
          <p>O teu navegador non soporta WebGL. Intenta con Chrome, Firefox ou Edge actualizado.</p>
        </div>
      `;
    }
  }
}

// Inicia a aplicacion cando o DOM esta listo
document.addEventListener('DOMContentLoaded', main);
