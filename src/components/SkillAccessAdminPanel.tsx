import { useCallback, useEffect, useState } from 'react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'

const ipc = createIpcClient()

interface AccessItem {
  id: string
  skill_slug: string
  grantee_user_id: string
  grant_type: string
  status: string
  reason?: string
  created_at: string
}

interface Props {
  onToast?: (msg: string) => void
}

export function SkillAccessAdminPanel({ onToast }: Props) {
  const [items, setItems] = useState<AccessItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_ACCESS_INBOX, 'pending') as AccessItem[]
      setItems(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载审批列表失败')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function decide(item: AccessItem, decision: 'approve' | 'reject') {
    const note = decision === 'reject' ? '不符合授权策略' : 'approved'
    try {
      await ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_ACCESS_DECIDE, item.skill_slug, item.id, { decision, note })
      onToast?.(decision === 'approve' ? '已批准' : '已拒绝')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>待审批授权</strong>
        <button type="button" className="bb-btn" onClick={() => void load()}>刷新</button>
      </div>
      {loading ? <div style={{ fontSize: 12, color: 'var(--bb-muted)' }}>加载中…</div> : null}
      {error ? <div style={{ color: '#b91c1c', fontSize: 12 }}>{error}</div> : null}
      {!loading && items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--bb-muted)' }}>暂无待审批申请</div>
      ) : null}
      {items.map((item) => (
        <div key={item.id} className="bb-card" style={{ padding: 10, display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{item.skill_slug} · {item.grant_type}</div>
          <div style={{ fontSize: 12, color: 'var(--bb-muted)' }}>申请人：{item.grantee_user_id}</div>
          <div style={{ fontSize: 12 }}>{item.reason || '—'}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="bb-btn bb-btn-primary" onClick={() => void decide(item, 'approve')}>批准</button>
            <button type="button" className="bb-btn" onClick={() => void decide(item, 'reject')}>拒绝</button>
          </div>
        </div>
      ))}
    </div>
  )
}
