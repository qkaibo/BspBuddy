import type { Artifact } from '../lib/types'
import { FileText, Download, Eye, FolderOpen } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'

const ipc = createIpcClient()

const TYPE_ICON: Record<string, string> = {
  'text/markdown': '📝',
  'text/html': '🌐',
  'text/csv': '📊',
  'application/msword': '📄',
  'application/pdf': '📑',
  'image/png': '🖼️',
  'image/jpeg': '🖼️',
  'text/plain': '📃',
}

interface Props {
  artifacts: Artifact[]
  workspacePath?: string
  onPreviewInBrowser?: (html: string) => void
}

export function ArtifactView({ artifacts, workspacePath, onPreviewInBrowser }: Props) {
  if (artifacts.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', gap: 8 }}>
        <FileText size={32} opacity={0.3} />
        <span style={{ fontSize: 13 }}>No artifacts yet</span>
        <span style={{ fontSize: 11 }}>Generated files will appear here</span>
      </div>
    )
  }

  const handlePreview = async (a: Artifact) => {
    if (a.path) {
      try {
        const content = await ipc.invoke(IPC_CHANNELS.FILE_READ, a.path) as string
        if (onPreviewInBrowser) {
          onPreviewInBrowser(content)
        }
      } catch {
        // file read failed silently
      }
    }
  }

  const handleOpen = async (a: Artifact) => {
    if (a.path) {
      try {
        await ipc.invoke(IPC_CHANNELS.FILE_OPEN, a.path)
      } catch {
        // file open failed silently
      }
    }
  }

  const handleOpenFolder = async () => {
    if (workspacePath) {
      try {
        await ipc.invoke(IPC_CHANNELS.FILE_OPEN, workspacePath)
      } catch {
        // folder open failed silently
      }
    }
  }

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {artifacts.map((a, i) => (
        <div
          key={i}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderBottom: '1px solid var(--border)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: 20 }}>{TYPE_ICON[a.mimeType] || '📎'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {a.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {a.mimeType} · {formatSize(a.size)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {a.mimeType === 'text/markdown' || a.mimeType === 'text/html' ? (
              <button title="Preview" style={iconBtnStyle}
                onClick={(e) => { e.stopPropagation(); handlePreview(a) }}
              ><Eye size={13} /></button>
            ) : null}
            <button title="Open file" style={iconBtnStyle}
              onClick={(e) => { e.stopPropagation(); handleOpen(a) }}
            ><Download size={13} /></button>
          </div>
        </div>
      ))}
      {workspacePath && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleOpenFolder}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'inherit',
              padding: '4px 0',
            }}
          >
            <FolderOpen size={13} />
            Open workspace folder
          </button>
        </div>
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const iconBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: 'none',
  background: 'transparent', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)',
}
