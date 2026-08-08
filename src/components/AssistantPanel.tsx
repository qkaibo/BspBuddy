// ============================================================
// AssistantPanel — 远程助理执行记录页面
// Shows complete execution records: thinking process, steps,
// generated files, and final results.
// Access: 左下角头像 → 设置 → 助理设置
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Smartphone,
  MessageSquare,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  Loader,
  RefreshCw,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ExternalLink,
  Shield,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { AssistantState, AssistantMessage, IMPlatform, IMConnectionStatus } from '../lib/im-types'
import {
  IM_PLATFORM_LABELS,
  IM_PLATFORMS,
} from '../lib/im-types'

const ipc = createIpcClient()

interface Props {
  onNavigateToSettings?: () => void
}

export function AssistantPanel({ onNavigateToSettings }: Props) {
  const [state, setState] = useState<AssistantState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<IMPlatform | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [filterMobile, setFilterMobile] = useState(true)

  const loadState = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await ipc.invoke(IPC_CHANNELS.ASSISTANT_GET_STATE) as AssistantState & {
        constraints: { workspacePath: string; singleSession: boolean; historyImmutable: boolean }
      }
      setState(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载助理状态失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadState()

    // Listen for IM events to auto-refresh
    ipc.on(IPC_CHANNELS.IM_MESSAGE, () => {
      loadState()
    })
  }, [loadState])

  const toggleMessageExpanded = (id: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const filteredMessages = (state?.messages ?? [])
    .filter((m) => {
      if (filterMobile && !m.fromMobile) return false
      if (selectedPlatform !== 'all' && m.platform !== selectedPlatform) return false
      if (searchQuery && !m.content.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
    .sort((a, b) => b.timestamp - a.timestamp)

  const connectedCount = IM_PLATFORMS.filter(
    (p) => state?.platformStatus && state.platformStatus[p] === 'connected',
  ).length

  const hasActiveRequest = state?.isProcessing && state?.currentRequestId

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, background: 'var(--bg-root)' }}>
        <Loader size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, background: 'var(--bg-root)', gap: 12 }}>
        <XCircle size={32} color="var(--danger)" />
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{error}</span>
        <button
          onClick={loadState}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)',
            cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit',
          }}
        >
          <RefreshCw size={13} /> 重试
        </button>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-root)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={18} color="var(--accent)" />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              远程助理
            </span>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 10,
              background: connectedCount > 0 ? 'var(--accent-light)' : 'var(--bg-hover)',
              color: connectedCount > 0 ? 'var(--accent)' : 'var(--text-tertiary)',
            }}>
              {connectedCount > 0 ? `已连接 ${connectedCount} 个平台` : '未连接'}
            </span>
          </div>
          <button
            onClick={onNavigateToSettings}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
              borderRadius: 4, border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'inherit',
            }}
          >
            设置
            <ExternalLink size={11} />
          </button>
        </div>

        {/* Active request indicator */}
        {hasActiveRequest && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            borderRadius: 6, background: 'var(--accent-light)', marginBottom: 8,
          }}>
            <Loader size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>
              正在执行远程任务...
            </span>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 160,
            background: 'var(--bg-input)', borderRadius: 6, padding: '5px 10px',
          }}>
            <Search size={12} color="var(--text-tertiary)" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索历史记录..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Platform filter */}
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value as IMPlatform | 'all')}
            style={{
              padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--bg-card)', fontSize: 11, color: 'var(--text-primary)',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <option value="all">全部平台</option>
            {IM_PLATFORMS.map((p) => (
              <option key={p} value={p}>{IM_PLATFORM_LABELS[p]}</option>
            ))}
          </select>

          {/* Mobile-only toggle */}
          <button
            onClick={() => setFilterMobile(!filterMobile)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
              borderRadius: 6, border: '1px solid var(--border)',
              background: filterMobile ? 'var(--accent-light)' : 'var(--bg-card)',
              cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
              color: filterMobile ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <Smartphone size={11} />
            仅手机指令
          </button>

          {/* Refresh */}
          <button
            onClick={loadState}
            style={{
              padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'var(--text-tertiary)',
            }}
            title="刷新"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Connection status bar */}
      <div style={{
        display: 'flex', gap: 4, padding: '6px 20px', overflowX: 'auto',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-card)',
      }}>
        {IM_PLATFORMS.map((p) => {
          const status: IMConnectionStatus = state?.platformStatus?.[p] ?? 'disconnected'
          const isConnected = status === 'connected'
          return (
            <div
              key={p}
              style={{
                display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px',
                borderRadius: 4, fontSize: 10,
                background: isConnected ? 'var(--accent-light)' : 'var(--bg-hover)',
                color: isConnected ? 'var(--accent)' : 'var(--text-tertiary)',
                whiteSpace: 'nowrap',
              }}
            >
              {isConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
              {IM_PLATFORM_LABELS[p]}
            </div>
          )
        })}
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {filteredMessages.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            padding: 60, color: 'var(--text-tertiary)',
          }}>
            <MessageSquare size={40} opacity={0.3} />
            <span style={{ fontSize: 13 }}>暂无远程执行记录</span>
            <span style={{ fontSize: 11 }}>
              通过手机微信/企微/QQ/飞书/钉钉/元宝派发送指令，执行记录将在此显示
            </span>
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <MessageRow
              key={msg.id}
              message={msg}
              expanded={expandedMessages.has(msg.id)}
              onToggle={() => toggleMessageExpanded(msg.id)}
            />
          ))
        )}
      </div>

      {/* Footer stats */}
      <div style={{
        padding: '8px 20px', borderTop: '1px solid var(--border)',
        background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: 'var(--text-tertiary)',
      }}>
        <span>共 {filteredMessages.length} 条记录</span>
        <span>
          助理工作目录: {state?.workspacePath ?? '—'}
        </span>
        <span>单会话 | 历史不可清除</span>
      </div>
    </div>
  )
}

function MessageRow({
  message,
  expanded,
  onToggle,
}: {
  message: AssistantMessage
  expanded: boolean
  onToggle: () => void
}) {
  const isAssistant = message.role === 'assistant'
  const isMobile = message.fromMobile
  const time = new Date(message.timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div style={{ padding: '4px 20px' }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
          borderRadius: 8, cursor: 'pointer',
          background: isAssistant ? 'var(--bg-card)' : 'transparent',
          border: isAssistant ? '1px solid var(--border)' : '1px solid transparent',
          transition: 'background .15s',
        }}
        onMouseEnter={(e) => {
          if (!isAssistant) e.currentTarget.style.background = 'var(--bg-hover)'
        }}
        onMouseLeave={(e) => {
          if (!isAssistant) e.currentTarget.style.background = 'transparent'
        }}
      >
        {/* Icon */}
        <div style={{ marginTop: 2, flexShrink: 0 }}>
          {isMobile ? (
            <Smartphone size={14} color="var(--accent)" />
          ) : isAssistant ? (
            <CheckCircle size={14} color="var(--success)" />
          ) : (
            <MessageSquare size={14} color="var(--text-tertiary)" />
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
              {isAssistant ? '助理' : message.senderName || '用户'}
            </span>
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3,
              background: 'var(--bg-hover)', color: 'var(--text-tertiary)',
            }}>
              {IM_PLATFORM_LABELS[message.platform as IMPlatform] ?? message.platform}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
              <Clock size={9} style={{ verticalAlign: 'middle', marginRight: 2 }} />
              {time}
            </span>
          </div>

          <div style={{
            fontSize: 12, color: 'var(--text-secondary)',
            lineHeight: 1.5, whiteSpace: expanded ? 'normal' : 'nowrap',
            overflow: 'hidden',
            maxHeight: expanded ? 'none' : 40,
            textOverflow: 'ellipsis',
          }}>
            {message.content}
          </div>

          {/* Artifacts indicator */}
          {message.artifacts && message.artifacts.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {message.artifacts.map((a, i) => (
                <span
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '2px 6px', borderRadius: 4,
                    background: 'var(--accent-light)', fontSize: 10,
                    color: 'var(--accent)',
                  }}
                >
                  <FileText size={10} />
                  {a.name}
                </span>
              ))}
            </div>
          )}

          {/* Expand indicator */}
          {message.content.length > 150 && (
            <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>
              {expanded ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ChevronUp size={10} /> 收起
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ChevronDown size={10} /> 展开全文
                </span>
              )}
            </div>
          )}
        </div>

        {/* Approval badge */}
        {(message.content.includes('审批') || message.content.includes('确认')) && !isAssistant && (
          <div style={{ flexShrink: 0 }}>
            <Shield size={14} color="var(--warning)" />
          </div>
        )}
      </div>
    </div>
  )
}
