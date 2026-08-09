// ============================================================
// Model Config Local Storage — 仅本机保存的模型配置
// Stores API keys in plaintext in Electron userData directory.
// Web/mobile runtimes do NOT have access to this module.
// ============================================================

import * as fs from 'fs'
import * as path from 'path'

export interface LocalModelConfig {
  id: string
  name: string
  api_protocol: string
  base_url: string
  api_key: string
  model: string
  temperature: number
  max_output_tokens: number
  is_default: boolean
  enabled: boolean
  storage_mode: 'local'
  scope: 'personal'
  created_at: string
  updated_at: string
}

const FILE_NAME = 'model-configs-local.json'

let _dataDir: string | null = null

export function setLocalDataDir(dir: string) {
  _dataDir = dir
}

function getFilePath(): string {
  if (!_dataDir) throw new Error('Local data dir not set. Call setLocalDataDir() first.')
  return path.join(_dataDir, FILE_NAME)
}

function readAll(): Record<string, LocalModelConfig> {
  try {
    if (!fs.existsSync(getFilePath())) return {}
    const raw = fs.readFileSync(getFilePath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, LocalModelConfig>) {
  const dir = path.dirname(getFilePath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getFilePath(), JSON.stringify(data, null, 2), 'utf-8')
}

export function listLocal(): LocalModelConfig[] {
  const all = readAll()
  return Object.values(all)
}

export function saveLocal(config: Omit<LocalModelConfig, 'created_at' | 'updated_at'>): LocalModelConfig {
  const all = readAll()
  const now = new Date().toISOString()
  const existing = all[config.id]

  // If this is the first model, or explicitly set as default, clear other defaults
  if (config.is_default) {
    for (const key of Object.keys(all)) {
      all[key].is_default = false
    }
  } else if (Object.keys(all).length === 0) {
    // First model auto-default
    config.is_default = true
  }

  const saved: LocalModelConfig = {
    ...config,
    storage_mode: 'local',
    scope: 'personal',
    created_at: existing?.created_at || now,
    updated_at: now,
  }
  all[config.id] = saved
  writeAll(all)
  return saved
}

export function deleteLocal(configId: string): boolean {
  const all = readAll()
  if (!all[configId]) return false
  const wasDefault = all[configId].is_default
  delete all[configId]

  // If deleted the default, pick the first remaining as new default
  if (wasDefault) {
    const remaining = Object.values(all)
    if (remaining.length > 0) {
      remaining[0].is_default = true
    }
  }
  writeAll(all)
  return true
}

export function getLocal(configId: string): LocalModelConfig | undefined {
  return readAll()[configId]
}

export function updateLocal(configId: string, patch: Partial<Omit<LocalModelConfig, 'id' | 'storage_mode' | 'scope' | 'created_at'>>): LocalModelConfig | undefined {
  const all = readAll()
  const existing = all[configId]
  if (!existing) return undefined

  // If setting is_default to true, clear all other defaults
  if (patch.is_default) {
    for (const key of Object.keys(all)) {
      all[key].is_default = false
    }
  }

  const updated: LocalModelConfig = {
    ...existing,
    ...patch,
    storage_mode: 'local',
    scope: 'personal',
    updated_at: new Date().toISOString(),
  }
  all[configId] = updated
  writeAll(all)
  return updated
}
