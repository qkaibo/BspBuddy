import { useCallback } from 'react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Message, TaskPlan } from '../lib/types'

export interface SessionData {
  id: string
  title: string
  date: string
  updatedAt?: number
  messages: Message[]
  plan: TaskPlan | null
  workspace?: string
  mode?: string
  modelId?: string
  expertContext?: { expert?: { id: string; name: string; title?: string; methodology?: string; toolChain?: string[]; persona?: string; bindings?: { modelId?: string } }; sessionId?: string }
  activeResources?: { id: string; type: string; name: string }[]
}

const ipc = createIpcClient()

export function useSession() {
  const saveSession = useCallback(async (
    id: string,
    title: string,
    messages: Message[],
    plan: TaskPlan | null,
    workspace?: string,
    mode?: string,
    modelId?: string,
    expertContext?: SessionData['expertContext'],
    activeResources?: SessionData['activeResources'],
  ) => {
    const session: SessionData = {
      id,
      title,
      date: new Date().toLocaleDateString(),
      updatedAt: Date.now(),
      messages,
      plan,
      workspace,
      mode,
      modelId,
      expertContext,
      activeResources,
    }
    try {
      await ipc.invoke(IPC_CHANNELS.SESSION_SAVE, session)
    } catch (err) {
      console.error('Failed to save session:', err)
    }
  }, [])

  const loadSession = useCallback(async (id: string): Promise<SessionData | null> => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.SESSION_LOAD, id)
      return result as SessionData
    } catch (err) {
      console.error('Failed to load session:', err)
      return null
    }
  }, [])

  const listSessions = useCallback(async (): Promise<SessionData[]> => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.SESSION_LIST)
      return (result as SessionData[]) || []
    } catch (err) {
      console.error('Failed to list sessions:', err)
      return []
    }
  }, [])

  const deleteSession = useCallback(async (id: string): Promise<void> => {
    try {
      await ipc.invoke(IPC_CHANNELS.SESSION_DELETE, id)
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }, [])

  return { saveSession, loadSession, listSessions, deleteSession }
}
