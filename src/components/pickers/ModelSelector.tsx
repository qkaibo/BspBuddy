import { useState, useMemo } from 'react'
import { Search, ExternalLink } from 'lucide-react'
import type { ModelSummary } from './types'

const FALLBACK_MODELS: ModelSummary[] = [
  { id: '1', name: 'DeepSeek Chat', model: 'deepseek-chat', provider: 'openai', enabled: true, isDefault: true },
  { id: '2', name: '腾讯混元', model: 'hunyuan', provider: 'openai', enabled: true, isDefault: false },
  { id: '3', name: '智谱 GLM-4', model: 'glm-4', provider: 'openai', enabled: false, isDefault: false },
  { id: '4', name: 'Kimi', model: 'kimi', provider: 'openai', enabled: true, isDefault: false },
]

interface Props {
  modelId?: string
  temperature?: number
  maxTokens?: number
  onChange: (data: { modelId?: string; temperature?: number; maxTokens?: number }) => void
}

export function ModelSelector({ modelId, temperature = 0.7, maxTokens = 8192, onChange }: Props) {
  const [useCustom, setUseCustom] = useState(!!modelId)
  const [search, setSearch] = useState('')
  const [models] = useState<ModelSummary[]>(FALLBACK_MODELS)

  const selectedModel = models.find((m) => m.id === modelId)

  const filtered = useMemo(() => {
    if (!search.trim()) return models
    const q = search.toLowerCase()
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q)
    )
  }, [search, models])

  function handleModeChange(custom: boolean) {
    setUseCustom(custom)
    if (!custom) {
      onChange({ modelId: undefined, temperature, maxTokens })
    }
  }

  function handleModelSelect(id: string) {
    onChange({ modelId: id, temperature, maxTokens })
  }

  function handleTempChange(value: number) {
    onChange({ modelId: useCustom ? modelId : undefined, temperature: value, maxTokens })
  }

  function handleMaxTokensChange(value: number) {
    const clamped = Math.max(1, value)
    onChange({ modelId: useCustom ? modelId : undefined, temperature, maxTokens: clamped })
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
        选择模型
      </div>

      {/* Radio: global default */}
      <label
        onClick={() => handleModeChange(false)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 12px', borderRadius: 8,
          background: !useCustom ? 'var(--bg-hover)' : 'transparent',
          border: `1px solid ${!useCustom ? 'var(--accent)' : 'var(--border)'}`,
          cursor: 'pointer', marginBottom: 8, transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <span style={{
          width: 16, height: 16, borderRadius: '50%',
          border: `2px solid ${!useCustom ? 'var(--accent)' : 'var(--border)'}`,
          background: !useCustom ? 'var(--accent)' : 'transparent',
          flexShrink: 0, marginTop: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {!useCustom && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
        </span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
            全局默认（不指定模型）
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            使用系统全局默认模型配置
          </div>
        </div>
      </label>

      {/* Radio: custom model */}
      <label
        onClick={() => handleModeChange(true)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 12px', borderRadius: 8,
          background: useCustom ? 'var(--bg-hover)' : 'transparent',
          border: `1px solid ${useCustom ? 'var(--accent)' : 'var(--border)'}`,
          cursor: 'pointer', marginBottom: 16, transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <span style={{
          width: 16, height: 16, borderRadius: '50%',
          border: `2px solid ${useCustom ? 'var(--accent)' : 'var(--border)'}`,
          background: useCustom ? 'var(--accent)' : 'transparent',
          flexShrink: 0, marginTop: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {useCustom && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
        </span>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>指定模型</div>
      </label>

      {/* Custom model selection */}
      {useCustom && (
        <div style={{ marginLeft: 26 }}>
          {/* Search input */}
          <div style={{ marginBottom: 8, position: 'relative' }}>
            <Search size={12} style={{
              position: 'absolute', left: 8, top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-tertiary)',
            }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              name="model-search"
              aria-label="搜索模型"
              placeholder="搜索模型…"
              style={{
                width: '100%', padding: '6px 10px 6px 26px',
                borderRadius: 6, border: '1px solid var(--border)',
                fontSize: 11, fontFamily: 'inherit',
                color: 'var(--text-primary)', background: 'var(--bg-input)',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>

          {/* Model list */}
          <div style={{
            maxHeight: 140, overflowY: 'auto',
            border: '1px solid var(--border)', borderRadius: 6,
            marginBottom: 16,
          }}>
            {filtered.map((m) => {
              const isSelected = modelId === m.id
              return (
                <div
                  key={m.id}
                  onClick={() => handleModelSelect(m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 10px', cursor: 'pointer',
                    background: isSelected ? 'var(--bg-hover)' : 'transparent',
                    opacity: m.enabled ? 1 : 0.5,
                    fontSize: 11,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />}
                  </span>
                  <span style={{ flex: 1, color: 'var(--text-primary)' }}>{m.name}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{m.model}</span>
                  <span style={{
                    padding: '1px 4px', borderRadius: 3, fontSize: 9,
                    background: m.enabled ? 'var(--success-bg)' : 'var(--bg-input)',
                    color: m.enabled ? 'var(--success)' : 'var(--text-tertiary)',
                  }}>
                    {m.enabled ? '已启用' : '已停用'}
                  </span>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                未找到匹配的模型
              </div>
            )}
          </div>

          {/* Temperature slider */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>温度</label>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                {temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => handleTempChange(parseFloat(e.target.value))}
              style={{
                width: '100%', height: 4, borderRadius: 2,
                accentColor: 'var(--accent)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
              <span>0.0</span>
              <span>2.0</span>
            </div>
          </div>

          {/* Max tokens */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              最大 Token
            </label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => handleMaxTokensChange(parseInt(e.target.value) || 0)}
              min={1}
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 6,
                border: '1px solid var(--border)',
                fontSize: 12, fontFamily: 'inherit',
                color: 'var(--text-primary)', background: 'var(--bg-input)',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>
        </div>
      )}

      {/* Navigate to model management */}
      <button
        onClick={() => console.log('Navigate to model management panel')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          width: '100%', padding: '7px 0', borderRadius: 6,
          border: '1px solid var(--border)', background: 'transparent',
          cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
          color: 'var(--text-secondary)',
        }}
      >
        <ExternalLink size={11} />
        去模型管理面板
      </button>
    </div>
  )
}
