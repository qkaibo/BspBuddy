import { v4 as uuid } from 'uuid'
import type { TaskPlan, TaskStep, DependencyEdge, StepStatus } from '../../src/lib/types'
import { toolRegistry } from './tools/registry'

// ============================================================
// DAG Task Orchestrator
// ============================================================

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

  /** Parse an AI-generated plan into executable steps */
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

    // Build dependency graph: by default, steps are sequential
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

  /**
   * Execute a plan step by step.
   * Currently uses sequential execution (step 1, then 2, ...).
   * DAG-aware parallel execution is the next iteration.
   */
  async execute(plan: TaskPlan): Promise<TaskPlan> {
    const currentPlan: TaskPlan = { ...plan, status: 'running' }

    this.emit(plan.id, '', 'running')

    // Build topology: determine which steps are ready
    const completed = new Set<string>()
    const remaining = new Set(currentPlan.steps.map((s) => s.id))

    while (remaining.size > 0) {
      // Find ready steps (all dependencies completed)
      const readySteps = currentPlan.steps.filter((step) => {
        if (!remaining.has(step.id)) return false
        const deps = currentPlan.dependencies.filter((d) => d.to === step.id)
        return deps.every((d) => completed.has(d.from))
      })

      if (readySteps.length === 0) {
        // Circular dependency or all remaining are blocked — break
        for (const id of remaining) {
          const step = currentPlan.steps.find((s) => s.id === id)!
          step.status = 'failed'
          step.error = 'Blocked by unresolved dependencies'
          this.emit(plan.id, step.id, 'failed', undefined, step.error)
        }
        currentPlan.status = 'failed'
        return currentPlan
      }

      // Execute ready steps in parallel
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

      // If any step failed, stop execution
      if (currentPlan.steps.some((s) => s.status === 'failed')) {
        // Mark remaining as skipped
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

    return toolRegistry.execute(step.toolName, step.toolParams)
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
