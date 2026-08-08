import { useState, useEffect } from 'react'
import { Server, Plug, Wifi, WifiOff, Shield, Plus, Trash2, Search, Globe, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, ExternalLink, Zap } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { McpServer, McpMarketEntry } from '../lib/mcp-types'
import type { McpServerConfig } from '../lib/plugin-types'

const ipc = createIpcClient()

interface Props {
  onClose: () => void
  workspacePath?: string
}

export function MCPConfigPanel({ onClose, workspacePath }: Props) {
  const [servers, setServers] = useState<McpServer[]>([])
  const [marketEntries, setMarketEntries] = useState<McpMarketEntry[]>([])
  const [activeTab, setActiveTab] = useState<'servers' | 'market' | 'config'>('servers')
  const [configLevel, setConfigLevel] = useState<'user' | 'project'>('user')
  const [rawConfig, setRawConfig] = useState('')
  const [connecting, setConnecting] = useState<string | null>(null)
  const [expandedServer, setExpandedServer] = useState<string | null>(null)
  const [envValues, setEnvValues] = useState<Record<string, string>>({})
  const [showEnvForm, setShowEnvForm] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    loadServers()
    loadMarket()
  }, [configLevel])

  async function loadServers() {
    const list = (await ipc.invoke(IPC_CHANNELS.MCP_LIST, workspacePath)) as McpServer[]
    setServers(list)
  }

  async function loadMarket() {
    const market = (await ipc.invoke(IPC_CHANNELS.MCP_MARKET_LIST)) as McpMarketEntry[]
    setMarketEntries(market)
  }

  async function handleConnect(config: McpServerConfig) {
    setConnecting(config.name)
    const result = await ipc.invoke(IPC_CHANNELS.MCP_CONNECT, config, configLevel, workspacePath) as { success: boolean; error?: string }
    setConnecting(null)
    if (result.success) {
      setToast('连接成功！')
      setTimeout(() => setToast(null), 2000)
      loadServers()
    } else {
      setToast(result.error || '连接失败')
      setTimeout(() => setToast(null), 3000)
    }
  }

  async function handleDisconnect(serverId: string) {
    await ipc.invoke(IPC_CHANNELS.MCP_DISCONNECT, serverId)
    loadServers()
  }

  async function handleConfigure() {
    if (!rawConfig.trim()) return
    const result = await ipc.invoke(IPC_CHANNELS.MCP_CONFIGURE, rawConfig.trim(), configLevel, workspacePath) as { success: boolean; error?: string }
    if (result.success) {
      setToast('MCP配置成功！')
      setTimeout(() => setToast(null), 2000)
      setRawConfig('')
      loadServers()
    } else {
      setToast(result.error || '配置失败')
      setTimeout(() => setToast(null), 3000)
    }
  }

  async function handleMarketInstall(entry: McpMarketEntry) {
    setShowEnvForm(entry.id)
  }

  async function confirmMarketInstall(entry: McpMarketEntry) {
    const env: Record<string, string> = {}
    for (const schema of entry.envSchema) {
      env[schema.key] = envValues[schema.key] || ''
    }
    const config: McpServerConfig = {
      name: entry.name,
      command: entry.command,
      args: entry.args,
      env,
      description: entry.description,
    }
    setShowEnvForm(null)
    setEnvValues({})
    await handleConnect(config)
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <Wifi size={14} color="var(--success)" />
      case 'connecting': return <Plug size={14} color="var(--warning)" />
      case 'error': return <AlertTriangle size={14} color="var(--danger)" />
      default: return <WifiOff size={14} color="var(--text-tertiary)" />
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Server size={18} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>MCP 配置</span>
        </div>
        <button onClick={onClose} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>x</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        {([
          { id: 'servers' as const, label: 'MCP服务器' },
          { id: 'market' as const, label: 'MCP市场' },
          { id: 'config' as const, label: '手动配置' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Config Level Toggle (servers & config tabs) */}
      {(activeTab === 'servers' || activeTab === 'config') && (
        <div style={{ display: 'flex', padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', gap: 6, flexShrink: 0 }}>
          {(['user', 'project'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setConfigLevel(level)}
              style={{
                padding: '3px 10px', borderRadius: 4, border: configLevel === level ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: configLevel === level ? 'var(--accent-light)' : 'transparent',
                color: configLevel === level ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {level === 'user' ? '用户级' : '项目级'}
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                {level === 'user' ? '~/.workbuddy/mcp.json' : '<项目>/.workbuddy/mcp.json'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {/* Servers Tab */}
        {activeTab === 'servers' && (
          <>
            {servers.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
                暂无MCP服务器配置，请前往「MCP市场」或「手动配置」添加
              </div>
            )}
            {servers.map((server) => (
              <div
                key={server.id}
                style={{
                  padding: '12px', borderRadius: 8, background: 'var(--bg-card)',
                  marginBottom: 6, border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  onClick={() => setExpandedServer(expandedServer === server.id ? null : server.id)}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: server.status === 'connected' ? 'var(--success-bg)' : server.status === 'error' ? 'var(--danger-bg)' : 'var(--bg-hover)',
                  }}>
                    {statusIcon(server.status)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{server.name}</span>
                      <span style={{
                        fontSize: 9, padding: '1px 5px', borderRadius: 3,
                        background: server.status === 'connected' ? 'var(--success-bg)' : server.status === 'error' ? 'var(--danger-bg)' : 'var(--bg-hover)',
                        color: server.status === 'connected' ? 'var(--success)' : server.status === 'error' ? 'var(--danger)' : 'var(--text-tertiary)',
                      }}>
                        {server.status === 'connected' ? '已连接' : server.status === 'error' ? '错误' : '未连接'}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                        {server.configLevel === 'user' ? '用户级' : '项目级'}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>
                      {server.description || `${server.command} ${server.args.join(' ')}`}
                    </div>
                    {server.errorMessage && (
                      <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }}>{server.errorMessage}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDisconnect(server.id) }}
                      style={{
                        padding: '3px 8px', borderRadius: 4, border: '1px solid var(--danger)',
                        background: 'transparent', color: 'var(--danger)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <Trash2 size={11} style={{ verticalAlign: 'middle' }} />
                    </button>
                    <ChevronRight size={14} color="var(--text-tertiary)" style={{
                      transform: expandedServer === server.id ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s',
                    }} />
                  </div>
                </div>

                {expandedServer === server.id && (
                  <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--bg-input)', fontSize: 11 }}>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>命令: </span>
                      <code style={{ color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '1px 4px', borderRadius: 3 }}>
                        {server.command} {server.args.join(' ')}
                      </code>
                    </div>
                    {Object.keys(server.env).length > 0 && (
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>环境变量: </span>
                        {Object.entries(server.env).map(([k, v]) => (
                          <span key={k} style={{ marginRight: 8, fontSize: 10, color: 'var(--text-secondary)' }}>
                            {k}={v ? (k.includes('URL') || k.includes('TOKEN') ? '***' : v) : '(未设置)'}
                          </span>
                        ))}
                      </div>
                    )}
                    {server.tools && server.tools.length > 0 && (
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>可用工具: </span>
                        {server.tools.map((t, i) => (
                          <span key={i} style={{ marginRight: 4, fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>{t.name}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-tertiary)' }}>
                      <Shield size={9} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                      WebHook URL 等敏感信息需妥善保管，避免泄露
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Quick Start: WeCom Example */}
            {servers.length === 0 && (
              <div style={{ marginTop: 16, padding: '12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px dashed var(--accent)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Zap size={14} />
                  快速上手: 企微机器人
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  1. 企微群 → 群机器人 → 获取 WebHook URL<br />
                  2. 在下方输入框中粘贴配置<br />
                  3. 点击连接，绿色即成功
                </div>
                <textarea
                  readOnly
                  value={`{\n  "mcpServers": {\n    "wecom": {\n      "command": "uvx",\n      "args": ["wecom-bot-mcp-server"],\n      "env": {\n        "WECOM_WEBHOOK_URL": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY"\n      }\n    }\n  }\n}`}
                  style={{
                    width: '100%', marginTop: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)',
                    fontSize: 10, fontFamily: 'monospace', resize: 'vertical', color: 'var(--text-primary)',
                    background: 'var(--bg-input)', minHeight: 120,
                  }}
                />
                <button
                  onClick={() => {
                    setActiveTab('config')
                    setRawConfig(`{\n  "mcpServers": {\n    "wecom": {\n      "command": "uvx",\n      "args": ["wecom-bot-mcp-server"],\n      "env": {\n        "WECOM_WEBHOOK_URL": ""\n      }\n    }\n  }\n}`)
                  }}
                  style={{
                    marginTop: 8, padding: '6px 14px', borderRadius: 4, border: 'none',
                    background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  去配置
                </button>
              </div>
            )}
          </>
        )}

        {/* Market Tab */}
        {activeTab === 'market' && (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '8px 0', marginBottom: 4 }}>
              访问腾讯云 MCP 市场获取更多开放生态能力
            </div>
            {marketEntries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: '12px', borderRadius: 8, background: 'var(--bg-card)',
                  marginBottom: 6, border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--accent-light)',
                  }}>
                    <Server size={14} color="var(--accent)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{entry.name}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>v{entry.version}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{entry.description}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {entry.author} · {entry.downloads.toLocaleString()} 下载 · {entry.category}
                    </div>
                  </div>
                  <button
                    onClick={() => handleMarketInstall(entry)}
                    style={{
                      padding: '4px 12px', borderRadius: 4, border: 'none',
                      background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                  >
                    安装
                  </button>
                </div>

                {showEnvForm === entry.id && (
                  <div style={{ marginTop: 10, padding: '10px', borderRadius: 6, background: 'var(--bg-input)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>配置环境变量</div>
                    {entry.envSchema.map((schema) => (
                      <div key={schema.key} style={{ marginBottom: 6 }}>
                        <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>
                          {schema.label} {schema.required && <span style={{ color: 'var(--danger)' }}>*</span>}
                          {schema.secret && <Shield size={9} color="var(--warning)" style={{ marginLeft: 4 }} />}
                        </label>
                        <input
                          type={schema.secret ? 'password' : 'text'}
                          value={envValues[schema.key] || ''}
                          onChange={(e) => setEnvValues((p) => ({ ...p, [schema.key]: e.target.value }))}
                          placeholder={schema.description}
                          style={{
                            width: '100%', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
                            fontSize: 11, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-card)',
                          }}
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button
                        onClick={() => confirmMarketInstall(entry)}
                        style={{
                          padding: '4px 12px', borderRadius: 4, border: 'none',
                          background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        确认安装
                      </button>
                      <button
                        onClick={() => { setShowEnvForm(null); setEnvValues({}) }}
                        style={{
                          padding: '4px 12px', borderRadius: 4, border: '1px solid var(--border)',
                          background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Manual Config Tab */}
        {activeTab === 'config' && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
              粘贴MCP服务器配置（JSON格式）。配置将保存到 {configLevel === 'user' ? '~/.workbuddy/mcp.json' : '项目/.workbuddy/mcp.json'}
            </div>
            <textarea
              value={rawConfig}
              onChange={(e) => setRawConfig(e.target.value)}
              placeholder={`{\n  "mcpServers": {\n    "server-name": {\n      "command": "uvx",\n      "args": ["server-package"],\n      "env": {\n        "API_KEY": "your-key"\n      }\n    }\n  }\n}`}
              rows={12}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                fontSize: 11, fontFamily: 'monospace', resize: 'vertical', color: 'var(--text-primary)',
                background: 'var(--bg-input)',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={handleConfigure}
                disabled={!rawConfig.trim()}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer',
                  fontFamily: 'inherit', opacity: !rawConfig.trim() ? 0.5 : 1,
                }}
              >
                保存并连接
              </button>
              <button
                onClick={() => setRawConfig('')}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                清空
              </button>
            </div>

            {/* Tips */}
            <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 11 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>最佳实践</div>
              <ul style={{ color: 'var(--text-secondary)', paddingLeft: 16, lineHeight: 1.8 }}>
                <li>公共能力（如搜索、数据库）配用户级；专属接入配项目级</li>
                <li>从成熟示例起步，参考MCP市场中的配置模板</li>
                <li>妥善保管 WebHook URL 和 API Key</li>
                <li>检查 JSON 格式，确保无语法错误</li>
                <li>描述尽量明确，方便后续管理</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 16px', borderRadius: 8, background: 'var(--text-primary)', color: '#fff',
          fontSize: 12, boxShadow: 'var(--shadow-lg)', zIndex: 100,
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
