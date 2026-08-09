// ============================================================
// Auth domain types — session actor + RBAC (auth-001 / auth-001-api)
// ============================================================

export type RoleId = 'member' | 'admin'

export type MemberStatus = 'active' | 'disabled'

/** Downstream services only trust this actor from main-process session. */
export interface Actor {
  tenantId: string
  userId: string
  username: string
  roles: RoleId[]
}

/** Safe user shape for renderer — never includes passwordHash. */
export interface PublicUser {
  id: string
  tenantId: string
  username: string
  displayName?: string
  roles: RoleId[]
  status: MemberStatus
  avatarUrl?: string
  createdAt: number
  updatedAt: number
}

export interface AuthLoginParams {
  tenantId?: string
  username: string
  password: string
}

export interface AuthLoginResult {
  token: string
  user: PublicUser
}

export interface AuthMeResult {
  user: PublicUser
  actor: Actor
}

export interface AuthUsersListParams {
  q?: string
}

export interface AuthUserCreateParams {
  username: string
  displayName?: string
  password: string
  roles: RoleId[]
}

export interface AuthUserUpdateParams {
  displayName?: string
  password?: string
  roles?: RoleId[]
  status?: MemberStatus
}

export type AuthErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'LAST_ADMIN'
  | 'CANNOT_DELETE_SELF'
  | 'VALIDATION'

export interface AuthError {
  error: string
  code: AuthErrorCode
}

export function isAdmin(actor: Actor): boolean {
  return Array.isArray(actor?.roles) && actor.roles.includes('admin')
}

export function roleLabel(role: RoleId): string {
  return role === 'admin' ? '管理员' : '成员'
}

export function statusLabel(status: MemberStatus): string {
  return status === 'active' ? '启用' : '禁用'
}
