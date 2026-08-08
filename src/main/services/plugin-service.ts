// ============================================================
// Plugin service — manages plugin lifecycle, markets, and packaging
// ============================================================

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import type { Plugin, PluginManifest, PluginMarket, PluginInstallResult, PluginType } from '../../lib/plugin-types'

const BUILTIN_PLUGINS: Plugin[] = [
  {
    id: 'plugin-builtin-doc',
    name: '文档处理套件',
    version: '1.0.0',
    author: 'BspBuddy',
    description: 'Word/Excel/PPT/PDF 文档处理能力',
    type: 'skill',
    category: 'document',
    installed: true,
    enabled: true,
    icon: 'file-text',
  },
  {
    id: 'plugin-builtin-search',
    name: '智能搜索',
    version: '1.0.0',
    author: 'BspBuddy',
    description: '网络搜索、本地文件搜索能力',
    type: 'skill',
    category: 'search',
    installed: true,
    enabled: true,
    icon: 'search',
  },
  {
    id: 'plugin-builtin-terminal',
    name: '终端增强',
    version: '1.0.0',
    author: 'BspBuddy',
    description: '提供命令行集成和脚本执行能力',
    type: 'hook',
    category: 'productivity',
    installed: true,
    enabled: true,
    icon: 'terminal',
  },
]

const MARKET_PLUGINS: Plugin[] = [
  {
    id: 'plugin-market-files',
    name: '智能文件管理',
    version: '2.0.0',
    author: 'FileMaster',
    description: '自动分类、批量重命名、清理重复文件',
    type: 'skill',
    category: 'productivity',
    installed: false,
    enabled: false,
    icon: 'folder',
  },
  {
    id: 'plugin-market-data',
    name: '数据分析平台',
    version: '1.8.0',
    author: 'DataLabs',
    description: '高级数据分析、可视化、报表生成',
    type: 'agent',
    category: 'data',
    installed: false,
    enabled: false,
    icon: 'bar-chart',
  },
  {
    id: 'plugin-market-auto',
    name: '自动化工作流',
    version: '3.0.0',
    author: 'FlowBot',
    description: '创建复杂自动化工作流，串联多步骤任务',
    type: 'hook',
    category: 'productivity',
    installed: false,
    enabled: false,
    icon: 'zap',
  },
  {
    id: 'plugin-market-codereview',
    name: '代码审查规则',
    version: '1.3.0',
    author: 'CodeQuality',
    description: '自动代码规范检查和安全审查规则',
    type: 'rule',
    category: 'development',
    installed: false,
    enabled: false,
    icon: 'shield',
  },
]

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'plugins')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getUserPluginsPath(): string {
  return path.join(getDataDir(), 'user-plugins.json')
}

function getUserMarketsPath(): string {
  return path.join(getDataDir(), 'plugin-markets.json')
}

function loadUserPlugins(): Plugin[] {
  const p = getUserPluginsPath()
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as Plugin[] } catch { return [] }
}

function saveUserPlugins(plugins: Plugin[]): void {
  fs.writeFileSync(getUserPluginsPath(), JSON.stringify(plugins, null, 2), 'utf-8')
}

function loadMarkets(): PluginMarket[] {
  const p = getUserMarketsPath()
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as PluginMarket[] } catch { return [] }
}

function saveMarkets(markets: PluginMarket[]): void {
  fs.writeFileSync(getUserMarketsPath(), JSON.stringify(markets, null, 2), 'utf-8')
}

export const pluginService = {
  /** List all plugins */
  list(): Plugin[] {
    const userPlugins = loadUserPlugins()
    const userMap = new Map(userPlugins.map((p) => [p.id, p]))
    const builtins = BUILTIN_PLUGINS.map((p) => {
      const override = userMap.get(p.id)
      return override ? { ...p, ...override, installed: p.installed } : p
    })
    const extra = userPlugins.filter((p) => !BUILTIN_PLUGINS.find((b) => b.id === p.id))
    return [...builtins, ...extra]
  },

  /** Install a plugin */
  install(pluginId: string): PluginInstallResult {
    const market = MARKET_PLUGINS.find((p) => p.id === pluginId)
    if (!market) return { success: false, error: `找不到插件: ${pluginId}` }

    const installed: Plugin = {
      ...market,
      installed: true,
      enabled: true,
      installedAt: Date.now(),
      updatedAt: Date.now(),
    }

    const userPlugins = loadUserPlugins()
    const idx = userPlugins.findIndex((p) => p.id === pluginId)
    if (idx >= 0) userPlugins[idx] = installed
    else userPlugins.push(installed)
    saveUserPlugins(userPlugins)

    return { success: true, plugin: installed }
  },

  /** Uninstall a plugin */
  uninstall(pluginId: string): PluginInstallResult {
    const userPlugins = loadUserPlugins()
    const idx = userPlugins.findIndex((p) => p.id === pluginId)
    if (idx < 0) return { success: false, error: '插件未安装' }
    const removed = userPlugins.splice(idx, 1)[0]
    saveUserPlugins(userPlugins)
    return { success: true, plugin: { ...removed, installed: false, enabled: false } }
  },

  /** Add a third-party plugin market */
  addMarket(url: string, name?: string): PluginMarket {
    const markets = loadMarkets()
    const market: PluginMarket = {
      id: uuid(),
      name: name || url,
      url,
      addedAt: Date.now(),
    }
    markets.push(market)
    saveMarkets(markets)
    return market
  },

  /** List all plugin markets */
  listMarkets(): PluginMarket[] {
    return loadMarkets()
  },

  /** Remove a plugin market */
  removeMarket(marketId: string): boolean {
    const markets = loadMarkets()
    const idx = markets.findIndex((m) => m.id === marketId)
    if (idx < 0) return false
    markets.splice(idx, 1)
    saveMarkets(markets)
    return true
  },

  /** Get plugins available in markets (not yet installed) */
  getMarketPlugins(): Plugin[] {
    const installedIds = new Set(this.list().filter((p) => p.installed).map((p) => p.id))
    return MARKET_PLUGINS.filter((p) => !installedIds.has(p.id))
  },

  /** Install from .plugin directory */
  installFromPackage(dirPath: string): PluginInstallResult {
    try {
      const manifestPath = path.join(dirPath, 'manifest.json')
      if (!fs.existsSync(manifestPath)) {
        return { success: false, error: 'manifest.json 未找到' }
      }
      const raw = fs.readFileSync(manifestPath, 'utf-8')
      const manifest: PluginManifest = JSON.parse(raw)

      const plugin: Plugin = {
        id: `plugin-pkg-${manifest.id || uuid()}`,
        name: manifest.name,
        version: manifest.version,
        author: manifest.author,
        description: manifest.description,
        type: manifest.type,
        category: manifest.category,
        installed: true,
        enabled: true,
        installedAt: Date.now(),
        market: 'local',
        manifest,
        icon: manifest.icon,
      }

      const userPlugins = loadUserPlugins()
      userPlugins.push(plugin)
      saveUserPlugins(userPlugins)

      const warnings: string[] = []
      if (manifest.components?.hooks?.length) warnings.push(`包含 ${manifest.components.hooks.length} 个自动化钩子`)
      if (manifest.components?.rules?.length) warnings.push(`包含 ${manifest.components.rules.length} 个行为规则`)

      return { success: true, plugin, warnings }
    } catch (err) {
      return {
        success: false,
        error: `插件包安装失败: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
}
