// ============================================================
// 自定义 Connector — MCP 配置
// 配置方式与 MCP 配置类似，由用户自行定义访问范围
// ============================================================

import type { ConnectorConnectResult, ConnectorMcpConfig } from '../../../lib/connector-types'

interface ConnectionState {
  connected: boolean
  mcpConfig: ConnectorMcpConfig | null
  connectedAt: number | null
}

const state: ConnectionState = {
  connected: false,
  mcpConfig: null,
  connectedAt: null,
}

export const customConnector = {
  async connect(mcpConfig?: ConnectorMcpConfig): Promise<ConnectorConnectResult> {
    if (!mcpConfig || !mcpConfig.name) {
      return { success: false, error: '请提供MCP Server配置（名称、命令等）' }
    }

    if (!mcpConfig.command) {
      return { success: false, error: '请提供MCP Server启动命令' }
    }

    const connectedAt = Date.now()
    state.connected = true
    state.mcpConfig = mcpConfig
    state.connectedAt = connectedAt

    return {
      success: true,
      connection: {
        id: `conn-custom-${mcpConfig.name}`,
        defId: 'connector-custom',
        status: 'active',
        scope: ['custom'],
        connectedAt,
        mcpConfig,
      },
    }
  },

  async disconnect(): Promise<{ success: boolean; error?: string }> {
    state.connected = false
    state.mcpConfig = null
    state.connectedAt = null
    return { success: true }
  },

  getStatus() {
    return {
      connected: state.connected,
      connectedAt: state.connectedAt,
      mcpConfig: state.mcpConfig,
    }
  },
}
