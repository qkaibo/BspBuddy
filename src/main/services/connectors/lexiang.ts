// ============================================================
// 腾讯乐享 Connector — OAuth 授权
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

export const lexiangConnector = {
  async connect(_config?: Record<string, string>): Promise<ConnectorConnectResult> {
    if (state.connected) {
      return { success: true, connection: getConnection() }
    }

    const redirectUrl = `https://lexiang.qq.com/oauth/authorize?client_id=workbuddy&redirect_uri=workbuddy://callback&scope=lexiang.read,lexiang.write&state=${Date.now().toString(36)}`

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
      accessToken: `lexiang-token-${Date.now().toString(36)}`,
      refreshToken: `lexiang-refresh-${Date.now().toString(36)}`,
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

  /** Agent-facing: search knowledge base */
  async searchKnowledge(query: string, tags?: string[]): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: '腾讯乐享未连接' }
    return {
      success: true,
      data: {
        query,
        tags: tags || [],
        total: 2,
        items: [
          { id: 'kb-001', title: `${query}最佳实践`, tags: ['技术', '指南'], updatedAt: new Date().toISOString(), author: '技术团队', space: '技术知识库' },
          { id: 'kb-002', title: `${query}操作手册`, tags: ['操作', 'FAQ'], updatedAt: new Date().toISOString(), author: '运营团队', space: '运营知识库' },
        ],
      },
    }
  },

  /** Agent-facing: import Markdown document */
  async importMarkdown(params: { title: string; content: string; tags?: string[]; space?: string }): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: '腾讯乐享未连接' }
    return {
      success: true,
      data: {
        id: `kb-${Date.now().toString(36)}`,
        title: params.title,
        tags: params.tags || [],
        space: params.space || '默认空间',
        url: `https://lexiang.qq.com/doc/${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
      },
    }
  },

  /** Agent-facing: list knowledge spaces */
  async listSpaces(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: '腾讯乐享未连接' }
    return {
      success: true,
      data: {
        spaces: [
          { id: 'space-1', name: '技术知识库', docCount: 156, memberCount: 42 },
          { id: 'space-2', name: '运营知识库', docCount: 89, memberCount: 28 },
          { id: 'space-3', name: '产品知识库', docCount: 203, memberCount: 35 },
        ],
      },
    }
  },
}

function getConnection() {
  return {
    id: 'conn-lexiang',
    defId: 'connector-lexiang',
    status: 'active' as const,
    scope: ['lexiang.read', 'lexiang.write'],
    connectedAt: state.connectedAt!,
    tokenInfo: state.tokenInfo!,
  }
}
