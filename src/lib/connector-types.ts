// ============================================================
// Connector types for BspBuddy
// ============================================================

// ---------- Connector Provider ----------
export type ConnectorProvider =
  | 'qqmail'
  | 'tencent-docs'
  | 'tencent-lexiang'
  | 'tencent-meeting'
  | 'tapd'
  | 'tencent-pan'
  | 'custom'

// ---------- Authorization Type ----------
export type ConnectorAuthType = 'oauth' | 'qrcode' | 'apikey' | 'mcp'

// ---------- Connector Architecture ----------
export type ConnectorArchitecture = 'MCP+CLI' | 'Skill+CLI'

// ---------- Connection Status ----------
export type ConnectorConnectionStatus = 'active' | 'expired' | 'revoked'

// ---------- Application Scenario ----------
export type ConnectorScenario = '数据查询' | '服务调用' | '文件管理' | '消息通知'

// ---------- Connector Definition ----------
export interface ConnectorDef {
  id: string
  name: string
  description: string
  provider: ConnectorProvider
  icon?: string
  authType: ConnectorAuthType
  connected: boolean
  architecture: ConnectorArchitecture
  scenarios: ConnectorScenario[]
  authUrl?: string
  revokeHint?: string
  configFields?: ConnectorConfigField[]
  supportedActions?: string[]
}

// ---------- Config Field ----------
export interface ConnectorConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'select'
  required: boolean
  placeholder?: string
  options?: { label: string; value: string }[]
}

// ---------- Connector Connection ----------
export interface ConnectorConnection {
  id: string
  defId: string
  status: ConnectorConnectionStatus
  scope: string[]
  connectedAt: number
  expiresAt?: number
  tokenInfo?: ConnectorTokenInfo
  mcpConfig?: ConnectorMcpConfig
}

// ---------- Token Info ----------
export interface ConnectorTokenInfo {
  accessToken: string
  refreshToken?: string
  tokenType: string
  expiresAt?: number
}

// ---------- MCP Configuration for Custom Connector ----------
export interface ConnectorMcpConfig {
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  description?: string
}

// ---------- Connect Request ----------
export interface ConnectorConnectRequest {
  defId: string
  provider: ConnectorProvider
  config?: Record<string, string>
  mcpConfig?: ConnectorMcpConfig
}

// ---------- Connect Result ----------
export interface ConnectorConnectResult {
  success: boolean
  connection?: ConnectorConnection
  qrCodeUrl?: string
  error?: string
  redirectUrl?: string
}

// ---------- Disconnect Result ----------
export interface ConnectorDisconnectResult {
  success: boolean
  error?: string
}

// ---------- Connector Status Result ----------
export interface ConnectorStatusResult {
  defId: string
  provider: ConnectorProvider
  connected: boolean
  status: ConnectorConnectionStatus | null
  connectedAt: number | null
}

// ---------- Built-in Connector Definitions ----------
export const BUILTIN_CONNECTORS: ConnectorDef[] = [
  {
    id: 'connector-qqmail',
    name: 'QQ邮箱',
    description: '连接QQ邮箱，收发、搜索、整理邮件，自然语言读取内容、汇总线程、管理文件夹',
    provider: 'qqmail',
    icon: 'Mail',
    authType: 'qrcode',
    connected: false,
    architecture: 'MCP+CLI',
    scenarios: ['数据查询', '服务调用', '消息通知'],
    authUrl: 'https://mail.qq.com/cgi-bin/authorize',
    revokeHint: 'QQ邮箱 App → 设置 → 账号 → 安全管理 → 应用授权',
    supportedActions: ['搜索邮件', '发送邮件', '读取邮件', '管理文件夹', '汇总线程'],
  },
  {
    id: 'connector-tencent-docs',
    name: '腾讯文档',
    description: '连接腾讯文档，在线编辑、协作共享、文档搜索与管理',
    provider: 'tencent-docs',
    icon: 'FileText',
    authType: 'oauth',
    connected: false,
    architecture: 'MCP+CLI',
    scenarios: ['数据查询', '文件管理'],
    authUrl: 'https://docs.qq.com/oauth/authorize',
    revokeHint: '腾讯文档 → 设置 → 第三方应用管理 → 取消授权',
    supportedActions: ['搜索文档', '创建文档', '读取文档', '编辑文档', '导出文档'],
  },
  {
    id: 'connector-lexiang',
    name: '腾讯乐享',
    description: '连接腾讯乐享知识库，搜索、创建、管理知识库文档，导入Markdown、按标签整理、追踪更新',
    provider: 'tencent-lexiang',
    icon: 'BookOpen',
    authType: 'oauth',
    connected: false,
    architecture: 'MCP+CLI',
    scenarios: ['数据查询', '文件管理'],
    authUrl: 'https://lexiang.qq.com/oauth/authorize',
    revokeHint: '腾讯乐享 → 设置 → 应用授权管理 → 取消授权',
    supportedActions: ['搜索知识库', '创建文档', '导入Markdown', '按标签整理', '追踪更新'],
  },
  {
    id: 'connector-tencent-meeting',
    name: '腾讯会议',
    description: '连接腾讯会议，创建/查询/管理会议，获取会议记录与纪要',
    provider: 'tencent-meeting',
    icon: 'Video',
    authType: 'oauth',
    connected: false,
    architecture: 'MCP+CLI',
    scenarios: ['服务调用', '消息通知'],
    authUrl: 'https://meeting.tencent.com/oauth/authorize',
    revokeHint: '腾讯会议 → 个人中心 → 第三方应用 → 取消授权',
    supportedActions: ['创建会议', '查询会议', '获取会议纪要', '管理参会者'],
  },
  {
    id: 'connector-tapd',
    name: 'TAPD',
    description: '连接TAPD项目管理平台，需求/缺陷/任务管理，项目协作与追踪',
    provider: 'tapd',
    icon: 'ClipboardList',
    authType: 'apikey',
    connected: false,
    architecture: 'MCP+CLI',
    scenarios: ['数据查询', '服务调用'],
    authUrl: 'https://www.tapd.cn/help/view#1120003271001000093',
    revokeHint: 'TAPD → 个人设置 → API Key管理 → 删除Key',
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: '输入TAPD API Key' },
      { key: 'workspaceId', label: '项目ID', type: 'text', required: true, placeholder: '输入TAPD项目ID' },
    ],
    supportedActions: ['查询需求', '创建缺陷', '更新任务', '查看迭代', '生成报表'],
  },
  {
    id: 'connector-tencent-pan',
    name: '腾讯网盘',
    description: '连接腾讯网盘，云端文件存取、同步、共享与管理',
    provider: 'tencent-pan',
    icon: 'Cloud',
    authType: 'oauth',
    connected: false,
    architecture: 'MCP+CLI',
    scenarios: ['文件管理'],
    authUrl: 'https://pan.qq.com/oauth/authorize',
    revokeHint: '腾讯网盘 → 设置 → 授权管理 → 取消授权',
    supportedActions: ['上传文件', '下载文件', '列出文件', '创建文件夹', '分享文件'],
  },
]

// ---------- Custom Connector Template ----------
export const CUSTOM_CONNECTOR_DEF: ConnectorDef = {
  id: 'connector-custom',
  name: '自定义连接器',
  description: '自定义MCP连接器，配置方式与MCP配置类似，访问范围由用户配置决定',
  provider: 'custom',
  icon: 'Plug',
  authType: 'mcp',
  connected: false,
  architecture: 'MCP+CLI',
  scenarios: ['数据查询', '服务调用', '文件管理', '消息通知'],
  configFields: [
    { key: 'name', label: '连接器名称', type: 'text', required: true, placeholder: '输入连接器名称' },
    { key: 'command', label: '启动命令', type: 'text', required: true, placeholder: '例如: uvx 或 npx' },
    { key: 'args', label: '命令参数', type: 'text', required: false, placeholder: '多个参数用逗号分隔' },
    { key: 'env', label: '环境变量', type: 'text', required: false, placeholder: 'KEY=VALUE 格式，多行输入' },
  ],
}
