import { useState, useCallback, useRef, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import type { Message, MessageTraceStep, TaskPlan, Artifact, AgentMode } from '../lib/types'
import { AVAILABLE_MODELS } from '../lib/types'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'

const ipc = createIpcClient()

function upsertTraceStep(steps: MessageTraceStep[], step: MessageTraceStep): MessageTraceStep[] {
  const idx = steps.findIndex((s) => {
    if (s.id === step.id) return true
    // Same visible line from live + summary / dual planner events.
    if (s.kind === step.kind && s.label === step.label) return true
    if (
      s.kind !== 'status' && step.kind !== 'status'
      && s.kind === step.kind
      && s.tool_name && step.tool_name && s.tool_name === step.tool_name
    ) return true
    if (
      s.kind === 'mcp' && step.kind === 'mcp'
      && s.status === 'unavailable' && step.status === 'unavailable'
      && s.tool_name && step.tool_name && s.tool_name === step.tool_name
    ) return true
    return false
  })
  if (idx < 0) return [...steps, step]
  const next = steps.slice()
  const prev = next[idx]
  // Prefer newer label (often includes duration) and keep max durationMs.
  const durationMs = [prev.durationMs, step.durationMs]
    .filter((v): v is number => typeof v === 'number' && v >= 0)
    .reduce((a, b) => Math.max(a, b), -1)
  next[idx] = {
    ...prev,
    ...step,
    id: prev.id || step.id,
    label: step.label || prev.label,
    ...(durationMs >= 0 ? { durationMs } : {}),
  }
  return next
}

export function useAgent() {
  const [messages, setMessages] = useState<Message[]>([])
  const [activePlan, setActivePlan] = useState<TaskPlan | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [mode, setMode] = useState<AgentMode>('craft')
  const [modelId, setModelId] = useState<string>(AVAILABLE_MODELS[0].id)
  const listenerRef = useRef<((...args: unknown[]) => void) | null>(null)
  const streamListenerRef = useRef<((...args: unknown[]) => void) | null>(null)
  const streamMessageIdRef = useRef<string | null>(null)
  const streamSawDeltaRef = useRef(false)

  useEffect(() => {
    const handler = (payload: unknown) => {
      const { planId, stepId, status, result, error } = payload as {
        planId: string; stepId: string; status: string; result?: unknown; error?: string
      }
      setActivePlan((prev) => {
        if (!prev || prev.id !== planId) return prev
        const newStatus = status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : status as any
        return {
          ...prev,
          status: newStatus === 'completed' || newStatus === 'failed' ? newStatus : prev.status,
          steps: prev.steps.map((s) =>
            s.id === stepId
              ? { ...s, status: status as any, result: result as any, error }
              : s,
          ),
        }
      })
    }
    ipc.on(IPC_CHANNELS.TASK_PROGRESS, handler)
    listenerRef.current = handler
    return () => { if (listenerRef.current) ipc.off(IPC_CHANNELS.TASK_PROGRESS, listenerRef.current) }
  }, [])

  useEffect(() => {
    const handler = (payload: unknown) => {
      const event = payload as {
        messageId?: string
        kind?: 'status' | 'delta' | 'replace' | 'error' | 'trace' | 'trace_summary'
        content?: string
        phase?: string
        step?: MessageTraceStep
        mcpCalled?: boolean
        mcpUnavailable?: boolean
        mcpUnavailableDetail?: string
        steps?: MessageTraceStep[]
      }
      if (!event.messageId) return
      // Accept events for the active stream, or late replace/delta for the same
      // assistant bubble after streamMessageIdRef is cleared in finally.
      const isActiveStream = event.messageId === streamMessageIdRef.current
      const content = typeof event.content === 'string' ? event.content : ''
      if (!isActiveStream && event.kind !== 'replace' && event.kind !== 'delta') return
      if (!isActiveStream && !(content || '').trim()) return

      if (event.kind === 'trace' && event.step) {
        if (!isActiveStream) return
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== event.messageId) return m
            const steps = upsertTraceStep(m.trace?.steps || [], event.step as MessageTraceStep)
            const mcpCalled = steps.some((s) => s.kind === 'mcp' && s.status !== 'unavailable')
              ? true
              : m.trace?.mcpCalled ?? null
            const mcpUnavailable = Boolean(
              event.mcpUnavailable
              || steps.some((s) => s.status === 'unavailable' && s.kind === 'mcp')
              || m.trace?.mcpUnavailable,
            )
            return {
              ...m,
              trace: {
                ...m.trace,
                viaA2A: true,
                expertName: m.trace?.expertName,
                mcpCalled,
                mcpUnavailable,
                mcpUnavailableDetail: event.mcpUnavailableDetail || m.trace?.mcpUnavailableDetail,
                steps,
              },
            }
          }),
        )
        return
      }

      if (event.kind === 'trace_summary') {
        if (!isActiveStream) return
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== event.messageId) return m
            const incoming = event.steps || []
            let steps = m.trace?.steps || []
            for (const step of incoming) steps = upsertTraceStep(steps, step)
            return {
              ...m,
              trace: {
                ...m.trace,
                viaA2A: true,
                expertName: m.trace?.expertName,
                mcpCalled: typeof event.mcpCalled === 'boolean'
                  ? event.mcpCalled
                  : steps.some((s) => s.kind === 'mcp' && s.status !== 'unavailable'),
                mcpUnavailable: typeof event.mcpUnavailable === 'boolean'
                  ? event.mcpUnavailable
                  : (m.trace?.mcpUnavailable || steps.some((s) => s.kind === 'mcp' && s.status === 'unavailable')),
                mcpUnavailableDetail: event.mcpUnavailableDetail || m.trace?.mcpUnavailableDetail,
                steps,
              },
            }
          }),
        )
        return
      }

      if (event.kind === 'delta' && content) {
        const hadDelta = streamSawDeltaRef.current
        streamSawDeltaRef.current = true
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== event.messageId) return m
            const base = hadDelta ? (m.content || '') : ''
            return { ...m, content: `${base}${content}` }
          }),
        )
        return
      }
      if (event.kind === 'replace' && content) {
        streamSawDeltaRef.current = true
        setMessages((prev) =>
          prev.map((m) =>
            m.id === event.messageId ? { ...m, content } : m,
          ),
        )
        return
      }
      if (event.kind === 'status' && content) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== event.messageId) return m
            const statusStep: MessageTraceStep = {
              id: `status:${event.phase || content}`,
              label: content,
              kind: 'status',
              status: event.phase || 'status',
            }
            const steps = upsertTraceStep(m.trace?.steps || [], statusStep)
            return {
              ...m,
              // Keep content empty until deltas; status lives in trace.
              content: streamSawDeltaRef.current ? m.content : m.content,
              trace: {
                ...m.trace,
                viaA2A: true,
                expertName: m.trace?.expertName,
                mcpCalled: m.trace?.mcpCalled ?? null,
                steps,
              },
            }
          }),
        )
        return
      }
      if (event.kind === 'error' && content) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === event.messageId
              ? { ...m, content: `Error: ${content}` }
              : m,
          ),
        )
      }
    }
    ipc.on(IPC_CHANNELS.A2A_CHAT_STREAM, handler)
    streamListenerRef.current = handler
    return () => {
      if (streamListenerRef.current) {
        ipc.off(IPC_CHANNELS.A2A_CHAT_STREAM, streamListenerRef.current)
      }
    }
  }, [])

  const sendMessage = useCallback(async (
    content: string,
    modelId?: string,
    expertId?: string,
    expertInfo?: { name: string; title: string; methodology: string; toolChain: string[]; persona: string },
    activeResources?: { id: string; type: string; name: string }[],
  ): Promise<{
    artifacts?: Artifact[]
  }> => {
    const userMsg: Message = { id: uuid(), role: 'user', content, timestamp: Date.now() }
    const assistantId = uuid()
    const isExpertChat = Boolean(expertId)
    const expertName = expertInfo?.title || expertInfo?.name || activeResources?.find((r) => r.type === 'expert' && r.id === expertId)?.name
    streamMessageIdRef.current = isExpertChat ? assistantId : null
    streamSawDeltaRef.current = false
    setMessages((prev) => [
      ...prev,
      userMsg,
      ...(isExpertChat
        ? [{
            id: assistantId,
            role: 'assistant' as const,
            content: '',
            timestamp: Date.now(),
            trace: {
              viaA2A: true,
              expertName,
              mcpCalled: null,
              steps: [{ id: 'status:queued', label: '正在委托专家…', kind: 'status' as const, status: 'queued' }],
            },
          }]
        : []),
    ])
    setIsProcessing(true)

    try {
      const response = (await ipc.invoke(IPC_CHANNELS.EXECUTE_TASK, content, mode, modelId, {
        expertId,
        expertInfo,
        activeResources,
        streamMessageId: isExpertChat ? assistantId : undefined,
        expertName,
      })) as {
        plan?: TaskPlan
        content?: string
        artifacts?: Artifact[]
        error?: string
        awaitingConfirm?: boolean
        trace?: Message['trace']
      }

      if (response.plan) setActivePlan(response.plan)

      if (isExpertChat) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const fromServer = typeof response.content === 'string' ? response.content.trim() : ''
            const fromStream = (m.content || '').trim()
            // Never clobber a streamed/server reply with the legacy "Done." fallback.
            const finalContent = fromServer || fromStream || (
              response.error ? `Error: ${response.error}` : '（未收到专家正文，请重试）'
            )
            return {
              ...m,
              content: finalContent,
              plan: response.plan,
              artifacts: response.artifacts,
              timestamp: Date.now(),
              trace: {
                viaA2A: true,
                expertName: m.trace?.expertName || expertName,
                mcpCalled: response.trace?.mcpCalled ?? m.trace?.mcpCalled ?? false,
                mcpUnavailable: response.trace?.mcpUnavailable ?? m.trace?.mcpUnavailable,
                mcpUnavailableDetail: response.trace?.mcpUnavailableDetail ?? m.trace?.mcpUnavailableDetail,
                steps: response.trace?.steps?.length
                  ? response.trace.steps
                  : (m.trace?.steps || []),
              },
            }
          }),
        )
      } else {
        const finalContent = response.content
          ?? (response.error ? `Error: ${response.error}` : 'Done.')
        const assistantMsg: Message = {
          id: assistantId,
          role: 'assistant',
          content: finalContent,
          plan: response.plan,
          artifacts: response.artifacts,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, assistantMsg])
      }

      return { artifacts: response.artifacts }
    } catch (err) {
      const errText = `Failed: ${err instanceof Error ? err.message : String(err)}`
      if (isExpertChat) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, role: 'system', content: errText, timestamp: Date.now() }
              : m,
          ),
        )
      } else {
        const errMsg: Message = {
          id: uuid(), role: 'system',
          content: errText,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, errMsg])
      }
      return {}
    } finally {
      setIsProcessing(false)
      // Keep stream id briefly so a late replace from finish()/fallback still lands.
      const endingId = streamMessageIdRef.current
      setTimeout(() => {
        if (streamMessageIdRef.current === endingId) {
          streamMessageIdRef.current = null
          streamSawDeltaRef.current = false
        }
      }, 1500)
    }
  }, [mode])

  const stopAgent = useCallback(async () => {
    await ipc.invoke(IPC_CHANNELS.AGENT_STOP)
    setIsProcessing(false)
    setActivePlan(null)
  }, [])

  return { messages, setMessages, activePlan, isProcessing, mode, setMode, modelId, setModelId, sendMessage, stopAgent, setActivePlan }
}
