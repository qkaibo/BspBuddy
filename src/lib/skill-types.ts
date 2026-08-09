// ============================================================
// Skill types for BspBuddy
// ============================================================

// ---------- Skill ----------
export interface Skill {
  id: string
  name: string
  description: string
  category: string
  version: string
  author: string
  installed: boolean
  enabled: boolean
  installedAt?: number
  updatedAt?: number
  size?: number
  source?: 'builtin' | 'market' | 'upload'
  permissions?: SkillPermission[]
  securityWarnings?: string[]
  icon?: string
  triggers?: SkillTrigger[]
}

export interface SkillPermission {
  type: SkillPermissionType
  description: string
  granted: boolean
}

export type SkillPermissionType =
  | 'file-read'
  | 'file-write'
  | 'file-delete'
  | 'network'
  | 'shell'
  | 'python'
  | 'webhook'
  | 'external-api'
  | 'clipboard'
  | 'browser'

export interface SkillTrigger {
  event: string
  description: string
}

// ---------- Skill Package ----------
export interface SkillPackage {
  id: string
  name: string
  version: string
  author: string
  description: string
  category: string
  permissions: SkillPermission[]
  size?: number
  entryPoint: string
  dependencies?: string[]
}

// ---------- Skill Search Result ----------
export interface SkillSearchResult {
  skill: Skill
  relevance: number
  matchReason: string
}

// ---------- Skill Update Params ----------
export interface SkillUpdateParams {
  name?: string
  description?: string
  category?: string
  version?: string
  author?: string
  permissions?: SkillPermission[]
  triggers?: SkillTrigger[]
  icon?: string
}

// ---------- Skill Install Result ----------
export interface SkillInstallResult {
  success: boolean
  skill?: Skill
  error?: string
  warnings?: string[]
}
