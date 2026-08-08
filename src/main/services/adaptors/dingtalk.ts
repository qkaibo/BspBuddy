// ============================================================
// DingTalk (钉钉) Adaptor
// Developer console Bot creation.
// Credentials: AppKey + AppSecret.
// Prerequisites: enterprise admin account.
// Required permissions: Card.Streaming.Write, Card.Instance.Write, qyapi_robot_sendmsg.
// Config steps: create app → add Bot capability → configure permissions → HTTP push (AES Key + Token) → publish review.
// Features: group chat @bot + single chat.
// ============================================================

import type {
  IMAdaptor,
  IMPlatform,
  IMConnectionStatus,
  IMessage,
  PlatformConfig,
  DingtalkConfig,
  ApprovalActionCategory,
  ApprovalRequest,
  AssistantArtifact,
} from '../../../lib/im-types'

import { v4 as uuid } from 'uuid'

/** Required DingTalk permissions */
const DINGTALK_REQUIRED_PERMISSIONS = [
  'Card.Streaming.Write',
  'Card.Instance.Write',
  'qyapi_robot_sendmsg',
] as const

export class DingtalkAdaptor implements IMAdaptor {
  platform: IMPlatform = 'dingtalk'

  private status: IMConnectionStatus = 'disconnected'
  private messageHandlers: Array<(msg: IMessage) => void> = []
  private config: DingtalkConfig | null = null
  private accessToken: string | null = null
  private appKey: string | null = null

  async connect(config: PlatformConfig): Promise<void> {
    const cfg = config as DingtalkConfig
    this.config = cfg
    this.status = 'connecting'

    // Validate credentials
    if (!cfg.appKey || !cfg.appSecret) {
      this.status = 'error'
      throw new Error('钉钉 Bot 需要 AppKey 和 AppSecret')
    }

    // Check if the bot has passed publish review
    if (!cfg.published) {
      // In production: warn that the bot is not yet published
      // Bots must go through DingTalk's review process before going live
    }

    this.appKey = cfg.appKey

    // In production: obtain access_token
    // POST https://oapi.dingtalk.com/gettoken?appkey=XXX&appsecret=XXX
    this.accessToken = `dt_${uuid().replace(/-/g, '')}`

    // In production: register HTTP push (outgoing message callback)
    // POST https://oapi.dingtalk.com/call_back/register_call_back
    // Body includes: url, aes_key, token, call_back_tag

    this.status = 'connected'
  }

  async disconnect(): Promise<void> {
    this.accessToken = null
    this.appKey = null
    this.config = null
    this.status = 'disconnected'
  }

  getStatus(): IMConnectionStatus {
    return this.status
  }

  onMessage(handler: (msg: IMessage) => void): void {
    this.messageHandlers.push(handler)
  }

  offMessage(handler: (msg: IMessage) => void): void {
    this.messageHandlers = this.messageHandlers.filter((h) => h !== handler)
  }

  async sendApprovalRequest(
    userId: string,
    action: string,
    details: string,
    category: ApprovalActionCategory,
  ): Promise<ApprovalRequest> {
    const request: ApprovalRequest = {
      id: uuid(),
      platform: this.platform,
      userId,
      conversationId: `dingtalk_${this.appKey ?? ''}_${userId}`,
      action,
      details,
      category,
      riskLevel: category === 'file_delete' || category === 'system_config' ? 'high' : 'medium',
      approved: null,
      requestedAt: Date.now(),
      timeoutMs: 120_000,
    }

    // In production: send DingTalk interactive card for approval
    // POST https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2
    // Using msgtype: 'action_card' with approval buttons
    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId,
      senderName: '系统',
      content: `[审批] ${action}\n\n${details}\n\n请在手机钉钉中确认`,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId: request.conversationId,
      conversationType: 'single',
    })

    return request
  }

  async sendMessage(userId: string, content: string, artifacts?: AssistantArtifact[]): Promise<void> {
    // In production: send message via DingTalk robot API
    // POST https://oapi.dingtalk.com/robot/send?access_token=XXX
    const artifactList = artifacts?.length
      ? `\n\n📎 ${artifacts.map((a) => a.name).join(', ')}`
      : ''

    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId,
      senderName: 'BspBuddy 钉钉助理',
      content: content + artifactList,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId: `dingtalk_${this.appKey ?? ''}_${userId}`,
      conversationType: 'single',
    })
  }

  async sendGroupMessage(conversationId: string, content: string, artifacts?: AssistantArtifact[]): Promise<void> {
    // In production: send to group chat
    // Use sessionWebhook or group robot webhook URL
    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId: this.appKey ?? 'bot',
      senderName: 'BspBuddy 钉钉助理',
      content: content + (artifacts?.length ? `\n📎 ${artifacts.map((a) => a.name).join(', ')}` : ''),
      contentType: 'text',
      timestamp: Date.now(),
      conversationId,
      conversationType: 'group',
    })
  }

  /**
   * Check publish review status.
   * In production: query DingTalk API for the app's publish status.
   */
  async checkPublishStatus(): Promise<{ published: boolean; status: string }> {
    if (!this.config) {
      return { published: false, status: '未配置' }
    }

    // In production: GET https://oapi.dingtalk.com/microapp/get?agentid=XXX
    return {
      published: this.config.published ?? false,
      status: this.config.published ? '已通过审核' : '待审核 / 审核中',
    }
  }

  /**
   * Submit for publish review.
   * In production: submit the bot configuration for DingTalk's review process.
   */
  async submitForReview(): Promise<void> {
    if (!this.config) {
      throw new Error('未配置钉钉 Bot')
    }
    if (this.config.published) {
      throw new Error('Bot 已通过审核，无需再次提交')
    }
    // In production: POST to DingTalk publish API
    this.config.published = true
  }

  async getQrCode(): Promise<string> {
    if (!this.appKey) {
      throw new Error('Not connected. Call connect() first.')
    }
    // In production: get QR code for bot installation
    return `dingtalk_qrcode:${this.appKey}`
  }

  async unbind(): Promise<void> {
    await this.disconnect()
  }

  private emitToHandlers(msg: IMessage): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(msg)
      } catch {
        // Swallow handler errors
      }
    }
  }
}
