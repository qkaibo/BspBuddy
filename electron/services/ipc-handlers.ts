import { ipcMain, BrowserWindow, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { Dirent } from 'fs'
import type { StepStatus } from '../../src/lib/types'
import { IPC_CHANNELS } from '../../src/lib/types'
import { aiService } from './ai'
import { orchestrator } from './orchestrator'
import { toolRegistry } from './tools/registry'
import { registerFileTools } from './tools/file'
import { registerSearchTools } from './tools/search'
import { registerDocumentTools } from './tools/document'

// ============================================================
// IPC Handlers — wire up renderer ↔ main process
// ============================================================

export function registerIpcHandlers(): void {
  // Register all built-in tools
  registerFileTools()
  registerSearchTools()
  registerDocumentTools()

  // Forward orchestrator progress to the renderer
  orchestrator.onProgress((event) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send(IPC_CHANNELS.TASK_PROGRESS, {
        planId: event.planId,
        stepId: event.stepId,
        status: event.status,
        result: event.result,
        error: event.error,
      })
    }
  })

  // ----------------------------------------------------------
  // Core: Execute a user task
  // ----------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.EXECUTE_TASK, async (_event, userInput: string) => {
    try {
      // Step 1: Ask AI to create a plan
      const tools = toolRegistry.toFunctionDefinitions()
      const aiResponse = await aiService.plan(userInput, tools)

      if (aiResponse.type === 'chat') {
        return { content: aiResponse.content, plan: null, artifacts: [] }
      }

      if (!aiResponse.steps || aiResponse.steps.length === 0) {
        return { content: 'No actionable steps identified.', plan: null, artifacts: [] }
      }

      // Step 2: Create execution plan
      const plan = orchestrator.createPlan(
        aiResponse.summary || userInput,
        aiResponse.steps,
      )

      // Step 3: Execute the plan
      const completedPlan = await orchestrator.execute(plan)

      // Step 4: Collect artifacts
      const artifacts = completedPlan.steps
        .filter((s) => s.result?.artifacts)
        .flatMap((s) => s.result!.artifacts!)

      // Step 5: Generate summary
      const doneCount = completedPlan.steps.filter((s) => s.status === 'completed').length
      const totalCount = completedPlan.steps.length

      let content: string
      if (completedPlan.status === 'completed') {
        const fileList =
          artifacts.length > 0
            ? `\n\nGenerated files:\n${artifacts.map((a) => `- ${a.name}`).join('\n')}`
            : ''
        content = `Task completed successfully! (${doneCount}/${totalCount} steps done)${fileList}`
      } else {
        const failedSteps = completedPlan.steps
          .filter((s) => s.status === 'failed')
          .map((s) => `- Step ${s.index}: ${s.error}`)
          .join('\n')
        content = `Task partially failed. (${doneCount}/${totalCount} steps done)\n\nErrors:\n${failedSteps}`
      }

      return {
        content,
        plan: completedPlan,
        artifacts,
      }
    } catch (err) {
      return {
        content: null,
        error: err instanceof Error ? err.message : String(err),
        plan: null,
        artifacts: [],
      }
    }
  })

  // ----------------------------------------------------------
  // File dialog
  // ----------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.FILE_DIALOG, async (_event, options: { type: 'open' | 'save' }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return null

    if (options.type === 'open') {
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile', 'multiSelections'],
      })
      return result.canceled ? null : result.filePaths
    }

    const result = await dialog.showSaveDialog(win, {})
    return result.canceled ? null : result.filePath
  })

  // ----------------------------------------------------------
  // File operations (for tools that need cross-platform paths)
  // ----------------------------------------------------------
  const fs = require('fs')
  const path = require('path')

  ipcMain.handle(IPC_CHANNELS.READ_FILE, async (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }
    return fs.readFileSync(filePath, 'utf-8')
  })

  ipcMain.handle(IPC_CHANNELS.WRITE_FILE, async (_event, filePath: string, content: string) => {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, content, 'utf-8')
    return { filePath, size: Buffer.byteLength(content) }
  })

  ipcMain.handle(IPC_CHANNELS.LIST_DIR, async (_event, dirPath: string) => {
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`)
    }
    return fs.readdirSync(dirPath, { withFileTypes: true }).map((e: Dirent) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      isFile: e.isFile(),
    }))
  })
}
