import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, FolderOpen, Users, Settings, Trash2, Clock, LayoutTemplate, BookOpen, Wrench, Zap } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Project, ProjectTemplate, ConnectorConfig } from '../lib/project-types'
import { ProjectDetail } from './ProjectDetail'
import { ConfirmDialog } from './ConfirmDialog'
import { panelRootStyle } from '../lib/panel-layout'

const ipc = createIpcClient()

interface Props {
  onNavigateToChat?: () => void
  currentUserId?: string
  currentUserName?: string
  currentUser?: { id: string; name: string; role: string }
  onUpdateUser?: (name: string) => void
}

export function ProjectPanel({ onNavigateToChat, currentUserId, currentUserName, currentUser, onUpdateUser }: Props) {
  const userId = currentUser?.id ?? currentUserId ?? 'user-1'
  const userName = currentUser?.name ?? currentUserName ?? 'User'
  const [projects, setProjects] = useState<Project[]>([])
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [search, setSearch] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>()
  // Gap 2: new fields
  const [newInstructions, setNewInstructions] = useState('')
  const [selectedConnectorIds, setSelectedConnectorIds] = useState<string[]>([])
  const [selectedExpertIds, setSelectedExpertIds] = useState<string[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([])
  const [availableConnectors, setAvailableConnectors] = useState<Array<{ id: string; name: string; type: string }>>([])
  const [availableExperts, setAvailableExperts] = useState<Array<{ id: string; name: string }>>([])
  const [availableSkills, setAvailableSkills] = useState<Array<{ id: string; name: string }>>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    const result = await ipc.invoke(IPC_CHANNELS.PROJECT_LIST) as { success: boolean; projects: Project[] }
    if (result.success) setProjects(result.projects)
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const loadTemplates = useCallback(async () => {
    const templates = await ipc.invoke(IPC_CHANNELS.PROJECT_TEMPLATE_LIST) as ProjectTemplate[]
    setTemplates(templates)
  }, [])

  const loadConnectors = useCallback(async () => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.CONNECTOR_LIST) as { success?: boolean; connectors?: Array<{ id: string; name: string; type: string }> } | Array<{ id: string; name: string; type: string }>
      const list = Array.isArray(result) ? result : (result?.connectors || [])
      setAvailableConnectors(list)
    } catch { /* ignore */ }
  }, [])

  const loadExperts = useCallback(async () => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.EXPERT_LIST) as { success?: boolean; experts?: Array<{ id: string; name: string }> } | Array<{ id: string; name: string }>
      const list = Array.isArray(result) ? result : (result?.experts || [])
      setAvailableExperts(list)
    } catch { /* ignore */ }
  }, [])

  const loadSkills = useCallback(async () => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.SKILL_LIST) as { success?: boolean; skills?: Array<{ id: string; name: string }> } | Array<{ id: string; name: string }>
      const list = Array.isArray(result) ? result : (result?.skills || [])
      setAvailableSkills(list)
    } catch { /* ignore */ }
  }, [])

  const handleCreate = async () => {
    if (!newProjectName.trim()) return
    const result = await ipc.invoke(
      IPC_CHANNELS.PROJECT_CREATE,
      {
        name: newProjectName,
        description: newProjectDesc,
        instructions: newInstructions,
        connectors: selectedConnectorIds.map(id => ({ id, name: id, type: 'custom', auth: { type: 'personal' as const } })),
        skills: selectedSkillIds,
        experts: selectedExpertIds,
        templateId: selectedTemplateId,
      },
      userId,
      userName,
    ) as { success: boolean; project?: Project; error?: string }
    if (result.success && result.project) {
      setProjects((prev) => [...prev, result.project!])
      setSelectedProjectId(result.project.id)
    }
    setShowCreate(false)
    setShowTemplates(false)
    setNewProjectName('')
    setNewProjectDesc('')
    setNewInstructions('')
    setSelectedConnectorIds([])
    setSelectedExpertIds([])
    setSelectedSkillIds([])
    setSelectedTemplateId(undefined)
  }

  const handleDeleteProject = async (id: string) => {
    await ipc.invoke(IPC_CHANNELS.PROJECT_DELETE, id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
    if (selectedProjectId === id) setSelectedProjectId(null)
  }

  const filtered = projects.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description || '').toLowerCase().includes(search.toLowerCase()),
  )

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  if (selectedProject) {
    return (
      <div style={panelRootStyle({ background: 'transparent', overflow: 'hidden' })}>
        <ProjectDetail
          project={selectedProject}
          currentUserId={userId}
          currentUserName={userName}
          currentUser={currentUser}
          onBack={() => setSelectedProjectId(null)}
          onDelete={() => setConfirmDeleteId(selectedProject.id)}
          onUpdate={(updated) => {
            setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
          }}
        />
        {confirmDeleteId && (
          <ConfirmDialog
            title="确认删除项目"
            message="删除后项目及其资源将不可恢复，确定要删除吗？"
            onConfirm={() => {
              const id = confirmDeleteId
              setConfirmDeleteId(null)
              void handleDeleteProject(id)
            }}
            onCancel={() => setConfirmDeleteId(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div style={panelRootStyle()}>
      {/* Header */}
      <div style={{ padding: '20px 24px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Projects</h2>
          <button
            onClick={() => { setShowCreate(true); loadTemplates(); loadConnectors(); loadExperts(); loadSkills() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 8, background: 'var(--accent)', color: '#fff',
              border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={15} /> New Project
          </button>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-input)', borderRadius: 8,
          padding: '8px 14px',
        }}>
          <Search size={14} color="var(--text-tertiary)" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            name="project-search"
            aria-label="搜索项目"
            placeholder="Search projects…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div
          role="dialog"
          aria-modal="true"
          data-overlay="true"
          style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          overscrollBehavior: 'contain',
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24,
            width: 440, maxHeight: '80vh', overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>Create Project</h3>

            {!showTemplates ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Name</label>
                  <input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      border: '1px solid var(--border)', background: 'var(--bg-input)',
                      color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Description</label>
                  <input
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Optional description"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      border: '1px solid var(--border)', background: 'var(--bg-input)',
                      color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>指令 (Instructions)</label>
                  <textarea
                    value={newInstructions}
                    onChange={(e) => setNewInstructions(e.target.value)}
                    placeholder="Global AI behavior rules inherited by all tasks…"
                    rows={3}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      border: '1px solid var(--border)', background: 'var(--bg-input)',
                      color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box', resize: 'vertical',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    <Zap size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    连接器 (Connectors)
                  </label>
                  {availableConnectors.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 0' }}>No connectors available</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {availableConnectors.map((c) => {
                        const active = selectedConnectorIds.includes(c.id)
                        return (
                          <button
                            key={c.id}
                            onClick={() => setSelectedConnectorIds(prev => active ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                            style={{
                              padding: '3px 8px', borderRadius: 12, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                              background: active ? 'var(--accent-light)' : 'transparent',
                              color: active ? 'var(--accent)' : 'var(--text-secondary)',
                              fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            {c.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    <Wrench size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    专家 (Experts)
                  </label>
                  {availableExperts.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 0' }}>No experts available</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {availableExperts.map((e) => {
                        const active = selectedExpertIds.includes(e.id)
                        return (
                          <button
                            key={e.id}
                            onClick={() => setSelectedExpertIds(prev => active ? prev.filter(id => id !== e.id) : [...prev, e.id])}
                            style={{
                              padding: '3px 8px', borderRadius: 12, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                              background: active ? 'var(--accent-light)' : 'transparent',
                              color: active ? 'var(--accent)' : 'var(--text-secondary)',
                              fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            {e.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    <BookOpen size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    技能 Skill
                  </label>
                  {availableSkills.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 0' }}>No skills available</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {availableSkills.map((s) => {
                        const active = selectedSkillIds.includes(s.id)
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSkillIds(prev => active ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                            style={{
                              padding: '3px 8px', borderRadius: 12, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                              background: active ? 'var(--accent-light)' : 'transparent',
                              color: active ? 'var(--accent)' : 'var(--text-secondary)',
                              fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            {s.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowTemplates(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--accent)',
                    fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    fontWeight: 500,
                  }}
                >
                  <LayoutTemplate size={13} /> Use a Template {selectedTemplateId ? '(selected)' : ''}
                </button>
              </>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Choose Template</span>
                  <button
                    onClick={() => { setShowTemplates(false); setSelectedTemplateId(undefined) }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer' }}
                  >
                    Skip
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflow: 'auto' }}>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTemplateId(t.id); setShowTemplates(false) }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                        borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left',
                        background: selectedTemplateId === t.id ? 'var(--accent-light)' : 'transparent',
                        fontFamily: 'inherit',
                      }}
                    >
                      <FolderOpen size={14} color="var(--text-secondary)" style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowCreate(false); setShowTemplates(false); setSelectedTemplateId(undefined); setNewInstructions(''); setSelectedConnectorIds([]); setSelectedExpertIds([]); setSelectedSkillIds([]) }}
                style={{
                  padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newProjectName.trim()}
                style={{
                  padding: '7px 20px', borderRadius: 6, border: 'none',
                  background: newProjectName.trim() ? 'var(--accent)' : 'var(--border)',
                  color: newProjectName.trim() ? '#fff' : 'var(--text-tertiary)',
                  fontSize: 12, fontWeight: 600, cursor: newProjectName.trim() ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
        {filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: 'var(--text-tertiary)', fontSize: 13,
          }}>
            <FolderOpen size={40} color="var(--text-tertiary)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <div style={{ marginBottom: 4, fontWeight: 500, color: 'var(--text-secondary)' }}>No projects yet</div>
            <div>Create a project to start collaborating with your team.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filtered.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedProjectId(p.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProjectId(p.id) } }}
                aria-label={`打开项目 ${p.name}`}
                style={{
                  padding: 16, borderRadius: 10, background: 'var(--bg-card)',
                  border: '1px solid var(--border)', cursor: 'pointer',
                  transition: 'box-shadow .15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.description || 'No description'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id) }}
                    style={{
                      padding: 4, borderRadius: 4, border: 'none',
                      background: 'transparent', cursor: 'pointer',
                      color: 'var(--text-tertiary)',
                    }}
                    title="Delete project"
                    aria-label={`删除项目 ${p.name}`}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={12} /> {p.members.length}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FolderOpen size={12} /> {p.assets.length} assets
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> {formatDate(p.createdAt)}
                  </span>
                </div>

                {/* Storage bar */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>
                    <span>Storage</span>
                    <span>{formatSize(p.storage.used)} / {formatSize(p.storage.limit)}</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.min(100, (p.storage.used / p.storage.limit) * 100)}%`,
                      background: p.storage.used / p.storage.limit > 0.8 ? 'var(--danger)' : 'var(--accent)',
                      borderRadius: 2, transition: 'width .3s',
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {confirmDeleteId && (
        <ConfirmDialog
          title="确认删除项目"
          message="删除后项目及其资源将不可恢复，确定要删除吗？"
          onConfirm={() => {
            const id = confirmDeleteId
            setConfirmDeleteId(null)
            void handleDeleteProject(id)
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
