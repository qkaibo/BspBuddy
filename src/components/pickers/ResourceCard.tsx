import { useState } from 'react'
import { X } from 'lucide-react'
import type { ResourceSummary } from './types'
import { ConfirmDialog } from '../ConfirmDialog'

const STATUS_LABELS: Record<string, string> = {
  active: '已启用',
  published: '已发布',
  draft: '草稿',
  archived: '已停用',
  inactive: '未启用',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: 'var(--success-bg)', color: 'var(--success)' },
  published: { bg: 'var(--success-bg)', color: 'var(--success)' },
  draft: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  archived: { bg: 'var(--bg-input)', color: 'var(--text-tertiary)' },
  inactive: { bg: 'var(--bg-input)', color: 'var(--text-tertiary)' },
}

interface Props {
  resource: ResourceSummary
  onRemove: (id: string) => void
}

export function ResourceCard({ resource, onRemove }: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const status = resource.status || 'active'
  const colors = STATUS_COLORS[status] || STATUS_COLORS.active
  const label = STATUS_LABELS[status] || status

  return (
    <div style={{
      background: 'var(--bg-input)',
      borderRadius: 6,
      padding: '8px 10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: colors.color,
          flexShrink: 0,
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {resource.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            {resource.version && <span>v{resource.version}</span>}
            {resource.version && <span>·</span>}
            <span style={{
              padding: '1px 4px', borderRadius: 3, fontSize: 9,
              background: colors.bg, color: colors.color,
            }}>{label}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setConfirmRemove(true)}
        aria-label={`移除 ${resource.name}`}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-tertiary)', padding: 2,
          display: 'flex', alignItems: 'center',
        }}
      >
        <X size={13} aria-hidden="true" />
      </button>
      {confirmRemove && (
        <ConfirmDialog
          title="确认移除"
          message={`确定要从绑定列表移除「${resource.name}」吗？`}
          confirmLabel="确认移除"
          onConfirm={() => {
            setConfirmRemove(false)
            onRemove(resource.id)
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  )
}
