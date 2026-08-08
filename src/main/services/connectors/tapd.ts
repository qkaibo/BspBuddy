// ============================================================
// TAPD Connector — API Key 授权
// ============================================================

import type { ConnectorConnectResult } from '../../../lib/connector-types'

interface ConnectionState {
  connected: boolean
  apiKey: string | null
  workspaceId: string | null
  connectedAt: number | null
}

const state: ConnectionState = {
  connected: false,
  apiKey: null,
  workspaceId: null,
  connectedAt: null,
}

export const tapdConnector = {
  async connect(config?: Record<string, string>): Promise<ConnectorConnectResult> {
    const apiKey = config?.apiKey
    const workspaceId = config?.workspaceId

    if (!apiKey) {
      return { success: false, error: '请提供TAPD API Key' }
    }
    if (!workspaceId) {
      return { success: false, error: '请提供TAPD项目ID' }
    }

    const connectedAt = Date.now()
    state.connected = true
    state.apiKey = apiKey
    state.workspaceId = workspaceId
    state.connectedAt = connectedAt

    return {
      success: true,
      connection: {
        id: 'conn-tapd',
        defId: 'connector-tapd',
        status: 'active',
        scope: ['tapd.read', 'tapd.write'],
        connectedAt,
      },
    }
  },

  async disconnect(): Promise<{ success: boolean; error?: string }> {
    state.connected = false
    state.apiKey = null
    state.workspaceId = null
    state.connectedAt = null
    return { success: true }
  },

  getStatus() {
    return {
      connected: state.connected,
      connectedAt: state.connectedAt,
      workspaceId: state.workspaceId,
    }
  },

  /** Agent-facing: query stories */
  async queryStories(params?: { status?: string; iteration?: string }): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: 'TAPD未连接' }
    return {
      success: true,
      data: {
        workspaceId: state.workspaceId,
        total: 3,
        items: [
          { id: 'story-001', name: '用户登录模块优化', status: 'developing', owner: '张三', priority: 'High', iteration: 'Sprint 12' },
          { id: 'story-002', name: '数据报表导出功能', status: 'testing', owner: '李四', priority: 'Medium', iteration: 'Sprint 12' },
          { id: 'story-003', name: '系统通知推送', status: 'planning', owner: '王五', priority: 'Low', iteration: 'Sprint 13' },
        ],
      },
    }
  },

  /** Agent-facing: create bug */
  async createBug(params: { title: string; severity?: string; description?: string; assignee?: string }): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: 'TAPD未连接' }
    return {
      success: true,
      data: {
        id: `bug-${Date.now().toString(36)}`,
        title: params.title,
        severity: params.severity || 'normal',
        status: 'new',
        workspaceId: state.workspaceId,
        createdAt: new Date().toISOString(),
      },
    }
  },

  /** Agent-facing: update task */
  async updateTask(taskId: string, updates: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: 'TAPD未连接' }
    return {
      success: true,
      data: {
        id: taskId,
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    }
  },

  /** Agent-facing: list iterations */
  async listIterations(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!state.connected) return { success: false, error: 'TAPD未连接' }
    return {
      success: true,
      data: {
        workspaceId: state.workspaceId,
        iterations: [
          { id: 'iter-12', name: 'Sprint 12', startDate: '2026-07-28', endDate: '2026-08-10', status: 'active' },
          { id: 'iter-13', name: 'Sprint 13', startDate: '2026-08-11', endDate: '2026-08-24', status: 'planning' },
        ],
      },
    }
  },
}
