import { useState, useRef, useEffect } from 'react'
import { Brain, ChevronDown } from 'lucide-react'
import type { ModelOption } from '../lib/types'
import { AVAILABLE_MODELS } from '../lib/types'

interface Props {
  selectedId: string
  onChange: (model: ModelOption) => void
}

export function ModelSelector({ selectedId, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = AVAILABLE_MODELS.find((m) => m.id === selectedId) || AVAILABLE_MODELS[0]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--bg-input)', cursor: 'pointer',
          fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)',
        }}
      >
        <Brain size={13} />
        <span>{selected.name}</span>
        <ChevronDown size={11} style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0,
          marginBottom: 4, minWidth: 220,
          background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          zIndex: 30, overflow: 'hidden',
        }}>
          {AVAILABLE_MODELS.map((model) => {
            const isActive = model.id === selectedId
            return (
              <button
                key={model.id}
                onClick={() => { onChange(model); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', border: 'none',
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {model.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    {model.description}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
