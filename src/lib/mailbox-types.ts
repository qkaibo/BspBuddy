// ============================================================
// Agent 邮箱 (Mailbox) 数据模型
// 对应 SPEC: specs/From-Beginner-to-Expert-Guide/Mailbox.md
// 依赖状态: ⚠️ 腾讯内部产品 Agent Mail 服务，本地开发需模拟邮件服务
// ============================================================

// ---------- 邮箱 ----------
export interface AgentMailbox {
  id: string
  address: string // xxx.agent@agent.qq.com
  status: MailboxStatus
  unreadCount: number
  totalCount: number
  createdAt: number
  activatedAt?: number
}

export type MailboxStatus = 'active' | 'disabled' | 'frozen' | 'banned'

export const MAILBOX_STATUS_LABELS: Record<MailboxStatus, string> = {
  active: '运行中',
  disabled: '已停用',
  frozen: '已冻结',
  banned: '已封禁',
}

// ---------- 邮件 ----------
export interface AgentMail {
  id: string
  from: string
  to: string
  subject: string
  body: string
  attachments: Attachment[]
  receivedAt: number
  readAt?: number
  threadId?: string
  labels: string[]
}

export interface Attachment {
  id: string
  name: string
  mimeType: string
  size: number
  url: string
  safe: boolean // 安全扫描结果
}

// ---------- 方向 ----------
export type MailFolder = 'inbox' | 'sent'

// ---------- 时间分组 ----------
export type TimeGroup = 'today' | 'yesterday' | 'last_week' | 'earlier'

export function getTimeGroup(timestamp: number): TimeGroup {
  const now = Date.now()
  const dayMs = 86400000
  const mailDate = new Date(timestamp)
  const todayStart = new Date(new Date().toDateString()).getTime()

  if (timestamp >= todayStart) return 'today'
  if (timestamp >= todayStart - dayMs) return 'yesterday'
  if (timestamp >= todayStart - 7 * dayMs) return 'last_week'
  return 'earlier'
}

export const TIME_GROUP_LABELS: Record<TimeGroup, string> = {
  today: '今天',
  yesterday: '昨天',
  last_week: '上周',
  earlier: '更早',
}

// ---------- 对外行动 ----------
export interface OutboundAction {
  id: string
  type: OutboundActionType
  to: string
  subject: string
  draftBody: string
  attachments: Attachment[]
  status: OutboundActionStatus
  createdAt: number
  confirmedAt?: number
  sentAt?: number
}

export type OutboundActionType = 'reply' | 'forward' | 'new'
export type OutboundActionStatus = 'draft' | 'confirmed' | 'sent' | 'cancelled'

// ---------- 发送确认 ----------
export interface SendConfirmation {
  to: string
  subject: string
  body: string
  attachments: string[]
  requiresConfirmation: true // 对外行动强制确认
}

// ---------- 开通步骤 ----------
export type ActivationStep = 'agreement' | 'sms_verify' | 'creating' | 'complete'

export interface ActivationState {
  step: ActivationStep
  agreementAccepted: boolean
  phone?: string
  smsCode?: string
  mailbox?: AgentMailbox
  error?: string
}

// ---------- 上下文注入 ----------
export interface MailContext {
  mailId: string
  subject: string
  from: string
  to: string
  body: string
  receivedAt: number
  attachments: { name: string; size: number }[]
}

// ---------- 通知 ----------
export interface MailNotification {
  type: 'new_mail' | 'activated' | 'frozen' | 'banned' | 'revoked'
  mailId?: string
  subject?: string
  reason?: string
  errorCode?: string
  timestamp: number
}

// ---------- 本地 mock 数据 ----------
export function createMockMailbox(): AgentMailbox {
  return {
    id: 'mb-001',
    address: 'dev.agent@agent.qq.com',
    status: 'active',
    unreadCount: 3,
    totalCount: 12,
    createdAt: Date.now() - 86400000 * 7,
    activatedAt: Date.now() - 86400000 * 7,
  }
}

export function createMockMails(): AgentMail[] {
  const now = Date.now()
  const day = 86400000
  return [
    {
      id: 'mail-001',
      from: 'pm@company.com',
      to: 'dev.agent@agent.qq.com',
      subject: '本周需求评审会议纪要',
      body: '各位好，\n\n以下是本周需求评审的会议纪要：\n\n1. 用户登录模块优化 - 本周五前完成\n2. 数据导出功能 - 下周三前联调\n3. 性能优化专项 - 持续跟进\n\n请在会后确认各自的任务。\n\n谢谢',
      attachments: [{ id: 'att-1', name: '会议纪要.pdf', mimeType: 'application/pdf', size: 245000, url: '', safe: true }],
      receivedAt: now - 3600000,
      threadId: 'thread-001',
      labels: ['work', 'meeting'],
    },
    {
      id: 'mail-002',
      from: 'hr@company.com',
      to: 'dev.agent@agent.qq.com',
      subject: '团建活动通知',
      body: '各位同事，\n\n公司定于下周五举行团建活动，地点在郊区度假村。\n请于周三前回复是否参加。\n\nHR 部门',
      attachments: [],
      receivedAt: now - day,
      threadId: 'thread-002',
      labels: ['notice'],
    },
    {
      id: 'mail-003',
      from: 'ops@company.com',
      to: 'dev.agent@agent.qq.com',
      subject: '服务器告警 - CPU使用率过高',
      body: '警告：生产环境服务器 cpu-03 的 CPU 使用率在过去15分钟内持续超过90%。\n\n请立即检查并处理。\n\n运维团队',
      attachments: [],
      receivedAt: now - 1800000,
      labels: ['urgent', 'ops'],
    },
    {
      id: 'mail-004',
      from: 'dev.agent@agent.qq.com',
      to: 'pm@company.com',
      subject: 'Re: 本周需求评审会议纪要',
      body: '收到，登录模块优化已排期周五前完成。数据导出功能需要后端接口支持，已与后端同学对齐。',
      attachments: [],
      receivedAt: now - 1800000,
      threadId: 'thread-001',
      labels: ['sent'],
    },
    {
      id: 'mail-005',
      from: 'newsletter@tech.com',
      to: 'dev.agent@agent.qq.com',
      subject: 'AI Weekly: 大模型最新进展汇总',
      body: '本周 AI 领域重要动态：\n\n1. 多模态模型新突破\n2. 开源社区新框架发布\n3. 行业应用案例分享\n\n详细内容请查看完整报告。',
      attachments: [],
      receivedAt: now - 2 * day,
      labels: ['newsletter'],
    },
  ]
}
