/** StaffDeck-style agent scope: which expert the resource pages operate on */

export const EXPERT_SCOPE_STORAGE_KEY = 'bspbuddy_expert_scope'
export const EXPERT_SCOPE_CHANGE_EVENT = 'bspbuddy-expert-scope-change'

export function getExpertScopeId(): string {
  try {
    return window.localStorage.getItem(EXPERT_SCOPE_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function setExpertScopeId(agentId: string): void {
  try {
    if (agentId) window.localStorage.setItem(EXPERT_SCOPE_STORAGE_KEY, agentId)
    else window.localStorage.removeItem(EXPERT_SCOPE_STORAGE_KEY)
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EXPERT_SCOPE_CHANGE_EVENT, { detail: { agentId } }))
}
