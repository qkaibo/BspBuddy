// ============================================================
// ModelConfigSettings — 管理后台 AI 模型配置
// 支持桌面端「仅本机保存」+ Web/移动端仅后端
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Cpu, Plus, Check, X, RefreshCw, Wifi, WifiOff, Star, Trash2, ChevronDown, Lock, Globe } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type {
  ModelConfigItem,
  ModelConfigCreateParams,
  ModelConfigUpdateParams,
  ModelConfigTestResult,
} from '../lib/types'
import { PanelChrome } from './ui/PanelChrome'
import { isElectronDesktop } from '../lib/capabilities'

const ipc = createIpcClient()

// Local model config (only on Electron desktop)
interface LocalModelRow {
  id: string
  name: string
  api_protocol: string
  base_url: string
  api_key: string
  model: string
  temperature: number
  max_output_tokens: number
  is_default: boolean
  enabled: boolean
  storage_mode: 'local'
  scope: 'personal'
  api_key_masked: string
  source: 'local'
}

type UnifiedRow = ModelConfigItem | LocalModelRow

function isLocal(row: UnifiedRow): row is LocalModelRow {
  return (row as LocalModelRow).source === 'local'
}

interface Props {
  onBack: () => void
}

export function ModelConfigSettings({ onBack }: Props) {
  const [configs, setConfigs] = useState<UnifiedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<ModelConfigTestResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [localOnly, setLocalOnly] = useState(true) // 桌面端默认仅本机保存

  const showLocalOption = isElectronDesktop()

  const [form, setForm] = useState<ModelConfigCreateParams>({
    name: '',
    api_protocol: 'openai_chat_completions',
    base_url: '',
    api_key: '',
    model: '',
    temperature: 0.2,
    max_output_tokens: 8192,
  })

  const loadConfigs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const results: UnifiedRow[] = []

      // Load cloud models from backend
      try {
        const backendResult = await ipc.invoke(IPC_CHANNELS.MODEL_CONFIG_LIST) as ModelConfigItem[]
        if (Array.isArray(backendResult)) {
          results.push(...backendResult)
        }
      } catch {
        // Backend may not be ready — fall back silently
      }

      // Load local models (Electron desktop only)
      if (showLocalOption) {
        try {
          const localResult = await ipc.invoke(IPC_CHANNELS.MODEL_CONFIG_LOCAL_LIST) as LocalModelRow[]
          if (Array.isArray(localResult)) {
            const withMask = localResult.map(l => ({
              ...l,
              api_key_masked: l.api_key ? `sk-****${l.api_key.slice(-4)}` : '无Key',
              source: 'local' as const,
            }))
            results.push(...withMask)
          }
        } catch {
          // Local storage unavailable
        }
      }

      setConfigs(results)
    } catch (e) {
      setError('加载模型配置失败，请确认后端服务已启动')
      console.error('[ModelConfigSettings] load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [showLocalOption])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  const clearMessage = () => setActionMsg(null)

  const handleCreate = async () => {
    if (!form.name || !form.base_url || !form.api_key || !form.model) {
      setActionMsg('请填写名称、Base URL、API Key 和模型名')
      return
    }
    setBusy(true)
    setActionMsg(null)
    try {
      if (localOnly && showLocalOption) {
        // Save to local JSON file
        const localId = `local_${Date.now().toString(36)}`
        await ipc.invoke(IPC_CHANNELS.MODEL_CONFIG_LOCAL_SAVE, {
          id: localId,
          name: form.name,
          api_protocol: form.api_protocol,
          base_url: form.base_url,
          api_key: form.api_key,
          model: form.model,
          temperature: form.temperature ?? 0.2,
          max_output_tokens: form.max_output_tokens ?? 8192,
          is_default: configs.length === 0,
          enabled: true,
        })
        setActionMsg('模型配置已保存到本机，可直接测试和使用')
      } else {
        // Save to backend
        await ipc.invoke(IPC_CHANNELS.MODEL_CONFIG_CREATE, { ...form, storage_mode: 'cloud', scope: 'personal' })
        setActionMsg('模型配置已创建，请点击「测试连接」验证后启用')
      }
      setShowAddForm(false)
      setLocalOnly(false)
      setForm({ name: '', api_protocol: 'openai_chat_completions', base_url: '', api_key: '', model: '', temperature: 0.2, max_output_tokens: 8192 })
      await loadConfigs()
    } catch (e: any) {
      setActionMsg(`创建失败: ${e?.message || String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const handleTest = async (row: UnifiedRow) => {
    setTestingId(row.id)
    setTestResult(null)
    setActionMsg(null)
    try {
      if (isLocal(row)) {
        // Test local model via direct API call
        const result = await ipc.invoke(IPC_CHANNELS.MODEL_CONFIG_LOCAL_TEST, row.id) as { success: boolean; message: string; output: string | null }
        if (result.success) {
          setActionMsg('连接成功！（本机直连）')
        } else {
          setActionMsg(`测试失败: ${result.message}`)
        }
      } else {
        // Test cloud model via backend
        const hasEnabled = configs.some(c => !isLocal(c) && (c as ModelConfigItem).enabled)
        const result = await ipc.invoke(IPC_CHANNELS.MODEL_CONFIG_TEST, row.id, !hasEnabled) as ModelConfigTestResult
        setTestResult(result)
        if (result.success) {
          setActionMsg(result.activated ? '连接成功！已自动设为默认模型' : '连接成功！')
        } else {
          setActionMsg(`测试失败: ${result.message}`)
        }
        await loadConfigs()
      }
    } catch (e: any) {
      setActionMsg(`测试失败: ${e?.message || String(e)}`)
    } finally {
      setTestingId(null)
    }
  }

  const handleSetDefault = async (row: UnifiedRow) => {
    setBusy(true)
    setActionMsg(null)
    try {
      if (isLocal(row)) {
        await ipc.invoke(IPC_CHANNELS.MODEL_CONFIG_LOCAL_UPDATE, row.id, { is_default: true })
      } else {
        await ipc.invoke(IPC_CHANNELS.MODEL_CONFIG_SET_DEFAULT, row.id)
      }
      await loadConfigs()
      setActionMsg('已设为默认模型')
    } catch (e: any) {
      setActionMsg(`操作失败: ${e?.message || String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const handleToggleEnabled = async (row: UnifiedRow) => {
    setBusy(true)
    setActionMsg(null)
    try {
      if (isLocal(row)) {
        await ipc.invoke(IPC_CHANNELS.MODEL_CONFIG_LOCAL_UPDATE, row.id, { enabled: !row.enabled })
      } else {
        const params: ModelConfigUpdateParams = { enabled: !(row as ModelConfigItem).enabled }
        await ipc.invoke(IPC_CHANNELS.MODEL_CONFIG_UPDATE, row.id, params)
      }
      await loadConfigs()
      setActionMsg(row.enabled ? '已停用' : '已启用')
    } catch (e: any) {
      setActionMsg(`操作失败: ${e?.message || String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (row: UnifiedRow) => {
    setBusy(true)
    setActionMsg(null)
    try {
      if (isLocal(row)) {
        await ipc.invoke(IPC_CHANNELS.MODEL_CONFIG_LOCAL_DELETE, row.id)
      }
      // Cloud models: delete not implemented in current API; skip for now
      await loadConfigs()
      setActionMsg('已删除')
    } catch (e: any) {
      setActionMsg(`删除失败: ${e?.message || String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const trustLabel = (row: UnifiedRow) => {
    if (isLocal(row)) return { text: '本机', color: 'var(--color-info, #2563eb)' }
    const status = (row as ModelConfigItem).trust_status
    switch (status) {
      case 'verified': return { text: '已验证', color: 'var(--color-success, #16a34a)' }
      case 'legacy_trusted': return { text: '继承信任', color: 'var(--color-warning, #ca8a04)' }
      default: return { text: '未验证', color: 'var(--text-tertiary)' }
    }
  }

  const renderCard = (row: UnifiedRow) => {
    const trust = trustLabel(row)
    const isTesting = testingId === row.id
    const isActive = isLocal(row) ? row.enabled : (row as ModelConfigItem).enabled
    const isDefault = isLocal(row) ? row.is_default : (row as ModelConfigItem).is_default
    const apiProtocol = isLocal(row) ? row.api_protocol : (row as ModelConfigItem).api_protocol
    const baseUrl = isLocal(row) ? row.base_url : (row as ModelConfigItem).base_url
    const temperature = isLocal(row) ? row.temperature : (row as ModelConfigItem).temperature
    const maxTokens = isLocal(row) ? row.max_output_tokens : (row as ModelConfigItem).max_output_tokens
    const keyDisplay = isLocal(row) ? row.api_key_masked : (row as ModelConfigItem).api_key_masked

    return (
      <div
        key={row.id}
        style={{
          padding: 14, borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)', border: `1px solid ${isDefault ? 'var(--accent)' : 'var(--border)'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</span>
            {isDefault && (
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 600 }}>默认</span>
            )}
            <span title={isActive ? '已启用' : '已停用'} style={{ display: 'flex', alignItems: 'center' }}>
              {isActive ? <Wifi size={13} color="var(--color-success, #16a34a)" /> : <WifiOff size={13} color="var(--text-tertiary)" />}
            </span>
            <span style={{ fontSize: 10, color: trust.color }}>{trust.text}</span>
            {isLocal(row) && (
              <span title="仅本机保存" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--text-tertiary)' }}>
                <Lock size={10} /> 仅本机
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <IconBtn title="测试连接" onClick={() => handleTest(row)} disabled={isTesting || busy} icon={<RefreshCw size={12} />} spinning={isTesting} />
            {!isDefault && isActive && (
              <IconBtn title="设为默认" onClick={() => handleSetDefault(row)} disabled={busy} icon={<Star size={12} />} accent />
            )}
            <IconBtn title={isActive ? '停用' : '启用'} onClick={() => handleToggleEnabled(row)} disabled={busy} icon={isActive ? <X size={12} /> : <Check size={12} />} />
            {isLocal(row) && <IconBtn title="删除" onClick={() => handleDelete(row)} disabled={busy} icon={<Trash2 size={12} />} />}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
          <span>模型: <code style={{ fontSize: 10, color: 'var(--text-primary)' }}>{row.model}</code></span>
          <span>协议: <code style={{ fontSize: 10, color: 'var(--text-primary)' }}>{apiProtocol}</code></span>
          {baseUrl && <span>URL: <code style={{ fontSize: 10, color: 'var(--text-primary)' }}>{baseUrl}</code></span>}
          <span>温度: {temperature}</span>
          <span>Token: {maxTokens.toLocaleString()}</span>
          <span>Key: {keyDisplay}</span>
        </div>
      </div>
    )
  }

  return (
    <PanelChrome title="AI 模型配置" icon={<Cpu size={16} strokeWidth={1.75} />} onClose={onBack}>
      <div style={{ padding: '16px 0' }}>
        {actionMsg && (
          <div
            onClick={clearMessage}
            style={{
              marginBottom: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              background: actionMsg.includes('失败') ? 'rgba(220,38,38,.08)' : 'rgba(22,163,74,.08)',
              color: actionMsg.includes('失败') ? '#dc2626' : '#16a34a',
              fontSize: 12, cursor: 'pointer',
            }}
          >
            {actionMsg} <span style={{ fontSize: 10, opacity: 0.6 }}>(点击关闭)</span>
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cpu size={14} color="var(--text-secondary)" />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              已配置 <strong style={{ color: 'var(--text-primary)' }}>{configs.length}</strong> 个模型
              {configs.filter(c => isLocal(c) ? c.enabled : (c as ModelConfigItem).enabled).length > 0 && (
                <>，<strong style={{ color: 'var(--accent)' }}>{configs.filter(c => isLocal(c) ? c.enabled : (c as ModelConfigItem).enabled).length}</strong> 个已启用</>
              )}
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => { setShowAddForm(true); setEditingId(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--accent)', background: 'var(--accent-light)',
              color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Plus size={13} /> 添加模型
          </button>
        </div>

        {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>加载中...</div>}

        {error && !loading && (
          <div style={{ padding: 16, textAlign: 'center', borderRadius: 'var(--radius-sm)', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.15)' }}>
            <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{error}</p>
            <button type="button" onClick={loadConfigs} style={{ marginTop: 8, padding: '4px 12px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>重试</button>
          </div>
        )}

        {!loading && !error && configs.length === 0 && !showAddForm && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <Cpu size={32} color="var(--text-tertiary)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 4px' }}>尚未配置任何 AI 模型</p>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 16px' }}>添加模型后，在对话中即可选择使用</p>
            <button type="button" onClick={() => setShowAddForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Plus size={14} /> 添加第一个模型
            </button>
          </div>
        )}

        {showAddForm && (
          <div style={{ padding: 16, borderRadius: 'var(--radius-md)', marginBottom: 16, background: 'var(--bg-card)', border: '1px solid var(--accent)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {editingId ? '编辑模型配置' : '添加模型配置'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <FormField label="配置名称" required>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="如: DeepSeek 生产环境" style={inputStyle} />
              </FormField>
              <FormField label="协议">
                <select value={form.api_protocol} onChange={e => setForm(p => ({ ...p, api_protocol: e.target.value }))} style={inputStyle}>
                  <option value="openai_chat_completions">OpenAI Chat Completions</option>
                  <option value="anthropic_messages">Anthropic Messages</option>
                  <option value="gemini_generate_content">Gemini Generate Content</option>
                </select>
              </FormField>
              <FormField label="Base URL" required>
                <input type="text" value={form.base_url} onChange={e => setForm(p => ({ ...p, base_url: e.target.value }))} placeholder="https://api.deepseek.com/v1" style={inputStyle} />
              </FormField>
              <FormField label="API Key" required>
                <input type="password" value={form.api_key} onChange={e => setForm(p => ({ ...p, api_key: e.target.value }))} placeholder="sk-..." style={inputStyle} />
              </FormField>
              <FormField label="模型名" required>
                <input type="text" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} placeholder="deepseek-chat" style={inputStyle} />
              </FormField>
              <FormField label="Temperature">
                <input type="number" min={0} max={2} step={0.1} value={form.temperature} onChange={e => setForm(p => ({ ...p, temperature: Number(e.target.value) }))} style={inputStyle} />
              </FormField>
              <FormField label="最大输出 Token">
                <input type="number" min={1} step={1000} value={form.max_output_tokens} onChange={e => setForm(p => ({ ...p, max_output_tokens: Number(e.target.value) }))} style={inputStyle} />
              </FormField>
            </div>

            {/* Local-only checkbox (desktop only) */}
            {showLocalOption && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={localOnly} onChange={e => setLocalOnly(e.target.checked)} style={{ cursor: 'pointer' }} />
                <Lock size={12} />
                仅本机保存 — API Key 不上传后端，仅存本地文件
              </label>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowAddForm(false); setEditingId(null); setLocalOnly(false) }} disabled={busy} style={{ padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>取消</button>
              <button type="button" onClick={handleCreate} disabled={busy} style={{ padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? '保存中...' : localOnly ? '保存到本机' : '保存配置'}</button>
            </div>
          </div>
        )}

        {!loading && configs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {configs.map(renderCard)}
          </div>
        )}

        {testResult && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--radius-md)', background: testResult.success ? 'rgba(22,163,74,.06)' : 'rgba(220,38,38,.06)', border: `1px solid ${testResult.success ? 'rgba(22,163,74,.2)' : 'rgba(220,38,38,.2)'}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: testResult.success ? '#16a34a' : '#dc2626' }}>
              {testResult.success ? '测试通过' : '测试失败'} — {testResult.message}
            </div>
            {testResult.capabilities.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {testResult.capabilities.map((cap) => (
                  <span key={cap.id} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: cap.success ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.1)', color: cap.success ? '#16a34a' : '#dc2626' }}>
                    {cap.id} {cap.success ? '✓' : `✗ ${cap.error_code || ''}`}
                  </span>
                ))}
              </div>
            )}
            {testResult.output && <div style={{ fontSize: 10, color: 'var(--text-secondary)', maxHeight: 60, overflow: 'hidden' }}>模型回复: {testResult.output}</div>}
          </div>
        )}
      </div>
    </PanelChrome>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
      </span>
      {children}
    </label>
  )
}

function IconBtn({ title, onClick, disabled, icon, accent, spinning }: {
  title: string
  onClick: () => void
  disabled?: boolean
  icon: React.ReactNode
  accent?: boolean
  spinning?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: 4, border: 'none',
        background: accent ? 'var(--accent-light)' : 'transparent',
        color: accent ? 'var(--accent)' : 'var(--text-tertiary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {spinning ? (
        <span style={{ animation: 'spin .8s linear infinite', display: 'flex' }}>{icon}</span>
      ) : icon}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
  boxSizing: 'border-box', width: '100%',
}
