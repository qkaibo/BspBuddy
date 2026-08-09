import { useState } from 'react'
import { Package, FolderTree, GitFork, Globe, X } from 'lucide-react'
import { ArtifactView } from './ArtifactView'
import { WorkspaceFiles } from './WorkspaceFiles'
import { DiffView } from './DiffView'
import { BrowserPreview } from './BrowserPreview'
import type { Artifact } from '../lib/types'

type TabId = 'artifacts' | 'files' | 'diff' | 'browser'

const TABS: { id: TabId; label: string; icon: typeof Package }[] = [
  { id: 'artifacts', label: 'Artifacts', icon: Package },
  { id: 'files', label: 'Files', icon: FolderTree },
  { id: 'diff', label: 'Changes', icon: GitFork },
  { id: 'browser', label: 'Browser', icon: Globe },
]

interface Props {
  artifacts: Artifact[]
  workspacePath?: string
  visible: boolean
  onToggle: () => void
  changes?: Array<{ filePath: string; description: string; addedLines?: number; removedLines?: number }>
}

export function ResultPanel({ artifacts, workspacePath, visible, onToggle, changes = [] }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('artifacts')
  const [previewHtml, setPreviewHtml] = useState<string>()

  if (!visible) return null

  const handlePreviewInBrowser = (html: string) => {
    setPreviewHtml(html)
    setActiveTab('browser')
  }

  return (
    <div style={{
      width: '40%', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* Header with tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flex: 1 }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '8px 14px', border: 'none', borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  background: 'none', cursor: 'pointer', fontSize: 11,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'inherit',
                  transition: 'color .15s, border-color .15s',
                }}
              >
                <tab.icon size={13} aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label="关闭结果面板"
          style={{
            padding: 8, border: 'none', background: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', display: 'flex',
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'artifacts' && <ArtifactView artifacts={artifacts} workspacePath={workspacePath} onPreviewInBrowser={handlePreviewInBrowser} />}
        {activeTab === 'files' && <WorkspaceFiles workspacePath={workspacePath} />}
        {activeTab === 'diff' && <DiffView changes={changes} />}
        {activeTab === 'browser' && <BrowserPreview htmlContent={previewHtml} />}
      </div>
    </div>
  )
}
