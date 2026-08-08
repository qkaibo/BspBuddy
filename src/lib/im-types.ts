// ============================================================
// IM (Instant Messaging) Integration Types — BspBuddy Remote Assistant
// ============================================================

// ---------- Platform identifiers ----------
export type IMPlatform =
  | 'weixin-bot'    // 微信助理 (Bot)
  | 'wechat-cs'     // 微信客服号
  | 'wecom'         // 企业微信
  | 'qq'            // QQ
  | 'feishu'        // 飞书
  | 'dingtalk'      // 钉钉
  | 'yuanbao'       // 元宝派

export const IM_PLATFORMS: IMPlatform[] = [
  'weixin-bot', 'wechat-cs', 'wecom', 'qq', 'feishu', 'dingtalk', 'yuanbao',
]

export const IM_PLATFORM_LABELS: Record<IMPlatform, string> = {
  'weixin-bot': '微信助理',
  'wechat-cs': '微信客服号',
  'wecom': '企业微信',
  qq: 'QQ',
  feishu: '飞书',
  dingtalk: '钉钉',
  yuanbao: '元宝派',
}

// ---------- Connection mode ----------
export type ConnectionMode = 'qrcode' | 'websocket' | 'url-callback'

export const PLATFORM_CONNECTION_MODES: Record<IMPlatform, ConnectionMode[]> = {
  'weixin-bot': ['qrcode'],
  'wechat-cs': ['qrcode'],
  wecom: ['websocket', 'url-callback'],
  qq: ['qrcode', 'websocket', 'url-callback'],
  feishu: ['websocket', 'url-callback'],
  dingtalk: ['qrcode'],
  yuanbao: ['qrcode'],
}

// ---------- Connection status ----------
export type IMConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'unbinding'

// ---------- Platform credentials ----------
export interface WeixinBotConfig {
  platform: 'weixin-bot'
  /** QR-code based binding — no App ID/Secret needed */
  qrcodeData?: string
  /** Version constraint: WeChat >= 8.0.70 */
  minWechatVersion: string
}

export interface WechatCsConfig {
  platform: 'wechat-cs'
  /** QR-code based binding — no credentials needed */
  qrcodeData?: string
}

export interface WecomConfig {
  platform: 'wecom'
  mode: 'websocket' | 'url-callback'
  /** Bot ID (websocket mode) */
  botId?: string
  /** Bot Secret (websocket mode) */
  secret?: string
  /** Token (URL callback mode) */
  token?: string
  /** Encoding AES Key (URL callback mode) */
  encodingAesKey?: string
  /** Callback URL */
  callbackUrl?: string
  /** Corp ID */
  corpId?: string
  /** Whether created by admin (true) or regular member (false) */
  isAdminCreated?: boolean
}

export interface QQConfig {
  platform: 'qq'
  mode: 'qrcode' | 'websocket' | 'url-callback'
  /** App ID from QQ Open Platform */
  appId?: string
  /** App Secret — never stored in plain text; secondary view triggers forced reset */
  appSecret?: string
  /** QR code data */
  qrcodeData?: string
  /** Callback URL (for URL callback mode) */
  callbackUrl?: string
}

export interface FeishuConfig {
  platform: 'feishu'
  mode: 'websocket' | 'url-callback'
  /** App ID */
  appId?: string
  /** App Secret */
  appSecret?: string
  /** Encrypt Key */
  encryptKey?: string
  /** Verification token for event subscriptions */
  verificationToken?: string
  /** Permissions granted */
  permissions?: FeishuPermission[]
}

export type FeishuPermission =
  | 'contact:user:readonly'
  | 'im:message'
  | 'im:message.p2p_msg'
  | 'im:message.group_msg'
  | 'im:message:send_as_bot'
  | 'contact:contact:readonly'
  | 'approval:instance:write'

export interface DingtalkConfig {
  platform: 'dingtalk'
  /** App Key */
  appKey?: string
  /** App Secret */
  appSecret?: string
  /** AES Key for HTTP push */
  aesKey?: string
  /** Token for HTTP push */
  token?: string
  /** Whether the bot has passed publish review */
  published?: boolean
  /** Corp ID */
  corpId?: string
}

export interface YuanbaoConfig {
  platform: 'yuanbao'
  /** Primary method: QR code */
  qrcodeData?: string
  /** Alternative: App Key (set as App ID) */
  appId?: string
  /** Alternative: App Secret */
  appSecret?: string
  /** Community group (派) ID */
  communityId?: string
  /** Whether deployed to community group */
  communityDeployed?: boolean
}

export type PlatformConfig =
  | WeixinBotConfig
  | WechatCsConfig
  | WecomConfig
  | QQConfig
  | FeishuConfig
  | DingtalkConfig
  | YuanbaoConfig

// ---------- IM Message ----------
export interface IMessage {
  id: string
  platform: IMPlatform
  /** User ID on the platform */
  userId: string
  /** Display name of sender */
  senderName: string
  /** Text content (voice messages are transcribed) */
  content: string
  /** Original content type */
  contentType: 'text' | 'voice' | 'image' | 'file' | 'mixed'
  /** Voice transcription if applicable */
  voiceTranscript?: string
  /** Attachments */
  attachments?: IMAttachment[]
  /** Timestamp */
  timestamp: number
  /** Conversation / group ID */
  conversationId: string
  /** Conversation type */
  conversationType: 'single' | 'group'
  /** Whether the bot was @-mentioned (group chats) */
  atMentioned?: boolean
  /** Raw platform-specific payload */
  rawPayload?: unknown
}

export interface IMAttachment {
  id: string
  type: 'image' | 'file' | 'voice' | 'video'
  name: string
  mimeType: string
  size: number
  url: string
  localPath?: string
}

// ---------- Approval request (sent to phone IM) ----------
export type ApprovalActionCategory =
  | 'file_delete'
  | 'file_write'
  | 'system_config'
  | 'command_exec'
  | 'network_request'
  | 'python_exec'
  | 'other'

export interface ApprovalRequest {
  id: string
  platform: IMPlatform
  userId: string
  conversationId: string
  /** Human-readable action description */
  action: string
  /** Detailed info about what will happen */
  details: string
  category: ApprovalActionCategory
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high'
  /** Whether approval has been granted */
  approved: boolean | null
  /** Timestamp when request was sent */
  requestedAt: number
  /** Timestamp when user responded (if any) */
  respondedAt?: number
  /** Timeout in ms — if no response, auto-deny */
  timeoutMs: number
}

// ---------- Assistant execution state ----------
export interface AssistantState {
  /** Single session — all remote commands funnel here */
  sessionId: string
  /** Fixed workspace directory for remote assistant */
  workspacePath: string
  /** Full conversation history — never cleared */
  messages: AssistantMessage[]
  /** Connected platforms */
  activePlatforms: IMPlatform[]
  /** Platform connection statuses */
  platformStatus: Record<IMPlatform, IMConnectionStatus>
  /** Whether the assistant is currently processing */
  isProcessing: boolean
  /** Current executing request ID */
  currentRequestId?: string
}

export interface AssistantMessage {
  id: string
  timestamp: number
  platform: IMPlatform
  role: 'user' | 'assistant'
  content: string
  artifacts?: AssistantArtifact[]
  /** Whether this message came from mobile IM */
  fromMobile: boolean
  /** The IM user who sent the command */
  senderName?: string
  /** The raw IM message reference */
  sourceMessageId?: string
}

export interface AssistantArtifact {
  name: string
  path: string
  mimeType: string
  size: number
  /** Generated by which step */
  stepDescription: string
}

// ---------- Execution constraints ----------
export interface AssistantConstraints {
  /** Fixed workspace directory for the assistant */
  workspacePath: string
  /** Single session mode — no parallel sessions */
  singleSession: true
  /** History is never clearable */
  historyImmutable: true
  /** Cross-device continuation: tasks started on mobile can be picked up on desktop */
  crossDeviceContinue: true
}

/** Default assistant workspace under user data */
export const ASSISTANT_WORKSPACE_NAME = 'BspBuddyAssistant'

// ---------- IPC channels for IM integration ----------
export const IM_IPC_CHANNELS = {
  IM_CONNECT: 'im:connect',
  IM_DISCONNECT: 'im:disconnect',
  IM_STATUS: 'im:status',
  IM_APPROVE: 'im:approve',
  IM_MESSAGE: 'im:message',
  IM_SEND_MESSAGE: 'im:send-message',
  IM_GET_QRCODE: 'im:get-qrcode',
  IM_UNBIND: 'im:unbind',
  IM_EXECUTE_REMOTE: 'im:execute-remote',
  IM_HISTORY: 'im:history',
  IM_CURRENT_REQUEST: 'im:current-request',
  ASSISTANT_GET_STATE: 'assistant:get-state',
  ASSISTANT_SET_WORKSPACE: 'assistant:set-workspace',
  ASSISTANT_PENDING_APPROVAL: 'assistant:pending-approval',
} as const

// ---------- IM Adaptor interface ----------
export interface IMAdaptor {
  platform: IMPlatform
  connect(config: PlatformConfig): Promise<void>
  disconnect(): Promise<void>
  /** Get current connection status */
  getStatus(): IMConnectionStatus
  /** Register message handler */
  onMessage(handler: (msg: IMessage) => void): void
  /** Remove message handler */
  offMessage(handler: (msg: IMessage) => void): void
  /** Send approval request to phone IM */
  sendApprovalRequest(userId: string, action: string, details: string, category: ApprovalActionCategory): Promise<ApprovalRequest>
  /** Send a message back to the IM platform */
  sendMessage(userId: string, content: string, artifacts?: AssistantArtifact[]): Promise<void>
  /** Send to a group conversation */
  sendGroupMessage?(conversationId: string, content: string, artifacts?: AssistantArtifact[]): Promise<void>
  /** Get QR code data for binding (QR-code based platforms) */
  getQrCode?(): Promise<string>
  /** Check version requirements */
  checkVersion?(): Promise<{ satisfied: boolean; requiredVersion: string; currentVersion?: string }>
  /** Unbind / cleanup */
  unbind(): Promise<void>
}

// ---------- Approval handler type ----------
export type ApprovalHandler = (request: ApprovalRequest) => Promise<boolean>

// ---------- IM event types (renderer-bound) ----------
export type IMEvent =
  | { type: 'status-changed'; platform: IMPlatform; status: IMConnectionStatus }
  | { type: 'message-received'; message: AssistantMessage }
  | { type: 'approval-requested'; request: ApprovalRequest }
  | { type: 'approval-resolved'; requestId: string; approved: boolean }
  | { type: 'execution-started'; requestId: string }
  | { type: 'execution-completed'; requestId: string; result: string }
  | { type: 'execution-failed'; requestId: string; error: string }
  | { type: 'qrcode-updated'; platform: IMPlatform; qrcodeData: string }
