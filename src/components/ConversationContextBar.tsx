import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Sparkles, Wrench, BookOpen, FileText } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import { ResourceSearchList } from './pickers/ResourceSearchList'

const ipc = createIpcClient()

export interface ActiveResource {
  id: string
  type: 'expert' | 'skill' | 'sop' | 'knowledge'
  name: string
}

type AddTab = 'expert' | 'skill' | 'sop' | 'knowledge'

const TYPE_CONFIG: Record<AddTab, { label: string; icon: React.ReactNode; ipcChannel: string }> = {
  expert: { label: '专家', icon: <Sparkles size={12} />, ipcChannel: IPC_CHANNELS.EXPERT_LIST },
  skill: { label: '技能', icon: <Wrench size={12} />, ipcChannel: IPC_CHANNELS.SKILL_LIST },
  sop: { label: 'SOP', icon: <FileText size={12} />, ipcChannel: IPC_CHANNELS.SOP_LIST },
  knowledge: { label: '知识库', icon: <BookOpen size={12} />, ipcChannel: IPC_CHANNELS.KNOWLEDGE_LIST },
}

function tagStyle(type: ActiveResource['type']): React.CSSProperties {
  const colors: Record<string, string> = {
    expert: 'var(--accent)',
    skill: '#f59e0b',
    sop: '#10b981',
    knowledge: '#6366f1',
  }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'inherit',
    lineHeight: '20px',
    height: 26,
    boxSizing: 'border-box',
    background: `${colors[type]}14`,
    color: colors[type],
    border: `1px solid ${colors[type]}33`,
    whiteSpace: 'nowrap',
  }
}

function getTypeIcon(type: ActiveResource['type']) {
  switch (type) {
    case 'expert': return <Sparkles size={11} />
    case 'skill': return <Wrench size={11} />
    case 'sop': return <FileText size={11} />
    case 'knowledge': return <BookOpen size={11} />
  }
}

// ── + 添加入口按钮（放在对话框上方工具栏） ──────────────────────

export function AddResourceButton({ onAdd, boundIds }: {
  onAdd: (resource: ActiveResource) => void
  boundIds: string[]
}) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<AddTab>('expert')

  return (
    <span style={{ position: 'relative', display: 'inline-flex', height: 26, boxSizing: 'border-box' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          lineHeight: '20px', height: 26, boxSizing: 'border-box',
          fontFamily: 'inherit', cursor: 'pointer',
          background: 'var(--bg-hover)', color: 'var(--text-secondary)',
          border: '1px dashed var(--border)',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <Plus size={12} />
        添加资源
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 200 }}
          />
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, marginBottom: 6,
            width: 320, maxHeight: 340,
            background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 201, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            {/* Tabs */}
            <div style={{
              display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
              padding: '0 8px', flexShrink: 0,
            }}>
              {(Object.keys(TYPE_CONFIG) as AddTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 12px', border: 'none', background: 'none',
                    cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                    color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: activeTab === tab ? 600 : 400,
                    borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  {TYPE_CONFIG[tab].label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
              <ResourceListPanel
                tab={activeTab}
                boundIds={boundIds}
                onAdd={(id, name) => {
                  onAdd({ id, type: activeTab, name })
                  setOpen(false)
                }}
              />
            </div>
          </div>
        </>
      )}
    </span>
  )
}

// ── Tag 行（显示已激活资源，在输入框上方） ────────────────────

export function ConversationContextTags({ resources, onRemove }: {
  resources: ActiveResource[]
  onRemove: (id: string) => void
}) {
  if (resources.length === 0) return null

  return (
    <>
      {resources.map((r) => (
        <span key={`${r.type}-${r.id}`} style={tagStyle(r.type)}>
          {getTypeIcon(r.type)}
          {r.name}
          <button
            type="button"
            onClick={() => onRemove(r.id)}
            style={{
              marginLeft: 2, padding: 0, border: 'none', background: 'none',
              cursor: 'pointer', color: 'inherit', opacity: 0.6,
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={11} />
          </button>
        </span>
      ))}
    </>
  )
}

// ── Tab panel: loads and displays resource list ───────────────────────────

function ResourceListPanel({
  tab,
  boundIds,
  onAdd,
}: {
  tab: AddTab
  boundIds: string[]
  onAdd: (id: string, name: string) => void
}) {
  const [items, setItems] = useState<{ id: string; name: string; description?: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const channel = TYPE_CONFIG[tab].ipcChannel
    ipc.invoke(channel)
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : []
        setItems(list.map((item: any) => ({
          id: item.id || item.skill_id || item.slug || '',
          name: item.name || item.title || item.slug || String(item.id || ''),
          description: item.description,
        })))
      })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tab])

  const available = items.filter((item) => !boundIds.includes(item.id))

  return (
    <ResourceSearchList
      resources={available}
      onAdd={(id) => {
        const item = items.find((i) => i.id === id)
        onAdd(id, item?.name || id)
      }}
      loading={loading}
    />
  )
}
