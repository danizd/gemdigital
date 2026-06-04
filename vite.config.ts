import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

/**
 * Configuracion de Vite para el cliente web del GDT-Santiago.
 * Incluye copia estatica de assets de CesiumJS (Workers, WASM, etc.)
 */
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        // Copiar solo assets esenciales de Cesium (no todo)
        {
          src: 'node_modules/cesium/Build/Cesium/Workers',
          dest: 'cesium',
        },
        {
          src: 'node_modules/cesium/Build/Cesium/Assets',
          dest: 'cesium',
        },
        {
          src: 'node_modules/cesium/Build/Cesium/Widgets',
          dest: 'cesium',
        },
        {
          src: 'node_modules/cesium/Build/Cesium/ThirdParty',
          dest: 'cesium',
        },
      ],
    }),
  ],
  optimizeDeps: {
    // Pre-bundle Cesium para desarrollo mas rapido
    include: ['cesium'],
    // Excluir modulos pesados que no necesitamos inmediatamente
    exclude: [],
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Deshabilitar para build mas rapido
    rollupOptions: {
      output: {
        manualChunks: {
          cesium: ['cesium'],
        },
      },
    },
  },
  server: {
    port: parseInt(process.env.PORT || '5173', 10),
    host: true,
    // Optimizaciones para desarrollo
    hmr: {
      overlay: false, // Deshabilitar overlay de errores HMR
    },
  },
});
