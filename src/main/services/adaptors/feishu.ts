// ============================================================
// Feishu (飞书) Adaptor
// Self-built app via WebSocket or URL callback.
// Credentials: App ID + App Secret + Encrypt Key.
// Configuration: permissions → event subscriptions (message + card interaction).
// Prerequisites: enterprise account with app creation permissions.
// ============================================================

import type {
  IMAdaptor,
  IMPlatform,
  IMConnectionStatus,
  IMessage,
  PlatformConfig,
  FeishuConfig,
  FeishuPermission,
  ApprovalActionCategory,
  ApprovalRequest,
  AssistantArtifact,
} from '../../../lib/im-types'

import { v4 as uuid } from 'uuid'

/** Required permissions for Feishu bot operation */
const REQUIRED_PERMISSIONS: FeishuPermission[] = [
  'im:message',
  'im:message.p2p_msg',
  'im:message.group_msg',
  'im:message:send_as_bot',
  'contact:user:readonly',
  'contact:contact:readonly',
]

export class FeishuAdaptor implements IMAdaptor {
  platform: IMPlatform = 'feishu'

  private status: IMConnectionStatus = 'disconnected'
  private messageHandlers: Array<(msg: IMessage) => void> = []
  private config: FeishuConfig | null = null
  private tenantAccessToken: string | null = null
  private appId: string | null = null
  private wsConnection: { close: () => void } | null = null

  async connect(config: PlatformConfig): Promise<void> {
    const cfg = config as FeishuConfig
    this.config = cfg
    this.status = 'connecting'

    // Validate credentials
    if (!cfg.appId || !cfg.appSecret) {
      this.status = 'error'
      throw new Error('飞书自建应用需要 App ID 和 App Secret')
    }

    // Verify required permissions
    const missingPerms = this.validatePermissions(cfg.permissions ?? [])
    if (missingPerms.length > 0) {
      this.status = 'error'
      throw new Error(`缺少飞书权限: ${missingPerms.join(', ')}`)
    }

    this.appId = cfg.appId

    // In production: obtain tenant_access_token
    // POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
    this.tenantAccessToken = `t-${uuid().replace(/-/g, '')}`

    if (cfg.mode === 'websocket') {
      // In production: connect to Feishu WebSocket
      // wss://open.feishu.cn/open-apis/ws/v1
      this.wsConnection = { close: () => {} }
    } else {
      // In production: start HTTP server for URL callback
      // Must handle:
      //   1. URL verification challenge (encrypt key)
      //   2. Event subscription: im.message.receive_v1
      //   3. Card action callback: card.action.trigger
    }

    this.status = 'connected'
  }

  async disconnect(): Promise<void> {
    if (this.wsConnection) {
      this.wsConnection.close()
      this.wsConnection = null
    }
    this.tenantAccessToken = null
    this.appId = null
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
      conversationId: `feishu_${this.appId ?? ''}_${userId}`,
      action,
      details,
      category,
      riskLevel: this.assessRisk(category),
      approved: null,
      requestedAt: Date.now(),
      timeoutMs: 90_000,
    }

    // In production: send interactive card with approve/deny buttons
    // Using Feishu Message Card API:
    // POST https://open.feishu.cn/open-apis/im/v1/messages
    // Body includes card template with approval actions
    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId,
      senderName: '系统',
      content: `[审批] ${action}\n\n${details}\n\n请在手机飞书中确认`,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId: request.conversationId,
      conversationType: 'single',
    })

    return request
  }

  async sendMessage(userId: string, content: string, artifacts?: AssistantArtifact[]): Promise<void> {
    // In production: POST https://open.feishu.cn/open-apis/im/v1/messages
    const artifactList = artifacts?.length
      ? `\n\n📎 ${artifacts.map((a) => a.name).join(', ')}`
      : ''

    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId,
      senderName: 'BspBuddy 飞书助理',
      content: content + artifactList,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId: `feishu_${this.appId ?? ''}_${userId}`,
      conversationType: 'single',
    })
  }

  async sendGroupMessage(conversationId: string, content: string, artifacts?: AssistantArtifact[]): Promise<void> {
    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId: this.appId ?? 'bot',
      senderName: 'BspBuddy 飞书助理',
      content: content + (artifacts?.length ? `\n📎 ${artifacts.map((a) => a.name).join(', ')}` : ''),
      contentType: 'text',
      timestamp: Date.now(),
      conversationId,
      conversationType: 'group',
    })
  }

  /**
   * Configure event subscription for receiving messages and card interactions.
   * In production: POST https://open.feishu.cn/open-apis/event/v1/app/event_subscription
   */
  async configureEventSubscription(events: string[]): Promise<void> {
    const requiredEvents = ['im.message.receive_v1', 'card.action.trigger']
    const missing = requiredEvents.filter((e) => !events.includes(e))
    if (missing.length > 0) {
      throw new Error(`缺少事件订阅: ${missing.join(', ')}。请前往飞书开放平台配置。`)
    }
  }

  /**
   * Get the current permission grant status.
   * In production: checks which permissions have been granted to the app.
   */
  getPermissionStatus(): { granted: FeishuPermission[]; missing: FeishuPermission[] } {
    const current = this.config?.permissions ?? []
    const missing = REQUIRED_PERMISSIONS.filter((p) => !current.includes(p))
    return { granted: current, missing }
  }

  async getQrCode(): Promise<string> {
    // Feishu self-built apps don't typically use QR binding,
    // but provide the app's install URL for the admin
    if (!this.appId) {
      throw new Error('Not connected. Call connect() first.')
    }
    return `feishu_app_install:${this.appId}`
  }

  async unbind(): Promise<void> {
    await this.disconnect()
  }

  // ---- Private helpers ----

  private validatePermissions(granted: FeishuPermission[]): FeishuPermission[] {
    return REQUIRED_PERMISSIONS.filter((p) => !granted.includes(p))
  }

  private assessRisk(category: ApprovalActionCategory): 'low' | 'medium' | 'high' {
    switch (category) {
      case 'file_delete':
      case 'system_config':
        return 'high'
      case 'command_exec':
      case 'python_exec':
        return 'medium'
      default:
        return 'low'
    }
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
