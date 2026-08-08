import { useState, useCallback, useRef, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import type { Message, TaskPlan, Artifact, AgentMode, ModelOption } from '../lib/types'
import { AVAILABLE_MODELS } from '../lib/types'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'

const ipc = createIpcClient()

export function useAgent() {
  const [messages, setMessages] = useState<Message[]>([])
  const [activePlan, setActivePlan] = useState<TaskPlan | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [mode, setMode] = useState<AgentMode>('craft')
  const [modelId, setModelId] = useState<string>(AVAILABLE_MODELS[0].id)
  const listenerRef = useRef<((...args: unknown[]) => void) | null>(null)

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

  const sendMessage = useCallback(async (
    content: string,
    context?: { currentFile?: string; openFiles?: string[] },
  ): Promise<{
    artifacts?: Artifact[]
  }> => {
    const userMsg: Message = { id: uuid(), role: 'user', content, timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setIsProcessing(true)

    try {
      const response = (await ipc.invoke(IPC_CHANNELS.EXECUTE_TASK, content, mode, context)) as {
        plan?: TaskPlan
        content?: string
        artifacts?: Artifact[]
        error?: string
        awaitingConfirm?: boolean
      }

      if (response.plan) setActivePlan(response.plan)

      const assistantMsg: Message = {
        id: uuid(),
        role: 'assistant',
        content: response.content ?? (response.error ? `Error: ${response.error}` : 'Done.'),
        plan: response.plan,
        artifacts: response.artifacts,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMsg])

      return { artifacts: response.artifacts }
    } catch (err) {
      const errMsg: Message = {
        id: uuid(), role: 'system',
        content: `Failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errMsg])
      return {}
    } finally {
      setIsProcessing(false)
    }
  }, [mode])

  const stopAgent = useCallback(async () => {
    await ipc.invoke(IPC_CHANNELS.AGENT_STOP)
    setIsProcessing(false)
    setActivePlan(null)
  }, [])

  return { messages, setMessages, activePlan, isProcessing, mode, setMode, modelId, setModelId, sendMessage, stopAgent, setActivePlan }
}
