import { useState } from 'react'
import { Copy, Link, Check, Users, X } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { ProjectInvite } from '../lib/project-types'

const ipc = createIpcClient()

interface Props {
  projectId: string
  projectName: string
  createdBy: string
  onClose: () => void
}

export function ProjectInvite({ projectId, projectName, createdBy, onClose }: Props) {
  const [invite, setInvite] = useState<ProjectInvite | null>(null)
  const [copied, setCopied] = useState(false)
  const [note, setNote] = useState('')
  const [step, setStep] = useState<'generate' | 'accept' | 'done'>('generate')

  const handleGenerateLink = async () => {
    const result = await ipc.invoke(IPC_CHANNELS.PROJECT_INVITE_GENERATE, projectId, createdBy, projectName) as { success: boolean; invite: ProjectInvite }
    if (result.success) {
      setInvite(result.invite)
    }
  }

  const handleCopyLink = async () => {
    if (!invite) return
    const link = `bspbuddy://invite?code=${invite.code}&project=${encodeURIComponent(projectName)}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: show code
    }
  }

  const handleAcceptInvite = async () => {
    if (!invite) return
    const userId = `member-${Date.now()}`
    const userName = note.trim() || `User-${userId.slice(0, 6)}`
    // Submit as pending — admin must approve
    const result = await ipc.invoke(
      IPC_CHANNELS.PROJECT_MEMBER_ADD,
      projectId, userId, userName, 'member',
      note || undefined, 'pending',
    ) as { success: boolean; error?: string }
    if (result.success) {
      setStep('done')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-overlay="true"
      style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      overscrollBehavior: 'contain',
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12, padding: 24,
        width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overscrollBehavior: 'contain',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="var(--accent)" aria-hidden="true" />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {step === 'done' ? 'Request Submitted' : 'Invite Members'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭邀请"
            style={{ padding: 4, borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {step === 'generate' && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Generate an invite link to share with your team members. Members will join after admin approval.
            </div>

            {!invite ? (
              <button
                onClick={handleGenerateLink}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 8,
                  background: 'var(--accent)', color: '#fff',
                  border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Link size={14} /> Generate Invite Link
              </button>
            ) : (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', borderRadius: 8,
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  marginBottom: 10,
                }}>
                  <Link size={14} color="var(--accent)" />
                  <span style={{
                    flex: 1, fontSize: 12, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                  }}>
                    {invite.code}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    aria-label={copied ? '已复制邀请码' : '复制邀请码'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 4,
                      border: '1px solid var(--border)', background: 'var(--bg-card)',
                      color: copied ? 'var(--success)' : 'var(--text-secondary)',
                      fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copied ? <><Check size={11} aria-hidden="true" /> Copied</> : <><Copy size={11} aria-hidden="true" /> Copy</>}
                  </button>
                </div>

                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                  Share this code with team members. They can join using the invite link.
                </div>

                {/* Simulate: member fills in note */}
                <div style={{ marginBottom: 10 }}>
                  <label htmlFor="invite-note" style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Simulate: Member fills in note to join
                  </label>
                  <input
                    id="invite-note"
                    name="invite-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Hi, I'm the frontend developer…"
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--border)', background: 'var(--bg-input)',
                      color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAcceptInvite}
                  style={{
                    width: '100%', padding: '8px 16px', borderRadius: 6,
                    background: 'var(--accent)', color: '#fff',
                    border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Join Project
                </button>
              </div>
            )}
          </>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--success)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px', fontSize: 20,
            }}>
              <Check size={24} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Request submitted!</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Your request to join "{projectName}" has been sent.
              <br />
              The project admin will review and approve your request.
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '8px 24px', borderRadius: 6,
                background: 'var(--accent)', color: '#fff',
                border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
