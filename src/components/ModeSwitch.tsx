import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Wand2, ListChecks, Palette, ChevronDown } from 'lucide-react'
import type { AgentMode } from '../lib/types'

interface Props {
  mode: AgentMode
  onChange: (mode: AgentMode) => void
}

const MODES: { id: AgentMode; label: string; icon: typeof MessageCircle; hint: string }[] = [
  { id: 'ask', label: '问一问', icon: MessageCircle, hint: '仅问答、咨询、建议' },
  { id: 'craft', label: '做一做', icon: Wand2, hint: '直接执行任务、生成产物' },
  { id: 'plan', label: '想一想', icon: ListChecks, hint: '生成执行计划，确认后执行' },
  { id: 'design', label: '设计', icon: Palette, hint: 'Ardot 画布生成设计稿' },
]

export function ModeSwitch({ mode, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = MODES.find((m) => m.id === mode) || MODES[0]
  const Icon = current.icon

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={current.hint}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', borderRadius: 6,
          background: 'var(--bg-input)', border: '1px solid transparent',
          cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
          fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
      >
        <Icon size={14} />
        <span style={{ fontWeight: 500 }}>{current.label}</span>
        <ChevronDown size={10} style={{ opacity: 0.4 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', bottom: '100%', left: 0,
            marginBottom: 4,
            background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
            zIndex: 100, padding: '4px 0', minWidth: 180,
          }}
        >
          {MODES.map((m) => {
            const isActive = mode === m.id
            const ItemIcon = m.icon
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => { onChange(m.id); setOpen(false) }}
                title={m.hint}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', border: 'none',
                  background: isActive ? 'var(--bg-hover)' : 'none',
                  cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                  color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                  fontWeight: isActive ? 600 : 400, textAlign: 'left' as const,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'none' }}
              >
                <ItemIcon size={14} />
                <span style={{ flex: 1 }}>{m.label}</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{m.hint}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
