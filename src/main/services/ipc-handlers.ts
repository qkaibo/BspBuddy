import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import { StringDecoder } from 'string_decoder'
import { IPC_CHANNELS } from '../../lib/types'
import type { AgentMode, PermissionAction, PermissionMode } from '../../lib/types'
import type { Expert, ExpertBindings } from '../../lib/expert-types'
import { mapAgentsToExperts, mapExpertToAgentRequest, type FastApiAgent } from '../../lib/expert-mapper'
import { officeAgent } from './agent'
import { orchestrator } from './orchestrator'
import { toolRegistry } from './tools/registry'
import { AIService } from './ai'
import { registerFileTools } from './tools/file'
import { registerSearchTools } from './tools/search'
import { registerDocumentTools } from './tools/document'
import { registerOfficeTools } from './tools/office'
import { pythonBridge } from '../python-bridge'
import { skillService } from './skill-service'
import { pluginService } from './plugin-service'
import { expertService } from './expert-service'
import { MOCK_GENERAL_SKILLS, MOCK_KNOWLEDGE_BASES } from './resource-mocks'
import { sopService } from './sop-service'
import { authService } from './auth-service'
import type { SopCreateParams, SopListParams, SopUpdateParams } from '../../lib/sop-types'
import type {
  AuthLoginParams,
  AuthUserCreateParams,
  AuthUserUpdateParams,
  AuthUsersListParams,
} from '../../lib/auth-types'
import { startFastApi, stopFastApi, fastApiFetch, isFastApiReady, getFastApiBaseUrl, getToken, probeAndBroadcastFastApiStatus } from './fastapi-bridge'
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
import { getLocal, listLocal, saveLocal, updateLocal, deleteLocal, setLocalDataDir } from './model-config-local'
import type { LocalModelConfig } from './model-config-local'
import { sidecarService } from './sidecar-service'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'

export function registerIpcHandlers(): void {
  setLocalDataDir(app.getPath('userData'))
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
  ipcMain.handle(IPC_CHANNELS.EXECUTE_TASK, async (_event, userInput: string, mode: AgentMode, modelId?: string, _context?: {
    currentFile?: string; openFiles?: string[]
    expertId?: string
    expertInfo?: { name: string; title: string; methodology: string; toolChain: string[]; persona: string }
    activeResources?: { id: string; type: string; name: string }[]
    streamMessageId?: string
    expertName?: string
  }) => {
    try {
      // --- Expert chat MUST go through A2A AgentLoop (server-side MCP/skills) ---
      // Never route expert turns to Sidecar / local AIService / chat proxy.
      if (_context?.expertId) {
        try {
          const modeHint = mode === 'ask'
            ? '（注意：当前是Ask模式，只需回答/建议，不要生成执行计划）'
            : mode === 'plan'
            ? '（注意：当前是Plan模式，请生成详细的步骤计划，标注"waiting_confirmation"状态）'
            : '（Craft模式，直接生成可执行计划）'
          const aiResponse = await _planViaA2A(
            _context.expertId,
            userInput,
            modeHint,
            _context.streamMessageId,
            _context.expertName || _context.expertInfo?.title || _context.expertInfo?.name,
          )
          const result = _processPlanResponse(aiResponse, mode, userInput)
          if (result.content) {
            _extractMemoriesAfterTurn(userInput, result.content)
          }
          return { ...result, trace: (aiResponse as { trace?: unknown }).trace }
        } catch (err) {
          console.error('[EXECUTE_TASK] A2A expert chat failed:', err)
          return {
            content: null,
            error: `专家服务暂时不可用: ${err instanceof Error ? err.message : String(err)}`,
            plan: null,
            artifacts: [],
          }
        }
      }

      // --- Non-expert: Resolve LLM service ---
      let result: { content: string | null; error: string | null; plan: unknown | null; artifacts: unknown[] }
      if (modelId) {
        // Check if this is a local-only model (starts with "local_")
        if (modelId.startsWith('local_')) {
          const localCfg = getLocal(modelId)
          if (localCfg) {
            // Use Python sidecar for local models
            try {
              result = await _planViaSidecar(userInput, mode, localCfg, undefined, _context?.activeResources)
              if (result.content) {
                _extractMemoriesAfterTurn(userInput, result.content)
              }
              return result
            } catch (err) {
              console.warn('[EXECUTE_TASK] Sidecar failed, falling back to legacy AIService:', err)
            }
            // Fallback to legacy AIService if sidecar fails
            const aiService = new AIService({
              apiKey: localCfg.api_key,
              baseUrl: localCfg.base_url,
              model: localCfg.model,
            })
            const tools = toolRegistry.toFunctionDefinitions(mode)
            const relevantMemories = memoryService.getContextForQuery(userInput, 10)
            const memoryContext = relevantMemories.length > 0
              ? memoryService.formatContext(relevantMemories)
              : undefined
            const aiResponse = await aiService.plan(userInput, tools, memoryContext)
            result = _processPlanResponse(aiResponse, mode, userInput)
            if (result.content) {
              _extractMemoriesAfterTurn(userInput, result.content)
            }
            return result
          }
          console.warn('[EXECUTE_TASK] Local model config not found:', modelId)
        } else {
          // Cloud model → backend proxy
          try {
            const aiResponse = await _planViaBackend(userInput, mode, modelId, undefined, _context?.expertInfo, _context?.activeResources)
            if (aiResponse) {
              result = _processPlanResponse(aiResponse, mode, userInput)
              if (result.content) {
                _extractMemoriesAfterTurn(userInput, result.content)
              }
              return result
            }
          } catch (err) {
            console.warn('[EXECUTE_TASK] Backend proxy failed:', err)
          }
        }
      }
      // No modelId or both paths failed → fallback to default AIService
      const aiResponse = await officeAgent.plan(userInput, mode)
      result = _processPlanResponse(aiResponse, mode, userInput)
      if (result.content) {
        _extractMemoriesAfterTurn(userInput, result.content)
      }
      return result
    } catch (err) {
      console.error('[EXECUTE_TASK] Failed:', err)
      return {
        content: null, error: err instanceof Error ? err.message : JSON.stringify(err),
        plan: null, artifacts: [],
      }
    }
  })

  // ---- Helper: call A2A AgentLoop (expert chat with full capability manifest) ----
  async function _planViaA2A(
    agentId: string,
    userInput: string,
    modeHint: string,
    streamMessageId?: string,
    expertName?: string,
  ) {
    let token = getToken()
    if (!token) {
      // Auto-login if token not yet acquired
      try {
        const { default: axios } = await import('axios')
        const baseUrl = getFastApiBaseUrl()
        const loginRes = await axios.post(`${baseUrl}/api/auth/login`, {
          tenant_id: 'tenant_demo',
          username: 'admin',
          password: 'admin',
        })
        if (loginRes.data?.token) {
          token = loginRes.data.token
        }
      } catch (err) {
        console.error('[_planViaA2A] Auto-login failed:', (err as Error).message)
      }
    }
    if (!token) throw new Error('AUTH_TOKEN_MISSING')

    const baseUrl = getFastApiBaseUrl()

    const body = JSON.stringify({
      message: { role: 'user', parts: [{ text: userInput + ' ' + modeHint }] },
      metadata: {},
    })

    const url = `${baseUrl}/a2a/agents/${agentId}/tasks?tenant_id=tenant_demo`

    type TraceStep = {
      id: string
      label: string
      kind: 'status' | 'mcp' | 'tool' | 'skill' | 'capability'
      status?: string
      provider?: string
      tool_name?: string
    }
    const traceSteps: TraceStep[] = []
    let mcpCalled: boolean | null = null
    let mcpUnavailable = false
    let mcpUnavailableDetail: string | undefined

    const emitStream = (payload: {
      kind: 'status' | 'delta' | 'replace' | 'error' | 'trace' | 'trace_summary'
      content?: string
      phase?: string
      step?: TraceStep
      steps?: TraceStep[]
      mcpCalled?: boolean
      mcpUnavailable?: boolean
      mcpUnavailableDetail?: string
    }) => {
      if (!streamMessageId) return
      const win = BrowserWindow.getAllWindows()[0]
      if (!win || win.isDestroyed()) return
      win.webContents.send(IPC_CHANNELS.A2A_CHAT_STREAM, {
        messageId: streamMessageId,
        expertName,
        ...payload,
      })
    }

    const { default: axios } = await import('axios')
    // Expert AgentLoop + MCP can exceed 2 minutes easily (max_actions up to 20).
    // Short axios timeout aborts the SSE mid-flight → UI "专家服务暂时不可用: aborted".
    const res = await axios({
      method: 'POST', url, data: body,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      responseType: 'stream',
      timeout: 600_000,
      // Avoid Node treating idle gaps between tool rounds as a failure.
      maxRedirects: 0,
    })

    let fullText = ''
    let buffer = ''
    let sawDelta = false
    let streamSessionId = ''
    const seenEventKinds: string[] = []
    const decoder = new StringDecoder('utf8')
    let finished = false

    const fetchLatestAssistantReply = async (sessionId: string): Promise<string> => {
      const sid = sessionId.trim()
      if (!sid) return ''
      try {
        const msgRes = await axios.get(
          `${baseUrl}/api/chat/sessions/${encodeURIComponent(sid)}/messages`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { tenant_id: 'tenant_demo' },
            timeout: 30_000,
          },
        )
        const rows = Array.isArray(msgRes.data) ? msgRes.data as Array<{ role?: string; content?: string }> : []
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          const row = rows[i]
          if (row?.role === 'assistant' && typeof row.content === 'string' && row.content.trim()) {
            return row.content.trim()
          }
        }
      } catch (err) {
        console.warn('[A2A] fallback fetch messages failed:', (err as Error).message)
      }
      return ''
    }

    return new Promise<{ type: 'chat'; content: string; trace?: { viaA2A: boolean; expertName?: string; mcpCalled: boolean | null; mcpUnavailable?: boolean; mcpUnavailableDetail?: string; steps: TraceStep[] } }>((resolve, reject) => {
      const finish = (text: string) => {
        if (finished) return
        finished = true
        void (async () => {
          let content = (text || '').trim()
          if (!content && streamSessionId) {
            console.warn(
              '[A2A] finish() empty from SSE; fetching messages. session=',
              streamSessionId,
              'kinds=',
              seenEventKinds.join(','),
              'steps=',
              traceSteps.length,
            )
            content = await fetchLatestAssistantReply(streamSessionId)
          } else if (!content) {
            console.warn(
              '[A2A] finish() with empty reply; no sessionId. kinds=',
              seenEventKinds.join(','),
              'steps=',
              traceSteps.length,
            )
          }
          if (content) {
            emitStream({ kind: 'replace', content })
          }
          resolve({
            type: 'chat',
            content,
            trace: {
              viaA2A: true,
              expertName,
              mcpCalled: mcpCalled ?? false,
              mcpUnavailable,
              mcpUnavailableDetail,
              steps: traceSteps,
            },
          })
        })()
      }

      const consumeSseBuffer = (flushAll: boolean) => {
        // Split on SSE event boundaries. Never decode mid-codepoint (StringDecoder
        // holds partial UTF-8); chunk.toString('utf-8') previously corrupted Chinese
        // reply JSON → silent parse failures → empty bubble.
        while (true) {
          const sep = buffer.indexOf('\n\n')
          if (sep < 0) break
          const raw = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          for (const line of raw.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const jsonStr = trimmed.startsWith('data: ')
              ? trimmed.slice(6)
              : trimmed.slice(5).trimStart()
            if (!jsonStr || jsonStr === '[DONE]') continue
            try {
              handlePayload(JSON.parse(jsonStr) as Record<string, unknown>)
            } catch (err) {
              console.warn('[A2A] SSE JSON parse failed:', (err as Error).message, jsonStr.slice(0, 160))
            }
          }
        }
        if (flushAll && buffer.trim()) {
          for (const line of buffer.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const jsonStr = trimmed.startsWith('data: ')
              ? trimmed.slice(6)
              : trimmed.slice(5).trimStart()
            if (!jsonStr || jsonStr === '[DONE]') continue
            try {
              handlePayload(JSON.parse(jsonStr) as Record<string, unknown>)
            } catch (err) {
              console.warn('[A2A] SSE trailing JSON parse failed:', (err as Error).message, jsonStr.slice(0, 160))
            }
          }
          buffer = ''
        }
      }

      const noteSessionId = (data: Record<string, unknown>, payload: Record<string, unknown>) => {
        const sid = data.sessionId || data.session_id || payload.sessionId || payload.session_id
        if (typeof sid === 'string' && sid.trim()) streamSessionId = sid.trim()
      }

      const handlePayload = (payload: Record<string, unknown>) => {
        const data = (payload.data || payload) as Record<string, unknown>
        const kind = String(data.kind || payload.event || payload.type || '')
        if (kind) seenEventKinds.push(kind)
        noteSessionId(data, payload)
        if (kind === 'stream_delta' && typeof data.content === 'string' && data.content) {
          fullText += data.content
          sawDelta = true
          emitStream({ kind: 'delta', content: data.content })
        } else if (kind === 'stream_replace' && typeof data.content === 'string') {
          fullText = data.content
          sawDelta = true
          emitStream({ kind: 'replace', content: data.content })
        } else if (kind === 'complete' || String(payload.event || '') === 'complete') {
          const reply = typeof data.reply === 'string'
            ? data.reply
            : (typeof (payload as { reply?: unknown }).reply === 'string'
              ? String((payload as { reply: string }).reply)
              : '')
          if (reply) {
            fullText = reply
            sawDelta = true
            emitStream({ kind: 'replace', content: reply })
          }
        } else if (kind === 'capability_progress') {
          const stepRaw = (data.step && typeof data.step === 'object')
            ? data.step as Record<string, unknown>
            : null
          const step: TraceStep = {
            id: String(stepRaw?.id || `${data.tool_name || data.text || Date.now()}`),
            label: String(stepRaw?.label || data.text || '能力调用'),
            kind: (String(stepRaw?.kind || 'tool') as TraceStep['kind']),
            status: stepRaw?.status ? String(stepRaw.status) : undefined,
            provider: stepRaw?.provider ? String(stepRaw.provider) : undefined,
            tool_name: stepRaw?.tool_name ? String(stepRaw.tool_name) : undefined,
          }
          const idx = traceSteps.findIndex((s) =>
            s.id === step.id
            || (s.tool_name && step.tool_name && s.tool_name === step.tool_name && (
              s.kind === step.kind
              || (s.kind === 'tool' && step.kind === 'mcp')
              || (s.kind === 'mcp' && step.kind === 'tool')
            ))
            || (s.label === step.label && s.kind === step.kind)
          )
          if (idx >= 0) traceSteps[idx] = { ...traceSteps[idx], ...step }
          else traceSteps.push(step)
          if (data.mcp_unavailable === true) {
            mcpUnavailable = true
            if (typeof data.mcp_unavailable_detail === 'string') {
              mcpUnavailableDetail = data.mcp_unavailable_detail
            }
          }
          if (step.kind === 'mcp' && step.status !== 'unavailable') mcpCalled = true
          emitStream({
            kind: 'trace',
            content: step.label,
            step,
            mcpUnavailable,
            mcpUnavailableDetail,
          })
        } else if (kind === 'capability_trace') {
          const steps = Array.isArray(data.steps) ? data.steps as TraceStep[] : []
          for (const step of steps) {
            const idx = traceSteps.findIndex((s) =>
              s.id === step.id
              || (s.tool_name && step.tool_name && s.tool_name === step.tool_name && (
                s.kind === step.kind
                || (s.kind === 'tool' && step.kind === 'mcp')
                || (s.kind === 'mcp' && step.kind === 'tool')
              ))
              || (s.label === step.label && s.kind === step.kind)
            )
            if (idx >= 0) traceSteps[idx] = { ...traceSteps[idx], ...step }
            else traceSteps.push(step)
          }
          if (data.mcp_unavailable === true) {
            mcpUnavailable = true
            if (typeof data.mcp_unavailable_detail === 'string') {
              mcpUnavailableDetail = data.mcp_unavailable_detail
            }
          }
          if (typeof data.mcp_called === 'boolean') mcpCalled = data.mcp_called
          else if (traceSteps.some((s) => s.kind === 'mcp' && s.status !== 'unavailable')) mcpCalled = true
          emitStream({
            kind: 'trace_summary',
            steps: traceSteps,
            mcpCalled: mcpCalled ?? false,
            mcpUnavailable,
            mcpUnavailableDetail,
          })
        } else if (kind === 'status') {
          const text = String(data.text || data.message || '').trim()
          const phase = String(data.phase || data.state || '')
          if (phase === 'running' && (!text || text === 'running')) {
            // Heartbeat — keep connection alive; don't spam the trace list.
          } else if (text) {
            const step: TraceStep = {
              id: `status:${text}`,
              label: text,
              kind: 'status',
              status: phase || 'status',
            }
            const idx = traceSteps.findIndex((s) => s.id === step.id || (s.kind === 'status' && s.label === text))
            if (idx >= 0) traceSteps[idx] = { ...traceSteps[idx], ...step }
            else traceSteps.push(step)
            emitStream({ kind: 'status', content: text, phase, step })
          }
        } else if (kind === 'error') {
          const message = String(data.message || '专家执行出错')
          emitStream({ kind: 'error', content: message })
        }
      }

      res.data.on('data', (chunk: Buffer) => {
        buffer += decoder.write(chunk)
        consumeSseBuffer(false)
      })

      res.data.on('end', () => {
        buffer += decoder.end()
        consumeSseBuffer(true)
        finish(fullText)
      })

      res.data.on('error', (err: Error) => {
        console.error('[A2A] SSE stream error:', err.message)
        buffer += decoder.end()
        consumeSseBuffer(true)
        if (fullText.trim()) {
          console.warn('[A2A] Returning partial reply after stream abort')
          finish(fullText)
          return
        }
        if (!finished) reject(err)
      })
    })
  }

  // ---- Helper: call backend LLM proxy ----
  async function _planViaBackend(
    userInput: string,
    mode: AgentMode,
    modelId: string,
    expertId?: string,
    expertInfo?: { name: string; title: string; methodology: string; toolChain: string[]; persona: string },
    activeResources?: { id: string; type: string; name: string }[],
  ) {
    const tools = toolRegistry.toFunctionDefinitions(mode)
    const toolsJson = tools.map(t => `- **${t.name}**: ${t.description}`).join('\n')
    const modeText = mode === 'craft' ? 'Craft（直接执行）'
      : mode === 'plan' ? 'Plan（先生成计划，待用户确认后执行）'
      : 'Ask（仅回答问题和建议，不执行操作）'
    const modeHint = mode === 'ask'
      ? '（注意：当前是Ask模式，只需回答/建议，不要生成执行计划）'
      : mode === 'plan'
      ? '（注意：当前是Plan模式，请生成详细的步骤计划，标注"waiting_confirmation"状态）'
      : '（Craft模式，直接生成可执行计划）'

    const relevantMemories = memoryService.getContextForQuery(userInput, 10)
    const memoryContext = relevantMemories.length > 0
      ? `\n## 用户记忆（参考背景信息）\n${memoryService.formatContext(relevantMemories)}`
      : ''

    // ── Expert context ──
    let expertHint = ''
    if (expertInfo) {
      // Use expert data passed directly from UI — no re-fetch needed
      expertHint = `\n## 当前专家身份\n你正在以「${expertInfo.title || expertInfo.name}」的身份回答用户。\n${expertInfo.methodology ? `专业领域：${expertInfo.methodology}\n` : ''}${expertInfo.toolChain?.length > 0 ? `工具链：${expertInfo.toolChain.join('、')}\n` : ''}\n\n请用该专家的专业视角、方法论和技能来分析和回答用户的问题。`
    } else if (expertId) {
      // Fallback: try local + FastAPI lookup
      let expert = expertService.getExpert(expertId)
      if (!expert) {
        try {
          const agent = await fastApiFetch('GET', `/api/enterprise/agents/${expertId}`) as {
            name: string; metadata?: { title?: string; methodology?: string; toolChain?: string[] }
          }
          if (agent?.name) {
            expert = {
              id: expertId, name: agent.name,
              title: agent.metadata?.title || agent.name,
              methodology: agent.metadata?.methodology || '',
              toolChain: agent.metadata?.toolChain || [],
            } as any
          }
        } catch { /* fall through */ }
      }
      if (expert) {
        expertHint = `\n## 当前专家\n你正在以「${expert.name}」（${expert.title}）的身份回答。\n专长领域：${expert.methodology}\n工具链：${expert.toolChain.join('、')}\n\n请用该专家的专业视角和技能来分析和回答用户的问题。`
      }
    }

    const resourceHint = activeResources && activeResources.length > 0
      ? `\n## 对话上下文资源\n已激活以下资源，请在回答时参考：\n${activeResources.map((r) => `- ${r.type === 'expert' ? '专家' : r.type === 'skill' ? '技能' : r.type === 'sop' ? 'SOP' : '知识库'}: ${r.name}`).join('\n')}\n`
      : ''

    const systemPrompt = `你是 BspBuddy，一个专业的AI桌面工作台助手。
${memoryContext}${expertHint}${resourceHint}
## 工作模式
当前模式: ${modeText}

## 可用工具
${toolsJson}

## 响应规则
1. 当用户请求需要工具执行的任务时，Craft 模式下直接输出 plan；Plan 模式下输出 plan 但标注待确认；Ask 模式下输出 chat。
2. 纯问答、咨询、建议类问题，直接输出 chat 类型。
3. 步骤描述要用中文，清晰说明每一步做什么。

## 响应格式
需要工具的任务:
\`\`\`json
{
  "type": "plan",
  "summary": "整体任务描述",
  "steps": [
    {
      "description": "步骤描述",
      "tool": "tool_name",
      "params": { "key": "value" }
    }
  ]
}
\`\`\`

纯对话:
\`\`\`json
{
  "type": "chat",
  "content": "你的回复内容"
}
\`\`\``

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput + modeHint },
    ]

    // Expert chat is handled exclusively by EXECUTE_TASK → _planViaA2A.
    // This helper is only for non-expert cloud-model turns.
    const body: Record<string, unknown> = { messages, model_config_id: modelId }

    const result = await fastApiFetch('POST', '/api/chat/proxy/send', body) as { content: string }

    const text = result.content
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim())
      } catch {
        // JSON broken inside code fence — try content field extraction
        const contentMatch = jsonMatch[1].match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/)
        if (contentMatch) {
          const content = contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
          return { type: 'chat' as const, content }
        }
      }
    }
    try {
      return JSON.parse(text.trim())
    } catch {
      return { type: 'chat' as const, content: text }
    }
  }

  // ---- Helper: extract memories after a successful turn ----
  function _extractMemoriesAfterTurn(userInput: string, assistantContent: string) {
    try {
      memoryService.extractFromConversations([{
        messages: [
          { role: 'user', content: userInput },
          { role: 'assistant', content: assistantContent },
        ],
      }])
    } catch {
      // Memory extraction is best-effort — never fail the turn
    }
  }

  // ---- Helper: call Python sidecar (local model path) ----
  async function _planViaSidecar(
    userInput: string,
    mode: AgentMode,
    localCfg: LocalModelConfig,
    expertId?: string,
    activeResources?: { id: string; type: string; name: string }[],
  ) {
    // Ensure sidecar is initialized
    if (!sidecarService.isRunning()) {
      const workspaceRoot = app.getPath('home')
      const backendUrl = getFastApiBaseUrl()
      const token = getToken()
      await sidecarService.initialize({
        workspaceRoot,
        inference: sidecarService.getInferenceFromLocalConfig(localCfg),
        backendUrl,
        authToken: token || '',
      })
    }

    const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // ── Build external tools list (local TypeScript tools + MCP tools) ──
    const localToolDefs = toolRegistry.toFunctionDefinitions(mode)
    const externalTools = localToolDefs.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: (t as any).parameters || { type: 'object', properties: {}, required: [] },
    }))

    // Include MCP tools from connected servers
    try {
      const mcpTools = mcpService.list().flatMap((s) =>
        s.tools.map((t: { name: string; description: string; parameters?: Record<string, unknown> }) => ({
          name: `mcp_${s.name}_${t.name}`,
          description: `[MCP:${s.name}] ${t.description || t.name}`,
          parameters: t.parameters || { type: 'object', properties: {}, required: [] },
        }))
      )
      externalTools.push(...mcpTools)
    } catch {
      // MCP may not be initialized — skip
    }

    // ── Build rules and memory context ──
    const userRules = memoryService.getStore().entries
      .filter((e: { type: string }) => e.type === 'fact')
      .map((e: { content: string }) => e.content)
      .join('\n')

    const relevantMemories = memoryService.getContextForQuery(userInput, 10)
    const memoryContext = relevantMemories.length > 0
      ? memoryService.formatContext(relevantMemories)
      : ''

    // Collect all events into a single result
    let fullContent = ''
    const toolResults: string[] = []

    return new Promise<{
      content: string | null
      error: string | null
      plan: unknown | null
      artifacts: unknown[]
    }>((resolve) => {
      sidecarService.startTurn(
        {
          turnId,
          conversationId: turnId,
          message: userInput,
          mode,
          tools: externalTools,
          userRules,
          memoryContext,
          expertId: expertId || '',
          contextResources: activeResources && activeResources.length > 0
            ? activeResources.map((r) => `${r.id} (${r.type}:${r.name})`).join(', ')
            : '',
        },
        (event) => {
          if (event.type === 'content_delta') {
            fullContent += (event.text || '')
          } else if (event.type === 'tool_use_start') {
            // tool calls are handled internally by the sidecar
          } else if (event.type === 'tool_use_end') {
            if (event.result) {
              toolResults.push(event.result)
            }
          } else if (event.type === 'message_final') {
            resolve({
              content: fullContent || event.content || null,
              error: null,
              plan: null,
              artifacts: [],
            })
          } else if (event.type === 'error') {
            resolve({
              content: null,
              error: event.message || 'Sidecar error',
              plan: null,
              artifacts: [],
            })
          }
        },
      ).catch((err) => {
        resolve({
          content: null,
          error: err instanceof Error ? err.message : String(err),
          plan: null,
          artifacts: [],
        })
      })
    })
  }

  // ---- Helper: process plan response (shared by backend proxy and local paths) ----
  async function _processPlanResponse(
    aiResponse: { type: 'plan' | 'chat'; summary?: string; steps?: Array<{ description: string; tool: string; params: Record<string, unknown> }>; content?: string },
    mode: AgentMode,
    userInput: string,
  ) {
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

    let content: string
    if (completedPlan.status === 'completed') {
      content = `## ✅ 任务完成 (${doneCount}/${totalCount} 步骤)\n\n${artifacts.map(a => `- 📄 **${a.name}** → \`${a.path}\``).join('\n')}`
    } else {
      const failed = completedPlan.steps.filter((s) => s.status === 'failed')
      content = `## ❌ 任务失败 — ${failed.map((s) => `步骤 ${s.index}: ${s.error}`).join('; ')}`
    }

    return { content, plan: completedPlan, artifacts, stepResults: [] }
  }

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
    const payload = {
      ...session,
      updatedAt: typeof session?.updatedAt === 'number' ? session.updatedAt : Date.now(),
    }
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
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
    const rows = files.map((f) => {
      const filePath = path.join(dir, f)
      const content = fs.readFileSync(filePath, 'utf-8')
      const session = JSON.parse(content)
      const mtime = fs.statSync(filePath).mtimeMs
      const updatedAt = typeof session.updatedAt === 'number' ? session.updatedAt : mtime
      return {
        id: session.id,
        title: session.title,
        date: session.date,
        workspace: session.workspace,
        updatedAt,
      }
    })
    // 最近使用置顶
    rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    return rows
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async (_event, id: string) => {
    const filePath = path.join(getSessionDir(), `${id}.json`)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    return { success: true }
  })

  // ============= Plugin Ecosystem IPC Handlers =============

  // ---- Auth / RBAC (auth-001) — actor from main session; ignore renderer userId ----
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, params: AuthLoginParams) => {
    return authService.login(params || { username: '', password: '' })
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    return authService.logout()
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_ME, async () => {
    // Portal / FastAPI 会话优先（飞书 SSO）；否则回落本地 Phase-1 auth-service
    try {
      const { resolveFastApiAuthMe } = await import('./fastapi-bridge')
      const remote = await resolveFastApiAuthMe()
      if (remote) return remote
    } catch {
      /* fall through */
    }
    return authService.me()
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_USERS_LIST, async (_event, params?: AuthUsersListParams) => {
    // Drop any renderer-supplied identity fields
    const { q } = params || {}
    return authService.listUsers({ q })
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_USERS_CREATE, async (_event, params: AuthUserCreateParams) => {
    return authService.createUser(params)
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_USERS_UPDATE, async (_event, userId: string, params: AuthUserUpdateParams) => {
    return authService.updateUser(userId, params || {})
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_USERS_DELETE, async (_event, userId: string) => {
    return authService.deleteUser(userId)
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_SWITCH_USER, async (_event, userId: string) => {
    // Phase 1 local simulation only — TODO: replace with real auth session
    return authService.switchUser(userId)
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_MEMBERS_FOR_SWITCH, async () => {
    return authService.listMembersForSwitch()
  })

  // ---- SOP library (agents-003) — inject session actor; discard payload userId ----
  // TODO: replace local sopService with FastAPI /api/skills when stable
  ipcMain.handle(IPC_CHANNELS.SOP_LIST, async (_event, params?: SopListParams) => {
    try {
      const actor = authService.requireActor()
      // Local ACL-filtered library only. Do NOT fall back to raw FastAPI
      // /api/enterprise/skills — different shape (skill_id/content/version:str) and
      // not actor-scoped; empty local filter previously dumped those rows into UI
      // and could white-screen the SOP tab.
      // TODO: replace with FastAPI /api/skills when it returns SopSkillSummary + actor ACL
      return sopService.list(actor, params)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'AUTH_REQUIRED') return { error: '请先登录', code: 'AUTH_REQUIRED', items: [] }
      throw e
    }
  })

  ipcMain.handle(IPC_CHANNELS.SOP_GET, async (_event, id: string) => {
    try {
      const actor = authService.requireActor()
      return sopService.get(actor, id)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'AUTH_REQUIRED') return { error: '请先登录', code: 'AUTH_REQUIRED' }
      throw e
    }
  })

  ipcMain.handle(IPC_CHANNELS.SOP_CREATE, async (_event, params?: SopCreateParams) => {
    try {
      const actor = authService.requireActor()
      // Strip any client-forged identity from create payload
      const { name, skillId, blank, businessDomain, description, contentJson } = params || { blank: true }
      return sopService.create(actor, { name, skillId, blank, businessDomain, description, contentJson })
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'AUTH_REQUIRED') return { error: '请先登录', code: 'AUTH_REQUIRED' }
      throw e
    }
  })

  ipcMain.handle(IPC_CHANNELS.SOP_UPDATE, async (_event, id: string, params: SopUpdateParams) => {
    try {
      const actor = authService.requireActor()
      return sopService.update(actor, id, params || {})
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'AUTH_REQUIRED') return { error: '请先登录', code: 'AUTH_REQUIRED' }
      throw e
    }
  })

  ipcMain.handle(IPC_CHANNELS.SOP_DELETE, async (_event, id: string) => {
    try {
      const actor = authService.requireActor()
      return sopService.delete(actor, id)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'AUTH_REQUIRED') return { error: '请先登录', code: 'AUTH_REQUIRED' }
      throw e
    }
  })

  ipcMain.handle(IPC_CHANNELS.SOP_PUBLISH, async (_event, id: string) => {
    try {
      const actor = authService.requireActor()
      return sopService.publish(actor, id)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'AUTH_REQUIRED') return { error: '请先登录', code: 'AUTH_REQUIRED' }
      throw e
    }
  })

  ipcMain.handle(IPC_CHANNELS.SOP_DRAFT, async (_event, id: string) => {
    try {
      const actor = authService.requireActor()
      return sopService.draft(actor, id)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'AUTH_REQUIRED') return { error: '请先登录', code: 'AUTH_REQUIRED' }
      throw e
    }
  })

  ipcMain.handle(IPC_CHANNELS.SOP_ARCHIVE, async (_event, id: string) => {
    try {
      const actor = authService.requireActor()
      return sopService.archive(actor, id)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'AUTH_REQUIRED') return { error: '请先登录', code: 'AUTH_REQUIRED' }
      throw e
    }
  })

  ipcMain.handle(IPC_CHANNELS.SOP_VERSIONS, async (_event, id: string) => {
    try {
      const actor = authService.requireActor()
      return sopService.versions(actor, id)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'AUTH_REQUIRED') return { error: '请先登录', code: 'AUTH_REQUIRED' }
      throw e
    }
  })

  ipcMain.handle(IPC_CHANNELS.SOP_ROLLBACK, async (_event, id: string, version: number) => {
    try {
      const actor = authService.requireActor()
      return sopService.rollback(actor, id, version)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'AUTH_REQUIRED') return { error: '请先登录', code: 'AUTH_REQUIRED' }
      throw e
    }
  })

  ipcMain.handle(IPC_CHANNELS.SOP_DELETE_VERSION, async (_event, id: string, version: number) => {
    try {
      const actor = authService.requireActor()
      return sopService.deleteVersion(actor, id, version)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'AUTH_REQUIRED') return { error: '请先登录', code: 'AUTH_REQUIRED' }
      throw e
    }
  })

  ipcMain.handle(IPC_CHANNELS.SOP_SQUARE_LIST, async (_event, q?: string) => {
    try {
      const actor = authService.requireActor()
      return { items: sopService.squareList(actor, q) }
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'AUTH_REQUIRED') return { error: '请先登录', code: 'AUTH_REQUIRED', items: [] }
      throw e
    }
  })

  ipcMain.handle(IPC_CHANNELS.SOP_CLONE_FROM_SQUARE, async (_event, sourceId: string) => {
    try {
      const actor = authService.requireActor()
      return sopService.cloneFromSquare(actor, sourceId)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'AUTH_REQUIRED') return { error: '请先登录', code: 'AUTH_REQUIRED' }
      throw e
    }
  })

  ipcMain.handle(IPC_CHANNELS.SOP_DISTILL, async (_event, payload: { text?: string }) => {
    try {
      authService.requireActor()
    } catch {
      return { error: '请先登录', code: 'AUTH_REQUIRED' }
    }
    const text = (payload?.text || '').trim()
    if (!text) return { error: '请输入要蒸馏的流程描述' }
    // TODO: replace with sop:distill/stream SSE → FastAPI pipeline
    return sopService.distillMock(text)
  })

  // ---- Knowledge ----
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_LIST, async () => {
    try {
      const rows = await fastApiFetch('GET', '/api/enterprise/knowledge-bases')
      if (Array.isArray(rows) && rows.length > 0) return rows
    } catch { /* fall through to mock */ }
    // TODO: replace with real API
    return MOCK_KNOWLEDGE_BASES
  })

  // ---- General Skills ----
  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_LIST, async () => {
    try {
      const rows = await fastApiFetch('GET', '/api/enterprise/general-skills')
      if (Array.isArray(rows) && rows.length > 0) return rows
    } catch { /* fall through to mock */ }
    // TODO: replace with real API
    return MOCK_GENERAL_SKILLS
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_STORE_LIST, async (_e, filters?: Record<string, unknown>) => {
    const qs = new URLSearchParams()
    if (filters?.q) qs.set('q', String(filters.q))
    if (filters?.source) qs.set('source', String(filters.source))
    if (filters?.category_id) qs.set('category_id', String(filters.category_id))
    if (filters?.sort) qs.set('sort', String(filters.sort))
    if (filters?.featured) qs.set('featured', 'true')
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return fastApiFetch('GET', `/api/enterprise/general-skills/store${suffix}`)
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_LEADERBOARD, async (_e, filters?: Record<string, unknown>) => {
    const qs = new URLSearchParams()
    if (filters?.metric) qs.set('metric', String(filters.metric))
    if (filters?.category_id) qs.set('category_id', String(filters.category_id))
    if (filters?.limit) qs.set('limit', String(filters.limit))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return fastApiFetch('GET', `/api/enterprise/general-skills/leaderboard${suffix}`)
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_CATEGORIES, async () => {
    return fastApiFetch('GET', '/api/enterprise/skill-categories')
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_LIBRARY_LIST, async () => {
    return fastApiFetch('GET', '/api/enterprise/general-skills/library/me')
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_LIBRARY_ADD, async (_e, slug: string) => {
    return fastApiFetch('POST', `/api/enterprise/general-skills/${encodeURIComponent(slug)}/library`)
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_LIBRARY_REMOVE, async (_e, slug: string) => {
    return fastApiFetch('DELETE', `/api/enterprise/general-skills/${encodeURIComponent(slug)}/library`)
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_INSTALL_PROMPT, async (_e, slug: string, platform = 'cursor') => {
    return fastApiFetch(
      'GET',
      `/api/enterprise/general-skills/${encodeURIComponent(slug)}/install-prompt?platform=${encodeURIComponent(platform)}`,
    )
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_REVISIONS, async (_e, slug: string) => {
    return fastApiFetch('GET', `/api/enterprise/general-skills/${encodeURIComponent(slug)}/revisions`)
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_ACCESS_REQUEST, async (_e, slug: string, body: { request_type: string; reason: string }) => {
    return fastApiFetch('POST', `/api/enterprise/general-skills/${encodeURIComponent(slug)}/access-requests`, body)
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_GET, async (_e, slug: string) => {
    return fastApiFetch('GET', `/api/enterprise/general-skills/${encodeURIComponent(slug)}`)
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_IMPORT_PACKAGE, async (_e, payload: {
    filename: string
    content_base64: string
    access_level?: string
    category_id?: string
    version?: string
    name?: string
    slug?: string
    description?: string
    status?: string
    changelog?: string
  }) => {
    try {
      return await fastApiFetch('POST', '/api/enterprise/general-skills/import-package', {
        filename: payload.filename,
        content_base64: payload.content_base64,
        access_level: payload.access_level || 'L1',
        category_id: payload.category_id || null,
        version: payload.version || '1.0.0',
        name: payload.name || null,
        slug: payload.slug || null,
        description: payload.description || null,
        status: payload.status || 'published',
        source: 'local',
        changelog: payload.changelog || null,
      })
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } }; message?: string }
      const detail = ax.response?.data?.detail
      return { error: typeof detail === 'string' ? detail : (ax.message || '导入失败') }
    }
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_IMPORT_URL, async (_e, payload: {
    source: string
    access_level?: string
    category_id?: string
    version?: string
    name?: string
    status?: string
  }) => {
    try {
      return await fastApiFetch('POST', '/api/enterprise/general-skills/import-skillhub', {
        source: payload.source,
        access_level: payload.access_level || 'L1',
        category_id: payload.category_id || null,
        version: payload.version || null,
        name: payload.name || null,
        status: payload.status || 'published',
      })
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } }; message?: string }
      const detail = ax.response?.data?.detail
      return { error: typeof detail === 'string' ? detail : (ax.message || '导入失败') }
    }
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_ACCESS_INBOX, async (_e, status = 'pending') => {
    return fastApiFetch('GET', `/api/enterprise/general-skills/access-requests/inbox?status=${encodeURIComponent(status)}`)
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_ACCESS_DECIDE, async (_e, slug: string, requestId: string, body: { decision: string; note?: string }) => {
    return fastApiFetch(
      'POST',
      `/api/enterprise/general-skills/${encodeURIComponent(slug)}/access-requests/${encodeURIComponent(requestId)}/decide`,
      body,
    )
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_STAR, async (_e, slug: string) => {
    return fastApiFetch('POST', `/api/enterprise/general-skills/${encodeURIComponent(slug)}/star`)
  })

  ipcMain.handle(IPC_CHANNELS.GENERAL_SKILL_CREATE_REVISION, async (_e, slug: string, body: { version: string; changelog: string; markdown?: string }) => {
    return fastApiFetch('POST', `/api/enterprise/general-skills/${encodeURIComponent(slug)}/revisions`, body)
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_SKILL_TOKEN_CREATE, async (_e, body?: { device_label?: string; ttl_hours?: number; purpose?: string }) => {
    return fastApiFetch('POST', '/api/enterprise/agent-tokens', body || { device_label: 'cursor', ttl_hours: 720 })
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_SKILL_TOKEN_LIST, async (_e, opts?: { purpose?: string }) => {
    const purpose = opts?.purpose?.trim()
    const path = purpose
      ? `/api/enterprise/agent-tokens?purpose=${encodeURIComponent(purpose)}`
      : '/api/enterprise/agent-tokens'
    return fastApiFetch('GET', path)
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_SKILL_TOKEN_REVOKE, async (_e, tokenId: string) => {
    return fastApiFetch('DELETE', `/api/enterprise/agent-tokens/${encodeURIComponent(tokenId)}`)
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_SKILL_TOKEN_DELETE, async (_e, tokenId: string) => {
    return fastApiFetch(
      'DELETE',
      `/api/enterprise/agent-tokens/${encodeURIComponent(tokenId)}?permanent=true`,
    )
  })

  ipcMain.handle(IPC_CHANNELS.A2A_ACCESS_BACKEND_ME, async () => {
    try {
      return await fastApiFetch('GET', '/api/auth/me')
    } catch (err) {
      return { error: err instanceof Error ? err.message : '无法获取后端用户' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.A2A_ACCESS_PROBE, async (_e, body?: { token?: string }) => {
    const baseUrl = getFastApiBaseUrl()
    if (!isFastApiReady()) {
      return { ok: false, baseUrl, error: '后端未就绪' }
    }
    const bearer = (body?.token || getToken() || '').trim()
    if (!bearer) {
      return { ok: false, baseUrl, error: '无可用 Token' }
    }
    try {
      const axios = (await import('axios')).default
      const res = await axios.get(`${baseUrl}/a2a/agents`, {
        headers: { Authorization: `Bearer ${bearer}` },
        timeout: 15000,
        validateStatus: () => true,
      })
      if (res.status !== 200) {
        return {
          ok: false,
          baseUrl,
          status: res.status,
          error: typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || res.statusText),
        }
      }
      const agents = Array.isArray(res.data?.agents) ? res.data.agents : Array.isArray(res.data) ? res.data : []
      const sampleUrls = agents
        .slice(0, 3)
        .map((a: { url?: string; name?: string }) => ({ name: a?.name, url: a?.url }))
      const mismatched = sampleUrls.some(
        (item: { url?: string }) => item.url && !String(item.url).startsWith(baseUrl),
      )
      return {
        ok: true,
        baseUrl,
        status: 200,
        agentCount: agents.length,
        sampleUrls,
        cardUrlMismatch: mismatched,
      }
    } catch (err) {
      return { ok: false, baseUrl, error: err instanceof Error ? err.message : '探测失败' }
    }
  })

  // ---- Policy (policy-001) ----
  ipcMain.handle(IPC_CHANNELS.POLICY_RULES_LIST, async () => {
    return fastApiFetch('GET', '/api/enterprise/policy/rules')
  })
  ipcMain.handle(IPC_CHANNELS.POLICY_RULES_CREATE, async (_e, body: Record<string, unknown>) => {
    return fastApiFetch('POST', '/api/enterprise/policy/rules', body)
  })
  ipcMain.handle(IPC_CHANNELS.POLICY_PACKS_LIST, async () => {
    return fastApiFetch('GET', '/api/enterprise/policy/packs')
  })
  ipcMain.handle(IPC_CHANNELS.POLICY_PACKS_CREATE, async (_e, body: Record<string, unknown>) => {
    return fastApiFetch('POST', '/api/enterprise/policy/packs', body)
  })
  ipcMain.handle(IPC_CHANNELS.POLICY_BINDINGS_LIST, async () => {
    return fastApiFetch('GET', '/api/enterprise/policy/bindings')
  })
  ipcMain.handle(IPC_CHANNELS.POLICY_BINDINGS_CREATE, async (_e, body: Record<string, unknown>) => {
    return fastApiFetch('POST', '/api/enterprise/policy/bindings', body)
  })
  ipcMain.handle(IPC_CHANNELS.POLICY_RESOLVED, async (_e, params?: {
    project_key?: string
    mode?: string
    expert_id?: string
  }) => {
    const qs = new URLSearchParams()
    if (params?.project_key) qs.set('project_key', params.project_key)
    if (params?.mode) qs.set('mode', params.mode)
    if (params?.expert_id) qs.set('expert_id', params.expert_id)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return fastApiFetch('GET', `/api/enterprise/policy/resolved${suffix}`)
  })

  // ---- Resource Sync Helper ----

  /**
   * Map local resourceType to backend AgentResourceType.
   * "skill" | "general_skill" | "knowledge_base" | "tool"
   */
  function toBackendResourceType(localType: string): string {
    switch (localType) {
      case 'sop': return 'skill'
      case 'mcp': return 'mcp'
      case 'knowledge': return 'knowledge_base'
      case 'general_skill': return 'general_skill'
      default: return localType
    }
  }

  /**
   * Sync agent resource bindings to FastAPI backend.
   * Fetches existing bindings, merges changes, and PUTs the full list.
   * Non-blocking: failures are logged but not thrown.
   */
  async function syncAgentBindingsToBackend(
    agentId: string,
    resourceType: string,
    resourceIds: string[],
    mode: 'add' | 'remove',
  ): Promise<void> {
    const backendType = toBackendResourceType(resourceType)
    const desiredSet = new Set(resourceIds)

    try {
      // 1. Get existing bindings from backend
      const existing = await fastApiFetch<Array<{ resource_type: string; resource_id: string; status: string }>>(
        'GET', `/api/enterprise/agents/${agentId}/resources`
      )

      // 2. Build merged list
      const merged: Array<{ resource_type: string; resource_id: string; status: string }> = []

      if (mode === 'add') {
        // Keep existing non-target-type bindings
        const otherTypes = existing.filter(r => r.resource_type !== backendType)
        merged.push(...otherTypes)

        // Merge target-type: keep existing + add new
        const existingTargetIds = new Set(
          existing.filter(r => r.resource_type === backendType).map(r => r.resource_id)
        )
        const typeList = existing
          .filter(r => r.resource_type === backendType)
          .map(r => ({ resource_type: r.resource_type, resource_id: r.resource_id, status: r.status }))

        // Rebuild: keep existing target-type bindings, add new ones
        const seen = new Set(typeList.map(r => r.resource_id))
        for (const rid of resourceIds) {
          if (!seen.has(rid)) {
            typeList.push({ resource_type: backendType, resource_id: rid, status: 'active' })
            seen.add(rid)
          }
        }
        merged.push(...typeList)
      } else {
        // mode === 'remove': filter out target resources
        merged.push(
          ...existing
            .filter(r => !(r.resource_type === backendType && desiredSet.has(r.resource_id)))
            .map(r => ({ resource_type: r.resource_type, resource_id: r.resource_id, status: r.status }))
        )
      }

      // 3. PUT full list
      await fastApiFetch('PUT', `/api/enterprise/agents/${agentId}/resources`, {
        resources: merged,
      })
    } catch (err) {
      // Silently skip — local bindings are the authority when backend is down
      if (process.env.NODE_ENV === 'development') {
        console.warn('[bindings-sync] Backend sync failed (non-blocking):', (err as Error).message)
      }
    }
  }

  // ---- Resource Import ----
  ipcMain.handle(IPC_CHANNELS.RESOURCE_IMPORT, async (_event, params: { targetAgentId: string; sourceAgentId: string; resourceType: string; resourceIds: string[] }) => {
    // 1. Local persist (always)
    const localResult = expertService.importResources(params)

    // 2. Try backend sync (non-blocking)
    try {
      if (params.resourceType === 'mcp') {
        // MCP: resourceIds are JSON strings like {"name":"...","url":"..."}
        // Convert to MCPServer IDs first, then sync
        const mcpIds: string[] = []
        for (const rawId of params.resourceIds) {
          try {
            const { name, url } = JSON.parse(rawId) as { name: string; url: string }
            const mcpSrv = await fastApiFetch<{ id: string; name: string }>(
              'POST', '/api/enterprise/mcp-servers', {
                name,
                connection: { transport: 'sse', url },
              }
            )
            mcpIds.push(mcpSrv.id)
          } catch {
            // Skip invalid JSON entries
          }
        }
        if (mcpIds.length > 0) {
          await syncAgentBindingsToBackend(params.targetAgentId, params.resourceType, mcpIds, 'add')
        }
      } else {
        await syncAgentBindingsToBackend(params.targetAgentId, params.resourceType, params.resourceIds, 'add')
      }
    } catch (err) {
      // Backend sync failure is non-blocking — local state is the fallback
      if (process.env.NODE_ENV === 'development') {
        console.warn('[bindings-sync] MCP import sync failed (non-blocking):', (err as Error).message)
      }
    }
    return localResult
  })

  ipcMain.handle(IPC_CHANNELS.RESOURCE_UNBIND, async (_event, params: { targetAgentId: string; resourceType: string; resourceIds: string[] }) => {
    // 1. Local remove (always)
    const localResult = expertService.unbindResources(params)

    // 2. Try backend sync (non-blocking)
    try {
      if (params.resourceType === 'mcp') {
        // MCP: resourceIds are JSON strings. Look up MCPServer IDs by name.
        const mcpIds: string[] = []
        for (const rawId of params.resourceIds) {
          try {
            const { name } = JSON.parse(rawId) as { name: string; url?: string }
            const escaped = encodeURIComponent(name)
            const list = await fastApiFetch<Array<{ id: string; name: string }>>(
              'GET', `/api/enterprise/mcp-servers?search=${escaped}`
            )
            const match = list.find((s: { name: string }) => s.name === name)
            if (match) mcpIds.push(match.id)
          } catch {
            // Skip invalid JSON entries
          }
        }
        if (mcpIds.length > 0) {
          await syncAgentBindingsToBackend(params.targetAgentId, params.resourceType, mcpIds, 'remove')
        }
      } else {
        await syncAgentBindingsToBackend(params.targetAgentId, params.resourceType, params.resourceIds, 'remove')
      }
    } catch {
      // Backend sync failure is non-blocking
    }
    return localResult
  })

  // ---- Skills ----
  ipcMain.handle(IPC_CHANNELS.SKILL_LIST, async () => {
    const actor = authService.getActor()
    return skillService.list(actor?.userId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_SEARCH, async (_event, query: string) => {
    const actor = authService.getActor()
    return skillService.search(query, actor?.userId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_INSTALL, async (_event, skillId: string) => {
    const actor = authService.getActor()
    return skillService.install(skillId, actor?.userId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_UNINSTALL, async (_event, skillId: string) => {
    const actor = authService.getActor()
    return skillService.uninstall(skillId, actor?.userId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_TOGGLE, async (_event, skillId: string, enabled: boolean) => {
    const actor = authService.getActor()
    return skillService.toggle(skillId, enabled, actor?.userId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_BATCH_UNINSTALL, async (_event, skillIds: string[]) => {
    const actor = authService.getActor()
    return skillService.batchUninstall(skillIds, actor?.userId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_CREATE, async (_event, description: string) => {
    const actor = authService.getActor()
    return skillService.create(description, actor?.userId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_UPLOAD, async (_event, filePath: string) => {
    const actor = authService.getActor()
    return skillService.uploadPackage(filePath, actor?.userId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_UPDATE, async (_event, skillId: string, params: Record<string, unknown>) => {
    const actor = authService.getActor()
    return skillService.update(skillId, params as Parameters<typeof skillService.update>[1], actor?.userId)
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

  function mergeBindingOverrides(experts: Expert[]): Expert[] {
    const overrides = expertService.getBindingOverrides() as Record<string, ExpertBindings>
    return (Array.isArray(experts) ? experts : []).map((e) => {
      if (!e?.id) return e
      const base = e.bindings || {
        sopSkills: [], skills: [], mcpServers: [], knowledgeBases: [], connectors: [],
      }
      const o = overrides[e.id]
      const bindings: ExpertBindings = {
        sopSkills: (o?.sopSkills ?? base.sopSkills) || [],
        skills: (o?.skills ?? base.skills) || [],
        mcpServers: (o?.mcpServers ?? base.mcpServers) || [],
        knowledgeBases: (o?.knowledgeBases ?? base.knowledgeBases) || [],
        connectors: (o?.connectors ?? base.connectors) || [],
        modelId: o?.modelId ?? base.modelId,
      }
      return { ...e, bindings }
    })
  }

  /** One-time migration: sync local binding-overrides.json mcpServers to backend */
  async function migrateLocalMcpToBackend(): Promise<void> {
    try {
      const overrides = expertService.getBindingOverrides() as Record<string, ExpertBindings>
      for (const [agentId, bindings] of Object.entries(overrides)) {
        if (!bindings?.mcpServers?.length) continue

        // Check if backend already has MCP bindings for this agent (skip if migrated)
        try {
          const existing = await fastApiFetch<Array<{ resource_type: string }>>(
            'GET', `/api/enterprise/agents/${agentId}/resources`
          )
          const hasMcp = existing.some(r => r.resource_type === 'mcp')
          if (hasMcp) continue
        } catch {
          // Backend unreachable, skip migration
          continue
        }

        for (const raw of bindings.mcpServers) {
          try {
            const { name, url } = JSON.parse(raw) as { name: string; url: string }
            if (!name || !url) continue
            // Create MCPServer if not exists (idempotent: POST + fallback to GET)
            let mcpId: string | undefined
            try {
              const created = await fastApiFetch<{ id: string }>(
                'POST', '/api/enterprise/mcp-servers', {
                  name,
                  connection: { transport: url.includes('/sse') ? 'sse' : 'streamable_http', url },
                }
              )
              mcpId = created.id
            } catch {
              // Server may already exist, look up by name
              try {
                const list = await fastApiFetch<Array<{ id: string; name: string }>>(
                  'GET', `/api/enterprise/mcp-servers?search=${encodeURIComponent(name)}`
                )
                const match = list.find((s: { name: string }) => s.name === name)
                if (match) mcpId = match.id
              } catch { /* lookup failed, skip this entry */ }
            }
            if (!mcpId) continue

            // Create binding
            await syncAgentBindingsToBackend(agentId, 'mcp', [mcpId], 'add')
          } catch {
            // Skip single entry failures
          }
        }
      }
    } catch {
      // Migration is non-blocking
    }
  }

  // ---- Expert (FastAPI backend proxy) ----
  ipcMain.handle(IPC_CHANNELS.EXPERT_LIST, async () => {
    try {
      const agents = await fastApiFetch('GET', '/api/chat/agents') as FastApiAgent[]
      if (Array.isArray(agents)) {
        // One-time MCP migration: sync local mcpServers to backend MCPServer + bindings
        await migrateLocalMcpToBackend()
        return mergeBindingOverrides(mapAgentsToExperts(agents))
      }
    } catch { /* fall through */ }
    return mergeBindingOverrides(expertService.list())
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_TEAM_LIST, async () => {
    // No FastAPI equivalent – fall back to local service
    return expertService.listTeams()
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_SUMMON, async (_event, expertId: string) => {
    // Try FastAPI first — experts shown in ExpertCenter may come from the backend
    try {
      const agent = await fastApiFetch('GET', `/api/enterprise/agents/${expertId}`) as {
        id: string; name: string; description?: string; persona_prompt?: string
        metadata?: { title?: string; methodology?: string; toolChain?: string[] }
      }
      if (agent?.id) {
        const title = agent.metadata?.title || agent.name
        const methodology = agent.metadata?.methodology || agent.description || ''
        const tools = agent.metadata?.toolChain || []
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        const welcomeMessage = `👋 你好！我是${title}「${agent.name}」。\n\n${methodology ? `我的专长：${methodology}\n` : ''}${tools.length > 0 ? `工具链：${tools.join('、')}\n` : ''}\n请描述你的任务，我将以专家身份为你提供专业支持。`
        return { success: true, expert: { id: expertId, name: agent.name, title, persona: agent.persona_prompt || '', methodology, toolChain: tools }, sessionId, welcomeMessage }
      }
    } catch {
      // FastAPI may not be available or endpoint missing — fall through to local
    }
    return expertService.summon(expertId)
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_TEAM_EXECUTE, async (_event, teamId: string, task: string) => {
    // No FastAPI equivalent – fall back to local service
    return expertService.startTeamExecution(teamId, task)
  })

  /**
   * Sync agent model binding to FastAPI backend.
   * Writes AgentModelBinding with role="default" for the given agent.
   */
  async function _syncModelBinding(agentId: string, expertModelCatalogId: string): Promise<void> {
    await fastApiFetch('PUT', `/api/enterprise/agents/${agentId}/models`, {
      bindings: [{ role: 'default', expert_model_catalog_id: expertModelCatalogId }],
    })
  }

  ipcMain.handle(IPC_CHANNELS.EXPERT_CREATE, async (_event, req: any) => {
    try {
      const result = await fastApiFetch('POST', '/api/enterprise/agents', mapExpertToAgentRequest(req)) as { id: string }
      if (req.bindings?.expertModelCatalogId && result?.id) {
        await _syncModelBinding(result.id, req.bindings.expertModelCatalogId)
      }
      return result
    } catch {
      return expertService.create(req)
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_UPDATE, async (_event, expert: Expert) => {
    try {
      const result = await fastApiFetch('PUT', `/api/enterprise/agents/${expert.id}`, mapExpertToAgentRequest(expert))
      if (expert.bindings?.expertModelCatalogId) {
        await _syncModelBinding(expert.id, expert.bindings.expertModelCatalogId)
      }
      return result
    } catch {
      return expertService.update(expert)
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_DELETE, async (_event, id: string) => {
    try {
      return await fastApiFetch('DELETE', `/api/enterprise/agents/${id}`)
    } catch {
      return expertService.delete(id)
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_TOGGLE_STATUS, async (_event, id: string, status: any) => {
    try {
      return await fastApiFetch('PUT', `/api/enterprise/agents/${id}`, { status })
    } catch {
      return expertService.toggleStatus(id, status)
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_TOGGLE_OVERALL, async (_event, id: string, isOverall: boolean) => {
    try {
      return await fastApiFetch('PUT', `/api/enterprise/agents/${id}`, { is_overall: isOverall })
    } catch {
      return expertService.toggleOverall(id, isOverall)
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_SQUARE_LIST, async () => {
    try {
      return await fastApiFetch('GET', '/api/chat/agents?is_overall=true')
    } catch {
      return expertService.squareList()
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_CLONE, async (_event, sourceId: string) => {
    try {
      return await fastApiFetch('POST', `/api/chat/agents/${sourceId}/clone`)
    } catch {
      return expertService.clone(sourceId)
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_TEST_RUN, async (_event, params: any) => {
    // No FastAPI equivalent – fall back to local service
    return expertService.testRun(params)
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_AUTH_TOKEN, async () => {
    return getToken()
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_FASTAPI_STATUS, async () => {
    return probeAndBroadcastFastApiStatus()
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

  ipcMain.handle(IPC_CHANNELS.MEMORY_EXTRACT, async (_event, conversations: { messages: { role: string; content: string }[]; title?: string }[]) => {
    return memoryService.extractFromConversations(conversations)
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

  // ============= Model Config IPC Handlers (企业后台) =============

  ipcMain.handle(IPC_CHANNELS.MODEL_CONFIG_LIST, async () => {
    try {
      return await fastApiFetch('GET', '/api/enterprise/model-configs')
    } catch {
      // Backend unavailable — return empty list; ModelSelector falls back to AVAILABLE_MODELS
      return []
    }
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_CONFIG_PROTOCOLS, async () => {
    return fastApiFetch('GET', '/api/enterprise/model-configs/protocols')
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_CONFIG_CREATE, async (_event, params: Record<string, unknown>) => {
    return fastApiFetch('POST', '/api/enterprise/model-configs', params)
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_CONFIG_UPDATE, async (_event, configId: string, params: Record<string, unknown>) => {
    return fastApiFetch('PUT', `/api/enterprise/model-configs/${configId}`, params)
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_CONFIG_SET_DEFAULT, async (_event, configId: string) => {
    return fastApiFetch('POST', `/api/enterprise/model-configs/${configId}/set-default`)
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_CONFIG_TEST, async (_event, configId: string, activateIfInitial?: boolean) => {
    const url = `/api/enterprise/model-configs/${configId}/test`
    const sep = '?'
    const qs = activateIfInitial ? `${sep}activate_if_initial=true` : ''
    return fastApiFetch('POST', `${url}${qs}`)
  })

  // ============= Local-only model config handlers (仅本机保存) =============

  ipcMain.handle(IPC_CHANNELS.MODEL_CONFIG_LOCAL_LIST, async () => {
    return listLocal()
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_CONFIG_LOCAL_SAVE, async (_event, config: Omit<LocalModelConfig, 'created_at' | 'updated_at'>) => {
    return saveLocal(config)
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_CONFIG_LOCAL_UPDATE, async (_event, configId: string, patch: Record<string, unknown>) => {
    return updateLocal(configId, patch as any)
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_CONFIG_LOCAL_DELETE, async (_event, configId: string) => {
    return deleteLocal(configId)
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_CONFIG_LOCAL_TEST, async (_event, configId: string) => {
    const localCfg = getLocal(configId)
    if (!localCfg) return { success: false, message: '本地模型配置不存在', output: null }
    try {
      const aiService = new AIService({
        apiKey: localCfg.api_key,
        baseUrl: localCfg.base_url,
        model: localCfg.model,
      })
      const tools = toolRegistry.toFunctionDefinitions()
      const result = await aiService.plan('你是一个连接测试助手。请用一句中文回复连接成功。', tools)
      const output = typeof result.content === 'string' ? result.content : JSON.stringify(result)
      return { success: true, message: '连接成功', output }
    } catch (err: any) {
      return { success: false, message: err?.message || String(err), output: null }
    }
  })

  // ── Expert Model Catalog ───────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.EXPERT_MODEL_CATALOG_LIST, async () => {
    try {
      return await fastApiFetch('GET', '/api/enterprise/expert-model-catalog') as unknown[]
    } catch {
      return []
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_MODEL_CATALOG_CREATE, async (_event, params: Record<string, unknown>) => {
    try {
      return await fastApiFetch('POST', '/api/enterprise/expert-model-catalog', params)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || String(err)
      throw new Error(`创建失败: ${msg}`)
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_MODEL_CATALOG_UPDATE, async (_event, id: string, params: Record<string, unknown>) => {
    try {
      return await fastApiFetch('PUT', `/api/enterprise/expert-model-catalog/${id}`, params)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || String(err)
      throw new Error(`更新失败: ${msg}`)
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_MODEL_CATALOG_DELETE, async (_event, id: string) => {
    try {
      return await fastApiFetch('DELETE', `/api/enterprise/expert-model-catalog/${id}`)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || String(err)
      throw new Error(`删除失败: ${msg}`)
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXPERT_MODEL_CATALOG_TEST, async (_event, id: string) => {
    try {
      return await fastApiFetch('POST', `/api/enterprise/expert-model-catalog/${id}/test`)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || String(err)
      throw new Error(`测试失败: ${msg}`)
    }
  })
}
