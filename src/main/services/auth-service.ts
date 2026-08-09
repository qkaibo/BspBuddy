// ============================================================
// Auth service — local session + member RBAC (auth-001 Phase 1)
// TODO: replace with real auth session (JWT + FastAPI /api/auth)
// ============================================================

import { app } from 'electron'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import type {
  Actor,
  AuthError,
  AuthLoginParams,
  AuthLoginResult,
  AuthMeResult,
  AuthUserCreateParams,
  AuthUserUpdateParams,
  AuthUsersListParams,
  MemberStatus,
  PublicUser,
  RoleId,
} from '../../lib/auth-types'
import { isAdmin } from '../../lib/auth-types'

const LOCAL_TENANT_ID = 'local'
const LOCAL_TENANT_NAME = '本地开发租户'
const PBKDF2_ITERATIONS = 100_000
const SALT_BYTES = 16
const KEY_LEN = 32

interface StoredMember {
  id: string
  tenantId: string
  username: string
  displayName?: string
  roles: RoleId[]
  status: MemberStatus
  passwordHash: string
  avatarUrl?: string
  createdAt: number
  updatedAt: number
}

interface MembersStore {
  tenantId: string
  tenantName: string
  members: StoredMember[]
}

interface SessionStore {
  /** Opaque Phase-1 token; shape reserved for JWT swap. */
  token: string | null
  userId: string | null
  /** Unix seconds — optional, aligned with JWT exp */
  exp: number | null
}

function getAuthDir(): string {
  const dir = path.join(app.getPath('userData'), 'auth')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function membersPath(): string {
  return path.join(getAuthDir(), 'members.json')
}

function sessionPath(): string {
  return path.join(getAuthDir(), 'session.json')
}

function now(): number {
  return Date.now()
}

function hashPassword(password: string, salt?: Buffer): string {
  const s = salt || crypto.randomBytes(SALT_BYTES)
  const hash = crypto.pbkdf2Sync(password, s, PBKDF2_ITERATIONS, KEY_LEN, 'sha256')
  return `${s.toString('hex')}:${hash.toString('hex')}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const actual = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, 'sha256')
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

function toPublic(m: StoredMember): PublicUser {
  return {
    id: m.id,
    tenantId: m.tenantId,
    username: m.username,
    displayName: m.displayName,
    roles: [...m.roles],
    status: m.status,
    avatarUrl: m.avatarUrl,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }
}

function toActor(m: StoredMember): Actor {
  return {
    tenantId: m.tenantId || LOCAL_TENANT_ID,
    userId: m.id,
    username: m.username,
    roles: Array.isArray(m.roles) ? [...m.roles] : ['member'],
  }
}

function seedMembers(): MembersStore {
  const t = now()
  return {
    tenantId: LOCAL_TENANT_ID,
    tenantName: LOCAL_TENANT_NAME,
    members: [
      {
        id: 'u_admin',
        tenantId: LOCAL_TENANT_ID,
        username: 'admin',
        displayName: '管理员',
        roles: ['admin'],
        status: 'active',
        passwordHash: hashPassword('admin'),
        createdAt: t - 86400000 * 30,
        updatedAt: t - 86400000 * 2,
      },
      {
        id: 'u_zhangsan',
        tenantId: LOCAL_TENANT_ID,
        username: 'zhangsan',
        displayName: '张三',
        roles: ['member'],
        status: 'active',
        passwordHash: hashPassword('member123'),
        createdAt: t - 86400000 * 20,
        updatedAt: t - 86400000,
      },
      {
        id: 'u_lisi',
        tenantId: LOCAL_TENANT_ID,
        username: 'lisi',
        displayName: '李四',
        roles: ['member'],
        status: 'active',
        passwordHash: hashPassword('member123'),
        createdAt: t - 86400000 * 10,
        updatedAt: t - 3600000,
      },
    ],
  }
}

function loadMembers(): MembersStore {
  const p = membersPath()
  if (!fs.existsSync(p)) {
    const store = seedMembers()
    fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf-8')
    return store
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as MembersStore
    if (!Array.isArray(raw.members) || raw.members.length === 0) {
      const store = seedMembers()
      fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf-8')
      return store
    }
    return {
      tenantId: raw.tenantId || LOCAL_TENANT_ID,
      tenantName: raw.tenantName || LOCAL_TENANT_NAME,
      members: raw.members,
    }
  } catch {
    const store = seedMembers()
    fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf-8')
    return store
  }
}

function saveMembers(store: MembersStore): void {
  fs.writeFileSync(membersPath(), JSON.stringify(store, null, 2), 'utf-8')
}

function loadSession(): SessionStore {
  const p = sessionPath()
  if (!fs.existsSync(p)) return { token: null, userId: null, exp: null }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as SessionStore
  } catch {
    return { token: null, userId: null, exp: null }
  }
}

function saveSession(session: SessionStore): void {
  fs.writeFileSync(sessionPath(), JSON.stringify(session, null, 2), 'utf-8')
}

function findMember(store: MembersStore, id: string): StoredMember | undefined {
  return store.members.find((m) => m.id === id)
}

function countActiveAdmins(store: MembersStore, excludeUserId?: string): number {
  return store.members.filter(
    (m) =>
      m.id !== excludeUserId
      && m.status === 'active'
      && m.roles.includes('admin'),
  ).length
}

function err(code: AuthError['code'], message: string): AuthError {
  return { error: message, code }
}

class AuthService {
  private members: MembersStore | null = null
  private session: SessionStore | null = null

  private ensureLoaded(): void {
    if (this.members && this.session) return
    this.members = loadMembers()
    this.session = loadSession()
    // Phase 1: ensure a local mock session exists so downstream IPC always has an actor
    // TODO: replace with real auth session
    if (!this.session.userId || !findMember(this.members, this.session.userId)) {
      const admin = this.members.members.find((m) => m.username === 'admin' && m.status === 'active')
        || this.members.members[0]
      if (admin) {
        this.session = {
          token: `local.${admin.id}.${Date.now()}`,
          userId: admin.id,
          exp: Math.floor(Date.now() / 1000) + 14 * 24 * 3600,
        }
        saveSession(this.session)
      }
    }
  }

  getTenantName(): string {
    this.ensureLoaded()
    return this.members!.tenantName
  }

  getActor(): Actor | null {
    this.ensureLoaded()
    if (!this.session!.userId) return null
    if (this.session!.exp && this.session!.exp * 1000 < Date.now()) {
      return null
    }
    const m = findMember(this.members!, this.session!.userId)
    if (!m || m.status !== 'active') return null
    return toActor(m)
  }

  requireActor(): Actor {
    const actor = this.getActor()
    if (!actor) {
      const e = new Error('AUTH_REQUIRED') as Error & { code: string }
      e.code = 'AUTH_REQUIRED'
      throw e
    }
    return actor
  }

  requireAdmin(): Actor {
    const actor = this.requireActor()
    if (!isAdmin(actor)) {
      const e = new Error('FORBIDDEN') as Error & { code: string }
      e.code = 'FORBIDDEN'
      throw e
    }
    return actor
  }

  me(): (AuthMeResult & { phase1Local: boolean; tenantName: string }) | AuthError {
    this.ensureLoaded()
    const actor = this.getActor()
    if (!actor) return err('AUTH_REQUIRED', '未登录或会话已失效')
    const m = findMember(this.members!, actor.userId)
    if (!m) return err('AUTH_REQUIRED', '未登录或会话已失效')
    return {
      user: toPublic(m),
      actor,
      phase1Local: true,
      tenantName: this.members!.tenantName,
    }
  }

  login(params: AuthLoginParams): AuthLoginResult | AuthError {
    this.ensureLoaded()
    const tenantId = (params.tenantId || LOCAL_TENANT_ID).trim() || LOCAL_TENANT_ID
    const username = (params.username || '').trim()
    if (!username || !params.password) {
      return err('AUTH_INVALID', '用户名或密码错误')
    }
    const m = this.members!.members.find(
      (u) => u.tenantId === tenantId && u.username === username,
    )
    if (!m || !verifyPassword(params.password, m.passwordHash)) {
      return err('AUTH_INVALID', '用户名或密码错误')
    }
    if (m.status === 'disabled') {
      return err('AUTH_INVALID', '用户名或密码错误')
    }
    this.session = {
      token: `local.${m.id}.${Date.now()}`,
      userId: m.id,
      exp: Math.floor(Date.now() / 1000) + 14 * 24 * 3600,
    }
    saveSession(this.session)
    return { token: this.session.token!, user: toPublic(m) }
  }

  logout(): { ok: true } {
    this.ensureLoaded()
    this.session = { token: null, userId: null, exp: null }
    saveSession(this.session)
    return { ok: true }
  }

  /**
   * Phase 1 desktop: switch simulated local user without password prompt.
   * TODO: remove when real multi-user login replaces mock session.
   */
  switchUser(userId: string): AuthMeResult | AuthError {
    this.ensureLoaded()
    const m = findMember(this.members!, userId)
    if (!m) return err('NOT_FOUND', '成员不存在')
    if (m.status === 'disabled') return err('AUTH_INVALID', '该账号已禁用')
    this.session = {
      token: `local.${m.id}.${Date.now()}`,
      userId: m.id,
      exp: Math.floor(Date.now() / 1000) + 14 * 24 * 3600,
    }
    saveSession(this.session)
    return { user: toPublic(m), actor: toActor(m) }
  }

  listUsers(params: AuthUsersListParams = {}): { items: PublicUser[] } | AuthError {
    this.ensureLoaded()
    try {
      this.requireAdmin()
    } catch {
      return err('FORBIDDEN', '需要管理员权限')
    }
    const q = (params.q || '').trim().toLowerCase()
    const items = this.members!.members
      .filter((m) => m.tenantId === LOCAL_TENANT_ID)
      .filter((m) => {
        if (!q) return true
        return (
          m.username.toLowerCase().includes(q)
          || (m.displayName || '').toLowerCase().includes(q)
          || m.roles.some((r) => r.includes(q) || (r === 'admin' ? '管理员' : '成员').includes(q))
        )
      })
      .sort((a, b) => a.username.localeCompare(b.username))
      .map(toPublic)
    return { items }
  }

  /** Phase 1: list members for switcher (any authenticated user). */
  listMembersForSwitch(): { items: PublicUser[] } | AuthError {
    this.ensureLoaded()
    const actor = this.getActor()
    if (!actor) return err('AUTH_REQUIRED', '未登录或会话已失效')
    const items = this.members!.members
      .filter((m) => m.tenantId === actor.tenantId && m.status === 'active')
      .map(toPublic)
    return { items }
  }

  createUser(params: AuthUserCreateParams): { user: PublicUser } | AuthError {
    this.ensureLoaded()
    try {
      this.requireAdmin()
    } catch {
      return err('FORBIDDEN', '需要管理员权限')
    }
    const username = (params.username || '').trim()
    if (!username) return err('VALIDATION', '用户名必填')
    if (!params.password || params.password.length < 6) {
      return err('VALIDATION', '密码至少 6 位')
    }
    const roles = normalizeRoles(params.roles)
    if (this.members!.members.some((m) => m.tenantId === LOCAL_TENANT_ID && m.username === username)) {
      return err('VALIDATION', '用户名已存在')
    }
    const t = now()
    const member: StoredMember = {
      id: `u_${uuid().slice(0, 8)}`,
      tenantId: LOCAL_TENANT_ID,
      username,
      displayName: params.displayName?.trim() || undefined,
      roles,
      status: 'active',
      passwordHash: hashPassword(params.password),
      createdAt: t,
      updatedAt: t,
    }
    this.members!.members.push(member)
    saveMembers(this.members!)
    return { user: toPublic(member) }
  }

  updateUser(userId: string, params: AuthUserUpdateParams): { user: PublicUser } | AuthError {
    this.ensureLoaded()
    try {
      this.requireAdmin()
    } catch {
      return err('FORBIDDEN', '需要管理员权限')
    }
    const m = findMember(this.members!, userId)
    if (!m) return err('NOT_FOUND', '成员不存在')

    if (params.roles) {
      const nextRoles = normalizeRoles(params.roles)
      const removingAdmin = m.roles.includes('admin') && !nextRoles.includes('admin')
      if (removingAdmin && countActiveAdmins(this.members!, m.id) < 1) {
        return err('LAST_ADMIN', '不可移除最后一个管理员')
      }
      m.roles = nextRoles
    }

    if (params.status === 'disabled') {
      if (m.roles.includes('admin') && countActiveAdmins(this.members!, m.id) < 1) {
        return err('LAST_ADMIN', '不可禁用最后一个管理员')
      }
      m.status = 'disabled'
    } else if (params.status === 'active') {
      m.status = 'active'
    }

    if (params.displayName !== undefined) {
      m.displayName = params.displayName.trim() || undefined
    }
    if (params.password) {
      if (params.password.length < 6) return err('VALIDATION', '密码至少 6 位')
      m.passwordHash = hashPassword(params.password)
    }

    m.updatedAt = now()
    saveMembers(this.members!)

    if (m.status === 'disabled' && this.session!.userId === m.id) {
      this.logout()
    }

    return { user: toPublic(m) }
  }

  deleteUser(userId: string): { ok: true } | AuthError {
    this.ensureLoaded()
    let actor: Actor
    try {
      actor = this.requireAdmin()
    } catch {
      return err('FORBIDDEN', '需要管理员权限')
    }
    if (actor.userId === userId) {
      return err('CANNOT_DELETE_SELF', '不可删除自己')
    }
    const m = findMember(this.members!, userId)
    if (!m) return err('NOT_FOUND', '成员不存在')
    if (m.roles.includes('admin') && countActiveAdmins(this.members!, m.id) < 1) {
      return err('LAST_ADMIN', '不可删除最后一个管理员')
    }
    this.members!.members = this.members!.members.filter((u) => u.id !== userId)
    saveMembers(this.members!)
    if (this.session!.userId === userId) this.logout()
    return { ok: true }
  }
}

function normalizeRoles(roles: RoleId[] | undefined): RoleId[] {
  const set = new Set<RoleId>()
  for (const r of roles || []) {
    if (r === 'admin' || r === 'member') set.add(r)
  }
  if (set.size === 0) set.add('member')
  // Prefer single primary role for MVP display; keep both if both present
  return Array.from(set)
}

export const authService = new AuthService()
