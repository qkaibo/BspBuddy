// ============================================================
// WeCom (企业微信) Adaptor
// Two modes: WebSocket long-connection OR URL callback.
// Bot credentials (websocket): Bot ID + Secret
// Bot credentials (URL callback): Token + Encoding-AESKey
// Features: group chat @bot support, dedicated task groups, notifications.
// Security: encrypted message transport, source validation, phone IM approval.
// ============================================================

import type {
  IMAdaptor,
  IMPlatform,
  IMConnectionStatus,
  IMessage,
  PlatformConfig,
  WecomConfig,
  ApprovalActionCategory,
  ApprovalRequest,
  AssistantArtifact,
} from '../../../lib/im-types'

import { v4 as uuid } from 'uuid'

export class WecomAdaptor implements IMAdaptor {
  platform: IMPlatform = 'wecom'

  private status: IMConnectionStatus = 'disconnected'
  private messageHandlers: Array<(msg: IMessage) => void> = []
  private config: WecomConfig | null = null
  private botId: string | null = null
  private wsConnection: { close: () => void } | null = null

  async connect(config: PlatformConfig): Promise<void> {
    const cfg = config as WecomConfig
    this.config = cfg
    this.status = 'connecting'

    // Validate credentials based on mode
    if (cfg.mode === 'websocket' && (!cfg.botId || !cfg.secret)) {
      this.status = 'error'
      throw new Error('企业微信 WebSocket 模式需要 Bot ID 和 Secret')
    }
    if (cfg.mode === 'url-callback' && (!cfg.token || !cfg.encodingAesKey)) {
      this.status = 'error'
      throw new Error('企业微信 URL 回调模式需要 Token 和 Encoding-AESKey')
    }

    this.botId = cfg.botId ?? `wecom_${cfg.corpId ?? uuid().slice(0, 8)}`

    if (cfg.mode === 'websocket') {
      // In production: establish WebSocket connection to WeCom
      // WebSocket URL: wss://qyapi.weixin.qq.com/cgi-bin/wwcom/websocket?bot_id=XXX&secret=XXX
      this.wsConnection = { close: () => {} }
    } else {
      // In production: start HTTP server for URL callback mode
      // Server must handle:
      //   1. URL verification (GET with echostr)
      //   2. Message decryption (AES-CBC with Encoding-AESKey)
      //   3. Message encryption for replies
    }

    this.status = 'connected'
  }

  async disconnect(): Promise<void> {
    if (this.wsConnection) {
      this.wsConnection.close()
      this.wsConnection = null
    }
    this.botId = null
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
    const riskLevels: Record<ApprovalActionCategory, 'low' | 'medium' | 'high'> = {
      file_delete: 'high',
      system_config: 'high',
      command_exec: 'medium',
      python_exec: 'medium',
      network_request: 'low',
      file_write: 'medium',
      other: 'low',
    }

    const request: ApprovalRequest = {
      id: uuid(),
      platform: this.platform,
      userId,
      conversationId: `wecom_${this.botId ?? ''}_${userId}`,
      action,
      details,
      category,
      riskLevel: riskLevels[category],
      approved: null,
      requestedAt: Date.now(),
      timeoutMs: 120_000, // 2 minutes for WeCom
    }

    // In production: send encrypted approval card to WeCom user
    // The card has "同意" and "拒绝" buttons
    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId,
      senderName: '系统',
      content: `[审批] ${action}\n\n${details}\n\n请在手机企业微信中确认`,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId: request.conversationId,
      conversationType: 'single',
    })

    return request
  }

  async sendMessage(userId: string, content: string, artifacts?: AssistantArtifact[]): Promise<void> {
    const artifactList = artifacts?.length
      ? `\n\n📎 ${artifacts.map((a) => a.name).join(', ')}`
      : ''

    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId,
      senderName: 'BspBuddy 企业微信助理',
      content: content + artifactList,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId: `wecom_${this.botId ?? ''}_${userId}`,
      conversationType: 'single',
    })
  }

  /**
   * Send message to a WeCom group.
   * The bot must be a member of the group and be @-mentioned for the message to trigger.
   */
  async sendGroupMessage(conversationId: string, content: string, artifacts?: AssistantArtifact[]): Promise<void> {
    const artifactList = artifacts?.length
      ? `\n\n📎 ${artifacts.map((a) => a.name).join(', ')}`
      : ''

    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId: this.botId ?? 'bot',
      senderName: 'BspBuddy 企业微信助理',
      content: content + artifactList,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId,
      conversationType: 'group',
    })
  }

  /**
   * Handle @bot mention in group chat.
   * Extracts the message content after the @bot mention.
   */
  handleAtMention(rawMessage: string, botName: string): string {
    const mentionPattern = new RegExp(`@${botName}\\s*`, 'g')
    return rawMessage.replace(mentionPattern, '').trim()
  }

  async getQrCode(): Promise<string> {
    // WeCom supports QR code for quick binding
    return `wecom_qrcode_bind:${this.botId ?? ''}`
  }

  async unbind(): Promise<void> {
    await this.disconnect()
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
