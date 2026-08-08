// ============================================================
// Memory system types for BspBuddy
// ============================================================

export type MemoryType = 'fact' | 'preference' | 'relationship' | 'follow_up'

export interface MemoryEntry {
  id: string
  type: MemoryType
  content: string
  source: string
  confidence: number
  createdAt: number
  updatedAt: number
}

export interface MemoryStore {
  entries: MemoryEntry[]
  lastExtractedAt: number
  enabled: boolean
}

export interface ConversationSummary {
  id: string
  title: string
  date: string
  snippet: string
  workspace?: string
}

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  fact: '事实',
  preference: '偏好',
  relationship: '关系',
  follow_up: '跟进',
}

export const MEMORY_TYPE_COLORS: Record<MemoryType, string> = {
  fact: '#3b82f6',
  preference: '#8b5cf6',
  relationship: '#ec4899',
  follow_up: '#f59e0b',
}
