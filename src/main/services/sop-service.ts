// ============================================================
// SOP skill library — local CRUD / lifecycle / versions
// Resource ACL consumes auth actor (auth-001); Phase E isolation
// TODO: replace persistence with FastAPI /api/skills when stable
// ============================================================

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import type { Actor } from '../../lib/auth-types'
import { isAdmin } from '../../lib/auth-types'
import type {
  SkillCard,
  SkillVersion,
  SopCreateParams,
  SopListParams,
  SopSkill,
  SopSkillSummary,
  SopUpdateParams,
} from '../../lib/sop-types'
import { emptySkillCard, skillCardFromStepsText } from '../../lib/sop-types'

interface StoreFile {
  skills: SopSkill[]
  versions: SkillVersion[]
}

const DEFAULT_TENANT = 'local'
/** Default owner for legacy rows missing ownerUserId — seeded admin */
const LEGACY_OWNER = 'u_admin'

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'sop')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getStorePath(): string {
  return path.join(getDataDir(), 'skills-store.json')
}

function now(): number {
  return Date.now()
}

function withAliases(skill: SopSkill): SopSkill {
  return {
    ...skill,
    skill_id: skill.skillId,
    business_domain: skill.businessDomain,
    owner_user_id: skill.ownerUserId,
    tenant_id: skill.tenantId,
  }
}

function toSummary(skill: SopSkill): SopSkillSummary {
  const s = withAliases(skill)
  return {
    id: s.id,
    skillId: s.skillId,
    skill_id: s.skillId,
    name: s.name,
    businessDomain: s.businessDomain,
    business_domain: s.businessDomain,
    description: s.description,
    status: s.status,
    version: s.version,
    isOverall: s.isOverall,
    updatedAt: s.updatedAt,
    ownerUserId: s.ownerUserId,
    owner_user_id: s.ownerUserId,
    tenantId: s.tenantId,
    tenant_id: s.tenantId,
  }
}

function migrateSkill(skill: SopSkill): SopSkill {
  const ownerUserId = skill.ownerUserId || skill.owner_user_id || LEGACY_OWNER
  const tenantId = skill.tenantId || skill.tenant_id || DEFAULT_TENANT
  return withAliases({ ...skill, ownerUserId, tenantId })
}

/** Can view in「我的库」list / get — owner or tenant admin (Phase 1 demo). */
function canViewLibrary(actor: Actor, skill: SopSkill): boolean {
  if (skill.tenantId && skill.tenantId !== actor.tenantId) return false
  if (isAdmin(actor)) return true
  return skill.ownerUserId === actor.userId
}

/** Write / lifecycle — owner or tenant admin (Phase 1). */
function canEdit(actor: Actor, skill: SopSkill): boolean {
  if (skill.tenantId && skill.tenantId !== actor.tenantId) return false
  if (isAdmin(actor)) return true
  return skill.ownerUserId === actor.userId
}

function deny(msg: string): { error: string; code: string } {
  return { error: msg, code: 'FORBIDDEN' }
}

/** Seed data — ≥3 items, mixed status; each row has ownerUserId. */
function seedSkills(): SopSkill[] {
  const t = now()
  const contractCard: SkillCard = {
    nodes: [
      { nodeId: 'start', name: '开始', type: 'start', instruction: '接收合同文本' },
      { nodeId: 'step-1', name: '识别合同类型', type: 'process', instruction: '识别合同类型与适用模板' },
      { nodeId: 'step-2', name: '风险条款审查', type: 'process', instruction: '标注高风险条款并给出修改建议' },
      { nodeId: 'end', name: '结束', type: 'end', instruction: '输出审查报告' },
    ],
    edges: [
      { from: 'start', to: 'step-1' },
      { from: 'step-1', to: 'step-2' },
      { from: 'step-2', to: 'end' },
    ],
    triggerIntents: ['合同审核', '法务审查'],
  }
  const expenseCard: SkillCard = {
    nodes: [
      { nodeId: 'start', name: '开始', type: 'start', instruction: '收到报销单' },
      { nodeId: 'step-1', name: '单据校验', type: 'process', instruction: '校验发票与金额一致性' },
      { nodeId: 'step-2', name: '额度核对', type: 'decision', condition: '是否超额度', instruction: '核对部门额度与政策' },
      { nodeId: 'step-3', name: '审批流转', type: 'action', instruction: '按金额路由审批人' },
      { nodeId: 'end', name: '结束', type: 'end', instruction: '归档报销结果' },
    ],
    edges: [
      { from: 'start', to: 'step-1' },
      { from: 'step-1', to: 'step-2' },
      { from: 'step-2', to: 'step-3' },
      { from: 'step-3', to: 'end' },
    ],
    triggerIntents: ['报销', '费用审批'],
  }
  const codeCard: SkillCard = {
    nodes: [
      { nodeId: 'start', name: '开始', type: 'start', instruction: '收到 PR' },
      { nodeId: 'step-1', name: '规范检查', type: 'process', instruction: '检查命名、测试与安全清单' },
      { nodeId: 'step-2', name: '给出结论', type: 'action', instruction: '输出通过/修改意见' },
      { nodeId: 'end', name: '结束', type: 'end', instruction: '完成审查' },
    ],
    edges: [
      { from: 'start', to: 'step-1' },
      { from: 'step-1', to: 'step-2' },
      { from: 'step-2', to: 'end' },
    ],
  }
  const meetingCard: SkillCard = {
    nodes: [
      { nodeId: 'start', name: '开始', type: 'start', instruction: '收到会议材料' },
      { nodeId: 'step-1', name: '结构化纪要', type: 'process', instruction: '提取议题、结论与待办' },
      { nodeId: 'end', name: '结束', type: 'end', instruction: '输出纪要草稿' },
    ],
    edges: [
      { from: 'start', to: 'step-1' },
      { from: 'step-1', to: 'end' },
    ],
  }
  const onboardingCard: SkillCard = {
    nodes: [
      { nodeId: 'start', name: '开始', type: 'start', instruction: '新员工入职' },
      { nodeId: 'step-1', name: '账号开通', type: 'process', instruction: '开通邮箱与内部系统' },
      { nodeId: 'end', name: '结束', type: 'end', instruction: '完成入职清单' },
    ],
    edges: [
      { from: 'start', to: 'step-1' },
      { from: 'step-1', to: 'end' },
    ],
  }

  return [
    {
      id: 'sop-contract-review',
      skillId: 'contract-review',
      name: '合同审核流程',
      businessDomain: '法务',
      description: '法务合同条款审查、风险标注与修改建议',
      status: 'published',
      version: 2,
      isOverall: true,
      contentJson: contractCard,
      createdAt: t - 86400000 * 10,
      updatedAt: t - 86400000 * 2,
      createdBy: 'u_admin',
      ownerUserId: 'u_admin',
      tenantId: DEFAULT_TENANT,
    },
    {
      id: 'sop-expense-approve',
      skillId: 'expense-approve',
      name: '报销审批流程',
      businessDomain: '行政',
      description: '费用单据校验、额度核对与审批流转',
      status: 'published',
      version: 1,
      isOverall: true,
      contentJson: expenseCard,
      createdAt: t - 86400000 * 8,
      updatedAt: t - 86400000,
      createdBy: 'u_admin',
      ownerUserId: 'u_admin',
      tenantId: DEFAULT_TENANT,
    },
    {
      id: 'sop-code-review',
      skillId: 'code-review',
      name: '研发代码审查 SOP',
      businessDomain: '研发',
      description: 'PR 规范性、安全与性能检查清单',
      status: 'published',
      version: 2,
      isOverall: true,
      contentJson: codeCard,
      createdAt: t - 86400000 * 6,
      updatedAt: t - 86400000 * 3,
      createdBy: 'u_zhangsan',
      ownerUserId: 'u_zhangsan',
      tenantId: DEFAULT_TENANT,
    },
    {
      id: 'sop-meeting-notes',
      skillId: 'meeting-notes',
      name: '会议纪要整理',
      businessDomain: '通用',
      description: '录音/纪要结构化与待办提取（张三私有草稿）',
      status: 'draft',
      version: 1,
      isOverall: false,
      contentJson: meetingCard,
      createdAt: t - 86400000 * 1,
      updatedAt: t - 3600000,
      createdBy: 'u_zhangsan',
      ownerUserId: 'u_zhangsan',
      tenantId: DEFAULT_TENANT,
    },
    {
      id: 'sop-onboarding-lisi',
      skillId: 'onboarding-checklist',
      name: '入职清单（李四草稿）',
      businessDomain: '人事',
      description: '李四私有草稿，用于验证成员间库隔离',
      status: 'draft',
      version: 1,
      isOverall: false,
      contentJson: onboardingCard,
      createdAt: t - 86400000 * 2,
      updatedAt: t - 7200000,
      createdBy: 'u_lisi',
      ownerUserId: 'u_lisi',
      tenantId: DEFAULT_TENANT,
    },
  ].map((s) => withAliases(s as SopSkill))
}

function loadStore(): StoreFile {
  const p = getStorePath()
  if (!fs.existsSync(p)) {
    const skills = seedSkills()
    const versions: SkillVersion[] = skills.map((s) => ({
      id: uuid(),
      skillId: s.id,
      version: s.version,
      contentJson: s.contentJson,
      createdAt: s.createdAt,
      createdBy: s.createdBy,
    }))
    const store = { skills, versions }
    fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf-8')
    return store
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as StoreFile
    if (!Array.isArray(raw.skills) || raw.skills.length === 0) {
      const skills = seedSkills()
      const store = { skills, versions: raw.versions || [] }
      fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf-8')
      return store
    }
    let dirty = false
    const ownerBySeedId: Record<string, string> = {
      'sop-contract-review': 'u_admin',
      'sop-expense-approve': 'u_admin',
      'sop-code-review': 'u_zhangsan',
      'sop-meeting-notes': 'u_zhangsan',
      'sop-onboarding-lisi': 'u_lisi',
    }
    const skills = raw.skills.map((s) => {
      const preferredOwner = ownerBySeedId[s.id]
      const needsOwner = !s.ownerUserId && !s.owner_user_id
      const migrated = migrateSkill({
        ...s,
        ownerUserId: s.ownerUserId || s.owner_user_id || preferredOwner || LEGACY_OWNER,
        tenantId: s.tenantId || s.tenant_id || DEFAULT_TENANT,
      })
      if (needsOwner || !s.tenantId) dirty = true
      return migrated
    })
    // Ensure Phase E demo draft for lisi exists when upgrading old stores
    if (!skills.some((s) => s.id === 'sop-onboarding-lisi')) {
      const seeded = seedSkills().find((s) => s.id === 'sop-onboarding-lisi')
      if (seeded) {
        skills.push(seeded)
        dirty = true
      }
    }
    const store = {
      skills,
      versions: Array.isArray(raw.versions) ? raw.versions : [],
    }
    if (dirty) saveStore(store)
    return store
  } catch {
    const skills = seedSkills()
    const store = { skills, versions: [] as SkillVersion[] }
    fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf-8')
    return store
  }
}

function saveStore(store: StoreFile): void {
  fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2), 'utf-8')
}

function findSkill(store: StoreFile, id: string): SopSkill | undefined {
  return store.skills.find((s) => s.id === id)
}

function snapshotVersion(store: StoreFile, skill: SopSkill, createdBy?: string): void {
  store.versions.push({
    id: uuid(),
    skillId: skill.id,
    version: skill.version,
    contentJson: structuredClone(skill.contentJson),
    createdAt: now(),
    createdBy,
  })
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return base || `sop-${Date.now().toString(36)}`
}

export const sopService = {
  list(actor: Actor, params: SopListParams = {}): SopSkillSummary[] {
    const store = loadStore()
    const status = params.status && params.status !== 'all' ? params.status : ''
    const q = (params.q || '').trim().toLowerCase()
    return store.skills
      .filter((s) => canViewLibrary(actor, s))
      .filter((s) => !status || s.status === status)
      .filter((s) => {
        if (!q) return true
        return (
          (s.name || '').toLowerCase().includes(q)
          || (s.skillId || '').toLowerCase().includes(q)
          || (s.businessDomain || '').toLowerCase().includes(q)
          || (s.description || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map(toSummary)
  },

  get(actor: Actor, id: string): { skill: SopSkill } | { error: string; code?: string } {
    const skill = findSkill(loadStore(), id)
    if (!skill) return { error: 'SOP 不存在', code: 'NOT_FOUND' }
    if (!canViewLibrary(actor, skill)) {
      return deny('无权查看该 SOP（不属于当前用户库）')
    }
    return { skill: withAliases(skill) }
  },

  create(actor: Actor, params: SopCreateParams = {}): { skill: SopSkill } {
    const store = loadStore()
    const t = now()
    let skillId = (params.skillId || '').trim() || slugify(params.name || 'untitled')
    if (store.skills.some((s) => s.skillId === skillId && s.ownerUserId === actor.userId)) {
      skillId = `${skillId}-${Date.now().toString(36).slice(-4)}`
    }
    const skill: SopSkill = withAliases({
      id: `sop-${uuid()}`,
      skillId,
      name: (params.name || '').trim() || '未命名 SOP',
      businessDomain: params.businessDomain,
      description: params.description || '',
      status: 'draft',
      version: 1,
      isOverall: false,
      contentJson: params.contentJson || emptySkillCard(),
      createdAt: t,
      updatedAt: t,
      createdBy: actor.userId,
      ownerUserId: actor.userId,
      tenantId: actor.tenantId,
    })
    store.skills.unshift(skill)
    snapshotVersion(store, skill, actor.userId)
    saveStore(store)
    return { skill }
  },

  update(actor: Actor, id: string, params: SopUpdateParams): { skill: SopSkill } | { error: string; code?: string } {
    const store = loadStore()
    const skill = findSkill(store, id)
    if (!skill) return { error: 'SOP 不存在', code: 'NOT_FOUND' }
    if (!canEdit(actor, skill)) return deny('无权编辑该 SOP')
    if (skill.status === 'archived') return { error: '已归档 SOP 不可编辑' }

    if (params.name !== undefined) skill.name = params.name.trim() || skill.name
    if (params.businessDomain !== undefined) skill.businessDomain = params.businessDomain
    if (params.description !== undefined) skill.description = params.description
    if (params.isOverall !== undefined) skill.isOverall = params.isOverall

    if (params.contentJson) {
      skill.contentJson = params.contentJson
    } else if (params.stepsText !== undefined) {
      skill.contentJson = skillCardFromStepsText(params.stepsText)
    }

    if (skill.status === 'published') {
      skill.status = 'draft'
    }

    skill.updatedAt = now()
    Object.assign(skill, withAliases(skill))
    saveStore(store)
    return { skill: withAliases(skill) }
  },

  delete(actor: Actor, id: string): { ok: true } | { error: string; code?: string } {
    const store = loadStore()
    const skill = findSkill(store, id)
    if (!skill) return { error: 'SOP 不存在', code: 'NOT_FOUND' }
    if (!canEdit(actor, skill)) return deny('无权删除该 SOP')
    if (skill.status === 'published') {
      return { error: '已发布 SOP 请先转草稿或归档后再删除' }
    }
    store.skills = store.skills.filter((s) => s.id !== id)
    store.versions = store.versions.filter((v) => v.skillId !== id)
    saveStore(store)
    return { ok: true }
  },

  publish(actor: Actor, id: string): { skill: SopSkill } | { error: string; code?: string } {
    const store = loadStore()
    const skill = findSkill(store, id)
    if (!skill) return { error: 'SOP 不存在', code: 'NOT_FOUND' }
    if (!canEdit(actor, skill)) return deny('无权发布该 SOP')
    if (skill.status === 'archived') return { error: '已归档不可发布' }
    if (!skill.contentJson?.nodes?.length) return { error: '内容为空，无法发布' }

    skill.status = 'published'
    skill.version += 1
    skill.isOverall = true
    skill.updatedAt = now()
    snapshotVersion(store, skill, actor.userId)
    Object.assign(skill, withAliases(skill))
    saveStore(store)
    return { skill: withAliases(skill) }
  },

  draft(actor: Actor, id: string): { skill: SopSkill } | { error: string; code?: string } {
    const store = loadStore()
    const skill = findSkill(store, id)
    if (!skill) return { error: 'SOP 不存在', code: 'NOT_FOUND' }
    if (!canEdit(actor, skill)) return deny('无权操作该 SOP')
    if (skill.status !== 'published') return { error: '仅已发布 SOP 可转草稿' }
    skill.status = 'draft'
    skill.updatedAt = now()
    Object.assign(skill, withAliases(skill))
    saveStore(store)
    return { skill: withAliases(skill) }
  },

  archive(actor: Actor, id: string): { skill: SopSkill } | { error: string; code?: string } {
    const store = loadStore()
    const skill = findSkill(store, id)
    if (!skill) return { error: 'SOP 不存在', code: 'NOT_FOUND' }
    if (!canEdit(actor, skill)) return deny('无权归档该 SOP')
    if (skill.status === 'archived') return { error: '已是归档状态' }
    skill.status = 'archived'
    skill.updatedAt = now()
    Object.assign(skill, withAliases(skill))
    saveStore(store)
    return { skill: withAliases(skill) }
  },

  versions(actor: Actor, id: string): { versions: SkillVersion[] } | { error: string; code?: string } {
    const store = loadStore()
    const skill = findSkill(store, id)
    if (!skill) return { error: 'SOP 不存在', code: 'NOT_FOUND' }
    if (!canViewLibrary(actor, skill)) return deny('无权查看该 SOP')
    const versions = store.versions
      .filter((v) => v.skillId === id)
      .sort((a, b) => b.version - a.version)
    return { versions }
  },

  rollback(actor: Actor, id: string, version: number): { skill: SopSkill } | { error: string; code?: string } {
    const store = loadStore()
    const skill = findSkill(store, id)
    if (!skill) return { error: 'SOP 不存在', code: 'NOT_FOUND' }
    if (!canEdit(actor, skill)) return deny('无权回滚该 SOP')
    const snap = store.versions.find((v) => v.skillId === id && v.version === version)
    if (!snap) return { error: `版本 v${version} 不存在` }

    skill.contentJson = structuredClone(snap.contentJson)
    skill.version = Math.max(...store.versions.filter((v) => v.skillId === id).map((v) => v.version), skill.version) + 1
    if (skill.status === 'published') skill.status = 'draft'
    skill.updatedAt = now()
    snapshotVersion(store, skill, actor.userId)
    Object.assign(skill, withAliases(skill))
    saveStore(store)
    return { skill: withAliases(skill) }
  },

  deleteVersion(actor: Actor, id: string, version: number): { ok: true } | { error: string; code?: string } {
    const store = loadStore()
    const skill = findSkill(store, id)
    if (!skill) return { error: 'SOP 不存在', code: 'NOT_FOUND' }
    if (!canEdit(actor, skill)) return deny('无权操作该 SOP')
    const owned = store.versions.filter((v) => v.skillId === id)
    if (owned.length <= 1) return { error: '不可删除当前唯一版本' }
    if (version === skill.version) return { error: '不可删除当前使用中的版本，请先回滚到其他版本' }
    const before = store.versions.length
    store.versions = store.versions.filter((v) => !(v.skillId === id && v.version === version))
    if (store.versions.length === before) return { error: '版本不存在' }
    saveStore(store)
    return { ok: true }
  },

  squareList(actor: Actor, q?: string): SopSkillSummary[] {
    const store = loadStore()
    const query = (q || '').trim().toLowerCase()
    return store.skills
      .filter((s) => (!s.tenantId || s.tenantId === actor.tenantId)
        && s.status === 'published'
        && s.isOverall)
      .filter((s) => {
        if (!query) return true
        return (
          (s.name || '').toLowerCase().includes(query)
          || (s.skillId || '').toLowerCase().includes(query)
          || (s.businessDomain || '').toLowerCase().includes(query)
        )
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map(toSummary)
  },

  cloneFromSquare(actor: Actor, sourceId: string): { skill: SopSkill } | { error: string; code?: string } {
    const store = loadStore()
    const source = findSkill(store, sourceId)
    if (!source) return { error: '源 SOP 不存在', code: 'NOT_FOUND' }
    if (!(source.status === 'published' && source.isOverall)) {
      return { error: '仅可从广场已发布 SOP 复制' }
    }
    if (source.tenantId && source.tenantId !== actor.tenantId) {
      return deny('跨租户不可复制')
    }
    const t = now()
    let skillId = `${source.skillId}-copy`
    if (store.skills.some((s) => s.skillId === skillId && s.ownerUserId === actor.userId)) {
      skillId = `${skillId}-${Date.now().toString(36).slice(-4)}`
    }
    const skill: SopSkill = withAliases({
      id: `sop-${uuid()}`,
      skillId,
      name: `${source.name}（副本）`,
      businessDomain: source.businessDomain,
      description: source.description,
      status: 'draft',
      version: 1,
      isOverall: false,
      contentJson: structuredClone(source.contentJson),
      createdAt: t,
      updatedAt: t,
      createdBy: actor.userId,
      ownerUserId: actor.userId,
      tenantId: actor.tenantId,
    })
    store.skills.unshift(skill)
    snapshotVersion(store, skill, actor.userId)
    saveStore(store)
    return { skill }
  },

  /** MVP distill: build SkillCard from natural language lines (no real LLM). */
  distillMock(text: string): { contentJson: SkillCard; steps: string[] } {
    const contentJson = skillCardFromStepsText(text)
    const steps = [
      'generate',
      'parse',
      'repair',
      'segment_fallback',
      'normalize',
      'reflect',
      'complete',
    ]
    return { contentJson, steps }
  },
}
