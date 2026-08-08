import { MessageCircle, Wand2, ListChecks, Palette } from 'lucide-react'
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
  return (
    <div style={{
      display: 'flex', gap: 4, padding: '4px',
      background: 'var(--bg-input)', borderRadius: 8,
    }}>
      {MODES.map((m) => {
        const isActive = mode === m.id
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            title={m.hint}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 6, border: 'none',
              background: isActive ? '#fff' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: isActive ? 600 : 400, cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              transition: 'all .15s ease',
            }}
          >
            <m.icon size={14} />
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
