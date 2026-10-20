import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/deso-dashboard/',
  build: { rollupOptions: { output: { manualChunks: { charts: ['recharts'] } } } },
});
