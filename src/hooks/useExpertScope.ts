import { useCallback, useEffect, useState } from 'react'
import {
  EXPERT_SCOPE_CHANGE_EVENT,
  getExpertScopeId,
  setExpertScopeId,
} from '../lib/expert-scope'

/** Current expert/agent scope for resource pages (StaffDeck agent-scope). */
export function useExpertScope() {
  const [scopeId, setScopeIdState] = useState(() => getExpertScopeId())

  useEffect(() => {
    function onChange(e: Event) {
      const detail = (e as CustomEvent<{ agentId?: string }>).detail
      setScopeIdState(detail?.agentId || getExpertScopeId())
    }
    window.addEventListener(EXPERT_SCOPE_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(EXPERT_SCOPE_CHANGE_EVENT, onChange)
  }, [])

  const setScopeId = useCallback((id: string) => {
    setExpertScopeId(id)
    setScopeIdState(id)
  }, [])

  return { scopeId, setScopeId }
}
