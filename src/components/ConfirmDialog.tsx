import { AlertTriangle } from 'lucide-react'

interface Props {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

/** Reusable destructive-action confirm overlay (DataPanel pattern). */
export function ConfirmDialog({
  title = '确认删除',
  message,
  confirmLabel = '确认删除',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
  danger = true,
}: Props) {
  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,.4)',
        zIndex: 100,
        overscrollBehavior: 'contain',
      }}
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg, 16px)',
          padding: 24,
          maxWidth: 360,
          width: '90%',
          boxShadow: 'var(--shadow-xl, 0 8px 32px rgba(0,0,0,.1))',
          overscrollBehavior: 'contain',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {danger && <AlertTriangle size={18} color="var(--danger)" aria-hidden="true" />}
          <span
            id="confirm-dialog-title"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}
          >
            {title}
          </span>
        </div>
        <p
          id="confirm-dialog-desc"
          style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}
        >
          {message}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-sm, 8px)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-sm, 8px)',
              border: 'none',
              background: danger ? 'var(--danger)' : 'var(--accent)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
