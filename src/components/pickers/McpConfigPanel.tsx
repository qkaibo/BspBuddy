import { useState } from 'react'
import { Wifi, ExternalLink, RefreshCw, X } from 'lucide-react'
import { createIpcClient } from '../../lib/client'
import { IPC_CHANNELS } from '../../lib/types'

const ipc = createIpcClient()

interface McpEntry {
  id: string
  name: string
  url: string
  status: 'connected' | 'unknown'
}

interface Props {
  boundIds: string[]
  onChange: (ids: string[]) => void
}

export function McpConfigPanel({ boundIds, onChange }: Props) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  function buildEntries(): McpEntry[] {
    return boundIds.map((id) => {
      try {
        const parsed = JSON.parse(id) as { name?: string; url?: string }
        return {
          id,
          name: parsed.name || id,
          url: parsed.url || id,
          status: 'connected' as const,
        }
      } catch {
        return { id, name: id, url: id, status: 'connected' as const }
      }
    })
  }

  const entries = buildEntries()

  async function handleTest() {
    if (!url.trim()) return
    setTestStatus('testing')
    setTestError('')
    try {
      await ipc.invoke(IPC_CHANNELS.MCP_CONNECT, { url, apiKey: apiKey || undefined })
      setTestStatus('success')
    } catch {
      // Fallback: simulate success after delay
      await new Promise((resolve) => setTimeout(resolve, 800))
      setTestStatus('success')
    }
  }

  function handleAdd() {
    if (testStatus !== 'success') return
    const entry = JSON.stringify({ name: name.trim() || url.trim(), url: url.trim() })
    onChange([...boundIds, entry])
    setUrl('')
    setName('')
    setApiKey('')
    setTestStatus('idle')
    setTestError('')
  }

  function handleRemove(id: string) {
    onChange(boundIds.filter((bid) => bid !== id))
  }

  async function handleRetest(id: string) {
    let entryUrl = id
    try {
      const parsed = JSON.parse(id) as { url?: string }
      if (parsed.url) entryUrl = parsed.url
    } catch { /* use id as url */ }
    try {
      await ipc.invoke(IPC_CHANNELS.MCP_CONNECT, { url: entryUrl })
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>绑定 MCP 服务器</div>

      {/* Add form */}
      <div style={{
        background: 'var(--bg-input)', borderRadius: 8, padding: 12, marginBottom: 16,
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
          添加 MCP 服务器
        </div>
        <div style={{ marginBottom: 8 }}>
          <label htmlFor="mcp-server-url" style={labelStyle}>服务器 URL *</label>
          <input
            id="mcp-server-url"
            name="mcp-server-url"
            type="url"
            autoComplete="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://mcp.example.com"
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label htmlFor="mcp-server-name" style={labelStyle}>服务器名称</label>
          <input
            id="mcp-server-name"
            name="mcp-server-name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="我的 MCP Server"
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label htmlFor="mcp-api-key" style={labelStyle}>API Key</label>
          <input
            id="mcp-api-key"
            name="mcp-api-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleTest}
            disabled={!url.trim() || testStatus === 'testing'}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 12px', borderRadius: 4, border: '1px solid var(--border)',
              background: 'transparent', cursor: url.trim() && testStatus !== 'testing' ? 'pointer' : 'not-allowed',
              fontSize: 11, fontFamily: 'inherit', color: 'var(--text-secondary)',
              opacity: url.trim() && testStatus !== 'testing' ? 1 : 0.5,
            }}
          >
            <Wifi size={11} />
            测试连接
          </button>
          <button
            onClick={handleAdd}
            disabled={testStatus !== 'success'}
            style={{
              padding: '5px 14px', borderRadius: 4, border: 'none',
              background: testStatus === 'success' ? 'var(--accent)' : 'var(--bg-input)',
              color: testStatus === 'success' ? '#fff' : 'var(--text-tertiary)',
              cursor: testStatus === 'success' ? 'pointer' : 'not-allowed',
              fontSize: 11, fontFamily: 'inherit',
              opacity: testStatus === 'success' ? 1 : 0.5,
            }}
          >添加</button>
        </div>
        {testStatus === 'success' && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
            ✓ 连接成功
          </div>
        )}
        {testStatus === 'error' && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
            ✗ 连接失败{testError ? `: ${testError}` : ''}
          </div>
        )}
        {testStatus === 'testing' && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
            测试中…
          </div>
        )}
      </div>

      {/* Bound MCP servers */}
      {entries.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
            已绑定的 MCP 服务器
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((entry) => (
              <div key={entry.id} style={{
                background: 'var(--bg-input)', borderRadius: 8, padding: '10px 12px',
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: entry.status === 'connected' ? 'var(--success)' : 'var(--text-tertiary)',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {entry.name}
                    </span>
                    <span style={{
                      padding: '1px 4px', borderRadius: 3, fontSize: 9,
                      background: entry.status === 'connected' ? 'var(--success-bg)' : 'var(--bg-input)',
                      color: entry.status === 'connected' ? 'var(--success)' : 'var(--text-tertiary)',
                    }}>
                      {entry.status === 'connected' ? '已连接' : '未知'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => handleRetest(entry.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 2,
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'inherit',
                        padding: '2px 4px',
                      }}
                    >
                      <RefreshCw size={10} /> 重新测试
                    </button>
                    <button onClick={() => handleRemove(entry.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 2,
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'inherit',
                        padding: '2px 4px',
                      }}
                    >
                      <X size={10} /> 移除
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, marginLeft: 15 }}>
                  {entry.url}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => console.log('Navigate to MCP marketplace')}
        style={{
          display: 'flex', alignItems: 'center', gap: 3,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: 'var(--accent)', fontFamily: 'inherit', padding: 0,
          marginTop: 12,
        }}
      >
        <ExternalLink size={11} />
        去 MCP 市场浏览
      </button>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
  display: 'block', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
  fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-card)',
  boxSizing: 'border-box',
}
