import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Standalone web SPA build.
// Entry: apps/web/main.tsx (loads browserStubs before React)
export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../src'),
    },
  },
  plugins: [react()],
  build: {
    outDir: '../../out/webapp',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:52020',
        changeOrigin: true,
      },
    },
  },
  define: {
    __WEB_BUILD__: 'true',
  },
})
