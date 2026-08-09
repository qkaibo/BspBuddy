import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { createIpcClient } from '../../lib/client'
import { IPC_CHANNELS } from '../../lib/types'
import { ResourceCard } from './ResourceCard'
import { ResourceSearchList } from './ResourceSearchList'
import type { ResourceSummary } from './types'

const ipc = createIpcClient()

interface Props {
  boundIds: string[]
  onChange: (ids: string[]) => void
  expertId?: string
}

export function ConnectorPicker({ boundIds, onChange, expertId: _expertId }: Props) {
  const [available, setAvailable] = useState<ResourceSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ipc.invoke(IPC_CHANNELS.CONNECTOR_LIST)
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data as ResourceSummary[] : []
        setAvailable(list)
      })
      .catch(() => {
        if (!cancelled) setAvailable([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const unbound = available.filter((r) => !boundIds.includes(r.id))

  function handleAdd(id: string) {
    if (!boundIds.includes(id)) {
      onChange([...boundIds, id])
    }
  }

  function handleRemove(id: string) {
    onChange(boundIds.filter((bid) => bid !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>绑定连接器</div>
        <button
          onClick={() => console.log('Navigate to Connector panel')}
          style={{
            display: 'flex', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: 'var(--accent)', fontFamily: 'inherit',
            padding: 0,
          }}
        >
          <ExternalLink size={11} />
          去连接器面板配置
        </button>
      </div>

      {boundIds.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>已绑定连接器:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {boundIds.map((id) => {
              const resource = available.find((r) => r.id === id)
              if (resource) {
                return <ResourceCard key={id} resource={resource} onRemove={handleRemove} />
              }
              return (
                <div key={id} style={{
                  background: 'var(--bg-input)', borderRadius: 6, padding: '8px 10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{id}</span>
                  </div>
                  <button type="button" onClick={() => handleRemove(id)} aria-label={`移除 ${id}`} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', padding: 2, fontSize: 13,
                  }}>×</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>可选连接器:</div>
        <ResourceSearchList resources={unbound} onAdd={handleAdd} loading={loading} />
      </div>
    </div>
  )
}
