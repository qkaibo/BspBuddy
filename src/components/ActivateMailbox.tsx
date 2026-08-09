// ============================================================
// 邮箱开通流程 — 协议同意 + SMS 验证
// 对应 SPEC: Mailbox.md, 13-4
// ============================================================
import { useState } from 'react'
import { Mail, Shield, Smartphone, CheckCircle2, ChevronRight, AlertTriangle } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { ActivationStep, ActivationState, AgentMailbox } from '../lib/mailbox-types'
import { panelRootStyle } from '../lib/panel-layout'

const ipc = createIpcClient()

interface Props {
  onComplete?: (mailbox: AgentMailbox) => void
  onBack?: () => void
}

export function ActivateMailbox({ onComplete, onBack }: Props) {
  const [step, setStep] = useState<ActivationStep>('agreement')
  const [agreed, setAgreed] = useState(false)
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [mailbox, setMailbox] = useState<AgentMailbox | null>(null)
  const [isActivating, setIsActivating] = useState(false)

  const handleAgree = async () => {
    try {
      await ipc.invoke(IPC_CHANNELS.MAILBOX_ACTIVATE, 'agree')
      setStep('sms_verify')
    } catch {
      setStep('sms_verify')
    }
  }

  const handleSendCode = async () => {
    if (!phone) return
    setSendingCode(true)
    setError('')
    try {
      const result = await ipc.invoke(IPC_CHANNELS.MAILBOX_ACTIVATE, 'send-code', phone) as { success: boolean; message: string }
      if (!result.success) setError(result.message)
    } catch {
      // mock fallback
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerify = async () => {
    if (!smsCode || smsCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }
    setVerifying(true)
    setError('')
    try {
      const result = await ipc.invoke(IPC_CHANNELS.MAILBOX_ACTIVATE, 'verify', smsCode) as { success: boolean; mailbox?: AgentMailbox; error?: string }
      if (result.success && result.mailbox) {
        setMailbox(result.mailbox)
        setStep('complete')
        if (onComplete) onComplete(result.mailbox)
      } else {
        setError(result.error || 'Verification failed')
      }
    } catch {
      setError('Verification failed. In mock mode, try code 123456.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div style={panelRootStyle()}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)',
      }}>
        {onBack && (
          <button type="button" onClick={onBack} aria-label="返回" style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
            ←
          </button>
        )}
        <Mail size={20} color="var(--accent)" />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Activate Mailbox</span>
      </div>

      {/* Steps indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0,
        padding: '20px 40px', flexShrink: 0,
      }}>
        {([
          { id: 'agreement' as const, label: 'Agreement', icon: Shield },
          { id: 'sms_verify' as const, label: 'SMS Verify', icon: Smartphone },
          { id: 'complete' as const, label: 'Complete', icon: CheckCircle2 },
        ]).map((s, i) => {
          const isActive = step === s.id
          const isDone = (step === 'sms_verify' && s.id === 'agreement') ||
            (step === 'complete' && (s.id === 'agreement' || s.id === 'sms_verify'))
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20,
                background: isActive ? 'var(--accent-light)' : isDone ? 'rgba(34,197,94,.1)' : 'transparent',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: isDone ? '#16a34a' : isActive ? 'var(--accent)' : 'var(--border)',
                  color: isActive || isDone ? '#fff' : 'var(--text-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12,
                }}>
                  {isDone ? <CheckCircle2 size={14} /> : <span>{i + 1}</span>}
                </div>
                <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {s.label}
                </span>
              </div>
              {i < 2 && <div style={{ width: 40, height: 1, background: 'var(--border)', margin: '0 4px' }} />}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ maxWidth: 420, width: '100%' }}>
          {step === 'agreement' && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: 12, padding: 28,
              border: '1px solid var(--border)',
            }}>
              <Shield size={32} color="var(--accent)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>补充协议</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
                开通 Agent Mailbox 之前，请阅读并同意以下补充协议：
                <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                  <li>您的邮箱地址格式为 xxx.agent@agent.qq.com</li>
                  <li>邮箱用于接收 AI 驱动的邮件处理</li>
                  <li>邮件数据与您的账号绑定，独立隔离</li>
                  <li>对外发送的邮件需经您确认</li>
                  <li>您可随时停用或注销邮箱</li>
                </ul>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16 }}>
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>我已阅读并同意以上协议</span>
              </label>
              <button onClick={handleAgree} disabled={!agreed} style={{
                width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                background: agreed ? 'var(--accent)' : 'var(--border)',
                color: agreed ? '#fff' : 'var(--text-tertiary)',
                fontSize: 13, fontWeight: 600, cursor: agreed ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'inherit',
              }}>
                Agree & Continue <ChevronRight size={14} />
              </button>
            </div>
          )}

          {step === 'sms_verify' && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: 12, padding: 28,
              border: '1px solid var(--border)',
            }}>
              <Smartphone size={32} color="var(--accent)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>SMS Verification</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Enter your registered mobile number to receive a verification code.
              </div>

              {error && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, marginBottom: 14,
                  background: 'rgba(220,38,38,.1)', border: '1px solid rgba(220,38,38,.2)',
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#dc2626',
                }}>
                  <AlertTriangle size={14} /> {error}
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="mailbox-phone" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Phone Number</label>
                <input
                  id="mailbox-phone"
                  name="tel"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="13800000000"
                  maxLength={11}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    fontSize: 14, fontFamily: 'inherit', background: 'var(--bg-input)',
                    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="mailbox-otp" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>SMS Code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="mailbox-otp"
                    name="one-time-code"
                    type="text"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    placeholder="6-digit code"
                    maxLength={6}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      fontSize: 14, fontFamily: 'inherit', background: 'var(--bg-input)',
                      color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                  <button type="button" onClick={handleSendCode} disabled={sendingCode || !phone} style={{
                    padding: '10px 16px', borderRadius: 8, border: 'none',
                    background: phone ? 'var(--accent)' : 'var(--border)',
                    color: phone ? '#fff' : 'var(--text-tertiary)',
                    fontSize: 12, fontWeight: 600, cursor: phone ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap', fontFamily: 'inherit',
                  }}>
                    {sendingCode ? 'Sending…' : 'Send Code'}
                  </button>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Mock mode: any 6-digit code works
                </div>
              </div>

              <button type="button" onClick={handleVerify} disabled={verifying || smsCode.length !== 6} style={{
                width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                background: smsCode.length === 6 ? 'var(--accent)' : 'var(--border)',
                color: smsCode.length === 6 ? '#fff' : 'var(--text-tertiary)',
                fontSize: 13, fontWeight: 600, cursor: smsCode.length === 6 ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}>
                {verifying ? 'Verifying…' : 'Verify & Activate'}
              </button>
            </div>
          )}

          {step === 'complete' && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: 12, padding: 28,
              border: '1px solid rgba(34,197,94,.3)', textAlign: 'center',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                background: 'rgba(34,197,94,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle2 size={28} color="#16a34a" />
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Activation Complete!</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Your Agent Mail address:
              </div>
              <div style={{
                display: 'inline-block', padding: '10px 24px', borderRadius: 8,
                background: 'var(--accent-light)', color: 'var(--accent)',
                fontSize: 15, fontWeight: 600, fontFamily: 'SF Mono, Consolas, monospace',
                marginBottom: 20,
              }}>
                {mailbox?.address || 'xxx.agent@agent.qq.com'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                You can now receive and send emails through your AI Agent.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
