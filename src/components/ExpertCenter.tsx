import { useState, useEffect } from 'react'
import { Users, UserPlus, Search, Star, Zap, Cpu, Cog, BarChart3, PenTool, Terminal, Server, Code, User, ChevronRight, Play, ListTodo, Edit3, Trash2, ToggleLeft, ToggleRight, Globe, BookOpen, Link } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import { apiPost, apiPut, apiDelete, setApiToken, apiLogin } from '../lib/api-client'
import type { Expert, ExpertTeam, ExpertStatus } from '../lib/expert-types'
import { mapExpertToAgentRequest } from '../lib/expert-mapper'
import { ExpertEditorModal } from './ExpertEditorModal'
import { ExpertSquare } from './ExpertSquare'
import { ConfirmDialog } from './ConfirmDialog'
import { setExpertScopeId } from '../lib/expert-scope'
import { panelRootStyle } from '../lib/panel-layout'

const ipc = createIpcClient()

interface Props {
  onClose: () => void
  onSummonExpert?: (expert: Expert, sessionId: string, welcomeMessage: string) => void
  onTeamExecute?: (team: ExpertTeam, task: string) => void
  /** StaffDeck: jump to SOP workbench with this expert as scope */
  onManageSop?: (expert: Expert) => void
  /** StaffDeck: jump to General Skills panel with this expert as scope */
  onManageSkill?: (expert: Expert) => void
  /** StaffDeck: jump to MCP panel with this expert as scope */
  onManageMcp?: (expert: Expert) => void
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  management: <ListTodo size={10} />,
  planning: <ListTodo size={10} />,
  data: <BarChart3 size={10} />,
  analytics: <BarChart3 size={10} />,
  writing: <PenTool size={10} />,
  creative: <PenTool size={10} />,
  development: <Terminal size={10} />,
  engineering: <Cog size={10} />,
  hardware: <Cpu size={10} />,
}

const STATUS_LABELS: Record<ExpertStatus, string> = {
  draft: '草稿',
  online: '在线',
  offline: '已下线',
}

const STATUS_COLORS: Record<ExpertStatus, string> = {
  draft: '#f59e0b',
  online: '#22c55e',
  offline: '#6b7280',
}

export function ExpertCenter({ onClose, onSummonExpert, onTeamExecute, onManageSop, onManageSkill, onManageMcp }: Props) {
  const [experts, setExperts] = useState<Expert[]>([])
  const [teams, setTeams] = useState<ExpertTeam[]>([])
  const [topTab, setTopTab] = useState<'use' | 'manage'>('use')
  const [subTab, setSubTab] = useState<'experts' | 'teams' | 'square'>('experts')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [expandedExpert, setExpandedExpert] = useState<string | null>(null)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [teamTask, setTeamTask] = useState('')
  const [showTeamTask, setShowTeamTask] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingExpert, setEditingExpert] = useState<Expert | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    initAuth()
    loadData()

    // Poll for FastAPI readiness — when backend becomes available, reload from API
    let didReload = false
    const poll = setInterval(async () => {
      if (didReload) { clearInterval(poll); return }
      try {
        const status = await ipc.invoke(IPC_CHANNELS.EXPERT_FASTAPI_STATUS) as { ready: boolean }
        if (status?.ready) {
          // Wait for token to also be ready before calling API
          let token = await ipc.invoke(IPC_CHANNELS.EXPERT_AUTH_TOKEN) as string | null
          if (!token) {
            // Main process auto-login might still be in progress — keep polling
            return
          }
          setApiToken(token)
          didReload = true
          clearInterval(poll)
          loadData()
        }
      } catch { /* ignore */ }
    }, 2000)
    return () => clearInterval(poll)
  }, [])

  async function initAuth() {
    try {
      // Try to get token from IPC (main process auto-login)
      const token = await ipc.invoke(IPC_CHANNELS.EXPERT_AUTH_TOKEN) as string | null
      if (token) {
        setApiToken(token)
        return
      }
      // Only try direct login if FastAPI is running
      const status = await ipc.invoke(IPC_CHANNELS.EXPERT_FASTAPI_STATUS) as { ready: boolean }
      if (status?.ready) {
        const ok = await apiLogin('tenant_demo', 'admin', 'admin')
        if (!ok) {
          console.warn('[ExpertCenter] Auth not available, will retry')
          setTimeout(() => initAuth(), 3000)
        }
      }
    } catch {
      console.warn('[ExpertCenter] Auth check failed, FastAPI may not be ready')
    }
  }

  async function loadData() {
    try {
      // Prefer IPC list: maps FastAPI agents + merges local binding overrides
      // (resource:import local fallback writes binding-overrides.json)
      const [expertList, teamList] = await Promise.all([
        ipc.invoke(IPC_CHANNELS.EXPERT_LIST) as Promise<Expert[]>,
        ipc.invoke(IPC_CHANNELS.EXPERT_TEAM_LIST) as Promise<ExpertTeam[]>,
      ])
      console.log('[ExpertCenter] loaded', expertList.length, 'experts,', teamList.length, 'teams')
      setExperts(expertList)
      setTeams(teamList)
    } catch (err) {
      console.error('[ExpertCenter] loadData failed:', err)
    }
  }

  async function handleSummon(expert: Expert) {
    // Build welcome message from the expert data we already have in the UI.
    // Don't block summon on EXPERT_SUMMON IPC — the expert object has everything.
    let sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const welcomeMessage = `👋 你好！我是${expert.title || expert.name}。\n\n${expert.methodology ? `我的专长：${expert.methodology}\n` : ''}${expert.toolChain?.length > 0 ? `工具链：${expert.toolChain.join('、')}\n` : ''}${expert.description ? `\n${expert.description}\n` : ''}\n请描述你的任务，我将以专家身份为你提供专业支持。`

    // Best-effort IPC call for a server-side sessionId (not required for summon to work)
    try {
      const result = await ipc.invoke(IPC_CHANNELS.EXPERT_SUMMON, expert.id) as { success: boolean; sessionId?: string }
      if (result.success && result.sessionId) {
        sessionId = result.sessionId
      }
    } catch {
      // IPC unavailable — use locally generated sessionId
    }

    console.log('[ExpertCenter] summoning expert:', expert.id, 'session:', sessionId)
    onSummonExpert?.(expert, sessionId, welcomeMessage)
    onClose()
  }

  async function handleTeamExecute(team: ExpertTeam) {
    const task = teamTask.trim() || team.examples[0]?.prompt || '请帮我完成一项任务'
    if (onTeamExecute) {
      onTeamExecute(team, task)
      onClose()
    }
    setShowTeamTask(null)
    setTeamTask('')
  }

  async function handleToggleStatus(expert: Expert) {
    const newStatus: ExpertStatus = expert.status === 'online' ? 'offline' : 'online'
    const updatedExpert = { ...expert, status: newStatus }
    try {
      await apiPut(`/api/enterprise/agents/${expert.id}`, mapExpertToAgentRequest(updatedExpert))
    } catch {
      await ipc.invoke(IPC_CHANNELS.EXPERT_UPDATE, updatedExpert)
    }
    loadData()
  }

  async function handleToggleOverall(expert: Expert) {
    const updatedExpert = { ...expert, isOverall: !expert.isOverall }
    try {
      await apiPut(`/api/enterprise/agents/${expert.id}`, mapExpertToAgentRequest(updatedExpert))
    } catch {
      await ipc.invoke(IPC_CHANNELS.EXPERT_UPDATE, updatedExpert)
    }
    loadData()
  }

  async function handleDelete(expertId: string) {
    try {
      await apiDelete(`/api/enterprise/agents/${expertId}`)
    } catch {
      await ipc.invoke(IPC_CHANNELS.EXPERT_DELETE, expertId)
    }
    loadData()
  }

  function openEditor(expert?: Expert) {
    setEditingExpert(expert || null)
    setEditorOpen(true)
  }

  function handleEditorClose() {
    setEditorOpen(false)
    setEditingExpert(null)
    loadData()
  }

  function handleManageSop(expert: Expert) {
    setExpertScopeId(expert.id)
    onManageSop?.(expert)
  }

  function handleManageSkill(expert: Expert) {
    setExpertScopeId(expert.id)
    onManageSkill?.(expert)
  }

  function handleManageMcp(expert: Expert) {
    setExpertScopeId(expert.id)
    onManageMcp?.(expert)
  }

  const allCategories = ['all', ...new Set(experts.flatMap((e) => e.categories || []))]

  const filteredExperts = experts.filter((e) => {
    if (selectedCategory !== 'all' && !(e.categories || []).includes(selectedCategory)) return false
    if (
      search
      && !(e.name || '').includes(search)
      && !(e.title || '').includes(search)
      && !(e.description || '').includes(search)
    ) return false
    return true
  })

  const filteredTeams = teams.filter((t) => {
    if (search && !t.name.includes(search) && !t.description.includes(search)) return false
    return true
  })

  const manageExperts = experts.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    if (search && !(e.name || '').includes(search) && !(e.title || '').includes(search)) return false
    return true
  })

  return (
    <div style={panelRootStyle()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>专家中心</span>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭专家中心" style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>×</button>
        </div>

        {/* Top-level Tabs: 使用 / 管理 */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
          {([
            { id: 'use' as const, label: '使用', icon: <Play size={12} /> },
            { id: 'manage' as const, label: '管理', icon: <UserPlus size={12} /> },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTopTab(tab.id)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '8px 0', border: 'none', borderBottom: topTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                color: topTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: topTab === tab.id ? 600 : 400,
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ────────── 使用 Tab ────────── */}
        {topTab === 'use' && (
          <>
            {/* Sub Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
              {([
                { id: 'experts' as const, label: '我的专家' },
                { id: 'teams' as const, label: '专家团' },
                { id: 'square' as const, label: '广场' },
              ]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSubTab(tab.id)}
                  style={{
                    flex: 1, padding: '6px 0', border: 'none', borderBottom: subTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                    background: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                    color: subTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: subTab === tab.id ? 600 : 400,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search & Filter (experts & teams sub-tabs) */}
            {(subTab === 'experts' || subTab === 'teams') && (
              <div style={{ padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-input)', borderRadius: 4, padding: '4px 8px', flex: 1 }}>
                    <Search size={12} color="var(--text-tertiary)" aria-hidden="true" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      name="expert-search"
                      aria-label={subTab === 'experts' ? '搜索专家' : '搜索专家团'}
                      placeholder={subTab === 'experts' ? '搜索专家…' : '搜索专家团…'}
                      style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit' }}
                    />
                  </div>
                  {subTab === 'experts' && (
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      aria-label="专家分类筛选"
                      style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 11, fontFamily: 'inherit', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                    >
                      <option value="all">全部行业</option>
                      {allCategories.filter((c) => c !== 'all').map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
              {/* 我的专家 sub-tab */}
              {subTab === 'experts' && (
                <>
                  {filteredExperts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>暂无匹配的专家</div>
                  )}
                  {filteredExperts.filter(e => e.status === 'online').map((expert) => (
                    <div
                      key={expert.id}
                      style={{ padding: '14px', borderRadius: 10, background: 'var(--bg-card)', marginBottom: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
                    >
                      <button
                        type="button"
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                        onClick={() => setExpandedExpert(expandedExpert === expert.id ? null : expert.id)}
                        aria-expanded={expandedExpert === expert.id}
                        aria-label={`${expandedExpert === expert.id ? '折叠' : '展开'}专家 ${expert.name}`}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: expert.isCustom ? 'var(--warning-bg)' : 'var(--accent-light)', flexShrink: 0, fontSize: 16 }}>
                          {expert.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{expert.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{expert.title}</span>
                            {expert.isCustom && (
                              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--warning-bg)', color: 'var(--warning)' }}>自定义</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{expert.description}</div>
<div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
  {(expert.categories || []).map((c) => (
    <span key={c} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover)', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {CATEGORY_ICONS[c] || null}{c}
    </span>
  ))}
</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>
                            {expert.rating && <span><Star size={10} color="var(--warning)" style={{ verticalAlign: 'middle' }} aria-hidden="true" /> {expert.rating}</span>}
                            {expert.usageCount && <span>{expert.usageCount.toLocaleString()} 次使用</span>}
                          </div>
                        </div>
                        <ChevronRight size={16} color="var(--text-tertiary)" aria-hidden="true" style={{ transform: expandedExpert === expert.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', marginTop: 8 }} />
                      </button>
                      {expandedExpert === expert.id && (
                        <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 8, background: 'var(--bg-input)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'slideUp .2s ease-out' }}>

                          {/* Section 1: 能力概览 */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                              <ListTodo size={12} color="var(--text-tertiary)" />
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>能力概览</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {expert.bindings?.sopSkills && expert.bindings.sopSkills.length > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-secondary)' }}>
                                  <ListTodo size={10} color="var(--text-tertiary)" />SOP技能: {expert.bindings.sopSkills.length}个
                                </span>
                              )}
                              {expert.bindings?.skills && expert.bindings.skills.length > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-secondary)' }}>
                                  <Zap size={10} color="var(--text-tertiary)" />技能: {expert.bindings.skills.length}个
                                </span>
                              )}
                              {expert.bindings?.mcpServers && expert.bindings.mcpServers.length > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-secondary)' }}>
                                  <Code size={10} color="var(--text-tertiary)" />MCP: {expert.bindings.mcpServers.length}个
                                </span>
                              )}
                              {expert.bindings?.knowledgeBases && expert.bindings.knowledgeBases.length > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-secondary)' }}>
                                  <BookOpen size={10} color="var(--text-tertiary)" />知识库: {expert.bindings.knowledgeBases.length}个
                                </span>
                              )}
                              {expert.bindings?.connectors && expert.bindings.connectors.length > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-secondary)' }}>
                                  <Link size={10} color="var(--text-tertiary)" />连接器: {expert.bindings.connectors.length}个
                                </span>
                              )}
                              {expert.bindings?.modelId && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-secondary)' }}>
                                  <Cpu size={10} color="var(--text-tertiary)" />模型: {expert.bindings.modelId}
                                </span>
                              )}
                              {!expert.bindings?.sopSkills?.length && !expert.bindings?.skills?.length && !expert.bindings?.mcpServers?.length && !expert.bindings?.knowledgeBases?.length && !expert.bindings?.connectors?.length && !expert.bindings?.modelId && (
                                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>暂无绑定能力</span>
                              )}
                            </div>
                          </div>

                          {/* Section 2: 人设与方法 */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                              <User size={12} color="var(--text-tertiary)" />
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>人设与方法</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 3 }}>人设</div>
                                <div style={{ fontSize: 10, color: 'var(--text-primary)', lineHeight: 1.5 }}>{expert.persona}</div>
                              </div>
                              <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 3 }}>方法论</div>
                                <div style={{ fontSize: 10, color: 'var(--text-primary)', lineHeight: 1.5 }}>{expert.methodology}</div>
                              </div>
                            </div>
                          </div>

                          {/* Section 3: 任务示例 */}
                          {expert.examples.length > 0 && (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                                <Star size={12} color="var(--text-tertiary)" />
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>任务示例</span>
                                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>← 滑动查看 →</span>
                              </div>
                              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                                {expert.examples.map((e, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      flexShrink: 0, width: 155, padding: '8px 10px', borderRadius: 6,
                                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                                      display: 'flex', flexDirection: 'column', gap: 3,
                                    }}
                                  >
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{e.description}</div>
                                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.3 }}>{e.prompt}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Section 4: 召唤专家 */}
                          <button
                            onClick={() => handleSummon(expert)}
                            style={{
                              width: '100%', padding: '10px 16px', borderRadius: 8, border: 'none',
                              background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', gap: 6, transition: 'opacity 0.15s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                          >
                            <Play size={14} /> 召唤专家
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* 专家团 sub-tab */}
              {subTab === 'teams' && (
                <>
                  {filteredTeams.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>暂无匹配的专家团</div>
                  )}
                  {filteredTeams.map((team) => (
                    <div key={team.id} style={{ padding: '14px', borderRadius: 10, background: 'var(--bg-card)', marginBottom: 8, border: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', width: '100%', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', textAlign: 'left' }}
                        onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                        aria-expanded={expandedTeam === team.id}
                        aria-label={`${expandedTeam === team.id ? '折叠' : '展开'}专家团 ${team.name}`}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--purple)', opacity: 0.15, flexShrink: 0, fontSize: 16 }}>
                          <Users size={18} color="var(--purple)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{team.name}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{team.description}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>团长: {team.lead.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>成员: {team.members.map((m) => `${m.expert.name}(${m.role})`).join('、')}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>
                            {team.rating && <span><Star size={10} color="var(--warning)" style={{ verticalAlign: 'middle' }} /> {team.rating}</span>}
                            {team.usageCount && <span>{team.usageCount.toLocaleString()} 次使用</span>}
                          </div>
                        </div>
                        <ChevronRight size={16} color="var(--text-tertiary)" aria-hidden="true" style={{ transform: expandedTeam === team.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', marginTop: 8 }} />
                      </button>
                      {expandedTeam === team.id && (
                        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 6, background: 'var(--bg-input)', fontSize: 11 }}>
                          <div style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>协作流程: </span>
                            {team.collaborationFlow}
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>团队成员:</span>
                            {team.members.map((m, i) => (
                              <div key={i} style={{ marginTop: 4, padding: '4px 8px', borderRadius: 4, background: 'var(--bg-card)', display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{m.expert.name}</span>
                                <span style={{ padding: '1px 5px', borderRadius: 3, background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 9 }}>{m.role}</span>
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{m.responsibilities.join('、')}</span>
                              </div>
                            ))}
                          </div>
                          {team.examples.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>任务示例:</span>
                              {team.examples.map((e, i) => (
                                <div key={i} style={{ marginTop: 4, padding: '6px 8px', borderRadius: 4, background: 'var(--bg-card)' }}>
                                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{e.title}: {e.description}</div>
                                  <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>Prompt: {e.prompt}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {showTeamTask === team.id ? (
                            <div style={{ marginTop: 8 }}>
                              <textarea value={teamTask} onChange={(e) => setTeamTask(e.target.value)} aria-label="任务描述" placeholder="输入任务描述…" rows={3}
                                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 11, fontFamily: 'inherit', resize: 'vertical', color: 'var(--text-primary)', background: 'var(--bg-card)' }}
                              />
                              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                <button onClick={() => handleTeamExecute(team)} style={{ padding: '5px 12px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>开始执行</button>
                                <button onClick={() => setShowTeamTask(null)} style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>取消</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setShowTeamTask(team.id)} style={{ marginTop: 8, padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Play size={12} /> 召唤专家团
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* 广场 sub-tab */}
              {subTab === 'square' && (
                <ExpertSquare onCopyExpert={async (expert) => {
                  try {
                    await apiPost(`/api/chat/agents/${expert.id}/clone`, { tenant_id: 'tenant_demo' })
                  } catch {
                    await ipc.invoke(IPC_CHANNELS.EXPERT_CLONE, expert.id)
                  }
                  loadData()
                }} />
              )}
            </div>
          </>
        )}

        {/* ────────── 管理 Tab ────────── */}
        {topTab === 'manage' && (
          <>
            {/* Search + Filter */}
            <div style={{ padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-input)', borderRadius: 4, padding: '4px 8px', flex: 1 }}>
                <Search size={12} color="var(--text-tertiary)" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  name="expert-manage-search"
                  aria-label="搜索专家"
                  placeholder="搜索专家…"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit' }}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="专家状态筛选"
                style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 11, fontFamily: 'inherit', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              >
                <option value="all">全部状态</option>
                <option value="draft">草稿</option>
                <option value="online">在线</option>
                <option value="offline">已下线</option>
              </select>
              <button
                onClick={() => openEditor()}
                style={{ padding: '5px 12px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <UserPlus size={12} /> 新建专家
              </button>
            </div>

            {/* Expert List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
              {manageExperts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>暂无匹配的专家</div>
              )}
              {manageExperts.map((expert) => (
                <div key={expert.id}
                  style={{ padding: '14px', borderRadius: 10, background: 'var(--bg-card)', marginBottom: 8, border: '1px solid var(--border)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: expert.isCustom ? 'var(--warning-bg)' : 'var(--accent-light)', flexShrink: 0, fontSize: 16 }}>
                      {expert.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{expert.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{expert.title}</span>
                        {expert.isCustom && (
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--warning-bg)', color: 'var(--warning)' }}>自定义</span>
                        )}
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 3,
                          background: STATUS_COLORS[expert.status] + '20',
                          color: STATUS_COLORS[expert.status],
                          fontWeight: 500,
                        }}>
                          {STATUS_LABELS[expert.status]}
                        </span>
                        {expert.isOverall && (
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--accent-light)', color: 'var(--accent)' }}>已发布</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{expert.description}</div>
<div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
  {(expert.categories || []).map((c) => (
    <span key={c} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover)', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {CATEGORY_ICONS[c] || null}{c}
    </span>
  ))}
</div>
                      {/* Bound resources summary */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-tertiary)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <ListTodo size={10} /> SOP {expert.bindings?.sopSkills?.length || 0}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Zap size={10} /> Skill {expert.bindings?.skills?.length || 0}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Server size={10} /> MCP {(expert.bindings?.mcpServers?.length || 0)}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <BookOpen size={10} /> 知识库 {expert.bindings?.knowledgeBases?.length || 0}
                        </span>
                      </div>
                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        <ActionButton icon={<Edit3 size={11} />} label="编辑" onClick={() => openEditor(expert)} />
                        <ActionButton icon={<ListTodo size={11} />} label="管理 SOP" onClick={() => handleManageSop(expert)} />
                        <ActionButton icon={<Zap size={11} />} label="管理 Skill" onClick={() => handleManageSkill(expert)} />
                        <ActionButton icon={<Server size={11} />} label="管理 MCP" onClick={() => handleManageMcp(expert)} />
                        <ActionButton
                          icon={expert.status === 'online' ? <ToggleLeft size={11} /> : <ToggleRight size={11} />}
                          label={expert.status === 'online' ? '下线' : '上线'}
                          onClick={() => handleToggleStatus(expert)}
                        />
                        <ActionButton
                          icon={<Globe size={11} />}
                          label={expert.isOverall ? '取消发布' : '发布广场'}
                          onClick={() => handleToggleOverall(expert)}
                        />
                        <ActionButton icon={<Trash2 size={11} />} label="删除" danger onClick={() => {
                          if (expert.isCustom) setConfirmDeleteId(expert.id)
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      

      {/* Editor Modal */}
      {editorOpen && (
        <ExpertEditorModal
          expert={editingExpert}
          onClose={handleEditorClose}
        />
      )}
      {confirmDeleteId && (
        <ConfirmDialog
          title="确认删除专家"
          message="删除后该专家及其绑定资源将不可恢复，确定要删除吗？"
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

function ActionButton({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 3,
        padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)',
        background: 'transparent', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
        color: danger ? 'var(--danger)' : 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? 'var(--danger-bg)' : 'var(--bg-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {icon}
      {label}
    </button>
  )
}
