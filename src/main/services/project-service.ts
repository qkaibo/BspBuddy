// ============================================================
// Project service — manages project lifecycle, members,
// assets, tasks, dual-auth tokens, invites, and automation
// ============================================================

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import type {
  Project, ProjectMember, ProjectAsset, ProjectTask,
  ProjectActivity, ProjectInvite, ProjectTemplate,
  ProjectAutomation, ConnectorConfig, AuthToken,
  TaskAttachment, AssetType,
  ProjectCreateInput, ProjectTaskCreateInput,
} from '../../lib/project-types'

// ============================================================
// Data persistence helpers
// ============================================================

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'projects')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getProjectsPath(): string {
  return path.join(getDataDir(), 'projects.json')
}

function getAuthTokensPath(): string {
  return path.join(getDataDir(), 'auth-tokens.json')
}

function getActivitiesPath(): string {
  return path.join(getDataDir(), 'activities.json')
}

function getInvitesPath(): string {
  return path.join(getDataDir(), 'invites.json')
}

function loadProjects(): Project[] {
  const p = getProjectsPath()
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as Project[] }
  catch { return [] }
}

function saveProjects(projects: Project[]): void {
  const dir = getDataDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getProjectsPath(), JSON.stringify(projects, null, 2), 'utf-8')
}

// ============================================================
// Dual-Auth Token Management
// Personal tokens are stored ONLY locally (never in cloud)
// Public tokens are stored in projects.json (cloud-synced)
// ============================================================

function loadAuthTokens(): AuthToken[] {
  const p = getAuthTokensPath()
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as AuthToken[] }
  catch { return [] }
}

function saveAuthTokens(tokens: AuthToken[]): void {
  fs.writeFileSync(getAuthTokensPath(), JSON.stringify(tokens, null, 2), 'utf-8')
}

function loadActivities(): ProjectActivity[] {
  const p = getActivitiesPath()
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as ProjectActivity[] }
  catch { return [] }
}

function saveActivities(activities: ProjectActivity[]): void {
  fs.writeFileSync(getActivitiesPath(), JSON.stringify(activities, null, 2), 'utf-8')
}

function loadInvites(): ProjectInvite[] {
  const p = getInvitesPath()
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as ProjectInvite[] }
  catch { return [] }
}

function saveInvites(invites: ProjectInvite[]): void {
  fs.writeFileSync(getInvitesPath(), JSON.stringify(invites, null, 2), 'utf-8')
}

// ============================================================
// Pre-built project templates
// ============================================================

const BUILTIN_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'template-dev',
    name: '软件开发',
    description: '适用于前后端开发、代码审查、技术文档等场景',
    instructions: '你是一个专业的软件工程师，精通多种编程语言和框架。请确保代码质量、添加必要注释、遵循最佳实践。',
    skills: ['skill-builtin-pdf', 'skill-builtin-websearch', 'skill-builtin-dataviz'],
    experts: [],
    icon: 'code',
  },
  {
    id: 'template-doc',
    name: '文档撰写',
    description: '适用于需求文档、设计文档、会议纪要等场景',
    instructions: '你是一个专业的文档撰写助手，请确保文档结构清晰、语言规范、内容准确。',
    skills: ['skill-builtin-pdf', 'skill-builtin-pptx', 'skill-builtin-translate'],
    experts: [],
    icon: 'file-text',
  },
  {
    id: 'template-data',
    name: '数据分析',
    description: '适用于数据处理、报表生成、数据可视化等场景',
    instructions: '你是一个专业的数据分析师，请确保分析逻辑严谨、可视化清晰、结论准确。',
    skills: ['skill-builtin-dataviz', 'skill-builtin-websearch'],
    experts: [],
    icon: 'chart',
  },
  {
    id: 'template-blank',
    name: '空白项目',
    description: '从零开始创建项目，自由配置所有选项',
    instructions: '',
    skills: [],
    experts: [],
    icon: 'plus',
  },
]

// ============================================================
// Project Service
// ============================================================

export const projectService = {
  // ==================== Templates ====================

  listTemplates(): ProjectTemplate[] {
    return BUILTIN_TEMPLATES
  },

  // ==================== Projects ====================

  list(): Project[] {
    return loadProjects()
  },

  create(input: ProjectCreateInput, userId: string, userName: string): Project {
    const projects = loadProjects()
    const now = Date.now()

    // Apply template if specified
    let instructions = input.instructions || ''
    let skills: string[] = input.skills || []
    let experts: string[] = input.experts || []

    if (input.templateId) {
      const template = BUILTIN_TEMPLATES.find((t) => t.id === input.templateId)
      if (template) {
        if (!input.instructions && template.instructions) instructions = template.instructions
        if (!input.skills || input.skills.length === 0) skills = template.skills
        if (!input.experts || input.experts.length === 0) experts = template.experts
      }
    }

    const project: Project = {
      id: uuid(),
      name: input.name,
      description: input.description,
      instructions,
      connectors: input.connectors || [],
      skills,
      experts,
      members: [
        { userId, userName, role: 'admin', joinedAt: now },
      ],
      storage: { used: 0, limit: 5 * 1024 * 1024 * 1024 }, // 5GB
      assets: [],
      templateId: input.templateId,
      createdAt: now,
      updatedAt: now,
    }

    projects.push(project)
    saveProjects(projects)

    // Record activity
    this._addActivity(project.id, 'member', 'member_joined', userId, userName, `${userName} 创建了项目`)
    return project
  },

  update(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'instructions' | 'skills' | 'experts' | 'connectors'>>, userId: string, userName: string): Project | null {
    const projects = loadProjects()
    const idx = projects.findIndex((p) => p.id === id)
    if (idx < 0) return null

    const old = projects[idx]

    // Track changes for activity feed
    if (updates.instructions !== undefined && updates.instructions !== old.instructions) {
      this._addActivity(id, 'member', 'instruction_changed', userId, userName, `${userName} 更新了项目指令`)
    }
    if (updates.skills !== undefined) {
      const added = updates.skills.filter((s) => !old.skills.includes(s))
      const removed = old.skills.filter((s) => !updates.skills!.includes(s))
      if (added.length > 0) this._addActivity(id, 'member', 'skill_added', userId, userName, `${userName} 添加了 Skill: ${added.join(', ')}`)
      if (removed.length > 0) this._addActivity(id, 'member', 'skill_removed', userId, userName, `${userName} 移除了 Skill: ${removed.join(', ')}`)
    }
    if (updates.experts !== undefined) {
      const added = updates.experts.filter((e) => !old.experts.includes(e))
      const removed = old.experts.filter((e) => !updates.experts!.includes(e))
      if (added.length > 0) this._addActivity(id, 'member', 'expert_added', userId, userName, `${userName} 添加了专家: ${added.join(', ')}`)
      if (removed.length > 0) this._addActivity(id, 'member', 'expert_removed', userId, userName, `${userName} 移除了专家: ${removed.join(', ')}`)
    }

    const updated: Project = {
      ...old,
      ...updates,
      updatedAt: Date.now(),
    }
    projects[idx] = updated
    saveProjects(projects)
    return updated
  },

  delete(id: string): boolean {
    const projects = loadProjects()
    const filtered = projects.filter((p) => p.id !== id)
    if (filtered.length === projects.length) return false
    saveProjects(filtered)
    return true
  },

  // ==================== Members ====================

  addMember(projectId: string, userId: string, userName: string, role: 'admin' | 'member'): Project | null {
    const projects = loadProjects()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return null
    if (project.members.find((m) => m.userId === userId)) return project // already member

    project.members.push({ userId, userName, role, joinedAt: Date.now() })
    project.updatedAt = Date.now()
    saveProjects(projects)
    this._addActivity(projectId, 'member', 'member_joined', userId, userName, `${userName} 加入了项目`)

    // Remove pending invite
    const invites = loadInvites()
    saveInvites(invites.filter((inv) => !(inv.projectId === projectId && inv.createdBy === userId)))
    return project
  },

  removeMember(projectId: string, userId: string, operatorId: string, operatorName: string): Project | null {
    const projects = loadProjects()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return null
    const member = project.members.find((m) => m.userId === userId)
    if (!member) return null

    project.members = project.members.filter((m) => m.userId !== userId)
    project.updatedAt = Date.now()
    saveProjects(projects)
    this._addActivity(projectId, 'member', 'member_joined', operatorId, operatorName, `${operatorName} 将 ${member.userName} 移出项目`)
    return project
  },

  // ==================== Invites ====================

  generateInvite(projectId: string, createdBy: string, projectName: string): ProjectInvite {
    const invite: ProjectInvite = {
      id: uuid(),
      projectId,
      projectName,
      code: uuid().slice(0, 8).toUpperCase(),
      createdBy,
      createdAt: Date.now(),
      maxUses: 50,
      usedCount: 0,
    }
    const invites = loadInvites()
    invites.push(invite)
    saveInvites(invites)
    return invite
  },

  acceptInvite(code: string, userId: string, userName: string, note?: string): { success: boolean; project?: Project; error?: string } {
    const invites = loadInvites()
    const invite = invites.find((inv) => inv.code === code)
    if (!invite) return { success: false, error: '邀请码无效或已过期' }
    if (invite.maxUses && invite.usedCount >= invite.maxUses) return { success: false, error: '邀请链接已用完' }

    const project = this.addMember(invite.projectId, userId, userName, 'member')
    if (!project) return { success: false, error: '项目不存在' }

    invite.usedCount++
    // Attach note to member
    const member = project.members.find((m) => m.userId === userId)
    if (member) member.inviteNote = note

    saveProjects(loadProjects().map((p) => (p.id === project.id ? project : p)))
    // Update invite used count
    const idx = invites.findIndex((inv) => inv.id === invite.id)
    if (idx >= 0) invites[idx] = invite
    saveInvites(invites)

    this._addActivity(invite.projectId, 'member', 'member_invited', userId, userName, `${userName} 通过邀请链接加入`)
    return { success: true, project }
  },

  // ==================== Assets (资料库) ====================

  listAssets(projectId: string): ProjectAsset[] | null {
    const projects = loadProjects()
    const project = projects.find((p) => p.id === projectId)
    return project ? project.assets : null
  },

  uploadAsset(projectId: string, name: string, type: AssetType, url: string, size: number, uploaderId: string, uploaderName: string, mimeType?: string): ProjectAsset | null {
    const projects = loadProjects()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return null

    const now = Date.now()
    const asset: ProjectAsset = {
      id: uuid(),
      name,
      type,
      url,
      size,
      uploader: uploaderId,
      uploaderName,
      uploadedAt: now,
      updatedAt: now,
      mimeType,
    }

    project.assets.push(asset)
    project.storage.used += size
    project.updatedAt = now
    saveProjects(projects)

    this._addActivity(projectId, 'member', 'asset_uploaded', uploaderId, uploaderName, `${uploaderName} 上传了 ${name} (${formatSize(size)})`)
    return asset
  },

  deleteAsset(projectId: string, assetId: string): boolean {
    const projects = loadProjects()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return false

    const asset = project.assets.find((a) => a.id === assetId)
    if (!asset) return false

    project.assets = project.assets.filter((a) => a.id !== assetId)
    project.storage.used = Math.max(0, project.storage.used - asset.size)
    project.updatedAt = Date.now()
    saveProjects(projects)
    return true
  },

  getStorageUsage(projectId: string): { used: number; limit: number; percentage: number } | null {
    const projects = loadProjects()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return null
    return {
      used: project.storage.used,
      limit: project.storage.limit,
      percentage: Math.round((project.storage.used / project.storage.limit) * 100),
    }
  },

  // ==================== Tasks ====================

  listTasks(projectId: string): ProjectTask[] {
    const projects = loadProjects()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return []

    // Tasks are stored inline (could be separate file in future)
    const tasksPath = path.join(getDataDir(), `tasks-${projectId}.json`)
    if (!fs.existsSync(tasksPath)) return []
    try { return JSON.parse(fs.readFileSync(tasksPath, 'utf-8')) as ProjectTask[] }
    catch { return [] }
  },

  createTask(input: ProjectTaskCreateInput, userId: string, userName: string): ProjectTask {
    const now = Date.now()
    const task: ProjectTask = {
      id: uuid(),
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      status: 'todo',
      assignee: input.assignee,
      deadline: input.deadline,
      createdAt: now,
      updatedAt: now,
    }

    const tasksPath = path.join(getDataDir(), `tasks-${input.projectId}.json`)
    const tasks = this.listTasks(input.projectId)
    tasks.push(task)
    fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf-8')

    // Update project timestamp
    const projects = loadProjects()
    const project = projects.find((p) => p.id === input.projectId)
    if (project) {
      project.updatedAt = now
      saveProjects(projects)
    }

    this._addActivity(input.projectId, 'member', 'task_created', userId, userName, `${userName} 创建了任务「${input.title}」`)
    return task
  },

  updateTask(taskId: string, projectId: string, updates: Partial<Pick<ProjectTask, 'title' | 'description' | 'status' | 'assignee' | 'deadline' | 'conversationId'>>): ProjectTask | null {
    const tasksPath = path.join(getDataDir(), `tasks-${projectId}.json`)
    const tasks = this.listTasks(projectId)
    const idx = tasks.findIndex((t) => t.id === taskId)
    if (idx < 0) return null

    tasks[idx] = { ...tasks[idx], ...updates, updatedAt: Date.now() }
    fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf-8')
    return tasks[idx]
  },

  shareTask(taskId: string, projectId: string, userId: string, userName: string): { success: boolean; shareLink?: string; error?: string } {
    const tasks = this.listTasks(projectId)
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return { success: false, error: '任务不存在' }

    // Mark as collaborative
    task.isCollaborative = true
    const tasksPath = path.join(getDataDir(), `tasks-${projectId}.json`)
    fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf-8')

    const shareLink = `bspbuddy://project/${projectId}/task/${taskId}?share=${uuid().slice(0, 12)}`
    return { success: true, shareLink }
  },

  transferTask(taskId: string, projectId: string, toUserId: string, fromUserId: string, fromUserName: string, note?: string, attachments?: TaskAttachment[]): { success: boolean; task?: ProjectTask; error?: string } {
    const tasks = this.listTasks(projectId)
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return { success: false, error: '任务不存在' }

    task.assignee = toUserId
    task.transferFrom = fromUserId
    task.transferNote = note
    task.attachments = attachments
    task.updatedAt = Date.now()

    const tasksPath = path.join(getDataDir(), `tasks-${projectId}.json`)
    fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf-8')

    this._addActivity(projectId, 'related_to_me', 'task_transferred', fromUserId, fromUserName, `${fromUserName} 转交了任务「${task.title}」`)
    return { success: true, task }
  },

  // ==================== Activities (项目动态) ====================

  listActivities(projectId: string, currentUserId?: string): ProjectActivity[] {
    const all = loadActivities().filter((a) => a.projectId === projectId)
    // Filter: automation activities are only visible to creator
    // "related_to_me" activities only show for the target user
    return all
      .filter((a) => {
        if (a.category === 'automation' && a.visibleOnlyTo && currentUserId) {
          return a.visibleOnlyTo === currentUserId
        }
        return true
      })
      .sort((a, b) => b.timestamp - a.timestamp)
  },

  _addActivity(projectId: string, category: ProjectActivity['category'], event: ProjectActivity['event'], userId: string, userName: string, description: string, visibleOnlyTo?: string): void {
    const activities = loadActivities()
    activities.push({
      id: uuid(),
      projectId,
      category,
      event,
      userId,
      userName,
      description,
      visibleOnlyTo,
      timestamp: Date.now(),
    })
    saveActivities(activities)
  },

  // ==================== Automation ====================

  createAutomation(projectId: string, name: string, schedule: string, action: string, createdBy: string): ProjectAutomation {
    const automation: ProjectAutomation = {
      id: uuid(),
      projectId,
      name,
      trigger: 'scheduled',
      schedule,
      action,
      createdBy,
      visibleOnlyTo: createdBy,
      enabled: true,
      createdAt: Date.now(),
    }

    const automationsPath = path.join(getDataDir(), `automations-${projectId}.json`)
    const existing = this.listAutomations(projectId)
    existing.push(automation)
    fs.writeFileSync(automationsPath, JSON.stringify(existing, null, 2), 'utf-8')

    this._addActivity(projectId, 'automation', 'automation_triggered', createdBy, '', `创建了自动化「${name}」`, createdBy)
    return automation
  },

  listAutomations(projectId: string, userId?: string): ProjectAutomation[] {
    const automationsPath = path.join(getDataDir(), `automations-${projectId}.json`)
    if (!fs.existsSync(automationsPath)) return []
    try {
      const all = JSON.parse(fs.readFileSync(automationsPath, 'utf-8')) as ProjectAutomation[]
      if (userId) return all.filter((a) => a.visibleOnlyTo === userId)
      return all
    } catch {
      return []
    }
  },

  // ==================== Dual-Auth Token Management ====================

  /**
   * Save a PERSONAL auth token (stored ONLY locally, never in cloud).
   * This is the key security constraint — personal tokens never leave the local machine.
   */
  savePersonalAuthToken(connectorId: string, projectId: string, userId: string, token: string): AuthToken {
    const tokens = loadAuthTokens()
    // Remove existing personal token for this connector+project+user
    const filtered = tokens.filter(
      (t) => !(t.connectorId === connectorId && t.projectId === projectId && t.userId === userId && t.type === 'personal')
    )
    const authToken: AuthToken = {
      id: uuid(),
      connectorId,
      projectId,
      type: 'personal',
      userId,
      token,
      createdAt: Date.now(),
    }
    filtered.push(authToken)
    saveAuthTokens(filtered)
    return authToken
  },

  /**
   * Save a PUBLIC auth token (stored in cloud, managed by admin).
   * Public tokens are stored in the project's connector config.
   */
  savePublicAuthToken(projectId: string, connectorId: string, credentials: Record<string, string>, userId: string): Project | null {
    const projects = loadProjects()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return null

    const connector = project.connectors.find((c) => c.id === connectorId)
    if (connector) {
      connector.auth = { type: 'public', credentials }
      connector.configuredBy = userId
      connector.configuredAt = Date.now()
    } else {
      project.connectors.push({
        id: connectorId,
        name: connectorId,
        type: 'api',
        auth: { type: 'public', credentials },
        configuredBy: userId,
        configuredAt: Date.now(),
      })
    }

    project.updatedAt = Date.now()
    saveProjects(projects)

    this._addActivity(projectId, 'member', 'connector_added', userId, '', `管理员配置了公共授权连接器: ${connectorId}`)
    return project
  },

  /**
   * Get personal auth token for a specific connector+project+user.
   * Only returns local tokens — this is the security guarantee.
   */
  getPersonalAuthToken(connectorId: string, projectId: string, userId: string): AuthToken | null {
    const tokens = loadAuthTokens()
    return tokens.find(
      (t) => t.connectorId === connectorId && t.projectId === projectId && t.userId === userId && t.type === 'personal'
    ) || null
  },

  /**
   * Get public auth credentials from project config.
   */
  getPublicAuthCredentials(projectId: string, connectorId: string): Record<string, string> | null {
    const projects = loadProjects()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return null
    const connector = project.connectors.find((c) => c.id === connectorId)
    if (!connector || connector.auth.type !== 'public') return null
    return connector.auth.credentials || null
  },

  /**
   * Get all available connectors for a task, applying the collaboration constraint:
   * - In collaborative tasks, personal auth connectors are DISABLED
   * - Only public auth connectors are available
   */
  getAvailableConnectors(projectId: string, isCollaborative: boolean, userId?: string): ConnectorConfig[] {
    const projects = loadProjects()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return []

    if (isCollaborative) {
      // In collaborative tasks: ONLY public auth connectors are available
      return project.connectors.filter((c) => c.auth.type === 'public')
    }

    // In personal tasks: both public and personal auth connectors are available
    return project.connectors
  },

  /**
   * Build the context injection for a task created in a project.
   * Auto-injects: project instructions + project assets (as reference) + personal memory
   */
  buildTaskContext(projectId: string, userId: string): string {
    const projects = loadProjects()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return ''

    const parts: string[] = []

    // Project instructions
    if (project.instructions) {
      parts.push(`## 项目指令\n${project.instructions}`)
    }

    // Project assets as reference
    if (project.assets.length > 0) {
      const assetRefs = project.assets
        .slice(0, 20) // Limit to 20 most recent
        .map((a) => `- 📎 ${a.name} (${a.type}, ${formatSize(a.size)}, 上传者: ${a.uploaderName})`)
        .join('\n')
      parts.push(`## 项目资料库\n以下文件可在当前任务中引用：\n${assetRefs}`)
    }

    // Personal memory hint
    parts.push(`## 个人记忆\n用户ID: ${userId}\n请结合历史对话记录理解上下文。`)

    return parts.join('\n\n')
  },
}

// ============================================================
// Helpers
// ============================================================

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
