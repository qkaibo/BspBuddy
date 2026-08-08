// ============================================================
// AssistantSettings — 远程助理设置页面
// Access: 左下角头像 → 设置 → 助理设置
// Features: platform binding/unbinding, QR code display,
// connection status, version checks, permission configuration.
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Smartphone,
  Wifi,
  WifiOff,
  Loader,
  RefreshCw,
  Unlink,
  QrCode,
  Shield,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Settings,
  Users,
  FileCheck,
  Send,
} from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { IMPlatform, IMConnectionStatus, PlatformConfig } from '../lib/im-types'
import {
  IM_PLATFORMS,
  IM_PLATFORM_LABELS,
  PLATFORM_CONNECTION_MODES,
} from '../lib/im-types'

const ipc = createIpcClient()

// Platform feature highlights
const PLATFORM_FEATURES: Record<IMPlatform, string[]> = {
  'weixin-bot': ['扫码绑定，无需凭证', '支持语音消息', '跨设备继续'],
  'wechat-cs': ['扫码绑定，无需凭证', '客服号通道'],
  wecom: ['群聊 @bot', '专用任务群', '消息加密传输'],
  qq: ['三模式接入', 'AppSecret 不可明文', '实名认证'],
  feishu: ['权限配置', '事件订阅', '消息卡片交互'],
  dingtalk: ['发布审核流程', '群聊 + 单聊', '权限控制'],
  yuanbao: ['社区派模式', '@bot 全员可见', '实时输出分享'],
}

// Detailed info by platform
const PLATFORM_CREDENTIAL_INFO: Record<IMPlatform, { label: string; fields: string[] }> = {
  'weixin-bot': { label: '无凭证（扫码绑定）', fields: [] },
  'wechat-cs': { label: '无凭证（扫码绑定）', fields: [] },
  wecom: { label: 'Bot ID + Secret（长连接） / Token + Encoding-AESKey（URL回调）', fields: ['botId', 'secret', 'token', 'encodingAesKey'] },
  qq: { label: 'AppID + AppSecret', fields: ['appId', 'appSecret'] },
  feishu: { label: 'App ID + App Secret + Encrypt Key', fields: ['appId', 'appSecret', 'encryptKey'] },
  dingtalk: { label: 'AppKey + AppSecret', fields: ['appKey', 'appSecret'] },
  yuanbao: { label: '二维码（主） / AppID(App Key) + AppSecret（备选）', fields: ['appId', 'appSecret'] },
}

interface Props {
  onBack?: () => void
}

export function AssistantSettings({ onBack }: Props) {
  const [platformStatuses, setPlatformStatuses] = useState<Record<IMPlatform, IMConnectionStatus>>({} as Record<IMPlatform, IMConnectionStatus>)
  const [loading, setLoading] = useState(true)
  const [connectingPlatform, setConnectingPlatform] = useState<IMPlatform | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<IMPlatform | null>(null)
  const [qrcodeData, setQrcodeData] = useState<Record<IMPlatform, string>>({} as Record<IMPlatform, string>)
  const [showCredentials, setShowCredentials] = useState<IMPlatform | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Credential form state
  const [credForm, setCredForm] = useState<{
    platform: IMPlatform | null
    mode?: string
    botId?: string
    secret?: string
    token?: string
    encodingAesKey?: string
    appId?: string
    appSecret?: string
    appKey?: string
    encryptKey?: string
    corpId?: string
  }>({ platform: null })

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const result = await ipc.invoke(IPC_CHANNELS.IM_STATUS) as {
        platforms: Array<{ platform: IMPlatform; status: IMConnectionStatus }>
      }
      const map: Record<IMPlatform, IMConnectionStatus> = {} as Record<IMPlatform, IMConnectionStatus>
      for (const p of result.platforms) {
        map[p.platform] = p.status
      }
      setPlatformStatuses(map)
    } catch {
      // Keep existing statuses
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleConnect = async (platform: IMPlatform) => {
    setConnectingPlatform(platform)
    setError(null)

    try {
      if (platform === 'weixin-bot' || platform === 'wechat-cs') {
        // QR-code only platforms
        const qrResult = await ipc.invoke(IPC_CHANNELS.IM_GET_QRCODE, platform) as { success: boolean; qrcode?: string; error?: string }
        if (qrResult.success && qrResult.qrcode) {
          setQrcodeData((prev) => ({ ...prev, [platform]: qrResult.qrcode! }))

          // Connect with QR code mode
          const mode = PLATFORM_CONNECTION_MODES[platform][0]
          const config: PlatformConfig = { platform, qrcodeData: qrResult.qrcode } as PlatformConfig
          if (platform === 'weixin-bot') {
            (config as any).minWechatVersion = '8.0.70'
          }
          await ipc.invoke(IPC_CHANNELS.IM_CONNECT, platform, config)
        } else {
          setError(qrResult.error ?? '获取二维码失败')
        }
      } else {
        // Platforms that need credentials
        setShowCredentials(platform)
        setCredForm({ platform })
        setConnectingPlatform(null)
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败')
    }

    setConnectingPlatform(null)
    loadStatus()
  }

  const handleCredentialConnect = async () => {
    if (!credForm.platform) return
    const platform = credForm.platform
    setConnectingPlatform(platform)
    setError(null)

    try {
      const config = buildConfig(credForm)
      await ipc.invoke(IPC_CHANNELS.IM_CONNECT, platform, config)
      setShowCredentials(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败')
    }

    setConnectingPlatform(null)
    loadStatus()
  }

  const handleDisconnect = async (platform: IMPlatform) => {
    try {
      await ipc.invoke(IPC_CHANNELS.IM_DISCONNECT, platform)
      loadStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : '断开失败')
    }
  }

  const handleUnbind = async (platform: IMPlatform) => {
    try {
      await ipc.invoke(IPC_CHANNELS.IM_UNBIND, platform)
      setQrcodeData((prev) => {
        const next = { ...prev }
        delete next[platform]
        return next
      })
      loadStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : '解绑失败')
    }
  }

  const showQrCode = async (platform: IMPlatform) => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.IM_GET_QRCODE, platform) as { success: boolean; qrcode: string }
      if (result.success) {
        setQrcodeData((prev) => ({ ...prev, [platform]: result.qrcode }))
        setSelectedPlatform(platform)
      }
    } catch {
      // Silently fail
    }
  }

  if (selectedPlatform && qrcodeData[selectedPlatform]) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-root)' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <button
            onClick={() => setSelectedPlatform(null)}
            style={{
              padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'var(--text-secondary)',
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            扫码绑定 — {IM_PLATFORM_LABELS[selectedPlatform]}
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 40 }}>
          <div style={{
            width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--border)', borderRadius: 12, background: '#fff',
          }}>
            <QrCode size={120} color="#333" />
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            请使用手机扫描二维码完成绑定
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            二维码: {qrcodeData[selectedPlatform].slice(0, 30)}...
          </span>
        </div>
      </div>
    )
  }

  // Credential form
  if (showCredentials && credForm.platform) {
    const p = credForm.platform
    const modes = PLATFORM_CONNECTION_MODES[p]

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-root)' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <button
            onClick={() => setShowCredentials(null)}
            style={{
              padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'var(--text-secondary)',
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            配置凭证 — {IM_PLATFORM_LABELS[p]}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ maxWidth: 420, margin: '0 auto' }}>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                凭证类型: {PLATFORM_CREDENTIAL_INFO[p].label}
              </span>
            </div>

            {/* Mode selection */}
            {modes.length > 1 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  连接模式
                </label>
                <select
                  value={credForm.mode || modes[0]}
                  onChange={(e) => setCredForm((prev) => ({ ...prev, mode: e.target.value }))}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    border: '1px solid var(--border)', background: 'var(--bg-card)',
                    fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit',
                  }}
                >
                  {modes.map((m) => (
                    <option key={m} value={m}>
                      {m === 'qrcode' ? '二维码扫码' : m === 'websocket' ? 'WebSocket 长连接' : 'URL 回调'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Credential fields */}
            {renderCredentialFields(p, credForm, (updater) => setCredForm(updater as any))}

            {error && (
              <div style={{
                padding: '8px 12px', borderRadius: 6, marginTop: 12,
                background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 11,
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleCredentialConnect}
              disabled={connectingPlatform === p}
              style={{
                width: '100%', marginTop: 16, padding: '10px 0',
                borderRadius: 6, border: 'none',
                background: 'var(--accent)', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', opacity: connectingPlatform === p ? 0.6 : 1,
              }}
            >
              {connectingPlatform === p ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  连接中...
                </span>
              ) : (
                '连接'
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-root)', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'var(--text-secondary)',
            }}
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <Smartphone size={18} color="var(--accent)" />
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            远程助理设置
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block' }}>
            管理 IM 平台绑定，通过手机远程控制电脑
          </span>
        </div>
        <button
          onClick={loadStatus}
          style={{
            marginLeft: 'auto', padding: 4, borderRadius: 4, border: 'none',
            background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)',
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {error && (
        <div style={{
          margin: '12px 20px 0', padding: '8px 12px', borderRadius: 6,
          background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 11,
        }}>
          {error}
        </div>
      )}

      {/* Platform list */}
      <div style={{ padding: '16px 20px' }}>
        {IM_PLATFORMS.map((platform) => {
          const status: IMConnectionStatus = platformStatuses[platform] ?? 'disconnected'
          const isConnected = status === 'connected'
          const isConnecting = connectingPlatform === platform || status === 'connecting'
          const features = PLATFORM_FEATURES[platform]
          const modes = PLATFORM_CONNECTION_MODES[platform]
          const credInfo = PLATFORM_CREDENTIAL_INFO[platform]

          return (
            <div
              key={platform}
              style={{
                marginBottom: 12, padding: '16px', borderRadius: 10,
                border: isConnected ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: isConnected ? 'var(--accent-light)' : 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {IM_PLATFORM_LABELS[platform]}
                  </span>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 4,
                    fontSize: 10, fontWeight: 500,
                    background: isConnected ? 'var(--success-light)' : 'var(--bg-hover)',
                    color: isConnected ? 'var(--success)' : 'var(--text-tertiary)',
                  }}>
                    {isConnected ? (
                      <><Wifi size={9} /> 已连接</>
                    ) : isConnecting ? (
                      <><Loader size={9} style={{ animation: 'spin 1s linear infinite' }} /> 连接中</>
                    ) : (
                      <><WifiOff size={9} /> 未连接</>
                    )}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  {isConnected && modes.includes('qrcode') && (
                    <button
                      onClick={() => showQrCode(platform)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px',
                        borderRadius: 4, border: '1px solid var(--border)',
                        background: 'var(--bg-card)', cursor: 'pointer',
                        fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'inherit',
                      }}
                    >
                      <QrCode size={10} /> 二维码
                    </button>
                  )}

                  {isConnected ? (
                    <button
                      onClick={() => handleUnbind(platform)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px',
                        borderRadius: 4, border: 'none',
                        background: 'var(--danger-light)', color: 'var(--danger)',
                        cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
                      }}
                    >
                      <Unlink size={10} /> 解绑
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(platform)}
                      disabled={isConnecting}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px',
                        borderRadius: 4, border: 'none',
                        background: 'var(--accent)', color: '#fff',
                        cursor: isConnecting ? 'default' : 'pointer',
                        fontSize: 10, fontFamily: 'inherit',
                        opacity: isConnecting ? 0.6 : 1,
                      }}
                    >
                      {isConnecting ? (
                        <><Loader size={10} style={{ animation: 'spin 1s linear infinite' }} /> 连接中</>
                      ) : (
                        <>绑定</>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Features */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {features.map((f, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 10,
                      background: 'var(--bg-hover)', color: 'var(--text-tertiary)',
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>

              {/* Credential info */}
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Shield size={9} />
                凭证: {credInfo.label}
                {' | '}
                接入方式: {modes.map((m) => m === 'qrcode' ? '扫码' : m === 'websocket' ? 'WebSocket' : 'URL回调').join(' / ')}
              </div>
            </div>
          )
        })}
      </div>

      {/* Info section */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{
          padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)',
          background: 'var(--bg-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Settings size={14} color="var(--text-secondary)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              助理执行约束
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <div>• 固定工作目录: 助理使用专属文件夹，用户不可更改</div>
            <div>• 单一会话: 所有 IM 平台指令集中处理</div>
            <div>• 历史不可清除: 完整保留对话记录</div>
            <div>• 跨设备继续: 手机发起 → 桌面继续 → 回到手机</div>
            <div>• 敏感操作需在手机 IM 内确认（非本地弹窗）</div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function renderCredentialFields(
  platform: IMPlatform,
  form: Record<string, unknown>,
  setForm: (updater: any) => void,
) {
  const updateField = (field: string, value: string) => {
    setForm({ ...form, [field]: value })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {platform === 'wecom' && (
        <>
          {form.mode !== 'url-callback' && (
            <>
              <CredField label="Bot ID" value={(form.botId as string) ?? ''} onChange={(v) => updateField('botId', v)} />
              <CredField label="Secret" value={(form.secret as string) ?? ''} onChange={(v) => updateField('secret', v)} type="password" />
            </>
          )}
          {form.mode === 'url-callback' && (
            <>
              <CredField label="Token" value={(form.token as string) ?? ''} onChange={(v) => updateField('token', v)} />
              <CredField label="Encoding-AESKey" value={(form.encodingAesKey as string) ?? ''} onChange={(v) => updateField('encodingAesKey', v)} />
            </>
          )}
          <CredField label="Corp ID（可选）" value={(form.corpId as string) ?? ''} onChange={(v) => updateField('corpId', v)} />
        </>
      )}

      {platform === 'qq' && (
        <>
          <CredField label="AppID" value={(form.appId as string) ?? ''} onChange={(v) => updateField('appId', v)} />
          <CredField label="AppSecret" value={(form.appSecret as string) ?? ''} onChange={(v) => updateField('appSecret', v)} type="password" />
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '4px 0' }}>
            <AlertTriangle size={9} style={{ verticalAlign: 'middle' }} /> AppSecret 不可明文保存，二次查看将强制重置
          </div>
        </>
      )}

      {platform === 'feishu' && (
        <>
          <CredField label="App ID" value={(form.appId as string) ?? ''} onChange={(v) => updateField('appId', v)} />
          <CredField label="App Secret" value={(form.appSecret as string) ?? ''} onChange={(v) => updateField('appSecret', v)} type="password" />
          <CredField label="Encrypt Key" value={(form.encryptKey as string) ?? ''} onChange={(v) => updateField('encryptKey', v)} />
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '4px 0' }}>
            请确保已在飞书开放平台配置:
            <br />1. 权限管理: im:message, im:message:send_as_bot 等
            <br />2. 事件订阅: im.message.receive_v1, card.action.trigger
          </div>
        </>
      )}

      {platform === 'dingtalk' && (
        <>
          <CredField label="AppKey" value={(form.appKey as string) ?? ''} onChange={(v) => updateField('appKey', v)} />
          <CredField label="AppSecret" value={(form.appSecret as string) ?? ''} onChange={(v) => updateField('appSecret', v)} type="password" />
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '4px 0' }}>
            所需权限: Card.Streaming.Write, Card.Instance.Write, qyapi_robot_sendmsg
            <br />配置完成后需通过钉钉发布审核
          </div>
        </>
      )}

      {platform === 'yuanbao' && (
        <>
          <CredField label="AppID / App Key（备选）" value={(form.appId as string) ?? ''} onChange={(v) => updateField('appId', v)} />
          <CredField label="AppSecret（备选）" value={(form.appSecret as string) ?? ''} onChange={(v) => updateField('appSecret', v)} type="password" />
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '4px 0' }}>
            推荐使用二维码扫码绑定。绑定后可在元宝 App 中确认，然后加入社区派部署。
          </div>
        </>
      )}
    </div>
  )
}

function CredField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`请输入 ${label}`}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--bg-card)',
          fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

function buildConfig(form: Record<string, unknown>): PlatformConfig {
  const p = form.platform as IMPlatform

  switch (p) {
    case 'wecom':
      return {
        platform: p,
        mode: (form.mode as string) || 'websocket',
        botId: form.botId as string | undefined,
        secret: form.secret as string | undefined,
        token: form.token as string | undefined,
        encodingAesKey: form.encodingAesKey as string | undefined,
        corpId: form.corpId as string | undefined,
      } as PlatformConfig
    case 'qq':
      return {
        platform: p,
        mode: (form.mode as string) || 'qrcode',
        appId: form.appId as string | undefined,
        appSecret: form.appSecret as string | undefined,
      } as PlatformConfig
    case 'feishu':
      return {
        platform: p,
        mode: (form.mode as string) || 'websocket',
        appId: form.appId as string | undefined,
        appSecret: form.appSecret as string | undefined,
        encryptKey: form.encryptKey as string | undefined,
      } as PlatformConfig
    case 'dingtalk':
      return {
        platform: p,
        appKey: form.appKey as string | undefined,
        appSecret: form.appSecret as string | undefined,
      } as PlatformConfig
    case 'yuanbao':
      return {
        platform: p,
        appId: form.appId as string | undefined,
        appSecret: form.appSecret as string | undefined,
      } as PlatformConfig
    default:
      return { platform: p } as PlatformConfig
  }
}
