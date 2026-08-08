// ============================================================
// 腾讯文档 Connector — OAuth 授权
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

export const tencentDocsConnector = {
  async connect(_config?: Record<string, string>): Promise<ConnectorConnectResult> {
    if (state.connected) {
      return { success: true, connection: getConnection() }
    }

    // Simulate OAuth redirect
    const redirectUrl = `https://docs.qq.com/oauth/authorize?client_id=workbuddy&redirect_uri=workbuddy://callback&scope=docs.read,docs.write&state=${Date.now().toString(36)}`

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
      accessToken: `docs-token-${Date.now().toString(36)}`,
      refreshToken: `docs-refresh-${Date.now().toString(36)}`,
      tokenType: 'Bearer',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
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

  /** Agent-facing: search documents */
  async searchDocs(query: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: '腾讯文档未连接' }
    return {
      success: true,
      data: {
        query,
        total: 2,
        items: [
          { id: 'doc-001', title: `${query}策划方案`, type: 'doc', updatedAt: new Date().toISOString(), url: 'https://docs.qq.com/doc/xxx' },
          { id: 'doc-002', title: `${query}数据分析表`, type: 'sheet', updatedAt: new Date().toISOString(), url: 'https://docs.qq.com/sheet/xxx' },
        ],
      },
    }
  },

  /** Agent-facing: create document */
  async createDoc(params: { title: string; content?: string; type?: 'doc' | 'sheet' }): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: '腾讯文档未连接' }
    return {
      success: true,
      data: {
        id: `doc-${Date.now().toString(36)}`,
        title: params.title,
        type: params.type || 'doc',
        url: `https://docs.qq.com/doc/${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
      },
    }
  },
}

function getConnection() {
  return {
    id: 'conn-tencent-docs',
    defId: 'connector-tencent-docs',
    status: 'active' as const,
    scope: ['docs.read', 'docs.write'],
    connectedAt: state.connectedAt!,
    tokenInfo: state.tokenInfo!,
  }
}
