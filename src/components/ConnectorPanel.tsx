import { useState, useEffect } from 'react'
import { Mail, FileText, BookOpen, Video, ClipboardList, Cloud, Plug, Link, QrCode, Plus, RefreshCw, ExternalLink, Shield, Info, ArrowRight, Tag } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { ConnectorDef, ConnectorConnectResult, ConnectorProvider, ConnectorScenario } from '../lib/connector-types'

const ipc = createIpcClient()

interface Props {
  onClose: () => void
  workspacePath?: string
}

const PROVIDER_ICONS: Record<ConnectorProvider, typeof Mail> = {
  qqmail: Mail,
  'tencent-docs': FileText,
  'tencent-lexiang': BookOpen,
  'tencent-meeting': Video,
  tapd: ClipboardList,
  'tencent-pan': Cloud,
  custom: Plug,
}

const SCENARIO_COLORS: Record<ConnectorScenario, string> = {
  '数据查询': '#3b82f6',
  '服务调用': '#8b5cf6',
  '文件管理': '#22c55e',
  '消息通知': '#f59e0b',
}

export function ConnectorPanel({ onClose, workspacePath }: Props) {
  const [connectors, setConnectors] = useState<ConnectorDef[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [showQQMailQR, setShowQQMailQR] = useState<{ url: string } | null>(null)
  const [showTapdForm, setShowTapdForm] = useState(false)
  const [showOAuthModal, setShowOAuthModal] = useState<{ defId: string; provider: ConnectorProvider; authUrl: string } | null>(null)
  const [customConfig, setCustomConfig] = useState({ name: '', command: '', args: '', env: '' })
  const [tapdConfig, setTapdConfig] = useState({ apiKey: '', workspaceId: '' })
  const [expandedDef, setExpandedDef] = useState<string | null>(null)

  useEffect(() => {
    loadConnectors()
  }, [])

  async function loadConnectors() {
    const list = (await ipc.invoke(IPC_CHANNELS.CONNECTOR_LIST)) as ConnectorDef[]
    setConnectors(list)
  }

  function showToast(msg: string, duration = 2000) {
    setToast(msg)
    setTimeout(() => setToast(null), duration)
  }

  async function handleConnect(def: ConnectorDef) {
    setConnecting(def.id)

    try {
      if (def.provider === 'qqmail') {
        const result = await ipc.invoke(IPC_CHANNELS.CONNECTOR_CONNECT, { defId: def.id, provider: def.provider }) as ConnectorConnectResult
        if (result.qrCodeUrl) {
          setShowQQMailQR({ url: result.qrCodeUrl })
          showToast('请扫描二维码授权', 5000)
        } else if (result.success) {
          showToast('连接成功！')
          loadConnectors()
        } else {
          showToast(result.error || '连接失败')
        }
      } else if (def.provider === 'tapd') {
        setShowTapdForm(true)
      } else if (def.provider === 'custom') {
        setShowCustomForm(true)
      } else {
        // OAuth flow — show redirect modal
        setShowOAuthModal({ defId: def.id, provider: def.provider, authUrl: def.authUrl || '' })
      }
    } finally {
      if (def.provider !== 'qqmail' && def.provider !== 'tapd' && def.provider !== 'custom') {
        setConnecting(null)
      }
    }
  }

  async function handleDisconnect(def: ConnectorDef) {
    const result = await ipc.invoke(IPC_CHANNELS.CONNECTOR_DISCONNECT, def.id) as { success: boolean; error?: string }
    if (result.success) {
      showToast('已断开连接')
      loadConnectors()
    } else {
      showToast(result.error || '断开失败')
    }
  }

  async function confirmQQMailQR() {
    const result = await ipc.invoke(IPC_CHANNELS.CONNECTOR_CONNECT, { defId: 'connector-qqmail', provider: 'qqmail', config: { action: 'confirm' } }) as ConnectorConnectResult
    setShowQQMailQR(null)
    setConnecting(null)
    if (result.success) {
      showToast('QQ邮箱连接成功！')
      loadConnectors()
    } else {
      showToast(result.error || '授权失败，请重试')
    }
  }

  async function confirmTapdConnect() {
    if (!tapdConfig.apiKey || !tapdConfig.workspaceId) {
      showToast('请填写API Key和项目ID')
      return
    }
    const result = await ipc.invoke(IPC_CHANNELS.CONNECTOR_CONNECT, {
      defId: 'connector-tapd',
      provider: 'tapd',
      config: tapdConfig,
    }) as ConnectorConnectResult
    setShowTapdForm(false)
    setConnecting(null)
    if (result.success) {
      showToast('TAPD连接成功！')
      loadConnectors()
    } else {
      showToast(result.error || '连接失败')
    }
  }

  async function confirmCustomConnect() {
    if (!customConfig.name || !customConfig.command) {
      showToast('请填写连接器名称和启动命令')
      return
    }
    const args = customConfig.args ? customConfig.args.split(',').map((s) => s.trim()).filter(Boolean) : []
    const envLines = customConfig.env ? customConfig.env.split('\n').filter((l) => l.includes('=')) : []
    const env: Record<string, string> = {}
    for (const line of envLines) {
      const [k, ...v] = line.split('=')
      if (k) env[k.trim()] = v.join('=').trim()
    }

    const mcpConfig = {
      name: customConfig.name,
      command: customConfig.command,
      args,
      env,
      description: `自定义连接器: ${customConfig.name}`,
    }

    const result = await ipc.invoke(IPC_CHANNELS.CONNECTOR_CONNECT, {
      defId: 'connector-custom',
      provider: 'custom',
      mcpConfig,
    }) as ConnectorConnectResult
    setShowCustomForm(false)
    setConnecting(null)
    setCustomConfig({ name: '', command: '', args: '', env: '' })
    if (result.success) {
      showToast('自定义连接器连接成功！')
      loadConnectors()
    } else {
      showToast(result.error || '连接失败')
    }
  }

  async function simulateOAuthCallback(provider: ConnectorProvider) {
    const code = `auth-code-${Date.now().toString(36)}`
    // Simulate the OAuth callback — in production this comes from the actual redirect
    const result = await ipc.invoke(IPC_CHANNELS.CONNECTOR_CONNECT, {
      defId: `connector-${provider}`,
      provider,
      config: { action: 'callback', code },
    }) as ConnectorConnectResult

    setShowOAuthModal(null)
    setConnecting(null)
    if (result.success) {
      showToast('授权成功，已连接！')
      loadConnectors()
    } else {
      showToast(result.error || '授权失败')
    }
  }

  const connectedCount = connectors.filter((c) => c.connected).length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link size={18} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>连接器</span>
          {connectedCount > 0 && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'var(--success-bg)', color: 'var(--success)' }}>
              {connectedCount} 已连接
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setShowCustomForm(true)}
            style={{
              padding: '4px 10px', borderRadius: 4, border: '1px solid var(--accent)',
              background: 'transparent', color: 'var(--accent)', fontSize: 11, cursor: 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Plus size={12} />
            自定义连接器
          </button>
          <button onClick={onClose} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>x</button>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{ padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <Shield size={12} color="var(--text-tertiary)" />
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          新增连接器将同步更新隐私协议相关条款。撤销授权请在各服务的安全管理中操作。
        </span>
      </div>

      {/* Connector List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {connectors.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
            加载中...
          </div>
        )}
        {connectors.map((def) => (
          <div
            key={def.id}
            style={{
              padding: '14px', borderRadius: 8, background: 'var(--bg-card)',
              marginBottom: 8, border: def.connected ? '1px solid var(--success)' : '1px solid var(--border)',
              position: 'relative',
            }}
          >
            {/* Connected indicator */}
            {def.connected && (
              <div style={{
                position: 'absolute', top: -1, right: -1,
                width: 10, height: 10, borderRadius: '50%',
                background: 'var(--success)', border: '2px solid var(--bg-card)',
              }} />
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: def.connected ? 'var(--success-bg)' : 'var(--bg-hover)',
                flexShrink: 0,
              }}>
                {(() => {
                  const Icon = PROVIDER_ICONS[def.provider]
                  return <Icon size={20} color={def.connected ? 'var(--success)' : 'var(--text-tertiary)'} />
                })()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{def.name}</span>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 3,
                    background: def.connected ? 'var(--success-bg)' : 'var(--bg-hover)',
                    color: def.connected ? 'var(--success)' : 'var(--text-tertiary)',
                  }}>
                    {def.connected ? '已连接' : '未连接'}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '1px 4px', borderRadius: 3, background: 'var(--bg-hover)' }}>
                    {def.architecture}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>
                  {def.description}
                </div>

                {/* Scenarios */}
                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  {def.scenarios.map((scenario) => (
                    <span key={scenario} style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 3,
                      background: `${SCENARIO_COLORS[scenario]}15`,
                      color: SCENARIO_COLORS[scenario],
                      display: 'flex', alignItems: 'center', gap: 2,
                    }}>
                      <Tag size={8} />
                      {scenario}
                    </span>
                  ))}
                </div>

                {/* Supported Actions (expanded) */}
                {def.supportedActions && def.supportedActions.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <button
                      onClick={() => setExpandedDef(expandedDef === def.id ? null : def.id)}
                      style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                    >
                      <Info size={9} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                      {expandedDef === def.id ? '收起' : `${def.supportedActions.length} 个可用操作`}
                    </button>
                    {expandedDef === def.id && (
                      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {def.supportedActions.map((action) => (
                          <span key={action} style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 3,
                            background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                          }}>
                            {action}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Revoke hint for connected connectors */}
                {def.connected && def.revokeHint && (
                  <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Shield size={9} />
                    撤销: {def.revokeHint}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', flexShrink: 0 }}>
                {def.connected ? (
                  <button
                    onClick={() => handleDisconnect(def)}
                    style={{
                      padding: '5px 12px', borderRadius: 4, border: '1px solid var(--danger)',
                      background: 'transparent', color: 'var(--danger)', fontSize: 11, cursor: 'pointer',
                      fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                  >
                    断开
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(def)}
                    disabled={connecting === def.id}
                    style={{
                      padding: '5px 12px', borderRadius: 4, border: 'none',
                      background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer',
                      fontFamily: 'inherit', whiteSpace: 'nowrap',
                      opacity: connecting === def.id ? 0.6 : 1,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {connecting === def.id && <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} />}
                    <ArrowRight size={12} />
                    连接
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* QQ邮箱 QR Code Modal */}
      {showQQMailQR && (
        <Modal onClose={() => { setShowQQMailQR(null); setConnecting(null) }}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <QrCode size={48} color="var(--accent)" />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 12 }}>QQ邮箱扫码授权</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 16 }}>
              请使用 QQ邮箱 App (7.1.5+/鸿蒙 0.2.9+) 扫描二维码
            </div>
            {/* QR Code placeholder */}
            <div style={{
              width: 200, height: 200, margin: '0 auto', background: '#fff', borderRadius: 12,
              border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 4,
            }}>
              <QrCode size={80} color="#333" />
              <div style={{ fontSize: 9, color: '#999', marginTop: 8 }}>扫描确认后完成授权</div>
              <div style={{ fontSize: 8, color: '#ccc', marginTop: 4 }}>{showQQMailQR.url.slice(0, 40)}...</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button
                onClick={confirmQQMailQR}
                style={{
                  padding: '8px 24px', borderRadius: 6, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                已完成扫码
              </button>
              <button
                onClick={() => { setShowQQMailQR(null); setConnecting(null) }}
                style={{
                  padding: '8px 24px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                取消
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* TAPD API Key Form Modal */}
      {showTapdForm && (
        <Modal onClose={() => { setShowTapdForm(false); setConnecting(null) }}>
          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <ClipboardList size={20} color="var(--accent)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>TAPD API Key 授权</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>
              请在 TAPD 个人设置中生成 API Key，并填写项目 ID 完成连接。
              <a href="https://www.tapd.cn/help/view#1120003271001000093" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', marginLeft: 4, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                查看帮助 <ExternalLink size={10} />
              </a>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                API Key <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="password"
                value={tapdConfig.apiKey}
                onChange={(e) => setTapdConfig((p) => ({ ...p, apiKey: e.target.value }))}
                placeholder="输入TAPD API Key"
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                项目 ID <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={tapdConfig.workspaceId}
                onChange={(e) => setTapdConfig((p) => ({ ...p, workspaceId: e.target.value }))}
                placeholder="输入TAPD项目ID"
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={confirmTapdConnect}
                style={{ padding: '8px 24px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                连接
              </button>
              <button
                onClick={() => { setShowTapdForm(false); setConnecting(null) }}
                style={{ padding: '8px 24px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                取消
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* OAuth Modal */}
      {showOAuthModal && (
        <Modal onClose={() => { setShowOAuthModal(null); setConnecting(null) }}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <ExternalLink size={48} color="var(--accent)" />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 12 }}>OAuth 授权</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 16 }}>
              将在浏览器中打开授权页面，完成授权后点击下方确认
            </div>
            <div style={{
              padding: '10px', borderRadius: 6, background: 'var(--bg-input)',
              fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-all',
              color: 'var(--text-secondary)', marginBottom: 16, textAlign: 'left',
            }}>
              {showOAuthModal.authUrl}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={() => simulateOAuthCallback(showOAuthModal.provider)}
                style={{
                  padding: '8px 24px', borderRadius: 6, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                已完成授权
              </button>
              <button
                onClick={() => { setShowOAuthModal(null); setConnecting(null) }}
                style={{
                  padding: '8px 24px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                取消
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Custom Connector Config Modal */}
      {showCustomForm && (
        <Modal onClose={() => { setShowCustomForm(false); setConnecting(null) }}>
          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Plug size={20} color="var(--accent)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>自定义 MCP 连接器</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>
              配置方式与 MCP 配置类似，访问范围由用户配置决定，BspBuddy 不预设范围。
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                连接器名称 <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input type="text" value={customConfig.name} onChange={(e) => setCustomConfig((p) => ({ ...p, name: e.target.value }))}
                placeholder="输入连接器名称"
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)' }} />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                启动命令 <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input type="text" value={customConfig.command} onChange={(e) => setCustomConfig((p) => ({ ...p, command: e.target.value }))}
                placeholder="例如: uvx 或 npx"
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)' }} />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                命令参数
              </label>
              <input type="text" value={customConfig.args} onChange={(e) => setCustomConfig((p) => ({ ...p, args: e.target.value }))}
                placeholder="多个参数用逗号分隔"
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                环境变量
              </label>
              <textarea value={customConfig.env} onChange={(e) => setCustomConfig((p) => ({ ...p, env: e.target.value }))}
                placeholder="KEY=VALUE 格式，每行一个"
                rows={3}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 11, fontFamily: 'monospace', resize: 'vertical', color: 'var(--text-primary)', background: 'var(--bg-input)' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={confirmCustomConnect}
                style={{ padding: '8px 24px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                连接
              </button>
              <button onClick={() => { setShowCustomForm(false); setConnecting(null) }}
                style={{ padding: '8px 24px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                取消
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 16px', borderRadius: 8, background: 'var(--text-primary)', color: '#fff',
          fontSize: 12, boxShadow: 'var(--shadow-lg)', zIndex: 200, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 150,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12,
        padding: '20px 24px', minWidth: 360, maxWidth: 480,
        border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
      }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
