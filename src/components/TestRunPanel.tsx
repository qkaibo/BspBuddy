import { useState, useRef, useEffect } from 'react'
import { X, Send } from 'lucide-react'
import { apiPost } from '../lib/api-client'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { ExpertBindings } from '../lib/expert-types'

const ipc = createIpcClient()

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  open: boolean
  onClose: () => void
  expertId?: string
  persona?: string
  methodology?: string
  bindings?: ExpertBindings
}

export function TestRunPanel({ open, onClose, expertId, persona, methodology, bindings }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      if (expertId) {
        const session = await apiPost<{ id: string }>('/api/chat/sessions', {
          tenant_id: 'tenant_demo',
          agent_id: expertId,
          title: 'Test Run',
        }) as { id: string }
        const turn = await apiPost<{ reply: string }>('/api/chat/turn', {
          tenant_id: 'tenant_demo',
          session_id: session.id,
          message: text,
        }) as { reply: string }
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: turn.reply || '(无回复)',
        }
        setMessages((prev) => [...prev, assistantMsg])
      } else {
        const result = await ipc.invoke(IPC_CHANNELS.EXPERT_TEST_RUN, {
          persona,
          methodology,
          bindings,
          message: text,
        }) as { response: string }
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result?.response || '(无响应)',
        }
        setMessages((prev) => [...prev, assistantMsg])
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `测试异常: ${String(err)}`,
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-overlay="true"
      style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 250,
      width: 400, maxWidth: '90vw',
      background: 'var(--bg-card)',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.2)',
      transform: open ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.25s ease',
      display: 'flex', flexDirection: 'column',
      overscrollBehavior: 'contain',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Test Run</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭测试面板"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', padding: 2,
            display: 'flex', alignItems: 'center',
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        {messages.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center',
          }}>
            输入消息开始测试专家
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: 10,
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word' as const,
              ...(msg.role === 'user'
                ? { background: 'var(--accent)', color: '#fff', borderBottomRightRadius: 4 }
                : { background: 'var(--bg-input)', color: 'var(--text-primary)', borderBottomLeftRadius: 4 }
              ),
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{
            display: 'flex', justifyContent: 'flex-start',
          }}>
            <div style={{
              padding: '8px 12px', borderRadius: 10, borderBottomLeftRadius: 4,
              background: 'var(--bg-input)', color: 'var(--text-tertiary)',
              fontSize: 12,
            }}>
              专家思考中…
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid var(--border)',
        flexShrink: 0, display: 'flex', gap: 8,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="输入测试消息…"
          disabled={loading}
          style={{
            flex: 1, padding: '7px 10px', borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 12, fontFamily: 'inherit',
            color: 'var(--text-primary)', background: 'var(--bg-input)',
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || loading}
          aria-label="发送测试消息"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 8,
            border: 'none',
            background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg-input)',
            color: input.trim() && !loading ? '#fff' : 'var(--text-tertiary)',
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            opacity: input.trim() && !loading ? 1 : 0.5,
          }}
        >
          <Send size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
