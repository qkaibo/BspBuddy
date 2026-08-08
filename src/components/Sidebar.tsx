import { useState, useCallback, useEffect } from 'react'
import {
  Plus, Search, MessageSquare, Clock, FolderOpen,
  Bell, ChevronDown, ChevronRight, Trash2, Share2,
  Archive, Edit3, Download, Pin,
  PanelLeftClose, SlidersHorizontal, User, Crosshair,
  Network, Repeat, Grid3x3, Link, Sparkles, Mail,
} from 'lucide-react'

interface Session {
  id: string
  title: string
  date: string
  active: boolean
  workspace?: string
  status?: 'in_progress' | 'completed' | 'failed' | 'pending' | 'planning' | 'archived'
}

type ViewType = 'chat' | 'plugins' | 'experts' | 'connectors' | 'projects' | 'mailbox' | 'activate-mailbox' | 'settings' | 'pricing' | 'data' | 'memory' | 'cloud-agent' | 'inspiration' | 'assistant' | 'assistant-settings' | 'feedback'

interface Props {
  sessions: Session[]
  onNewSession: () => void
  onSelectSession: (id: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
  activeView?: ViewType
  onNavigate?: (view: ViewType) => void
}

const PRIMARY_NAV = [
  { id: 'assistant', label: '助理', icon: User, view: 'assistant' as ViewType },
  { id: 'projects', label: '项目', icon: Crosshair, view: 'projects' as ViewType },
  { id: 'experts-plugin', label: '专家·技能·连接器', icon: Network, view: 'experts' as ViewType },
  { id: 'automation', label: '自动化', icon: Repeat, view: 'chat' as ViewType },
]

const AVATAR_MENU_ITEMS = [
  { id: 'settings' as const, label: '设置' },
  { id: 'memory' as const, label: '记忆' },
  { id: 'pricing' as const, label: '定价' },
  { id: 'data' as const, label: '数据管理' },
]

const STATUS_DOT_COLORS: Record<string, string> = {
  in_progress: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
  pending: '#f59e0b',
  planning: '#a855f7',
  archived: '#6b7280',
}

export function Sidebar({ sessions, onNewSession, onSelectSession, collapsed, onToggleCollapse, activeView = 'chat', onNavigate }: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [taskSectionCollapsed, setTaskSectionCollapsed] = useState(false)
  const [spaceSectionCollapsed, setSpaceSectionCollapsed] = useState(false)
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sessionId: string } | null>(null)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [pluginMenuOpen, setPluginMenuOpen] = useState(false)

  const closeContextMenu = useCallback(() => setContextMenu(null), [])
  const closeAvatarMenu = useCallback(() => setAvatarMenuOpen(false), [])

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

  const isNavActive = (id: string) => activeView === id || (id === 'assistant' && activeView === 'assistant-settings') || (id === 'experts-plugin' && (activeView === 'experts' || activeView === 'plugins'))

  const handleRename = (id: string) => {
    const name = prompt('新名称：')
    if (name) { /* handled by persistence */ }
    closeContextMenu()
  }

  return (
    <div style={{
      width: collapsed ? 52 : 240, transition: 'width .2s ease',
      background: 'var(--bg-sidebar)', height: '100%',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      borderRight: '1px solid var(--border)',
      userSelect: 'none',
    }}>
      {/* Header: Brand + version + actions */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: collapsed ? '6px 4px' : '10px 12px',
        minHeight: 40,
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, overflow: 'hidden' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              BspBuddy
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
              v0.2
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 2 }}>
          <button
            title="折叠侧栏"
            onClick={onToggleCollapse}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: 0,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <PanelLeftClose size={15} />
          </button>
          {!collapsed && (
            <>
              <button
                title="搜索"
                onClick={() => setSearchOpen(!searchOpen)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 6,
                  background: searchOpen ? 'var(--bg-hover)' : 'none',
                  border: 'none', cursor: 'pointer',
                  color: searchOpen ? 'var(--accent)' : 'var(--text-secondary)', padding: 0,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = searchOpen ? 'var(--bg-hover)' : 'none'}
              >
                <Search size={15} />
              </button>
              <button
                title="筛选"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 6,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', padding: 0,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <SlidersHorizontal size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search input (conditional) */}
      {!collapsed && searchOpen && (
        <div style={{ padding: '0 12px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg-input)', borderRadius: 6,
            padding: '5px 10px',
          }}>
            <Search size={13} color="var(--text-tertiary)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索任务..."
              autoFocus
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      )}

      {/* Primary Navigation */}
      {!collapsed && (
        <div style={{ padding: '4px 8px' }}>
          {/* + 新建任务 — emphasized first item */}
          <button
            onClick={onNewSession}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 6,
              border: 'none', cursor: 'pointer', fontSize: 13,
              color: 'var(--text-primary)', fontWeight: 600,
              fontFamily: 'inherit', background: 'none',
              textAlign: 'left' as const,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <Plus size={15} color="var(--accent)" />
            <span>新建任务</span>
          </button>

          {PRIMARY_NAV.map((item) => {
            if (item.id === 'experts-plugin') {
              return (
                <div key={item.id} style={{ position: 'relative' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setPluginMenuOpen(!pluginMenuOpen)
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', borderRadius: 6,
                      background: isNavActive(item.id) ? 'var(--bg-hover)' : 'none',
                      border: 'none', cursor: 'pointer', fontSize: 12,
                      color: isNavActive(item.id) ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: isNavActive(item.id) ? 600 : 400,
                      fontFamily: 'inherit', textAlign: 'left' as const,
                    }}
                    onMouseEnter={(e) => { if (!isNavActive(item.id)) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={(e) => { if (!isNavActive(item.id)) e.currentTarget.style.background = 'none' }}
                  >
                    <item.icon size={14} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <ChevronDown size={10} style={{ opacity: 0.5, transition: 'transform .15s ease', transform: pluginMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
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
                onClick={() => onNavigate?.(item.view)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 6,
                  background: isNavActive(item.view) ? 'var(--bg-hover)' : 'none',
                  border: 'none', cursor: 'pointer', fontSize: 12,
                  color: isNavActive(item.view) ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: isNavActive(item.view) ? 600 : 400,
                  fontFamily: 'inherit', textAlign: 'left' as const,
                }}
                onMouseEnter={(e) => { if (!isNavActive(item.view)) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { if (!isNavActive(item.view)) e.currentTarget.style.background = 'none' }}
              >
                <item.icon size={14} />
                <span style={{ flex: 1 }}>{item.label}</span>
              </button>
            )
          })}

          {/* "更多" with subtitle */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMoreMenuOpen(!moreMenuOpen)
              }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', borderRadius: 6,
                background: moreMenuOpen ? 'var(--bg-hover)' : 'none',
                border: 'none', cursor: 'pointer', fontSize: 12,
                color: moreMenuOpen ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: moreMenuOpen ? 600 : 400,
                fontFamily: 'inherit', textAlign: 'left' as const,
              }}
              onMouseEnter={(e) => { if (!moreMenuOpen) e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={(e) => { if (!moreMenuOpen) e.currentTarget.style.background = 'none' }}
            >
              <Grid3x3 size={14} />
              <span>更多</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>资料库·灵感</span>
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
                <SubMenuItem icon={FolderOpen} label="资料库" onClick={() => { onNavigate?.('data'); setMoreMenuOpen(false) }} />
                <SubMenuItem icon={Sparkles} label="灵感" onClick={() => { onNavigate?.('inspiration'); setMoreMenuOpen(false) }} />
                <SubMenuItem icon={Mail} label="邮箱" onClick={() => { onNavigate?.('mailbox'); setMoreMenuOpen(false) }} />
                <SubMenuItem icon={MessageSquare} label="反馈" onClick={() => { onNavigate?.('feedback'); setMoreMenuOpen(false) }} />
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{
        margin: collapsed ? '4px 4px' : '4px 8px',
        borderTop: '1px solid var(--border)',
      }} />

      {/* Tasks + Spaces section (both visible) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '2px' : '0 4px' }}>
        {/* Tasks Section */}
        {!collapsed && (
          <>
            <div
              onClick={() => setTaskSectionCollapsed(!taskSectionCollapsed)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 10px', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '.5px',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
            >
              <ChevronDown
                size={12}
                style={{
                  transform: taskSectionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform .15s ease',
                }}
              />
              任务 ({filtered.length})
            </div>
            {!taskSectionCollapsed && filtered.map((s) => {
              const sStatus = s.status || 'pending'
              const dotColor = STATUS_DOT_COLORS[sStatus]
              const showDot = sStatus === 'in_progress' || sStatus === 'failed' || sStatus === 'planning'
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectSession(s.id)}
                  onContextMenu={(e) => handleContextMenu(e, s.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 6,
                    background: s.active ? 'var(--bg-hover)' : 'transparent',
                    border: 'none', cursor: 'pointer', fontSize: 12,
                    color: s.active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textAlign: 'left' as const, fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { if (!s.active) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={(e) => { if (!s.active) e.currentTarget.style.background = 'transparent' }}
                >
                  <MessageSquare size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
                  <span style={{
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontWeight: s.active ? 600 : 400,
                  }}>
                    {s.title}
                  </span>
                  {showDot ? (
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: dotColor, flexShrink: 0,
                    }} />
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      {s.date}
                    </span>
                  )}
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
            <div
              onClick={() => setSpaceSectionCollapsed(!spaceSectionCollapsed)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 10px', marginTop: 8, cursor: 'pointer',
                fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '.5px',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
            >
              <ChevronDown
                size={12}
                style={{
                  transform: spaceSectionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform .15s ease',
                }}
              />
              空间 ({workspaceGroups.size})
            </div>
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
                      onClick={() => onSelectSession(s.id)}
                      onContextMenu={(e) => handleContextMenu(e, s.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 10px 5px 28px', borderRadius: 6,
                        background: s.active ? 'var(--bg-hover)' : 'transparent',
                        border: 'none', cursor: 'pointer', fontSize: 12,
                        color: s.active ? 'var(--text-primary)' : 'var(--text-secondary)',
                        textAlign: 'left' as const, fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => { if (!s.active) e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={(e) => { if (!s.active) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: s.active ? 600 : 400,
                      }}>
                        {s.title}
                      </span>
                      {!s.workspace && (
                        <span style={{
                          fontSize: 9, padding: '1px 5px', borderRadius: 3,
                          background: 'var(--bg-input)', color: 'var(--text-tertiary)',
                          fontWeight: 500, flexShrink: 0,
                        }}>
                          本地
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        {s.date}
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

      {/* Footer */}
      <div style={{
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: collapsed ? '6px' : '8px 12px',
        position: 'relative',
      }}>
        {/* Avatar + Display Name */}
        <button
          onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: 'none', background: 'transparent',
            cursor: 'pointer', fontFamily: 'inherit', padding: 0,
          }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--accent)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 11, fontWeight: 600,
            flexShrink: 0,
          }}>
            U
          </div>
          {!collapsed && (
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
              User
            </span>
          )}
        </button>

        {/* Footer actions */}
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              title="通知"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', padding: 0,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <Bell size={14} />
            </button>
            <button
              title="分享/链接"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', padding: 0,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <Link size={14} />
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
