// ============================================================
// 腾讯会议 Connector — OAuth 授权
// ============================================================

import type { ConnectorConnectResult, ConnectorTokenInfo } from '../../../lib/connector-types'

interface ConnectionState {
  connected: boolean
  tokenInfo: ConnectorTokenInfo | null
  connectedAt: number | null
}

const state: ConnectionState = {
  connected: false,
  tokenInfo: null,
  connectedAt: null,
}

export const tencentMeetingConnector = {
  async connect(_config?: Record<string, string>): Promise<ConnectorConnectResult> {
    if (state.connected) {
      return { success: true, connection: getConnection() }
    }

    const redirectUrl = `https://meeting.tencent.com/oauth/authorize?client_id=workbuddy&redirect_uri=workbuddy://callback&scope=meeting.read,meeting.write&state=${Date.now().toString(36)}`

    return {
      success: false,
      redirectUrl,
      error: '请在浏览器中完成OAuth授权',
    }
  },

  async handleCallback(code: string): Promise<ConnectorConnectResult> {
    const connectedAt = Date.now()
    state.connected = true
    state.connectedAt = connectedAt
    state.tokenInfo = {
      accessToken: `meeting-token-${Date.now().toString(36)}`,
      refreshToken: `meeting-refresh-${Date.now().toString(36)}`,
      tokenType: 'Bearer',
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    }

    return {
      success: true,
      connection: getConnection(),
    }
  },

  async disconnect(): Promise<{ success: boolean; error?: string }> {
    state.connected = false
    state.tokenInfo = null
    state.connectedAt = null
    return { success: true }
  },

  getStatus() {
    return {
      connected: state.connected,
      connectedAt: state.connectedAt,
    }
  },

  /** Agent-facing: create meeting */
  async createMeeting(params: { subject: string; startTime: string; duration: number; attendees?: string[] }): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: '腾讯会议未连接' }
    return {
      success: true,
      data: {
        meetingId: `mtg-${Date.now().toString(36)}`,
        subject: params.subject,
        startTime: params.startTime,
        duration: params.duration,
        joinUrl: `https://meeting.tencent.com/dm/${Date.now().toString(36)}`,
        meetingCode: `${Math.floor(100000 + Math.random() * 900000)}`,
        createdAt: new Date().toISOString(),
      },
    }
  },

  /** Agent-facing: query meetings */
  async queryMeetings(params?: { startDate?: string; endDate?: string }): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: '腾讯会议未连接' }
    return {
      success: true,
      data: {
        total: 2,
        items: [
          { meetingId: 'mtg-001', subject: '周会同步', startTime: new Date().toISOString(), status: 'scheduled', attendees: 12 },
          { meetingId: 'mtg-002', subject: '项目评审', startTime: new Date(Date.now() + 86400000).toISOString(), status: 'scheduled', attendees: 8 },
        ],
      },
    }
  },

  /** Agent-facing: get meeting minutes */
  async getMinutes(meetingId: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: '腾讯会议未连接' }
    return {
      success: true,
      data: {
        meetingId,
        subject: '周会同步',
        participants: 12,
        duration: 45,
        summary: '讨论了本周进展、下周计划及风险项',
        recordingUrl: `https://meeting.tencent.com/record/${meetingId}`,
      },
    }
  },
}

function getConnection() {
  return {
    id: 'conn-tencent-meeting',
    defId: 'connector-tencent-meeting',
    status: 'active' as const,
    scope: ['meeting.read', 'meeting.write'],
    connectedAt: state.connectedAt!,
    tokenInfo: state.tokenInfo!,
  }
}
