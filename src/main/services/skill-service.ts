// ============================================================
// Skill service — manages skill lifecycle and marketplace
// ============================================================

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import type { Skill, SkillSearchResult, SkillInstallResult, SkillUpdateParams, SkillPackage, SkillPermission } from '../../lib/skill-types'

const BUILTIN_SKILLS: Skill[] = [
  {
    id: 'skill-builtin-email',
    name: '邮件助手',
    description: '自动撰写、发送和回复邮件，支持多种邮件格式',
    category: 'communication',
    version: '1.0.0',
    author: 'BspBuddy',
    installed: true,
    enabled: true,
    source: 'builtin',
    permissions: [
      { type: 'network', description: '发送邮件需要网络连接', granted: true },
      { type: 'external-api', description: '调用邮件API', granted: true },
    ],
  },
  {
    id: 'skill-builtin-pdf',
    name: 'PDF处理器',
    description: '解析、生成、合并和转换PDF文档',
    category: 'document',
    version: '1.0.0',
    author: 'BspBuddy',
    installed: true,
    enabled: true,
    source: 'builtin',
    permissions: [
      { type: 'file-read', description: '读取PDF文件内容', granted: true },
      { type: 'file-write', description: '写入生成的PDF文件', granted: true },
    ],
  },
  {
    id: 'skill-builtin-websearch',
    name: '网络搜索',
    description: '在互联网上搜索信息并整理摘要',
    category: 'search',
    version: '1.0.0',
    author: 'BspBuddy',
    installed: true,
    enabled: true,
    source: 'builtin',
    permissions: [
      { type: 'network', description: '需要访问互联网', granted: true },
    ],
  },
  {
    id: 'skill-builtin-dataviz',
    name: '数据可视化',
    description: '将数据转换为图表和可视化报告',
    category: 'data',
    version: '1.0.0',
    author: 'BspBuddy',
    installed: true,
    enabled: true,
    source: 'builtin',
    permissions: [
      { type: 'file-read', description: '读取数据文件', granted: true },
      { type: 'file-write', description: '保存生成的图表', granted: true },
      { type: 'python', description: '使用Python生成图表', granted: true },
    ],
  },
  {
    id: 'skill-builtin-pptx',
    name: 'PPT生成器',
    description: '根据内容自动生成演示文稿，支持多种模板',
    category: 'document',
    version: '1.0.0',
    author: 'BspBuddy',
    installed: true,
    enabled: true,
    source: 'builtin',
    permissions: [
      { type: 'file-write', description: '保存PPT文件', granted: true },
      { type: 'python', description: '使用python-pptx库', granted: true },
    ],
  },
]

const MARKET_SKILLS: Skill[] = [
  {
    id: 'skill-market-stock',
    name: '股票分析',
    description: '获取实时股价、技术指标分析和投资建议',
    category: 'finance',
    version: '2.1.0',
    author: 'FinanceLabs',
    installed: false,
    enabled: false,
    source: 'market',
    permissions: [
      { type: 'network', description: '获取实时股价数据', granted: false },
      { type: 'external-api', description: '调用股票数据API', granted: false },
    ],
    securityWarnings: ['该技能会将查询关键词发送至第三方股票数据API'],
  },
  {
    id: 'skill-market-translate',
    name: '多语言翻译',
    description: '高质量多语言翻译，支持100+语言互译',
    category: 'language',
    version: '3.0.0',
    author: 'LangTech',
    installed: false,
    enabled: false,
    source: 'market',
    permissions: [
      { type: 'network', description: '调用翻译API', granted: false },
      { type: 'external-api', description: '文本发送至翻译服务', granted: false },
    ],
    securityWarnings: ['翻译内容将发送至第三方翻译服务进行处理'],
  },
  {
    id: 'skill-market-imagegen',
    name: 'AI图像生成',
    description: '通过自然语言描述生成高质量图片',
    category: 'creative',
    version: '1.2.0',
    author: 'CreativeAI',
    installed: false,
    enabled: false,
    source: 'market',
    permissions: [
      { type: 'network', description: '调用图像生成API', granted: false },
      { type: 'file-write', description: '保存生成的图像', granted: false },
      { type: 'external-api', description: 'Prompt发送至图像生成服务', granted: false },
    ],
    securityWarnings: ['图像生成请求发送至第三方服务器', '生成内容可能受服务条款限制'],
  },
  {
    id: 'skill-market-calendar',
    name: '智能日历',
    description: '管理日程、设置提醒、自动安排会议时间',
    category: 'productivity',
    version: '1.5.0',
    author: 'PlanFlow',
    installed: false,
    enabled: false,
    source: 'market',
    permissions: [
      { type: 'network', description: '同步日历数据', granted: false },
      { type: 'external-api', description: '连接日历服务', granted: false },
    ],
    securityWarnings: ['该技能会读取和修改你的日历数据'],
  },
]

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'skills')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getUserSkillsPath(): string {
  return path.join(getDataDir(), 'user-skills.json')
}

function getPerUserSkillsPath(userId: string): string {
  const dir = path.join(getDataDir(), 'per-user')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `${userId}.json`)
}

interface StoredSkill extends Skill {
  ownerUserId?: string
}

function loadUserSkills(): StoredSkill[] {
  const p = getUserSkillsPath()
  if (!fs.existsSync(p)) return []
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as StoredSkill[]
  } catch {
    return []
  }
}

function loadPerUserSkills(userId: string): StoredSkill[] {
  const p = getPerUserSkillsPath(userId)
  if (!fs.existsSync(p)) return []
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as StoredSkill[]
  } catch {
    return []
  }
}

function savePerUserSkills(userId: string, skills: StoredSkill[]): void {
  fs.writeFileSync(getPerUserSkillsPath(userId), JSON.stringify(skills, null, 2), 'utf-8')
}

function getAllSkills(userId?: string): Skill[] {
  const builtins: Skill[] = BUILTIN_SKILLS.map(b => ({ ...b }))
  if (!userId) return builtins

  const perUser = loadPerUserSkills(userId)
  // Legacy migration: load old user-skills.json and migrate to per-user
  const legacy = loadUserSkills()
  const legacyNonBuiltin = legacy.filter(s => !BUILTIN_SKILLS.some(b => b.id === s.id))
  if (legacyNonBuiltin.length > 0) {
    const existing = new Set(perUser.map(s => s.id))
    for (const s of legacyNonBuiltin) {
      if (!existing.has(s.id)) {
        perUser.push({ ...s, ownerUserId: userId })
      }
    }
    savePerUserSkills(userId, perUser)
    // Clear legacy after migration
    const remaining = legacy.filter(s => BUILTIN_SKILLS.some(b => b.id === s.id))
    fs.writeFileSync(getUserSkillsPath(), JSON.stringify(remaining, null, 2), 'utf-8')
  }

  return [...builtins, ...perUser.filter(s => !BUILTIN_SKILLS.some(b => b.id === s.id))]
}

export const skillService = {
  /** List skills visible to a given user (builtins + user-created + user-installed) */
  list(userId?: string): Skill[] {
    return getAllSkills(userId)
  },

  /** Search skills by keyword or natural language description */
  search(query: string, userId?: string): SkillSearchResult[] {
    const lower = query.toLowerCase()
    const all = [...BUILTIN_SKILLS, ...MARKET_SKILLS, ...(userId ? loadPerUserSkills(userId) : [])]
    const unique = new Map<string, Skill>()
    for (const s of all) unique.set(s.id, s)

    const results: SkillSearchResult[] = []
    for (const skill of unique.values()) {
      let relevance = 0
      const reasons: string[] = []

      if (skill.name.toLowerCase().includes(lower)) { relevance += 50; reasons.push('技能名称匹配') }
      if (skill.description.toLowerCase().includes(lower)) { relevance += 30; reasons.push('技能描述匹配') }
      if (skill.category.toLowerCase().includes(lower)) { relevance += 20; reasons.push('技能分类匹配') }

      // Keyword expansion for common queries
      const keywordMap: Record<string, string[]> = {
        'pdf': ['pdf', 'document', '文档'],
        'excel': ['excel', '表格', 'data', '数据'],
        'ppt': ['ppt', 'presentation', '演示', 'slides'],
        'word': ['word', 'document', '文档'],
        'email': ['email', 'mail', '邮件', '邮箱'],
        'translate': ['translate', '翻译', '语言', 'language'],
        'stock': ['stock', '股票', 'finance', 'financial', '金融'],
        'calendar': ['calendar', '日历', '日程', 'schedule'],
        'image': ['image', '图像', '图片', 'imagegen', 'creative'],
        'chart': ['chart', '图表', 'visualization', '数据可视化', 'dataviz'],
        'search': ['search', '搜索', 'websearch'],
        'data': ['data', '数据', '数据分析'],
      }

      for (const [key, keywords] of Object.entries(keywordMap)) {
        if (lower.includes(key) && keywords.some(k => skill.category.includes(k) || skill.name.includes(k) || skill.description.toLowerCase().includes(k))) {
          relevance += 15
          if (!reasons.includes('智能匹配')) reasons.push('智能匹配')
          break
        }
      }

      if (relevance > 0) {
        results.push({ skill, relevance, matchReason: reasons.join('，') })
      }
    }

    results.sort((a, b) => b.relevance - a.relevance)
    return results
  },

  /** Install a skill from the market (per-user) */
  install(skillId: string, userId?: string): SkillInstallResult {
    const marketSkill = MARKET_SKILLS.find((s) => s.id === skillId)
    if (!marketSkill) {
      const existing = BUILTIN_SKILLS.find((s) => s.id === skillId)
      if (existing) return { success: false, error: '该技能已内置安装' }
      return { success: false, error: `找不到技能: ${skillId}` }
    }

    if (marketSkill.securityWarnings && marketSkill.securityWarnings.length > 0) {
      // In a real app, we'd prompt the user. Here we return warnings.
    }

    const installed: StoredSkill = {
      ...marketSkill,
      ownerUserId: userId,
      installed: true,
      enabled: true,
      installedAt: Date.now(),
      source: 'market',
      permissions: marketSkill.permissions?.map((p) => ({ ...p, granted: true })) || [],
    }

    if (userId) {
      const userSkills = loadPerUserSkills(userId)
      const idx = userSkills.findIndex((s) => s.id === skillId)
      if (idx >= 0) userSkills[idx] = installed
      else userSkills.push(installed)
      savePerUserSkills(userId, userSkills)
    }

    return { success: true, skill: installed, warnings: marketSkill.securityWarnings }
  },

  /** Uninstall a skill (per-user) */
  uninstall(skillId: string, userId?: string): SkillInstallResult {
    if (!userId) return { success: false, error: '需要登录' }
    const userSkills = loadPerUserSkills(userId)
    const idx = userSkills.findIndex((s) => s.id === skillId)
    if (idx < 0) return { success: false, error: '技能未安装' }
    const removed = userSkills.splice(idx, 1)[0]
    savePerUserSkills(userId, userSkills)
    return { success: true, skill: { ...removed, installed: false, enabled: false } }
  },

  /** Toggle skill enabled/disabled */
  toggle(skillId: string, enabled: boolean, userId?: string): SkillInstallResult {
    const all = getAllSkills(userId)
    const skill = all.find((s) => s.id === skillId)
    if (!skill) return { success: false, error: '技能不存在' }

    if (userId) {
      const userSkills = loadPerUserSkills(userId)
      const idx = userSkills.findIndex((s) => s.id === skillId)
      const updated = { ...skill, enabled } as StoredSkill
      if (idx >= 0) userSkills[idx] = updated
      else userSkills.push(updated)
      savePerUserSkills(userId, userSkills)
    }

    return { success: true, skill: { ...skill, enabled } }
  },

  /** Batch uninstall multiple skills */
  batchUninstall(skillIds: string[], userId?: string): { success: boolean; uninstalled: string[]; errors: string[] } {
    const uninstalled: string[] = []
    const errors: string[] = []
    for (const id of skillIds) {
      const result = this.uninstall(id, userId)
      if (result.success) uninstalled.push(id)
      else errors.push(id)
    }
    return { success: errors.length === 0, uninstalled, errors }
  },

  /** Create a new skill via AI description (owned by userId) */
  create(description: string, userId?: string): SkillInstallResult {
    const id = `skill-user-${uuid()}`
    const skill: StoredSkill = {
      id,
      name: description.slice(0, 30),
      description,
      category: 'custom',
      version: '0.1.0',
      author: 'User',
      ownerUserId: userId,
      installed: true,
      enabled: true,
      source: 'upload',
      installedAt: Date.now(),
      permissions: [
        { type: 'file-read', description: '读取文件', granted: true },
        { type: 'file-write', description: '写入文件', granted: true },
        { type: 'network', description: '访问网络', granted: true },
      ],
    }
    if (userId) {
      const userSkills = loadPerUserSkills(userId)
      userSkills.push(skill)
      savePerUserSkills(userId, userSkills)
    }
    return { success: true, skill }
  },

  /** Upload a .skill package file (owned by userId) */
  uploadPackage(filePath: string, userId?: string): SkillInstallResult {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const pkg: SkillPackage = JSON.parse(content)

      const skill: StoredSkill = {
        id: `skill-upload-${pkg.id || uuid()}`,
        name: pkg.name,
        description: pkg.description,
        category: pkg.category || 'custom',
        version: pkg.version,
        author: pkg.author,
        ownerUserId: userId,
        installed: true,
        enabled: true,
        source: 'upload',
        installedAt: Date.now(),
        permissions: pkg.permissions,
        size: pkg.size,
      }

      if (userId) {
        const userSkills = loadPerUserSkills(userId)
        userSkills.push(skill)
        savePerUserSkills(userId, userSkills)
      }
      return { success: true, skill, warnings: skill.permissions?.map((p) => `需要${p.description}`) }
    } catch (err) {
      return { success: false, error: `技能包解析失败: ${err instanceof Error ? err.message : String(err)}` }
    }
  },

  /** Update an existing skill's metadata and content */
  update(skillId: string, params: SkillUpdateParams, userId?: string): SkillInstallResult {
    if (!userId) return { success: false, error: '需要登录' }
    const userSkills = loadPerUserSkills(userId)
    const idx = userSkills.findIndex((s) => s.id === skillId)
    if (idx < 0) return { success: false, error: '技能不存在或无权限修改' }

    const existing = userSkills[idx]
    const updated: StoredSkill = {
      ...existing,
      name: params.name ?? existing.name,
      description: params.description ?? existing.description,
      category: params.category ?? existing.category,
      version: params.version ?? existing.version,
      author: params.author ?? existing.author,
      permissions: params.permissions ?? existing.permissions,
      triggers: params.triggers ?? existing.triggers,
      icon: params.icon !== undefined ? params.icon : existing.icon,
      updatedAt: Date.now(),
    }
    userSkills[idx] = updated
    savePerUserSkills(userId, userSkills)
    return { success: true, skill: updated }
  },

  /** Scan a .skill file for security warnings without installing */
  scanSecurity(filePath: string): { warnings: string[]; permissions: SkillPermission[] } {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const pkg: SkillPackage = JSON.parse(content)
      const warnings: string[] = []

      for (const perm of pkg.permissions || []) {
        if (perm.type === 'file-delete') warnings.push('该技能包含文件删除权限')
        if (perm.type === 'shell') warnings.push('该技能包含Shell命令执行权限')
        if (perm.type === 'browser') warnings.push('该技能包含浏览器控制权限')
        if (perm.type === 'external-api') warnings.push('该技能会向第三方服务发送数据')
        if (perm.type === 'clipboard') warnings.push('该技能会访问剪贴板内容')
      }

      if (pkg.dependencies && pkg.dependencies.length > 0) {
        warnings.push(`该技能依赖以下包: ${pkg.dependencies.join(', ')}`)
      }

      return { warnings, permissions: pkg.permissions }
    } catch {
      return { warnings: ['无法解析技能包文件'], permissions: [] }
    }
  },

  /** Get market skills (not yet installed) */
  getMarketSkills(): Skill[] {
    const installed = new Set(getAllSkills().filter((s) => s.installed).map((s) => s.id))
    return MARKET_SKILLS.filter((s) => !installed.has(s.id))
  },
}
