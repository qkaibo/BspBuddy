// ============================================================
// Update service — electron-updater integration
// ============================================================

import { BrowserWindow } from 'electron'
import type { UpdateInfo } from '../../lib/types'

let autoUpdater: typeof import('electron-updater').autoUpdater | null = null
try {
  autoUpdater = require('electron-updater').autoUpdater
} catch {
  console.warn('[update-service] electron-updater not installed, auto-update disabled')
}

const state: UpdateInfo = {
  version: '',
  releaseDate: '',
  releaseNotes: '',
  downloaded: false,
  available: false,
}

class UpdateService {
  init(): void {
    if (!autoUpdater) return

    autoUpdater.on('checking-for-update', () => {
      this.notify('update:checking', { checking: true })
    })

    autoUpdater.on('update-available', (info) => {
      state.version = info.version
      state.releaseDate = info.releaseDate || ''
      state.releaseNotes = typeof info.releaseNotes === 'string' ? info.releaseNotes : ''
      state.available = true
      this.notify('update:available', state)
    })

    autoUpdater.on('update-not-available', () => {
      state.available = false
      this.notify('update:not-available', { available: false })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.notify('update:progress', { percent: progress.percent })
    })

    autoUpdater.on('update-downloaded', () => {
      state.downloaded = true
      this.notify('update:downloaded', state)
    })

    autoUpdater.on('error', (err) => {
      console.error('[update-service] error:', err)
      this.notify('update:error', { error: err.message })
    })
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    if (!autoUpdater) {
      return { version: '', releaseDate: '', releaseNotes: '', downloaded: false, available: false }
    }
    await autoUpdater.checkForUpdates()
    return { ...state }
  }

  async downloadUpdate(): Promise<{ success: boolean; error?: string }> {
    if (!autoUpdater) return { success: false, error: 'electron-updater not installed' }
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  installUpdate(): void {
    if (!autoUpdater) return
    autoUpdater.quitAndInstall()
  }

  getStatus(): UpdateInfo {
    return { ...state }
  }

  private notify(channel: string, data: unknown): void {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send(channel, data)
    }
  }
}

export const updateService = new UpdateService()
