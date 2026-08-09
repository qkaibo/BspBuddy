import { useState, useRef, useEffect } from 'react'
import { Shield, ChevronDown, ShieldOff } from 'lucide-react'
import { PermissionConfirmModal } from './PermissionConfirmModal'
import type { PermissionMode } from '../lib/types'

interface Props {
  mode: PermissionMode
  onChange: (mode: PermissionMode) => void
}

export function PermissionSelector({ mode, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [showSwitchModal, setShowSwitchModal] = useState(false)
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

  const handleSelect = (selectedMode: PermissionMode) => {
    setOpen(false)
    if (selectedMode === 'full_access' && mode === 'default') {
      setShowSwitchModal(true)
    } else if (selectedMode === 'default') {
      onChange('default')
    }
  }

  const handleConfirmFullAccess = () => {
    setShowSwitchModal(false)
    onChange('full_access')
  }

  const handleCancelSwitch = () => {
    setShowSwitchModal(false)
  }

  const isDefault = mode === 'default'

  return (
    <>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          title={isDefault ? '默认权限：高风险操作需要确认' : '完全访问权限：无二次确认（用完即关）'}
          aria-label={isDefault ? '权限：默认权限' : '权限：完全访问'}
          aria-haspopup="menu"
          aria-expanded={open}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: isDefault ? 'var(--bg-input)' : 'rgba(239,68,68,0.08)',
            border: isDefault ? '1px solid var(--border)' : '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius-md)', padding: '4px 10px',
            cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
            color: isDefault ? 'var(--text-secondary)' : '#ef4444',
            whiteSpace: 'nowrap', transition: 'background .15s ease, color .15s ease, border-color .15s ease',
          }}
        >
          {isDefault ? (
            <Shield size={12} aria-hidden="true" />
          ) : (
            <ShieldOff size={12} aria-hidden="true" />
          )}
          <span>{isDefault ? '默认权限' : '完全访问'}</span>
          <ChevronDown
            size={10}
            aria-hidden="true"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}
          />
        </button>

        {open && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
            background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)', minWidth: 180,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 100,
            overflow: 'hidden', padding: 4,
          }}>
            <DropdownOption
              label="默认权限"
              description="高风险操作需要确认"
              icon={<Shield size={13} />}
              active={mode === 'default'}
              color="var(--text-primary)"
              onClick={() => handleSelect('default')}
            />
            <DropdownOption
              label="完全访问权限"
              description="无二次确认 · 用完即关"
              icon={<ShieldOff size={13} />}
              active={mode === 'full_access'}
              color="#ef4444"
              onClick={() => handleSelect('full_access')}
            />
          </div>
        )}
      </div>

      {showSwitchModal && (
        <PermissionConfirmModal
          type="mode-switch"
          onConfirm={handleConfirmFullAccess}
          onCancel={handleCancelSwitch}
        />
      )}
    </>
  )
}

function DropdownOption({
  label, description, icon, active, color, onClick,
}: {
  label: string
  description: string
  icon: React.ReactNode
  active: boolean
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '8px 10px', background: active ? 'var(--bg-input)' : 'transparent',
        border: 'none', borderRadius: 6, cursor: 'pointer',
        fontFamily: 'inherit', textAlign: 'left',
      }}
    >
      <span style={{ color, display: 'flex' }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{description}</span>
      </div>
      {active && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: color, flexShrink: 0,
        }} />
      )}
    </button>
  )
}
