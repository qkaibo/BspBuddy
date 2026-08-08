// ============================================================
// YuanBaoPai (元宝派) Adaptor
// Primary: QR code binding. Alternative: AppID/AppSecret.
// Credentials: AppID (set as App Key) + AppSecret.
// Feature: Community Pai (社区派) mode — bot joins a Pai group, @bot triggers tasks,
// results visible to all members, real-time output sharing.
// Config flow: YuanBao App creation → BspBuddy binding → confirm in YuanBao App → private chat test → join Pai deployment.
// ============================================================

import type {
  IMAdaptor,
  IMPlatform,
  IMConnectionStatus,
  IMessage,
  PlatformConfig,
  YuanbaoConfig,
  ApprovalActionCategory,
  ApprovalRequest,
  AssistantArtifact,
} from '../../../lib/im-types'

import { v4 as uuid } from 'uuid'

export class YuanbaoAdaptor implements IMAdaptor {
  platform: IMPlatform = 'yuanbao'

  private status: IMConnectionStatus = 'disconnected'
  private messageHandlers: Array<(msg: IMessage) => void> = []
  private config: YuanbaoConfig | null = null
  private userId: string | null = null
  private communityId: string | null = null

  async connect(config: PlatformConfig): Promise<void> {
    const cfg = config as YuanbaoConfig
    this.config = cfg
    this.status = 'connecting'

    // QR code mode is preferred
    if (cfg.qrcodeData) {
      // In production: verify QR code binding
      this.userId = `yuanbao_qr_${cfg.qrcodeData.slice(0, 8)}`
    } else if (cfg.appId && cfg.appSecret) {
      // Alternative: AppID/AppSecret mode
      // AppID is set to App Key in YuanBao
      this.userId = `yuanbao_${cfg.appId.slice(0, 8)}`
    } else {
      this.status = 'error'
      throw new Error('元宝派需要二维码或 AppID(App Key) + AppSecret 进行绑定')
    }

    // Track community deployment
    this.communityId = cfg.communityId ?? null

    // In production: establish connection to YuanBao platform
    this.status = 'connected'
  }

  async disconnect(): Promise<void> {
    this.userId = null
    this.communityId = null
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
      conversationId: `yuanbao_${this.userId ?? userId}`,
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
      content: `[审批] ${action}\n\n${details}\n\n请在手机元宝中确认`,
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
      userId: this.userId ?? userId,
      senderName: 'BspBuddy 元宝派助理',
      content: content + artifactList,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId: `yuanbao_${userId}`,
      conversationType: 'single',
    })
  }

  /**
   * Send message to the community Pai group.
   * In community Pai mode, results are visible to ALL members of the Pai.
   */
  async sendCommunityMessage(content: string, artifacts?: AssistantArtifact[]): Promise<void> {
    if (!this.communityId) {
      throw new Error('Bot 尚未加入社区派。请先完成"加入派"部署。')
    }

    const artifactList = artifacts?.length
      ? `\n\n📎 ${artifacts.map((a) => a.name).join(', ')}`
      : ''

    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId: this.userId ?? 'bot',
      senderName: 'BspBuddy 元宝派助理',
      content: content + artifactList,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId: this.communityId,
      conversationType: 'group',
    })
  }

  /**
   * Deploy the bot to a community Pai.
   * After deployment, @bot in the Pai will trigger tasks visible to all members.
   */
  async deployToCommunity(communityId: string): Promise<void> {
    this.communityId = communityId
    if (this.config) {
      this.config.communityId = communityId
      this.config.communityDeployed = true
    }
  }

  /**
   * Remove the bot from the community Pai.
   */
  async removeFromCommunity(): Promise<void> {
    this.communityId = null
    if (this.config) {
      this.config.communityId = undefined
      this.config.communityDeployed = false
    }
  }

  async sendGroupMessage(conversationId: string, content: string, artifacts?: AssistantArtifact[]): Promise<void> {
    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId: this.userId ?? 'bot',
      senderName: 'BspBuddy 元宝派助理',
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
    return `yuanbao_qrcode:${this.userId}`
  }

  /**
   * Check the deployment status for community Pai mode.
   */
  getCommunityStatus(): { deployed: boolean; communityId: string | null } {
    return {
      deployed: this.config?.communityDeployed ?? false,
      communityId: this.communityId,
    }
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
