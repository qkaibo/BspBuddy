// ============================================================
// MCP service — manages MCP server lifecycle and configuration
// ============================================================

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import type { McpServer, McpConfig, McpConnectResult, McpMarketEntry, McpServerStatus } from '../../lib/mcp-types'
import type { McpServerConfig } from '../../lib/plugin-types'
import { MCP_EXAMPLES } from '../../lib/mcp-types'

function getUserMcpPath(): string {
  const dir = path.join(app.getPath('userData'), 'mcp')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'mcp.json')
}

function getProjectMcpPath(projectPath?: string): string {
  if (projectPath) {
    const dir = path.join(projectPath, '.workbuddy')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return path.join(dir, 'mcp.json')
  }
  return path.join(process.cwd(), '.workbuddy', 'mcp.json')
}

function loadUserConfig(): McpServerConfig[] {
  const p = getUserMcpPath()
  if (!fs.existsSync(p)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as McpConfig
    return raw.mcpServers || (raw as unknown as McpServerConfig[])
  } catch {
    return []
  }
}

function saveUserConfig(servers: McpServerConfig[]): void {
  const config: McpConfig = { user: servers, project: [] }
  fs.writeFileSync(getUserMcpPath(), JSON.stringify(config, null, 2), 'utf-8')
}

function loadProjectConfig(projectPath?: string): McpServerConfig[] {
  const p = getProjectMcpPath(projectPath)
  if (!fs.existsSync(p)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as { mcpServers?: McpServerConfig[] }
    return raw.mcpServers || (raw as unknown as McpServerConfig[])
  } catch {
    return []
  }
}

function saveProjectConfig(servers: McpServerConfig[], projectPath?: string): void {
  const config = { mcpServers: servers }
  const p = getProjectMcpPath(projectPath)
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf-8')
}

const KNOWN_SERVERS: Map<string, Pick<McpServer, 'name' | 'description' | 'tools' | 'resources'>> = new Map(
  MCP_EXAMPLES.map((e) => [e.name, { name: e.name, description: e.description || e.name, tools: [], resources: [] }]),
)

const MCP_MARKET: McpMarketEntry[] = [
  {
    id: 'mcp-market-wecom',
    name: 'wecom',
    description: '企业微信机器人 — 通过WebHook向企微群发送消息',
    command: 'uvx',
    args: ['wecom-bot-mcp-server'],
    envSchema: [
      { key: 'WECOM_WEBHOOK_URL', label: 'WebHook URL', description: '企微群机器人的Webhook地址', required: true, secret: true },
    ],
    author: 'BspBuddy',
    version: '1.0.0',
    downloads: 15200,
    rating: 4.6,
    category: 'communication',
  },
  {
    id: 'mcp-market-filesystem',
    name: 'filesystem',
    description: '文件系统访问 — 安全的文件读写和目录操作',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    envSchema: [
      { key: 'ALLOWED_DIRECTORIES', label: '允许的目录', description: '允许访问的目录路径', required: true, secret: false },
    ],
    author: 'Anthropic',
    version: '0.6.0',
    downloads: 45000,
    rating: 4.8,
    category: 'filesystem',
  },
  {
    id: 'mcp-market-github',
    name: 'github',
    description: 'GitHub集成 — 仓库管理、Issue操作、PR管理',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    envSchema: [
      { key: 'GITHUB_PERSONAL_ACCESS_TOKEN', label: 'Access Token', description: 'GitHub Personal Access Token', required: true, secret: true },
    ],
    author: 'Anthropic',
    version: '0.5.0',
    downloads: 32000,
    rating: 4.7,
    category: 'development',
  },
  {
    id: 'mcp-market-postgres',
    name: 'postgres',
    description: 'PostgreSQL数据库 — 数据库查询和管理',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    envSchema: [
      { key: 'DATABASE_URL', label: '数据库URL', description: 'PostgreSQL连接字符串', required: true, secret: true },
    ],
    author: 'Anthropic',
    version: '0.5.0',
    downloads: 18000,
    rating: 4.5,
    category: 'database',
  },
]

const connectedServers = new Map<string, McpServer>()

export const mcpService = {
  /** List all MCP servers with their current status */
  list(projectPath?: string): McpServer[] {
    const userConfigs = loadUserConfig()
    const projectConfigs = loadProjectConfig(projectPath)

    const servers: McpServer[] = []

    for (const cfg of userConfigs) {
      const connected = connectedServers.get(`user:${cfg.name}`)
      servers.push({
        id: `mcp-user-${cfg.name}`,
        name: cfg.name,
        description: cfg.description || cfg.name,
        command: cfg.command,
        args: cfg.args || [],
        env: cfg.env || {},
        status: connected?.status || 'disconnected',
        configLevel: 'user',
        enabled: cfg.enabled !== false,
        connectedAt: connected?.connectedAt,
        errorMessage: connected?.errorMessage,
        tools: connected?.tools || KNOWN_SERVERS.get(cfg.name)?.tools || [],
        resources: connected?.resources || KNOWN_SERVERS.get(cfg.name)?.resources || [],
      })
    }

    for (const cfg of projectConfigs) {
      const connected = connectedServers.get(`project:${cfg.name}`)
      servers.push({
        id: `mcp-project-${cfg.name}`,
        name: cfg.name,
        description: cfg.description || cfg.name,
        command: cfg.command,
        args: cfg.args || [],
        env: cfg.env || {},
        status: connected?.status || 'disconnected',
        configLevel: 'project',
        enabled: cfg.enabled !== false,
        connectedAt: connected?.connectedAt,
        errorMessage: connected?.errorMessage,
        tools: connected?.tools || KNOWN_SERVERS.get(cfg.name)?.tools || [],
        resources: connected?.resources || KNOWN_SERVERS.get(cfg.name)?.resources || [],
      })
    }

    return servers
  },

  /** Connect (register) an MCP server configuration */
  connect(config: McpServerConfig, level: 'user' | 'project', projectPath?: string): McpConnectResult {
    try {
      const configs = level === 'user' ? loadUserConfig() : loadProjectConfig(projectPath)
      const existingIdx = configs.findIndex((c) => c.name === config.name)

      if (existingIdx >= 0) {
        configs[existingIdx] = { ...configs[existingIdx], ...config }
      } else {
        configs.push(config)
      }

      if (level === 'user') saveUserConfig(configs)
      else saveProjectConfig(configs, projectPath)

      // Simulate connection
      const key = `${level}:${config.name}`
      const needsUrl = config.env && Object.values(config.env).some((v) => v === '' || v === undefined)

      if (needsUrl && config.name === 'wecom') {
        const server: McpServer = {
          id: `mcp-${level}-${config.name}`,
          name: config.name,
          description: config.description || config.name,
          command: config.command,
          args: config.args || [],
          env: config.env || {},
          status: 'error',
          configLevel: level,
          enabled: true,
          connectedAt: Date.now(),
          errorMessage: '请填写企微 WebHook URL',
          tools: [],
          resources: [],
        }
        connectedServers.set(key, server)
        return { success: false, error: '连接失败: 请填写企微 WebHook URL', server }
      }

      const server: McpServer = {
        id: `mcp-${level}-${config.name}`,
        name: config.name,
        description: config.description || config.name,
        command: config.command,
        args: config.args || [],
        env: config.env || {},
        status: 'connected',
        configLevel: level,
        enabled: true,
        connectedAt: Date.now(),
        tools: KNOWN_SERVERS.get(config.name)?.tools || [],
        resources: KNOWN_SERVERS.get(config.name)?.resources || [],
        version: '1.0.0',
      }
      connectedServers.set(key, server)

      return { success: true, server }
    } catch (err) {
      return { success: false, error: `连接失败: ${err instanceof Error ? err.message : String(err)}` }
    }
  },

  /** Disconnect an MCP server */
  disconnect(serverId: string): McpConnectResult {
    // Extract key from serverId format: mcp-user-name or mcp-project-name
    const parts = serverId.replace('mcp-', '').split('-')
    const level = parts[0] as 'user' | 'project'
    const name = parts.slice(1).join('-')
    const key = `${level}:${name}`

    const server = connectedServers.get(key)
    connectedServers.delete(key)

    return {
      success: true,
      server: server
        ? { ...server, status: 'disconnected' as McpServerStatus }
        : { id: serverId, name, description: '', command: '', args: [], env: {}, status: 'disconnected', configLevel: level, enabled: false },
    }
  },

  /** Get MCP market entries */
  getMarket(): McpMarketEntry[] {
    return MCP_MARKET
  },

  /** Configure an MCP server from a raw JSON config */
  configure(rawConfig: string, level: 'user' | 'project', projectPath?: string): McpConnectResult {
    try {
      const parsed = JSON.parse(rawConfig)
      const mcpServers = parsed.mcpServers || parsed

      if (typeof mcpServers !== 'object') {
        return { success: false, error: '配置格式错误: 请提供 { "mcpServers": { ... } } 格式' }
      }

      const results: McpConnectResult[] = []
      for (const [name, cfg] of Object.entries(mcpServers)) {
        const config = cfg as McpServerConfig
        config.name = name
        const result = this.connect(config, level, projectPath)
        results.push(result)
      }

      if (results.length === 1) return results[0]
      return {
        success: results.every((r) => r.success),
        error: results.filter((r) => !r.success).map((r) => r.error).join('; ') || undefined,
        server: results[0]?.server,
      }
    } catch (err) {
      return { success: false, error: `JSON解析失败: ${err instanceof Error ? err.message : String(err)}` }
    }
  },

  /** Check connection status of a server */
  checkStatus(serverName: string): McpServerStatus {
    const userKey = `user:${serverName}`
    const projectKey = `project:${serverName}`
    const server = connectedServers.get(userKey) || connectedServers.get(projectKey)
    return server?.status || 'disconnected'
  },

  /** Delete a server configuration completely */
  deleteConfig(serverName: string, level: 'user' | 'project', projectPath?: string): boolean {
    const configs = level === 'user' ? loadUserConfig() : loadProjectConfig(projectPath)
    const idx = configs.findIndex((c) => c.name === serverName)
    if (idx < 0) return false
    configs.splice(idx, 1)
    if (level === 'user') saveUserConfig(configs)
    else saveProjectConfig(configs, projectPath)
    connectedServers.delete(`${level}:${serverName}`)
    return true
  },
}
