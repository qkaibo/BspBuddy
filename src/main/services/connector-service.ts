// ============================================================
// Connector Service ??manages connector lifecycle and persistence
// ============================================================

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type {
  ConnectorDef,
  ConnectorConnectRequest,
  ConnectorConnectResult,
  ConnectorDisconnectResult,
  ConnectorStatusResult,
  ConnectorProvider,
} from '../../lib/connector-types'
import { BUILTIN_CONNECTORS } from '../../lib/connector-types'
import { qqmailConnector } from './connectors/qqmail'
import { tencentDocsConnector } from './connectors/tencent-docs'
import { lexiangConnector } from './connectors/lexiang'
import { tencentMeetingConnector } from './connectors/tencent-meeting'
import { tapdConnector } from './connectors/tapd'
import { tencentPanConnector } from './connectors/tencent-pan'
import { customConnector } from './connectors/custom'

function getConnectorDataPath(): string {
  const dir = path.join(app.getPath('userData'), 'connectors')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'connections.json')
}

interface PersistedData {
  connections: Record<string, { connected: boolean; connectedAt: number | null }>
}

function loadPersisted(): PersistedData {
  const p = getConnectorDataPath()
  if (!fs.existsSync(p)) return { connections: {} }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as PersistedData
  } catch {
    return { connections: {} }
  }
}

function savePersisted(data: PersistedData): void {
  fs.writeFileSync(getConnectorDataPath(), JSON.stringify(data, null, 2), 'utf-8')
}

const connectorMap = {
  qqmail: qqmailConnector,
  'tencent-docs': tencentDocsConnector,
  'tencent-lexiang': lexiangConnector,
  'tencent-meeting': tencentMeetingConnector,
  tapd: tapdConnector,
  'tencent-pan': tencentPanConnector,
  custom: customConnector,
} as const

export const connectorService = {
  /** List all connectors with their current connection state */
  list(): ConnectorDef[] {
    const persisted = loadPersisted()

    return BUILTIN_CONNECTORS.map((def) => {
      const handler = connectorMap[def.provider]
      let connected = false

      if (handler) {
        const status = handler.getStatus()
        connected = status.connected
      } else if (persisted.connections[def.id]) {
        connected = persisted.connections[def.id].connected
      }

      return { ...def, connected }
    })
  },

  /** Connect to a connector */
  async connect(req: ConnectorConnectRequest): Promise<ConnectorConnectResult> {
    const handler = connectorMap[req.provider]
    if (!handler) {
      return { success: false, error: `??????: ${req.provider}` }
    }

    const result = await handler.connect((req.config || req.mcpConfig) as any)

    // Persist connection state on success
    if (result.success && result.connection) {
      const persisted = loadPersisted()
      persisted.connections[result.connection.defId] = {
        connected: true,
        connectedAt: result.connection.connectedAt,
      }
      savePersisted(persisted)
    }

    return result
  },

  /** Confirm QQ?? QR scan connection */
  async confirmQQMailConnect(): Promise<ConnectorConnectResult> {
    const result = await qqmailConnector.confirmConnect()
    if (result.success && result.connection) {
      const persisted = loadPersisted()
      persisted.connections[result.connection.defId] = { connected: true, connectedAt: result.connection.connectedAt }
      savePersisted(persisted)
    }
    return result
  },

  /** Handle OAuth callback for applicable connectors */
  async handleOAuthCallback(provider: ConnectorProvider, code: string): Promise<ConnectorConnectResult> {
    let result: ConnectorConnectResult

    switch (provider) {
      case 'tencent-docs':
        result = await tencentDocsConnector.handleCallback(code)
        break
      case 'tencent-lexiang':
        result = await lexiangConnector.handleCallback(code)
        break
      case 'tencent-meeting':
        result = await tencentMeetingConnector.handleCallback(code)
        break
      case 'tencent-pan':
        result = await tencentPanConnector.handleCallback(code)
        break
      default:
        return { success: false, error: `????${provider} ???OAuth??` }
    }

    if (result.success && result.connection) {
      const persisted = loadPersisted()
      persisted.connections[result.connection.defId] = { connected: true, connectedAt: result.connection.connectedAt }
      savePersisted(persisted)
    }

    return result
  },

  /** Disconnect from a connector */
  async disconnect(defId: string): Promise<ConnectorDisconnectResult> {
    const def = BUILTIN_CONNECTORS.find((d) => d.id === defId)
    if (!def) {
      return { success: false, error: `??????: ${defId}` }
    }

    const handler = connectorMap[def.provider]
    if (!handler) {
      return { success: false, error: `?????????? ${def.provider}` }
    }

    const result = await handler.disconnect()

    if (result.success) {
      const persisted = loadPersisted()
      if (persisted.connections[defId]) {
        persisted.connections[defId].connected = false
        persisted.connections[defId].connectedAt = null
        savePersisted(persisted)
      }
    }

    return result
  },

  /** Get connection status for a single connector */
  getStatus(defId: string): ConnectorStatusResult | null {
    const def = BUILTIN_CONNECTORS.find((d) => d.id === defId)
    if (!def) return null

    const handler = connectorMap[def.provider]
    if (!handler) return null

    const status = handler.getStatus()
    return {
      defId: def.id,
      provider: def.provider,
      connected: status.connected,
      status: status.connected ? 'active' : null,
      connectedAt: status.connectedAt || null,
    }
  },

  /** Get QQ?? QR code URL */
  getQQMailQrCode(): string | null {
    return qqmailConnector.getQrCode()
  },

  /** Agent-facing: Search QQ?? emails */
  async searchEmails(query: string) {
    return qqmailConnector.searchEmails(query)
  },

  /** Agent-facing: Send QQ?? email */
  async sendEmail(params: { to: string; subject: string; body: string }) {
    return qqmailConnector.sendEmail(params)
  },

  /** Agent-facing: Search ???? */
  async searchTencentDocs(query: string) {
    return tencentDocsConnector.searchDocs(query)
  },

  /** Agent-facing: Create ???? */
  async createTencentDoc(params: { title: string; content?: string; type?: 'doc' | 'sheet' }) {
    return tencentDocsConnector.createDoc(params)
  },

  /** Agent-facing: Search ???? knowledge */
  async searchLexiang(query: string, tags?: string[]) {
    return lexiangConnector.searchKnowledge(query, tags)
  },

  /** Agent-facing: Import Markdown to ???? */
  async importLexiangMarkdown(params: { title: string; content: string; tags?: string[]; space?: string }) {
    return lexiangConnector.importMarkdown(params)
  },

  /** Agent-facing: Create ???? */
  async createMeeting(params: { subject: string; startTime: string; duration: number; attendees?: string[] }) {
    return tencentMeetingConnector.createMeeting(params)
  },

  /** Agent-facing: Query ???? */
  async queryMeetings(params?: { startDate?: string; endDate?: string }) {
    return tencentMeetingConnector.queryMeetings(params)
  },

  /** Agent-facing: Get ???? minutes */
  async getMeetingMinutes(meetingId: string) {
    return tencentMeetingConnector.getMinutes(meetingId)
  },

  /** Agent-facing: Query TAPD stories */
  async queryTapdStories(params?: { status?: string; iteration?: string }) {
    return tapdConnector.queryStories(params)
  },

  /** Agent-facing: Create TAPD bug */
  async createTapdBug(params: { title: string; severity?: string; description?: string; assignee?: string }) {
    return tapdConnector.createBug(params)
  },

  /** Agent-facing: List ???? files */
  async listPanFiles(filePath: string = '/') {
    return tencentPanConnector.listFiles(filePath)
  },
}
