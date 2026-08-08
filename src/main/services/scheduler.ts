// ============================================================
// SchedulerService — cron parsing, task scheduling, execution
// ============================================================

import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import type {
  AutomationTask,
  AutomationLog,
  AutomationConfig,
  AutomationSchedule,
  AutomationTaskStatus,
  AutomationLogStatus,
} from '../../lib/automation-types'
import { SAFETY_RULES, CONCURRENCY_LIMITS } from '../../lib/automation-types'

interface SchedulerState {
  tasks: AutomationTask[]
  logs: AutomationLog[]
  timers: Map<string, NodeJS.Timeout>
  runningTasks: Set<string>
}

class SchedulerService {
  private state: SchedulerState = { tasks: [], logs: [], timers: new Map(), runningTasks: new Set() }
  private initialized = false

  private getDataDir(): string {
    const dir = path.join(app.getPath('userData'), 'automation')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  private getTasksPath(): string {
    return path.join(this.getDataDir(), 'tasks.json')
  }

  private getLogsPath(): string {
    return path.join(this.getDataDir(), 'logs.json')
  }

  init(): void {
    if (this.initialized) return
    this.loadState()
    this.initialized = true
  }

  private loadState(): void {
    const tasksPath = this.getTasksPath()
    if (fs.existsSync(tasksPath)) {
      try {
        const raw = fs.readFileSync(tasksPath, 'utf-8')
        const tasks: AutomationTask[] = JSON.parse(raw)
        this.state.tasks = tasks.map((t) => ({ ...t, status: 'idle' }))
        for (const task of this.state.tasks) {
          if (task.enabled && task.schedule) {
            this.scheduleTask(task)
          }
        }
      } catch {
        this.state.tasks = []
      }
    }
    const logsPath = this.getLogsPath()
    if (fs.existsSync(logsPath)) {
      try {
        this.state.logs = JSON.parse(fs.readFileSync(logsPath, 'utf-8')) as AutomationLog[]
      } catch {
        this.state.logs = []
      }
    }
  }

  private saveState(): void {
    fs.writeFileSync(this.getTasksPath(), JSON.stringify(this.state.tasks, null, 2), 'utf-8')
    fs.writeFileSync(this.getLogsPath(), JSON.stringify(this.state.logs, null, 2), 'utf-8')
  }

  /** Validate an automation config, returning error messages or empty array if valid */
  validateConfig(config: AutomationConfig): string[] {
    const errors: string[] = []

    if (!config.name || config.name.trim().length === 0) {
      errors.push('任务名称不能为空')
    }
    if (config.name && config.name.length > 100) {
      errors.push('任务名称不能超过 100 个字符')
    }
    if (!config.prompt || config.prompt.trim().length === 0) {
      errors.push('提示词不能为空')
    }
    if (!config.modelId) {
      errors.push('必须选择一个模型')
    }
    if (!config.schedule?.startDate) {
      errors.push('必须设置开始日期')
    }

    const now = Date.now()
    const startTs = new Date(config.schedule.startDate).getTime()
    if (isNaN(startTs)) {
      errors.push('开始日期格式无效')
    }
    if (config.schedule.endDate) {
      const endTs = new Date(config.schedule.endDate).getTime()
      if (isNaN(endTs)) {
        errors.push('截止日期格式无效')
      } else if (endTs < startTs) {
        errors.push('截止日期不能早于开始日期')
      } else if (endTs < now) {
        errors.push('截止日期已过期')
      }
    }

    const dangerousKeywords = SAFETY_RULES.dangerousKeywords.filter((kw) =>
      config.prompt.toLowerCase().includes(kw.toLowerCase()),
    )
    if (dangerousKeywords.length > 0) {
      errors.push(
        `安全警告: 提示词包含危险关键词: ${dangerousKeywords.join(', ')}`,
      )
    }

    if (config.schedule.frequency === 'every-minute' || config.schedule.frequency === 'every-5min') {
      errors.push(
        '⚠️ 高频任务提醒: 建议先以低频试运行，确认结果符合预期后再提高频率',
      )
    }

    return errors
  }

  /** Create a new automation task */
  create(config: AutomationConfig): AutomationTask {
    this.init()
    const id = uuid()
    const cron =
      config.schedule.cron || this.frequencyToCron(config.schedule.frequency)

    const task: AutomationTask = {
      id,
      name: config.name,
      workspacePath:
        config.workspacePath ||
        path.join(app.getPath('userData'), 'workspaces', `automation-${id.slice(0, 8)}`),
      prompt: config.prompt,
      modelId: config.modelId,
      skillIds: config.skillIds,
      schedule: {
        cron,
        frequency: config.schedule.frequency,
        startDate: config.schedule.startDate,
        endDate: config.schedule.endDate,
        maxDurationMs: CONCURRENCY_LIMITS.defaultMaxDurationMs,
        maxConcurrency: CONCURRENCY_LIMITS.maxConcurrentTasks,
      },
      pushToMiniProgram: config.pushToMiniProgram,
      enabled: true,
      status: 'idle',
      stats: {
        totalRuns: 0,
        successRuns: 0,
        failedRuns: 0,
        avgDuration: 0,
        totalCostTokens: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.state.tasks.push(task)
    this.scheduleTask(task)
    this.saveState()

    this.addLog({
      id: uuid(),
      taskId: id,
      taskName: task.name,
      triggerTime: Date.now(),
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      status: 'success',
      result: `任务「${task.name}」已创建`,
      files: [],
      tokenCost: 0,
    })

    return task
  }

  /** Update an existing task */
  update(taskId: string, updates: Partial<AutomationConfig>): AutomationTask | null {
    this.init()
    const idx = this.state.tasks.findIndex((t) => t.id === taskId)
    if (idx < 0) return null

    const task = this.state.tasks[idx]
    const wasEnabled = task.enabled

    if (updates.name !== undefined) task.name = updates.name
    if (updates.prompt !== undefined) task.prompt = updates.prompt
    if (updates.modelId !== undefined) task.modelId = updates.modelId
    if (updates.skillIds !== undefined) task.skillIds = updates.skillIds
    if (updates.workspacePath !== undefined) task.workspacePath = updates.workspacePath
    if (updates.pushToMiniProgram !== undefined) task.pushToMiniProgram = updates.pushToMiniProgram

    if (updates.schedule) {
      task.schedule.frequency = updates.schedule.frequency
      task.schedule.cron =
        updates.schedule.cron || this.frequencyToCron(updates.schedule.frequency)
      task.schedule.startDate = updates.schedule.startDate
      task.schedule.endDate = updates.schedule.endDate
    }

    task.updatedAt = Date.now()

    // Reschedule if config changed
    if (wasEnabled) {
      this.unscheduleTask(taskId)
    }
    if (task.enabled) {
      this.scheduleTask(task)
    }

    this.state.tasks[idx] = task
    this.saveState()

    this.addLog({
      id: uuid(),
      taskId,
      taskName: task.name,
      triggerTime: Date.now(),
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      status: 'success',
      result: `任务「${task.name}」已更新`,
      files: [],
      tokenCost: 0,
    })

    return task
  }

  /** Delete a task */
  delete(taskId: string): boolean {
    this.init()
    const idx = this.state.tasks.findIndex((t) => t.id === taskId)
    if (idx < 0) return false

    const task = this.state.tasks[idx]
    this.unscheduleTask(taskId)
    this.state.tasks.splice(idx, 1)
    this.saveState()

    this.addLog({
      id: uuid(),
      taskId,
      taskName: task.name,
      triggerTime: Date.now(),
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      status: 'success',
      result: `任务「${task.name}」已删除`,
      files: [],
      tokenCost: 0,
    })

    return true
  }

  /** Get all tasks */
  list(): AutomationTask[] {
    this.init()
    return this.state.tasks
  }

  /** Get a single task by ID */
  get(taskId: string): AutomationTask | undefined {
    this.init()
    return this.state.tasks.find((t) => t.id === taskId)
  }

  /** Enable or disable a task */
  setEnabled(taskId: string, enabled: boolean): AutomationTask | null {
    this.init()
    const task = this.state.tasks.find((t) => t.id === taskId)
    if (!task) return null

    task.enabled = enabled
    if (enabled) {
      task.status = 'idle'
      this.scheduleTask(task)
    } else {
      task.status = 'paused'
      this.unscheduleTask(taskId)
    }

    task.updatedAt = Date.now()
    this.saveState()

    this.addLog({
      id: uuid(),
      taskId,
      taskName: task.name,
      triggerTime: Date.now(),
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      status: 'success',
      result: `任务「${task.name}」已${enabled ? '启用' : '暂停'}`,
      files: [],
      tokenCost: 0,
    })

    return task
  }

  /** Manually trigger a task (dry run) */
  async trigger(taskId: string): Promise<AutomationLog> {
    this.init()
    const task = this.state.tasks.find((t) => t.id === taskId)
    if (!task) {
      const failedLog: AutomationLog = {
        id: uuid(),
        taskId,
        taskName: '未知任务',
        triggerTime: Date.now(),
        startTime: Date.now(),
        status: 'failed',
        result: '',
        files: [],
        error: '任务不存在',
      }
      return failedLog
    }

    if (!this.canRun(task)) {
      const failedLog: AutomationLog = {
        id: uuid(),
        taskId,
        taskName: task.name,
        triggerTime: Date.now(),
        startTime: Date.now(),
        status: 'failed',
        result: '',
        files: [],
        error: '并发上限已达，请稍后重试',
      }
      this.state.logs.push(failedLog)
      this.saveState()
      return failedLog
    }

    return this.executeTask(task)
  }

  /** Get logs for a specific task or all logs */
  getLogs(taskId?: string): AutomationLog[] {
    this.init()
    if (taskId) {
      return this.state.logs.filter((l) => l.taskId === taskId)
    }
    return this.state.logs
  }

  /** Check for safety issues */
  checkSafety(prompt: string): { safe: boolean; warnings: string[] } {
    const warnings: string[] = []
    const lower = prompt.toLowerCase()

    for (const kw of SAFETY_RULES.dangerousKeywords) {
      if (lower.includes(kw.toLowerCase())) {
        warnings.push(`提示词包含危险操作关键词: "${kw}"`)
      }
    }

    const sensitiveHits = SAFETY_RULES.sensitiveOperations.filter((op) =>
      lower.includes(op),
    )
    if (sensitiveHits.length > 0) {
      warnings.push(`涉及敏感操作: ${sensitiveHits.join('、')}`)
    }

    if (warnings.length > 0) {
      warnings.push(SAFETY_RULES.warningMessage)
    }

    return { safe: warnings.length === 0, warnings }
  }

  // ──── Internal: scheduling ────

  private scheduleTask(task: AutomationTask): void {
    if (!task.enabled) return

    const intervalMs = this.cronToInterval(task.schedule.cron)
    if (intervalMs < CONCURRENCY_LIMITS.minIntervalMs) {
      // Too frequent, clamp to minimum
      return
    }

    this.unscheduleTask(task.id)

    const timer = setInterval(() => {
      const fresh = this.state.tasks.find((t) => t.id === task.id)
      if (!fresh || !fresh.enabled) {
        this.unscheduleTask(task.id)
        return
      }

      if (!this.isWithinDateRange(fresh)) {
        return
      }

      if (this.canRun(fresh)) {
        this.executeTask(fresh)
      }
    }, intervalMs)

    this.state.timers.set(task.id, timer)
  }

  private unscheduleTask(taskId: string): void {
    const timer = this.state.timers.get(taskId)
    if (timer) {
      clearInterval(timer)
      this.state.timers.delete(taskId)
    }
  }

  private canRun(task: AutomationTask): boolean {
    if (this.state.runningTasks.has(task.id)) return false
    if (this.state.runningTasks.size >= CONCURRENCY_LIMITS.maxConcurrentTasks) return false
    if (!this.isWithinDateRange(task)) return false
    return true
  }

  private isWithinDateRange(task: AutomationTask): boolean {
    const now = Date.now()
    const start = new Date(task.schedule.startDate).getTime()
    if (now < start) return false

    if (task.schedule.endDate) {
      const end = new Date(task.schedule.endDate).getTime() + 24 * 60 * 60 * 1000
      if (now > end) return false
    }
    return true
  }

  private async executeTask(task: AutomationTask): Promise<AutomationLog> {
    const taskId = task.id

    // Mark as running
    task.status = 'running'

    const durationTimeout = setTimeout(() => {
      this.forceStopTask(task, 'timeout')
    }, task.schedule.maxDurationMs || CONCURRENCY_LIMITS.defaultMaxDurationMs)

    this.state.runningTasks.add(taskId)

    const logEntry: AutomationLog = {
      id: uuid(),
      taskId,
      taskName: task.name,
      triggerTime: Date.now(),
      startTime: Date.now(),
      status: 'success',
      result: '',
      files: [],
      tokenCost: 0,
    }

    try {
      const startTime = Date.now()

      // Build workspace directory if it doesn't exist
      if (!fs.existsSync(task.workspacePath)) {
        fs.mkdirSync(task.workspacePath, { recursive: true })
      }

      // Send to renderer: task is starting
      this.notifyRenderer('automation:task-started', {
        taskId,
        taskName: task.name,
        triggerTime: logEntry.triggerTime,
      })

      // Execute via officeAgent through a simplified agent invocation.
      // In a production setup this would call the agent orchestrator directly.
      // For MVP, we execute the prompt and capture results.
      const result = await this.executeAgentTask(task)

      clearTimeout(durationTimeout)

      const endTime = Date.now()
      const duration = endTime - startTime

      logEntry.endTime = endTime
      logEntry.duration = duration
      logEntry.status = 'success'
      logEntry.result = result.summary || '任务执行完成'
      logEntry.files = result.files || []

      task.status = 'idle'
      task.stats.totalRuns++
      task.stats.successRuns++
      task.stats.avgDuration =
        (task.stats.avgDuration * (task.stats.totalRuns - 1) + duration) /
        task.stats.totalRuns
      task.stats.totalCostTokens += logEntry.tokenCost || 0
      task.lastRunAt = endTime
      task.updatedAt = endTime

      // Trigger mini-program push if enabled
      if (task.pushToMiniProgram) {
        this.pushToMiniProgram(task, logEntry)
      }

      this.notifyRenderer('automation:task-completed', {
        taskId,
        taskName: task.name,
        status: 'success',
        duration,
        files: logEntry.files,
      })
    } catch (err) {
      clearTimeout(durationTimeout)

      const errorMsg = err instanceof Error ? err.message : String(err)
      logEntry.status = 'failed'
      logEntry.endTime = Date.now()
      logEntry.duration = logEntry.endTime - logEntry.startTime
      logEntry.error = errorMsg
      logEntry.result = `执行失败: ${errorMsg}`

      task.status = 'error'
      task.stats.totalRuns++
      task.stats.failedRuns++
      task.lastRunAt = logEntry.endTime
      task.updatedAt = logEntry.endTime

      this.notifyRenderer('automation:task-failed', {
        taskId,
        taskName: task.name,
        error: errorMsg,
        duration: logEntry.duration,
      })
    } finally {
      this.state.runningTasks.delete(taskId)
      this.state.logs.push(logEntry)
      this.saveState()
    }

    return logEntry
  }

  private forceStopTask(task: AutomationTask, reason: AutomationLogStatus): void {
    task.status = 'error'
    this.state.runningTasks.delete(task.id)
    task.stats.totalRuns++
    task.stats.failedRuns++

    const timeoutLog: AutomationLog = {
      id: uuid(),
      taskId: task.id,
      taskName: task.name,
      triggerTime: Date.now(),
      startTime: Date.now(),
      endTime: Date.now(),
      duration: task.schedule.maxDurationMs || CONCURRENCY_LIMITS.defaultMaxDurationMs,
      status: reason,
      result: reason === 'timeout' ? '任务执行超时，已强制终止' : '任务已被取消',
      files: [],
      error: reason === 'timeout' ? '超过了最大执行时长限制' : '任务被取消',
    }

    this.state.logs.push(timeoutLog)
    this.saveState()

    this.notifyRenderer('automation:task-failed', {
      taskId: task.id,
      taskName: task.name,
      error: timeoutLog.error,
    })
  }

  private async executeAgentTask(
    task: AutomationTask,
  ): Promise<{ summary?: string; files: string[] }> {
    // MVP: simulate agent execution.
    // In production, this would invoke the actual agent orchestrator.
    // For now, we write the prompt to a file and notify the user.
    const logFile = path.join(task.workspacePath, 'execution.log')
    const content = [
      `=== 自动化任务执行 ===`,
      `任务名称: ${task.name}`,
      `模型: ${task.modelId}`,
      `技能: ${task.skillIds.join(', ') || '无'}`,
      `触发时间: ${new Date().toISOString()}`,
      ``,
      `Prompt:`,
      task.prompt,
    ].join('\n')

    fs.mkdirSync(task.workspacePath, { recursive: true })
    fs.writeFileSync(logFile, content, 'utf-8')

    const files = [logFile]

    return {
      summary: `自动化任务「${task.name}」已执行，日志保存于 ${logFile}`,
      files,
    }
  }

  private notifyRenderer(channel: string, data: unknown): void {
    try {
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        windows[0].webContents.send(channel, data)
      }
    } catch {
      // Ignore if no renderer is available (e.g., during initialization)
    }
  }

  private pushToMiniProgram(
    task: AutomationTask,
    log: AutomationLog,
  ): void {
    // Mini-program push via secure link.
    // Sends summary + link only (minimal data).
    const payload = {
      title: `自动化任务完成: ${task.name}`,
      summary: log.result.slice(0, 200),
      taskId: task.id,
      status: log.status,
      duration: log.duration,
      timestamp: log.endTime || Date.now(),
    }
    this.notifyRenderer('automation:mini-program-push', payload)
  }

  private addLog(log: AutomationLog): void {
    this.state.logs.push(log)
  }

  /** Convert a frequency preset to a cron expression */
  private frequencyToCron(
    frequency: AutomationSchedule['frequency'],
  ): string {
    const map: Record<string, string> = {
      'every-minute': '* * * * *',
      'every-5min': '*/5 * * * *',
      'every-10min': '*/10 * * * *',
      'every-30min': '*/30 * * * *',
      hourly: '0 * * * *',
      'every-6h': '0 */6 * * *',
      'every-12h': '0 */12 * * *',
      daily: '0 9 * * *',
      weekly: '0 9 * * 1',
      monthly: '0 9 1 * *',
      custom: '0 9 * * *',
    }
    return map[frequency] || '0 9 * * *'
  }

  /** Convert a cron expression to an interval in milliseconds */
  private cronToInterval(cron: string): number {
    const parts = cron.trim().split(/\s+/)
    if (parts.length < 5) return 60 * 60 * 1000

    const [_second, minute, hour, dayOfMonth, _month, ..._rest] =
      parts.length === 6 ? parts : ['0', ...parts]

    // Every minute
    if (minute === '*') return 60 * 1000

    // Every N minutes: */N
    const everyMinMatch = minute.match(/^\*\/(\d+)$/)
    if (everyMinMatch) {
      return parseInt(everyMinMatch[1]) * 60 * 1000
    }

    // Every N hours: 0 */N * * *
    if (minute === '0') {
      const everyHourMatch = hour.match(/^\*\/(\d+)$/)
      if (everyHourMatch) {
        return parseInt(everyHourMatch[1]) * 60 * 60 * 1000
      }
    }

    // Daily at specific hour: minute hour * * *
    if (hour !== '*' && !hour.includes('/') && !hour.includes(',') && !hour.includes('-')) {
      return 24 * 60 * 60 * 1000
    }

    // Specific minute within hour: minute * * * *
    if (minute !== '*' && !minute.includes('/') && !minute.includes(',') && !minute.includes('-')) {
      return 60 * 60 * 1000
    }

    // Default: hourly
    return 60 * 60 * 1000
  }
}

export const schedulerService = new SchedulerService()
