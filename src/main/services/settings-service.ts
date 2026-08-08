// ============================================================
// Settings service — persistent app configuration
// ============================================================

import { app, powerSaveBlocker } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { AppSettings, AppLanguage } from '../../lib/types'
import { DEFAULT_SETTINGS } from '../../lib/types'

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function loadSettings(): AppSettings {
  const p = getStorePath()
  if (fs.existsSync(p)) {
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
      return { ...DEFAULT_SETTINGS, ...raw }
    } catch { /* corrupt */ }
  }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings: AppSettings): void {
  const dir = path.dirname(getStorePath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getStorePath(), JSON.stringify(settings, null, 2), 'utf-8')
}

class SettingsService {
  private settings: AppSettings
  private sleepBlockerId: number | null = null

  constructor() {
    this.settings = loadSettings()
    if (this.settings.preventSleep) {
      this.enableSleepBlock()
    }
  }

  getAll(): AppSettings {
    return { ...this.settings }
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key]
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings[key] = value
    saveSettings(this.settings)

    if (key === 'preventSleep') {
      if (value) {
        this.enableSleepBlock()
      } else {
        this.disableSleepBlock()
      }
    }
  }

  setLanguage(lang: AppLanguage): void {
    this.settings.language = lang
    saveSettings(this.settings)
  }

  setFontSize(size: number): void {
    this.settings.fontSize = Math.max(10, Math.min(24, size))
    saveSettings(this.settings)
  }

  toggleCompactMode(): boolean {
    this.settings.compactMode = !this.settings.compactMode
    saveSettings(this.settings)
    return this.settings.compactMode
  }

  toggleAutoInstall(): boolean {
    this.settings.autoInstallNonRisky = !this.settings.autoInstallNonRisky
    saveSettings(this.settings)
    return this.settings.autoInstallNonRisky
  }

  togglePreventSleep(): boolean {
    this.settings.preventSleep = !this.settings.preventSleep
    saveSettings(this.settings)

    if (this.settings.preventSleep) {
      this.enableSleepBlock()
    } else {
      this.disableSleepBlock()
    }

    return this.settings.preventSleep
  }

  private enableSleepBlock(): void {
    if (this.sleepBlockerId === null) {
      this.sleepBlockerId = powerSaveBlocker.start('prevent-display-sleep')
    }
  }

  private disableSleepBlock(): void {
    if (this.sleepBlockerId !== null) {
      powerSaveBlocker.stop(this.sleepBlockerId)
      this.sleepBlockerId = null
    }
  }
}

export const settingsService = new SettingsService()
