// ============================================================
// 邮箱界面 — 收件/发件列表、时间分组、邮件详情、添加到对话
// 对应 SPEC: Mailbox.md, 13-3
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import {
  Mail, Send, Search, Download, MessageSquare, Trash2, CheckCircle, Circle,
  ChevronLeft, AlertCircle, RefreshCw,
} from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { AgentMailbox, AgentMail, MailFolder, TimeGroup } from '../lib/mailbox-types'
import { MAILBOX_STATUS_LABELS, TIME_GROUP_LABELS, getTimeGroup } from '../lib/mailbox-types'
import { ConfirmDialog } from './ConfirmDialog'
import { panelRootStyle } from '../lib/panel-layout'

const ipc = createIpcClient()

interface Props {
  onClose?: () => void
  onInjectToChat?: (mailId: string) => void
  onActivate?: () => void
}

export function MailboxPanel({ onClose, onInjectToChat, onActivate }: Props) {
  const [mailbox, setMailbox] = useState<AgentMailbox | null>(null)
  const [mails, setMails] = useState<AgentMail[]>([])
  const [folder, setFolder] = useState<MailFolder>('inbox')
  const [selectedMail, setSelectedMail] = useState<AgentMail | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => { loadStatus() }, [])

  const loadStatus = async () => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.MAILBOX_STATUS) as { mailbox: AgentMailbox | null; isActivated: boolean }
      setMailbox(result.mailbox)
      if (result.isActivated) loadMails()
    } catch {
      // IPC not yet registered
    }
  }

  const loadMails = async () => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.MAIL_FETCH, folder) as { mails: AgentMail[]; total: number }
      setMails(result.mails || [])
    } catch {
      // ...
    }
  }

  const handleSearch = async () => {
    if (!searchQuery) { loadMails(); return }
    try {
      const result = await ipc.invoke('mail:search', searchQuery) as AgentMail[]
      setMails(result || [])
    } catch {
      // ...
    }
  }

  const openMail = async (mailId: string) => {
    try {
      const detail = await ipc.invoke(IPC_CHANNELS.MAIL_DETAIL, mailId) as AgentMail | null
      if (detail) {
        setSelectedMail(detail)
        loadStatus()
      }
    } catch {
      // ...
    }
  }

  const handleDelete = async (mailId: string) => {
    try {
      await ipc.invoke('mail:delete', mailId)
      setSelectedMail(null)
      loadMails()
    } catch {
      // ...
    }
  }

  const handleToggleRead = async (mailId: string, read: boolean) => {
    try {
      await ipc.invoke('mail:toggle-read', mailId, read)
      loadMails()
    } catch {
      // ...
    }
  }

  const handleInject = (mailId: string) => {
    if (onInjectToChat) {
      onInjectToChat(mailId)
    }
  }

  const handleDraftReply = async () => {
    if (!selectedMail) return
    try {
      const result = await ipc.invoke(IPC_CHANNELS.MAIL_DRAFT, {
        type: 'reply',
        mailId: selectedMail.id,
        body: composeBody,
      }) as { id: string; status: string }
      setConfirmAction(result.id)
      setComposeBody('')
    } catch {
      // ...
    }
  }

  const handleConfirmSend = async () => {
    if (!confirmAction) return
    try {
      await ipc.invoke(IPC_CHANNELS.MAIL_CONFIRM_SEND, confirmAction)
      setConfirmAction(null)
      setSelectedMail(null)
      setShowCompose(false)
      loadMails()
      await loadStatus()
    } catch {
      // ...
    }
  }

  const handleCancelSend = async () => {
    if (!confirmAction) return
    try {
      await ipc.invoke('mail:cancel-send', confirmAction)
      setConfirmAction(null)
    } catch {
      // ...
    }
  }

  const handleNavigateToActivate = () => {
    if (onActivate) onActivate()
  }

  // Group mails by time
  const groupedMails = new Map<TimeGroup, AgentMail[]>()
  for (const mail of mails) {
    const group = getTimeGroup(mail.receivedAt)
    if (!groupedMails.has(group)) groupedMails.set(group, [])
    groupedMails.get(group)!.push(mail)
  }

  const groupOrder: TimeGroup[] = ['today', 'yesterday', 'last_week', 'earlier']

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  // Not activated state
  if (!mailbox) {
    return (
      <div style={panelRootStyle()}>
        <div style={headerStyle}>
          {onClose && <button type="button" onClick={onClose} aria-label="关闭邮箱" style={backBtnStyle}><ChevronLeft size={16} aria-hidden="true" /></button>}
          <Mail size={18} color="var(--accent)" aria-hidden="true" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>My Mailbox</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-input)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={28} color="var(--text-tertiary)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No mailbox yet</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 280, lineHeight: 1.6 }}>
              Activate your Agent Mail to get an <code style={{ background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 3, fontSize: 11 }}>xxx.agent@agent.qq.com</code> address
            </div>
          </div>
          <button onClick={handleNavigateToActivate} style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Activate Mailbox
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={panelRootStyle()}>
      {/* Header */}
      <div style={headerStyle}>
        {onClose && <button type="button" onClick={onClose} aria-label="关闭邮箱" style={backBtnStyle}><ChevronLeft size={16} aria-hidden="true" /></button>}
        <Mail size={18} color="var(--accent)" aria-hidden="true" />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>My Mailbox</span>
        <span style={{
          marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 8,
          background: mailbox.status === 'active' ? 'rgba(34,197,94,.15)' : 'rgba(220,38,38,.15)',
          color: mailbox.status === 'active' ? '#16a34a' : '#dc2626',
        }}>
          {MAILBOX_STATUS_LABELS[mailbox.status]}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 12 }}>{mailbox.address}</span>
        {mailbox.unreadCount > 0 && (
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 10,
            background: 'var(--accent)', color: '#fff', fontWeight: 600,
          }}>
            {mailbox.unreadCount} unread
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['inbox', 'sent'] as MailFolder[]).map((f) => (
            <button key={f} onClick={() => { setFolder(f); loadMails() }} style={{
              padding: '5px 14px', border: 'none', fontSize: 12, fontWeight: folder === f ? 600 : 400, fontFamily: 'inherit',
              background: folder === f ? 'var(--accent)' : 'transparent',
              color: folder === f ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}>
              {f === 'inbox' ? (<><Mail size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Inbox</>) : (<><Send size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Sent</>)}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', borderRadius: 6, padding: '4px 10px' }}>
          <Search size={13} color="var(--text-tertiary)" aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            name="mail-search"
            aria-label="搜索邮件"
            placeholder="Search…"
            style={{
              width: 160, background: 'none', border: 'none', outline: 'none',
              fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Mail list */}
        <div style={{
          width: 340, borderRight: '1px solid var(--border)',
          overflowY: 'auto', flexShrink: 0,
        }}>
          {groupOrder.map((group) => {
            const groupMails = groupedMails.get(group)
            if (!groupMails || groupMails.length === 0) return null
            return (
              <div key={group}>
                <div style={{
                  padding: '6px 16px', fontSize: 10, fontWeight: 600,
                  color: 'var(--text-tertiary)', textTransform: 'uppercase',
                  letterSpacing: '.5px', background: 'var(--bg-card)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {TIME_GROUP_LABELS[group]}
                </div>
                {groupMails.map((mail) => (
                  <button
                    key={mail.id}
                    onClick={() => openMail(mail.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 16px', border: 'none', borderBottom: '1px solid var(--border)',
                      background: selectedMail?.id === mail.id ? 'var(--bg-hover)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ marginTop: 2 }}>
                      {mail.readAt ? <Circle size={10} color="var(--text-tertiary)" /> : <CheckCircle size={10} color="var(--accent)" />}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{
                        fontSize: 12, fontWeight: mail.readAt ? 400 : 600,
                        color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {mail.subject}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {mail.from}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', marginTop: 1 }}>
                      {formatDate(mail.receivedAt)}
                    </div>
                  </button>
                ))}
              </div>
            )
          })}
          {mails.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No emails found
            </div>
          )}
        </div>

        {/* Detail */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedMail ? (
            <>
              <div style={{
                padding: '12px 20px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedMail.subject}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    From: {selectedMail.from} · To: {selectedMail.to}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {new Date(selectedMail.receivedAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => handleInject(selectedMail.id)} title="Add to conversation" aria-label="添加到对话" style={actionBtnStyle}>
                    <MessageSquare size={13} aria-hidden="true" /> Add to Chat
                  </button>
                  <button type="button" onClick={() => handleToggleRead(selectedMail.id, !selectedMail.readAt)} title="Toggle read" aria-label={selectedMail.readAt ? '标为未读' : '标为已读'} style={actionBtnStyle}>
                    {selectedMail.readAt ? <Circle size={13} aria-hidden="true" /> : <CheckCircle size={13} aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(selectedMail.id)}
                    title="Delete"
                    aria-label="删除邮件"
                    style={{ ...actionBtnStyle, color: 'var(--danger)' }}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div style={{
                flex: 1, padding: '20px 24px', overflowY: 'auto',
                fontSize: 13, lineHeight: 1.8, color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
              }}>
                {selectedMail.body}
              </div>
              {selectedMail.attachments.length > 0 && (
                <div style={{
                  padding: '10px 24px', borderTop: '1px solid var(--border)',
                  display: 'flex', flexWrap: 'wrap', gap: 8, flexShrink: 0,
                }}>
                  {selectedMail.attachments.map((att) => (
                    <div key={att.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 12px', borderRadius: 6,
                      background: 'var(--bg-input)', fontSize: 11,
                    }}>
                      <Download size={12} />
                      <span>{att.name}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>({Math.round(att.size / 1000)}KB)</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply composer */}
              <div style={{
                borderTop: '1px solid var(--border)', padding: '12px 24px', flexShrink: 0,
                background: 'var(--bg-card)',
              }}>
                {confirmAction ? (
                  <div style={{
                    padding: 10, borderRadius: 8,
                    background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.3)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <AlertCircle size={14} color="#b45309" />
                      <span style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>Confirm Send</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#b45309', marginBottom: 10 }}>This is an outbound action. Please confirm before sending.</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleConfirmSend} style={{
                        padding: '5px 16px', borderRadius: 4, border: 'none',
                        background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}>
                        Confirm & Send
                      </button>
                      <button onClick={handleCancelSend} style={{
                        padding: '5px 16px', borderRadius: 4, border: '1px solid var(--border)',
                        background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
                      }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      placeholder="Write a reply…" aria-label="回复内容"
                      rows={3}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                        fontSize: 12, fontFamily: 'inherit', background: 'var(--bg-input)',
                        color: 'var(--text-primary)', outline: 'none', resize: 'vertical', marginBottom: 8,
                        boxSizing: 'border-box',
                      }}
                    />
                    <button onClick={handleDraftReply} disabled={!composeBody} style={{
                      padding: '6px 16px', borderRadius: 6, border: 'none',
                      background: composeBody ? 'var(--accent)' : 'var(--border)',
                      color: composeBody ? '#fff' : 'var(--text-tertiary)',
                      fontSize: 12, fontWeight: 600, cursor: composeBody ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit',
                    }}>
                      Draft Reply (requires confirmation)
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              Select an email to view
            </div>
          )}
        </div>
      </div>
      {confirmDeleteId && (
        <ConfirmDialog
          title="确认删除邮件"
          message="删除后该邮件将不可恢复，确定要删除吗？"
          onConfirm={() => {
            const id = confirmDeleteId
            setConfirmDeleteId(null)
            void handleDelete(id)
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 16px', borderBottom: '1px solid var(--border)',
  background: 'var(--bg-card)', flexShrink: 0,
}

const backBtnStyle: React.CSSProperties = {
  padding: 2, background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-secondary)', display: 'flex',
}

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
  borderRadius: 6, border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
}
