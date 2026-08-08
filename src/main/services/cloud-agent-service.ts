// ============================================================
// 企业智能体 (CloudAgent) 服务
// 依赖: 企业后台 API，本地开发使用 mock 数据模拟 UI 和数据流
// ============================================================
import { v4 as uuid } from 'uuid'
import type {
  CloudAgent, CloudAgentStatus, CloudRuntime, Version, Checkpoint,
  Manifest, MCPConfig, RuntimeSpec, CloudSession, AgentChannel, ChannelType,
  Evaluation,
} from '../../lib/cloud-agent'
import {
  createMockCloudAgents, createMockRuntime, createMockVersions, createMockEvaluations,
} from '../../lib/cloud-agent'

export class CloudAgentService {
  private agents: CloudAgent[] = createMockCloudAgents()
  private runtimes: Map<string, CloudRuntime> = new Map()
  private versions: Map<string, Version[]> = new Map()
  private channels: AgentChannel[] = []
  private evaluations: Map<string, Evaluation[]> = new Map()

  // ---------- Agent CRUD ----------

  list(): CloudAgent[] {
    return this.agents
  }

  get(agentId: string): CloudAgent | null {
    return this.agents.find((a) => a.id === agentId) || null
  }

  create(params: {
    name: string
    model: string
    systemPrompt: string
    skills: string[]
    experts: string[]
    mcpServers: MCPConfig[]
    memory: boolean
    knowledgeBase: string[]
  }): CloudAgent {
    const id = `ca-${uuid().slice(0, 8)}`
    const agent: CloudAgent = {
      id,
      name: params.name,
      status: 'idle',
      manifest: {
        id,
        name: params.name,
        manifestVersion: '1.0',
        systemPrompt: params.systemPrompt || undefined,
        model: params.model || 'auto',
        runtime: { cpu: '2c', memory: '4Gi', storage: '20Gi' },
      },
      skills: params.skills,
      experts: params.experts,
      mcpServers: params.mcpServers,
      memory: params.memory,
      knowledgeBase: params.knowledgeBase,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.agents.push(agent)
    return agent
  }

  update(agentId: string, updates: Partial<{
    name: string; model: string; systemPrompt: string
    skills: string[]; experts: string[]; mcpServers: MCPConfig[]
    memory: boolean; knowledgeBase: string[]
  }>): CloudAgent | null {
    const agent = this.agents.find((a) => a.id === agentId)
    if (!agent) return null
    if (updates.name !== undefined) { agent.name = updates.name; agent.manifest.name = updates.name }
    if (updates.model !== undefined) agent.manifest.model = updates.model
    if (updates.systemPrompt !== undefined) agent.manifest.systemPrompt = updates.systemPrompt
    if (updates.skills !== undefined) agent.skills = updates.skills
    if (updates.experts !== undefined) agent.experts = updates.experts
    if (updates.mcpServers !== undefined) agent.mcpServers = updates.mcpServers
    if (updates.memory !== undefined) agent.memory = updates.memory
    if (updates.knowledgeBase !== undefined) agent.knowledgeBase = updates.knowledgeBase
    agent.updatedAt = Date.now()
    return agent
  }

  delete(agentId: string): boolean {
    const idx = this.agents.findIndex((a) => a.id === agentId)
    if (idx === -1) return false
    this.agents.splice(idx, 1)
    this.runtimes.delete(agentId)
    this.versions.delete(agentId)
    this.evaluations.delete(agentId)
    this.channels = this.channels.filter((c) => c.agentId !== agentId)
    return true
  }

  clone(agentId: string): CloudAgent | null {
    const original = this.agents.find((a) => a.id === agentId)
    if (!original) return null

    const clone: CloudAgent = {
      ...original,
      id: `ca-${uuid().slice(0, 8)}`,
      name: `${original.name} (副本)`,
      manifest: { ...original.manifest, id: `ca-${uuid().slice(0, 8)}`, name: `${original.name} (副本)` },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.agents.push(clone)
    return clone
  }

  // ---------- 启动/停止 ----------

  start(agentId: string): { success: boolean; agent?: CloudAgent } {
    const agent = this.agents.find((a) => a.id === agentId)
    if (!agent) return { success: false }
    agent.status = 'running'

    // 创建 Runtime
    if (!this.runtimes.has(agentId)) {
      this.runtimes.set(agentId, createMockRuntime(agentId))
    } else {
      const rt = this.runtimes.get(agentId)
      if (rt) rt.status = 'running'
    }

    return { success: true, agent }
  }

  stop(agentId: string): { success: boolean; agent?: CloudAgent } {
    const agent = this.agents.find((a) => a.id === agentId)
    if (!agent) return { success: false }
    agent.status = 'idle'

    const rt = this.runtimes.get(agentId)
    if (rt) rt.status = 'sleeping'

    return { success: true, agent }
  }

  // ---------- Runtime ----------

  getRuntime(agentId: string): CloudRuntime | null {
    return this.runtimes.get(agentId) || null
  }

  getRuntimeStatus(agentId: string): { status: string; sessions: number } {
    const rt = this.runtimes.get(agentId)
    if (!rt) return { status: 'unknown', sessions: 0 }
    return { status: rt.status, sessions: rt.sessions.length }
  }

  // 休眠/唤醒
  sleepRuntime(agentId: string): boolean {
    const rt = this.runtimes.get(agentId)
    if (!rt) return false
    rt.status = 'sleeping'
    rt.sessions.forEach((s) => { s.status = 'sleeping' })
    return true
  }

  wakeRuntime(agentId: string): boolean {
    const rt = this.runtimes.get(agentId)
    if (!rt) return false
    rt.status = 'running'
    rt.sessions.forEach((s) => { s.status = 'active' })
    return true
  }

  // ---------- Session ----------

  listSessions(agentId: string): CloudSession[] {
    const rt = this.runtimes.get(agentId)
    return rt?.sessions || []
  }

  deleteSession(agentId: string, sessionId: string): boolean {
    const rt = this.runtimes.get(agentId)
    if (!rt) return false
    const idx = rt.sessions.findIndex((s) => s.id === sessionId)
    if (idx === -1) return false
    rt.sessions.splice(idx, 1)
    return true
  }

  // ---------- 版本管理 ----------

  getVersions(agentId: string): Version[] {
    if (!this.versions.has(agentId)) {
      this.versions.set(agentId, createMockVersions(agentId))
    }
    return this.versions.get(agentId)!
  }

  createVersion(agentId: string, manifest: Manifest, changelog: string): Version {
    const versions = this.versions.get(agentId) || []
    const maxVer = versions.length > 0
      ? Math.max(...versions.map((v) => parseInt(v.version.split('.').pop() || '0')))
      : 0
    const version: Version = {
      id: `v-${uuid().slice(0, 8)}`,
      agentId,
      version: `1.${maxVer + 1}.0`,
      manifest,
      changelog,
      publishedAt: Date.now(),
    }
    if (!this.versions.has(agentId)) this.versions.set(agentId, [])
    this.versions.get(agentId)!.push(version)
    return version
  }

  rollback(agentId: string, versionId: string): CloudAgent | null {
    const agent = this.agents.find((a) => a.id === agentId)
    const versions = this.versions.get(agentId)
    if (!agent || !versions) return null

    const target = versions.find((v) => v.id === versionId)
    if (!target) return null

    agent.manifest = { ...target.manifest }
    agent.updatedAt = Date.now()
    return agent
  }

  // ---------- 部署 ----------

  deploy(agentId: string): { success: boolean; url?: string; message: string } {
    const agent = this.agents.find((a) => a.id === agentId)
    if (!agent) return { success: false, message: 'Agent 不存在' }

    // mock 部署
    const url = `https://cloud.agent.qq.com/deploy/${agent.id}`
    return { success: true, url, message: `已部署到公网: ${url}` }
  }

  // ---------- 渠道接入 ----------

  addChannel(agentId: string, type: ChannelType): AgentChannel | null {
    const agent = this.agents.find((a) => a.id === agentId)
    if (!agent) return null

    const channel: AgentChannel = {
      id: `ch-${uuid().slice(0, 8)}`,
      agentId,
      sessionId: `sess-${uuid().slice(0, 8)}`,
      type,
      url: `https://${type}.example.com/bot/${agent.id}`,
      activatedAt: Date.now(),
    }
    this.channels.push(channel)
    return channel
  }

  removeChannel(channelId: string): boolean {
    const idx = this.channels.findIndex((c) => c.id === channelId)
    if (idx === -1) return false
    this.channels.splice(idx, 1)
    return true
  }

  listChannels(agentId: string): AgentChannel[] {
    return this.channels.filter((c) => c.agentId === agentId)
  }

  // ---------- 评测 ----------

  getEvaluations(agentId: string): Evaluation[] {
    if (!this.evaluations.has(agentId)) {
      this.evaluations.set(agentId, createMockEvaluations(agentId))
    }
    return this.evaluations.get(agentId)!
  }

  startEvaluation(agentId: string, datasetId: string, datasetName: string): Evaluation {
    const evalId = `eval-${uuid().slice(0, 8)}`
    const evaluation: Evaluation = {
      id: evalId,
      agentId,
      datasetId,
      datasetName,
      status: 'running',
      startedAt: Date.now(),
    }
    if (!this.evaluations.has(agentId)) this.evaluations.set(agentId, [])
    this.evaluations.get(agentId)!.push(evaluation)

    // mock 完成后 5s 内自动完成
    setTimeout(() => {
      evaluation.status = 'completed'
      evaluation.score = 85 + Math.random() * 15
      evaluation.completedAt = Date.now()
      evaluation.details = [
        {
          question: '测试问题 1',
          expectedAnswer: '预期答案 1',
          actualAnswer: '实际答案 1',
          score: 90,
        },
        {
          question: '测试问题 2',
          expectedAnswer: '预期答案 2',
          actualAnswer: '实际答案 2',
          score: Math.floor(70 + Math.random() * 30),
        },
      ]
    }, 5000)

    return evaluation
  }
}

export const cloudAgentService = new CloudAgentService()
