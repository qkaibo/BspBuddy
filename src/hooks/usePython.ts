import { useState, useCallback, useEffect } from 'react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'

interface PythonStatus {
  available: boolean
  version?: string
  packages?: string[]
  error?: string
}

const ipc = createIpcClient()

export function usePython() {
  const [status, setStatus] = useState<PythonStatus>({ available: false })
  const [checking, setChecking] = useState(false)

  const checkPython = useCallback(async () => {
    setChecking(true)
    try {
      const result = await ipc.invoke(IPC_CHANNELS.PYTHON_STATUS) as PythonStatus
      setStatus(result)
    } catch {
      setStatus({ available: false, error: 'Python not detected' })
    } finally {
      setChecking(false)
    }
  }, [])

  const execPython = useCallback(async (
    code: string,
    params: Record<string, unknown>,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    try {
      const result = await ipc.invoke(IPC_CHANNELS.PYTHON_EXEC, code, params)
      return result as { success: boolean; data?: unknown; error?: string }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }, [])

  useEffect(() => {
    checkPython()
  }, [checkPython])

  return { status, checking, checkPython, execPython }
}
