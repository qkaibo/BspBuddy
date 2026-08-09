import { useState, useEffect, useCallback } from 'react'
import {
  Brain, Search, Plus, Trash2, ToggleLeft, ToggleRight,
  Download, Upload, MessageSquare, Edit3, X, Copy, Check,
} from 'lucide-react'
import { createIpcClient } from '../lib/client'
import type { MemoryEntry, MemoryType, ConversationSummary } from '../lib/memory-types'
import { MEMORY_TYPE_LABELS, MEMORY_TYPE_COLORS } from '../lib/memory-types'
import { ConfirmDialog } from './ConfirmDialog'
import { panelRootStyle } from '../lib/panel-layout'

const ipc = createIpcClient()

const IPC = {
  MEMORY_LIST: 'memory:list',
  MEMORY_ADD: 'memory:add',
  MEMORY_EDIT: 'memory:edit',
  MEMORY_DELETE: 'memory:delete',
  MEMORY_CLEAR: 'memory:clear',
  MEMORY_IMPORT: 'memory:import',
  MEMORY_TOGGLE: 'memory:toggle',
  MEMORY_STATUS: 'memory:status',
  MEMORY_SEARCH_HISTORY: 'memory:search:history',
  MEMORY_IMPORT_PROMPT: 'memory:import-prompt',
}

interface Props {
  onClose: () => void
}

type MemoryTypeFilter = 'all' | MemoryType

export function MemoryPanel({ onClose }: Props) {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [enabled, setEnabled] = useState(true)
  const [filter, setFilter] = useState<MemoryTypeFilter>('all')
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editInput, setEditInput] = useState('')
  const [editResult, setEditResult] = useState<string | null>(null)
  const [showImportFlow, setShowImportFlow] = useState(false)
  const [importStep, setImportStep] = useState<'prompt' | 'paste' | 'done'>('prompt')
  const [importPrompt, setImportPrompt] = useState('')
  const [importPastedContent, setImportPastedContent] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ConversationSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadEntries()
    loadStatus()
  }, [])

  async function loadEntries() {
    const list = (await ipc.invoke(IPC.MEMORY_LIST)) as MemoryEntry[]
    setEntries(list)
  }

  async function loadStatus() {
    const status = (await ipc.invoke(IPC.MEMORY_STATUS)) as { enabled: boolean }
    setEnabled(status.enabled)
  }

  async function handleToggle() {
    const newEnabled = !enabled
    await ipc.invoke(IPC.MEMORY_TOGGLE, newEnabled)
    setEnabled(newEnabled)
    setToast(newEnabled ? '记忆功能已开启' : '记忆功能已关闭')
    setTimeout(() => setToast(null), 2000)
  }

  async function handleDelete(id: string) {
    await ipc.invoke(IPC.MEMORY_DELETE, id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  async function handleClearAll() {
    if (!confirm('确定要清空所有记忆吗？此操作不可撤销。')) return
    await ipc.invoke(IPC.MEMORY_CLEAR)
    setEntries([])
    setToast('所有记忆已清空')
    setTimeout(() => setToast(null), 2000)
  }

  // ---- Edit dialog (conversational) ----
  function openEditDialog() {
    setEditInput('')
    setEditResult(null)
    setShowEditDialog(true)
  }

  async function handleEditSubmit() {
    if (!editInput.trim()) return
    const result = (await ipc.invoke(IPC.MEMORY_EDIT, editInput)) as {
      action: string
      entries?: MemoryEntry[]
      removed?: number
    }
    if (result.action === 'forget') {
      setEditResult(`已删除 ${result.removed} 条相关记忆`)
    } else if (result.entries && result.entries.length > 0) {
      setEditResult(`已记住：${result.entries.map((e) => e.content).join('；')}`)
    }
    setEditInput('')
    loadEntries()
  }

  // ---- Import flow ----
  async function openImportFlow() {
    setShowImportFlow(true)
    setImportStep('prompt')
    setCopiedPrompt(false)
    const prompt = (await ipc.invoke(IPC.MEMORY_IMPORT_PROMPT)) as string
    setImportPrompt(prompt)
  }

  function copyPrompt() {
    navigator.clipboard.writeText(importPrompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  async function handleImport() {
    if (!importPastedContent.trim()) return
    const imported = (await ipc.invoke(IPC.MEMORY_IMPORT, importPastedContent)) as MemoryEntry[]
    setImportStep('done')
    loadEntries()
    setToast(`成功导入 ${imported.length} 条记忆`)
    setTimeout(() => setToast(null), 2000)
  }

  function closeImportFlow() {
    setShowImportFlow(false)
    setImportStep('prompt')
    setImportPastedContent('')
  }

  // ---- Search session history ----
  async function handleSearchHistory() {
    if (!searchQuery.trim()) return
    setSearching(true)
    const results = (await ipc.invoke(IPC.MEMORY_SEARCH_HISTORY, searchQuery)) as ConversationSummary[]
    setSearchResults(results)
    setSearching(false)
  }

  // ---- Edit dialog ----
  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditSubmit()
    }
  }

  const filteredEntries =
    filter === 'all' ? entries : entries.filter((e) => e.type === filter)

  return (
    <div style={panelRootStyle()}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={18} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>记忆</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Toggle */}
          <button
            type="button"
            onClick={handleToggle}
            style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', color: enabled ? 'var(--success)' : 'var(--text-tertiary)' }}
            title={enabled ? '关闭记忆功能' : '开启记忆功能'}
            aria-label={enabled ? '关闭记忆功能' : '开启记忆功能'}
            aria-pressed={enabled}
          >
            {enabled ? <ToggleRight size={20} aria-hidden="true" /> : <ToggleLeft size={20} aria-hidden="true" />}
          </button>
          <button type="button" onClick={onClose} aria-label="关闭记忆面板" style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>×</button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          onClick={openEditDialog}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <Edit3 size={11} /> 编辑
        </button>
        <button
          onClick={openImportFlow}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <Download size={11} /> 导入
        </button>
        <button
          onClick={handleClearAll}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <Trash2 size={11} /> 清空
        </button>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
          {entries.length} 条记忆
        </span>
      </div>

      {/* Type filter tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        {(['all', 'fact', 'preference', 'relationship', 'follow_up'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              flex: 1, padding: '6px 0', border: 'none', borderBottom: filter === tab ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
              color: filter === tab ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: filter === tab ? 600 : 400,
            }}
          >
            {tab === 'all' ? '全部' : MEMORY_TYPE_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Edit dialog overlay */}
      {showEditDialog && (
        <div
          role="dialog"
          aria-modal="true"
          data-overlay="true"
          style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overscrollBehavior: 'contain',
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 20, width: '85%', maxWidth: 420,
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
            overscrollBehavior: 'contain',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={14} color="var(--accent)" aria-hidden="true" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>对话式编辑</span>
              </div>
              <button type="button" onClick={() => setShowEditDialog(false)} aria-label="关闭编辑" style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
              输入指令告诉我记住或忘记什么：<br />
              例如：「记住我是前端开发」「我喜欢用 TypeScript」「忘记旧项目"
            </div>
            <textarea
              value={editInput}
              onChange={(e) => setEditInput(e.target.value)}
              onKeyDown={handleEditKeyDown}
              placeholder="输入指令…"
              rows={3}
              autoFocus
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                fontSize: 12, fontFamily: 'inherit', resize: 'vertical', color: 'var(--text-primary)',
                background: 'var(--bg-input)', marginBottom: 10, boxSizing: 'border-box',
              }}
            />
            {editResult && (
              <div style={{ fontSize: 11, color: 'var(--success)', marginBottom: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--success-bg)' }}>
                {editResult}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleEditSubmit}
                disabled={!editInput.trim()}
                style={{
                  flex: 1, padding: '7px 14px', borderRadius: 6, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer',
                  fontFamily: 'inherit', opacity: editInput.trim() ? 1 : 0.5,
                }}
              >
                提交
              </button>
              <button
                onClick={() => setShowEditDialog(false)}
                style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import flow overlay */}
      {showImportFlow && (
        <div
          role="dialog"
          aria-modal="true"
          data-overlay="true"
          style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overscrollBehavior: 'contain',
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 20, width: '90%', maxWidth: 480,
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
            overscrollBehavior: 'contain',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={14} color="var(--accent)" aria-hidden="true" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>导入记忆</span>
              </div>
              <button type="button" onClick={closeImportFlow} aria-label="关闭导入" style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Step indicators */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {(['prompt', 'paste', 'done'] as const).map((step, i) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: importStep === step ? 'var(--accent)' : importStep > step || importStep === 'done' ? 'var(--success)' : 'var(--bg-hover)',
                    color: importStep === step || importStep > step || importStep === 'done' ? '#fff' : 'var(--text-tertiary)',
                    fontSize: 10, fontWeight: 600, flexShrink: 0,
                  }}>
                    {importStep > step || importStep === 'done' ? <Check size={10} /> : i + 1}
                  </div>
                  {i < 2 && <div style={{ flex: 1, height: 1, background: importStep > step || importStep === 'done' ? 'var(--success)' : 'var(--border)' }} />}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12, fontSize: 10, color: 'var(--text-tertiary)', justifyContent: 'space-around' }}>
              <span style={{ color: importStep === 'prompt' ? 'var(--accent)' : undefined }}>复制提示词</span>
              <span style={{ color: importStep === 'paste' ? 'var(--accent)' : undefined }}>粘贴结果</span>
              <span style={{ color: importStep === 'done' ? 'var(--success)' : undefined }}>完成导入</span>
            </div>

            {importStep === 'prompt' && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  将此提示词复制到其他 AI 产品的对话中，获取关于你的个人信息。
                </div>
                <div style={{
                  padding: 10, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-input)', fontSize: 11, color: 'var(--text-primary)',
                  maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', marginBottom: 10,
                  fontFamily: 'monospace', lineHeight: 1.5,
                }}>
                  {importPrompt}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={copyPrompt}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      padding: '7px 14px', borderRadius: 6, border: 'none',
                      background: copiedPrompt ? 'var(--success)' : 'var(--accent)',
                      color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {copiedPrompt ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制提示词</>}
                  </button>
                  <button
                    onClick={() => setImportStep('paste')}
                    style={{
                      padding: '7px 18px', borderRadius: 6, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text-secondary)', fontSize: 12,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    下一步
                  </button>
                </div>
              </>
            )}

            {importStep === 'paste' && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  将其他 AI 产品返回的结果粘贴到下方：
                </div>
                <textarea
                  value={importPastedContent}
                  onChange={(e) => setImportPastedContent(e.target.value)}
                  placeholder="粘贴其他 AI 返回的 JSON 或文本…"
                  rows={8}
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    fontSize: 12, fontFamily: 'monospace', resize: 'vertical', color: 'var(--text-primary)',
                    background: 'var(--bg-input)', marginBottom: 10, boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleImport}
                    disabled={!importPastedContent.trim()}
                    style={{
                      flex: 1, padding: '7px 14px', borderRadius: 6, border: 'none',
                      background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer',
                      fontFamily: 'inherit', opacity: importPastedContent.trim() ? 1 : 0.5,
                    }}
                  >
                    添加到记忆
                  </button>
                  <button
                    onClick={() => setImportStep('prompt')}
                    style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    上一步
                  </button>
                </div>
              </>
            )}

            {importStep === 'done' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', background: 'var(--success-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
                }}>
                  <Check size={24} color="var(--success)" />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>导入完成</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  记忆已成功添加到你的记忆库中
                </div>
                <button
                  onClick={closeImportFlow}
                  style={{ padding: '7px 20px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  关闭
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search session history */}
      <div style={{ padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-input)', borderRadius: 6, padding: '6px 10px', flex: 1 }}>
            <Search size={12} color="var(--text-tertiary)" aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchHistory()}
              name="memory-search"
              aria-label="搜索会话历史"
              placeholder="搜索会话历史（如：上周做过什么）…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit' }}
            />
          </div>
          <button
            onClick={handleSearchHistory}
            disabled={!searchQuery.trim()}
            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', opacity: searchQuery.trim() ? 1 : 0.5, whiteSpace: 'nowrap' }}
          >
            搜索
          </button>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {/* Search results */}
        {searchResults.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              搜索结果 ({searchResults.length})
            </div>
            {searchResults.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)',
                  marginBottom: 6, border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <MessageSquare size={12} color="var(--text-tertiary)" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
                  {item.workspace && (
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{item.workspace}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.snippet}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{item.date}</div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!enabled && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
            <Brain size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>记忆功能已关闭</div>
            <div style={{ fontSize: 10, marginTop: 4 }}>开启后将自动从会话中提取记忆</div>
          </div>
        )}

        {enabled && filteredEntries.length === 0 && searchResults.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
            <Brain size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>暂无记忆</div>
            <div style={{ fontSize: 10, marginTop: 4 }}>
              {filter !== 'all' ? `没有"${MEMORY_TYPE_LABELS[filter]}"类型的记忆` : '开始对话后，BspBuddy 将自动提取关于你的记忆'}
            </div>
          </div>
        )}

        {/* Memory entry list */}
        {enabled &&
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8,
                background: 'var(--bg-card)', marginBottom: 6, border: '1px solid var(--border)',
              }}
            >
              {/* Type badge */}
              <span
                style={{
                  display: 'inline-block', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                  background: `${MEMORY_TYPE_COLORS[entry.type]}20`,
                  color: MEMORY_TYPE_COLORS[entry.type],
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {MEMORY_TYPE_LABELS[entry.type]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{entry.content}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    来源: {entry.source.slice(0, 30)}
                    {entry.source.length > 30 ? '…' : ''}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    置信度: {Math.round(entry.confidence * 100)}%
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(entry.id)}
                style={{
                  padding: 2, background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', flexShrink: 0,
                }}
                title="删除"
                aria-label="删除记忆"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 16px', borderRadius: 8, background: 'var(--text-primary)', color: '#fff',
          fontSize: 12, boxShadow: 'var(--shadow-lg)', zIndex: 100,
        }}>
          {toast}
        </div>
      )}
      {confirmDeleteId && (
        <ConfirmDialog
          title="确认删除记忆"
          message="删除后该条记忆将不可恢复，确定要删除吗？"
          onConfirm={() => {
            const id = confirmDeleteId
            setConfirmDeleteId(null)
            void handleDelete(id)
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
