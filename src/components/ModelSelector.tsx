import { useState, useRef, useEffect } from 'react'
import { Brain, ChevronDown, Lock, Globe, Monitor } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS, AVAILABLE_MODELS } from '../lib/types'
import type { ModelOption, ModelConfigItem } from '../lib/types'
import { isElectronDesktop } from '../lib/capabilities'

const ipc = createIpcClient()

interface Props {
  selectedId: string
  onChange: (model: ModelOption) => void
}

function modelConfigToOption(config: ModelConfigItem, source: 'local' | 'cloud' = 'cloud'): ModelOption {
  return {
    id: config.id,
    name: config.name,
    provider: config.provider || config.model,
    description: `${config.model} · ${config.api_protocol}`,
    source,
  }
}

function SourceBadge({ source }: { source?: 'local' | 'cloud' }) {
  if (source === 'local') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, color: 'var(--color-info, #2563eb)', fontWeight: 500 }}>
        <Lock size={9} /> 本机
      </span>
    )
  }
  if (source === 'cloud') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 500 }}>
        <Globe size={9} /> 云端
      </span>
    )
  }
  return null
}

function GroupLabel({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div style={{
      padding: '4px 14px', fontSize: 10, fontWeight: 600,
      color: 'var(--text-tertiary)', textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', gap: 4,
      borderBottom: '1px solid var(--border)',
    }}>
      {icon} {label}
    </div>
  )
}

export function ModelSelector({ selectedId, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [backendModels, setBackendModels] = useState<ModelOption[]>([])
  const [localModels, setLocalModels] = useState<ModelOption[]>([])
  const showLocalOption = isElectronDesktop()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        try {
          const configs = await ipc.invoke(IPC_CHANNELS.MODEL_CONFIG_LIST) as ModelConfigItem[]
          if (!cancelled && Array.isArray(configs) && configs.length > 0) {
            const enabled = configs.filter(c => c.enabled)
            setBackendModels(enabled.map(c => modelConfigToOption(c, 'cloud')))
          }
        } catch {
          // Backend may not be ready
        }

        if (showLocalOption) {
          try {
            const locals = await ipc.invoke(IPC_CHANNELS.MODEL_CONFIG_LOCAL_LIST) as Array<{
              id: string; name: string; model: string; api_protocol: string
              enabled: boolean; base_url: string
            }>
            if (!cancelled && Array.isArray(locals) && locals.length > 0) {
              const enabled = locals.filter(l => l.enabled)
              setLocalModels(enabled.map(l => ({
                id: l.id,
                name: l.name,
                provider: l.model,
                description: `${l.model} · ${l.api_protocol} · 直连`,
                source: 'local' as const,
              })))
            }
          } catch {
            // Local storage not available
          }
        }
      } catch {
        // Silently fail
      }
    }
    load()
    return () => { cancelled = true }
  }, [showLocalOption])

  // Merge: local models first, then cloud models. No hardcoded fallback on desktop.
  const allModels = [...localModels, ...backendModels]
  const models = allModels.length > 0 ? allModels : (showLocalOption ? [] : AVAILABLE_MODELS)
  const selected = models.find((m) => m.id === selectedId) || models[0]

  const hasLocal = localModels.length > 0
  const hasCloud = backendModels.length > 0

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="选择模型"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--bg-input)', cursor: 'pointer',
          fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)',
        }}
      >
        <Brain size={13} aria-hidden="true" />
        <span>{selected?.name || '选择模型'}</span>
        {selected?.source && <SourceBadge source={selected.source} />}
        <ChevronDown size={11} aria-hidden="true" style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0,
          marginBottom: 4, minWidth: 280,
          background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          zIndex: 30, overflow: 'hidden',
        }}>
          {/* Local group */}
          {hasLocal && <GroupLabel label="本机模型" icon={<Monitor size={10} />} />}
          {hasLocal && localModels.map((model) => renderOption(model, selectedId, onChange, setOpen))}

          {/* Cloud group */}
          {hasCloud && <GroupLabel label="云端模型" icon={<Globe size={10} />} />}
          {hasCloud && backendModels.map((model) => renderOption(model, selectedId, onChange, setOpen))}

          {/* Fallback: hardcoded models only on web */}
          {!hasLocal && !hasCloud && !showLocalOption && AVAILABLE_MODELS.map((model) => renderOption(model, selectedId, onChange, setOpen))}

          {models.length === 0 && (
            <div style={{ padding: 12, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              暂无可用模型，请先在设置中添加
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function renderOption(
  model: ModelOption,
  selectedId: string,
  onChange: (model: ModelOption) => void,
  setOpen: (v: boolean) => void,
) {
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
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>
            {model.name}
          </span>
          {model.source && <SourceBadge source={model.source} />}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
          {model.description}
        </div>
      </div>
    </button>
  )
}
