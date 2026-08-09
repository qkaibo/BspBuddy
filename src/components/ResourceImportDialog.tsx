import { X, ChevronDown } from 'lucide-react'

interface ImportSourceOption {
  value: string
  label: string
}

export interface ImportChoiceItem {
  id: string
  label: string
}

interface Props {
  open: boolean
  loading: boolean
  icon: React.ReactNode
  title: string
  sourcePlaceholder: string
  sources: ImportSourceOption[]
  sourceId: string
  itemsLabel: string
  items: ImportChoiceItem[]
  selectedIds: string[]
  emptyText: string
  note: string
  submitText?: string
  onSourceChange: (value: string) => void
  onSelectedChange: (ids: string[]) => void
  onClose: () => void
  onSubmit: () => void
}

export function ResourceImportDialog({
  open, loading, icon, title, sourcePlaceholder, sources, sourceId,
  itemsLabel, items, selectedIds, emptyText, note, submitText,
  onSourceChange, onSelectedChange, onClose, onSubmit,
}: Props) {
  if (!open) return null

  const toggleItem = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectedChange(selectedIds.filter((s) => s !== id))
    } else {
      onSelectedChange([...selectedIds, id])
    }
  }

  const s: Record<string, React.CSSProperties> = {
    overlay: {
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    dialog: {
      width: 480, maxWidth: '90vw', maxHeight: '80vh',
      background: 'var(--bg-card)', borderRadius: 12,
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 20px', borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    },
    title: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 },
    body: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 },
    sectionLabel: { fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 },
    selectWrap: { position: 'relative' as const },
    select: {
      width: '100%', padding: '6px 24px 6px 8px', borderRadius: 6, border: '1px solid var(--border)',
      fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)',
      appearance: 'none', cursor: 'pointer',
    },
    chevron: { position: 'absolute' as const, right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' as const, color: 'var(--text-tertiary)' },
    listWrap: { maxHeight: 300, overflowY: 'auto', borderRadius: 6, border: '1px solid var(--border)' },
    checkboxRow: {
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
      fontSize: 11, color: 'var(--text-primary)', cursor: 'pointer',
      borderBottom: '1px solid var(--border)',
    },
    checkbox: { width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--accent)' },
    empty: { textAlign: 'center' as const, padding: '20px 0', fontSize: 11, color: 'var(--text-tertiary)' },
    note: { fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 },
    footer: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, gap: 8,
    },
    cancelBtn: {
      padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)',
      background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
      color: 'var(--text-secondary)',
    },
    submitBtn: {
      padding: '6px 20px', borderRadius: 6, border: 'none',
      background: 'var(--accent)', color: '#fff', cursor: loading ? 'wait' : 'pointer',
      fontSize: 12, fontFamily: 'inherit', opacity: loading ? 0.6 : 1,
    },
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>{icon}{title}</span>
          <button style={s.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <div style={s.body}>
          {/* Source Select */}
          <div>
            <div style={s.sectionLabel}>复制来源</div>
            <div style={s.selectWrap}>
              <select
                value={sourceId}
                onChange={(e) => onSourceChange(e.target.value)}
                style={s.select as React.CSSProperties}
              >
                <option value="">{sourcePlaceholder}</option>
                {sources.map((src) => (
                  <option key={src.value} value={src.value}>{src.label}</option>
                ))}
              </select>
              <ChevronDown size={12} style={s.chevron} />
            </div>
          </div>

          {/* Selectable Items */}
          <div>
            <div style={s.sectionLabel}>{itemsLabel}</div>
            <div style={s.listWrap}>
              {items.length === 0 ? (
                <div style={s.empty}>{emptyText}</div>
              ) : (
                items.map((item) => {
                  const checked = selectedIds.includes(item.id)
                  return (
                    <div
                      key={item.id}
                      style={{ ...s.checkboxRow, background: checked ? 'var(--accent-light)' : 'transparent' }}
                      onClick={() => toggleItem(item.id)}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        style={s.checkbox}
                      />
                      <span>{item.label}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Note */}
          {note && <div style={s.note}>{note}</div>}
        </div>

        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose} disabled={loading}>取消</button>
          <button style={s.submitBtn} onClick={onSubmit} disabled={loading || selectedIds.length === 0}>
            {submitText || '复制'}
          </button>
        </div>
      </div>
    </div>
  )
}
