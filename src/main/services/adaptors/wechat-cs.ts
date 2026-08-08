// ============================================================
// WeChat Customer Service Adaptor — 微信客服号
// Pure QR-code binding, no App ID/Secret needed.
// Different binding channel from weixin-bot, same functionality.
// ============================================================

import type {
  IMAdaptor,
  IMPlatform,
  IMConnectionStatus,
  IMessage,
  PlatformConfig,
  WechatCsConfig,
  ApprovalActionCategory,
  ApprovalRequest,
  AssistantArtifact,
} from '../../../lib/im-types'

import { v4 as uuid } from 'uuid'

export class WechatCsAdaptor implements IMAdaptor {
  platform: IMPlatform = 'wechat-cs'

  private status: IMConnectionStatus = 'disconnected'
  private messageHandlers: Array<(msg: IMessage) => void> = []
  private csUserId: string | null = null
  private qrcodeId: string | null = null

  async connect(config: PlatformConfig): Promise<void> {
    const _cfg = config as WechatCsConfig
    this.status = 'connecting'

    // Generate QR code for customer service binding
    this.qrcodeId = uuid()
    this.csUserId = `wechat_cs_${this.qrcodeId.slice(0, 8)}`

    // In production: connect to WeChat Customer Service channel
    // Uses the same WeChat account but a different API endpoint
    this.status = 'connected'
  }

  async disconnect(): Promise<void> {
    this.csUserId = null
    this.qrcodeId = null
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
      conversationId: `wechat_cs_${this.csUserId ?? userId}`,
      action,
      details,
      category,
      riskLevel: 'high',
      approved: null,
      requestedAt: Date.now(),
      timeoutMs: 60_000,
    }

    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId: this.csUserId ?? userId,
      senderName: '系统',
      content: `[审批] ${action}\n${details}\n请在微信客服号中确认`,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId: request.conversationId,
      conversationType: 'single',
    })

    return request
  }

  async sendMessage(userId: string, content: string, artifacts?: AssistantArtifact[]): Promise<void> {
    const artifactList = artifacts?.length
      ? `\n📎 ${artifacts.map((a) => a.name).join(', ')}`
      : ''

    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId: this.csUserId ?? userId,
      senderName: 'BspBuddy 客服助理',
      content: content + artifactList,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId: `wechat_cs_${userId}`,
      conversationType: 'single',
    })
  }

  async getQrCode(): Promise<string> {
    if (!this.qrcodeId) {
      throw new Error('Not connected. Call connect() first.')
    }
    return `wechat_cs_qrcode:${this.qrcodeId}`
  }

  async unbind(): Promise<void> {
    this.status = 'unbinding'
    this.csUserId = null
    this.qrcodeId = null
    this.status = 'disconnected'
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
