import { useState, useCallback, useEffect, useRef } from 'react'
import type { PermissionMode, PermissionAction, PermissionRequest } from '../lib/types'
import { IPC_CHANNELS } from '../lib/types'
import { createIpcClient } from '../lib/client'

const ipc = createIpcClient()

export function usePermission() {
  const [mode, setMode] = useState<PermissionMode>('default')
  const [pendingRequest, setPendingRequest] = useState<PermissionRequest | null>(null)
  const listenerRef = useRef<((...args: unknown[]) => void) | null>(null)

  useEffect(() => {
    const handler = (payload: unknown) => {
      const request = payload as PermissionRequest
      setPendingRequest(request)
    }
    ipc.on(IPC_CHANNELS.PERMISSION_REQUEST, handler)
    listenerRef.current = handler
    return () => {
      if (listenerRef.current) {
        ipc.off(IPC_CHANNELS.PERMISSION_REQUEST, listenerRef.current)
      }
    }
  }, [])

  const changeMode = useCallback(async (newMode: PermissionMode) => {
    setMode(newMode)
    await ipc.invoke(IPC_CHANNELS.PERMISSION_MODE_CHANGE, newMode)
  }, [])

  const respondToRequest = useCallback(async (requestId: string, action: PermissionAction) => {
    await ipc.invoke(IPC_CHANNELS.PERMISSION_RESPONSE, requestId, action)
    setPendingRequest(null)
  }, [])

  const dismissRequest = useCallback(() => {
    if (pendingRequest) {
      ipc.invoke(IPC_CHANNELS.PERMISSION_RESPONSE, pendingRequest.id, 'deny' as PermissionAction)
      setPendingRequest(null)
    }
  }, [pendingRequest])

  return {
    mode,
    changeMode,
    pendingRequest,
    respondToRequest,
    dismissRequest,
  }
}
