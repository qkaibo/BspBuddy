import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import { IPC_CHANNELS } from '../../lib/types'
import type { AgentMode, PermissionAction, PermissionMode } from '../../lib/types'
import type { Expert } from '../../lib/expert-types'
import { officeAgent } from './agent'
import { orchestrator } from './orchestrator'
import { toolRegistry } from './tools/registry'
import { registerFileTools } from './tools/file'
import { registerSearchTools } from './tools/search'
import { registerDocumentTools } from './tools/document'
import { registerOfficeTools } from './tools/office'
import { pythonBridge } from '../python-bridge'
import { skillService } from './skill-service'
import { pluginService } from './plugin-service'
import { expertService } from './expert-service'
import { mcpService } from './mcp-service'
import { imBridge } from './im-bridge'
import { assistantExecutor } from './assistant-executor'
import { inspirationService } from './inspiration-service'
import { projectService } from './project-service'
import { schedulerService } from './scheduler'
import { memoryService } from './memory-service'
import { permissionService } from './permission-service'
import { connectorService } from './connector-service'
import { creditsService } from './credits'
import { dataService } from './data-service'
import { settingsService } from './settings-service'
import { updateService } from './update-service'
import { ardotService } from './ardot-service'
import { agentMailService } from './agent-mail'
import { cloudAgentService } from './cloud-agent-service'
import type { IMPlatform, PlatformConfig } from '../../lib/im-types'
import type { ProjectCreateInput, ProjectTaskCreateInput, TaskAttachment, AssetType } from '../../lib/project-types'
import type { AutomationConfig } from '../../lib/automation-types'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'

export function registerIpcHandlers(): void {
  registerFileTools()
  registerSearchTools()
  registerDocumentTools()
  registerOfficeTools()

  orchestrator.onProgress((event) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send(IPC_CHANNELS.TASK_PROGRESS, {
        planId: event.planId, stepId: event.stepId,
        status: event.status, result: event.result, error: event.error,
      })
    }
  })

  // Core: Execute a task with mode support
  ipcMain.handle(IPC_CHANNELS.EXECUTE_TASK, async (_event, userInput: string, mode: AgentMode, context?: {
    currentFile?: string; openFiles?: string[]
  }) => {
    try {
      const aiResponse = await officeAgent.plan(userInput, mode)

      if (aiResponse.type === 'chat') {
        return { content: aiResponse.content, plan: null, artifacts: [] }
      }
      if (!aiResponse.steps || aiResponse.steps.length === 0) {
        return { content: '无法识别可执行的任务步骤。', plan: null, artifacts: [] }
      }

      // Plan mode: return plan, wait for user confirmation
      if (mode === 'plan') {
        const plan = orchestrator.createPlan(aiResponse.summary || userInput, aiResponse.steps)
        return {
          content: `## 📋 任务计划\n\n**目标**: ${aiResponse.summary}\n\n${(aiResponse.steps || []).map((s, i) => `${i + 1}. ${s.description}`).join('\n')}\n\n请确认后切换到 Craft 模式执行。`,
          plan,
          artifacts: [],
          awaitingConfirm: true,
        }
      }

      // Craft mode: execute immediately
      const completedPlan = await officeAgent.executePlan(aiResponse.summary || userInput, aiResponse.steps)

      const artifacts = completedPlan.steps
        .filter((s) => s.result?.artifacts)
        .flatMap((s) => s.result!.artifacts!)

      const doneCount = completedPlan.steps.filter((s) => s.status === 'completed').length
      const totalCount = completedPlan.steps.length

      const stepResults = completedPlan.steps
        .filter((s) => s.status === 'completed')
        .map((s) => ({
          step: s.description,
          result: typeof s.result?.data === 'object' ? s.result.data : s.result,
        }))

      let content: string
      if (completedPlan.status === 'completed') {
        const parts: string[] = []
        if (artifacts.length > 0) parts.push(`${artifacts.length} 个产物`)
        content = `## ✅ 任务完成 (${doneCount}/${totalCount} 步骤)\n\n${artifacts.map(a => `- 📄 **${a.name}** → \`${a.path}\``).join('\n')}`
      } else {
        const failed = completedPlan.steps.filter((s) => s.status === 'failed')
        content = `## ❌ 任务失败 — ${failed.map((s) => `步骤 ${s.index}: ${s.error}`).join('; ')}`
      }

      return { content, plan: completedPlan, artifacts, stepResults }
    } catch (err) {
      return {
        content: null, error: err instanceof Error ? err.message : String(err),
        plan: null, artifacts: [],
      }
    }
  })

  // Stop agent execution
  ipcMain.handle(IPC_CHANNELS.AGENT_STOP, async () => {
    officeAgent.stop()
    return { success: true }
  })

  // Cancel execution (alias for stop)
  ipcMain.handle(IPC_CHANNELS.AGENT_CANCEL, async () => {
    officeAgent.stop()
    return { success: true }
  })

  // File dialog
  ipcMain.handle(IPC_CHANNELS.FILE_DIALOG, async (_event, options: { type: 'open' | 'save' }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return null
    if (options.type === 'open') {
      const result = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] })
      return result.canceled ? null : result.filePaths
    }
    const result = await dialog.showSaveDialog(win, {})
    return result.canceled ? null : result.filePath
  })

  // File operations
  ipcMain.handle(IPC_CHANNELS.READ_FILE, async (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`)
    return fs.readFileSync(filePath, 'utf-8')
  })
  ipcMain.handle(IPC_CHANNELS.WRITE_FILE, async (_event, filePath: string, content: string) => {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    // On Windows, backup existing file before overwriting
    if (process.platform === 'win32' && fs.existsSync(filePath)) {
      await permissionService.backupFile(filePath)
    }
    fs.writeFileSync(filePath, content, 'utf-8')
    return { filePath, size: Buffer.byteLength(content) }
  })
  ipcMain.handle(IPC_CHANNELS.LIST_DIR, async (_event, dirPath: string) => {
    if (!fs.existsSync(dirPath)) throw new Error(`Directory not found: ${dirPath}`)
    return fs.readdirSync(dirPath, { withFileTypes: true }).map((e) => ({
      name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile(),
    }))
  })

  // Delete file or directory (default: safe delete with recycle bin on Windows)
  ipcMain.handle(IPC_CHANNELS.DELETE_FILE, async (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) return { success: true }
    // Check if this is a protected path needing permission
    if (permissionService.getMode() === 'default') {
      const isProtected = permissionService.isProtected(filePath)
      if (isProtected) {
        const permResp = await permissionService.check({
          type: 'file_delete',
          target: filePath,
          reason: '删除受保护文件或目录',
          scope: 'protected',
        })
        if (permResp.action === 'deny') {
          return { success: false, error: '删除操作已被用户拒绝（权限确认未通过）' }
        }
      }
    }
    // Use safe delete when possible
    return permissionService.safeDelete(filePath)
  })

  // Rename file or directory
  ipcMain.handle(IPC_CHANNELS.RENAME_FILE, async (_event, oldPath: string, newPath: string) => {
    if (!fs.existsSync(oldPath)) throw new Error(`Source not found: ${oldPath}`)
    const dir = path.dirname(newPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.renameSync(oldPath, newPath)
    return { success: true }
  })

  // Terminal support with permission check
  ipcMain.handle(IPC_CHANNELS.EXEC_COMMAND, async (_event, command: string, cwd: string) => {
    // In default mode, sanitize the command
    const sanitized = permissionService.getMode() === 'default'
      ? permissionService.sanitizeCommand(command)
      : command

    return new Promise((resolve) => {
      const proc = exec(sanitized, { cwd, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
        resolve({ stdout, stderr, error: err?.message || null })
      })
    })
  })

  // Workspace path
  ipcMain.handle('app:cwd', async () => {
    return process.cwd()
  })

  // Python bridge
  ipcMain.handle(IPC_CHANNELS.PYTHON_STATUS, async () => {
    const available = await pythonBridge.detect()
    return { available }
  })

  ipcMain.handle(IPC_CHANNELS.PYTHON_EXEC, async (_event, code: string, params: Record<string, unknown>) => {
    return pythonBridge.exec(code, params)
  })

  // Session persistence
  const getSessionDir = () => path.join(app.getPath('userData'), 'sessions')

  ipcMain.handle(IPC_CHANNELS.SESSION_SAVE, async (_event, session: any) => {
    const dir = getSessionDir()
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, `${session.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8')
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_LOAD, async (_event, id: string) => {
    const filePath = path.join(getSessionDir(), `${id}.json`)
    if (!fs.existsSync(filePath)) return null
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, async () => {
    const dir = getSessionDir()
    if (!fs.existsSync(dir)) return []
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    return files.map((f) => {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8')
      const session = JSON.parse(content)
      return { id: session.id, title: session.title, date: session.date, workspace: session.workspace }
    })
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async (_event, id: string) => {
    const filePath = path.join(getSessionDir(), `${id}.json`)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    return { success: true }
  })

  // ============= Plugin Ecosystem IPC Handlers =============

  // ---- Skills ----
  ipcMain.handle(IPC_CHANNELS.SKILL_LIST, async () => {
    return skillService.list()
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_SEARCH, async (_event, query: string) => {
    return skillService.search(query)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_INSTALL, async (_event, skillId: string) => {
    return skillService.install(skillId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_UNINSTALL, async (_event, skillId: string) => {
    return skillService.uninstall(skillId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_TOGGLE, async (_event, skillId: string, enabled: boolean) => {
    return skillService.toggle(skillId, enabled)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_BATCH_UNINSTALL, async (_event, skillIds: string[]) => {
    return skillService.batchUninstall(skillIds)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_CREATE, async (_event, description: string) => {
    return skillService.create(description)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_UPLOAD, async (_event, filePath: string) => {
    return skillService.uploadPackage(filePath)
  })

  // ---- MCP ----
  ipcMain.handle(IPC_CHANNELS.MCP_LIST, async (_event, projectPath?: string) => {
    return mcpService.list(projectPath)
  })

  ipcMain.handle(IPC_CHANNELS.MCP_CONNECT, async (_event, config: any, level: 'user' | 'project', projectPath?: string) => {
    return mcpService.connect(config, level, projectPath)
  })

  ipcMain.handle(IPC_CHANNELS.MCP_DISCONNECT, async (_event, serverName: string) => {
    return mcpService.disconnect(serverName)
  })

  ipcMain.handle(IPC_CHANNELS.MCP_CONFIGURE, async (_event, rawConfig: string, level: 'user' | 'project', projectPath?: string) => {
    return mcpService.configure(rawConfig, level, projectPath)
  })

  ipcMain.handle(IPC_CHANNELS.MCP_MARKET_LIST, async () => {
    return mcpService.getMarket()
  })

  // ---- Expert ----
  ipcMain.handle(IPC_CHANNELS.EXPERT_LIST, async () => {
    return expertService.list()
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_TEAM_LIST, async () => {
    return expertService.listTeams()
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_SUMMON, async (_event, expertId: string) => {
    return expertService.summon(expertId)
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_TEAM_EXECUTE, async (_event, teamId: string, task: string) => {
    return expertService.startTeamExecution(teamId, task)
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_CREATE, async (_event, req: any) => {
    return expertService.create(req)
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_UPDATE, async (_event, expert: Expert) => {
    return expertService.update(expert)
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_DELETE, async (_event, id: string) => {
    return expertService.delete(id)
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_TOGGLE_STATUS, async (_event, id: string, status: any) => {
    return expertService.toggleStatus(id, status)
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_TOGGLE_OVERALL, async (_event, id: string, isOverall: boolean) => {
    return expertService.toggleOverall(id, isOverall)
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_SQUARE_LIST, async () => {
    return expertService.squareList()
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_CLONE, async (_event, sourceId: string) => {
    return expertService.clone(sourceId)
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_TEST_RUN, async (_event, params: any) => {
    return expertService.testRun(params)
  })

  // ---- Plugin ----
  ipcMain.handle(IPC_CHANNELS.PLUGIN_LIST, async () => {
    return pluginService.list()
  })

  ipcMain.handle(IPC_CHANNELS.PLUGIN_INSTALL, async (_event, pluginId: string) => {
    return pluginService.install(pluginId)
  })

  ipcMain.handle(IPC_CHANNELS.PLUGIN_UNINSTALL, async (_event, pluginId: string) => {
    return pluginService.uninstall(pluginId)
  })

  ipcMain.handle(IPC_CHANNELS.PLUGIN_MARKET_ADD, async (_event, url: string, name?: string) => {
    return pluginService.addMarket(url, name)
  })

  ipcMain.handle(IPC_CHANNELS.PLUGIN_MARKET_LIST, async () => {
    return pluginService.listMarkets()
  })

  ipcMain.handle(IPC_CHANNELS.PLUGIN_MARKET_REMOVE, async (_event, marketId: string) => {
    return pluginService.removeMarket(marketId)
  })

  // ---- Slash Commands ----
  ipcMain.handle(IPC_CHANNELS.SLASH_COMMAND_LIST, async () => {
    return [
      { name: '/周报', description: '根据本周工作自动生成周报', template: '帮我生成本周的周报，本周工作内容如下：\n{content}' },
      { name: '/日报', description: '根据今日工作生成日报', template: '帮我生成本日的日报，今日工作内容如下：\n{content}' },
      { name: '/翻译', description: '翻译选中文本为中文', template: '请将以下内容翻译为中文：\n{content}' },
      { name: '/总结', description: '总结选中的内容', template: '请总结以下内容：\n{content}' },
      { name: '/润色', description: '润色选中的文本', template: '请润色以下文本，使其更专业流畅：\n{content}' },
    ]
  })

  ipcMain.handle(IPC_CHANNELS.SLASH_COMMAND_EXECUTE, async (_event, command: string, content: string) => {
    const commands: Record<string, string> = {
      '/周报': `请根据以下工作内容生成本周的周报。要求：格式规范，包含本周完成、下周计划、风险与问题三部分。\n\n本周工作：\n${content}`,
      '/日报': `请根据以下工作内容生成本日的日报。要求：简洁明了，突出重点成果。\n\n今日工作：\n${content}`,
      '/翻译': `请将以下内容翻译为中文：\n${content}`,
      '/总结': `请总结以下内容，提取关键要点：\n${content}`,
      '/润色': `请润色以下文本，使其更专业流畅，保持原意不变：\n${content}`,
    }
    const prompt = commands[command]
    if (!prompt) return { success: false, error: `未知命令: ${command}` }
    return { success: true, prompt }
  })

  // ============= IM Remote Assistant IPC Handlers =============

  // Forward IM events to renderer
  imBridge.on('imevent', (event) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send(IPC_CHANNELS.IM_MESSAGE, event)
    }
  })

  ipcMain.handle(IPC_CHANNELS.IM_CONNECT, async (_event, platform: IMPlatform, config: PlatformConfig) => {
    try {
      await imBridge.connect(platform, config)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.IM_DISCONNECT, async (_event, platform: IMPlatform) => {
    try {
      await imBridge.disconnect(platform)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.IM_STATUS, async (_event, platform?: IMPlatform) => {
    if (platform) {
      return { status: imBridge.getStatus(platform) }
    }
    return { platforms: imBridge.getAllStatus() }
  })

  ipcMain.handle(IPC_CHANNELS.IM_APPROVE, async (_event, requestId: string, approved: boolean) => {
    const resolved = imBridge.resolveApproval(requestId, approved)
    return { success: resolved }
  })

  ipcMain.handle(IPC_CHANNELS.IM_SEND_MESSAGE, async (_event, platform: IMPlatform, userId: string, content: string, artifacts?: unknown[]) => {
    try {
      await imBridge.sendMessage(platform, userId, content, artifacts as any)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.IM_GET_QRCODE, async (_event, platform: IMPlatform) => {
    try {
      const qrcode = await imBridge.getQrCode(platform)
      return { success: true, qrcode }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.IM_UNBIND, async (_event, platform: IMPlatform) => {
    try {
      await imBridge.unbind(platform)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.IM_EXECUTE_REMOTE, async (_event, platform: IMPlatform, userId: string, input: string) => {
    try {
      const result = await assistantExecutor.executeRemoteCommand(platform, userId, input)
      // Send result back to IM
      await imBridge.sendMessage(platform, userId, result.content, result.artifacts)
      return { success: true, ...result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.IM_HISTORY, async (_event, opts?: { platform?: IMPlatform; since?: number; until?: number }) => {
    if (opts) {
      return assistantExecutor.searchHistory(opts)
    }
    return assistantExecutor.getHistory()
  })

  ipcMain.handle(IPC_CHANNELS.IM_CURRENT_REQUEST, async () => {
    const state = assistantExecutor.getState()
    return {
      isProcessing: state.isProcessing,
      currentRequestId: state.currentRequestId,
    }
  })

  ipcMain.handle(IPC_CHANNELS.ASSISTANT_GET_STATE, async () => {
    const state = assistantExecutor.getState()
    const constraints = assistantExecutor.getConstraints()
    return { ...state, constraints }
  })

  ipcMain.handle(IPC_CHANNELS.ASSISTANT_SET_WORKSPACE, async (_event, _workspacePath: string) => {
    // Workspace is FIXED and cannot be changed — this is enforced by design
    return { success: false, error: '助理工作目录不可更改，已固定使用专属文件夹' }
  })

  ipcMain.handle(IPC_CHANNELS.ASSISTANT_PENDING_APPROVAL, async () => {
    return imBridge.getPendingApprovals()
  })

  // ============= Inspiration (灵感) IPC Handlers =============
  ipcMain.handle(IPC_CHANNELS.INSPIRATION_LIST, async (_event, opts?: { category?: string; search?: string; featured?: boolean }) => {
    return inspirationService.list(opts as any)
  })

  ipcMain.handle(IPC_CHANNELS.INSPIRATION_DETAIL, async (_event, caseId: string) => {
    return inspirationService.getDetail(caseId)
  })

  ipcMain.handle(IPC_CHANNELS.INSPIRATION_FAVORITE, async (_event, caseId: string) => {
    return inspirationService.toggleFavorite(caseId)
  })

  ipcMain.handle(IPC_CHANNELS.INSPIRATION_FORK, async (_event, caseId: string) => {
    return inspirationService.fork(caseId)
  })

  ipcMain.handle(IPC_CHANNELS.INSPIRATION_FAVORITES_LIST, async () => {
    return inspirationService.getFavorites()
  })

  // ============= Automation / Scheduler IPC Handlers =============

  // Initialize scheduler on first access
  schedulerService.init()

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_LIST, async () => {
    return schedulerService.list()
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_GET, async (_event, taskId: string) => {
    return schedulerService.get(taskId) || null
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_CREATE, async (_event, config: AutomationConfig) => {
    const errors = schedulerService.validateConfig(config)
    if (errors.length > 0) {
      return { success: false, errors }
    }
    const task = schedulerService.create(config)
    return { success: true, task }
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_UPDATE, async (_event, taskId: string, updates: Partial<AutomationConfig>) => {
    // Validate if schedule is being updated
    if (updates.schedule || updates.name || updates.prompt || updates.modelId) {
      const existing = schedulerService.get(taskId)
      if (existing) {
        const mergedConfig: AutomationConfig = {
          name: updates.name ?? existing.name,
          prompt: updates.prompt ?? existing.prompt,
          modelId: updates.modelId ?? existing.modelId,
          skillIds: updates.skillIds ?? existing.skillIds,
          schedule: updates.schedule ? {
            frequency: updates.schedule.frequency,
            cron: updates.schedule.cron,
            startDate: updates.schedule.startDate,
            endDate: updates.schedule.endDate,
          } : {
            frequency: existing.schedule.frequency,
            startDate: existing.schedule.startDate,
            endDate: existing.schedule.endDate,
          },
          pushToMiniProgram: updates.pushToMiniProgram ?? existing.pushToMiniProgram,
        }
        const errors = schedulerService.validateConfig(mergedConfig)
        if (errors.length > 0) {
          return { success: false, errors }
        }
      }
    }
    const task = schedulerService.update(taskId, updates)
    if (!task) return { success: false, error: '任务不存在' }
    return { success: true, task }
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_DELETE, async (_event, taskId: string) => {
    const result = schedulerService.delete(taskId)
    return { success: result }
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_TRIGGER, async (_event, taskId: string) => {
    const log = await schedulerService.trigger(taskId)
    return { success: log.status === 'success', log }
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_TOGGLE, async (_event, taskId: string, enabled: boolean) => {
    const task = schedulerService.setEnabled(taskId, enabled)
    if (!task) return { success: false, error: '任务不存在' }
    return { success: true, task }
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_LOGS, async (_event, taskId?: string) => {
    return schedulerService.getLogs(taskId)
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_CHECK_SAFETY, async (_event, prompt: string) => {
    return schedulerService.checkSafety(prompt)
  })

  // ============= Memory System IPC Handlers =============
  ipcMain.handle(IPC_CHANNELS.MEMORY_LIST, async () => {
    return memoryService.list()
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_ADD, async (_event, entry: any) => {
    memoryService.addEntry(entry)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_EDIT, async (_event, instruction: string) => {
    return memoryService.editInstruction(instruction)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_DELETE, async (_event, id: string) => {
    const deleted = memoryService.deleteEntry(id)
    return { success: deleted }
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_CLEAR, async () => {
    memoryService.clearAll()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_IMPORT, async (_event, content: string) => {
    return memoryService.importFromExternal(content)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_TOGGLE, async (_event, enabled: boolean) => {
    memoryService.setEnabled(enabled)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_STATUS, async () => {
    return { enabled: memoryService.isEnabled() }
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_SEARCH_HISTORY, async (_event, query: string) => {
    return memoryService.searchSessionHistory(query)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_IMPORT_PROMPT, async () => {
    return memoryService.getImportPrompt()
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_GET_CONTEXT, async (_event, query: string) => {
    return memoryService.getContextForQuery(query)
  })

  // ============= Project Collaboration IPC Handlers =============

  ipcMain.handle(IPC_CHANNELS.PROJECT_TEMPLATE_LIST, async () => {
    return projectService.listTemplates()
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    return { success: true, projects: projectService.list() }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, input: ProjectCreateInput, userId: string, userName: string) => {
    try {
      const project = projectService.create(input, userId, userName)
      return { success: true, project }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE, async (_event, id: string, updates: Record<string, unknown>, userId: string, userName: string) => {
    const project = projectService.update(id, updates, userId, userName)
    return project ? { success: true, project } : { success: false, error: '项目不存在' }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (_event, id: string) => {
    const ok = projectService.delete(id)
    return { success: ok }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_MEMBER_ADD, async (_event, projectId: string, userId: string, userName: string, role: 'admin' | 'member') => {
    const project = projectService.addMember(projectId, userId, userName, role)
    return project ? { success: true, project } : { success: false, error: '项目不存在' }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_MEMBER_REMOVE, async (_event, projectId: string, userId: string, operatorId: string, operatorName: string) => {
    const project = projectService.removeMember(projectId, userId, operatorId, operatorName)
    return project ? { success: true, project } : { success: false, error: '项目不存在或该成员不在项目中' }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_INVITE_GENERATE, async (_event, projectId: string, createdBy: string, projectName: string) => {
    const invite = projectService.generateInvite(projectId, createdBy, projectName)
    return { success: true, invite }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_INVITE_ACCEPT, async (_event, code: string, userId: string, userName: string, note?: string) => {
    return projectService.acceptInvite(code, userId, userName, note)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_MEMBER_APPROVE, async (_event, _projectId: string, _userId: string, _approved: boolean) => {
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_ASSET_LIST, async (_event, projectId: string) => {
    const assets = projectService.listAssets(projectId)
    return assets !== null ? { success: true, assets } : { success: false, error: '项目不存在' }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_ASSET_UPLOAD, async (_event, projectId: string, name: string, type: AssetType, url: string, size: number, uploaderId: string, uploaderName: string, mimeType?: string) => {
    const asset = projectService.uploadAsset(projectId, name, type, url, size, uploaderId, uploaderName, mimeType)
    return asset ? { success: true, asset } : { success: false, error: '项目不存在或存储空间不足' }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_ASSET_DELETE, async (_event, projectId: string, assetId: string) => {
    const ok = projectService.deleteAsset(projectId, assetId)
    return { success: ok }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_TASK_LIST, async (_event, projectId: string) => {
    return { success: true, tasks: projectService.listTasks(projectId) }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_TASK_CREATE, async (_event, input: ProjectTaskCreateInput, userId: string, userName: string) => {
    const task = projectService.createTask(input, userId, userName)
    const context = projectService.buildTaskContext(input.projectId, userId)
    return { success: true, task, injectedContext: context }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_TASK_UPDATE, async (_event, taskId: string, projectId: string, updates: Record<string, unknown>) => {
    const task = projectService.updateTask(taskId, projectId, updates)
    return task ? { success: true, task } : { success: false, error: '任务不存在' }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_TASK_SHARE, async (_event, taskId: string, projectId: string, userId: string, userName: string) => {
    return projectService.shareTask(taskId, projectId, userId, userName)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_TASK_TRANSFER, async (_event, taskId: string, projectId: string, toUserId: string, fromUserId: string, fromUserName: string, note?: string, attachments?: TaskAttachment[]) => {
    return projectService.transferTask(taskId, projectId, toUserId, fromUserId, fromUserName, note, attachments)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_ACTIVITY_LIST, async (_event, projectId: string, currentUserId?: string) => {
    return { success: true, activities: projectService.listActivities(projectId, currentUserId) }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_AUTH_SAVE_PERSONAL, async (_event, connectorId: string, projectId: string, userId: string, token: string) => {
    try {
      const authToken = projectService.savePersonalAuthToken(connectorId, projectId, userId, token)
      return { success: true, token: authToken }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_AUTH_GET_PUBLIC, async (_event, projectId: string, connectorId: string) => {
    const credentials = projectService.getPublicAuthCredentials(projectId, connectorId)
    return credentials !== null ? { success: true, credentials } : { success: false, error: '未找到公共授权配置' }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_AUTOMATION_CREATE, async (_event, projectId: string, name: string, schedule: string, action: string, createdBy: string) => {
    const automation = projectService.createAutomation(projectId, name, schedule, action, createdBy)
    return { success: true, automation }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_AUTOMATION_LIST, async (_event, projectId: string, userId?: string) => {
    return { success: true, automations: projectService.listAutomations(projectId, userId) }
  })

  // ============= Permission IPC Handlers =============

  ipcMain.handle(IPC_CHANNELS.PERMISSION_CHECK, async (_event, request: { type: string; target: string; reason: string }) => {
    const permType = request.type as any
    return permissionService.check({
      type: permType,
      target: request.target,
      reason: request.reason,
      scope: 'workspace',
    })
  })

  ipcMain.handle(IPC_CHANNELS.PERMISSION_MODE_CHANGE, async (_event, mode: PermissionMode) => {
    permissionService.setMode(mode)
    return { success: true, mode }
  })

  ipcMain.handle(IPC_CHANNELS.PERMISSION_RESPONSE, async (_event, requestId: string, action: PermissionAction) => {
    permissionService.handleResponse(requestId, action)
    return { success: true }
  })

  // ============= Connector Ecosystem IPC Handlers =============

  ipcMain.handle(IPC_CHANNELS.CONNECTOR_LIST, async () => {
    return connectorService.list()
  })

  ipcMain.handle(IPC_CHANNELS.CONNECTOR_CONNECT, async (_event, req: { defId: string; provider: string; config?: Record<string, string>; mcpConfig?: any }) => {
    if (req.provider === 'qqmail' && req.config?.action === 'confirm') {
      return connectorService.confirmQQMailConnect()
    }
    if (['tencent-docs', 'tencent-lexiang', 'tencent-meeting', 'tencent-pan'].includes(req.provider) && req.config?.action === 'callback') {
      return connectorService.handleOAuthCallback(req.provider as any, req.config.code)
    }
    return connectorService.connect(req as any)
  })

  ipcMain.handle(IPC_CHANNELS.CONNECTOR_DISCONNECT, async (_event, defId: string) => {
    return connectorService.disconnect(defId)
  })

  ipcMain.handle(IPC_CHANNELS.CONNECTOR_STATUS, async (_event, defId: string) => {
    return connectorService.getStatus(defId)
  })

  // ============= Credits & Pricing IPC Handlers =============

  ipcMain.handle(IPC_CHANNELS.CREDITS_BALANCE, async () => {
    return creditsService.getBalance()
  })

  ipcMain.handle(IPC_CHANNELS.CREDITS_CONSUME, async (_event, amount: number) => {
    return creditsService.consume(amount)
  })

  ipcMain.handle(IPC_CHANNELS.CREDITS_RESET, async () => {
    return creditsService.getBalance()
  })

  ipcMain.handle(IPC_CHANNELS.CREDITS_PLAN_INFO, async () => {
    return creditsService.getPlanInfo()
  })

  ipcMain.handle(IPC_CHANNELS.CREDITS_TOPUP, async (_event, pack: { credits: number; price: number; validityDays: number }) => {
    return creditsService.topup(pack)
  })

  // ============= Data Management IPC Handlers =============

  ipcMain.handle(IPC_CHANNELS.DATA_SHARED_FILES, async () => {
    return dataService.getSharedFiles()
  })

  ipcMain.handle(IPC_CHANNELS.DATA_ARCHIVED_TASKS, async () => {
    return dataService.getArchivedTasks()
  })

  ipcMain.handle(IPC_CHANNELS.DATA_UNSHARE_FILE, async (_event, fileId: string) => {
    return { success: dataService.unshareFile(fileId) }
  })

  ipcMain.handle(IPC_CHANNELS.DATA_DELETE_ARCHIVED_TASK, async (_event, taskId: string) => {
    return { success: dataService.deleteArchivedTask(taskId) }
  })

  ipcMain.handle(IPC_CHANNELS.DATA_UNARCHIVE_TASK, async (_event, taskId: string) => {
    const task = dataService.unarchiveTask(taskId)
    return { success: task !== null, task }
  })

  // ============= Settings IPC Handlers =============

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, async () => {
    return settingsService.getAll()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_event, key: string) => {
    return settingsService.get(key as keyof import('../../lib/types').AppSettings)
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, key: string, value: unknown) => {
    settingsService.set(key as keyof import('../../lib/types').AppSettings, value as never)
    return { success: true }
  })

  // ============= Update IPC Handlers =============

  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    return updateService.checkForUpdates()
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
    return updateService.downloadUpdate()
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, async () => {
    updateService.installUpdate()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_STATUS, async () => {
    return updateService.getStatus()
  })

  // ============= Design / Ardot IPC Handlers (腾讯内部产品) =============

  ipcMain.handle(IPC_CHANNELS.DESIGN_CONNECT, async (_event, actionOrPhone: string) => {
    if (actionOrPhone === 'status') {
      return ardotService.getStatus()
    }
    return ardotService.connect(actionOrPhone)
  })

  ipcMain.handle(IPC_CHANNELS.DESIGN_GENERATE, async (_event, params: { description: string; type: string }) => {
    return ardotService.generate(params as any)
  })

  ipcMain.handle(IPC_CHANNELS.DESIGN_EDIT, async (_event, params: { elementId?: string; instruction: string }) => {
    return ardotService.edit(params)
  })

  ipcMain.handle(IPC_CHANNELS.DESIGN_EXPORT, async (_event, params: { format: string }) => {
    return ardotService.exportCode(params.format as any)
  })

  ipcMain.handle(IPC_CHANNELS.DESIGN_SYNC, async () => {
    return ardotService.sync()
  })

  // ============= Agent Mailbox IPC Handlers (腾讯内部 Agent Mail 服务) =============

  agentMailService.onNotification((notification) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('mail:notification', notification)
    }
  })

  ipcMain.handle(IPC_CHANNELS.MAILBOX_STATUS, async () => {
    return agentMailService.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.MAILBOX_ACTIVATE, async (_event, action: string, ...args: any[]) => {
    if (action === 'agree') return agentMailService.acceptAgreement()
    if (action === 'send-code') return agentMailService.sendSmsCode(args[0] as string)
    if (action === 'verify') return agentMailService.verifySmsCode(args[0] as string)
    if (action === 'start') return agentMailService.startActivation()
    return { success: false, error: 'Unknown activation action' }
  })

  ipcMain.handle(IPC_CHANNELS.MAIL_FETCH, async (_event, folder: string, page?: number) => {
    return agentMailService.fetchMails(folder as any, page)
  })

  ipcMain.handle(IPC_CHANNELS.MAIL_DETAIL, async (_event, mailId: string) => {
    return agentMailService.getMailDetail(mailId)
  })

  ipcMain.handle(IPC_CHANNELS.MAIL_DRAFT, async (_event, params: { type: string; mailId?: string; to?: string; subject?: string; body: string }) => {
    if (params.type === 'reply' && params.mailId) {
      return agentMailService.draftReply(params.mailId, params.body)
    }
    if (params.type === 'forward' && params.mailId && params.to) {
      return agentMailService.draftForward(params.mailId, params.to, params.body)
    }
    if (params.type === 'new' && params.to && params.subject) {
      return agentMailService.draftNewMail(params.to, params.subject, params.body)
    }
    throw new Error('Invalid draft params')
  })

  ipcMain.handle(IPC_CHANNELS.MAIL_CONFIRM_SEND, async (_event, actionId: string) => {
    return agentMailService.confirmSend(actionId)
  })

  ipcMain.handle('mail:cancel-send', async (_event, actionId: string) => {
    return agentMailService.cancelSend(actionId)
  })

  ipcMain.handle('mail:delete', async (_event, mailId: string) => {
    return agentMailService.deleteMail(mailId)
  })

  ipcMain.handle('mail:toggle-read', async (_event, mailId: string, read: boolean) => {
    return agentMailService.toggleRead(mailId, read)
  })

  ipcMain.handle('mail:search', async (_event, query: string) => {
    return agentMailService.searchMails(query)
  })

  ipcMain.handle(IPC_CHANNELS.MAIL_CONTEXT, async (_event, mailId: string) => {
    return agentMailService.injectIntoContext(mailId)
  })

  ipcMain.handle('mail:activate', async () => {
    return agentMailService.startActivation()
  })

  // ============= Cloud Agent IPC Handlers (企业后台) =============

  ipcMain.handle(IPC_CHANNELS.CLOUD_AGENT_LIST, async () => {
    return cloudAgentService.list()
  })

  ipcMain.handle(IPC_CHANNELS.CLOUD_AGENT_CREATE, async (_event, params: any) => {
    return cloudAgentService.create(params)
  })

  ipcMain.handle(IPC_CHANNELS.CLOUD_AGENT_START, async (_event, agentId: string) => {
    return cloudAgentService.start(agentId)
  })

  ipcMain.handle(IPC_CHANNELS.CLOUD_AGENT_STOP, async (_event, agentId: string) => {
    return cloudAgentService.stop(agentId)
  })

  ipcMain.handle(IPC_CHANNELS.CLOUD_AGENT_DELETE, async (_event, agentId: string) => {
    return cloudAgentService.delete(agentId)
  })

  ipcMain.handle('cloud-agent:clone', async (_event, agentId: string) => {
    return cloudAgentService.clone(agentId)
  })

  ipcMain.handle('cloud-agent:runtime', async (_event, agentId: string) => {
    return cloudAgentService.getRuntime(agentId)
  })

  ipcMain.handle(IPC_CHANNELS.CLOUD_AGENT_VERSION, async (_event, agentId: string) => {
    return cloudAgentService.getVersions(agentId)
  })

  ipcMain.handle(IPC_CHANNELS.CLOUD_AGENT_DEPLOY, async (_event, agentId: string) => {
    return cloudAgentService.deploy(agentId)
  })

  ipcMain.handle(IPC_CHANNELS.CLOUD_AGENT_EVALUATE, async (_event, action: string, agentId: string, datasetId?: string, datasetName?: string) => {
    if (action === 'list') return cloudAgentService.getEvaluations(agentId)
    if (action === 'start') return cloudAgentService.startEvaluation(agentId, datasetId || 'ds-001', datasetName || 'Default')
    return { success: false, error: 'Unknown evaluation action' }
  })

  ipcMain.handle('cloud-agent:channels', async (_event, agentId: string) => {
    return cloudAgentService.listChannels(agentId)
  })

  ipcMain.handle('cloud-agent:channel-add', async (_event, agentId: string, type: string) => {
    return cloudAgentService.addChannel(agentId, type as any)
  })

  ipcMain.handle('cloud-agent:channel-remove', async (_event, channelId: string) => {
    return cloudAgentService.removeChannel(channelId)
  })

  ipcMain.handle('cloud-agent:sessions', async (_event, agentId: string) => {
    return cloudAgentService.listSessions(agentId)
  })

  ipcMain.handle('cloud-agent:session-delete', async (_event, agentId: string, sessionId: string) => {
    return cloudAgentService.deleteSession(agentId, sessionId)
  })
}
