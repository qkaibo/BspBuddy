// ============================================================
// 企业智能体 (CloudAgent) 管理面板
// 创建向导 + Runtime 监控 + Session 管理 + 评测
// 对应 SPEC: CloudAgent.md, 15-2
// ============================================================
import { useState, useEffect } from 'react'
import {
  Cloud, Plus, Play, Square, Trash2, Copy, ExternalLink,
  Activity, MessageSquare, History, BarChart3, Globe, Link as LinkIcon,
  Edit, Zap, Shield, Database, Users, Cpu, ChevronLeft, Check,
} from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type {
  CloudAgent, CloudAgentStatus, CloudRuntime, Version, CloudSession,
  AgentChannel, ChannelType, Evaluation, CreateWizardState, CreateStep,
  MCPConfig, RuntimeSpec,
} from '../lib/cloud-agent'
import {
  CLOUD_AGENT_STATUS_LABELS, RUNTIME_STATUS_LABELS, CHANNEL_TYPE_LABELS,
  AVAILABLE_MODELS_CLOUD,
} from '../lib/cloud-agent'
import { ConfirmDialog } from './ConfirmDialog'
import { panelRootStyle } from '../lib/panel-layout'

const ipc = createIpcClient()

interface Props {
  onClose?: () => void
}

export function CloudAgentPanel({ onClose }: Props) {
  const [agents, setAgents] = useState<CloudAgent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<CloudAgent | null>(null)
  const [runtime, setRuntime] = useState<CloudRuntime | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [channels, setChannels] = useState<AgentChannel[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [tab, setTab] = useState<'overview' | 'sessions' | 'versions' | 'channels' | 'evaluation'>('overview')
  const [showCreate, setShowCreate] = useState(false)
  const [createStep, setCreateStep] = useState<CreateStep>('basics')
  const [createState, setCreateState] = useState<CreateWizardState>({
    step: 'basics', name: '', model: 'auto', systemPrompt: '',
    skills: [], experts: [], mcpServers: [],
    memory: false, knowledgeBase: [],
    runtime: { cpu: '2c', memory: '4Gi', storage: '20Gi' },
  })
  const [isLoading, setIsLoading] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => { loadAgents() }, [])

  const loadAgents = async () => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.CLOUD_AGENT_LIST) as CloudAgent[]
      setAgents(result || [])
    } catch { /* IPC not yet registered */ }
  }

  const selectAgent = async (agent: CloudAgent) => {
    setSelectedAgent(agent)
    await Promise.all([
      loadRuntime(agent.id),
      loadVersions(agent.id),
      loadChannels(agent.id),
      loadEvaluations(agent.id),
    ])
  }

  const loadRuntime = async (agentId: string) => {
    try { setRuntime(await ipc.invoke('cloud-agent:runtime', agentId) as CloudRuntime | null) } catch { /* */ }
  }

  const loadVersions = async (agentId: string) => {
    try { setVersions(await ipc.invoke(IPC_CHANNELS.CLOUD_AGENT_VERSION, agentId) as Version[] || []) } catch { /* */ }
  }

  const loadChannels = async (agentId: string) => {
    try { setChannels(await ipc.invoke('cloud-agent:channels', agentId) as AgentChannel[] || []) } catch { /* */ }
  }

  const loadEvaluations = async (agentId: string) => {
    try { setEvaluations(await ipc.invoke(IPC_CHANNELS.CLOUD_AGENT_EVALUATE, 'list', agentId) as Evaluation[] || []) } catch { /* */ }
  }

  const handleStart = async (agentId: string) => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.CLOUD_AGENT_START, agentId) as { success: boolean; agent?: CloudAgent }
      if (result.success) { loadAgents(); if (selectedAgent) selectAgent(result.agent!) }
    } catch { /* */ }
  }

  const handleStop = async (agentId: string) => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.CLOUD_AGENT_STOP, agentId) as { success: boolean; agent?: CloudAgent }
      if (result.success) { loadAgents(); if (selectedAgent) selectAgent(result.agent!) }
    } catch { /* */ }
  }

  const handleDelete = async (agentId: string) => {
    try {
      await ipc.invoke(IPC_CHANNELS.CLOUD_AGENT_DELETE, agentId)
      setSelectedAgent(null)
      loadAgents()
    } catch { /* */ }
  }

  const handleClone = async (agentId: string) => {
    try {
      await ipc.invoke('cloud-agent:clone', agentId)
      loadAgents()
    } catch { /* */ }
  }

  const handleCreate = async () => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.CLOUD_AGENT_CREATE, {
        name: createState.name,
        model: createState.model,
        systemPrompt: createState.systemPrompt,
        skills: createState.skills,
        experts: createState.experts,
        mcpServers: createState.mcpServers,
        memory: createState.memory,
        knowledgeBase: createState.knowledgeBase,
      }) as CloudAgent
      setShowCreate(false)
      loadAgents()
    } catch { /* */ }
  }

  const handleDeploy = async (agentId: string) => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.CLOUD_AGENT_DEPLOY, agentId) as { success: boolean; url?: string; message: string }
      if (result.success && result.url) {
        alert(`Deployed to: ${result.url}`)
      }
    } catch { /* */ }
  }

  const handleAddChannel = async (agentId: string, type: ChannelType) => {
    try {
      await ipc.invoke('cloud-agent:channel-add', agentId, type)
      loadChannels(agentId)
    } catch { /* */ }
  }

  const handleStartEval = async (agentId: string) => {
    try {
      await ipc.invoke(IPC_CHANNELS.CLOUD_AGENT_EVALUATE, 'start', agentId, 'ds-001', '测试集')
      loadEvaluations(agentId)
    } catch { /* */ }
  }

  const statusColor = (status: CloudAgentStatus) => {
    switch (status) {
      case 'running': return '#16a34a'
      case 'idle': return '#b45309'
      case 'failed': return '#dc2626'
    }
  }

  const runtimeStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#16a34a'
      case 'sleeping': return '#f59e0b'
      case 'failed': return '#dc2626'
      default: return 'var(--text-tertiary)'
    }
  }

  // Agent list view
  if (!selectedAgent && !showCreate) {
    return (
      <div style={panelRootStyle()}>
        <div style={headerStyle}>
          {onClose && <button type="button" onClick={onClose} aria-label="关闭云端智能体" style={backBtnStyle}><ChevronLeft size={16} aria-hidden="true" /></button>}
          <Cloud size={18} color="var(--accent)" aria-hidden="true" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Cloud Agents</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowCreate(true)} style={primaryBtnStyle}>
            <Plus size={13} /> Create Agent
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12 }}>
            ⚠️ Enterprise backend required. Showing mock data for UI development.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {agents.map((agent) => (
              <button
                type="button"
                key={agent.id}
                onClick={() => selectAgent(agent)}
                aria-label={`打开智能体 ${agent.name}`}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'var(--bg-card)', borderRadius: 10, padding: 16,
                  border: '1px solid var(--border)', cursor: 'pointer',
                  transition: 'box-shadow .15s', fontFamily: 'inherit', color: 'inherit',
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Cloud size={16} color="var(--accent)" aria-hidden="true" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{agent.name}</span>
                  </div>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 8,
                    background: agent.status === 'running' ? 'rgba(34,197,94,.15)' : 'rgba(251,191,36,.15)',
                    color: statusColor(agent.status),
                  }}>
                    {CLOUD_AGENT_STATUS_LABELS[agent.status]}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
                  {agent.manifest.systemPrompt?.slice(0, 80) || 'No system prompt'}
                  {(agent.manifest.systemPrompt?.length || 0) > 80 ? '…' : ''}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-tertiary)' }}>
                  <span>Model: {agent.manifest.model || 'auto'}</span>
                  <span>Skills: {agent.skills.length}</span>
                  <span>{agent.memory ? 'Memory On' : 'Memory Off'}</span>
                </div>
              </button>
            ))}
          </div>

          {agents.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
              <Cloud size={48} style={{ marginBottom: 12, opacity: .3 }} />
              <div style={{ fontSize: 15, marginBottom: 8 }}>No agents yet</div>
              <div style={{ fontSize: 12, marginBottom: 16 }}>Create your first cloud agent to get started</div>
              <button onClick={() => setShowCreate(true)} style={primaryBtnStyle}>
                <Plus size={14} /> Create Agent
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Create wizard
  if (showCreate) {
    return (
      <div style={panelRootStyle()}>
        <div style={headerStyle}>
          <button type="button" onClick={() => setShowCreate(false)} aria-label="取消创建" style={backBtnStyle}><ChevronLeft size={16} aria-hidden="true" /></button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Create Agent</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            {/* Step indicator */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
              {(['basics', 'capabilities', 'advanced', 'test_run'] as CreateStep[]).map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                  <button type="button" onClick={() => setCreateStep(s)} style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    background: createStep === s ? 'var(--accent)' : 'transparent',
                    color: createStep === s ? '#fff' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {i + 1}. {s === 'basics' ? 'Basics' : s === 'capabilities' ? 'Capabilities' : s === 'advanced' ? 'Advanced' : 'Test Run'}
                  </button>
                  {i < 3 && <div style={{ width: 20, height: 1, background: 'var(--border)' }} />}
                </div>
              ))}
            </div>

            {/* Basics step */}
            {createStep === 'basics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label htmlFor="cloud-agent-name" style={fieldLabel}>Agent Name</label>
                  <input id="cloud-agent-name" name="cloud-agent-name" value={createState.name} onChange={(e) => setCreateState({ ...createState, name: e.target.value })} placeholder="My Agent" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="cloud-agent-model" style={fieldLabel}>Model</label>
                  <select id="cloud-agent-model" name="cloud-agent-model" value={createState.model} onChange={(e) => setCreateState({ ...createState, model: e.target.value })} style={selectStyle}>
                    {AVAILABLE_MODELS_CLOUD.map((m) => <option key={m.id} value={m.id}>{m.name} - {m.description}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="cloud-agent-prompt" style={fieldLabel}>System Prompt</label>
                  <textarea id="cloud-agent-prompt" name="cloud-agent-prompt" value={createState.systemPrompt} onChange={(e) => setCreateState({ ...createState, systemPrompt: e.target.value })} placeholder="Define how your agent should behave…" rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <button type="button" onClick={() => setCreateStep('capabilities')} disabled={!createState.name} style={{
                  ...primaryBtnStyle, width: 'fit-content', alignSelf: 'flex-end',
                  opacity: createState.name ? 1 : .5,
                }}>
                  Next: Capabilities <ChevronLeft size={13} style={{ transform: 'rotate(180deg)' }} aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Capabilities step */}
            {createStep === 'capabilities' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label htmlFor="cloud-agent-skills" style={fieldLabel}>Skills (comma separated)</label>
                  <input id="cloud-agent-skills" name="cloud-agent-skills" value={createState.skills.join(', ')} onChange={(e) => setCreateState({ ...createState, skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="code-review, data-analysis" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="cloud-agent-experts" style={fieldLabel}>Experts (comma separated)</label>
                  <input id="cloud-agent-experts" name="cloud-agent-experts" value={createState.experts.join(', ')} onChange={(e) => setCreateState({ ...createState, experts: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="frontend-expert" style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setCreateStep('basics')} style={secondaryBtnStyle}>Back</button>
                  <button type="button" onClick={() => setCreateStep('advanced')} style={primaryBtnStyle}>Next: Advanced</button>
                </div>
              </div>
            )}

            {/* Advanced step */}
            {createStep === 'advanced' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label htmlFor="cloud-agent-kb" style={fieldLabel}>Knowledge Base (comma separated)</label>
                  <input id="cloud-agent-kb" name="cloud-agent-kb" value={createState.knowledgeBase.join(', ')} onChange={(e) => setCreateState({ ...createState, knowledgeBase: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="team-coding-standards" style={inputStyle} />
                </div>
                <label htmlFor="cloud-agent-memory" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input id="cloud-agent-memory" type="checkbox" name="cloud-agent-memory" checked={createState.memory} onChange={(e) => setCreateState({ ...createState, memory: e.target.checked })} />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Enable Memory (cross-turn context)</span>
                </label>
                <div>
                  <span style={fieldLabel} id="cloud-runtime-label">Runtime Spec</span>
                  <div style={{ display: 'flex', gap: 8 }} role="group" aria-labelledby="cloud-runtime-label">
                    <select aria-label="CPU" value={createState.runtime.cpu} onChange={(e) => setCreateState({ ...createState, runtime: { ...createState.runtime, cpu: e.target.value } })} style={{ ...selectStyle, flex: 1 }}>
                      <option value="2c">2 vCPU</option><option value="4c">4 vCPU</option><option value="8c">8 vCPU</option>
                    </select>
                    <select aria-label="内存" value={createState.runtime.memory} onChange={(e) => setCreateState({ ...createState, runtime: { ...createState.runtime, memory: e.target.value } })} style={{ ...selectStyle, flex: 1 }}>
                      <option value="4Gi">4 GB</option><option value="8Gi">8 GB</option><option value="16Gi">16 GB</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setCreateStep('capabilities')} style={secondaryBtnStyle}>Back</button>
                  <button type="button" onClick={handleCreate} style={primaryBtnStyle}><Check size={14} aria-hidden="true" /> Create Agent</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Agent detail view
  if (selectedAgent) {
    return (
      <div style={panelRootStyle()}>
        <div style={headerStyle}>
          <button type="button" onClick={() => { setSelectedAgent(null); loadAgents() }} aria-label="返回智能体列表" style={backBtnStyle}><ChevronLeft size={16} aria-hidden="true" /></button>
          <Cloud size={18} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedAgent.name}</span>
          <span style={{
            marginLeft: 8, fontSize: 10, padding: '2px 8px', borderRadius: 8,
            background: selectedAgent.status === 'running' ? 'rgba(34,197,94,.15)' : 'rgba(251,191,36,.15)',
            color: statusColor(selectedAgent.status),
          }}>
            {CLOUD_AGENT_STATUS_LABELS[selectedAgent.status]}
          </span>
          <div style={{ flex: 1 }} />
          {selectedAgent.status === 'running' ? (
            <button type="button" onClick={() => handleStop(selectedAgent.id)} style={{ ...actionBtnStyle, color: '#dc2626' }}><Square size={12} aria-hidden="true" /> Stop</button>
          ) : (
            <button type="button" onClick={() => handleStart(selectedAgent.id)} style={{ ...actionBtnStyle, color: '#16a34a' }}><Play size={12} aria-hidden="true" /> Start</button>
          )}
          <button type="button" onClick={() => handleClone(selectedAgent.id)} aria-label="克隆智能体" style={actionBtnStyle}><Copy size={12} aria-hidden="true" /></button>
          <button type="button" onClick={() => setConfirmDeleteId(selectedAgent.id)} aria-label="删除智能体" style={{ ...actionBtnStyle, color: 'var(--danger)' }}><Trash2 size={12} aria-hidden="true" /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '0 16px' }}>
          {([
            { id: 'overview' as const, label: 'Overview', icon: Activity },
            { id: 'sessions' as const, label: 'Sessions', icon: MessageSquare },
            { id: 'versions' as const, label: 'Versions', icon: History },
            { id: 'channels' as const, label: 'Channels', icon: LinkIcon },
            { id: 'evaluation' as const, label: 'Evaluation', icon: BarChart3 },
          ]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px',
              border: 'none', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: 12,
              color: tab === t.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: tab === t.id ? 600 : 400, fontFamily: 'inherit',
            }}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* Overview */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={cardStyle}>
                <div style={cardTitle}>Runtime Status</div>
                {runtime ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: runtimeStatusColor(runtime.status) }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: runtimeStatusColor(runtime.status) }}>{RUNTIME_STATUS_LABELS[runtime.status]}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Sandbox: {runtime.sandbox.filesystem}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Sessions: {runtime.sessions.length}</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Start the agent to create a runtime</div>
                )}
              </div>

              <div style={cardStyle}>
                <div style={cardTitle}>Configuration</div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 16px', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Model:</span><span>{selectedAgent.manifest.model || 'auto'}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>Skills:</span><span>{selectedAgent.skills.join(', ') || 'None'}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>Memory:</span><span>{selectedAgent.memory ? 'Enabled' : 'Disabled'}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>KB:</span><span>{selectedAgent.knowledgeBase.join(', ') || 'None'}</span>
                </div>
              </div>

              <div style={cardStyle}>
                <div style={cardTitle}>System Prompt</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {selectedAgent.manifest.systemPrompt || 'No system prompt configured'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleDeploy(selectedAgent.id)} style={primaryBtnStyle}><Globe size={13} /> Deploy to Public</button>
              </div>
            </div>
          )}

          {/* Sessions */}
          {tab === 'sessions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {runtime?.sessions.map((s) => (
                <div key={s.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      Messages: {s.messageCount} · Last access: {new Date(s.lastAccessedAt).toLocaleString()}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 8,
                    background: s.status === 'active' ? 'rgba(34,197,94,.15)' : 'rgba(251,191,36,.15)',
                    color: s.status === 'active' ? '#16a34a' : '#b45309',
                  }}>
                    {s.status}
                  </span>
                </div>
              ))}
              {(!runtime || runtime.sessions.length === 0) && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No sessions</div>
              )}
            </div>
          )}

          {/* Versions */}
          {tab === 'versions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {versions.map((v) => (
                <div key={v.id} style={{ ...cardStyle }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>v{v.version}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{new Date(v.publishedAt).toLocaleDateString()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v.changelog}</div>
                </div>
              ))}
              {versions.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No versions</div>
              )}
            </div>
          )}

          {/* Channels */}
          {tab === 'channels' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {(Object.entries(CHANNEL_TYPE_LABELS) as [ChannelType, string][]).map(([type, label]) => (
                  <button key={type} onClick={() => handleAddChannel(selectedAgent.id, type)} style={secondaryBtnStyle}>
                    <LinkIcon size={12} /> {label}
                  </button>
                ))}
              </div>
              {channels.map((c) => (
                <div key={c.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{CHANNEL_TYPE_LABELS[c.type]}</span>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{c.url}</div>
                  </div>
                  <ExternalLink size={14} color="var(--text-tertiary)" />
                </div>
              ))}
              {channels.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No channels connected</div>
              )}
            </div>
          )}

          {/* Evaluation */}
          {tab === 'evaluation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => handleStartEval(selectedAgent.id)} style={{ ...primaryBtnStyle, width: 'fit-content' }}>
                <BarChart3 size={13} /> Start Evaluation
              </button>
              {evaluations.map((e) => (
                <div key={e.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{e.datasetName}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 8,
                      background: e.status === 'completed' ? 'rgba(34,197,94,.15)' : 'rgba(251,191,36,.15)',
                      color: e.status === 'completed' ? '#16a34a' : '#b45309',
                    }}>
                      {e.status}{e.score !== undefined ? ` (${e.score})` : ''}
                    </span>
                  </div>
                  {e.details?.map((d, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '4px 0' }}>
                      Q: {d.question} → Score: {d.score}
                    </div>
                  ))}
                </div>
              ))}
              {evaluations.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No evaluations</div>
              )}
            </div>
          )}
        </div>
      {confirmDeleteId && (
        <ConfirmDialog
          title="确认删除智能体"
          message="删除后该云端智能体及其运行数据将不可恢复，确定要删除吗？"
          onConfirm={() => {
            const id = confirmDeleteId
            setConfirmDeleteId(null)
            void handleDelete(id)
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
    )
  }

  return null
}

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 16px', borderBottom: '1px solid var(--border)',
  background: 'var(--bg-card)', flexShrink: 0,
}

const backBtnStyle: React.CSSProperties = {
  padding: 2, background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-secondary)', display: 'flex',
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '7px 14px', borderRadius: 6, border: 'none',
  background: 'var(--accent)', color: '#fff',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}

const secondaryBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text-secondary)',
  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
}

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
  borderRadius: 6, border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', borderRadius: 8, padding: 14,
  border: '1px solid var(--border)',
}

const cardTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8,
}

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-input)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-input)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
}
