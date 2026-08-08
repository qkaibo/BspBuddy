// ============================================================
// MCP (Model Context Protocol) types for BspBuddy
// ============================================================

import type { McpServerConfig } from './plugin-types'

// ---------- MCP Server Status ----------
export type McpServerStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

// ---------- MCP Server ----------
export interface McpServer {
  id: string
  name: string
  description: string
  command: string
  args: string[]
  env: Record<string, string>
  status: McpServerStatus
  configLevel: McpConfigLevel
  enabled: boolean
  installedAt?: number
  connectedAt?: number
  errorMessage?: string
  tools?: McpTool[]
  resources?: McpResource[]
  version?: string
  icon?: string
}

export type McpConfigLevel = 'user' | 'project'

// ---------- MCP Tool ----------
export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

// ---------- MCP Resource ----------
export interface McpResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

// ---------- MCP Connection Result ----------
export interface McpConnectResult {
  success: boolean
  server?: McpServer
  error?: string
}

// ---------- MCP Configuration ----------
export interface McpConfig {
  user: McpServerConfig[]
  project: McpServerConfig[]
  marketUrl?: string
  mcpServers?: McpServerConfig[]
}

// ---------- MCP Market Entry ----------
export interface McpMarketEntry {
  id: string
  name: string
  description: string
  command: string
  args: string[]
  envSchema: McpEnvSchema[]
  author: string
  version: string
  downloads: number
  rating: number
  category: string
  icon?: string
}

export interface McpEnvSchema {
  key: string
  label: string
  description: string
  required: boolean
  secret: boolean
}

// ---------- Quick Start Examples ----------
export const MCP_EXAMPLES: McpServerConfig[] = [
  {
    name: 'wecom',
    command: 'uvx',
    args: ['wecom-bot-mcp-server'],
    env: {
      WECOM_WEBHOOK_URL: '',
    },
    description: '企业微信机器人 — 发送消息到企微群',
  },
]
