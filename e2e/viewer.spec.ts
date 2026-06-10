import { test, expect } from '@playwright/test';

/**
 * Tests E2E del visor GDT-Santiago.
 * Verifica que CesiumJS carga correctamente, el terreno se visualiza
 * y la camara esta posicionada sobre Santiago de Compostela.
 */

test.describe('Carga y visualizacion del visor 3D', () => {
  test('debe ocultar el spinner y mostrar el canvas de Cesium', async ({ page }) => {
    // Capturar mensajes de consola para detectar errores criticos
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navegar a la aplicacion
    await page.goto('/');

    // Esperar a que el indicador de carga desaparezca (maximo 10s)
    const loadingIndicator = page.locator('#loading-indicator');
    await expect(loadingIndicator).toHaveClass(/hidden/, { timeout: 10_000 });

    // Verificar que el canvas de Cesium existe y tiene dimensiones
    const canvas = page.locator('#cesium-container canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('la camara debe estar centrada sobre Santiago de Compostela', async ({ page }) => {
    await page.goto('/');

    // Esperar a que Cesium este listo
    const loadingIndicator = page.locator('#loading-indicator');
    await expect(loadingIndicator).toHaveClass(/hidden/, { timeout: 10_000 });

    // Dar tiempo a que la escena se estabilice
    await page.waitForTimeout(2_000);

    // Obtener la posicion de la camara desde la instancia expuesta en desarrollo
    const cameraPosition = await page.evaluate(() => {
      const gdtViewer = (window as any).__GDT_VIEWER__;
      if (!gdtViewer) return null;
      return gdtViewer.getCameraPosition();
    });

    expect(cameraPosition).not.toBeNull();

    // Coordenadas aproximadas de Santiago de Compostela (margen de 0.5 grados)
    expect(cameraPosition!.longitude).toBeGreaterThan(-9.0);
    expect(cameraPosition!.longitude).toBeLessThan(-8.0);
    expect(cameraPosition!.latitude).toBeGreaterThan(42.0);
    expect(cameraPosition!.latitude).toBeLessThan(43.5);
  });

  test('no debe haber errores 404 en tiles de terreno', async ({ page }) => {
    const failedRequests: string[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/tiles/v1/terrain/') && response.status() === 404) {
        failedRequests.push(url);
      }
    });

    await page.goto('/');

    const loadingIndicator = page.locator('#loading-indicator');
    await expect(loadingIndicator).toHaveClass(/hidden/, { timeout: 10_000 });

    // Esperar unos segundos para que se intenten cargar tiles
    await page.waitForTimeout(3_000);

    // Es normal que algunos tiles 404 para niveles altos fuera del DEM,
    // pero no debe haber errores en los niveles base (0-13)
    const criticalFailures = failedRequests.filter((url) => {
      const match = url.match(/terrain\/(\d+)\//);
      if (!match) return false;
      const level = parseInt(match[1], 10);
      return level <= 13;
    });

    expect(
      criticalFailures,
      `Tiles de terreno base no encontrados: ${criticalFailures.join(', ')}`
    ).toHaveLength(0);
  });

  test('screenshot de la escena renderizada', async ({ page }) => {
    await page.goto('/');

    const loadingIndicator = page.locator('#loading-indicator');
    await expect(loadingIndicator).toHaveClass(/hidden/, { timeout: 10_000 });

    // Esperar a que la escena se estabilice y los tiles se carguen
    await page.waitForTimeout(4_000);

    await expect(page.locator('#cesium-container canvas')).toBeVisible();

    // Capturar screenshot del viewport para validacion visual
    await page.screenshot({
      path: 'e2e/screenshots/viewer-scene.png',
      fullPage: false,
    });
  });

  test('el boton de capas abre un panel con todas las capas planificadas', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');

    const loadingIndicator = page.locator('#loading-indicator');
    await expect(loadingIndicator).toHaveClass(/hidden/, { timeout: 10_000 });

    // Click en boton de capas
    await page.click('#btn-toggle-layers');

    // Verificar que el panel de capas aparece
    const layersPanel = page.locator('#layers-panel');
    await expect(layersPanel).toBeVisible();

    // Verificar categorias presentes
    const categories = page.locator('.layer-category');
    await expect(categories).toHaveCount(4);
    await expect(categories.nth(0)).toHaveText('Base');
    await expect(categories.nth(1)).toHaveText('Relieve');
    await expect(categories.nth(2)).toHaveText('Edificios');
    await expect(categories.nth(3)).toHaveText('Vectorial');

    // Capa base: siempre activa y deshabilitada (no se puede quitar)
    const baseCheckbox = page.locator('#layer-base-osm');
    await expect(baseCheckbox).toBeChecked();
    await expect(baseCheckbox).toBeDisabled();

    // Hillshade: implementado, activo por defecto, toggleable
    const hillshadeCheckbox = page.locator('#layer-hillshade');
    await expect(hillshadeCheckbox).toBeChecked();
    await expect(hillshadeCheckbox).toBeEnabled();

    // Desactivar el hillshade
    await hillshadeCheckbox.click();
    await expect(hillshadeCheckbox).not.toBeChecked();

    // Volver a activar
    await hillshadeCheckbox.click();
    await expect(hillshadeCheckbox).toBeChecked();

    // Capas no implementadas: deshabilitadas con badge "Proximamente"
    const unimplementedIds = [
      'layer-buildings-high',
      'layer-buildings-low',
      'layer-hydrography',
      'layer-contours',
      'layer-camino-hitos',
    ];
    for (const id of unimplementedIds) {
      const checkbox = page.locator(`#${id}`);
      await expect(checkbox).toBeDisabled();
    }
    const badges = page.locator('.layer-badge');
    await expect(badges).toHaveCount(5);

    // Cerrar el panel
    await page.click('#layers-panel .layers-close');
    await page.waitForTimeout(300);
    await expect(layersPanel).not.toBeVisible();
  });
});
