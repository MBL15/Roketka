import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Объявление вместо зависимости @types/node: это единственное место в проекте,
// где нужен process, и тянуть ради него типы всего Node излишне.
declare const process: { env: Record<string, string | undefined> };

/**
 * В рабочей сборке статика и API отдаются с одного адреса через nginx,
 * поэтому клиент всегда обращается к относительным путям (/api, /ws).
 * Прокси ниже повторяет эту схему в режиме разработки, чтобы код не
 * приходилось менять между окружениями.
 */
const backend = process.env.BALLOON_API ?? 'http://localhost:8081';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/ws': { target: backend, ws: true, changeOrigin: true },
      '/v3/api-docs': { target: backend, changeOrigin: true },
      '/swagger-ui': { target: backend, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
