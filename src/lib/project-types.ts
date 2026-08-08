// ============================================================
// Project Collaboration types for BspBuddy
// ============================================================

// ---------- Authorization modes ----------
export type AuthType = 'public' | 'personal'

export interface ConnectorAuth {
  type: AuthType
  /** Only for personal auth — never stored in cloud */
  token?: string
  /** For public auth — stored in cloud, managed by admin */
  credentials?: Record<string, string>
}

export interface ConnectorConfig {
  id: string
  name: string
  type: string
  auth: ConnectorAuth
  /** Who configured this connector */
  configuredBy?: string
  configuredAt?: number
}

// ---------- Project ----------
export interface Project {
  id: string
  name: string
  description?: string
  /** Global AI behavior instructions, inherited by all tasks */
  instructions: string
  /** Available connectors (public + personal) */
  connectors: ConnectorConfig[]
  /** Skill IDs available to this project */
  skills: string[]
  /** Expert IDs available to this project */
  experts: string[]
  members: ProjectMember[]
  storage: ProjectStorage
  assets: ProjectAsset[]
  /** Whether the project was created from a template */
  templateId?: string
  createdAt: number
  updatedAt: number
}

export interface ProjectStorage {
  used: number
  limit: number // default 5GB = 5 * 1024 * 1024 * 1024
}

// ---------- Project Member ----------
export interface ProjectMember {
  userId: string
  userName: string
  role: 'admin' | 'member'
  joinedAt: number
  /** Invitation status */
  inviteStatus?: 'pending' | 'accepted' | 'rejected'
  inviteNote?: string
}

// ---------- Project Asset (资料库) ----------
export type AssetType =
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'pdf'
  | 'image'
  | 'video'
  | 'audio'
  | 'url_bookmark'
  | 'markdown'
  | 'other'

export interface ProjectAsset {
  id: string
  name: string
  type: AssetType
  url: string
  size: number
  uploader: string
  uploaderName: string
  uploadedAt: number
  updatedAt: number
  /** File type MIME */
  mimeType?: string
  /** Tags for categorization */
  tags?: string[]
}

// ---------- Project Task ----------
export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface ProjectTask {
  id: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  assignee?: string
  assigneeName?: string
  deadline?: number
  /** Linked conversation/session ID */
  conversationId?: string
  /** Whether this is a collaborative task */
  isCollaborative?: boolean
  /** Attachments from transfer */
  attachments?: TaskAttachment[]
  /** Transfer metadata */
  transferFrom?: string
  transferNote?: string
  createdAt: number
  updatedAt: number
}

export interface TaskAttachment {
  name: string
  url: string
  size: number
  type: string
}

// ---------- Project Activity / 项目动态 ----------
export type ActivityCategory = 'related_to_me' | 'member' | 'automation'

export type ActivityEventType =
  | 'task_shared'
  | 'task_transferred'
  | 'asset_uploaded'
  | 'asset_updated'
  | 'member_invited'
  | 'member_joined'
  | 'task_created'
  | 'task_public'
  | 'skill_added'
  | 'skill_removed'
  | 'expert_added'
  | 'expert_removed'
  | 'connector_added'
  | 'connector_removed'
  | 'instruction_changed'
  | 'automation_triggered'

export interface ProjectActivity {
  id: string
  projectId: string
  category: ActivityCategory
  event: ActivityEventType
  userId: string
  userName: string
  description: string
  /** Whether only the creating user can see this */
  visibleOnlyTo?: string
  timestamp: number
}

// ---------- Project Template ----------
export interface ProjectTemplate {
  id: string
  name: string
  description: string
  instructions: string
  skills: string[]
  experts: string[]
  icon?: string
}

// ---------- Project Invite ----------
export interface ProjectInvite {
  id: string
  projectId: string
  projectName: string
  /** The invite link code */
  code: string
  createdBy: string
  createdAt: number
  expiresAt?: number
  maxUses?: number
  usedCount: number
}

// ---------- Project Automation ----------
export interface ProjectAutomation {
  id: string
  projectId: string
  name: string
  /** Only scheduled (定时) trigger is supported */
  trigger: 'scheduled'
  schedule: string // cron expression
  action: string
  createdBy: string
  /** Only the creator can see and manage */
  visibleOnlyTo: string
  enabled: boolean
  createdAt: number
}

// ---------- Dual Auth Token Management ----------
export interface AuthToken {
  id: string
  connectorId: string
  projectId: string
  type: 'public' | 'personal'
  userId?: string
  /** Encrypted token — for personal auth, stored ONLY locally */
  token: string
  /** For public auth, stored in cloud */
  expiresAt?: number
  createdAt: number
}

// ---------- Skill Platform Separation ----------
export type SkillPlatform = 'web' | 'desktop'

export interface ProjectSkillBinding {
  skillId: string
  projectId: string
  /** Cloud skills are unified across platforms */
  isProjectSkill: boolean
  /** Personal skills are separated by platform */
  platform: SkillPlatform
}

// ---------- Service response types ----------
export interface ProjectListResult {
  projects: Project[]
}

export interface ProjectCreateInput {
  name: string
  description?: string
  instructions?: string
  connectors?: ConnectorConfig[]
  skills?: string[]
  experts?: string[]
  templateId?: string
}

export interface ProjectTaskCreateInput {
  projectId: string
  title: string
  description?: string
  assignee?: string
  deadline?: number
}

export interface ProjectTaskShareInput {
  taskId: string
  /** Generate a share link */
  generateLink: boolean
}

export interface ProjectTaskTransferInput {
  taskId: string
  toUserId: string
  note?: string
  attachments?: TaskAttachment[]
}

export interface ProjectAssetUploadInput {
  projectId: string
  name: string
  type: AssetType
  url: string
  size: number
  mimeType?: string
}

// ---------- IPC Result types ----------
export interface ServiceResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
