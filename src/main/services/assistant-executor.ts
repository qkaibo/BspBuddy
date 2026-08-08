// ============================================================
// Assistant Executor — enforces execution constraints for remote assistant
// - Fixed workspace directory (not user-specifiable)
// - Single session (all IM commands merged into one)
// - Immutable history (never clearable)
// - Cross-device continuation (mobile → desktop → mobile)
// - Remote approval via phone IM (not local popup)
// ============================================================

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'uuid'

import type {
  IMPlatform,
  AssistantState,
  AssistantMessage,
  AssistantArtifact,
  AssistantConstraints,
  ApprovalActionCategory,
} from '../../lib/im-types'
import { ASSISTANT_WORKSPACE_NAME } from '../../lib/im-types'

import { imBridge } from './im-bridge'
import { officeAgent } from './agent'

/** Sensitive actions that require phone IM approval */
const SENSITIVE_ACTIONS: ApprovalActionCategory[] = [
  'file_delete',
  'system_config',
  'command_exec',
]

const APPROVAL_ACTION_LABELS: Record<ApprovalActionCategory, string> = {
  file_delete: '删除文件',
  file_write: '写入文件',
  system_config: '修改系统配置',
  command_exec: '执行命令',
  network_request: '网络请求',
  python_exec: 'Python 脚本执行',
  other: '其他操作',
}

export class AssistantExecutor {
  private sessionId: string
  private workspacePath: string
  private messages: AssistantMessage[] = []
  private isProcessing = false
  private currentRequestId: string | null = null
  private historyFilePath: string

  constructor() {
    this.sessionId = uuid()

    // Fixed workspace under userData
    const userData = app.getPath('userData')
    this.workspacePath = path.join(userData, ASSISTANT_WORKSPACE_NAME)
    if (!fs.existsSync(this.workspacePath)) {
      fs.mkdirSync(this.workspacePath, { recursive: true })
    }

    // History file — immutable record
    this.historyFilePath = path.join(userData, 'assistant_history.json')

    // Load existing history if present
    this.loadHistory()

    // Wire up IM bridge messages
    imBridge.onAssistantMessage((msg: AssistantMessage) => {
      this.messages.push(msg)
      this.saveHistory()
    })
  }

  // ---- Constraints ----

  getConstraints(): AssistantConstraints {
    return {
      workspacePath: this.workspacePath,
      singleSession: true,
      historyImmutable: true,
      crossDeviceContinue: true,
    }
  }

  /** The fixed workspace — cannot be changed by the user */
  getWorkspace(): string {
    return this.workspacePath
  }

  /** The single session ID — there is only one */
  getSessionId(): string {
    return this.sessionId
  }

  /** Full conversation history — never cleared */
  getHistory(): AssistantMessage[] {
    return [...this.messages]
  }

  /** Search history by date range or platform */
  searchHistory(opts: {
    platform?: IMPlatform
    since?: number
    until?: number
  }): AssistantMessage[] {
    let filtered = this.messages
    if (opts.platform) {
      filtered = filtered.filter((m) => m.platform === opts.platform)
    }
    if (opts.since != null) {
      filtered = filtered.filter((m) => m.timestamp >= opts.since!)
    }
    if (opts.until != null) {
      filtered = filtered.filter((m) => m.timestamp <= opts.until!)
    }
    return filtered
  }

  // ---- State snapshot ----

  getState(): AssistantState {
    const platformStatus: Record<IMPlatform, string> = {} as Record<IMPlatform, string>
    for (const { platform, status } of imBridge.getAllStatus()) {
      platformStatus[platform] = status
    }

    return {
      sessionId: this.sessionId,
      workspacePath: this.workspacePath,
      messages: this.messages,
      activePlatforms: imBridge.getConnectedPlatforms(),
      platformStatus: platformStatus as AssistantState['platformStatus'],
      isProcessing: this.isProcessing,
      currentRequestId: this.currentRequestId ?? undefined,
    }
  }

  // ---- Execute remote command (from IM) ----

  /**
   * Execute a command received from an IM platform.
   * Sensitive operations require phone IM approval (not local popup).
   */
  async executeRemoteCommand(
    platform: IMPlatform,
    userId: string,
    input: string,
  ): Promise<{ content: string; artifacts: AssistantArtifact[] }> {
    if (this.isProcessing) {
      throw new Error('远程助理正忙，请等待当前任务完成')
    }

    this.isProcessing = true
    this.currentRequestId = uuid()

    try {
      const result = await officeAgent.plan(input, 'craft')

      if (result.type === 'chat') {
        this.isProcessing = false
        this.currentRequestId = null
        return { content: result.content ?? '', artifacts: [] }
      }

      if (!result.steps || result.steps.length === 0) {
        this.isProcessing = false
        this.currentRequestId = null
        return { content: '无法识别可执行的任务', artifacts: [] }
      }

      // Check for sensitive steps that need approval
      const sensitiveSteps = result.steps.filter((step) =>
        SENSITIVE_ACTIONS.includes(step.tool as ApprovalActionCategory),
      )

      if (sensitiveSteps.length > 0) {
        const action = sensitiveSteps
          .map((s) => `- ${APPROVAL_ACTION_LABELS[s.tool as ApprovalActionCategory] ?? s.description}`)
          .join('\n')

        const approved = await imBridge.requestApproval(
          platform,
          userId,
          '执行远程任务',
          `即将执行以下操作:\n${action}`,
          'command_exec',
        )

        if (!approved) {
          this.isProcessing = false
          this.currentRequestId = null
          return { content: '⛔ 用户拒绝了远程审批，任务已取消', artifacts: [] }
        }
      }

      // Execute the plan
      const completedPlan = await officeAgent.executePlan(result.summary || input, result.steps)

      const artifacts: AssistantArtifact[] = completedPlan.steps
        .filter((s) => s.result?.artifacts)
        .flatMap((s) =>
          (s.result!.artifacts || []).map((a) => ({
            name: a.name,
            path: a.path,
            mimeType: a.mimeType,
            size: a.size,
            stepDescription: s.description,
          })),
        )

      const doneCount = completedPlan.steps.filter((s) => s.status === 'completed').length
      const totalCount = completedPlan.steps.length

      let content: string
      if (completedPlan.status === 'completed') {
        content = `✅ 任务完成 (${doneCount}/${totalCount} 步骤)\n\n${artifacts.map((a) => `- 📄 ${a.name} → ${a.path}`).join('\n')}`
      } else {
        const failed = completedPlan.steps.filter((s) => s.status === 'failed')
        content = `❌ 任务失败 — ${failed.map((s) => s.error).join('; ')}`
      }

      return { content, artifacts }
    } catch (err) {
      throw err
    } finally {
      this.isProcessing = false
      this.currentRequestId = null
    }
  }

  // ---- Cross-device continuation ----

  /**
   * Pick up an IM-initiated task on the desktop.
   * Returns the full execution context so the desktop UI can display and continue.
   */
  getDesktopContinuation(): {
    sessionId: string
    workspace: string
    history: AssistantMessage[]
    canContinue: boolean
  } {
    return {
      sessionId: this.sessionId,
      workspace: this.workspacePath,
      history: this.messages,
      canContinue: this.messages.length > 0,
    }
  }

  // ---- Workspace management ----

  async ensureWorkspace(): Promise<void> {
    if (!fs.existsSync(this.workspacePath)) {
      fs.mkdirSync(this.workspacePath, { recursive: true })
    }
  }

  /** List files in the assistant workspace */
  listWorkspaceFiles(): string[] {
    if (!fs.existsSync(this.workspacePath)) return []
    return fs.readdirSync(this.workspacePath)
  }

  // ---- History persistence ----

  private saveHistory(): void {
    try {
      const dir = path.dirname(this.historyFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(
        this.historyFilePath,
        JSON.stringify(
          { sessionId: this.sessionId, messages: this.messages, updatedAt: Date.now() },
          null,
          2,
        ),
        'utf-8',
      )
    } catch {
      // Non-fatal: history save can fail without breaking execution
    }
  }

  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.historyFilePath, 'utf-8'))
        this.messages = data.messages || []
        // Session ID persists across restarts — single session is always the same
        if (data.sessionId) {
          this.sessionId = data.sessionId
        }
      }
    } catch {
      // Start fresh if history file is corrupt
    }
  }

  // ---- Shutdown ----

  async shutdown(): Promise<void> {
    this.saveHistory()
  }
}

/** Singleton assistant executor */
export const assistantExecutor = new AssistantExecutor()
