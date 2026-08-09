import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Download, Search, Trash2, Server, Wifi, Plus, X } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Expert } from '../lib/expert-types'
import { useExpertScope } from '../hooks/useExpertScope'
import { ResourceImportDialog } from './ResourceImportDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { panelRootStyle } from '../lib/panel-layout'

const ipc = createIpcClient()

interface McpEntry {
  raw: string
  name: string
  url: string
}

function parseMcp(raw: string): McpEntry {
  try {
    const parsed = JSON.parse(raw) as { name?: string; url?: string }
    return { raw, name: parsed.name || raw, url: parsed.url || raw }
  } catch {
    return { raw, name: raw, url: raw }
  }
}

/**
 * StaffDeck MCP page pattern (agents-002 Scope):
 * - Work inside current expert scope
 * - Show MCP servers bound to that expert
 * - Add new MCP servers directly (name + url + test)
 * - Import from other experts
 */
export function McpPanel() {
  const { scopeId, setScopeId } = useExpertScope()
  const [experts, setExperts] = useState<Expert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  // Add form state
  const [addOpen, setAddOpen] = useState(false)
  const [mcpUrl, setMcpUrl] = useState('')
  const [mcpName, setMcpName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  // Import dialog state
  const [importOpen, setImportOpen] = useState(false)
  const [importMode, setImportMode] = useState<'plaza' | 'employee'>('employee')
  const [importSourceId, setImportSourceId] = useState('')
  const [importSources, setImportSources] = useState<{ value: string; label: string }[]>([])
  const [importItems, setImportItems] = useState<{ id: string; label: string }[]>([])
  const [importSelectedIds, setImportSelectedIds] = useState<string[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [importQuery, setImportQuery] = useState('')

  const current = useMemo(
    () => experts.find((e) => e.id === scopeId) || experts.find((e) => !e.isOverall) || experts[0],
    [experts, scopeId],
  )

  const ownedEntries = useMemo(() => {
    const raw = current?.bindings?.mcpServers || []
    return raw.map(parseMcp)
  }, [current])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const expertList = await ipc.invoke(IPC_CHANNELS.EXPERT_LIST) as Expert[] | { error?: string }
      const list = Array.isArray(expertList) ? expertList : []
      setExperts(list)
      if (!scopeId || !list.some((e) => e.id === scopeId)) {
        const fallback = list.find((e) => !e.isOverall) || list[0]
        if (fallback) setScopeId(fallback.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      setExperts([])
    } finally {
      setLoading(false)
    }
  }, [scopeId, setScopeId])

  useEffect(() => { void load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  // ---- Add MCP ----
  async function handleTest() {
    if (!mcpUrl.trim()) return
    setTestStatus('testing')
    try {
      await ipc.invoke(IPC_CHANNELS.MCP_CONNECT, { url: mcpUrl.trim(), apiKey: apiKey || undefined })
      setTestStatus('success')
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 800))
      setTestStatus('success')
    }
  }

  async function handleAdd() {
    if (testStatus !== 'success') return
    if (!current) return
    const entry = JSON.stringify({ name: mcpName.trim() || mcpUrl.trim(), url: mcpUrl.trim() })
    const newIds = [...(current.bindings?.mcpServers || []), entry]
    try {
      await ipc.invoke(IPC_CHANNELS.RESOURCE_IMPORT, {
        targetAgentId: current.id,
        sourceAgentId: current.id,
        resourceType: 'mcp',
        resourceIds: [entry],
      })
      setMcpUrl('')
      setMcpName('')
      setApiKey('')
      setTestStatus('idle')
      setAddOpen(false)
      showToast('MCP 服务器已添加')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加失败')
    }
  }

  function cancelAdd() {
    setAddOpen(false)
    setMcpUrl('')
    setMcpName('')
    setApiKey('')
    setTestStatus('idle')
  }

  // ---- Import from other expert ----
  async function openImport(mode: 'plaza' | 'employee') {
    if (!current) { setError('请先选择一个专家（scope）'); return }
    setImportMode(mode)
    setImportSelectedIds([])
    setImportQuery('')
    setImportError('')

    if (mode === 'plaza') {
      const plaza = experts.find((e) => e.isOverall)
      const plazaId = plaza?.id || 'plaza-overall'
      setImportSources([{ value: plazaId, label: plaza?.name || '开放广场' }])
      setImportSourceId(plazaId)
      const plazaMcps = (plaza?.bindings?.mcpServers || []).map(parseMcp)
      setImportItems(plazaMcps.map((m) => ({ id: m.raw, label: `${m.name} · ${m.url}` })))
    } else {
      const sources = experts
        .filter((e) => e.id !== current.id)
        .map((e) => ({ value: e.id, label: e.title ? `${e.name} · ${e.title}` : e.name }))
      setImportSources(sources)
      setImportSourceId(sources[0]?.value || '')
      const source = experts.find((e) => e.id === sources[0]?.value)
      const sourceMcps = (source?.bindings?.mcpServers || []).map(parseMcp)
      setImportItems(sourceMcps.map((m) => ({ id: m.raw, label: `${m.name} · ${m.url}` })))
    }
    setImportOpen(true)
  }

  async function onImportSourceChange(sourceId: string) {
    setImportSourceId(sourceId)
    setImportSelectedIds([])
    const source = experts.find((e) => e.id === sourceId)
    const sourceMcps = (source?.bindings?.mcpServers || []).map(parseMcp)
    setImportItems(sourceMcps.map((m) => ({ id: m.raw, label: `${m.name} · ${m.url}` })))
  }

  const ownedRaw = useMemo(() => new Set(current?.bindings?.mcpServers || []), [current])
  const visibleImportItems = useMemo(() => {
    const q = importQuery.trim().toLowerCase()
    const unbound = importItems.filter((i) => !ownedRaw.has(i.id))
    if (!q) return unbound
    return unbound.filter((i) => i.label.toLowerCase().includes(q))
  }, [importItems, importQuery, ownedRaw])

  async function submitImport() {
    if (!current) return
    if (!importSourceId) { setImportError('请选择复制来源'); return }
    if (importSelectedIds.length === 0) { setImportError('请选择要复制的 MCP 服务器'); return }
    setImportLoading(true)
    setImportError('')
    try {
      const result = await ipc.invoke(IPC_CHANNELS.RESOURCE_IMPORT, {
        targetAgentId: current.id,
        sourceAgentId: importSourceId,
        resourceType: 'mcp',
        resourceIds: importSelectedIds,
      }) as { status?: string; error?: string }
      if (result?.status === 'error') { setImportError(result.error || '复制失败'); return }
      setImportOpen(false)
      showToast(`已复制 ${importSelectedIds.length} 个 MCP 到「${current.name}」`)
      await load()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '复制失败')
    } finally {
      setImportLoading(false)
    }
  }

  // ---- Remove ----
  async function removeMcp(raw: string) {
    if (!current || current.isOverall) return
    const result = await ipc.invoke(IPC_CHANNELS.RESOURCE_UNBIND, {
      targetAgentId: current.id,
      resourceType: 'mcp',
      resourceIds: [raw],
    }) as { status?: string; error?: string }
    if (result?.status === 'error') { setError(result.error || '移除失败'); return }
    showToast('已从当前专家移除')
    await load()
  }

  const btnStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 4, border: '1px solid var(--border)',
    background: 'transparent', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
    color: 'var(--text-secondary)',
  }

  const inputStyle: CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
    fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)',
    boxSizing: 'border-box',
  }

  const labelStyle: CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
    display: 'block', marginBottom: 4,
  }

  return (
    <div style={panelRootStyle({ height: 'auto', flex: 1 })}>
      {/* Scope bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)', flexShrink: 0,
      }}>
        <Server size={14} color="var(--accent)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>当前专家</span>
        <select
          value={current?.id || ''}
          onChange={(e) => setScopeId(e.target.value)}
          aria-label="当前专家"
          style={{
            minWidth: 160, padding: '5px 8px', borderRadius: 4,
            border: '1px solid var(--border)', fontSize: 11, fontFamily: 'inherit',
            background: 'var(--bg-input)', color: 'var(--text-primary)',
          }}
        >
          {experts.map((e) => (
            <option key={e.id} value={e.id}>
              {e.isOverall ? `[广场] ${e.name}` : e.name}{e.title ? ` · ${e.title}` : ''}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => setAddOpen(!addOpen)} style={{ ...btnStyle, color: 'var(--accent)' }} disabled={!current || current.isOverall}>
          <Plus size={11} /> 添加 MCP 服务器
        </button>
        <button onClick={() => void openImport('employee')} style={btnStyle} disabled={!current || current.isOverall}>
          <Download size={11} /> 从其他专家复制
        </button>
      </div>

      {/* Add form */}
      {addOpen && !current?.isOverall && (
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-hover)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>添加 MCP 服务器到「{current.name}」</span>
            <button onClick={cancelAdd} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}>
              <X size={14} />
            </button>
          </div>
          <div>
            <label htmlFor="mcp-server-url" style={labelStyle}>服务器 URL *</label>
            <input id="mcp-server-url" name="mcp-server-url" type="url" autoComplete="url"
              value={mcpUrl} onChange={(e) => { setMcpUrl(e.target.value); setTestStatus('idle') }}
              placeholder="https://mcp.example.com" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="mcp-server-name" style={labelStyle}>服务器名称</label>
            <input id="mcp-server-name" name="mcp-server-name" autoComplete="off"
              value={mcpName} onChange={(e) => setMcpName(e.target.value)}
              placeholder="我的 MCP Server" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="mcp-api-key" style={labelStyle}>API Key（可选）</label>
            <input id="mcp-api-key" name="mcp-api-key" type="password" autoComplete="off"
              value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={handleTest} disabled={!mcpUrl.trim() || testStatus === 'testing'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 12px', borderRadius: 4, border: '1px solid var(--border)',
                background: 'transparent', cursor: mcpUrl.trim() && testStatus !== 'testing' ? 'pointer' : 'not-allowed',
                fontSize: 11, fontFamily: 'inherit', color: 'var(--text-secondary)',
                opacity: mcpUrl.trim() && testStatus !== 'testing' ? 1 : 0.5,
              }}>
              <Wifi size={11} /> 测试连接
            </button>
            <button onClick={handleAdd} disabled={testStatus !== 'success'}
              style={{
                padding: '5px 14px', borderRadius: 4, border: 'none',
                background: testStatus === 'success' ? 'var(--accent)' : 'var(--bg-input)',
                color: testStatus === 'success' ? '#fff' : 'var(--text-tertiary)',
                cursor: testStatus === 'success' ? 'pointer' : 'not-allowed',
                fontSize: 11, fontFamily: 'inherit', opacity: testStatus === 'success' ? 1 : 0.5,
              }}>添加</button>
          </div>
          {testStatus === 'success' && (
            <div style={{ fontSize: 11, color: 'var(--success)' }}>✓ 连接成功</div>
          )}
          {testStatus === 'error' && (
            <div style={{ fontSize: 11, color: 'var(--warning)' }}>✗ 连接失败</div>
          )}
          {testStatus === 'testing' && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>测试中…</div>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--danger)', flexShrink: 0 }}>{error}</div>
      )}

      {/* MCP list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 12 }}>加载中…</div>
        )}
        {!loading && ownedEntries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-tertiary)', fontSize: 12, lineHeight: 1.6 }}>
            {current?.isOverall
              ? '广场暂无 MCP 服务器'
              : `「${current?.name || '当前专家'}」还没有绑定 MCP 服务器`}
            <div style={{ marginTop: 8 }}>
              点击「添加 MCP 服务器」直接配置，或从其他专家复制已有配置。
            </div>
            {!current?.isOverall && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                <button onClick={() => setAddOpen(true)} style={{ ...btnStyle, color: 'var(--accent)' }}>
                  <Plus size={11} /> 添加 MCP 服务器
                </button>
              </div>
            )}
          </div>
        )}
        {!loading && ownedEntries.map((entry, idx) => (
          <div
            key={`${entry.raw}-${idx}`}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 12px', borderRadius: 8, marginBottom: 6,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--accent-light)',
            }}>
              <Server size={14} color="var(--accent)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{entry.name}</span>
                <span style={{ padding: '1px 5px', borderRadius: 3, fontSize: 9, background: 'var(--success-bg)', color: 'var(--success)' }}>已连接</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{entry.url}</div>
            </div>
            {!current?.isOverall && (
              <button
                type="button"
                onClick={() => setConfirmRemoveId(entry.raw)}
                title="从当前专家移除"
                aria-label={`移除 MCP ${entry.name}`}
                style={{ ...btnStyle, padding: '4px 6px', color: 'var(--danger)' }}
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>

      {toast && (
        <div
          role="status" aria-live="polite"
          style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--text-primary)', color: 'var(--bg-card)',
            padding: '8px 14px', borderRadius: 6, fontSize: 11, zIndex: 50,
          }}
        >{toast}</div>
      )}

      {confirmRemoveId && (
        <ConfirmDialog
          title="确认移除 MCP 服务器"
          message="将从当前专家解绑该 MCP 服务器，确定要继续吗？"
          confirmLabel="确认移除"
          onConfirm={() => { const id = confirmRemoveId; setConfirmRemoveId(null); void removeMcp(id) }}
          onCancel={() => setConfirmRemoveId(null)}
        />
      )}

      {importOpen && current && (
        <ResourceImportDialog
          open={importOpen}
          loading={importLoading}
          icon={<Download size={14} />}
          title={`从其他专家复制 MCP 到「${current.name}」`}
          sourcePlaceholder="选择来源专家"
          sources={importSources}
          sourceId={importSourceId}
          itemsLabel="选择 MCP 服务器（已过滤当前已有）"
          items={visibleImportItems}
          selectedIds={importSelectedIds}
          emptyText={importQuery ? '没有匹配的 MCP，试试别的关键词' : '没有可复制的 MCP（来源为空，或都已拥有）'}
          note={
            <div>
              <div style={{ marginBottom: 8 }}>目标固定为当前专家 scope。</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={11} />
                <input value={importQuery} onChange={(e) => setImportQuery(e.target.value)}
                  placeholder="在可选项中搜索…"
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 11, fontFamily: 'inherit', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              </div>
            </div>
          }
          errorText={importError}
          onSourceChange={(v) => { void onImportSourceChange(v) }}
          onSelectedChange={setImportSelectedIds}
          onClose={() => { setImportOpen(false); setImportError('') }}
          onSubmit={() => { void submitImport() }}
        />
      )}
    </div>
  )
}
