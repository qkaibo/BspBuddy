import { useState } from 'react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'

const ipc = createIpcClient()

interface Props {
  slug: string
  accessLevel: string
  onClose: () => void
  onSubmitted?: (message: string) => void
}

export function SkillAccessRequestDialog({ slug, accessLevel, onClose, onSubmitted }: Props) {
  const defaultType = accessLevel === 'L2' ? 'download' : 'use'
  const [requestType, setRequestType] = useState<'use' | 'download'>(defaultType)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!reason.trim()) {
      setError('请填写申请理由')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_ACCESS_REQUEST, slug, {
        request_type: requestType,
        reason: reason.trim(),
      }) as { status?: string; already_authorized?: boolean; detail?: string | { message?: string }; error?: string }
      if (res?.error || (typeof res?.detail === 'string')) {
        setError(res.error || String(res.detail))
        return
      }
      if (res?.detail && typeof res.detail === 'object' && res.detail.message) {
        setError(res.detail.message)
        return
      }
      const msg = res?.already_authorized
        ? '已有授权，可直接使用'
        : res?.status === 'pending'
          ? '已提交申请，等待审批'
          : '申请已提交'
      onSubmitted?.(msg)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.35)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 80,
      }}
      onClick={onClose}
    >
      <div
        className="bb-card"
        style={{ width: 420, maxWidth: '92vw', padding: 16, display: 'grid', gap: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 600 }}>申请访问 · {slug}</div>
        <div style={{ fontSize: 12, color: 'var(--bb-muted)' }}>当前级别：{accessLevel}</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {accessLevel === 'L3' ? (
            <label style={{ fontSize: 13 }}>
              <input type="radio" checked={requestType === 'use'} onChange={() => setRequestType('use')} /> 使用授权
            </label>
          ) : null}
          {accessLevel === 'L2' ? (
            <label style={{ fontSize: 13 }}>
              <input type="radio" checked={requestType === 'download'} onChange={() => setRequestType('download')} /> 下载授权
            </label>
          ) : null}
        </div>
        <textarea
          className="bb-input"
          rows={4}
          placeholder="申请理由"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error ? <div style={{ color: '#b91c1c', fontSize: 12 }}>{error}</div> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="bb-btn" onClick={onClose}>取消</button>
          <button type="button" className="bb-btn bb-btn-primary" disabled={loading} onClick={() => void submit()}>
            {loading ? '提交中…' : '提交申请'}
          </button>
        </div>
      </div>
    </div>
  )
}
