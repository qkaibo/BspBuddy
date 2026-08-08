// ============================================================
// SettingsPanel — Language, font size, compact mode, etc.
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Globe, Type, Eye, Shield, Moon, Download, Smartphone } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS, DEFAULT_SETTINGS } from '../lib/types'
import type { AppSettings, AppLanguage } from '../lib/types'

const ipc = createIpcClient()

interface Props {
  onClose: () => void
  onNavigateData?: () => void
  onNavigateAssistant?: () => void
  onCheckUpdate?: () => void
  onLanguageChange?: (lang: AppLanguage) => void
}

export function SettingsPanel({ onClose, onNavigateData, onNavigateAssistant, onCheckUpdate, onLanguageChange }: Props) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  const loadSettings = useCallback(async () => {
    const result = await ipc.invoke(IPC_CHANNELS.SETTINGS_GET_ALL) as AppSettings
    setSettings(result)
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  const update = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    await ipc.invoke(IPC_CHANNELS.SETTINGS_SET, key, value)
    setSettings(prev => ({ ...prev, [key]: value }))
    if (key === 'language' && onLanguageChange) {
      onLanguageChange(value as AppLanguage)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', overflow: 'hidden' }}>
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}>
          <ArrowLeft size={16} color="var(--text-secondary)" />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>系统设置</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <Section icon={<Globe size={16} />} title="语言">
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { value: 'zh-CN' as AppLanguage, label: '中文(简体)' },
              { value: 'en-US' as AppLanguage, label: 'English' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => update('language', opt.value)}
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
            <Toggle checked={settings.compactMode} onChange={() => update('compactMode', !settings.compactMode)} />
          </div>
        </Section>

        <Section icon={<Shield size={16} />} title="非高风险自动安装">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>非高风险 Skill 自动继续安装</span>
              <br />
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>高风险 Skill 始终需要手动确认</span>
            </div>
            <Toggle checked={settings.autoInstallNonRisky} onChange={() => update('autoInstallNonRisky', !settings.autoInstallNonRisky)} />
          </div>
        </Section>

        <Section icon={<Moon size={16} />} title="防休眠">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>开启后电脑不进入休眠</span>
              <br />
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>方便手机远程操控、自动化任务持续进行</span>
            </div>
            <Toggle checked={settings.preventSleep} onChange={() => update('preventSleep', !settings.preventSleep)} />
          </div>
        </Section>

        {onNavigateAssistant && (
          <Section icon={<Smartphone size={16} />} title="远程助理">
            <button
              onClick={onNavigateAssistant}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>管理 IM 平台绑定与助理设置</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>→</span>
            </button>
          </Section>
        )}

        {onNavigateData && (
          <Section title="数据管理">
            <button
              onClick={onNavigateData}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>查看分享文件与归档任务</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>→</span>
            </button>
          </Section>
        )}

        {onCheckUpdate && (
          <Section icon={<Download size={16} />} title="版本更新">
            <button
              onClick={onCheckUpdate}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>检查更新</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>→</span>
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

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
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
