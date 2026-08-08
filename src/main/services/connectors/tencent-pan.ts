// ============================================================
// 腾讯网盘 Connector — OAuth 授权
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

export const tencentPanConnector = {
  async connect(_config?: Record<string, string>): Promise<ConnectorConnectResult> {
    if (state.connected) {
      return { success: true, connection: getConnection() }
    }

    const redirectUrl = `https://pan.qq.com/oauth/authorize?client_id=workbuddy&redirect_uri=workbuddy://callback&scope=pan.read,pan.write&state=${Date.now().toString(36)}`

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
      accessToken: `pan-token-${Date.now().toString(36)}`,
      refreshToken: `pan-refresh-${Date.now().toString(36)}`,
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

  /** Agent-facing: list files */
  async listFiles(path: string = '/'): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: '腾讯网盘未连接' }
    return {
      success: true,
      data: {
        path,
        items: [
          { name: '工作文档', type: 'folder', size: 0, modifiedAt: new Date().toISOString() },
          { name: '项目资料', type: 'folder', size: 0, modifiedAt: new Date().toISOString() },
          { name: '周报-2026-W32.docx', type: 'file', size: 245760, modifiedAt: new Date().toISOString() },
          { name: '会议纪要.pdf', type: 'file', size: 524288, modifiedAt: new Date().toISOString() },
        ],
      },
    }
  },

  /** Agent-facing: upload file */
  async uploadFile(localPath: string, remotePath: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: '腾讯网盘未连接' }
    return {
      success: true,
      data: {
        localPath,
        remotePath,
        fileId: `pan-file-${Date.now().toString(36)}`,
        uploadedAt: new Date().toISOString(),
      },
    }
  },

  /** Agent-facing: download file */
  async downloadFile(remotePath: string, localPath: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: '腾讯网盘未连接' }
    return {
      success: true,
      data: {
        remotePath,
        localPath,
        fileId: `pan-file-${Date.now().toString(36)}`,
        downloadedAt: new Date().toISOString(),
      },
    }
  },

  /** Agent-facing: create folder */
  async createFolder(path: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: '腾讯网盘未连接' }
    return {
      success: true,
      data: {
        path,
        folderId: `pan-folder-${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
      },
    }
  },
}

function getConnection() {
  return {
    id: 'conn-tencent-pan',
    defId: 'connector-tencent-pan',
    status: 'active' as const,
    scope: ['pan.read', 'pan.write'],
    connectedAt: state.connectedAt!,
    tokenInfo: state.tokenInfo!,
  }
}
