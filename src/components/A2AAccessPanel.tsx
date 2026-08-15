// ============================================================
// A2AAccessPanel — 设置 → A2A 接入（agents-005）
// 签发 / 复制 / 列表 / 吊销用户级 Token，供 IDE 调 /a2a/*
// ============================================================

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowLeft, Copy, KeyRound, RefreshCw, PlugZap } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import { panelRootStyle } from '../lib/panel-layout'

const ipc = createIpcClient()

interface Props {
  onBack?: () => void
  /** 嵌入系统设置右栏时隐藏独立顶栏 */
  embedded?: boolean
}

interface BackendUser {
  id: string
  tenant_id: string
  username: string
  display_name?: string | null
}

interface ProbeResult {
  ok: boolean
  baseUrl?: string
  status?: number
  agentCount?: number
  sampleUrls?: Array<{ name?: string; url?: string }>
  cardUrlMismatch?: boolean
  error?: string
}

interface TokenRow {
  id: string
  device_label?: string | null
  purpose?: string
  token_suffix?: string | null
  expires_at: string
  revoked_at?: string | null
  created_at: string
}

const TTL_OPTIONS = [
  { label: '7 天', hours: 168 },
  { label: '30 天', hours: 720 },
  { label: '90 天', hours: 2160 },
] as const

function maskToken(row: TokenRow): string {
  const suffix = row.token_suffix || '****'
  return `bba2a_****${suffix}`
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function tokenStatus(row: TokenRow): 'active' | 'expired' | 'revoked' {
  if (row.revoked_at) return 'revoked'
  if (new Date(row.expires_at).getTime() < Date.now()) return 'expired'
  return 'active'
}

export function A2AAccessPanel({ onBack, embedded = false }: Props) {
  const [baseUrl, setBaseUrl] = useState('')
  const [ready, setReady] = useState(false)
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null)
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [deviceLabel, setDeviceLabel] = useState('cursor-ide')
  const [ttlHours, setTtlHours] = useState(720)
  const [plaintext, setPlaintext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [probe, setProbe] = useState<ProbeResult | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const status = await ipc.invoke(IPC_CHANNELS.EXPERT_FASTAPI_STATUS) as {
        ready?: boolean
        baseUrl?: string
      }
      const url = (status?.baseUrl || '').replace(/\/$/, '')
      setBaseUrl(url)
      setReady(Boolean(status?.ready))
      if (!status?.ready) {
        setBackendUser(null)
        setTokens([])
        setError('后端未就绪。请确认 BspBuddy 已启动本地服务后重试。')
        return
      }
      const me = await ipc.invoke(IPC_CHANNELS.A2A_ACCESS_BACKEND_ME) as BackendUser | { error?: string }
      if (!me || 'error' in me) {
        setBackendUser(null)
        setError((me as { error?: string })?.error || '无法获取后端用户身份')
        setTokens([])
        return
      }
      setBackendUser(me as BackendUser)
      const rows = await ipc.invoke(IPC_CHANNELS.AGENT_SKILL_TOKEN_LIST, { purpose: 'a2a' }) as TokenRow[]
      setTokens(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      setTokens([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function copyText(text: string, okMsg: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(okMsg)
    } catch {
      setError('复制失败')
    }
  }

  async function probeA2A(token?: string | null) {
    setBusy(true)
    setError(null)
    try {
      const res = await ipc.invoke(IPC_CHANNELS.A2A_ACCESS_PROBE, {
        token: token || undefined,
      }) as ProbeResult
      setProbe(res)
      if (res.ok) {
        const mismatch = res.cardUrlMismatch ? '（注意：Agent Card URL 与 Base URL 不一致）' : ''
        showToast(`连接成功：${res.agentCount ?? 0} 个专家${mismatch}`)
      } else {
        setError(res.error || `探测失败 HTTP ${res.status ?? '?'}`)
      }
    } catch (e) {
      setProbe(null)
      setError(e instanceof Error ? e.message : '探测失败')
    } finally {
      setBusy(false)
    }
  }

  async function issueToken() {
    const label = deviceLabel.trim()
    if (!label) {
      setError('请填写设备备注')
      return
    }
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      const res = await ipc.invoke(IPC_CHANNELS.AGENT_SKILL_TOKEN_CREATE, {
        device_label: label,
        ttl_hours: ttlHours,
        purpose: 'a2a',
      }) as { token?: string; error?: string }
      if (!res?.token) {
        setError(res?.error || '签发失败')
        return
      }
      setPlaintext(res.token)
      await navigator.clipboard.writeText(res.token)
      showToast('Token 已复制（仅显示一次）')
      const rows = await ipc.invoke(IPC_CHANNELS.AGENT_SKILL_TOKEN_LIST, { purpose: 'a2a' }) as TokenRow[]
      setTokens(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '签发失败')
    } finally {
      setBusy(false)
    }
  }

  async function revokeToken(id: string) {
    if (!window.confirm('确定吊销该 Token？使用该明文的 IDE 将立即无法访问 A2A。')) return
    setBusy(true)
    setError(null)
    try {
      await ipc.invoke(IPC_CHANNELS.AGENT_SKILL_TOKEN_REVOKE, id)
      showToast('已吊销')
      if (plaintext) setPlaintext(null)
      const rows = await ipc.invoke(IPC_CHANNELS.AGENT_SKILL_TOKEN_LIST, { purpose: 'a2a' }) as TokenRow[]
      setTokens(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '吊销失败')
    } finally {
      setBusy(false)
    }
  }

  async function deleteToken(id: string) {
    if (!window.confirm('确定永久删除该 Token 记录？删除后无法恢复。')) return
    setBusy(true)
    setError(null)
    try {
      await ipc.invoke(IPC_CHANNELS.AGENT_SKILL_TOKEN_DELETE, id)
      showToast('已删除')
      const rows = await ipc.invoke(IPC_CHANNELS.AGENT_SKILL_TOKEN_LIST, { purpose: 'a2a' }) as TokenRow[]
      setTokens(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  const agentsUrl = baseUrl ? `${baseUrl}/a2a/agents` : '/a2a/agents'
  const exampleCurl = [
    `curl -s ${agentsUrl} \\`,
    `  -H "Authorization: Bearer <your-a2a-token>"`,
  ].join('\n')

  return (
    <div style={embedded ? embeddedRootStyle : panelRootStyle()}>
      {!embedded ? (
        <div
          style={{
            height: 44,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}
          >
            <ArrowLeft size={16} color="var(--text-secondary)" aria-hidden="true" />
          </button>
          <KeyRound size={15} strokeWidth={1.75} color="var(--text-secondary)" aria-hidden="true" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
            A2A 接入
          </span>
          <button
            type="button"
            className="bb-btn bb-btn-secondary"
            onClick={() => void load()}
            disabled={loading || busy}
            title="刷新"
          >
            <RefreshCw size={14} strokeWidth={1.75} />
          </button>
        </div>
      ) : null}

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {embedded ? (
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                A2A 接入
              </div>
            ) : null}
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              签发个人 Token，让 IDE 通过 A2A 连接本机 BspBuddy 专家。凭证绑定
              <strong style={{ fontWeight: 600 }}> 后端用户</strong>
              ，与桌面「Phase 1 本地模拟会话」不是同一套身份。
            </p>
          </div>
          {embedded ? (
            <button
              type="button"
              className="bb-btn bb-btn-secondary"
              onClick={() => void load()}
              disabled={loading || busy}
              title="刷新"
            >
              <RefreshCw size={14} strokeWidth={1.75} />
            </button>
          ) : null}
        </div>

        {toast ? <div className="bb-toast" style={{ marginBottom: 12 }}>{toast}</div> : null}
        {error ? (
          <div style={{ color: 'var(--danger, #dc2626)', fontSize: 12, marginBottom: 12 }}>{error}</div>
        ) : null}

        <Section title="接入信息">
          <InfoRow
            label="Base URL"
            value={baseUrl || '—'}
            onCopy={baseUrl ? () => void copyText(baseUrl, 'Base URL 已复制') : undefined}
          />
          <InfoRow
            label="发现端点"
            value={agentsUrl}
            onCopy={() => void copyText(agentsUrl, '发现端点已复制')}
          />
          <InfoRow
            label="当前后端用户"
            value={
              backendUser
                ? `${backendUser.display_name || backendUser.username} · ${backendUser.tenant_id}`
                : ready
                  ? '未解析'
                  : '—'
            }
          />
          <InfoRow
            label="后端状态"
            value={ready ? '已连接' : '未就绪'}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="bb-btn bb-btn-secondary"
              disabled={!ready || busy}
              onClick={() => void probeA2A()}
            >
              <PlugZap size={14} strokeWidth={1.75} /> 用当前会话测试 /a2a/agents
            </button>
          </div>
          {probe ? (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${probe.ok ? 'var(--border)' : 'var(--danger, #dc2626)'}`,
                background: 'var(--bg-input)',
                fontSize: 11,
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
              }}
            >
              {probe.ok ? (
                <>
                  <div>HTTP {probe.status} · 专家数 {probe.agentCount ?? 0}</div>
                  {(probe.sampleUrls || []).map((item, idx) => (
                    <div key={idx} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>
                      {item.name}: {item.url}
                    </div>
                  ))}
                  {probe.cardUrlMismatch ? (
                    <div style={{ color: 'var(--danger, #dc2626)', marginTop: 4 }}>
                      Agent Card URL 主机与本页 Base URL 不一致；请确认 BASE_URL / 重启后端。
                    </div>
                  ) : null}
                </>
              ) : (
                <div style={{ color: 'var(--danger, #dc2626)' }}>{probe.error || '失败'}</div>
              )}
            </div>
          ) : null}
        </Section>

        <Section title="签发新 Token">
          <label style={labelStyle}>
            设备备注
            <input
              value={deviceLabel}
              onChange={(e) => setDeviceLabel(e.target.value)}
              disabled={!ready || busy}
              maxLength={100}
              placeholder="如 cursor-ide"
              style={inputStyle}
            />
          </label>
          <div style={{ marginTop: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>有效期</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TTL_OPTIONS.map((opt) => (
                <button
                  key={opt.hours}
                  type="button"
                  disabled={!ready || busy}
                  onClick={() => setTtlHours(opt.hours)}
                  aria-pressed={ttlHours === opt.hours}
                  style={{
                    ...chipStyle,
                    border: ttlHours === opt.hours ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: ttlHours === opt.hours ? 'var(--accent-light)' : 'var(--bg-card)',
                    color: ttlHours === opt.hours ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: ttlHours === opt.hours ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="bb-btn bb-btn-primary"
            disabled={!ready || busy || loading}
            onClick={() => void issueToken()}
          >
            签发并复制
          </button>
        </Section>

        {plaintext ? (
          <Section title="明文（仅此次可见）">
            <div
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 11,
                wordBreak: 'break-all',
                padding: 10,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              {plaintext}
            </div>
            <p style={{ margin: '8px 0 10px', fontSize: 11, color: 'var(--text-tertiary)' }}>
              请立即粘贴到 IDE；关闭本区块后无法再查看明文。
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="bb-btn bb-btn-secondary"
                onClick={() => void copyText(plaintext, '已复制')}
              >
                <Copy size={14} strokeWidth={1.75} /> 复制
              </button>
              <button
                type="button"
                className="bb-btn bb-btn-secondary"
                disabled={busy}
                onClick={() => void probeA2A(plaintext)}
              >
                <PlugZap size={14} strokeWidth={1.75} /> 用此 Token 测试
              </button>
              <button type="button" className="bb-btn bb-btn-secondary" onClick={() => setPlaintext(null)}>
                关闭
              </button>
            </div>
          </Section>
        ) : null}

        <Section title="已签发 Token">
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>加载中…</div>
          ) : tokens.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              还没有 A2A Token。填写上方备注后签发，即可在 IDE 中配置 Bearer。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tokens.map((row) => {
                const status = tokenStatus(row)
                return (
                  <div
                    key={row.id}
                    style={{
                      padding: 10,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {row.device_label || '未命名设备'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {maskToken(row)} ·{' '}
                        <span
                          style={{
                            color:
                              status === 'revoked'
                                ? 'var(--danger)'
                                : status === 'expired'
                                  ? 'var(--warning)'
                                  : 'var(--text-tertiary)',
                          }}
                        >
                          {status === 'revoked' ? '已吊销' : status === 'expired' ? '已过期' : `过期 ${formatWhen(row.expires_at)}`}
                        </span>
                      </div>
                    </div>
                    {status === 'active' ? (
                      <button
                        type="button"
                        className="bb-btn"
                        disabled={busy}
                        onClick={() => void revokeToken(row.id)}
                        style={{
                          border: '1px solid var(--warning)',
                          background: 'var(--warning-bg)',
                          color: 'var(--warning)',
                        }}
                      >
                        吊销
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="bb-btn"
                        disabled={busy}
                        onClick={() => void deleteToken(row.id)}
                        style={{
                          border: '1px solid var(--danger)',
                          background: 'var(--danger-bg)',
                          color: 'var(--danger)',
                        }}
                      >
                        删除
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        <Section title="如何在 IDE 使用">
          <pre
            style={{
              margin: 0,
              padding: 10,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              fontSize: 11,
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              color: 'var(--text-secondary)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            }}
          >
            {`Header: Authorization: Bearer <token>\nGET  ${agentsUrl}\nPOST ${baseUrl || '{base}'}/a2a/agents/{agent_id}/tasks  (SSE)\n\n${exampleCurl}`}
          </pre>
          <button
            type="button"
            className="bb-btn bb-btn-secondary"
            style={{ marginTop: 10 }}
            onClick={() => void copyText(exampleCurl, '示例已复制')}
          >
            <Copy size={14} strokeWidth={1.75} /> 复制示例
          </button>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </section>
  )
}

function InfoRow({
  label,
  value,
  onCopy,
}: {
  label: string
  value: string
  onCopy?: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 0',
        borderBottom: '1px solid var(--border-subtle, #eef1f6)',
      }}
    >
      <span style={{ width: 96, flexShrink: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 12,
          color: 'var(--text-primary)',
          wordBreak: 'break-all',
          fontFamily: label.includes('URL') || label.includes('端点')
            ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
            : 'inherit',
        }}
      >
        {value}
      </span>
      {onCopy ? (
        <button type="button" className="bb-btn bb-btn-secondary" onClick={onCopy} title="复制">
          <Copy size={13} strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  )
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--text-tertiary)',
}

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  boxSizing: 'border-box',
  padding: '7px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontFamily: 'inherit',
}

const chipStyle: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  background: 'var(--bg-card)',
}

const embeddedRootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  background: 'var(--bg-root, #f5f7fa)',
}
