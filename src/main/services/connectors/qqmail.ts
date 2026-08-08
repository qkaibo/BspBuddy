// ============================================================
// QQ邮箱 Connector — QR扫码授权
// ============================================================

import type { ConnectorConnectResult, ConnectorTokenInfo } from '../../../lib/connector-types'

interface ConnectionState {
  connected: boolean
  tokenInfo: ConnectorTokenInfo | null
  connectedAt: number | null
  qrCodeUrl: string | null
  qrCodeExpiresAt: number | null
}

const state: ConnectionState = {
  connected: false,
  tokenInfo: null,
  connectedAt: null,
  qrCodeUrl: null,
  qrCodeExpiresAt: null,
}

function generateQrCode(): { url: string; expiresAt: number } {
  const sessionId = `qqmail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5分钟过期
  const url = `https://mail.qq.com/cgi-bin/qrlogin?session=${sessionId}&app=workbuddy&ts=${Date.now()}`
  return { url, expiresAt }
}

export const qqmailConnector = {
  async connect(_config?: Record<string, string>): Promise<ConnectorConnectResult> {
    if (state.connected) {
      return { success: true, connection: { id: 'conn-qqmail', defId: 'connector-qqmail', status: 'active', scope: ['mail.read', 'mail.write', 'mail.send'], connectedAt: state.connectedAt! } }
    }

    // Generate QR code for scanning
    const { url, expiresAt } = generateQrCode()
    state.qrCodeUrl = url
    state.qrCodeExpiresAt = expiresAt

    return {
      success: false,
      qrCodeUrl: url,
      error: '请使用QQ邮箱 App (7.1.5+/鸿蒙 0.2.9+) 扫描二维码授权',
    }
  },

  async confirmConnect(): Promise<ConnectorConnectResult> {
    if (!state.qrCodeUrl || (state.qrCodeExpiresAt && Date.now() > state.qrCodeExpiresAt)) {
      return { success: false, error: '二维码已过期，请重新发起连接' }
    }

    const connectedAt = Date.now()
    state.connected = true
    state.connectedAt = connectedAt
    state.tokenInfo = {
      accessToken: `qqmail-token-${Date.now().toString(36)}`,
      refreshToken: `qqmail-refresh-${Date.now().toString(36)}`,
      tokenType: 'Bearer',
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30天
    }
    state.qrCodeUrl = null
    state.qrCodeExpiresAt = null

    return {
      success: true,
      connection: {
        id: 'conn-qqmail',
        defId: 'connector-qqmail',
        status: 'active',
        scope: ['mail.read', 'mail.write', 'mail.send'],
        connectedAt,
        tokenInfo: state.tokenInfo,
      },
    }
  },

  async disconnect(): Promise<{ success: boolean; error?: string }> {
    state.connected = false
    state.tokenInfo = null
    state.connectedAt = null
    state.qrCodeUrl = null
    state.qrCodeExpiresAt = null
    return { success: true }
  },

  getStatus() {
    return {
      connected: state.connected,
      connectedAt: state.connectedAt,
      qrCodeUrl: state.qrCodeUrl,
      qrCodeExpiresAt: state.qrCodeExpiresAt,
    }
  },

  getQrCode(): string | null {
    if (state.qrCodeExpiresAt && Date.now() > state.qrCodeExpiresAt) {
      state.qrCodeUrl = null
      state.qrCodeExpiresAt = null
      return null
    }
    return state.qrCodeUrl
  },

  /** Agent-facing: search emails */
  async searchEmails(query: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: 'QQ邮箱未连接' }
    return {
      success: true,
      data: {
        query,
        total: 3,
        items: [
          { id: '1', subject: `关于${query}的会议纪要`, from: 'team@example.com', date: new Date().toISOString(), snippet: '...会议讨论了以下要点...' },
          { id: '2', subject: `Re: ${query} 更新通知`, from: 'manager@example.com', date: new Date().toISOString(), snippet: '...以下是更新的内容...' },
          { id: '3', subject: `${query} 周报`, from: 'report@example.com', date: new Date().toISOString(), snippet: '...本周工作总结...' },
        ],
      },
    }
  },

  /** Agent-facing: send email */
  async sendEmail(params: { to: string; subject: string; body: string }): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: 'QQ邮箱未连接' }
    return {
      success: true,
      data: { messageId: `msg-${Date.now()}`, sent: true, to: params.to, subject: params.subject },
    }
  },
}
