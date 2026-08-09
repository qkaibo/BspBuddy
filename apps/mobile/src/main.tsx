// Mobile entry point — sets up Capacitor SecureStorage, then renders App.
// Reuses the same React renderer source as desktop/web via path aliases.

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { SecureStorage } from '@capacitor/secure-storage'

// Import storage seam before anything else
import { setTokenPersistence } from './storage'

// Switch to native secure storage when running on device
if (Capacitor.isNativePlatform()) {
  setTokenPersistence({
    getItem: async (key) => {
      try {
        const val = await SecureStorage.get({ key })
        return val.value ?? null
      } catch {
        return null
      }
    },
    setItem: async (key, value) => {
      await SecureStorage.set({ key, value })
    },
    removeItem: async (key) => {
      await SecureStorage.remove({ key })
    },
  })
}

// Set web runtime flag so capability gates hide desktop-only features
;(window as any).__WEB__ = true

// Import App from shared renderer code
import App from '@/renderer/App'
import '@/renderer/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
