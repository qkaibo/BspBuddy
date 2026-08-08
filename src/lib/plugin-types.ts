// ============================================================
// Plugin ecosystem types for BspBuddy
// ============================================================

// ---------- Plugin Type Enum ----------
export type PluginType = 'skill' | 'mcp' | 'hook' | 'agent' | 'rule'

// ---------- Plugin Manifest ----------
export interface PluginManifest {
  id: string
  name: string
  version: string
  author: string
  description: string
  type: PluginType
  category: string
  icon?: string
  homepage?: string
  repository?: string
  license?: string
  keywords: string[]
  markets?: string[]
  components: PluginComponents
}

export interface PluginComponents {
  skills?: string[]
  mcpServers?: McpServerConfig[]
  slashCommands?: SlashCommand[]
  hooks?: Hook[]
  agents?: string[]
  rules?: string[]
}

export interface SlashCommand {
  name: string
  description: string
  template: string
  params?: SlashParam[]
}

export interface SlashParam {
  name: string
  type: 'string' | 'number' | 'boolean'
  description: string
  required: boolean
  default?: unknown
}

export interface Hook {
  name: string
  description: string
  trigger: HookTrigger
  action: string
}

export type HookTrigger = 'on-file-create' | 'on-file-modify' | 'on-task-start' | 'on-task-complete' | 'on-startup'

// ---------- Plugin ----------
export interface Plugin {
  id: string
  name: string
  version: string
  author: string
  description: string
  type: PluginType
  category: string
  installed: boolean
  enabled: boolean
  icon?: string
  installedAt?: number
  updatedAt?: number
  market?: string
  size?: number
  dependencies?: string[]
  manifest?: PluginManifest
}

// ---------- Plugin Market ----------
export interface PluginMarket {
  id: string
  name: string
  url: string
  description?: string
  addedAt: number
}

// ---------- Plugin Install Result ----------
export interface PluginInstallResult {
  success: boolean
  plugin?: Plugin
  error?: string
  warnings?: string[]
}

// ---------- McpServerConfig ----------
export interface McpServerConfig {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  description?: string
  enabled?: boolean
}

// ---------- Inspiration (灵感) ----------

export type InspirationCategory =
  | 'document'    // 文档办公
  | 'data'        // 数据分析
  | 'development' // 代码开发
  | 'creative'    // 创意设计
  | 'learning'    // 学习研究
  | 'productivity'// 效率工具
  | 'lifestyle'   // 生活娱乐

export const INSPIRATION_CATEGORY_META: Record<InspirationCategory, { label: string; icon: string; color: string }> = {
  document:     { label: '文档办公', icon: 'file-text',    color: '#4A90D9' },
  data:        { label: '数据分析', icon: 'bar-chart',   color: '#7B61FF' },
  development: { label: '代码开发', icon: 'code',         color: '#10B981' },
  creative:    { label: '创意设计', icon: 'palette',      color: '#F59E0B' },
  learning:    { label: '学习研究', icon: 'book-open',    color: '#EC4899' },
  productivity: { label: '效率工具', icon: 'zap',         color: '#EF4444' },
  lifestyle:   { label: '生活娱乐', icon: 'smile',        color: '#8B5CF6' },
}

/** 灵感案例 */
export interface InspirationCase {
  id: string
  category: InspirationCategory
  title: string
  description: string
  previewUrl?: string
  tags: string[]
  /** 使用的 Skill 名称列表 */
  toolsUsed: string[]
  /** 关联的 Skill ID 列表 */
  skillIds: string[]
  /** 关联的专家 ID */
  expertId?: string
  /** 推荐的专家名称 */
  expertName?: string
  /** 做同款的预设 Prompt */
  prompt: string
  /** 收藏人数 */
  favoriteCount: number
  createdAt: number
  /** 是否是精选热门案例 */
  featured?: boolean
}

/** 做同款预设 — 点击后自动预填 Prompt + Skill + 专家 */
export interface InspirationPreset {
  caseId: string
  prompt: string
  skillIds: string[]
  expertId?: string
  previewUrl?: string
}

/** 收藏列表 */
export interface FavoriteItem {
  caseId: string
  favoritedAt: number
}
