import { useState, useEffect } from 'react'
import { Users, UserPlus, Search, Star, Zap, Code, PenTool, BarChart3, User, ChevronRight, Play, ListTodo, Edit3, Trash2, ToggleLeft, ToggleRight, Globe } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Expert, ExpertTeam, ExpertCreationRequest, ExpertStatus } from '../lib/expert-types'
import { ExpertEditorModal } from './ExpertEditorModal'
import { ExpertSquare } from './ExpertSquare'

const ipc = createIpcClient()

interface Props {
  onClose: () => void
  onSummonExpert?: (expert: Expert, sessionId: string, welcomeMessage: string) => void
  onTeamExecute?: (team: ExpertTeam, task: string) => void
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  management: <ListTodo size={14} />,
  planning: <ListTodo size={14} />,
  data: <BarChart3 size={14} />,
  analytics: <BarChart3 size={14} />,
  writing: <PenTool size={14} />,
  creative: <PenTool size={14} />,
  development: <Code size={14} />,
  engineering: <Code size={14} />,
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

export function ExpertCenter({ onClose, onSummonExpert, onTeamExecute }: Props) {
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

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
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
    const result = await ipc.invoke(IPC_CHANNELS.EXPERT_SUMMON, expert.id) as { success: boolean; sessionId?: string; welcomeMessage?: string; error?: string }
    if (result.success && onSummonExpert) {
      onSummonExpert(expert, result.sessionId!, result.welcomeMessage!)
      onClose()
    }
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
    await ipc.invoke(IPC_CHANNELS.EXPERT_UPDATE, { ...expert, status: newStatus })
    loadData()
  }

  async function handleToggleOverall(expert: Expert) {
    await ipc.invoke(IPC_CHANNELS.EXPERT_UPDATE, { ...expert, isOverall: !expert.isOverall })
    loadData()
  }

  async function handleDelete(expertId: string) {
    await ipc.invoke(IPC_CHANNELS.EXPERT_DELETE, expertId)
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

  const allCategories = ['all', ...new Set(experts.flatMap((e) => e.categories))]

  const filteredExperts = experts.filter((e) => {
    if (selectedCategory !== 'all' && !e.categories.includes(selectedCategory)) return false
    if (search && !e.name.includes(search) && !e.title.includes(search) && !e.description.includes(search)) return false
    return true
  })

  const filteredTeams = teams.filter((t) => {
    if (search && !t.name.includes(search) && !t.description.includes(search)) return false
    return true
  })

  const manageExperts = experts.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    if (search && !e.name.includes(search) && !e.title.includes(search)) return false
    return true
  })

  return (
    <>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>专家中心</span>
          </div>
          <button onClick={onClose} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>x</button>
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
                    <Search size={12} color="var(--text-tertiary)" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={subTab === 'experts' ? '搜索专家...' : '搜索专家团...'}
                      style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit' }}
                    />
                  </div>
                  {subTab === 'experts' && (
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
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
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }} onClick={() => setExpandedExpert(expandedExpert === expert.id ? null : expert.id)}>
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
                              <span key={c} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>
                                {CATEGORY_ICONS[c] || null} {c}
                              </span>
                            ))}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>
                            {expert.rating && <span><Star size={10} color="var(--warning)" style={{ verticalAlign: 'middle' }} /> {expert.rating}</span>}
                            {expert.usageCount && <span>{expert.usageCount.toLocaleString()} 次使用</span>}
                          </div>
                        </div>
                        <ChevronRight size={16} color="var(--text-tertiary)" style={{ transform: expandedExpert === expert.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', marginTop: 8 }} />
                      </div>
                      {expandedExpert === expert.id && (
                        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 6, background: 'var(--bg-input)', fontSize: 11 }}>
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>人设: </span>
                            <span style={{ color: 'var(--text-secondary)' }}>{expert.persona}</span>
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>方法论: </span>
                            <span style={{ color: 'var(--text-secondary)' }}>{expert.methodology}</span>
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>工具链: </span>
                            <span style={{ color: 'var(--text-secondary)' }}>{expert.toolChain.join('、')}</span>
                          </div>
                          {expert.examples.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>任务示例:</span>
                              {expert.examples.map((e, i) => (
                                <div key={i} style={{ marginTop: 4, padding: '6px 8px', borderRadius: 4, background: 'var(--bg-card)' }}>
                                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{e.title}: {e.description}</div>
                                  <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>Prompt: {e.prompt}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => handleSummon(expert)}
                            style={{ marginTop: 8, padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Play size={12} /> 召唤专家
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
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }} onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}>
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
                        <ChevronRight size={16} color="var(--text-tertiary)" style={{ transform: expandedTeam === team.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', marginTop: 8 }} />
                      </div>
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
                              <textarea value={teamTask} onChange={(e) => setTeamTask(e.target.value)} placeholder="输入任务描述..." rows={3}
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
                  await ipc.invoke(IPC_CHANNELS.EXPERT_CLONE, expert.id)
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
                <Search size={12} color="var(--text-tertiary)" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索专家..."
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit' }}
                />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
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
                          <span key={c} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>
                            {CATEGORY_ICONS[c] || null} {c}
                          </span>
                        ))}
                      </div>
                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        <ActionButton icon={<Edit3 size={11} />} label="编辑" onClick={() => openEditor(expert)} />
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
                          if (expert.isCustom) handleDelete(expert.id)
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Editor Modal */}
      {editorOpen && (
        <ExpertEditorModal
          expert={editingExpert}
          onClose={handleEditorClose}
        />
      )}
    </>
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
