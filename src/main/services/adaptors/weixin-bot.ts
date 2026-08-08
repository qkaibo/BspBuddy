// ============================================================
// Weixin Bot Adaptor — 微信助理
// Pure QR-code binding, no App ID/Secret credentials needed.
// Features: voice message support (微信语音转文字), image/file attachments.
// Version requirement: BspBuddy >= 0.2, WeChat >= 8.0.70
// ============================================================

import type {
  IMAdaptor,
  IMPlatform,
  IMConnectionStatus,
  IMessage,
  PlatformConfig,
  WeixinBotConfig,
  ApprovalActionCategory,
  ApprovalRequest,
  AssistantArtifact,
} from '../../../lib/im-types'

import { v4 as uuid } from 'uuid'

interface WxBotSession {
  userId: string
  qrcodeId: string
  connectedAt: number
}

export class WeixinBotAdaptor implements IMAdaptor {
  platform: IMPlatform = 'weixin-bot'

  private status: IMConnectionStatus = 'disconnected'
  private messageHandlers: Array<(msg: IMessage) => void> = []
  private session: WxBotSession | null = null

  async connect(config: PlatformConfig): Promise<void> {
    const cfg = config as WeixinBotConfig
    this.status = 'connecting'

    // Verify WeChat version constraint
    // In production, this would query the OS-level WeChat version
    if (!this.checkWechatVersion()) {
      this.status = 'error'
      throw new Error('WeChat version must be >= 8.0.70')
    }

    // Simulate QR code generation for binding
    const qrcodeId = uuid()
    this.session = {
      userId: `wxbot_${qrcodeId.slice(0, 8)}`,
      qrcodeId,
      connectedAt: Date.now(),
    }

    // In production: establish WebSocket or long-poll connection to WeChat Bot API
    // The QR code is displayed in AssistantSettings for the user to scan
    this.status = 'connected'
  }

  async disconnect(): Promise<void> {
    this.session = null
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
      conversationId: `wxbot_${this.session?.userId ?? 'unknown'}`,
      action,
      details,
      category,
      riskLevel: this.assessRisk(category),
      approved: null,
      requestedAt: Date.now(),
      timeoutMs: 60_000, // 60 second timeout
    }

    // In production: send interactive approval card to WeChat
    // The user taps "Confirm" or "Cancel" on their phone
    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId: this.session?.userId ?? '',
      senderName: '系统',
      content: `[审批请求] ${action}\n\n${details}\n\n请在手机微信中确认`,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId: request.conversationId,
      conversationType: 'single',
    })

    return request
  }

  async sendMessage(userId: string, content: string, artifacts?: AssistantArtifact[]): Promise<void> {
    // In production: send message back to WeChat user via Bot API
    const artifactList = artifacts?.length
      ? `\n\n📎 ${artifacts.map((a) => a.name).join(', ')}`
      : ''

    this.emitToHandlers({
      id: uuid(),
      platform: this.platform,
      userId: this.session?.userId ?? userId,
      senderName: 'BspBuddy 助理',
      content: content + artifactList,
      contentType: 'text',
      timestamp: Date.now(),
      conversationId: `wxbot_${userId}`,
      conversationType: 'single',
    })

    // Mark voice transcript if the original message was voice
    // (voice detection happens in the inbound message pipeline)
  }

  /**
   * Handle voice message: WeChat provides voice-to-text transcription.
   * This adaptor extracts the transcribed text as the message content.
   */
  handleVoiceMessage(rawPayload: { voiceUrl: string; transcript: string }): IMessage {
    return {
      id: uuid(),
      platform: this.platform,
      userId: this.session?.userId ?? '',
      senderName: '微信用户',
      content: rawPayload.transcript,
      contentType: 'voice',
      voiceTranscript: rawPayload.transcript,
      timestamp: Date.now(),
      conversationId: `wxbot_${this.session?.userId ?? ''}`,
      conversationType: 'single',
      rawPayload,
    }
  }

  async getQrCode(): Promise<string> {
    if (!this.session) {
      throw new Error('Not connected. Call connect() first.')
    }
    // In production: get QR code from WeChat Bot API
    return `wxbot_qrcode:${this.session.qrcodeId}`
  }

  async checkVersion(): Promise<{ satisfied: boolean; requiredVersion: string; currentVersion?: string }> {
    const required = '8.0.70'
    // In production: query the installed WeChat version
    const current = this.getInstalledWechatVersion()
    return {
      satisfied: current !== null && this.compareVersions(current, required) >= 0,
      requiredVersion: required,
      currentVersion: current ?? undefined,
    }
  }

  async unbind(): Promise<void> {
    this.status = 'unbinding'
    this.session = null
    this.status = 'disconnected'
  }

  // ---- Private helpers ----

  private checkWechatVersion(): boolean {
    // In production: check against installed WeChat version
    return true
  }

  private getInstalledWechatVersion(): string | null {
    // In production: read from registry / file system
    return null
  }

  private compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pa[i] || 0) - (pb[i] || 0)
      if (diff !== 0) return diff
    }
    return 0
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
        // Swallow handler errors to keep the pipeline going
      }
    }
  }
}
