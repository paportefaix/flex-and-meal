import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Open Food Facts et Hevy n'envoient pas d'en-têtes CORS : on passe par un proxy local (dev et preview).
const offProxy = {
  '/off-search': {
    target: 'https://search.openfoodfacts.org',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/off-search/, '/search'),
    headers: { 'User-Agent': 'flex-and-meal/0.1 (usage personnel)' },
  },
  // API publique de Hevy (synchronisation des séances) : même contrainte CORS.
  '/hevy-api': {
    target: 'https://api.hevyapp.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/hevy-api/, ''),
  },
};

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { proxy: offProxy },
  preview: { proxy: offProxy },
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '.claude/**'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
});
