// ============================================================
// ExpertModelCatalogPanel — admin-only expert model catalog management
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, ArrowLeft, Server, RefreshCw, Star } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { ExpertModelCatalogEntry, ExpertModelCatalogCreateParams, ExpertModelCatalogUpdateParams } from '../lib/expert-model-types'

const ipc = createIpcClient()

interface Props {
  onBack: () => void
}

export function ExpertModelCatalogPanel({ onBack }: Props) {
  const [entries, setEntries] = useState<ExpertModelCatalogEntry[]>([])
  const [editing, setEditing] = useState<ExpertModelCatalogEntry | null>(null)
  const [adding, setAdding] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; output: string | null } | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [temperature, setTemperature] = useState(0.2)
  const [maxTokens, setMaxTokens] = useState(8192)

  const load = useCallback(async () => {
    const list = await ipc.invoke(IPC_CHANNELS.EXPERT_MODEL_CATALOG_LIST) as ExpertModelCatalogEntry[]
    setEntries(Array.isArray(list) ? list : [])
  }, [])

  useEffect(() => { void load() }, [load])

  function resetForm() {
    setName('')
    setBaseUrl('')
    setApiKey('')
    setModel('')
    setTemperature(0.2)
    setMaxTokens(8192)
    setAdding(false)
    setEditing(null)
    setErrorMsg('')
  }

  function startEdit(entry: ExpertModelCatalogEntry) {
    setEditing(entry)
    setName(entry.name)
    setBaseUrl(entry.base_url || '')
    setApiKey('')
    setModel(entry.model)
    setTemperature(entry.temperature)
    setMaxTokens(entry.max_output_tokens)
    setAdding(false)
    setErrorMsg('')
  }

  async function handleSave() {
    setErrorMsg('')
    if (!name.trim() || !model.trim()) {
      setErrorMsg('名称和模型为必填项')
      return
    }
    try {
      if (editing) {
        const params: ExpertModelCatalogUpdateParams = { name, base_url: baseUrl || undefined, model }
        if (apiKey) { params.api_key = apiKey }
        params.temperature = temperature
        params.max_output_tokens = maxTokens
        await ipc.invoke(IPC_CHANNELS.EXPERT_MODEL_CATALOG_UPDATE, editing.id, params)
      } else {
        if (!apiKey) {
          setErrorMsg('API Key 为必填项')
          return
        }
        const params: ExpertModelCatalogCreateParams = {
          name, base_url: baseUrl || undefined, api_key: apiKey, model, temperature, max_output_tokens: maxTokens,
        }
        await ipc.invoke(IPC_CHANNELS.EXPERT_MODEL_CATALOG_CREATE, params)
      }
      resetForm()
      await load()
    } catch (err: any) {
      setErrorMsg(err?.message || String(err))
    }
  }

  async function handleDelete(id: string) {
    setErrorMsg('')
    try {
      await ipc.invoke(IPC_CHANNELS.EXPERT_MODEL_CATALOG_DELETE, id)
      await load()
    } catch (err: any) {
      setErrorMsg(err?.message || String(err))
    }
  }

  async function handleToggle(entry: ExpertModelCatalogEntry) {
    setErrorMsg('')
    try {
      await ipc.invoke(IPC_CHANNELS.EXPERT_MODEL_CATALOG_UPDATE, entry.id, { enabled: !entry.enabled })
      await load()
    } catch (err: any) {
      setErrorMsg(err?.message || String(err))
    }
  }

  async function handleTest(entry: ExpertModelCatalogEntry) {
    setTestingId(entry.id)
    setTestResult(null)
    setErrorMsg('')
    try {
      const result = await ipc.invoke(IPC_CHANNELS.EXPERT_MODEL_CATALOG_TEST, entry.id) as { success: boolean; message: string; output: string | null }
      setTestResult(result)
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || String(err), output: null })
    } finally {
      setTestingId(null)
    }
  }

  async function handleSetDefault(entry: ExpertModelCatalogEntry) {
    setErrorMsg('')
    // Can't un-default the only enabled entry
    const enabledCount = entries.filter(e => e.enabled).length
    if (entry.is_default && enabledCount <= 1) {
      setErrorMsg('至少需要一个默认模型')
      return
    }
    try {
      await ipc.invoke(IPC_CHANNELS.EXPERT_MODEL_CATALOG_UPDATE, entry.id, { is_default: !entry.is_default })
      await load()
    } catch (err: any) {
      setErrorMsg(err?.message || String(err))
    }
  }

  const showForm = adding || !!editing
  const isNew = adding

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'inherit' }}
        >
          <ArrowLeft size={14} /> 返回设置
        </button>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, flex: 1 }}>专家模型目录</h2>
        {!showForm && (
          <button
            onClick={() => {
              resetForm()
              setAdding(true)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px',
              borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)',
              cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)',
            }}
          >
            <Plus size={14} /> 添加
          </button>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
        管理员在此处维护专家模型目录。专家未指定模型时，自动使用标记为「默认」的模型。
        点击星标设置默认模型，每租户最多一个默认。费用归属于各条目配置的 API key 账户。
      </p>

      {showForm && (
        <div style={{
          padding: 16, borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-card)', marginBottom: 20,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>
            {isNew ? '新增模型' : '编辑模型'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input label="名称" value={name} onChange={setName} placeholder="如：生产 GPT-4o" />
            <Input label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://api.openai.com/v1" />
            <Input label="API Key" value={apiKey} onChange={setApiKey} placeholder={isNew ? 'sk-...' : '留空不修改'} type="password" />
            <Input label="模型" value={model} onChange={setModel} placeholder="gpt-4o" />
            <div>
              <label style={labelStyle}>Temperature</label>
              <input type="number" value={temperature} onChange={e => setTemperature(Number(e.target.value))}
                min={0} max={2} step={0.1} style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Max Output Tokens</label>
              <input type="number" value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))}
                min={1} max={128000} style={inputStyle}
              />
            </div>
          </div>

          {errorMsg && (
            <div style={{ fontSize: 12, color: '#e53e3e', marginTop: 8, padding: '6px 0' }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={resetForm}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--text-secondary)' }}
            >取消</button>
            <button onClick={() => { handleSave().catch(() => { /* error shown in state */ }) }}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
            >{isNew ? '创建' : '保存'}</button>
          </div>
        </div>
      )}

      {/* Global error bar */}
      {errorMsg && !showForm && (
        <div style={{ fontSize: 12, color: '#e53e3e', background: 'var(--bg-card)', border: '1px solid #e53e3e33', borderRadius: 6, padding: '8px 14px', marginBottom: 12 }}>
          {errorMsg}
        </div>
      )}

      {entries.length === 0 && !showForm && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
          暂无专家模型。点击「添加」配置第一个模型。
        </div>
      )}

      {entries.map((entry) => (
        <div key={entry.id} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', borderRadius: 8,
          marginBottom: 8,
          opacity: entry.enabled ? 1 : 0.55,
          ...(entry.is_default
            ? {
                border: '2px solid #f59e0b',
                background: 'linear-gradient(135deg, rgba(245,158,11,.06) 0%, var(--bg-card) 40%)',
                boxShadow: '0 0 0 1px rgba(245,158,11,.15)',
              }
            : {
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
              }),
        }}>
          {entry.is_default
            ? <Star size={18} style={{ color: '#f59e0b', flexShrink: 0 }} fill="#f59e0b" />
            : <Server size={16} style={{ color: entry.enabled ? 'var(--text-secondary)' : 'var(--text-muted)', flexShrink: 0 }} />
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {entry.name}
              {entry.is_default && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#f59e0b',
                  background: 'rgba(245,158,11,.15)', borderRadius: 4,
                  padding: '2px 8px', letterSpacing: '0.03em',
                }}>★ 默认</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {entry.model} · {entry.provider} · {entry.api_protocol}
              {entry.base_url ? ` · ${entry.base_url}` : ''}
            </div>
          </div>
          <button
            onClick={() => { handleTest(entry).catch(() => {}) }}
            title="测试连接"
            disabled={testingId === entry.id}
            style={{ display: 'flex', alignItems: 'center', padding: 4, background: 'none', border: 'none', cursor: testingId === entry.id ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)', opacity: testingId === entry.id ? 0.5 : 1 }}
          >
            <RefreshCw size={14} style={testingId === entry.id ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
          <button
            onClick={() => { handleSetDefault(entry).catch(() => {}) }}
            title={entry.is_default ? '取消默认' : '设为默认'}
            style={{ display: 'flex', alignItems: 'center', padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: entry.is_default ? '#f59e0b' : 'var(--text-secondary)' }}
          >
            <Star size={14} fill={entry.is_default ? '#f59e0b' : 'none'} />
          </button>
          <button
            onClick={() => { handleToggle(entry).catch(() => {}) }}
            title={entry.enabled ? '停用' : '启用'}
            style={{ display: 'flex', alignItems: 'center', padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            {entry.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            onClick={() => startEdit(entry)}
            title="编辑"
            style={{ display: 'flex', alignItems: 'center', padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => { if (confirm('确定删除此模型？')) { handleDelete(entry.id).catch(() => {}) } }}
            title="删除"
            style={{ display: 'flex', alignItems: 'center', padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#e53e3e' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {testResult && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--radius-md)', background: testResult.success ? 'rgba(22,163,74,.06)' : 'rgba(220,38,38,.06)', border: `1px solid ${testResult.success ? 'rgba(22,163,74,.2)' : 'rgba(220,38,38,.2)'}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: testResult.success ? '#16a34a' : '#dc2626' }}>
            {testResult.success ? '✅' : '❌'} {testResult.message}
          </div>
          {testResult.output && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: 60, overflow: 'hidden' }}>
              模型输出: {testResult.output}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', borderRadius: 5,
  border: '1px solid var(--border)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
  boxSizing: 'border-box',
}

function Input({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={inputStyle}
      />
    </div>
  )
}
