import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Paperclip, FolderOpen } from 'lucide-react'

export interface UploadedFile {
  id: string
  name: string
  path?: string
  dataUrl?: string
  size: number
  type: string
}

interface Props {
  files: UploadedFile[]
  onAdd: (files: UploadedFile[]) => void
  onRemove: (id: string) => void
  onSelectWorkspace: () => void
  workspacePath?: string
}

export function UploadZone({ files, onAdd, onRemove, workspacePath, onSelectWorkspace }: Props) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [showAtMenu, setShowAtMenu] = useState(false)
  const [atQuery, setAtQuery] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    const uploads: UploadedFile[] = droppedFiles.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      path: (f as any).path,
      size: f.size,
      type: f.type,
    }))
    onAdd(uploads)
  }, [onAdd])

  // Handle paste (images)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    const uploads: UploadedFile[] = []

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile()
        if (blob) {
          const reader = new FileReader()
          reader.onload = () => {
            const upload: UploadedFile = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              name: `paste-${Date.now()}.png`,
              dataUrl: reader.result as string,
              size: blob.size,
              type: blob.type,
            }
            onAdd([upload])
          }
          reader.readAsDataURL(blob)
        }
      }
    }
  }, [onAdd])

  // Handle @ key for file references
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === '@') {
      setShowAtMenu(true)
      setAtQuery('')
    } else if (showAtMenu && e.key === 'Escape') {
      setShowAtMenu(false)
    }
  }, [showAtMenu])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      style={{ position: 'relative' }}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'var(--radius-lg)',
          background: 'rgba(79,110,247,.08)', border: '2px dashed var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10, fontSize: 14, color: 'var(--accent)', fontWeight: 600,
        }}>
          Drop files here
        </div>
      )}

      {/* File chips */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 0' }}>
          {files.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6,
                background: 'var(--accent-light)', fontSize: 11,
                color: 'var(--accent)',
              }}
            >
              <Paperclip size={11} />
              <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </span>
              <button
                onClick={() => onRemove(f.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 1, display: 'flex', color: 'inherit',
                }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* @ mention menu */}
      {showAtMenu && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0,
          background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          zIndex: 20, maxHeight: 200, overflow: 'auto', marginBottom: 4,
        }}>
          <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
            Type to search files, or <FolderOpen size={11} style={{ verticalAlign: 'middle' }} /> browse
          </div>
          <button
            onClick={() => { onSelectWorkspace(); setShowAtMenu(false) }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', border: 'none', background: 'none',
              cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)',
              borderBottom: '1px solid var(--border)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <FolderOpen size={13} />
            Browse workspace files...
          </button>
        </div>
      )}
    </div>
  )
}
