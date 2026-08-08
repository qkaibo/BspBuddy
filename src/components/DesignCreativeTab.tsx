// ============================================================
// 设计创意 Tab — 新建任务时作为 Ask/Craft/Plan 之外的第四个 Tab
// 对应 SPEC: Design-Idea.md, 12-1
// ============================================================
import { useState, useCallback, useEffect } from 'react'
import { Palette, ExternalLink, Code, RefreshCw, AlertTriangle, Check } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { ArdotCanvas, ArdotServiceStatus, DesignType, DesignExportFormat } from '../lib/design-types'
import { DESIGN_TYPES } from '../lib/design-types'

const ipc = createIpcClient()

interface Props {
  onBack?: () => void
  onSendToChat?: (designDescription: string) => void
}

export function DesignCreativeTab({ onBack, onSendToChat }: Props) {
  const [status, setStatus] = useState<ArdotServiceStatus | null>(null)
  const [canvas, setCanvas] = useState<ArdotCanvas | null>(null)
  const [prompt, setPrompt] = useState('')
  const [designType, setDesignType] = useState<DesignType>('ui')
  const [isGenerating, setIsGenerating] = useState(false)
  const [editInstruction, setEditInstruction] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [exportFormat, setExportFormat] = useState<DesignExportFormat>('html')
  const [exportedCode, setExportedCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [phone, setPhone] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      const s = await ipc.invoke(IPC_CHANNELS.DESIGN_CONNECT, 'status') as ArdotServiceStatus
      setStatus(s)
      if (s.activeCanvas) setCanvas(s.activeCanvas)
    } catch {
      // IPC not yet registered
    }
  }

  const handleConnect = async () => {
    if (!phone) return
    setIsConnecting(true)
    try {
      const result = await ipc.invoke(IPC_CHANNELS.DESIGN_CONNECT, phone) as { success: boolean; message: string }
      if (result.success) await loadStatus()
    } finally {
      setIsConnecting(false)
    }
  }

  const handleGenerate = async () => {
    if (!prompt) return
    setIsGenerating(true)
    try {
      const result = await ipc.invoke(IPC_CHANNELS.DESIGN_GENERATE, { description: prompt, type: designType }) as { canvas: ArdotCanvas; message: string }
      setCanvas(result.canvas)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleEdit = async () => {
    if (!editInstruction) return
    setIsEditing(true)
    try {
      const result = await ipc.invoke(IPC_CHANNELS.DESIGN_EDIT, { instruction: editInstruction }) as { canvas: ArdotCanvas; changes: string[] }
      setCanvas(result.canvas)
      setEditInstruction('')
    } finally {
      setIsEditing(false)
    }
  }

  const handleExport = async (format: DesignExportFormat) => {
    setExportFormat(format)
    try {
      const result = await ipc.invoke(IPC_CHANNELS.DESIGN_EXPORT, { format }) as { code: string; format: string }
      setExportedCode(result.code)
    } catch {
      // fallback
    }
  }

  const copyCode = () => {
    if (exportedCode) {
      navigator.clipboard.writeText(exportedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenInArdot = () => {
    window.open('https://ardot.woa.com', '_blank')
  }

  const handleSync = async () => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.DESIGN_SYNC) as ArdotCanvas | null
      if (result) setCanvas(result)
    } catch {
      // ...
    }
  }

  const s = (k: string, v: string) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v};`

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-root)' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack && (
            <button onClick={onBack} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
              ← Back
            </button>
          )}
          <Palette size={18} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Design Creative</span>
          {status && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 10,
              background: status.authState.connected ? 'rgba(34,197,94,.15)' : 'rgba(251,191,36,.15)',
              color: status.authState.connected ? '#16a34a' : '#b45309',
            }}>
              {status.authState.connected ? 'Ardot Connected' : 'Mock Mode'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleOpenInArdot} style={topBtnStyle}>
            <ExternalLink size={13} /> Open in Browser
          </button>
          <button onClick={() => handleExport('react')} style={{ ...topBtnStyle, background: 'var(--accent)', color: '#fff' }}>
            <Code size={13} /> Generate App
          </button>
        </div>
      </div>

      {/* Mock mode notice */}
      {status && !status.authState.connected && (
        <div style={{
          margin: '12px 16px 0', padding: '10px 14px', borderRadius: 8,
          background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.3)',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#b45309', flexShrink: 0,
        }}>
          <AlertTriangle size={14} />
          <span style={{ flex: 1 }}>{status.message}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              style={{
                width: 140, padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(251,191,36,.5)',
                fontSize: 12, outline: 'none', background: 'var(--bg-input)',
              }}
            />
            <button onClick={handleConnect} disabled={isConnecting || !phone} style={{
              padding: '4px 12px', borderRadius: 4, border: 'none', fontSize: 11, fontWeight: 600,
              background: 'var(--accent)', color: '#fff', cursor: phone ? 'pointer' : 'not-allowed', opacity: phone ? 1 : .5,
            }}>
              {isConnecting ? '...' : 'Connect'}
            </button>
          </div>
        </div>
      )}

      {/* Main content: Left input + Right canvas */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Input panel */}
        <div style={{
          width: 320, borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', padding: 16, gap: 14, flexShrink: 0,
          overflowY: 'auto', background: 'var(--bg-card)',
        }}>
          <div>
            <label style={labelStyle}>Design Type</label>
            <select
              value={designType}
              onChange={(e) => setDesignType(e.target.value as DesignType)}
              style={selectStyle}
            >
              {DESIGN_TYPES.map((dt) => (
                <option key={dt.id} value={dt.id}>{dt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Describe your design</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Design a mobile login page with email and password fields..."
              rows={4}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-input)',
                color: 'var(--text-primary)', outline: 'none', resize: 'vertical',
              }}
            />
          </div>

          <button onClick={handleGenerate} disabled={isGenerating || !prompt} style={{
            width: '100%', padding: '10px', borderRadius: 8, border: 'none',
            background: prompt ? 'var(--accent)' : 'var(--border)',
            color: prompt ? '#fff' : 'var(--text-tertiary)',
            fontSize: 13, fontWeight: 600, cursor: prompt ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {isGenerating ? 'Generating...' : (<><Palette size={14} /> Generate Design</>)}
          </button>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <label style={labelStyle}>Edit Design</label>
            <textarea
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
              placeholder="e.g. Change the button to blue, make the title larger..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-input)',
                color: 'var(--text-primary)', outline: 'none', resize: 'vertical',
              }}
            />
            <button onClick={handleEdit} disabled={isEditing || !editInstruction} style={{
              width: '100%', marginTop: 8, padding: '8px', borderRadius: 6, border: 'none',
              background: editInstruction ? 'var(--accent)' : 'var(--border)',
              color: editInstruction ? '#fff' : 'var(--text-tertiary)',
              fontSize: 12, fontWeight: 600, cursor: editInstruction ? 'pointer' : 'not-allowed',
            }}>
              {isEditing ? 'Editing...' : 'Edit Canvas'}
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <label style={labelStyle}>Export Format</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['html', 'react', 'vue'] as DesignExportFormat[]).map((f) => (
                <button key={f} onClick={() => handleExport(f)} style={{
                  flex: 1, padding: '6px', borderRadius: 6, border: '1px solid var(--border)',
                  background: exportFormat === f ? 'var(--accent-light)' : 'transparent',
                  color: exportFormat === f ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSync} style={{
            width: '100%', padding: '6px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-secondary)', fontSize: 12,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <RefreshCw size={12} /> Sync Canvas
          </button>
        </div>

        {/* Right: Canvas preview + code output */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Canvas area */}
          <div style={{ flex: 1, padding: 24, overflow: 'auto', background: '#f8f9fb' }}>
            <div style={{
              maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: 16,
              boxShadow: '0 4px 32px rgba(0,0,0,.08)', minHeight: 400, position: 'relative',
              padding: canvas ? 0 : 60,
              display: canvas ? 'block' : 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {canvas ? (
                <div style={{ position: 'relative', minHeight: 400, padding: '40px 0' }}>
                  {canvas.elements.map((el) => {
                    const style: React.CSSProperties = {
                      position: 'absolute', left: el.x, top: el.y,
                      width: el.width, height: el.height,
                      boxSizing: 'border-box',
                    }
                    // Apply style properties
                    if (el.style.backgroundColor) style.backgroundColor = el.style.backgroundColor
                    if (el.style.borderRadius) style.borderRadius = el.style.borderRadius
                    if (el.style.border) style.border = el.style.border
                    if (el.style.color) style.color = el.style.color
                    if (el.style.fontSize) style.fontSize = el.style.fontSize
                    if (el.style.fontWeight) style.fontWeight = el.style.fontWeight
                    if (el.style.padding) style.padding = el.style.padding
                    if (el.style.textAlign) style.textAlign = el.style.textAlign as any

                    if (el.type === 'text') {
                      return <div key={el.id} style={style}>{el.content}</div>
                    }
                    if (el.type === 'button') {
                      return (
                        <button key={el.id} style={{ ...style, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {el.content || 'Button'}
                        </button>
                      )
                    }
                    if (el.type === 'input') {
                      return <input key={el.id} placeholder={el.content || ''} style={{ ...style, outline: 'none' }} readOnly />
                    }
                    return <div key={el.id} style={style} />
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <Palette size={40} style={{ marginBottom: 12, opacity: .3 }} />
                  <div style={{ fontSize: 14, marginBottom: 4 }}>Canvas Preview</div>
                  <div style={{ fontSize: 11 }}>Enter a prompt and click "Generate" to create a design</div>
                </div>
              )}
            </div>
          </div>

          {/* Code output */}
          {exportedCode && (
            <div style={{ height: 200, borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Generated Code ({exportFormat.toUpperCase()})</span>
                <button onClick={copyCode} style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 4,
                  border: 'none', background: copied ? '#16a34a' : 'var(--accent)',
                  color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {copied ? <Check size={12} /> : <Code size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre style={{
                flex: 1, margin: 0, padding: '12px 16px', overflow: 'auto',
                fontSize: 11, fontFamily: 'SF Mono, Consolas, monospace',
                background: '#1e1e2e', color: '#cdd6f4', lineHeight: 1.6,
              }}>
                {exportedCode}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const topBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
  borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 6,
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-input)',
  color: 'var(--text-primary)', outline: 'none',
}
