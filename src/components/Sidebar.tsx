import { useState, useCallback, useEffect } from 'react'
import {
  Plus, Search, MessageSquare, Clock, FolderOpen,
  Bell, ChevronDown, ChevronRight, Trash2, Share2,
  Archive, Edit3, Download, Pin,
  PanelLeftClose, SlidersHorizontal, User, Crosshair,
  Network, Repeat, Grid3x3, Link, Sparkles, Mail, BookOpen, ScrollText, RefreshCw,
} from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'

const ipc = createIpcClient()

interface Session {
  id: string
  title: string
  date: string
  active: boolean
  workspace?: string
  status?: 'in_progress' | 'completed' | 'failed' | 'pending' | 'planning' | 'archived'
}

type ViewType = 'chat' | 'plugins' | 'experts' | 'connectors' | 'projects' | 'mailbox' | 'activate-mailbox' | 'settings' | 'member-roles' | 'pricing' | 'data' | 'memory' | 'cloud-agent' | 'inspiration' | 'assistant' | 'assistant-settings' | 'feedback' | 'automation' | 'policy'

interface Props {
  sessions: Session[]
  onNewSession: () => void
  onSelectSession: (id: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
  activeView?: ViewType
  onNavigate?: (view: ViewType) => void
  /** Portal / 本地登录后的展示名；缺省仍显示 User */
  currentUser?: { id: string; name: string; role: string }
}

const PRIMARY_NAV = [
  { id: 'assistant', label: '助理', icon: User, view: 'assistant' as ViewType },
  { id: 'projects', label: '项目', icon: Crosshair, view: 'projects' as ViewType },
  { id: 'experts-plugin', label: '专家·技能·连接器', icon: Network, view: 'experts' as ViewType },
  { id: 'knowledge', label: '知识库', icon: BookOpen, view: 'data' as ViewType },
]

const AVATAR_MENU_ITEMS = [
  { id: 'settings' as const, label: '设置' },
  { id: 'memory' as const, label: '记忆' },
  { id: 'pricing' as const, label: '定价' },
  { id: 'data' as const, label: '数据管理' },
]

const STATUS_DOT_COLORS: Record<string, string> = {
  in_progress: 'var(--accent)',
  completed: 'var(--success)',
  failed: 'var(--danger)',
  pending: 'var(--warning)',
  planning: 'var(--purple)',
  archived: 'var(--text-tertiary)',
}

export function Sidebar({ sessions, onNewSession, onSelectSession, collapsed, onToggleCollapse, activeView = 'chat', onNavigate, currentUser }: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [taskSectionCollapsed, setTaskSectionCollapsed] = useState(false)
  const [spaceSectionCollapsed, setSpaceSectionCollapsed] = useState(false)
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sessionId: string } | null>(null)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [pluginMenuOpen, setPluginMenuOpen] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [backendMeta, setBackendMeta] = useState<{
    baseUrl?: string
    latencyMs?: number
    error?: string
  }>({})
  const [backendProbing, setBackendProbing] = useState(false)

  const closeContextMenu = useCallback(() => setContextMenu(null), [])
  const closeAvatarMenu = useCallback(() => setAvatarMenuOpen(false), [])

  const applyBackendStatus = useCallback((status: {
    ready?: boolean
    online?: boolean
    baseUrl?: string
    latencyMs?: number
    error?: string
  } | null | undefined) => {
    const online = Boolean(status?.online ?? status?.ready)
    setBackendStatus(online ? 'online' : 'offline')
    setBackendMeta({
      baseUrl: status?.baseUrl,
      latencyMs: status?.latencyMs,
      error: status?.error,
    })
    setBackendProbing(false)
  }, [])

  const probeBackend = useCallback(async () => {
    setBackendProbing(true)
    try {
      const status = await ipc.invoke(IPC_CHANNELS.EXPERT_FASTAPI_STATUS) as {
        ready?: boolean
        online?: boolean
        baseUrl?: string
        latencyMs?: number
        error?: string
      }
      applyBackendStatus(status)
    } catch (e) {
      setBackendStatus('offline')
      setBackendMeta({
        error: e instanceof Error ? e.message : '无法探测本地服务',
      })
      setBackendProbing(false)
    }
  }, [applyBackendStatus])

  // Subscribe to main-process timed health checks (auth-001). Do not use renderer setInterval.
  useEffect(() => {
    const onStatus = (...args: unknown[]) => {
      const payload = args[0] as {
        probing?: boolean
        ready?: boolean
        online?: boolean
        baseUrl?: string
        latencyMs?: number
        error?: string
      }
      if (payload?.probing) {
        setBackendProbing(true)
        return
      }
      applyBackendStatus(payload)
    }
    ipc.on(IPC_CHANNELS.EXPERT_FASTAPI_STATUS_CHANGED, onStatus)
    void probeBackend()
    return () => ipc.off(IPC_CHANNELS.EXPERT_FASTAPI_STATUS_CHANGED, onStatus)
  }, [applyBackendStatus, probeBackend])

  useEffect(() => {
    const handler = () => {
      setContextMenu(null)
      setAvatarMenuOpen(false)
      setMoreMenuOpen(false)
      setPluginMenuOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, sessionId: id })
  }

  const toggleSpace = (space: string) => {
    setExpandedSpaces((prev) => {
      const next = new Set(prev)
      if (next.has(space)) next.delete(space)
      else next.add(space)
      return next
    })
  }

  const filtered = sessions.filter((s) => {
    if (!search) return true
    return s.title.toLowerCase().includes(search.toLowerCase())
  })

  const workspaceGroups = new Map<string, Session[]>()
  for (const s of filtered) {
    const ws = s.workspace || 'Default'
    if (!workspaceGroups.has(ws)) workspaceGroups.set(ws, [])
    workspaceGroups.get(ws)!.push(s)
  }

  const isNavActive = (id: string) => activeView === id
    || (id === 'assistant' && activeView === 'assistant-settings')
    || (id === 'experts-plugin' && (activeView === 'experts' || activeView === 'plugins'))
    || (id === 'knowledge' && activeView === 'data')
    || (id === 'settings' && activeView === 'member-roles')

  const handleRename = (id: string) => {
    const name = prompt('新名称：')
    if (name) { /* handled by persistence */ }
    closeContextMenu()
  }

  return (
    <div
      className="bb-sidebar-surface"
      style={{
        width: collapsed ? 56 : 268, transition: 'width .2s ease',
        height: '100%',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Header: Brand + version + actions */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '10px 4px' : '14px 14px 12px',
        minHeight: 52,
        boxShadow: '0 1px 0 rgba(15, 23, 42, 0.04)',
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, overflow: 'hidden', minWidth: 0 }}>
            <span style={{
              fontSize: 'var(--font-title)', fontWeight: 600, letterSpacing: '-0.02em',
              color: 'var(--text-tertiary)', whiteSpace: 'nowrap',
            }}>
              BspBuddy
            </span>
            <span style={{ fontSize: 'var(--font-micro)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
              v0.2
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 2 }}>
          <button
            type="button"
            className="bb-icon-btn"
            title={collapsed ? '展开侧栏' : '折叠侧栏'}
            aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
            onClick={onToggleCollapse}
          >
            <PanelLeftClose size={15} strokeWidth={1.75} aria-hidden="true" style={{ transform: collapsed ? 'scaleX(-1)' : undefined }} />
          </button>
          {!collapsed && (
            <>
              <button
                type="button"
                className="bb-icon-btn"
                title="搜索"
                aria-label="搜索任务"
                onClick={() => setSearchOpen(!searchOpen)}
                style={{
                  background: searchOpen ? 'var(--bg-hover)' : undefined,
                  color: searchOpen ? 'var(--accent)' : undefined,
                }}
              >
                <Search size={15} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="bb-icon-btn"
                title="筛选"
                aria-label="筛选"
              >
                <SlidersHorizontal size={15} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Collapsed: icon rail only */}
      {collapsed && (
        <div className="bb-nav-rail">
          <button type="button" className="bb-nav-rail-btn" title="新建任务" aria-label="新建任务" onClick={onNewSession}>
            <Plus size={18} strokeWidth={1.75} />
          </button>
          {PRIMARY_NAV.map((item) => {
            const active = isNavActive(item.id) || isNavActive(item.view)
            return (
              <button
                key={item.id}
                type="button"
                className={`bb-nav-rail-btn${active ? ' bb-nav-rail-btn--active' : ''}`}
                title={item.label}
                aria-label={item.label}
                onClick={() => {
                  if (item.id === 'experts-plugin') onNavigate?.('experts')
                  else onNavigate?.(item.view)
                }}
              >
                <item.icon size={17} strokeWidth={1.75} />
              </button>
            )
          })}
          <button
            type="button"
            className={`bb-nav-rail-btn${moreMenuOpen ? ' bb-nav-rail-btn--active' : ''}`}
            title="更多"
            aria-label="更多"
            onClick={() => onNavigate?.('inspiration')}
          >
            <Grid3x3 size={17} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Search input (conditional) */}
      {!collapsed && searchOpen && (
        <div style={{ padding: '0 12px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg-input)', borderRadius: 6,
            padding: '5px 10px',
          }}>
            <Search size={13} color="var(--text-tertiary)" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              name="sidebar-search"
              aria-label="搜索任务"
              placeholder="搜索任务…"
              autoFocus
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      )}

      {/* Primary Navigation — expanded */}
      {!collapsed && (
        <div style={{ padding: '6px 0 4px' }}>
          <button type="button" className="bb-nav-row" onClick={onNewSession} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            <span className="bb-icon-tile" aria-hidden="true">
              <Plus size={13} strokeWidth={1.75} />
            </span>
            <span>新建任务</span>
          </button>

          {PRIMARY_NAV.map((item) => {
            if (item.id === 'experts-plugin') {
              return (
                <div key={item.id} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className={`bb-nav-row${isNavActive(item.id) ? ' bb-nav-row--active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setPluginMenuOpen(!pluginMenuOpen)
                    }}
                  >
                    <span className={`bb-icon-tile${isNavActive(item.id) ? ' bb-icon-tile--active' : ' bb-icon-tile--muted'}`} aria-hidden="true">
                      <item.icon size={13} strokeWidth={1.75} />
                    </span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <ChevronDown size={11} strokeWidth={1.75} style={{ opacity: 0.45, transition: 'transform .15s ease', transform: pluginMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  </button>
                  {pluginMenuOpen && (
                    <div
                      style={{
                        position: 'absolute', top: '100%', left: 8, right: 8,
                        background: 'var(--bg-card)', borderRadius: 8,
                        border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
                        zIndex: 100, padding: '4px 0', marginTop: 2,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <SubMenuItem icon={User} label="专家中心" onClick={() => { onNavigate?.('experts'); setPluginMenuOpen(false) }} />
                      <SubMenuItem icon={Sparkles} label="技能与插件" onClick={() => { onNavigate?.('plugins'); setPluginMenuOpen(false) }} />
                    </div>
                  )}
                </div>
              )
            }
            return (
              <button
                key={item.id}
                type="button"
                className={`bb-nav-row${isNavActive(item.view) ? ' bb-nav-row--active' : ''}`}
                onClick={() => onNavigate?.(item.view)}
              >
                <span className={`bb-icon-tile${isNavActive(item.view) ? ' bb-icon-tile--active' : ' bb-icon-tile--muted'}`} aria-hidden="true">
                  <item.icon size={13} strokeWidth={1.75} />
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
              </button>
            )
          })}

          {/* "更多" with subtitle */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={`bb-nav-row${moreMenuOpen ? ' bb-nav-row--active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setMoreMenuOpen(!moreMenuOpen)
              }}
            >
              <span className={`bb-icon-tile${moreMenuOpen ? ' bb-icon-tile--active' : ' bb-icon-tile--muted'}`} aria-hidden="true">
                <Grid3x3 size={13} strokeWidth={1.75} />
              </span>
              <span>更多</span>
              <span style={{ fontSize: 'var(--font-micro)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>策略·自动化</span>
            </button>
            {moreMenuOpen && (
              <div
                style={{
                  position: 'absolute', top: '100%', left: 8, right: 8,
                  background: 'var(--bg-card)', borderRadius: 8,
                  border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
                  zIndex: 100, padding: '4px 0', marginTop: 2,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <SubMenuItem icon={ScrollText} label="策略" onClick={() => { onNavigate?.('policy'); setMoreMenuOpen(false) }} />
                <SubMenuItem icon={Repeat} label="自动化" onClick={() => { onNavigate?.('automation'); setMoreMenuOpen(false) }} />
                <SubMenuItem icon={Sparkles} label="灵感" onClick={() => { onNavigate?.('inspiration'); setMoreMenuOpen(false) }} />
                <SubMenuItem icon={Mail} label="邮箱" onClick={() => { onNavigate?.('mailbox'); setMoreMenuOpen(false) }} />
                <SubMenuItem icon={MessageSquare} label="反馈" onClick={() => { onNavigate?.('feedback'); setMoreMenuOpen(false) }} />
              </div>
            )}
          </div>
        </div>
      )}

      {!collapsed && (
        <div style={{
          margin: '6px 14px',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(15,23,42,0.06), transparent)',
        }} />
      )}

      {/* Tasks + Spaces section (both visible) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '2px' : '0 4px' }}>
        {/* Tasks Section */}
        {!collapsed && (
          <>
            <button
              type="button"
              className="bb-section-label"
              onClick={() => setTaskSectionCollapsed(!taskSectionCollapsed)}
              aria-expanded={!taskSectionCollapsed}
              aria-label={taskSectionCollapsed ? '展开任务列表' : '折叠任务列表'}
            >
              <ChevronDown
                size={12}
                strokeWidth={1.75}
                aria-hidden="true"
                style={{
                  transform: taskSectionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform .15s ease',
                }}
              />
              任务 ({filtered.length})
            </button>
            {!taskSectionCollapsed && filtered.map((s) => {
              const sStatus = s.status || 'pending'
              const dotColor = STATUS_DOT_COLORS[sStatus]
              const showDot = sStatus === 'in_progress' || sStatus === 'failed' || sStatus === 'planning'
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`bb-session-item${s.active ? ' bb-session-item--active' : ''}`}
                  onClick={() => onSelectSession(s.id)}
                  onContextMenu={(e) => handleContextMenu(e, s.id)}
                >
                  <span className="bb-session-icon" aria-hidden="true">
                    <MessageSquare size={12} strokeWidth={1.75} />
                  </span>
                  <span className="bb-session-text">
                    <span className="bb-session-title">{s.title}</span>
                    <span className="bb-session-meta">
                      {s.workspace || '本地'} · {s.date}
                    </span>
                  </span>
                  {showDot ? (
                    <span className="bb-session-dot" style={{ background: dotColor }} aria-hidden="true" />
                  ) : null}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--text-tertiary)' }}>
                暂无任务
              </div>
            )}
          </>
        )}

        {/* Spaces Section */}
        {!collapsed && (
          <>
            <button
              type="button"
              className="bb-section-label"
              onClick={() => setSpaceSectionCollapsed(!spaceSectionCollapsed)}
              aria-expanded={!spaceSectionCollapsed}
              aria-label={spaceSectionCollapsed ? '展开空间列表' : '折叠空间列表'}
            >
              <ChevronDown
                size={12}
                strokeWidth={1.75}
                aria-hidden="true"
                style={{
                  transform: spaceSectionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform .15s ease',
                }}
              />
              空间 ({workspaceGroups.size})
            </button>
            {!spaceSectionCollapsed && Array.from(workspaceGroups.entries()).map(([ws, wsSessions]) => {
              const isExpanded = expandedSpaces.has(ws)
              return (
                <div key={ws}>
                  <button
                    onClick={() => toggleSpace(ws)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 10px', borderRadius: 6,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: 'var(--text-secondary)',
                      textAlign: 'left' as const, fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <ChevronRight
                      size={11}
                      style={{
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform .15s ease',
                      }}
                    />
                    <FolderOpen size={13} style={{ opacity: 0.6 }} />
                    <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ws}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      {wsSessions.length}
                    </span>
                  </button>
                  {isExpanded && wsSessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`bb-session-item${s.active ? ' bb-session-item--active' : ''}`}
                      style={{ marginLeft: 20, width: 'calc(100% - 28px)' }}
                      onClick={() => onSelectSession(s.id)}
                      onContextMenu={(e) => handleContextMenu(e, s.id)}
                    >
                      <span className="bb-session-icon" aria-hidden="true">
                        <MessageSquare size={12} strokeWidth={1.75} />
                      </span>
                      <span className="bb-session-text">
                        <span className="bb-session-title">{s.title}</span>
                        <span className="bb-session-meta">
                          {s.workspace || '本地'} · {s.date}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )
            })}
            {workspaceGroups.size === 0 && (
              <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--text-tertiary)' }}>
                暂无空间
              </div>
            )}
          </>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y,
            background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
            zIndex: 100, minWidth: 160, padding: '4px 0',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextAction icon={Pin} label="置顶" onClick={() => closeContextMenu()} />
          <ContextAction icon={FolderOpen} label="打开文件夹" onClick={() => closeContextMenu()} />
          <ContextAction icon={Edit3} label="重命名" onClick={() => handleRename(contextMenu.sessionId)} />
          <ContextAction icon={Download} label="保存到工作空间" onClick={() => closeContextMenu()} />
          <ContextAction icon={Share2} label="分享" onClick={() => closeContextMenu()} />
          <ContextAction icon={Trash2} label="删除" onClick={() => closeContextMenu()} danger />
          <ContextAction icon={Archive} label="归档" onClick={() => closeContextMenu()} />
        </div>
      )}

      {/* Backend connection status */}
      <div style={{
        padding: collapsed ? '6px 8px' : '8px 12px 0',
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            void probeBackend()
          }}
          title={
            backendStatus === 'online'
              ? `本地服务已连接${backendMeta.baseUrl ? `\n${backendMeta.baseUrl}` : ''}${backendMeta.latencyMs != null ? `\n延迟 ${backendMeta.latencyMs}ms` : ''}\n点击刷新`
              : backendStatus === 'offline'
                ? `本地服务未连接${backendMeta.error ? `\n${backendMeta.error}` : ''}${backendMeta.baseUrl ? `\n${backendMeta.baseUrl}` : ''}\n点击重试`
                : '正在连接本地服务…'
          }
          aria-label={
            backendStatus === 'online' ? '本地服务已连接，点击刷新'
              : backendStatus === 'offline' ? '本地服务未连接，点击重试'
                : '正在连接本地服务'
          }
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8,
            padding: collapsed ? 6 : '6px 8px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: backendStatus === 'online'
              ? 'rgba(22, 163, 74, 0.08)'
              : backendStatus === 'offline'
                ? 'rgba(239, 68, 68, 0.08)'
                : 'var(--bg-hover)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: 'var(--text-secondary)',
          }}
        >
          <span
            aria-hidden="true"
            className={backendProbing || backendStatus === 'checking' ? 'bb-status-dot-pulse' : undefined}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              flexShrink: 0,
              background:
                backendStatus === 'online' ? '#16a34a'
                  : backendStatus === 'offline' ? '#ef4444'
                    : 'var(--text-tertiary)',
              boxShadow: backendStatus === 'online' && !backendProbing
                ? '0 0 0 3px rgba(22,163,74,0.15)'
                : undefined,
            }}
          />
          {!collapsed && (
            <>
              <span style={{
                flex: 1,
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 500,
                color: backendStatus === 'offline' ? 'var(--danger)' : 'var(--text-secondary)',
              }}>
                {backendStatus === 'online'
                  ? '本地服务已连接'
                  : backendStatus === 'offline'
                    ? '本地服务未连接'
                    : '本地服务'}
              </span>
              <RefreshCw
                size={12}
                strokeWidth={1.75}
                aria-hidden="true"
                style={{ opacity: 0.55, flexShrink: 0 }}
              />
            </>
          )}
        </button>
      </div>

      {/* Footer */}
      <div style={{
        boxShadow: '0 -1px 0 rgba(15, 23, 42, 0.04)',
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '10px 6px' : '10px 14px',
        position: 'relative',
      }}>
        {/* Avatar + Display Name — 来自 Portal SSO / AUTH_ME */}
        <button
          type="button"
          aria-label="账号菜单"
          aria-expanded={avatarMenuOpen}
          onClick={(e) => {
            e.stopPropagation()
            setAvatarMenuOpen((open) => !open)
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: 'none', background: 'transparent',
            cursor: 'pointer', fontFamily: 'inherit', padding: 0,
            minWidth: 0,
          }}
        >
          {(() => {
            const label = (currentUser?.name || 'User').trim() || 'User'
            const initial = Array.from(label)[0]?.toUpperCase() || 'U'
            return (
              <>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--accent)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 11, fontWeight: 600,
                  flexShrink: 0,
                }}>
                  {initial}
                </div>
                {!collapsed && (
                  <span
                    title={label}
                    style={{
                      fontSize: 12, color: 'var(--text-primary)', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120,
                    }}
                  >
                    {label}
                  </span>
                )}
              </>
            )
          })()}
        </button>

        {/* Footer actions */}
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              title="通知"
              aria-label="通知"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', padding: 0,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <Bell size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              title="分享/链接"
              aria-label="分享/链接"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', padding: 0,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <Link size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Avatar menu */}
        {avatarMenuOpen && (
          <div
            style={{
              position: 'absolute', bottom: '100%', left: 8, right: 8,
              background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
              zIndex: 100, padding: '4px 0', marginBottom: 4,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {AVATAR_MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate?.(item.id)
                  setAvatarMenuOpen(false)
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', border: 'none', background: 'none',
                  cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ContextAction({
  icon: Icon, label, onClick, danger,
}: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 14px', border: 'none', background: 'none',
        cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
        color: danger ? 'var(--danger)' : 'var(--text-primary)',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

function SubMenuItem({
  icon: Icon, label, onClick,
}: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 14px', border: 'none', background: 'none',
        cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
        color: 'var(--text-primary)',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}
