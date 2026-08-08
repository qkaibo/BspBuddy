// ============================================================
// IM Bridge Service — central hub for all IM platform adaptors
// Manages connection lifecycle, message routing, and remote approval.
// ============================================================

import { EventEmitter } from 'events'
import type {
  IMPlatform,
  IMConnectionStatus,
  IMAdaptor,
  PlatformConfig,
  IMessage,
  ApprovalRequest,
  ApprovalActionCategory,
  AssistantMessage,
  AssistantArtifact,
  IMEvent,
} from '../../lib/im-types'

import { WeixinBotAdaptor } from './adaptors/weixin-bot'
import { WechatCsAdaptor } from './adaptors/wechat-cs'
import { WecomAdaptor } from './adaptors/wecom'
import { QQAdaptor } from './adaptors/qq'
import { FeishuAdaptor } from './adaptors/feishu'
import { DingtalkAdaptor } from './adaptors/dingtalk'
import { YuanbaoAdaptor } from './adaptors/yuanbao'

import { v4 as uuid } from 'uuid'

export class IMBridgeService extends EventEmitter {
  private adaptors: Map<IMPlatform, IMAdaptor> = new Map()
  private connectionStatus: Map<IMPlatform, IMConnectionStatus> = new Map()
  private pendingApprovals: Map<string, ApprovalRequest> = new Map()
  private pendingApprovalResolvers: Map<string, (approved: boolean) => void> = new Map()
  private messageHandlers: Array<(message: AssistantMessage) => void> = []

  constructor() {
    super()
    this.registerAdaptor(new WeixinBotAdaptor())
    this.registerAdaptor(new WechatCsAdaptor())
    this.registerAdaptor(new WecomAdaptor())
    this.registerAdaptor(new QQAdaptor())
    this.registerAdaptor(new FeishuAdaptor())
    this.registerAdaptor(new DingtalkAdaptor())
    this.registerAdaptor(new YuanbaoAdaptor())
  }

  // ---- Adaptor management ----

  registerAdaptor(adaptor: IMAdaptor): void {
    this.adaptors.set(adaptor.platform, adaptor)
    this.connectionStatus.set(adaptor.platform, 'disconnected')

    // Wire up message forwarding
    adaptor.onMessage((msg: IMessage) => {
      const assistant: AssistantMessage = {
        id: uuid(),
        timestamp: msg.timestamp,
        platform: msg.platform,
        role: 'user',
        content: msg.content,
        fromMobile: true,
        senderName: msg.senderName,
        sourceMessageId: msg.id,
      }
      this.messageHandlers.forEach((h) => {
        try { h(assistant) } catch { /* silent */ }
      })
      this.emit('imevent', {
        type: 'message-received',
        message: assistant,
      } as IMEvent)
    })
  }

  getAdaptor(platform: IMPlatform): IMAdaptor | undefined {
    return this.adaptors.get(platform)
  }

  getRegisteredPlatforms(): IMPlatform[] {
    return Array.from(this.adaptors.keys())
  }

  // ---- Connection lifecycle ----

  async connect(platform: IMPlatform, config: PlatformConfig): Promise<void> {
    const adaptor = this.adaptors.get(platform)
    if (!adaptor) {
      throw new Error(`未知平台: ${platform}`)
    }

    this.connectionStatus.set(platform, 'connecting')
    this.emit('imevent', { type: 'status-changed', platform, status: 'connecting' } as IMEvent)

    try {
      await adaptor.connect(config)
      this.connectionStatus.set(platform, 'connected')
      this.emit('imevent', { type: 'status-changed', platform, status: 'connected' } as IMEvent)
    } catch (err) {
      this.connectionStatus.set(platform, 'error')
      this.emit('imevent', { type: 'status-changed', platform, status: 'error' } as IMEvent)
      throw err
    }
  }

  async disconnect(platform: IMPlatform): Promise<void> {
    const adaptor = this.adaptors.get(platform)
    if (!adaptor) return

    try {
      await adaptor.disconnect()
    } finally {
      this.connectionStatus.set(platform, 'disconnected')
      this.emit('imevent', { type: 'status-changed', platform, status: 'disconnected' } as IMEvent)
    }
  }

  async unbind(platform: IMPlatform): Promise<void> {
    const adaptor = this.adaptors.get(platform)
    if (!adaptor) return

    try {
      await adaptor.unbind()
    } finally {
      this.connectionStatus.set(platform, 'disconnected')
      this.emit('imevent', { type: 'status-changed', platform, status: 'disconnected' } as IMEvent)
    }
  }

  getStatus(platform: IMPlatform): IMConnectionStatus {
    return this.connectionStatus.get(platform) ?? 'disconnected'
  }

  getAllStatus(): Array<{ platform: IMPlatform; status: IMConnectionStatus }> {
    return Array.from(this.connectionStatus.entries()).map(([platform, status]) => ({ platform, status }))
  }

  getConnectedPlatforms(): IMPlatform[] {
    return Array.from(this.connectionStatus.entries())
      .filter(([, status]) => status === 'connected')
      .map(([platform]) => platform)
  }

  // ---- Message routing ----

  onAssistantMessage(handler: (message: AssistantMessage) => void): void {
    this.messageHandlers.push(handler)
  }

  offAssistantMessage(handler: (message: AssistantMessage) => void): void {
    this.messageHandlers = this.messageHandlers.filter((h) => h !== handler)
  }

  async sendMessage(
    platform: IMPlatform,
    userId: string,
    content: string,
    artifacts?: AssistantArtifact[],
  ): Promise<void> {
    const adaptor = this.adaptors.get(platform)
    if (!adaptor) {
      throw new Error(`未知平台: ${platform}`)
    }
    await adaptor.sendMessage(userId, content, artifacts)

    // Record the sent message as assistant response
    const assistant: AssistantMessage = {
      id: uuid(),
      timestamp: Date.now(),
      platform,
      role: 'assistant',
      content,
      fromMobile: false,
      artifacts,
    }
    this.messageHandlers.forEach((h) => {
      try { h(assistant) } catch { /* silent */ }
    })
  }

  async sendGroupMessage(
    platform: IMPlatform,
    conversationId: string,
    content: string,
    artifacts?: AssistantArtifact[],
  ): Promise<void> {
    const adaptor = this.adaptors.get(platform)
    if (!adaptor || !adaptor.sendGroupMessage) {
      throw new Error(`平台 ${platform} 不支持群聊消息`)
    }
    await adaptor.sendGroupMessage(conversationId, content, artifacts)
  }

  // ---- QR code acquisition ----

  async getQrCode(platform: IMPlatform): Promise<string> {
    const adaptor = this.adaptors.get(platform)
    if (!adaptor || !adaptor.getQrCode) {
      throw new Error(`平台 ${platform} 不支持二维码绑定`)
    }
    return adaptor.getQrCode()
  }

  // ---- Remote approval ----

  /**
   * Request user approval via phone IM.
   * The user receives an interactive approval card on their phone.
   * Returns true if approved, false if denied or timed out.
   */
  async requestApproval(
    platform: IMPlatform,
    userId: string,
    action: string,
    details: string,
    category: ApprovalActionCategory,
  ): Promise<boolean> {
    const adaptor = this.adaptors.get(platform)
    if (!adaptor) {
      throw new Error(`未知平台: ${platform}`)
    }

    const request = await adaptor.sendApprovalRequest(userId, action, details, category)
    this.pendingApprovals.set(request.id, request)

    // Wait for the user to approve or deny on their phone
    return new Promise<boolean>((resolve) => {
      this.pendingApprovalResolvers.set(request.id, resolve)

      this.emit('imevent', {
        type: 'approval-requested',
        request,
      } as IMEvent)

      // Auto-deny on timeout
      setTimeout(() => {
        if (this.pendingApprovalResolvers.has(request.id)) {
          request.approved = false
          request.respondedAt = Date.now()
          this.pendingApprovalResolvers.delete(request.id)

          this.emit('imevent', {
            type: 'approval-resolved',
            requestId: request.id,
            approved: false,
          } as IMEvent)

          resolve(false)
        }
      }, request.timeoutMs)
    })
  }

  /**
   * Resolve a pending approval — called when the user taps Approve/Deny on their phone.
   */
  resolveApproval(requestId: string, approved: boolean): boolean {
    const resolver = this.pendingApprovalResolvers.get(requestId)
    if (!resolver) {
      return false
    }

    const request = this.pendingApprovals.get(requestId)
    if (request) {
      request.approved = approved
      request.respondedAt = Date.now()
    }

    this.pendingApprovalResolvers.delete(requestId)
    resolver(approved)

    this.emit('imevent', {
      type: 'approval-resolved',
      requestId,
      approved,
    } as IMEvent)

    return true
  }

  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values())
  }

  // ---- Shutdown ----

  async shutdown(): Promise<void> {
    for (const [platform, adaptor] of this.adaptors) {
      try {
        await adaptor.disconnect()
      } catch {
        // Force cleanup
      }
      this.connectionStatus.set(platform, 'disconnected')
    }
  }
}

/** Singleton IM bridge service */
export const imBridge = new IMBridgeService()
