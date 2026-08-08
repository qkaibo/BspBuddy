import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Send, Share2, GitBranch, Activity, ListTodo, FolderOpen, Users, Clock, ChevronDown } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Project, ProjectTask, ProjectActivity, TaskStatus } from '../lib/project-types'
import { ProjectAssets } from './ProjectAssets'
import { ProjectInvite } from './ProjectInvite'

const ipc = createIpcClient()

type DetailTab = 'activities' | 'tasks' | 'assets'

interface Props {
  project: Project
  currentUserId: string
  currentUserName: string
  currentUser?: { id: string; name: string; role: string }
  onBack: () => void
  onDelete: () => void
  onUpdate: (project: Project) => void
}

export function ProjectDetail({ project, currentUserId, currentUserName, currentUser, onBack, onDelete, onUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<DetailTab>('activities')
  const [activities, setActivities] = useState<ProjectActivity[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [activityFilter, setActivityFilter] = useState<'all' | 'related_to_me' | 'member' | 'automation'>('all')

  const loadActivities = useCallback(async () => {
    const result = await ipc.invoke(IPC_CHANNELS.PROJECT_ACTIVITY_LIST, project.id, currentUserId) as { success: boolean; activities: ProjectActivity[] }
    if (result.success) setActivities(result.activities)
  }, [project.id, currentUserId])

  const loadTasks = useCallback(async () => {
    const result = await ipc.invoke(IPC_CHANNELS.PROJECT_TASK_LIST, project.id) as { success: boolean; tasks: ProjectTask[] }
    if (result.success) setTasks(result.tasks)
  }, [project.id])

  useEffect(() => {
    loadActivities()
    loadTasks()
  }, [loadActivities, loadTasks])

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return
    const result = await ipc.invoke(
      IPC_CHANNELS.PROJECT_TASK_CREATE,
      { projectId: project.id, title: newTaskTitle },
      currentUserId,
      currentUserName,
    ) as { success: boolean; task?: ProjectTask; injectedContext?: string }
    if (result.success && result.task) {
      setTasks((prev) => [result.task!, ...prev])
      setNewTaskTitle('')
      await loadActivities()
    }
  }

  const handleShareTask = async (taskId: string) => {
    const result = await ipc.invoke(IPC_CHANNELS.PROJECT_TASK_SHARE, taskId, project.id, currentUserId, currentUserName) as { success: boolean; shareLink?: string }
    if (result.success && result.shareLink) {
      // Copy to clipboard
      try { await navigator.clipboard.writeText(result.shareLink) } catch { /* ignore */ }
    }
  }

  const handleTransferTask = async (taskId: string) => {
    const toUserId = prompt('Enter recipient user ID:')
    if (!toUserId) return
    const note = prompt('Transfer note (optional):') || undefined
    await ipc.invoke(IPC_CHANNELS.PROJECT_TASK_TRANSFER, taskId, project.id, toUserId, currentUserId, currentUserName, note)
    await loadTasks()
    await loadActivities()
  }

  const STATUS_LABELS: Record<TaskStatus, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }
  const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done']

  const handleTaskStatusChange = async (taskId: string, currentStatus: TaskStatus) => {
    const nextIdx = (STATUS_ORDER.indexOf(currentStatus) + 1) % STATUS_ORDER.length
    const newStatus = STATUS_ORDER[nextIdx]
    await ipc.invoke(IPC_CHANNELS.PROJECT_TASK_UPDATE, taskId, project.id, { status: newStatus }, currentUserId, currentUserName)
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  // Pending invites for admin approval
  const pendingInvites = project.members.filter((m) => m.inviteStatus === 'pending')

  const handleApproveMember = async (userId: string) => {
    await ipc.invoke(IPC_CHANNELS.PROJECT_MEMBER_APPROVE, project.id, userId, true)
    // Update locally
    const updatedProject = {
      ...project,
      members: project.members.map((m) =>
        m.userId === userId ? { ...m, inviteStatus: 'accepted' as const, joinedAt: Date.now() } : m
      ),
    }
    onUpdate(updatedProject)
  }

  const handleDeclineMember = async (userId: string) => {
    await ipc.invoke(IPC_CHANNELS.PROJECT_MEMBER_APPROVE, project.id, userId, false)
    const updatedProject = {
      ...project,
      members: project.members.filter((m) => m.userId !== userId),
    }
    onUpdate(updatedProject)
  }

  const isAdmin = currentUser?.role === 'admin' || project.members.some((m) => m.userId === currentUserId && m.role === 'admin')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-root)' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button
            onClick={onBack}
            style={{ padding: 4, borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={18} />
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0, flex: 1 }}>{project.name}</h2>
          {isAdmin && (
            <button
              onClick={() => setInviteOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                borderRadius: 6, background: 'var(--accent)', color: '#fff',
                border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Users size={13} /> Invite
            </button>
          )}
          <button
            onClick={onDelete}
            style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--danger)', fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Delete
          </button>
        </div>
        {project.description && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{project.description}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={11} /> {project.members.length} members</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FolderOpen size={11} /> {project.assets.length} assets</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> Created {new Date(project.createdAt).toLocaleDateString()}</span>
        </div>

        {/* Pending invites — admin only */}
        {isAdmin && pendingInvites.length > 0 && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8,
            background: 'var(--accent-light)', border: '1px solid var(--accent)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>
              Pending Invites ({pendingInvites.length})
            </div>
            {pendingInvites.map((inv) => (
              <div key={inv.userId} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 0', borderTop: '1px solid var(--border)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{inv.userName}</span>
                  {inv.inviteNote && (
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 8 }}>— {inv.inviteNote}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  <button
                    onClick={() => handleApproveMember(inv.userId)}
                    style={{
                      padding: '3px 10px', borderRadius: 4, border: 'none',
                      background: 'var(--success)', color: '#fff',
                      fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeclineMember(inv.userId)}
                    style={{
                      padding: '3px 10px', borderRadius: 4, border: '1px solid var(--danger)',
                      background: 'transparent', color: 'var(--danger)',
                      fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        {([
          { id: 'activities', label: 'Activity', icon: Activity },
          { id: 'tasks', label: 'Tasks', icon: ListTodo },
          { id: 'assets', label: 'Assets', icon: FolderOpen },
        ] as { id: DetailTab; label: string; icon: typeof Activity }[]).map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: isActive ? 600 : 400,
              }}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'activities' && (
          <div style={{ padding: 16 }}>
            {/* Activity filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['all', 'related_to_me', 'member', 'automation'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActivityFilter(cat)}
                  style={{
                    padding: '4px 10px', borderRadius: 12, border: 'none',
                    background: activityFilter === cat ? 'var(--accent)' : 'var(--bg-card)',
                    color: activityFilter === cat ? '#fff' : 'var(--text-secondary)',
                    fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                    fontWeight: activityFilter === cat ? 600 : 400,
                  }}
                >
                  {cat === 'all' ? 'All' : cat === 'related_to_me' ? 'Related to Me' : cat === 'member' ? 'Members' : 'Automation'}
                </button>
              ))}
            </div>

            {activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>
                <Activity size={32} color="var(--text-tertiary)" style={{ marginBottom: 8, opacity: 0.5 }} />
                <div>No activity yet</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {activities
                  .filter((a) => activityFilter === 'all' || a.category === activityFilter)
                  .map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 8,
                      background: a.category === 'related_to_me' ? 'var(--accent-light)' : 'transparent',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: a.category === 'related_to_me' ? 'var(--accent)' : 'var(--bg-input)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: a.category === 'related_to_me' ? '#fff' : 'var(--text-secondary)',
                      fontSize: 12, flexShrink: 0,
                    }}>
                      {a.userName.slice(0, 1)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{a.description}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {formatTimeAgo(a.timestamp)}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 8,
                      background: 'var(--bg-input)', color: 'var(--text-tertiary)',
                      flexShrink: 0,
                    }}>
                      {a.category === 'related_to_me' ? '@me' : a.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div style={{ padding: 16 }}>
            {/* Task input */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 16,
              padding: 8, borderRadius: 8, background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}>
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
                placeholder="Create a new task..."
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleCreateTask}
                disabled={!newTaskTitle.trim()}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: 'none',
                  background: newTaskTitle.trim() ? 'var(--accent)' : 'var(--border)',
                  color: newTaskTitle.trim() ? '#fff' : 'var(--text-tertiary)',
                  fontSize: 12, fontWeight: 600, cursor: newTaskTitle.trim() ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                <Send size={13} />
              </button>
            </div>

            {/* Task list */}
            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>
                <ListTodo size={32} color="var(--text-tertiary)" style={{ marginBottom: 8, opacity: 0.5 }} />
                <div>No tasks yet. Create your first task above.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 8,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                    }}
                  >
                    <button
                      onClick={() => handleTaskStatusChange(t.id, t.status)}
                      title={`Status: ${STATUS_LABELS[t.status]} — click to cycle`}
                      style={{
                        width: 18, height: 18, borderRadius: '50%',
                        border: `2px solid ${t.status === 'done' ? 'var(--success)' : t.status === 'in_progress' ? 'var(--accent)' : 'var(--border)'}`,
                        background: t.status === 'done' ? 'var(--success)' : 'transparent',
                        flexShrink: 0, cursor: 'pointer', padding: 0,
                        transition: 'background .15s, border-color .15s',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, color: 'var(--text-primary)',
                        textDecoration: t.status === 'done' ? 'line-through' : 'none',
                        opacity: t.status === 'done' ? 0.6 : 1,
                      }}>
                        {t.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        {t.assignee && (
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                            Assigned to: {t.assignee}
                          </span>
                        )}
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 8,
                          background: t.status === 'done' ? 'var(--success-light)' : t.status === 'in_progress' ? 'var(--accent-light)' : 'var(--bg-input)',
                          color: t.status === 'done' ? 'var(--success)' : t.status === 'in_progress' ? 'var(--accent)' : 'var(--text-tertiary)',
                        }}>
                          {STATUS_LABELS[t.status]}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => handleShareTask(t.id)}
                        title="Share task"
                        style={{
                          padding: 4, borderRadius: 4, border: 'none',
                          background: 'transparent', cursor: 'pointer',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        <Share2 size={13} />
                      </button>
                      <button
                        onClick={() => handleTransferTask(t.id)}
                        title="Transfer task"
                        style={{
                          padding: 4, borderRadius: 4, border: 'none',
                          background: 'transparent', cursor: 'pointer',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        <GitBranch size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'assets' && (
          <ProjectAssets
            projectId={project.id}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onAssetChange={() => {
              // Reload project data
              loadActivities()
            }}
          />
        )}
      </div>

      {/* Invite modal */}
      {inviteOpen && (
        <ProjectInvite
          projectId={project.id}
          projectName={project.name}
          createdBy={currentUserId}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  )
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}
