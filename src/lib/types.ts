// ============================================================
// Core types for BspBuddy IDE
// ============================================================

// ---------- File system ----------
export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: number
}

// ---------- Editor ----------
export interface EditorTab {
  id: string
  path: string
  name: string
  content: string
  originalContent: string
  isDirty: boolean
  language: string
}

export interface CodeEdit {
  range: { startLine: number; startColumn: number; endLine: number; endColumn: number }
  newText: string
  description: string
}

// ---------- Agent / AI ----------
export interface TaskPlan {
  id: string
  userIntent: string
  steps: TaskStep[]
  dependencies: DependencyEdge[]
  createdAt: number
  status: 'planning' | 'ready' | 'running' | 'completed' | 'failed'
}

export interface TaskStep {
  id: string
  index: number
  description: string
  toolName: string
  toolParams: Record<string, unknown>
  status: StepStatus
  result?: ToolResult
  error?: string
  startedAt?: number
  completedAt?: number
  codeEdits?: CodeEdit[]
  newFiles?: { path: string; content: string }[]
}

export type StepStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped'

export interface DependencyEdge {
  from: string
  to: string
}

// ---------- Tools ----------
export interface Tool {
  name: string
  description: string
  category: ToolCategory
  parameters: ToolParameter[]
  execute: (params: Record<string, unknown>) => Promise<ToolResult>
}

export type ToolCategory =
  | 'file'
  | 'code'
  | 'terminal'
  | 'search'
  | 'document'
  | 'data'
  | 'browser'
  | 'office'
  | 'office'
  | 'office'

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  artifacts?: Artifact[]
  codeEdits?: CodeEdit[]
  newFiles?: { path: string; content: string }[]
}

export interface Artifact {
  name: string
  path: string
  mimeType: string
  size: number
}

export interface FunctionDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

// ---------- Chat ----------
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  plan?: TaskPlan
  artifacts?: Artifact[]
  codeEdits?: CodeEdit[]
  newFiles?: { path: string; content: string }[]
  timestamp: number
}

// ---------- LLM ----------
export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'hunyuan' | 'custom'
  apiKey: string
  baseUrl?: string
  model: string
  maxTokens?: number
}

// ---------- IPC channels ----------
export const IPC_CHANNELS = {
  EXECUTE_TASK: 'agent:execute-task',
  TASK_PROGRESS: 'agent:task-progress',
  AGENT_STOP: 'agent:stop',
  AGENT_CANCEL: 'agent:cancel',
  FILE_DIALOG: 'shell:file-dialog',
  READ_FILE: 'fs:read-file',
  WRITE_FILE: 'fs:write-file',
  LIST_DIR: 'fs:list-dir',
  DELETE_FILE: 'fs:delete-file',
  RENAME_FILE: 'fs:rename-file',
  EXEC_COMMAND: 'term:exec-command',
  TERM_RESIZE: 'term:resize',
  TERM_DATA: 'term:data',
  PYTHON_EXEC: 'python:exec',
  PYTHON_STATUS: 'python:status',
  SEARCH_WEB: 'search:web',
  SESSION_SAVE: 'session:save',
  SESSION_LOAD: 'session:load',
  SESSION_LIST: 'session:list',
  SESSION_DELETE: 'session:delete',
  // Plugin ecosystem
  SKILL_LIST: 'skill:list',
  SKILL_SEARCH: 'skill:search',
  SKILL_INSTALL: 'skill:install',
  SKILL_UNINSTALL: 'skill:uninstall',
  SKILL_TOGGLE: 'skill:toggle',
  SKILL_BATCH_UNINSTALL: 'skill:batch-uninstall',
  SKILL_CREATE: 'skill:create',
  SKILL_UPLOAD: 'skill:upload',
  MCP_LIST: 'mcp:list',
  MCP_CONNECT: 'mcp:connect',
  MCP_DISCONNECT: 'mcp:disconnect',
  MCP_CONFIGURE: 'mcp:configure',
  MCP_MARKET_LIST: 'mcp:market-list',
  EXPERT_LIST: 'expert:list',
  EXPERT_TEAM_LIST: 'expert:team-list',
  EXPERT_SUMMON: 'expert:summon',
  EXPERT_TEAM_EXECUTE: 'expert:team-execute',
  EXPERT_CREATE: 'expert:create',
  PLUGIN_INSTALL: 'plugin:install',
  PLUGIN_UNINSTALL: 'plugin:uninstall',
  PLUGIN_LIST: 'plugin:list',
  PLUGIN_MARKET_ADD: 'plugin:market-add',
  PLUGIN_MARKET_LIST: 'plugin:market-list',
  PLUGIN_MARKET_REMOVE: 'plugin:market-remove',
  SLASH_COMMAND_LIST: 'slash:list',
  SLASH_COMMAND_EXECUTE: 'slash:execute',
  // IM Remote Assistant
  IM_CONNECT: 'im:connect',
  IM_DISCONNECT: 'im:disconnect',
  IM_STATUS: 'im:status',
  IM_APPROVE: 'im:approve',
  IM_MESSAGE: 'im:message',
  IM_SEND_MESSAGE: 'im:send-message',
  IM_GET_QRCODE: 'im:get-qrcode',
  IM_UNBIND: 'im:unbind',
  IM_EXECUTE_REMOTE: 'im:execute-remote',
  IM_HISTORY: 'im:history',
  IM_CURRENT_REQUEST: 'im:current-request',
  ASSISTANT_GET_STATE: 'assistant:get-state',
  ASSISTANT_SET_WORKSPACE: 'assistant:set-workspace',
  ASSISTANT_PENDING_APPROVAL: 'assistant:pending-approval',
  // Project Collaboration
  PROJECT_LIST: 'project:list',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_MEMBER_ADD: 'project:member:add',
  PROJECT_MEMBER_REMOVE: 'project:member:remove',
  PROJECT_MEMBER_APPROVE: 'project:member:approve',
  PROJECT_ASSET_LIST: 'project:asset:list',
  PROJECT_ASSET_UPLOAD: 'project:asset:upload',
  PROJECT_ASSET_DELETE: 'project:asset:delete',
  PROJECT_TASK_CREATE: 'project:task:create',
  PROJECT_TASK_LIST: 'project:task:list',
  PROJECT_TASK_UPDATE: 'project:task:update',
  PROJECT_TASK_SHARE: 'project:task:share',
  PROJECT_TASK_TRANSFER: 'project:task:transfer',
  PROJECT_ACTIVITY_LIST: 'project:activity:list',
  PROJECT_INVITE_GENERATE: 'project:invite:generate',
  PROJECT_INVITE_ACCEPT: 'project:invite:accept',
  PROJECT_AUTH_SAVE_PERSONAL: 'project:auth:save-personal',
  PROJECT_AUTH_GET_PUBLIC: 'project:auth:get-public',
  PROJECT_TEMPLATE_LIST: 'project:template:list',
  PROJECT_AUTOMATION_CREATE: 'project:automation:create',
  PROJECT_AUTOMATION_LIST: 'project:automation:list',
  // Inspiration (灵感)
  INSPIRATION_LIST: 'inspiration:list',
  INSPIRATION_DETAIL: 'inspiration:detail',
  INSPIRATION_FAVORITE: 'inspiration:favorite',
  INSPIRATION_FORK: 'inspiration:fork',
  INSPIRATION_FAVORITES_LIST: 'inspiration:favorites:list',
  // Permission
  PERMISSION_CHECK: 'permission:check',
  PERMISSION_MODE_CHANGE: 'permission:mode-change',
  PERMISSION_RESPONSE: 'permission:response',
  PERMISSION_REQUEST: 'permission:request',
  // Automation / Scheduler
  AUTOMATION_LIST: 'automation:list',
  AUTOMATION_GET: 'automation:get',
  AUTOMATION_CREATE: 'automation:create',
  AUTOMATION_UPDATE: 'automation:update',
  AUTOMATION_DELETE: 'automation:delete',
  AUTOMATION_TRIGGER: 'automation:trigger',
  AUTOMATION_TOGGLE: 'automation:toggle',
  AUTOMATION_LOGS: 'automation:logs',
  AUTOMATION_CHECK_SAFETY: 'automation:check-safety',
  AUTOMATION_TASK_STARTED: 'automation:task-started',
  AUTOMATION_TASK_COMPLETED: 'automation:task-completed',
  AUTOMATION_TASK_FAILED: 'automation:task-failed',
  AUTOMATION_MINI_PROGRAM_PUSH: 'automation:mini-program-push',
  // Memory system
  MEMORY_LIST: 'memory:list',
  MEMORY_ADD: 'memory:add',
  MEMORY_EDIT: 'memory:edit',
  MEMORY_DELETE: 'memory:delete',
  MEMORY_CLEAR: 'memory:clear',
  MEMORY_IMPORT: 'memory:import',
  MEMORY_TOGGLE: 'memory:toggle',
  MEMORY_STATUS: 'memory:status',
  MEMORY_SEARCH_HISTORY: 'memory:search:history',
  MEMORY_IMPORT_PROMPT: 'memory:import-prompt',
  MEMORY_GET_CONTEXT: 'memory:get-context',
  // Credits & Pricing
  CREDITS_BALANCE: 'credits:balance',
  CREDITS_CONSUME: 'credits:consume',
  CREDITS_RESET: 'credits:reset',
  CREDITS_PLAN_INFO: 'credits:plan-info',
  CREDITS_TOPUP: 'credits:topup',
  // Data Management
  DATA_SHARED_FILES: 'data:shared-files',
  DATA_ARCHIVED_TASKS: 'data:archived-tasks',
  DATA_UNSHARE_FILE: 'data:unshare-file',
  DATA_DELETE_ARCHIVED_TASK: 'data:delete-archived-task',
  DATA_UNARCHIVE_TASK: 'data:unarchive-task',
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',
  // Update
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_STATUS: 'update:status',
  // Design / Ardot (腾讯内部产品)
  DESIGN_CONNECT: 'design:connect',
  DESIGN_GENERATE: 'design:generate',
  DESIGN_EDIT: 'design:edit',
  DESIGN_EXPORT: 'design:export',
  DESIGN_SYNC: 'design:sync',
  // Agent Mailbox (腾讯内部 Agent Mail 服务)
  MAILBOX_STATUS: 'mailbox:status',
  MAILBOX_ACTIVATE: 'mailbox:activate',
  MAIL_FETCH: 'mail:fetch',
  MAIL_DETAIL: 'mail:detail',
  MAIL_DRAFT: 'mail:draft',
  MAIL_CONFIRM_SEND: 'mail:confirm-send',
  MAIL_CONTEXT: 'mail:context',
  // Cloud Agent (企业后台)
  CLOUD_AGENT_LIST: 'cloud-agent:list',
  CLOUD_AGENT_CREATE: 'cloud-agent:create',
  CLOUD_AGENT_START: 'cloud-agent:start',
  CLOUD_AGENT_STOP: 'cloud-agent:stop',
  CLOUD_AGENT_DELETE: 'cloud-agent:delete',
  CLOUD_AGENT_VERSION: 'cloud-agent:version',
  CLOUD_AGENT_DEPLOY: 'cloud-agent:deploy',
  CLOUD_AGENT_EVALUATE: 'cloud-agent:evaluate',
  // Connector
  CONNECTOR_LIST: 'connector:list',
  CONNECTOR_CONNECT: 'connector:connect',
  CONNECTOR_DISCONNECT: 'connector:disconnect',
  CONNECTOR_STATUS: 'connector:status',
} as const

// ---------- Agent mode ----------
export type AgentMode = 'craft' | 'ask' | 'plan' | 'design'

// ---------- Model ----------
export interface ModelOption {
  id: string
  name: string
  provider: string
  description: string
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: 'deepseek-chat', name: 'DeepSeek', provider: 'deepseek', description: '日常问答、文案撰写，响应快、成本低' },
  { id: 'hunyuan', name: '腾讯混元', provider: 'hunyuan', description: '中文写作、会议纪要、中文文档处理' },
  { id: 'glm-4', name: '智谱 GLM', provider: 'zhipu', description: '多步骤、长流程的复杂任务' },
  { id: 'kimi', name: 'Kimi', provider: 'moonshot', description: '截图分析、图片转文档等视觉类任务' },
  { id: 'minimax', name: 'MiniMax', provider: 'minimax', description: 'Excel处理、数据分析、PPT生成，执行速度快' },
]

// ---------- Office ----------
export interface OfficeArtifact {
  id: string
  name: string
  type: 'word' | 'excel' | 'ppt' | 'pdf' | 'markdown' | 'html' | 'csv' | 'image' | 'other'
  path: string
  title: string
  createdAt: number
}

// ---------- Permission ----------
export type PermissionMode = 'default' | 'full_access'

export type PermissionAction = 'allow' | 'deny' | 'allow_once' | 'allow_always'

export type PermissionOperationType = 'file_write' | 'file_delete' | 'execute' | 'network'

export type PermissionScope = 'workspace' | 'protected' | 'external'

export interface PermissionRequest {
  id: string
  type: PermissionOperationType
  target: string
  scope: PermissionScope
  reason: string
  alternatives?: string[]
}

export interface PermissionResponse {
  requestId: string
  action: PermissionAction
}

// ---------- Context menu ----------
export interface ContextMenu {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export interface ContextMenuItem {
  label: string
  action: () => void
  divider?: boolean
  shortcut?: string
  disabled?: boolean
}

// ---------- Credits & Pricing ----------

export type BspPlan = 'free' | 'standard' | 'advanced' | 'flagship' | 'enterprise'

export interface CreditBalance {
  total: number
  used: number
  remaining: number
  expiresAt: string
  plan: BspPlan
  baseCredits: number
  bonusCredits: number
  resetDate: string
}

export interface PricingPlan {
  id: BspPlan
  name: string
  monthlyPrice: number
  recurringMonthlyPrice: number
  yearlyPrice: number
  recurringYearlyPrice: number
  baseCredits: number
  bonusCredits: number
  totalCredits: number
  codeCompletions: string
  autoTasks: string
  modelAccess: string
  maxProjects: number
  maxMembers: number
  maxAssistants: number
}

export interface TopupPack {
  credits: number
  price: number
  validityDays: number
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free', name: '体验版', monthlyPrice: 0, recurringMonthlyPrice: 0,
    yearlyPrice: 0, recurringYearlyPrice: 0,
    baseCredits: 500, bonusCredits: 0, totalCredits: 500,
    codeCompletions: '5000次/限免无限次', autoTasks: '3次/限免99次',
    modelAccess: 'Auto(限免全模型)', maxProjects: 5, maxMembers: 3, maxAssistants: 3,
  },
  {
    id: 'standard', name: '标准版', monthlyPrice: 99, recurringMonthlyPrice: 70,
    yearlyPrice: 840, recurringYearlyPrice: 672,
    baseCredits: 2000, bonusCredits: 2000, totalCredits: 4000,
    codeCompletions: '无限次', autoTasks: '15次/限免99次',
    modelAccess: '全模型可用', maxProjects: 10, maxMembers: 5, maxAssistants: 5,
  },
  {
    id: 'advanced', name: '高级版', monthlyPrice: 199, recurringMonthlyPrice: 140,
    yearlyPrice: 1680, recurringYearlyPrice: 1344,
    baseCredits: 4000, bonusCredits: 5000, totalCredits: 9000,
    codeCompletions: '无限次', autoTasks: '30次/限免99次',
    modelAccess: '全模型可用', maxProjects: 15, maxMembers: 8, maxAssistants: 8,
  },
  {
    id: 'flagship', name: '旗舰版', monthlyPrice: 999, recurringMonthlyPrice: 700,
    yearlyPrice: 8400, recurringYearlyPrice: 6720,
    baseCredits: 20000, bonusCredits: 30000, totalCredits: 50000,
    codeCompletions: '无限次', autoTasks: '99次',
    modelAccess: '全模型可用', maxProjects: 20, maxMembers: 10, maxAssistants: 10,
  },
]

export const TOPUP_PACKS: TopupPack[] = [
  { credits: 1000, price: 50, validityDays: 30 },
]

// ---------- Data Management ----------

export interface SharedFile {
  id: string
  name: string
  size: number
  sharedAt: string
  shareUrl: string
  artifactId: string
}

export interface ArchivedTask {
  id: string
  name: string
  archivedAt: string
  sessionId: string
}

// ---------- Settings ----------

export type AppLanguage = 'zh-CN' | 'en-US'

export interface AppSettings {
  language: AppLanguage
  fontSize: number
  compactMode: boolean
  autoInstallNonRisky: boolean
  preventSleep: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'zh-CN',
  fontSize: 14,
  compactMode: true,
  autoInstallNonRisky: true,
  preventSleep: false,
}

// ---------- Update ----------

export interface UpdateInfo {
  version: string
  releaseDate: string
  releaseNotes: string
  downloaded: boolean
  available: boolean
}

// ---------- Login ----------

export interface LoginState {
  termsAccepted: boolean
  privacyAccepted: boolean
}
