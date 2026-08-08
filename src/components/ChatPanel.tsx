import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Send, Loader2, Sparkles, Square, FolderOpen, Search as SearchIcon, X, Share2, Clock } from 'lucide-react'
import { ModeSwitch } from './ModeSwitch'
import { ModelSelector } from './ModelSelector'
import { UploadZone } from './UploadZone'
import { Timeline } from './Timeline'
import { PermissionSelector } from './PermissionSelector'
import { PermissionConfirmModal } from './PermissionConfirmModal'
import { usePermission } from '../hooks/usePermission'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { UploadedFile } from './UploadZone'
import type { Message, TaskPlan, Artifact, AgentMode, ModelOption } from '../lib/types'

interface SlashCommand {
  name: string
  description: string
  template: string
}

const ipc = createIpcClient()

interface Props {
  messages: Message[]
  activePlan: TaskPlan | null
  isProcessing: boolean
  mode: AgentMode
  workspacePath?: string
  modelId: string
  onModeChange: (mode: AgentMode) => void
  onModelChange: (model: ModelOption) => void
  onSend: (text: string) => void
  onStop: () => void
  onSelectWorkspace: () => void
}

export function ChatPanel({ messages, activePlan, isProcessing, mode, workspacePath, modelId, onModeChange, onModelChange, onSend, onStop, onSelectWorkspace }: Props) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [inputText, setInputText] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Slash command state
  const [slashCommands, setSlashCommands] = useState<SlashCommand[]>([])
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { mode: permMode, changeMode: onChangePermMode, pendingRequest, respondToRequest, dismissRequest } = usePermission()

  // Extract slash query from input text (e.g., "/周" → "周")
  const slashQuery = useMemo(() => {
    const text = inputText
    const cursorPos = textareaRef.current?.selectionStart ?? text.length
    // Only activate slash at start or after whitespace
    const beforeCursor = text.slice(0, cursorPos)
    const lastSlash = beforeCursor.lastIndexOf('/')
    if (lastSlash === -1) return null
    if (lastSlash > 0 && beforeCursor[lastSlash - 1] !== ' ' && beforeCursor[lastSlash - 1] !== '\n') return null
    const afterSlash = beforeCursor.slice(lastSlash + 1)
    // If there's a space after the slash, it's not a slash command
    if (/\s/.test(afterSlash)) return null
    return afterSlash
  }, [inputText])

  // Filtered commands based on slash query
  const filteredCommands = useMemo(() => {
    if (!slashQuery) return []
    return slashCommands.filter((c) => c.name.includes(slashQuery))
  }, [slashQuery, slashCommands])

  // Fetch slash commands when slash is detected
  useEffect(() => {
    if (slashQuery !== null) {
      if (slashCommands.length === 0) {
        ipc.invoke(IPC_CHANNELS.SLASH_COMMAND_LIST).then((cmds) => {
          setSlashCommands(cmds as SlashCommand[])
        })
      }
      setSlashOpen(true)
      setSlashIndex(0)
    } else {
      setSlashOpen(false)
      setSlashIndex(0)
    }
  }, [slashQuery !== null, slashCommands.length])

  const selectSlashCommand = useCallback((cmd: SlashCommand) => {
    const text = inputText
    const cursorPos = textareaRef.current?.selectionStart ?? text.length
    const beforeCursor = text.slice(0, cursorPos)
    const lastSlash = beforeCursor.lastIndexOf('/')
    const before = text.slice(0, lastSlash)
    // Place the template after the text, with {content} as highlighted placeholder
    const placeholder = cmd.template
    setInputText(before + placeholder)
    setSlashOpen(false)
    // Focus back on textarea and place cursor at the first {content}
    setTimeout(() => {
      if (textareaRef.current) {
        const idx = before.length + placeholder.indexOf('{content}')
        const newPos = idx >= 0 ? idx : before.length + placeholder.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newPos, newPos + 9) // "{content}" length
      }
    }, 0)
  }, [inputText])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slashOpen && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashIndex((prev) => (prev + 1) % filteredCommands.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        selectSlashCommand(filteredCommands[slashIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSlashOpen(false)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (inputText.trim()) {
        const text = uploadedFiles.length > 0
          ? inputText.trim() + '\n\n[Attached files: ' + uploadedFiles.map(f => f.name).join(', ') + ']'
          : inputText.trim()
        onSend(text)
        setInputText('')
        setUploadedFiles([])
      }
    }
  }

  const sendMessage = () => {
    if (inputText.trim()) {
      const text = uploadedFiles.length > 0
        ? inputText.trim() + '\n\n[Attached files: ' + uploadedFiles.map(f => f.name).join(', ') + ']'
        : inputText.trim()
      onSend(text)
      setInputText('')
      setUploadedFiles([])
    }
  }

  const handleAddFiles = (files: UploadedFile[]) => {
    setUploadedFiles((prev) => [...prev, ...files])
  }

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const doneCount = activePlan?.steps.filter(s => s.status === 'completed').length ?? 0
  const totalCount = activePlan?.steps.length ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Search bar */}
        {searchOpen && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', marginBottom: 12,
            background: 'var(--bg-input)', borderRadius: 6, border: '1px solid var(--accent)',
          }}>
            <SearchIcon size={13} color="var(--accent)" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in conversation..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit',
              }}
            />
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-secondary)' }}
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Timeline */}
        {activePlan && (
          <div style={{ marginBottom: 16 }}>
            <Timeline plan={activePlan} />
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className="animate-fade-in" style={{ marginBottom: 20 }}>
            {msg.role === 'user' ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ maxWidth: '80%', padding: '10px 16px', borderRadius: 'var(--radius-lg)', borderBottomRightRadius: 4, background: 'var(--accent)', color: '#fff', fontSize: 14, lineHeight: 1.5 }}>{msg.content}</div>
              </div>
            ) : msg.role === 'assistant' ? (
              <div>
                {msg.plan && msg.plan.steps.length > 0 && (
                  <div style={{ background: 'var(--accent-light)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 10, border: '1px solid rgba(79,110,247,.12)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Sparkles size={13} color="#4f6ef7" />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#4f6ef7' }}>Task Plan</span>
                    </div>
                    {msg.plan.steps.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                        <StepDot status={s.status} /><span>{s.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                {msg.content && (
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)', padding: '10px 16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', borderBottomLeftRadius: 4, border: '1px solid var(--border)', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                )}
              </div>
            ) : null}
          </div>
        ))}
        {isProcessing && !activePlan && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 13 }}><Loader2 size={13} style={{ animation: 'spin 2s linear infinite' }} />Thinking...</div>}
        {activePlan && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: 16, border: '1px solid var(--border)', marginTop: 8, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Progress</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{doneCount}/{totalCount}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', borderRadius: 2, width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`, background: activePlan.status === 'failed' ? 'var(--danger)' : activePlan.status === 'completed' ? 'var(--success)' : 'var(--accent)', transition: 'width .5s ease' }} />
            </div>
            {activePlan.steps.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                <StepDot status={s.status} /><span style={{ flex: 1 }}>{s.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ModeSwitch mode={mode} onChange={onModeChange} />
          <ModelSelector selectedId={modelId} onChange={onModelChange} />
        </div>

        {/* Permission selector — below mode/model row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <PermissionSelector mode={permMode} onChange={onChangePermMode} />
        </div>

        {/* Upload zone + input area */}
        <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-lg)', padding: '6px 12px', border: '1px solid transparent', marginTop: 8, position: 'relative' }}>
          <UploadZone
            files={uploadedFiles}
            onAdd={handleAddFiles}
            onRemove={handleRemoveFile}
            workspacePath={workspacePath}
            onSelectWorkspace={onSelectWorkspace}
          />

          {/* Slash command dropdown */}
          {slashOpen && filteredCommands.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0,
              marginBottom: 4,
              background: 'var(--bg-card)', borderRadius: 8,
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
              zIndex: 100, padding: '4px 0', maxHeight: 200, overflowY: 'auto',
            }}>
              {filteredCommands.map((cmd, idx) => (
                <button
                  key={cmd.name}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectSlashCommand(cmd)
                  }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 14px', border: 'none',
                    background: idx === slashIndex ? 'var(--bg-hover)' : 'none',
                    cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                    color: 'var(--text-primary)', textAlign: 'left' as const,
                  }}
                  onMouseEnter={() => setSlashIndex(idx)}
                >
                  <span style={{ fontWeight: 600, color: 'var(--accent)', minWidth: 48 }}>{cmd.name}</span>
                  <span style={{ color: 'var(--text-tertiary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cmd.description}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={mode === 'ask' ? 'Ask a question...' : mode === 'plan' ? 'Describe your task, I\'ll make a plan...' : 'Describe your task, I\'ll execute it...'}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isProcessing}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 14, fontFamily: 'inherit', color: 'var(--text-primary)', padding: '4px 0', lineHeight: 1.5 }}
            />
            {isProcessing ? (
              <button onClick={onStop} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--danger)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Square size={14} color="#fff" />
              </button>
            ) : (
              <button onClick={sendMessage} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Send size={15} color="#fff" />
              </button>
            )}
          </div>
        </div>

        {/* Workspace selector + footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
          <button
            onClick={onSelectWorkspace}
            title="Select workspace"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'var(--text-tertiary)',
              fontFamily: 'inherit', padding: '2px 4px', borderRadius: 4,
            }}
          >
            <FolderOpen size={12} />
            {workspacePath ? workspacePath.split(/[\\/]/).pop() || workspacePath : 'Select workspace...'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              title="搜索对话"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', color: searchOpen ? 'var(--accent)' : 'var(--text-tertiary)',
                padding: 2,
              }}
            >
              <SearchIcon size={12} />
            </button>
            <button
              onClick={() => {
                const shareText = `BspBuddy Task: ${messages[0]?.content?.slice(0, 50) || 'Untitled'}`
                navigator.clipboard.writeText(shareText).catch(() => {})
              }}
              title="分享任务"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', color: 'var(--text-tertiary)',
                padding: 2,
              }}
            >
              <Share2 size={12} />
            </button>
            <button
              title="历史提问"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', color: 'var(--text-tertiary)',
                padding: 2,
              }}
            >
              <Clock size={12} />
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {mode === 'ask' ? 'Answers for reference only' : 'BspBuddy may make mistakes'}
            </span>
          </div>
        </div>
      </div>

      {/* Permission confirmation modal for high-risk operations */}
      {pendingRequest && (
        <PermissionConfirmModal
          type="operation"
          request={pendingRequest}
          onAllow={() => respondToRequest(pendingRequest.id, 'allow')}
          onDeny={() => dismissRequest()}
        />
      )}
    </div>
  )
}

function StepDot({ status }: { status: string }) {
  const c: Record<string, string> = { completed: 'var(--success)', running: 'var(--accent)', failed: 'var(--danger)', pending: 'var(--border)', ready: 'var(--warning)', skipped: 'var(--text-tertiary)' }
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: c[status] || '#ccc', flexShrink: 0 }} />
}
