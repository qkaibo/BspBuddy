// ============================================================
// DataPanel �?Shared files & archived tasks management
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Copy, Download, Link2Off, Trash2, RotateCcw, FileText, Archive, AlertTriangle } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { SharedFile, ArchivedTask } from '../lib/types'

const ipc = createIpcClient()

interface Props {
  onClose: () => void
}

type TabId = 'shared' | 'archived'

export function DataPanel({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('shared')
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([])
  const [archivedTasks, setArchivedTasks] = useState<ArchivedTask[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const [files, tasks] = await Promise.all([
      ipc.invoke(IPC_CHANNELS.DATA_SHARED_FILES) as Promise<SharedFile[]>,
      ipc.invoke(IPC_CHANNELS.DATA_ARCHIVED_TASKS) as Promise<ArchivedTask[]>,
    ])
    setSharedFiles(files)
    setArchivedTasks(tasks)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  }

  const handleUnshare = async (fileId: string) => {
    await ipc.invoke(IPC_CHANNELS.DATA_UNSHARE_FILE, fileId)
    await loadData()
  }

  const handleDeleteTask = async (taskId: string) => {
    setDeleteConfirm(null)
    await ipc.invoke(IPC_CHANNELS.DATA_DELETE_ARCHIVED_TASK, taskId)
    await loadData()
  }

  const handleUnarchive = async (taskId: string) => {
    await ipc.invoke(IPC_CHANNELS.DATA_UNARCHIVE_TASK, taskId)
    await loadData()
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', overflow: 'hidden' }}>
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}>
          <ArrowLeft size={16} color="var(--text-secondary)" />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>数据管理</span>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {([
          { id: 'shared' as TabId, label: '我分享的文件', icon: FileText },
          { id: 'archived' as TabId, label: '已归档任务', icon: Archive },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 0', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: 12,
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 400, fontFamily: 'inherit',
            }}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {activeTab === 'shared' ? (
          sharedFiles.length === 0 ? (
            <EmptyState icon={FileText} message="暂无分享的文件" hint="任务产物分享后将出现在此处" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sharedFiles.map(file => (
                <div
                  key={file.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <FileText size={16} color="var(--text-secondary)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      {formatDate(file.sharedAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <ActionBtn icon={<Copy size={13} />} title="复制链接" onClick={() => handleCopyLink(file.shareUrl)} />
                    <ActionBtn icon={<Download size={13} />} title="下载" onClick={() => {}} />
                    <ActionBtn icon={<Link2Off size={13} />} title="取消分享" onClick={() => handleUnshare(file.id)} danger />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          archivedTasks.length === 0 ? (
            <EmptyState icon={Archive} message="暂无已归档任务" hint="归档任务后将出现在此处" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {archivedTasks.map(task => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Archive size={16} color="var(--text-secondary)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {task.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      归档于{formatDate(task.archivedAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <ActionBtn icon={<RotateCcw size={13} />} title="取消归档" onClick={() => handleUnarchive(task.id)} />
                    <ActionBtn icon={<Trash2 size={13} />} title="删除" onClick={() => setDeleteConfirm(task.id)} danger />
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,.4)', zIndex: 100,
        }} onClick={() => setDeleteConfirm(null)}>
          <div
            style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
              padding: 24, maxWidth: 360, width: '90%',
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={18} color="var(--danger)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>确认删除</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>
              删除后任务不可查看且不可继续对话，确定要删除吗？
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '6px 16px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteTask(deleteConfirm)}
                style={{
                  padding: '6px 16px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--danger)',
                  color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ icon: Icon, message, hint }: { icon: React.ElementType; message: string; hint: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 0' }}>
      <Icon size={32} color="var(--text-tertiary)" />
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{message}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{hint}</div>
    </div>
  )
}

function ActionBtn({ icon, title, onClick, danger }: {
  icon: React.ReactNode; title: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: 5, borderRadius: 4, border: 'none',
        background: 'transparent', cursor: 'pointer',
        color: danger ? 'var(--danger)' : 'var(--text-tertiary)',
        display: 'flex', alignItems: 'center',
      }}
    >
      {icon}
    </button>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
