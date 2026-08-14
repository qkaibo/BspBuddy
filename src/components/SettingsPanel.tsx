// ============================================================
// SettingsPanel — 左右两栏：左分类 / 右内容
// ============================================================

import { useState, useEffect, useCallback, type CSSProperties, type ReactNode } from 'react'
import {
  ArrowLeft,
  Globe,
  Type,
  Eye,
  Shield,
  Moon,
  Download,
  Smartphone,
  Server,
  Users,
  UserRound,
  Cpu,
  KeyRound,
  Database,
  Palette,
} from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS, DEFAULT_SETTINGS } from '../lib/types'
import type { AppSettings, AppLanguage } from '../lib/types'
import type { AuthMeResult, PublicUser } from '../lib/auth-types'
import { roleLabel } from '../lib/auth-types'
import { panelRootStyle } from '../lib/panel-layout'
import { hasDesktopIPC } from '../lib/capabilities'
import { A2AAccessPanel } from './A2AAccessPanel'

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
  /** 打开设置时默认选中的左栏分类 */
  initialSection?: SettingsSectionId
}

type MePayload = AuthMeResult & { phase1Local?: boolean; tenantName?: string; error?: string }

export type SettingsSectionId =
  | 'account'
  | 'members'
  | 'ai'
  | 'expert-models'
  | 'a2a'
  | 'appearance'
  | 'assistant'
  | 'data'
  | 'update'

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
  initialSection = 'account',
}: Props) {
  const [section, setSection] = useState<SettingsSectionId>(initialSection)
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

  useEffect(() => {
    setSection(initialSection)
  }, [initialSection])

  const update = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    await ipc.invoke(IPC_CHANNELS.SETTINGS_SET, key, value)
    setSettings(prev => ({ ...prev, [key]: value }))
    if (key === 'language' && onLanguageChange) {
      onLanguageChange(value as AppLanguage)
    }
  }

  const navItems: Array<{
    id: SettingsSectionId
    label: string
    icon: ReactNode
    visible?: boolean
  }> = [
    { id: 'account', label: '当前账号', icon: <UserRound size={14} strokeWidth={1.75} /> },
    { id: 'members', label: '成员与角色', icon: <Users size={14} strokeWidth={1.75} />, visible: Boolean(onNavigateMembers) },
    { id: 'ai', label: 'AI 设置', icon: <Cpu size={14} strokeWidth={1.75} />, visible: Boolean(onNavigateModelConfig) },
    { id: 'expert-models', label: '专家模型', icon: <Server size={14} strokeWidth={1.75} />, visible: Boolean(onNavigateExpertModels) },
    { id: 'a2a', label: 'A2A 接入', icon: <KeyRound size={14} strokeWidth={1.75} /> },
    { id: 'appearance', label: '外观与行为', icon: <Palette size={14} strokeWidth={1.75} /> },
    { id: 'assistant', label: '远程助理', icon: <Smartphone size={14} strokeWidth={1.75} />, visible: Boolean(onNavigateAssistant && hasDesktopIPC()) },
    { id: 'data', label: '数据管理', icon: <Database size={14} strokeWidth={1.75} />, visible: Boolean(onNavigateData) },
    { id: 'update', label: '版本更新', icon: <Download size={14} strokeWidth={1.75} />, visible: Boolean(onCheckUpdate && hasDesktopIPC()) },
  ]

  return (
    <div style={panelRootStyle()}>
      <div style={headerStyle}>
        <button type="button" onClick={onClose} aria-label="返回" style={iconBtnStyle}>
          <ArrowLeft size={16} color="var(--text-secondary)" aria-hidden="true" />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>系统设置</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* Left: categories */}
        <nav
          aria-label="设置分类"
          style={{
            width: 168,
            flexShrink: 0,
            borderRight: '1px solid var(--border-subtle, #eef1f6)',
            background: 'var(--bg-sidebar, var(--bg-input))',
            padding: '10px 8px',
            overflowY: 'auto',
          }}
        >
          {navItems.filter((item) => item.visible !== false).map((item) => {
            const active = section === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                aria-current={active ? 'page' : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  marginBottom: 2,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  textAlign: 'left',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: active ? 'var(--bg-card)' : 'transparent',
                  boxShadow: active ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
                }}
              >
                <span style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)', display: 'flex' }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Right: content */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {section === 'a2a' ? (
            <A2AAccessPanel embedded />
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {section === 'account' && (
                <AccountPane
                  me={me}
                  switchMembers={switchMembers}
                  authBusy={authBusy}
                  authMsg={authMsg}
                  setAuthBusy={setAuthBusy}
                  setAuthMsg={setAuthMsg}
                  loadAuth={loadAuth}
                  onSessionChanged={onSessionChanged}
                />
              )}
              {section === 'members' && onNavigateMembers && (
                <LinkPane
                  title="成员与角色"
                  description="管理租户成员与角色（管理员）。此处为身份与 RBAC；Agent「默认权限」工具沙箱见对话输入框旁下拉，二者无关。"
                  actionLabel="打开成员管理"
                  onAction={onNavigateMembers}
                />
              )}
              {section === 'ai' && onNavigateModelConfig && (
                <LinkPane
                  title="AI 设置"
                  description="管理 AI 模型配置（API 密钥、默认模型、本机/云端存储）。"
                  actionLabel="打开 AI 模型配置"
                  onAction={onNavigateModelConfig}
                />
              )}
              {section === 'expert-models' && onNavigateExpertModels && (
                <LinkPane
                  title="专家模型"
                  description="专家 Agent 使用的模型目录，独立于用户个人模型。管理员统一维护，所有专家共享。"
                  actionLabel="打开专家模型目录"
                  onAction={onNavigateExpertModels}
                />
              )}
              {section === 'appearance' && (
                <AppearancePane settings={settings} update={update} />
              )}
              {section === 'assistant' && onNavigateAssistant && (
                <LinkPane
                  title="远程助理"
                  description="管理 IM 平台绑定与助理设置。"
                  actionLabel="打开远程助理设置"
                  onAction={onNavigateAssistant}
                />
              )}
              {section === 'data' && onNavigateData && (
                <LinkPane
                  title="数据管理"
                  description="查看分享文件与归档任务。"
                  actionLabel="打开数据管理"
                  onAction={onNavigateData}
                />
              )}
              {section === 'update' && onCheckUpdate && (
                <LinkPane
                  title="版本更新"
                  description="检查桌面端是否有新版本。"
                  actionLabel="检查更新"
                  onAction={onCheckUpdate}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AccountPane({
  me,
  switchMembers,
  authBusy,
  authMsg,
  setAuthBusy,
  setAuthMsg,
  loadAuth,
  onSessionChanged,
}: {
  me: MePayload | null
  switchMembers: PublicUser[]
  authBusy: boolean
  authMsg: string | null
  setAuthBusy: (v: boolean) => void
  setAuthMsg: (v: string | null) => void
  loadAuth: () => Promise<void>
  onSessionChanged?: () => void
}) {
  return (
    <>
      <PaneTitle>当前账号</PaneTitle>
      {me?.user ? (
        <div style={cardStyle}>
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
                style={selectStyle}
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
            style={secondaryBtnStyle}
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
    </>
  )
}

function AppearancePane({
  settings,
  update,
}: {
  settings: AppSettings
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>
}) {
  return (
    <>
      <PaneTitle>外观与行为</PaneTitle>

      <SubBlock icon={<Globe size={14} />} title="语言">
        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { value: 'zh-CN' as AppLanguage, label: '中文(简体)' },
            { value: 'en-US' as AppLanguage, label: 'English' },
          ]).map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => void update('language', opt.value)}
              aria-pressed={settings.language === opt.value}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: settings.language === opt.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: settings.language === opt.value ? 'var(--accent-light)' : 'var(--bg-card)',
                color: settings.language === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: settings.language === opt.value ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SubBlock>

      <SubBlock icon={<Type size={14} />} title="字体大小">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>小</span>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-input)', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: -4,
                height: 12,
                width: 4,
                borderRadius: 2,
                background: 'var(--accent)',
                left: `${((settings.fontSize - 10) / 14) * 100}%`,
                transition: 'left .1s ease',
              }}
            />
            <input
              type="range"
              min={10}
              max={24}
              value={settings.fontSize}
              onChange={(e) => void update('fontSize', Number(e.target.value))}
              aria-label="字体大小"
              name="font-size"
              style={{
                width: '100%',
                height: 12,
                opacity: 0,
                cursor: 'pointer',
                position: 'absolute',
                top: -4,
                margin: 0,
              }}
            />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>大</span>
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-primary)', textAlign: 'center' }}>
          当前: {settings.fontSize}px
        </div>
      </SubBlock>

      <SubBlock icon={<Eye size={14} />} title="简洁模式">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            隐藏装饰元素，折叠工具调用过程
          </span>
          <Toggle
            checked={settings.compactMode}
            onChange={() => void update('compactMode', !settings.compactMode)}
            label="简洁模式"
          />
        </div>
      </SubBlock>

      {hasDesktopIPC() && (
        <SubBlock icon={<Shield size={14} />} title="非高风险自动安装">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>非高风险 Skill 自动继续安装</span>
              <br />
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>高风险 Skill 始终需要手动确认</span>
            </div>
            <Toggle
              checked={settings.autoInstallNonRisky}
              onChange={() => void update('autoInstallNonRisky', !settings.autoInstallNonRisky)}
              label="非高风险自动安装"
            />
          </div>
        </SubBlock>
      )}

      {hasDesktopIPC() && (
        <SubBlock icon={<Moon size={14} />} title="防休眠">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>开启后电脑不进入休眠</span>
              <br />
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>方便手机远程操控、自动化任务持续进行</span>
            </div>
            <Toggle
              checked={settings.preventSleep}
              onChange={() => void update('preventSleep', !settings.preventSleep)}
              label="防休眠"
            />
          </div>
        </SubBlock>
      )}
    </>
  )
}

function LinkPane({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <>
      <PaneTitle>{title}</PaneTitle>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {description}
      </p>
      <button type="button" className="bb-btn bb-btn-primary" onClick={onAction}>
        {actionLabel}
      </button>
    </>
  )
}

function PaneTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
      {children}
    </div>
  )
}

function SubBlock({ icon, title, children }: { icon?: ReactNode; title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon && <span style={{ color: 'var(--text-secondary)', display: 'flex' }}>{icon}</span>}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      {children}
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
        width: 40,
        height: 22,
        borderRadius: 11,
        border: 'none',
        background: checked ? 'var(--accent)' : 'var(--border)',
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        transition: 'background .2s ease',
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          transition: 'left .2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }}
      />
    </button>
  )
}

const headerStyle: CSSProperties = {
  height: 44,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 16px',
  background: 'var(--bg-card)',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}

const iconBtnStyle: CSSProperties = {
  padding: 4,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  borderRadius: 4,
}

const cardStyle: CSSProperties = {
  padding: 12,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
}

const selectStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  boxSizing: 'border-box',
  padding: '6px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontFamily: 'inherit',
}

const secondaryBtnStyle: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
