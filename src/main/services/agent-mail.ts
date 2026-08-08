// ============================================================
// Agent Mail 服务
// 依赖: 腾讯 Agent Mail 服务（内部产品），本地使用 mock 数据
// 提供: 开通(协议+SMS)、收发、注入上下文、确认门控
// ============================================================
import { v4 as uuid } from 'uuid'
import type {
  AgentMailbox, AgentMail, MailFolder, OutboundAction, OutboundActionType,
  ActivationState, ActivationStep, MailContext, MailNotification,
  MailboxStatus,
} from '../../lib/mailbox-types'
import { createMockMailbox, createMockMails } from '../../lib/mailbox-types'

export class AgentMailService {
  private mailbox: AgentMailbox | null = null
  private mails: AgentMail[] = []
  private outboundActions: OutboundAction[] = []
  private activation: ActivationState | null = null
  private listeners: Array<(notification: MailNotification) => void> = []

  onNotification(cb: (notification: MailNotification) => void): void {
    this.listeners.push(cb)
  }

  private notify(notification: MailNotification): void {
    for (const cb of this.listeners) cb(notification)
  }

  // ---------- 开通流程 ----------

  getActivationState(): ActivationState | null {
    return this.activation
  }

  startActivation(): ActivationState {
    this.activation = { step: 'agreement', agreementAccepted: false }
    return this.activation
  }

  acceptAgreement(): { success: boolean; nextStep: ActivationStep } {
    if (!this.activation) throw new Error('未开始开通流程')
    this.activation.agreementAccepted = true
    this.activation.step = 'sms_verify'
    return { success: true, nextStep: 'sms_verify' }
  }

  sendSmsCode(phone: string): { success: boolean; message: string } {
    if (!this.activation || !this.activation.agreementAccepted) {
      throw new Error('请先同意补充协议')
    }
    this.activation.phone = phone
    // 实际环境下调用 SMS 发送接口
    return { success: true, message: `验证码已发送至 ${phone}，有效期 5 分钟。本地 mock 环境验证码为: 123456` }
  }

  verifySmsCode(code: string): { success: boolean; mailbox?: AgentMailbox; error?: string } {
    if (!this.activation) throw new Error('未开始开通流程')

    // mock 环境任意 6 位验证码都通过
    if (code.length !== 6) {
      return { success: false, error: '验证码格式错误，应为 6 位数字' }
    }

    this.activation.smsCode = code
    this.activation.step = 'creating'

    // 创建邮箱
    const phone = this.activation.phone || '13800000000'
    const localPart = phone.slice(-8)
    this.mailbox = {
      id: `mb-${uuid().slice(0, 8)}`,
      address: `${localPart}.agent@agent.qq.com`,
      status: 'active',
      unreadCount: 0,
      totalCount: 0,
      createdAt: Date.now(),
      activatedAt: Date.now(),
    }
    this.mails = createMockMails()
    this.mailbox.unreadCount = this.mails.filter((m) => !m.readAt).length
    this.mailbox.totalCount = this.mails.length

    this.activation.step = 'complete'
    this.activation.mailbox = this.mailbox

    this.notify({ type: 'activated', timestamp: Date.now() })

    return { success: true, mailbox: this.mailbox }
  }

  // ---------- 邮箱状态 ----------

  getStatus(): { mailbox: AgentMailbox | null; isActivated: boolean } {
    return {
      mailbox: this.mailbox,
      isActivated: this.mailbox !== null && this.mailbox.status === 'active',
    }
  }

  setMailboxStatus(status: MailboxStatus, reason?: string): { success: boolean } {
    if (!this.mailbox) return { success: false }
    this.mailbox.status = status
    if (status === 'frozen') this.notify({ type: 'frozen', reason, timestamp: Date.now() })
    if (status === 'banned') this.notify({ type: 'banned', reason, timestamp: Date.now() })
    if (status === 'active') this.notify({ type: 'activated', timestamp: Date.now() })
    return { success: true }
  }

  // ---------- 收发邮件 ----------

  fetchMails(folder: MailFolder = 'inbox', page: number = 1): { mails: AgentMail[]; total: number } {
    if (!this.mailbox) throw new Error('邮箱未开通')

    const filtered = folder === 'inbox'
      ? this.mails.filter((m) => !m.labels.includes('sent'))
      : this.mails.filter((m) => m.labels.includes('sent'))

    const pageSize = 20
    const start = (page - 1) * pageSize
    return {
      mails: filtered.slice(start, start + pageSize).sort((a, b) => b.receivedAt - a.receivedAt),
      total: filtered.length,
    }
  }

  getMailDetail(mailId: string): AgentMail | null {
    const mail = this.mails.find((m) => m.id === mailId)
    if (mail && !mail.readAt) {
      mail.readAt = Date.now()
      if (this.mailbox) {
        this.mailbox.unreadCount = this.mails.filter((m) => !m.readAt).length
      }
    }
    return mail || null
  }

  deleteMail(mailId: string): { success: boolean } {
    const idx = this.mails.findIndex((m) => m.id === mailId)
    if (idx === -1) return { success: false }
    this.mails.splice(idx, 1)
    if (this.mailbox) {
      this.mailbox.totalCount = this.mails.length
      this.mailbox.unreadCount = this.mails.filter((m) => !m.readAt).length
    }
    return { success: true }
  }

  toggleRead(mailId: string, read: boolean): { success: boolean } {
    const mail = this.mails.find((m) => m.id === mailId)
    if (!mail) return { success: false }
    mail.readAt = read ? Date.now() : undefined
    if (this.mailbox) {
      this.mailbox.unreadCount = this.mails.filter((m) => !m.readAt).length
    }
    return { success: true }
  }

  searchMails(query: string): AgentMail[] {
    const q = query.toLowerCase()
    return this.mails.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.from.toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q)
    )
  }

  // ---------- 对话集成 ----------

  // 将邮件注入到对话上下文
  injectIntoContext(mailId: string): MailContext | null {
    const mail = this.mails.find((m) => m.id === mailId)
    if (!mail) return null
    return {
      mailId: mail.id,
      subject: mail.subject,
      from: mail.from,
      to: mail.to,
      body: mail.body,
      receivedAt: mail.receivedAt,
      attachments: mail.attachments.map((a) => ({ name: a.name, size: a.size })),
    }
  }

  // ---------- 确认门控: 回复/转发不自动发送 ----------

  draftReply(mailId: string, body: string): OutboundAction {
    const original = this.mails.find((m) => m.id === mailId)
    if (!original) throw new Error('邮件不存在')

    const action: OutboundAction = {
      id: `oa-${uuid().slice(0, 8)}`,
      type: 'reply',
      to: original.from,
      subject: `Re: ${original.subject}`,
      draftBody: body,
      attachments: [],
      status: 'draft',
      createdAt: Date.now(),
    }
    this.outboundActions.push(action)
    return action
  }

  draftForward(mailId: string, to: string, body: string): OutboundAction {
    const original = this.mails.find((m) => m.id === mailId)
    if (!original) throw new Error('邮件不存在')

    const action: OutboundAction = {
      id: `oa-${uuid().slice(0, 8)}`,
      type: 'forward',
      to,
      subject: `Fwd: ${original.subject}`,
      draftBody: body,
      attachments: [],
      status: 'draft',
      createdAt: Date.now(),
    }
    this.outboundActions.push(action)
    return action
  }

  draftNewMail(to: string, subject: string, body: string): OutboundAction {
    const action: OutboundAction = {
      id: `oa-${uuid().slice(0, 8)}`,
      type: 'new',
      to,
      subject,
      draftBody: body,
      attachments: [],
      status: 'draft',
      createdAt: Date.now(),
    }
    this.outboundActions.push(action)
    return action
  }

  confirmSend(actionId: string): { success: boolean; message: string } {
    const action = this.outboundActions.find((a) => a.id === actionId)
    if (!action) return { success: false, message: '操作不存在' }
    if (action.status !== 'draft') return { success: false, message: `操作状态为 ${action.status}，无法发送` }

    action.status = 'confirmed'
    action.confirmedAt = Date.now()

    // 模拟发送
    action.status = 'sent'
    action.sentAt = Date.now()

    // 添加到已发送
    const sentMail: AgentMail = {
      id: `mail-${uuid().slice(0, 8)}`,
      from: this.mailbox?.address || 'dev.agent@agent.qq.com',
      to: action.to,
      subject: action.subject,
      body: action.draftBody,
      attachments: action.attachments,
      receivedAt: Date.now(),
      labels: ['sent'],
    }
    this.mails.push(sentMail)
    if (this.mailbox) this.mailbox.totalCount = this.mails.length

    return { success: true, message: '邮件已发送' }
  }

  cancelSend(actionId: string): { success: boolean } {
    const action = this.outboundActions.find((a) => a.id === actionId)
    if (!action) return { success: false }
    if (action.status !== 'draft') return { success: false }
    action.status = 'cancelled'
    return { success: true }
  }

  getOutboundActions(): OutboundAction[] {
    return this.outboundActions
  }

  // ---------- 模拟新邮件通知 ----------

  simulateIncomingMail(): AgentMail {
    if (!this.mailbox) throw new Error('邮箱未开通')
    const mail: AgentMail = {
      id: `mail-${uuid().slice(0, 8)}`,
      from: 'notification@service.com',
      to: this.mailbox.address,
      subject: '新任务通知',
      body: '您有一个新的代码审查任务，请及时处理。',
      attachments: [],
      receivedAt: Date.now(),
      labels: ['work'],
    }
    this.mails.push(mail)
    this.mailbox.totalCount = this.mails.length
    this.mailbox.unreadCount = this.mails.filter((m) => !m.readAt).length

    this.notify({
      type: 'new_mail',
      mailId: mail.id,
      subject: mail.subject,
      timestamp: Date.now(),
    })

    return mail
  }
}

export const agentMailService = new AgentMailService()
