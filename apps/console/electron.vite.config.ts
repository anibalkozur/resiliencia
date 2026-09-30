import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

const alias = { '@console': resolve(process.cwd(), 'src') };

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      rollupOptions: {
        // Módulo nativo de llama.cpp: no se bundlea, se resuelve desde
        // node_modules en runtime (necesario para que funcionen sus binarios).
        external: ['node-llama-cpp'],
      },
    },
  },
  preload: {
    resolve: { alias },
  },
  renderer: {
    base: './',
    plugins: [react()],
    resolve: { alias },
    server: { port: 5173, strictPort: true },
  },
});
