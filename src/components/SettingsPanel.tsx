// ============================================================
// SettingsPanel — Language, font size, compact mode, etc.
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Globe, Type, Eye, Shield, Moon, Download, Smartphone, Server, Users, UserRound, Cpu } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS, DEFAULT_SETTINGS } from '../lib/types'
import type { AppSettings, AppLanguage } from '../lib/types'
import type { AuthMeResult, PublicUser } from '../lib/auth-types'
import { roleLabel } from '../lib/auth-types'
import { panelRootStyle } from '../lib/panel-layout'
import { hasAutoUpdater, hasDesktopIPC } from '../lib/capabilities'

const ipc = createIpcClient()

interface Props {
  onClose: () => void
  onNavigateData?: () => void
  onNavigateAssistant?: () => void
  onNavigateMembers?: () => void
  onNavigateModelConfig?: () => void
  onNavigateExpertModels?: () => void
  onCheckUpdate?: () => void
  onLanguageChange?: (lang: AppLanguage) => void
  onSessionChanged?: () => void
}

type MePayload = AuthMeResult & { phase1Local?: boolean; tenantName?: string; error?: string }

export function SettingsPanel({
  onClose,
  onNavigateData,
  onNavigateAssistant,
  onNavigateMembers,
  onNavigateModelConfig,
  onNavigateExpertModels,
  onCheckUpdate,
  onLanguageChange,
  onSessionChanged,
}: Props) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [me, setMe] = useState<MePayload | null>(null)
  const [switchMembers, setSwitchMembers] = useState<PublicUser[]>([])
  const [authBusy, setAuthBusy] = useState(false)
  const [authMsg, setAuthMsg] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    const result = await ipc.invoke(IPC_CHANNELS.SETTINGS_GET_ALL) as AppSettings
    setSettings(result)
  }, [])

  const loadAuth = useCallback(async () => {
    try {
      const meRes = await ipc.invoke(IPC_CHANNELS.AUTH_ME) as MePayload
      if (meRes?.error || !meRes?.user) {
        setMe(null)
        setSwitchMembers([])
        return
      }
      setMe(meRes)
      const list = await ipc.invoke(IPC_CHANNELS.AUTH_MEMBERS_FOR_SWITCH) as { items?: PublicUser[]; error?: string }
      setSwitchMembers(list?.items || [])
    } catch {
      setMe(null)
    }
  }, [])

  useEffect(() => {
    loadSettings()
    loadAuth()
  }, [loadSettings, loadAuth])

  const update = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    await ipc.invoke(IPC_CHANNELS.SETTINGS_SET, key, value)
    setSettings(prev => ({ ...prev, [key]: value }))
    if (key === 'language' && onLanguageChange) {
      onLanguageChange(value as AppLanguage)
    }
  }

  return (
    <div style={panelRootStyle()}>
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button type="button" onClick={onClose} aria-label="返回" style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}>
          <ArrowLeft size={16} color="var(--text-secondary)" aria-hidden="true" />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>系统设置</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <Section icon={<UserRound size={16} />} title="当前账号">
          {me?.user ? (
            <div style={{
              padding: 12, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--bg-card)',
            }}>
              {me.phase1Local && (
                <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 8 }}>
                  Phase 1 本地开发会话（模拟）
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>
                显示名：{me.user.displayName || me.user.username}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                用户名：{me.user.username}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                角色：{me.user.roles.map(roleLabel).join('、')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                租户：{me.tenantName || me.user.tenantId}
              </div>
              {switchMembers.length > 1 && (
                <label style={{ display: 'block', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>切换模拟用户</span>
                  <select
                    aria-label="切换模拟用户"
                    value={me.user.id}
                    disabled={authBusy}
                    onChange={async (e) => {
                      setAuthBusy(true)
                      setAuthMsg(null)
                      try {
                        const res = await ipc.invoke(IPC_CHANNELS.AUTH_SWITCH_USER, e.target.value) as { error?: string }
                        if (res?.error) setAuthMsg(res.error)
                        else {
                          setAuthMsg('已切换会话')
                          await loadAuth()
                          onSessionChanged?.()
                        }
                      } finally {
                        setAuthBusy(false)
                      }
                    }}
                    style={{
                      display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box',
                      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)', background: 'var(--bg-input)',
                      color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
                    }}
                  >
                    {switchMembers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName || u.username}（{u.roles.map(roleLabel).join('/')}）
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                disabled={authBusy}
                onClick={async () => {
                  setAuthBusy(true)
                  try {
                    await ipc.invoke(IPC_CHANNELS.AUTH_LOGOUT)
                    // Phase 1: re-seed local admin session so app stays usable
                    await ipc.invoke(IPC_CHANNELS.AUTH_LOGIN, {
                      tenantId: 'local',
                      username: 'admin',
                      password: 'admin',
                    })
                    setAuthMsg('已重新进入本地管理员会话')
                    await loadAuth()
                    onSessionChanged?.()
                  } finally {
                    setAuthBusy(false)
                  }
                }}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                重置为本地管理员
              </button>
              {authMsg && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent)' }}>{authMsg}</div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>会话未就绪</div>
          )}
        </Section>

        {onNavigateMembers && (
          <Section icon={<Users size={16} />} title="成员与角色">
            <button
              type="button"
              onClick={onNavigateMembers}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>管理租户成员与角色（管理员）</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }} aria-hidden="true">→</span>
            </button>
            <p style={{ margin: '8px 0 0', fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
              此处为身份与 RBAC。Agent「默认权限」工具沙箱见对话输入框旁下拉，二者无关。
            </p>
          </Section>
        )}

        {onNavigateModelConfig && (
          <Section icon={<Cpu size={16} />} title="AI 设置">
            <button
              type="button"
              onClick={onNavigateModelConfig}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>管理 AI 模型配置（API 密钥、默认模型）</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }} aria-hidden="true">→</span>
            </button>
          </Section>
        )}

        {onNavigateExpertModels && (
          <Section icon={<Server size={16} />} title="专家模型">
            <button
              type="button"
              onClick={onNavigateExpertModels}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>管理专家可用模型目录（管理员）</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }} aria-hidden="true">→</span>
            </button>
            <p style={{ margin: '8px 0 0', fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
              专家 Agent 使用的模型，独立于用户个人模型。管理员统一维护，所有专家共享。
            </p>
          </Section>
        )}

        <Section icon={<Globe size={16} />} title="语言">
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { value: 'zh-CN' as AppLanguage, label: '中文(简体)' },
              { value: 'en-US' as AppLanguage, label: 'English' },
            ]).map(opt => (
              <button
                type="button"
                key={opt.value}
                onClick={() => update('language', opt.value)}
                aria-pressed={settings.language === opt.value}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                  border: settings.language === opt.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: settings.language === opt.value ? 'var(--accent-light)' : 'var(--bg-card)',
                  color: settings.language === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: settings.language === opt.value ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={<Type size={16} />} title="字体大小">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>小</span>
            <div style={{
              flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-input)', position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: -4, height: 12, width: 4, borderRadius: 2,
                background: 'var(--accent)', left: `${((settings.fontSize - 10) / 14) * 100}%`,
                transition: 'left .1s ease',
              }} />
              <input
                type="range"
                min={10} max={24} value={settings.fontSize}
                onChange={e => update('fontSize', Number(e.target.value))}
                aria-label="字体大小"
                name="font-size"
                style={{
                  width: '100%', height: 12, opacity: 0, cursor: 'pointer',
                  position: 'absolute', top: -4, margin: 0,
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>大</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-primary)', textAlign: 'center' }}>
            当前: {settings.fontSize}px
          </div>
        </Section>

        <Section icon={<Eye size={16} />} title="简洁模式">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              隐藏装饰元素，折叠工具调用过程
            </span>
            <Toggle checked={settings.compactMode} onChange={() => update('compactMode', !settings.compactMode)} label="简洁模式" />
          </div>
        </Section>

        {hasDesktopIPC() && (
        <Section icon={<Shield size={16} />} title="非高风险自动安装">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>非高风险 Skill 自动继续安装</span>
              <br />
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>高风险 Skill 始终需要手动确认</span>
            </div>
            <Toggle checked={settings.autoInstallNonRisky} onChange={() => update('autoInstallNonRisky', !settings.autoInstallNonRisky)} label="非高风险自动安装" />
          </div>
        </Section>
        )}

        {hasDesktopIPC() && (
        <Section icon={<Moon size={16} />} title="防休眠">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>开启后电脑不进入休眠</span>
              <br />
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>方便手机远程操控、自动化任务持续进行</span>
            </div>
            <Toggle checked={settings.preventSleep} onChange={() => update('preventSleep', !settings.preventSleep)} label="防休眠" />
          </div>
        </Section>
        )}

        {onNavigateAssistant && hasDesktopIPC() && (
          <Section icon={<Smartphone size={16} />} title="远程助理">
            <button
              type="button"
              onClick={onNavigateAssistant}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>管理 IM 平台绑定与助理设置</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }} aria-hidden="true">→</span>
            </button>
          </Section>
        )}

        {onNavigateData && (
          <Section title="数据管理">
            <button
              type="button"
              onClick={onNavigateData}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>查看分享文件与归档任务</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }} aria-hidden="true">→</span>
            </button>
          </Section>
        )}

        {onCheckUpdate && hasDesktopIPC() && (
          <Section icon={<Download size={16} />} title="版本更新">
            <button
              type="button"
              onClick={onCheckUpdate}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>检查更新</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }} aria-hidden="true">→</span>
            </button>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon && <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      <div style={{ paddingLeft: icon ? 22 : 0 }}>
        {children}
      </div>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none',
        background: checked ? 'var(--accent)' : 'var(--border)',
        cursor: 'pointer', position: 'relative', flexShrink: 0,
        transition: 'background .2s ease',
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 8,
        background: '#fff', position: 'absolute',
        top: 3, left: checked ? 21 : 3,
        transition: 'left .2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </button>
  )
}
