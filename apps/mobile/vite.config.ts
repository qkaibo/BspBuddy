import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Mobile Capacitor shell build. Reuses src/ shared source code via @/ alias.
export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../src'),
    },
  },
  plugins: [react()],
  build: {
    outDir: '../../out/mobile',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
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
