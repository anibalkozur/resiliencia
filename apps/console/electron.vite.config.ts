import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

const alias = { '@console': resolve(process.cwd(), 'src') };

export default defineConfig({
  main: {
    resolve: { alias },
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
