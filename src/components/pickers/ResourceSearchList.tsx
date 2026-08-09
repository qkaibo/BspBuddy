import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import type { ResourceSummary } from './types'

interface Props {
  resources: ResourceSummary[]
  onAdd: (id: string) => void
  loading?: boolean
}

export function ResourceSearchList({ resources, onAdd, loading }: Props) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(timerRef.current)
  }, [search])

  const filtered = debounced
    ? resources.filter((r) =>
        r.name.toLowerCase().includes(debounced.toLowerCase()) ||
        r.id.toLowerCase().includes(debounced.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(debounced.toLowerCase()))
      )
    : resources

  if (loading) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
        加载中…
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 8, position: 'relative' }}>
        <Search size={12} aria-hidden="true" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          name="resource-search"
          aria-label="搜索资源"
          placeholder="搜索资源…"
          style={{
            width: '100%', padding: '6px 10px 6px 26px',
            borderRadius: 6, border: '1px solid var(--border)',
            fontSize: 11, fontFamily: 'inherit',
            color: 'var(--text-primary)', background: 'var(--bg-input)',
            boxSizing: 'border-box' as const,
          }}
        />
      </div>
      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '12px', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
            暂无可用资源
          </div>
        ) : (
          filtered.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => onAdd(r.id)}
              aria-label={`添加 ${r.name}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                fontSize: 11, color: 'var(--text-primary)',
                background: 'transparent', border: 'none', fontFamily: 'inherit', textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{
                width: 14, height: 14, borderRadius: 3,
                border: '1.5px solid var(--border)', flexShrink: 0,
                display: 'inline-block',
              }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {r.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                {[r.version && `v${r.version}`, r.metadata?.business_domain as string, r.status && (r.status === 'active' || r.status === 'published' ? '已启用' : '')].filter(Boolean).join(' · ')}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
