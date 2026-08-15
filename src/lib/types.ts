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
  modes?: AgentMode[] // 工具可用模式：undefined = 全模式可用，[] = 不可用，['craft','plan'] = 仅指定模式
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
export interface MessageTraceStep {
  id: string
  label: string
  kind: 'status' | 'mcp' | 'tool' | 'skill' | 'capability'
  status?: string
  provider?: string
  tool_name?: string
  /** Wall-clock tool/MCP duration in ms (debug) */
  durationMs?: number
}

export interface MessageTrace {
  viaA2A?: boolean
  expertName?: string
  mcpCalled?: boolean | null
  /** Expert has MCP bindings but none were reachable this turn */
  mcpUnavailable?: boolean
  mcpUnavailableDetail?: string
  steps: MessageTraceStep[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  plan?: TaskPlan
  artifacts?: Artifact[]
  codeEdits?: CodeEdit[]
  newFiles?: { path: string; content: string }[]
  trace?: MessageTrace
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
  APP_GET_PLATFORM: 'app:get-platform',
  APP_QUIT: 'app:quit',
  WINDOW_RELOAD: 'window:reload',
  WINDOW_TOGGLE_DEVTOOLS: 'window:toggle-devtools',
  WINDOW_TOGGLE_FULLSCREEN: 'window:toggle-fullscreen',
  EXECUTE_TASK: 'agent:execute-task',
  TASK_PROGRESS: 'agent:task-progress',
  A2A_CHAT_STREAM: 'agent:a2a-chat-stream',
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
  // Auth / RBAC (auth-001) — identity session; NOT Agent Permission Modes
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_ME: 'auth:me',
  AUTH_USERS_LIST: 'auth:users:list',
  AUTH_USERS_CREATE: 'auth:users:create',
  AUTH_USERS_UPDATE: 'auth:users:update',
  AUTH_USERS_DELETE: 'auth:users:delete',
  /** Phase 1 desktop: switch simulated local user */
  AUTH_SWITCH_USER: 'auth:switch-user',
  AUTH_MEMBERS_FOR_SWITCH: 'auth:members-for-switch',
  // Plugin ecosystem
  SKILL_LIST: 'skill:list',
  SKILL_SEARCH: 'skill:search',
  SKILL_INSTALL: 'skill:install',
  SKILL_UNINSTALL: 'skill:uninstall',
  SKILL_TOGGLE: 'skill:toggle',
  SKILL_BATCH_UNINSTALL: 'skill:batch-uninstall',
  SKILL_CREATE: 'skill:create',
  SKILL_UPLOAD: 'skill:upload',
  SKILL_UPDATE: 'skill:update',
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
  EXPERT_UPDATE: 'expert:update',
  EXPERT_DELETE: 'expert:delete',
  EXPERT_TOGGLE_STATUS: 'expert:toggle-status',
  EXPERT_TOGGLE_OVERALL: 'expert:toggle-overall',
  EXPERT_SQUARE_LIST: 'expert:square-list',
  EXPERT_CLONE: 'expert:clone',
  EXPERT_TEST_RUN: 'expert:test-run',
  EXPERT_AUTH_TOKEN: 'expert:auth-token',
  /** Push: Portal SSO / deep-link replaced the Buddy JWT */
  EXPERT_AUTH_CHANGED: 'expert:auth-changed',
  EXPERT_FASTAPI_STATUS: 'expert:fastapi-status',
  /** Push: main-process periodic /api/health result */
  EXPERT_FASTAPI_STATUS_CHANGED: 'expert:fastapi-status-changed',
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
  MEMORY_EXTRACT: 'memory:extract',
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
  // SOP Skills (library + lifecycle — agents-003)
  SOP_LIST: 'sop:list',
  SOP_GET: 'sop:get',
  SOP_CREATE: 'sop:create',
  SOP_UPDATE: 'sop:update',
  SOP_DELETE: 'sop:delete',
  SOP_PUBLISH: 'sop:publish',
  SOP_DRAFT: 'sop:draft',
  SOP_ARCHIVE: 'sop:archive',
  SOP_VERSIONS: 'sop:versions',
  SOP_ROLLBACK: 'sop:rollback',
  SOP_DELETE_VERSION: 'sop:delete-version',
  SOP_SQUARE_LIST: 'sop:square-list',
  SOP_CLONE_FROM_SQUARE: 'sop:clone-from-square',
  /** MVP mock distill — real SSE pipeline TODO */
  SOP_DISTILL: 'sop:distill',
  // Knowledge Base
  KNOWLEDGE_LIST: 'knowledge:list',
  KNOWLEDGE_CREATE: 'knowledge:create',
  KNOWLEDGE_DELETE: 'knowledge:delete',
  // General Skills & Resource Import
  GENERAL_SKILL_LIST: 'general-skill:list',
  GENERAL_SKILL_STORE_LIST: 'general-skill:store-list',
  GENERAL_SKILL_LEADERBOARD: 'general-skill:leaderboard',
  GENERAL_SKILL_CATEGORIES: 'general-skill:categories',
  GENERAL_SKILL_LIBRARY_LIST: 'general-skill:library-list',
  GENERAL_SKILL_LIBRARY_ADD: 'general-skill:library-add',
  GENERAL_SKILL_LIBRARY_REMOVE: 'general-skill:library-remove',
  GENERAL_SKILL_INSTALL_PROMPT: 'general-skill:install-prompt',
  GENERAL_SKILL_REVISIONS: 'general-skill:revisions',
  GENERAL_SKILL_ACCESS_REQUEST: 'general-skill:access-request',
  GENERAL_SKILL_GET: 'general-skill:get',
  GENERAL_SKILL_IMPORT_PACKAGE: 'general-skill:import-package',
  GENERAL_SKILL_IMPORT_URL: 'general-skill:import-url',
  GENERAL_SKILL_ACCESS_INBOX: 'general-skill:access-inbox',
  GENERAL_SKILL_ACCESS_DECIDE: 'general-skill:access-decide',
  GENERAL_SKILL_STAR: 'general-skill:star',
  GENERAL_SKILL_CREATE_REVISION: 'general-skill:create-revision',
  AGENT_SKILL_TOKEN_CREATE: 'agent-skill-token:create',
  AGENT_SKILL_TOKEN_LIST: 'agent-skill-token:list',
  AGENT_SKILL_TOKEN_REVOKE: 'agent-skill-token:revoke',
  /** agents-005: 永久删除已吊销/已过期 Token */
  AGENT_SKILL_TOKEN_DELETE: 'agent-skill-token:delete',
  /** agents-005: FastAPI /api/auth/me for A2A 接入页后端身份 */
  A2A_ACCESS_BACKEND_ME: 'a2a-access:backend-me',
  /** agents-005: GET /a2a/agents with optional Bearer (plaintext or session) */
  A2A_ACCESS_PROBE: 'a2a-access:probe',
  /** policy-001: Rule / Pack / Binding management */
  POLICY_RULES_LIST: 'policy:rules-list',
  POLICY_RULES_CREATE: 'policy:rules-create',
  POLICY_PACKS_LIST: 'policy:packs-list',
  POLICY_PACKS_CREATE: 'policy:packs-create',
  POLICY_BINDINGS_LIST: 'policy:bindings-list',
  POLICY_BINDINGS_CREATE: 'policy:bindings-create',
  POLICY_RESOLVED: 'policy:resolved',
  RESOURCE_IMPORT: 'resource:import',
  RESOURCE_UNBIND: 'resource:unbind',
  // Feedback
  FEEDBACK_SUMMARY: 'feedback:summary',
  FEEDBACK_LIST: 'feedback:list',
  // Model Config
  MODEL_CONFIG_LIST: 'model-config:list',
  MODEL_CONFIG_CREATE: 'model-config:create',
  MODEL_CONFIG_UPDATE: 'model-config:update',
  MODEL_CONFIG_SET_DEFAULT: 'model-config:set-default',
  MODEL_CONFIG_TEST: 'model-config:test',
  MODEL_CONFIG_PROTOCOLS: 'model-config:protocols',
  // Local-only model configs (仅本机保存)
  MODEL_CONFIG_LOCAL_LIST: 'model-config-local:list',
  MODEL_CONFIG_LOCAL_SAVE: 'model-config-local:save',
  MODEL_CONFIG_LOCAL_UPDATE: 'model-config-local:update',
  MODEL_CONFIG_LOCAL_DELETE: 'model-config-local:delete',
  MODEL_CONFIG_LOCAL_TEST: 'model-config-local:test',
  EXPERT_MODEL_CATALOG_LIST: 'expert-model-catalog:list',
  EXPERT_MODEL_CATALOG_CREATE: 'expert-model-catalog:create',
  EXPERT_MODEL_CATALOG_UPDATE: 'expert-model-catalog:update',
  EXPERT_MODEL_CATALOG_DELETE: 'expert-model-catalog:delete',
  EXPERT_MODEL_CATALOG_TEST: 'expert-model-catalog:test',
} as const

// ---------- Agent mode ----------
export type AgentMode = 'craft' | 'ask' | 'plan' | 'design'

// ---------- Model ----------
export interface ModelOption {
  id: string
  name: string
  provider: string
  description: string
  source?: 'local' | 'cloud'
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: 'deepseek-chat', name: 'DeepSeek', provider: 'deepseek', description: '日常问答、文案撰写，响应快、成本低' },
  { id: 'hunyuan', name: '腾讯混元', provider: 'hunyuan', description: '中文写作、会议纪要、中文文档处理' },
  { id: 'glm-4', name: '智谱 GLM', provider: 'zhipu', description: '多步骤、长流程的复杂任务' },
  { id: 'kimi', name: 'Kimi', provider: 'moonshot', description: '截图分析、图片转文档等视觉类任务' },
  { id: 'minimax', name: 'MiniMax', provider: 'minimax', description: 'Excel处理、数据分析、PPT生成，执行速度快' },
]

// ---------- Model Config (backend-managed) ----------
export type ModelTrustStatus = 'unverified' | 'verified' | 'legacy_trusted'
export type ModelVerificationStatus = 'verifying' | 'succeeded' | 'failed' | null

export interface ModelConfigItem {
  id: string
  tenant_id: string
  name: string
  provider: string
  api_protocol: string
  base_url: string | null
  api_key_masked: string
  model: string
  temperature: number
  max_output_tokens: number
  extra_body: Record<string, unknown>
  protocol_options: Record<string, unknown>
  legacy_unmapped_options: Record<string, unknown>
  trust_status: ModelTrustStatus
  verification_attempt_status: ModelVerificationStatus
  config_revision: number
  security_revision: number
  is_default: boolean
  enabled: boolean
  storage_mode: string
  scope: string
  created_at: string
  updated_at: string
}

export interface ModelConfigCreateParams {
  name: string
  api_protocol: string
  base_url: string
  api_key: string
  model: string
  temperature?: number
  max_output_tokens?: number
  protocol_options?: Record<string, unknown>
  extra_body?: Record<string, unknown>
  storage_mode?: string
  scope?: string
}

export interface ModelConfigUpdateParams {
  name?: string
  api_protocol?: string
  base_url?: string
  api_key?: string
  model?: string
  temperature?: number
  max_output_tokens?: number
  enabled?: boolean
  is_default?: boolean
  protocol_options?: Record<string, unknown>
  extra_body?: Record<string, unknown>
  storage_mode?: string
  scope?: string
}

export interface ModelCapabilityResult {
  id: string
  success: boolean
  error_code?: string
}

export interface ModelConfigTestResult {
  success: boolean
  message: string
  output: string | null
  attempt_id: string
  trust_status: ModelTrustStatus
  attempt_status: ModelVerificationStatus
  capabilities: ModelCapabilityResult[]
  activated?: boolean
  model?: ModelConfigItem
}

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
