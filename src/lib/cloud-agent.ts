// ============================================================
// 企业智能体 (CloudAgent) 数据模型
// 对应 SPEC: specs/From-Beginner-to-Expert-Guide/CloudAgent.md
// 依赖状态: ⚠️ 依赖企业后台 API，本地开发可模拟 UI 和数据流
// ============================================================

// ---------- 智能体 ----------
export interface CloudAgent {
  id: string
  name: string
  status: CloudAgentStatus
  manifest: Manifest
  skills: string[]
  experts: string[]
  mcpServers: MCPConfig[]
  memory: boolean
  knowledgeBase: string[]
  createdAt: number
  updatedAt: number
}

export type CloudAgentStatus = 'running' | 'idle' | 'failed'

export const CLOUD_AGENT_STATUS_LABELS: Record<CloudAgentStatus, string> = {
  running: '运行中',
  idle: '空闲',
  failed: '失败',
}

// ---------- Manifest ----------
export interface Manifest {
  id: string
  name: string
  manifestVersion: string
  systemPrompt?: string
  model?: string
  runtime?: RuntimeSpec
}

export interface RuntimeSpec {
  cpu: string
  memory: string
  storage: string
}

// ---------- 运行时 ----------
export interface CloudRuntime {
  id: string
  agentId: string
  status: RuntimeStatus
  sessions: CloudSession[]
  sandbox: SandboxInfo
}

export type RuntimeStatus = 'running' | 'sleeping' | 'failed'

export const RUNTIME_STATUS_LABELS: Record<RuntimeStatus, string> = {
  running: '运行中',
  sleeping: '休眠',
  failed: '失败',
}

// ---------- 沙箱 ----------
export interface SandboxInfo {
  id: string
  filesystem: string // Linux 文件系统路径
  terminal: boolean // 终端访问
  createdAt: number
}

// ---------- 会话 ----------
export interface CloudSession {
  id: string
  agentId: string
  runtimeId: string
  name: string
  status: SessionStatus
  messageCount: number
  lastAccessedAt: number
  createdAt: number
}

export type SessionStatus = 'active' | 'sleeping' | 'archived'

// ---------- 版本 ----------
export interface Version {
  id: string
  agentId: string
  version: string
  manifest: Manifest
  changelog: string
  publishedAt: number
}

// ---------- 快照 ----------
export interface Checkpoint {
  id: string
  sessionId: string
  label: string
  snapshot: string // 会话状态快照
  createdAt: number
}

// ---------- 渠道 ----------
export type ChannelType = 'wecom_aibot' | 'qq_bot' | 'feishu' | 'dingtalk'

export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  wecom_aibot: '企微 AIBot',
  qq_bot: 'QQ 机器人',
  feishu: '飞书',
  dingtalk: '钉钉',
}

export interface AgentChannel {
  id: string
  agentId: string
  sessionId: string
  type: ChannelType
  url: string
  activatedAt: number
}

// ---------- 评测 ----------
export interface Evaluation {
  id: string
  agentId: string
  datasetId: string
  datasetName: string
  status: 'pending' | 'running' | 'completed'
  score?: number
  details?: EvaluationDetail[]
  startedAt?: number
  completedAt?: number
}

export interface EvaluationDetail {
  question: string
  expectedAnswer: string
  actualAnswer: string
  score: number
}

// ---------- MCP 配置 ----------
export interface MCPConfig {
  serverName: string
  url: string
  authMethod: 'none' | 'api_key' | 'oauth'
  credentialId?: string
}

// ---------- 凭据 ----------
export interface Credential {
  id: string
  name: string
  type: 'api_key' | 'oauth_token' | 'basic_auth'
  agentId: string
  createdAt: number
}

// ---------- 创建向导步骤 ----------
export type CreateStep = 'basics' | 'capabilities' | 'advanced' | 'test_run'

export interface CreateWizardState {
  step: CreateStep
  name: string
  model: string
  systemPrompt: string
  skills: string[]
  experts: string[]
  mcpServers: MCPConfig[]
  memory: boolean
  knowledgeBase: string[]
  runtime: RuntimeSpec
}

// ---------- 本地 mock 数据 ----------

export const AVAILABLE_MODELS_CLOUD = [
  { id: 'auto', name: 'Auto', description: '自动选择最优模型' },
  { id: 'deepseek-v4', name: 'DeepSeek V4', description: '通用任务' },
  { id: 'hunyuan-pro', name: '混元 Pro', description: '中文优化' },
  { id: 'glm-4', name: 'GLM-4', description: '复杂推理' },
  { id: 'kimi', name: 'Kimi', description: '视觉任务' },
]

export function createMockCloudAgents(): CloudAgent[] {
  return [
    {
      id: 'ca-001',
      name: '代码审查助手',
      status: 'running',
      manifest: {
        id: 'ca-001',
        name: '代码审查助手',
        manifestVersion: '1.0',
        systemPrompt: '你是一位资深代码审查专家，帮助团队发现代码中的问题并提供改进建议。',
        model: 'deepseek-v4',
        runtime: { cpu: '2c', memory: '4Gi', storage: '20Gi' },
      },
      skills: ['code-review', 'lint-check'],
      experts: [],
      mcpServers: [{ serverName: 'github', url: 'https://api.github.com', authMethod: 'oauth', credentialId: 'cred-001' }],
      memory: true,
      knowledgeBase: ['team-coding-standards'],
      createdAt: Date.now() - 86400000 * 30,
      updatedAt: Date.now() - 86400000,
    },
    {
      id: 'ca-002',
      name: '数据分析助手',
      status: 'idle',
      manifest: {
        id: 'ca-002',
        name: '数据分析助手',
        manifestVersion: '1.0',
        systemPrompt: '你是一位数据分析专家，擅长处理 Excel、CSV 数据并生成可视化报告。',
        model: 'glm-4',
        runtime: { cpu: '4c', memory: '8Gi', storage: '50Gi' },
      },
      skills: ['data-analysis', 'chart-generation'],
      experts: [],
      mcpServers: [],
      memory: false,
      knowledgeBase: ['data-schema'],
      createdAt: Date.now() - 86400000 * 15,
      updatedAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'ca-003',
      name: '文档撰写助手',
      status: 'running',
      manifest: {
        id: 'ca-003',
        name: '文档撰写助手',
        manifestVersion: '1.0',
        systemPrompt: '你是一位技术文档撰写专家，帮助团队编写接口文档、README、用户手册等。',
        model: 'hunyuan-pro',
        runtime: { cpu: '2c', memory: '4Gi', storage: '20Gi' },
      },
      skills: ['document-generation'],
      experts: [],
      mcpServers: [],
      memory: true,
      knowledgeBase: ['api-docs', 'style-guide'],
      createdAt: Date.now() - 86400000 * 7,
      updatedAt: Date.now() - 86400000,
    },
  ]
}

export function createMockRuntime(agentId: string): CloudRuntime {
  return {
    id: `rt-${agentId}`,
    agentId,
    status: 'running',
    sessions: [
      {
        id: 'sess-001',
        agentId,
        runtimeId: `rt-${agentId}`,
        name: '主会话',
        status: 'active',
        messageCount: 42,
        lastAccessedAt: Date.now() - 1800000,
        createdAt: Date.now() - 86400000 * 7,
      },
      {
        id: 'sess-002',
        agentId,
        runtimeId: `rt-${agentId}`,
        name: '测试会话',
        status: 'sleeping',
        messageCount: 8,
        lastAccessedAt: Date.now() - 86400000 * 3,
        createdAt: Date.now() - 86400000 * 7,
      },
    ],
    sandbox: {
      id: `sb-${agentId}`,
      filesystem: '/home/agent/workspace',
      terminal: true,
      createdAt: Date.now() - 86400000 * 7,
    },
  }
}

export function createMockVersions(agentId: string): Version[] {
  return [
    {
      id: 'v-003',
      agentId,
      version: '1.2.0',
      manifest: { id: agentId, name: 'Agent', manifestVersion: '1.2', systemPrompt: '最新版 prompt', model: 'deepseek-v4' },
      changelog: '更新 System Prompt，增加代码审查模板',
      publishedAt: Date.now() - 86400000,
    },
    {
      id: 'v-002',
      agentId,
      version: '1.1.0',
      manifest: { id: agentId, name: 'Agent', manifestVersion: '1.1', systemPrompt: '旧版 prompt', model: 'glm-4' },
      changelog: '切换默认模型为 GLM-4，增加数据分析 Skill',
      publishedAt: Date.now() - 86400000 * 7,
    },
    {
      id: 'v-001',
      agentId,
      version: '1.0.0',
      manifest: { id: agentId, name: 'Agent', manifestVersion: '1.0', systemPrompt: '初始 prompt' },
      changelog: '初始版本',
      publishedAt: Date.now() - 86400000 * 14,
    },
  ]
}

export function createMockEvaluations(agentId: string): Evaluation[] {
  return [
    {
      id: 'eval-001',
      agentId,
      datasetId: 'ds-001',
      datasetName: '代码审查测试集',
      status: 'completed',
      score: 87.5,
      details: [
        { question: '找出代码中的 SQL 注入漏洞', expectedAnswer: '使用参数化查询', actualAnswer: '使用参数化查询防止 SQL 注入', score: 90 },
        { question: '评价代码可读性', expectedAnswer: '变量命名清晰', actualAnswer: '变量命名规范，但注释可以更详细', score: 85 },
      ],
      startedAt: Date.now() - 86400000 * 2,
      completedAt: Date.now() - 86400000 * 2 + 600000,
    },
  ]
}
