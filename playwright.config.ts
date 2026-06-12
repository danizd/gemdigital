import { defineConfig, devices } from '@playwright/test';

/**
 * Configuracion de Playwright para tests E2E del GDT-Santiago.
 * Ejecuta el servidor Vite de desarrollo automaticamente antes de los tests.
 */

/**
 * Argumentos de Chromium para garantizar WebGL (requerido por CesiumJS).
 * En CI (sin GPU) se fuerza SwiftShader (render por software); en local se
 * usa la GPU real para no degradar el rendimiento del desarrollador.
 */
const webglArgs = process.env.CI
  ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // CesiumJS requiere recursos GPU; evitar paralelismo agresivo
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
    // CesiumJS necesita WebGL. Ver `webglArgs` para la estrategia GPU/SwiftShader.
    launchOptions: {
      args: webglArgs,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx vite --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
