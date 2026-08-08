import { v4 as uuid } from 'uuid'
import type { TaskPlan, TaskStep, DependencyEdge, StepStatus, PermissionOperationType } from '../../lib/types'
import { toolRegistry } from './tools/registry'
import { permissionService } from './permission-service'

type ProgressCallback = (event: {
  planId: string
  stepId: string
  status: StepStatus
  result?: unknown
  error?: string
}) => void

export class Orchestrator {
  private progressCallback: ProgressCallback | null = null

  onProgress(cb: ProgressCallback): void {
    this.progressCallback = cb
  }

  createPlan(
    userIntent: string,
    rawSteps: Array<{
      description: string
      tool: string
      params: Record<string, unknown>
    }>,
  ): TaskPlan {
    const steps: TaskStep[] = rawSteps.map((s, i) => ({
      id: uuid(),
      index: i + 1,
      description: s.description,
      toolName: s.tool,
      toolParams: s.params,
      status: 'pending' as StepStatus,
    }))

    const dependencies: DependencyEdge[] = []
    for (let i = 1; i < steps.length; i++) {
      dependencies.push({ from: steps[i - 1].id, to: steps[i].id })
    }

    return {
      id: uuid(),
      userIntent,
      steps,
      dependencies,
      createdAt: Date.now(),
      status: 'ready',
    }
  }

  async execute(plan: TaskPlan): Promise<TaskPlan> {
    const currentPlan: TaskPlan = { ...plan, status: 'running' }

    this.emit(plan.id, '', 'running')

    const completed = new Set<string>()
    const remaining = new Set(currentPlan.steps.map((s) => s.id))

    while (remaining.size > 0) {
      const readySteps = currentPlan.steps.filter((step) => {
        if (!remaining.has(step.id)) return false
        const deps = currentPlan.dependencies.filter((d) => d.to === step.id)
        return deps.every((d) => completed.has(d.from))
      })

      if (readySteps.length === 0) {
        for (const id of remaining) {
          const step = currentPlan.steps.find((s) => s.id === id)!
          step.status = 'failed'
          step.error = 'Blocked by unresolved dependencies'
          this.emit(plan.id, step.id, 'failed', undefined, step.error)
        }
        currentPlan.status = 'failed'
        return currentPlan
      }

      const results = await Promise.allSettled(
        readySteps.map((step) => this.executeStep(step, currentPlan.id)),
      )

      for (let i = 0; i < readySteps.length; i++) {
        const step = readySteps[i]
        const result = results[i]

        if (result.status === 'fulfilled') {
          step.status = 'completed'
          step.result = result.value
          step.completedAt = Date.now()
          this.emit(plan.id, step.id, 'completed', result.value)
        } else {
          step.status = 'failed'
          step.error = result.reason instanceof Error ? result.reason.message : String(result.reason)
          this.emit(plan.id, step.id, 'failed', undefined, step.error)
        }

        remaining.delete(step.id)
        completed.add(step.id)
      }

      if (currentPlan.steps.some((s) => s.status === 'failed')) {
        for (const id of remaining) {
          const step = currentPlan.steps.find((s) => s.id === id)!
          step.status = 'skipped'
          this.emit(plan.id, step.id, 'skipped')
        }
        currentPlan.status = 'failed'
        return currentPlan
      }
    }

    currentPlan.status = 'completed'
    this.emit(plan.id, '', 'completed')
    return currentPlan
  }

  private async executeStep(step: TaskStep, planId: string) {
    this.emit(planId, step.id, 'running')
    step.status = 'running'
    step.startedAt = Date.now()

    // Check permissions before executing high-risk tools
    const permType = this.getPermissionType(step.toolName)
    if (permType) {
      const target = this.getPermissionTarget(step.toolName, step.toolParams)
      const permResponse = await permissionService.check({
        type: permType,
        target,
        reason: step.description,
        scope: 'workspace',
      })

      if (permResponse.action === 'deny') {
        return {
          success: false,
          error: '操作已被用户拒绝（权限确认未通过）',
        }
      }
    }

    return toolRegistry.execute(step.toolName, step.toolParams)
  }

  private getPermissionType(toolName: string): PermissionOperationType | null {
    const tool = toolRegistry.get(toolName)
    if (!tool) return null

    switch (tool.category) {
      case 'terminal':
        return 'execute'
      case 'file':
        // File tools need further differentiation
        if (toolName === 'file_write') return 'file_write'
        return null  // file_read and file_list don't need permission checks at this level
      default:
        return null
    }
  }

  private getPermissionTarget(toolName: string, params: Record<string, unknown>): string {
    if (params.filePath) return params.filePath as string
    if (params.dirPath) return params.dirPath as string
    if (params.command) return params.command as string
    if (params.url) return params.url as string
    if (params.path) return params.path as string
    return toolName
  }

  private emit(
    planId: string,
    stepId: string,
    status: string,
    result?: unknown,
    error?: string,
  ): void {
    if (this.progressCallback) {
      this.progressCallback({ planId, stepId, status: status as StepStatus, result, error })
    }
  }
}

export const orchestrator = new Orchestrator()
