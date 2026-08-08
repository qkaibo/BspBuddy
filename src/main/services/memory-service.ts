// ============================================================
// Memory service — manages user memories, extraction, context injection
// ============================================================

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import type { MemoryEntry, MemoryStore, MemoryType, ConversationSummary } from '../../lib/memory-types'

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'memory')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getStorePath(): string {
  return path.join(getDataDir(), 'memory-store.json')
}

function loadStore(): MemoryStore {
  const p = getStorePath()
  if (!fs.existsSync(p)) {
    return { entries: [], lastExtractedAt: 0, enabled: true }
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as MemoryStore
  } catch {
    return { entries: [], lastExtractedAt: 0, enabled: true }
  }
}

function saveStore(store: MemoryStore): void {
  const dir = getDataDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2), 'utf-8')
}

function getSessionDir(): string {
  return path.join(app.getPath('userData'), 'sessions')
}

// ---------- Simple content-based similarity scoring ----------
function relevanceScore(entry: MemoryEntry, query: string): number {
  const lowerContent = entry.content.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const tokens = lowerQuery.split(/\s+/).filter((t) => t.length > 0)
  if (tokens.length === 0) return 0

  let score = 0
  for (const token of tokens) {
    if (lowerContent.includes(token)) score += 1
  }
  // Normalize by token count, then boost by confidence
  return (score / tokens.length) * entry.confidence
}

export const memoryService = {
  /** Get the full memory store */
  getStore(): MemoryStore {
    return loadStore()
  },

  /** List all memory entries */
  list(): MemoryEntry[] {
    return loadStore().entries
  },

  /** Add a single memory entry */
  addEntry(entry: MemoryEntry): void {
    const store = loadStore()
    store.entries.push(entry)
    saveStore(store)
  },

  /** Delete a memory entry by ID */
  deleteEntry(id: string): boolean {
    const store = loadStore()
    const idx = store.entries.findIndex((e) => e.id === id)
    if (idx < 0) return false
    store.entries.splice(idx, 1)
    saveStore(store)
    return true
  },

  /** Clear all memory entries */
  clearAll(): void {
    const store = loadStore()
    store.entries = []
    store.lastExtractedAt = 0
    saveStore(store)
  },

  /** Enable or disable memory extraction */
  setEnabled(enabled: boolean): void {
    const store = loadStore()
    store.enabled = enabled
    saveStore(store)
  },

  /** Check if memory is enabled */
  isEnabled(): boolean {
    return loadStore().enabled
  },

  // ==================== Extraction ====================

  /**
   * Extract memories from conversation history.
   * This simulates AI-powered extraction using pattern matching.
   * In production, this would call an LLM - but per SPEC, it's free (no credits).
   */
  extractFromConversations(
    conversations: { messages: { role: string; content: string }[]; title?: string }[],
  ): MemoryEntry[] {
    const store = loadStore()
    if (!store.enabled) return []

    const newEntries: MemoryEntry[] = []

    for (const conv of conversations) {
      const allText = conv.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n')

      const source = conv.title || conv.messages[0]?.content?.slice(0, 40) || '未知会话'

      // Pattern: "我是..." → fact
      const factMatches = allText.matchAll(/我是[^\n。，,]{2,30}/g)
      for (const m of factMatches) {
        const content = m[0]
        const exists = store.entries.some(
          (e) => e.type === 'fact' && e.content === content,
        )
        if (!exists) {
          newEntries.push({
            id: uuid(),
            type: 'fact',
            content,
            source,
            confidence: 0.8,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
        }
      }

      // Pattern: "我喜欢/希望/偏好/习惯" → preference
      const prefMatches = allText.matchAll(/(?:我(?:喜欢|希望|偏好|习惯|常用))[^\n。，,]{2,40}/g)
      for (const m of prefMatches) {
        const content = m[0]
        const exists = store.entries.some(
          (e) => e.type === 'preference' && e.content === content,
        )
        if (!exists) {
          newEntries.push({
            id: uuid(),
            type: 'preference',
            content,
            source,
            confidence: 0.7,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
        }
      }

      // Pattern: "XX是我的..." → relationship
      const relMatches = allText.matchAll(/([^\n，,。]{2,20}(?:是|为)(?:我的|我)[^\n，,。]{2,30})/g)
      for (const m of relMatches) {
        const content = m[0]
        const exists = store.entries.some(
          (e) => e.type === 'relationship' && e.content === content,
        )
        if (!exists) {
          newEntries.push({
            id: uuid(),
            type: 'relationship',
            content,
            source,
            confidence: 0.75,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
        }
      }

      // Pattern: "最近在/正在做/处理" → follow_up
      const followMatches = allText.matchAll(
        /(?:最近(?:在|正在|忙着)|目前(?:在|正在))[^\n。，,]{2,50}/g,
      )
      for (const m of followMatches) {
        const content = m[0]
        const exists = store.entries.some(
          (e) => e.type === 'follow_up' && e.content === content,
        )
        if (!exists) {
          newEntries.push({
            id: uuid(),
            type: 'follow_up',
            content,
            source,
            confidence: 0.65,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
        }
      }
    }

    // Save new entries to store
    if (newEntries.length > 0) {
      const updated = loadStore()
      updated.entries.push(...newEntries)
      updated.lastExtractedAt = Date.now()
      saveStore(updated)
    }

    return newEntries
  },

  // ==================== Context injection ====================

  /**
   * Get relevant memory entries for a user query.
   * Returns top-N relevant entries sorted by relevance score.
   */
  getContextForQuery(query: string, limit = 10): MemoryEntry[] {
    const store = loadStore()
    if (!store.enabled || store.entries.length === 0) return []

    const scored = store.entries
      .map((entry) => ({ entry, score: relevanceScore(entry, query) }))
      .filter(({ score }) => score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return scored.map(({ entry }) => entry)
  },

  /**
   * Format memory entries as a system context string.
   */
  formatContext(entries: MemoryEntry[]): string {
    if (entries.length === 0) return ''

    const typeLabel: Record<string, string> = {
      fact: '事实',
      preference: '偏好',
      relationship: '关系',
      follow_up: '跟进',
    }

    const lines = entries.map(
      (e) => `  - [${typeLabel[e.type] || e.type}] ${e.content}`,
    )
    return `## 用户记忆（参考背景信息）\n${lines.join('\n')}`
  },

  // ==================== Edit (conversational) ====================

  /**
   * Edit memories through conversational instructions.
   * Supports patterns like:
   * - "记住XXX" → add fact
   * - "忘记XXX" → remove matching entries
   * - "我喜欢XXX" → add preference
   * - "XX是我的XX" → add relationship
   */
  editInstruction(instruction: string): { action: string; entries?: MemoryEntry[]; removed?: number } {
    const store = loadStore()

    // "忘记XXX"
    const forgetMatch = instruction.match(/忘记(.+)/)
    if (forgetMatch) {
      const keyword = forgetMatch[1].trim()
      const before = store.entries.length
      store.entries = store.entries.filter(
        (e) => !e.content.includes(keyword),
      )
      const removed = before - store.entries.length
      saveStore(store)
      return { action: 'forget', removed }
    }

    // "记住XXX"
    const rememberMatch = instruction.match(/^记住(.+)/)
    if (rememberMatch) {
      const content = rememberMatch[1].trim()
      const type = detectMemoryType(content)
      const entry: MemoryEntry = {
        id: uuid(),
        type,
        content,
        source: '用户手动添加',
        confidence: 1.0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      store.entries.push(entry)
      saveStore(store)
      return { action: 'remember', entries: [entry] }
    }

    // "我喜欢/希望/偏好/习惯XXX"
    const prefAutoMatch = instruction.match(/^(我喜欢|我希望|我偏好|我习惯)/)
    if (prefAutoMatch) {
      const entry: MemoryEntry = {
        id: uuid(),
        type: 'preference',
        content: instruction,
        source: '用户手动添加',
        confidence: 1.0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      store.entries.push(entry)
      saveStore(store)
      return { action: 'remember', entries: [entry] }
    }

    // "XX是我的XX" → relationship
    const relAutoMatch = instruction.match(/^\S{1,20}(?:是|为)我的/)
    if (relAutoMatch) {
      const entry: MemoryEntry = {
        id: uuid(),
        type: 'relationship',
        content: instruction,
        source: '用户手动添加',
        confidence: 1.0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      store.entries.push(entry)
      saveStore(store)
      return { action: 'remember', entries: [entry] }
    }

    // "最近在XXX" → follow_up
    const followAutoMatch = instruction.match(/^(?:最近|目前)(?:在|正在|忙着)/)
    if (followAutoMatch) {
      const entry: MemoryEntry = {
        id: uuid(),
        type: 'follow_up',
        content: instruction,
        source: '用户手动添加',
        confidence: 1.0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      store.entries.push(entry)
      saveStore(store)
      return { action: 'remember', entries: [entry] }
    }

    // Default: treat as fact
    const entry: MemoryEntry = {
      id: uuid(),
      type: 'fact',
      content: instruction,
      source: '用户手动添加',
      confidence: 0.9,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    store.entries.push(entry)
    saveStore(store)
    return { action: 'remember', entries: [entry] }
  },

  // ==================== Import from external AI ====================

  /**
   * Import memories from an external AI output (pasted text).
   * Parses structured text and creates memory entries.
   */
  importFromExternal(content: string): MemoryEntry[] {
    const store = loadStore()
    const newEntries: MemoryEntry[] = []
    const source = '外部导入'

    // Try JSON format first
    const trimmed = content.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        const items = Array.isArray(parsed) ? parsed : [parsed]

        for (const item of items) {
          if (typeof item === 'string') {
            newEntries.push({
              id: uuid(),
              type: detectMemoryType(item),
              content: item,
              source,
              confidence: 0.8,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            })
          } else if (item && typeof item === 'object') {
            const text = item.content || item.text || item.memory || ''
            if (text) {
              newEntries.push({
                id: uuid(),
                type: normalizeMemoryType(item.type || detectMemoryType(text)),
                content: text,
                source: source,
                confidence: item.confidence || 0.8,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              })
            }
          }
        }
      } catch {
        // Fall through to line-by-line parsing
      }
    }

    // If JSON parsing yielded nothing, parse line by line
    if (newEntries.length === 0) {
      const lines = trimmed
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)

      for (const line of lines) {
        // Skip bullet markers and numbers
        const cleaned = line.replace(/^[\s\-*•\d]+[.\s]*/, '').trim()
        if (cleaned.length < 3) continue

        newEntries.push({
          id: uuid(),
          type: detectMemoryType(cleaned),
          content: cleaned,
          source,
          confidence: 0.6,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }
    }

    if (newEntries.length > 0) {
      store.entries.push(...newEntries)
      saveStore(store)
    }

    return newEntries
  },

  // ==================== Session history search ====================

  /**
   * Search session history for conversations matching a query.
   * Searches through saved session JSON files.
   */
  searchSessionHistory(query: string): ConversationSummary[] {
    const sessionDir = getSessionDir()
    if (!fs.existsSync(sessionDir)) return []

    const files = fs.readdirSync(sessionDir).filter((f) => f.endsWith('.json'))
    const results: ConversationSummary[] = []
    const lowerQuery = query.toLowerCase()

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(sessionDir, file), 'utf-8')
        const session = JSON.parse(raw) as {
          id: string
          title?: string
          date?: string
          workspace?: string
          messages?: { role: string; content: string }[]
        }

        const allText = (session.messages || [])
          .map((m) => m.content)
          .join(' ')
          .toLowerCase()

        if (
          allText.includes(lowerQuery) ||
          (session.title && session.title.toLowerCase().includes(lowerQuery))
        ) {
          const userMessages = (session.messages || []).filter((m) => m.role === 'user')
          const snippet =
            userMessages.length > 0
              ? userMessages[0].content.slice(0, 100) + (userMessages[0].content.length > 100 ? '...' : '')
              : ''

          results.push({
            id: session.id,
            title: session.title || '未命名会话',
            date: session.date || '未知',
            snippet,
            workspace: session.workspace,
          })
        }
      } catch {
        // Skip corrupted files
      }
    }

    return results.slice(0, 20)
  },

  // ==================== Utility ====================

  /**
   * Get the import prompt template for users to paste into other AI products.
   */
  getImportPrompt(): string {
    return `请根据以下对话历史，提取关于我的个人信息，按类型分类：

类型说明：
- fact: 事实信息（如职业、公司、所在地等）
- preference: 偏好习惯（如喜欢的输出格式、常用工具等）
- relationship: 人物关系（如"XX 是我的老板"）
- follow_up: 近期跟进事项（如"最近在处理 XX 项目"）

请以 JSON 格式输出，每条记忆包含 type 和 content 字段：
[
  {"type": "fact", "content": "我是一名软件工程师"},
  {"type": "preference", "content": "我喜欢用简洁的代码风格"},
  ...
]`
  },
}

// ---------- Helpers ----------

function detectMemoryType(text: string): MemoryType {
  if (/^(我(?:喜欢|希望|偏好|习惯|常用))/.test(text)) return 'preference'
  if (
    /^(?:最近|目前)(?:在|正在|忙着)/.test(text) ||
    /跟进|处理中|待办/.test(text)
  )
    return 'follow_up'
  if (/(?:是|为)(?:我的|我)/.test(text)) return 'relationship'
  if (/^我是/.test(text)) return 'fact'
  return 'fact'
}

function normalizeMemoryType(raw: string): MemoryType {
  const valid: MemoryType[] = ['fact', 'preference', 'relationship', 'follow_up']
  const normalized = raw.toLowerCase().trim()
  if (valid.includes(normalized as MemoryType)) return normalized as MemoryType

  const mapping: Record<string, MemoryType> = {
    fact: 'fact',
    facts: 'fact',
    preference: 'preference',
    preferences: 'preference',
    pref: 'preference',
    relationship: 'relationship',
    relations: 'relationship',
    follow_up: 'follow_up',
    'follow-up': 'follow_up',
    followup: 'follow_up',
    todo: 'follow_up',
  }
  return mapping[normalized] || detectMemoryType(raw)
}
