import { useState, useEffect } from 'react'
import { Users, UserPlus, Search, Star, Zap, Code, PenTool, BarChart3, User, ChevronRight, Play, ListTodo } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Expert, ExpertTeam, ExpertCreationRequest } from '../lib/expert-types'

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

export function ExpertCenter({ onClose, onSummonExpert, onTeamExecute }: Props) {
  const [experts, setExperts] = useState<Expert[]>([])
  const [teams, setTeams] = useState<ExpertTeam[]>([])
  const [activeTab, setActiveTab] = useState<'experts' | 'teams' | 'create'>('experts')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [expandedExpert, setExpandedExpert] = useState<string | null>(null)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [teamTask, setTeamTask] = useState('')
  const [showTeamTask, setShowTeamTask] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<ExpertCreationRequest>({
    name: '', title: '', description: '', persona: '', methodology: '', toolChain: [], skills: [], categories: [],
  })
  const [newTool, setNewTool] = useState('')
  const [newSkill, setNewSkill] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [expertList, teamList] = await Promise.all([
      ipc.invoke(IPC_CHANNELS.EXPERT_LIST) as Promise<Expert[]>,
      ipc.invoke(IPC_CHANNELS.EXPERT_TEAM_LIST) as Promise<ExpertTeam[]>,
    ])
    setExperts(expertList)
    setTeams(teamList)
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

  async function handleCreateExpert() {
    if (!createForm.name || !createForm.description) return
    await ipc.invoke(IPC_CHANNELS.EXPERT_CREATE, createForm)
    setCreateForm({ name: '', title: '', description: '', persona: '', methodology: '', toolChain: [], skills: [], categories: [] })
    loadData()
    setActiveTab('experts')
  }

  function addTool() {
    if (!newTool.trim()) return
    setCreateForm((f) => ({ ...f, toolChain: [...f.toolChain, newTool.trim()] }))
    setNewTool('')
  }

  function addSkill() {
    if (!newSkill.trim()) return
    setCreateForm((f) => ({ ...f, skills: [...f.skills, newSkill.trim()] }))
    setNewSkill('')
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={18} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>专家中心</span>
        </div>
        <button onClick={onClose} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>x</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        {([
          { id: 'experts' as const, label: '专家', icon: <User size={12} /> },
          { id: 'teams' as const, label: '专家团', icon: <Users size={12} /> },
          { id: 'create' as const, label: '我的专家', icon: <UserPlus size={12} /> },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '8px 0', border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 400,
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      {(activeTab === 'experts' || activeTab === 'teams') && (
        <div style={{ padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-input)', borderRadius: 4, padding: '4px 8px', flex: 1 }}>
              <Search size={12} color="var(--text-tertiary)" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索专家或专家团..."
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit' }}
              />
            </div>
            {activeTab === 'experts' && (
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

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {/* Experts Tab */}
        {activeTab === 'experts' && (
          <>
            {filteredExperts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>暂无匹配的专家</div>
            )}
            {filteredExperts.map((expert) => (
              <div
                key={expert.id}
                style={{
                  padding: '14px', borderRadius: 10, background: 'var(--bg-card)',
                  marginBottom: 8, border: '1px solid var(--border)', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }} onClick={() => setExpandedExpert(expandedExpert === expert.id ? null : expert.id)}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: expert.isCustom ? 'var(--warning-bg)' : 'var(--accent-light)', flexShrink: 0,
                    fontSize: 16,
                  }}>
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
                  <ChevronRight size={16} color="var(--text-tertiary)" style={{
                    transform: expandedExpert === expert.id ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s',
                    marginTop: 8,
                  }} />
                </div>

                {/* Expanded details */}
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
                            <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
                              Prompt: {e.prompt}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => handleSummon(expert)}
                      style={{
                        marginTop: 8, padding: '6px 16px', borderRadius: 6, border: 'none',
                        background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <Play size={12} /> 召唤专家
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <>
            {filteredTeams.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>暂无匹配的专家团</div>
            )}
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                style={{
                  padding: '14px', borderRadius: 10, background: 'var(--bg-card)',
                  marginBottom: 8, border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }} onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--purple)', opacity: 0.15, flexShrink: 0, fontSize: 16,
                  }}>
                    <Users size={18} color="var(--purple)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{team.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{team.description}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                        团长: {team.lead.name}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                        成员: {team.members.map((m) => `${m.expert.name}(${m.role})`).join('、')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>
                      {team.rating && <span><Star size={10} color="var(--warning)" style={{ verticalAlign: 'middle' }} /> {team.rating}</span>}
                      {team.usageCount && <span>{team.usageCount.toLocaleString()} 次使用</span>}
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--text-tertiary)" style={{
                    transform: expandedTeam === team.id ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s',
                    marginTop: 8,
                  }} />
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
                        <textarea
                          value={teamTask}
                          onChange={(e) => setTeamTask(e.target.value)}
                          placeholder="输入任务描述..."
                          rows={3}
                          style={{
                            width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                            fontSize: 11, fontFamily: 'inherit', resize: 'vertical', color: 'var(--text-primary)',
                            background: 'var(--bg-card)',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <button
                            onClick={() => handleTeamExecute(team)}
                            style={{
                              padding: '5px 12px', borderRadius: 4, border: 'none',
                              background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            开始执行
                          </button>
                          <button
                            onClick={() => setShowTeamTask(null)}
                            style={{
                              padding: '5px 12px', borderRadius: 4, border: '1px solid var(--border)',
                              background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowTeamTask(team.id)}
                        style={{
                          marginTop: 8, padding: '6px 16px', borderRadius: 6, border: 'none',
                          background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer',
                          fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <Play size={12} /> 召唤专家团
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Create Expert Tab */}
        {activeTab === 'create' && (
          <div style={{ padding: '12px 0' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              创建属于你的专家，定义其人设、方法论和工具链，分享你的专业知识
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>名称 *</label>
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如：法律顾问"
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                  fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)',
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>头衔</label>
              <input
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="如：法律咨询专家"
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                  fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)',
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>描述 *</label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="描述该专家的能力和适用场景"
                rows={2}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                  fontSize: 12, fontFamily: 'inherit', resize: 'vertical', color: 'var(--text-primary)', background: 'var(--bg-input)',
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>人设 (Persona)</label>
              <textarea
                value={createForm.persona}
                onChange={(e) => setCreateForm((f) => ({ ...f, persona: e.target.value }))}
                placeholder="定义专家的人格、知识背景和行为风格"
                rows={3}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                  fontSize: 12, fontFamily: 'inherit', resize: 'vertical', color: 'var(--text-primary)', background: 'var(--bg-input)',
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>方法论</label>
              <input
                value={createForm.methodology}
                onChange={(e) => setCreateForm((f) => ({ ...f, methodology: e.target.value }))}
                placeholder="如：SWOT分析 + 案例研究 + 法规检索"
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                  fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)',
                }}
              />
            </div>

            {/* Tool Chain */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>工具链</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {createForm.toolChain.map((t, i) => (
                  <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--accent-light)', color: 'var(--accent)' }}>
                    {t}
                    <button
                      onClick={() => setCreateForm((f) => ({ ...f, toolChain: f.toolChain.filter((_, j) => j !== i) }))}
                      style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, fontSize: 10 }}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  value={newTool}
                  onChange={(e) => setNewTool(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTool()}
                  placeholder="添加工具..."
                  style={{
                    flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
                    fontSize: 11, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)',
                  }}
                />
                <button onClick={addTool} style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>添加</button>
              </div>
            </div>

            {/* Skills */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>技能标签</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {createForm.skills.map((s, i) => (
                  <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--success-bg)', color: 'var(--success)' }}>
                    {s}
                    <button
                      onClick={() => setCreateForm((f) => ({ ...f, skills: f.skills.filter((_, j) => j !== i) }))}
                      style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', padding: 0, fontSize: 10 }}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                  placeholder="添加技能标签..."
                  style={{
                    flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
                    fontSize: 11, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)',
                  }}
                />
                <button onClick={addSkill} style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>添加</button>
              </div>
            </div>

            <button
              onClick={handleCreateExpert}
              disabled={!createForm.name || !createForm.description}
              style={{
                marginTop: 8, padding: '8px 24px', borderRadius: 6, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', opacity: !createForm.name || !createForm.description ? 0.5 : 1,
              }}
            >
              创建专家
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
