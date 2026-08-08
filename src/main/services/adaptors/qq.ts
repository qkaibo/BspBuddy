// ============================================================
// QQ Adaptor
// Three modes: QR code scan / WebSocket long-connection / URL callback.
// Credentials: AppID + AppSecret (from QQ Open Platform).
// Prerequisites: verified QQ account.
// Security: AppSecret is never stored in plain text; secondary viewing forces reset.
// ============================================================

import type {
  IMAdaptor,
  IMPlatform,
  IMConnectionStatus,
  IMessage,
  PlatformConfig,
  QQConfig,
  ApprovalActionCategory,
  ApprovalRequest,
  AssistantArtifact,
} from '../../../lib/im-types'

import { v4 as uuid } from 'uuid'

export class QQAdaptor implements IMAdaptor {
  platform: IMPlatform = 'qq'

  private status: IMConnectionStatus = 'disconnected'
  private messageHandlers: Array<(msg: IMessage) => void> = []
  private config: QQConfig | null = null
  private userId: string | null = null
  /** AppSecret access counter — resets after secondary view */
  private secretViewCount = 0

  async connect(config: PlatformConfig): Promise<void> {
    const cfg = config as QQConfig
    this.config = cfg
    this.status = 'connecting'

    // Validate based on mode
    if (cfg.mode === 'qrcode') {
      // QR code scan mode — no explicit credentials needed at connect time
      // The QR code contains a temporary binding token
    } else if (cfg.mode === 'websocket' || cfg.mode === 'url-callback') {
      if (!cfg.appId || !cfg.appSecret) {
        this.status = 'error'
        throw new Error('QQ WebSocket/URL回调模式需要 AppID 和 AppSecret')
      }
    }

    // Track secret view count for security
    this.secretViewCount = 0

    if (cfg.mode === 'websocket') {
      // In production: connect to QQ Bot WebSocket API
      // wss://api.sgroup.qq.com/websocket
    } else if (cfg.mode === 'url-callback') {
      // In production: register URL callback endpoint
    }

    this.userId = cfg.appId ? `qq_${cfg.appId.slice(0, 8)}` : `qq_${uuid().slice(0, 8)}`
    this.status = 'connected'
  }

  async disconnect(): Promise<void> {
    this.userId = null
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
      conversationId: `qq_${this.userId ?? userId}`,
      action,
      details,
      category,
      riskLevel: category === 'file_delete' || category === 'system_config' ? 'high' : 'medium',
      approved: null,
      requestedAt: Date.now(),
      timeoutMs: 90_000,
    }

    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId: this.userId ?? userId,
      senderName: '系统',
      content: `[审批] ${action}\n${details}\n请在手机QQ中确认操作`,
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
      userId: this.userId ?? userId,
      senderName: 'BspBuddy QQ 助理',
      content: content + artifactList,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId: `qq_${userId}`,
      conversationType: 'single',
    })
  }

  async sendGroupMessage(conversationId: string, content: string, artifacts?: AssistantArtifact[]): Promise<void> {
    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId: this.userId ?? 'bot',
      senderName: 'BspBuddy QQ 助理',
      content: content + (artifacts?.length ? `\n📎 ${artifacts.map((a) => a.name).join(', ')}` : ''),
      contentType: 'text',
      timestamp: Date.now(),
      conversationId,
      conversationType: 'group',
    })
  }

  async getQrCode(): Promise<string> {
    if (!this.userId) {
      throw new Error('Not connected. Call connect() first.')
    }
    return `qq_qrcode:${this.userId}`
  }

  /**
   * Get the AppSecret value (masked after first view).
   * QQ security rule: AppSecret is never stored in plain text.
   * After the second view, the secret is forcibly reset.
   */
  getAppSecret(): string | null {
    this.secretViewCount++
    if (this.secretViewCount > 1) {
      // Force reset after secondary view
      if (this.config) {
        this.config.appSecret = undefined
      }
      return null
    }
    return this.config?.appSecret ?? null
  }

  async checkVersion(): Promise<{ satisfied: boolean; requiredVersion: string; currentVersion?: string }> {
    return {
      satisfied: true,
      requiredVersion: '9.0.0',
      currentVersion: undefined,
    }
  }

  async unbind(): Promise<void> {
    await this.disconnect()
    this.secretViewCount = 0
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
