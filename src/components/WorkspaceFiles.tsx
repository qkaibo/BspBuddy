import { useState, useEffect } from 'react'
import { Folder, File, ChevronRight, ChevronDown, FolderOpen } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'

interface FileEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
}

interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: TreeNode[]
  expanded?: boolean
}

interface Props {
  workspacePath?: string
}

export function WorkspaceFiles({ workspacePath }: Props) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (workspacePath) {
      loadDirectory(workspacePath)
    } else {
      setTree([])
    }
  }, [workspacePath])

  const ipc = createIpcClient()

  async function loadDirectory(dirPath: string): Promise<void> {
    setLoading(true)
    try {
      const entries = await ipc.invoke(IPC_CHANNELS.LIST_DIR, dirPath) as FileEntry[]
      const nodes: TreeNode[] = entries.map((e) => ({
        name: e.name,
        path: dirPath + '/' + e.name,
        isDirectory: e.isDirectory,
        expanded: false,
      }))
      setTree(nodes)
    } catch {
      setTree([])
    } finally {
      setLoading(false)
    }
  }

  async function toggleExpand(node: TreeNode): Promise<void> {
    if (!node.isDirectory) return

    if (node.expanded) {
      node.expanded = false
      setTree([...tree])
      return
    }

    setLoading(true)
    try {
      const entries = await ipc.invoke(IPC_CHANNELS.LIST_DIR, node.path) as FileEntry[]
      node.children = entries
        .filter((e) => !e.name.startsWith('.'))
        .map((e) => ({
          name: e.name,
          path: node.path + '/' + e.name,
          isDirectory: e.isDirectory,
          expanded: false,
        }))
      node.expanded = true
      setTree([...tree])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  if (!workspacePath) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', gap: 8 }}>
        <FolderOpen size={32} opacity={0.3} />
        <span style={{ fontSize: 13 }}>No workspace selected</span>
      </div>
    )
  }

  return (
    <div style={{ overflow: 'auto', height: '100%', padding: '4px 0' }}>
      {loading && tree.length === 0 ? (
        <div style={{ padding: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>Loading...</div>
      ) : (
        tree.map((node) => (
          <TreeNodeRow key={node.path} node={node} onToggle={toggleExpand} depth={0} />
        ))
      )}
    </div>
  )
}

function TreeNodeRow({ node, onToggle, depth }: { node: TreeNode; onToggle: (n: TreeNode) => void; depth: number }) {
  return (
    <>
      <div
        onClick={() => onToggle(node)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', paddingLeft: 8 + depth * 16,
          cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        {node.isDirectory ? (
          node.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
        ) : (
          <span style={{ width: 12 }} />
        )}
        {node.isDirectory ? (
          node.expanded ? <FolderOpen size={13} color="var(--warning)" /> : <Folder size={13} color="var(--warning)" />
        ) : (
          <File size={13} />
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
      </div>
      {node.expanded && node.children?.map((child) => (
        <TreeNodeRow key={child.path} node={child} onToggle={onToggle} depth={depth + 1} />
      ))}
    </>
  )
}
