import { useMemo, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'

const ipc = createIpcClient()

interface Props {
  slug: string
  accessLevel: string
  canInvoke: boolean
  onRequestAccess?: () => void
}

export function SkillInstallPanel({ slug, accessLevel, canInvoke, onRequestAccess }: Props) {
  const [platform, setPlatform] = useState<'cursor' | 'bspbuddy'>('cursor')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const levelHint = useMemo(() => {
    if (accessLevel === 'L3') return 'L3：需使用授权后才能生成可执行安装指令'
    if (accessLevel === 'L2') return 'L2：可安装调用；ZIP 下载另需授权'
    return 'L1：登录用户可调用并下载'
  }, [accessLevel])

  async function loadPrompt() {
    if (!canInvoke) {
      setError('当前无权调用该技能')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_INSTALL_PROMPT, slug, platform) as {
        prompt_text?: string
        error?: string
        detail?: { message?: string }
      }
      if (!res?.prompt_text) {
        setError(res?.detail?.message || res?.error || '无法生成安装指令')
        setPrompt('')
        return
      }
      setPrompt(res.prompt_text)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function copyPrompt() {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('复制失败，请手动选择文本')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--bb-muted)' }}>{levelHint}</div>
      {!canInvoke ? (
        <button type="button" className="bb-btn bb-btn-primary" onClick={onRequestAccess}>
          申请使用
        </button>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12 }}>
              <input
                type="radio"
                checked={platform === 'cursor'}
                onChange={() => setPlatform('cursor')}
              />{' '}
              Cursor
            </label>
            <label style={{ fontSize: 12 }}>
              <input
                type="radio"
                checked={platform === 'bspbuddy'}
                onChange={() => setPlatform('bspbuddy')}
              />{' '}
              BspBuddy
            </label>
            <button type="button" className="bb-btn" onClick={() => void loadPrompt()} disabled={loading}>
              {loading ? '生成中…' : '生成安装指令'}
            </button>
            <button type="button" className="bb-btn" onClick={() => void copyPrompt()} disabled={!prompt}>
              {copied ? <Check size={14} strokeWidth={1.75} /> : <Copy size={14} strokeWidth={1.75} />}
              <span style={{ marginLeft: 4 }}>{copied ? '已复制' : '复制'}</span>
            </button>
          </div>
          {error ? <div style={{ color: '#b91c1c', fontSize: 12 }}>{error}</div> : null}
          {prompt ? (
            <pre
              style={{
                margin: 0,
                padding: 12,
                borderRadius: 8,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                whiteSpace: 'pre-wrap',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {prompt}
            </pre>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--bb-muted)' }}>
              点击「生成安装指令」后可一键复制给 Agent。凭证不会出现在指令里。
            </div>
          )}
        </>
      )}
    </div>
  )
}
