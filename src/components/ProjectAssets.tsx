import { useState, useEffect, useCallback } from 'react'
import { Upload, Trash2, FileText, Image, Video, Music, File, Globe, Link, HardDrive, Clock, Search, X, Loader } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { ProjectAsset, AssetType } from '../lib/project-types'
import { ConfirmDialog } from './ConfirmDialog'

const ipc = createIpcClient()

const ASSET_TYPE_ICONS: Record<AssetType, typeof FileText> = {
  document: FileText,
  spreadsheet: FileText,
  presentation: FileText,
  pdf: FileText,
  image: Image,
  video: Video,
  audio: Music,
  url_bookmark: Link,
  markdown: FileText,
  other: File,
}

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  document: 'Document',
  spreadsheet: 'Spreadsheet',
  presentation: 'Presentation',
  pdf: 'PDF',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  url_bookmark: 'URL Bookmark',
  markdown: 'Markdown',
  other: 'Other',
}

interface Props {
  projectId: string
  currentUserId: string
  currentUserName: string
  onAssetChange: () => void
}

export function ProjectAssets({ projectId, currentUserId, currentUserName, onAssetChange }: Props) {
  const [assets, setAssets] = useState<ProjectAsset[]>([])
  const [search, setSearch] = useState('')
  const [storageUsage, setStorageUsage] = useState<{ used: number; limit: number; percentage: number } | null>(null)
  const [filterType, setFilterType] = useState<AssetType | 'all'>('all')
  const [showUpload, setShowUpload] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadType, setUploadType] = useState<AssetType>('document')
  const [uploadSize, setUploadSize] = useState(0)
  const [uploadFilePath, setUploadFilePath] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const loadAssets = useCallback(async () => {
    const result = await ipc.invoke(IPC_CHANNELS.PROJECT_ASSET_LIST, projectId) as { success: boolean; assets: ProjectAsset[] }
    if (result.success) setAssets(result.assets)
  }, [projectId])

  useEffect(() => {
    loadAssets()
    // Load storage usage
    ipc.invoke(IPC_CHANNELS.PROJECT_TASK_LIST, projectId).then(() => {
      // We need storage info — re-use the project list for now
      ipc.invoke(IPC_CHANNELS.PROJECT_LIST).then((r: any) => {
        const projects = r?.projects || []
        const p = projects.find((pp: any) => pp.id === projectId)
        if (p?.storage) {
          setStorageUsage({
            used: p.storage.used,
            limit: p.storage.limit,
            percentage: Math.round((p.storage.used / p.storage.limit) * 100),
          })
        }
      })
    })
  }, [loadAssets, projectId])

  const handleChooseFile = async () => {
    const result = await ipc.invoke(IPC_CHANNELS.FILE_DIALOG, { type: 'open' })
    if (result && Array.isArray(result) && result.length > 0) {
      const filePath = result[0]
      const fileName = filePath.split(/[\\/]/).pop() || 'file'
      setUploadFilePath(filePath)
      setUploadName(fileName)
      // Set size estimation and type based on extension
      setUploadSize(0)
      const ext = fileName.split('.').pop()?.toLowerCase()
      const typeMap: Record<string, AssetType> = {
        pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
        mp4: 'video', mov: 'video', avi: 'video',
        mp3: 'audio', wav: 'audio', flac: 'audio',
        md: 'markdown', doc: 'document', docx: 'document', xls: 'spreadsheet', xlsx: 'spreadsheet',
        ppt: 'presentation', pptx: 'presentation',
      }
      setUploadType(typeMap[ext || ''] || 'other')
    }
  }

  const handleUpload = async () => {
    if (!uploadName.trim()) return
    setIsUploading(true)
    setUploadProgress(0)
    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 20, 90))
    }, 200)
    try {
      await ipc.invoke(
        IPC_CHANNELS.PROJECT_ASSET_UPLOAD,
        projectId, uploadName, uploadType, uploadFilePath || uploadName, uploadSize, currentUserId, currentUserName,
      )
      setUploadProgress(100)
    } catch { /* use partial progress */ }
    clearInterval(progressInterval)
    setTimeout(() => {
      setIsUploading(false)
      setUploadProgress(0)
      setShowUpload(false)
      setUploadName('')
      setUploadFilePath('')
      setUploadSize(0)
    }, 600)
    await loadAssets()
    onAssetChange()
  }

  const handleDeleteAsset = async (assetId: string) => {
    await ipc.invoke(IPC_CHANNELS.PROJECT_ASSET_DELETE, projectId, assetId)
    setAssets((prev) => prev.filter((a) => a.id !== assetId))
    onAssetChange()
  }

  const filtered = assets.filter((a) => {
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'all' || a.type === filterType
    return matchesSearch && matchesType
  })

  const typeCounts = new Map<string, number>()
  for (const a of assets) {
    typeCounts.set(a.type, (typeCounts.get(a.type) || 0) + 1)
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Storage bar */}
      {storageUsage && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, background: 'var(--bg-card)',
          border: '1px solid var(--border)', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              <HardDrive size={14} /> Storage
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {formatSize(storageUsage.used)} / {formatSize(storageUsage.limit)} ({storageUsage.percentage}%)
            </span>
          </div>
          <div style={{ height: 4, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.min(100, storageUsage.percentage)}%`,
              background: storageUsage.percentage > 80 ? 'var(--danger)' : 'var(--accent)',
              borderRadius: 2, transition: 'width .3s',
            }} />
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border)',
          padding: '6px 10px', flex: 1,
        }}>
          <Search size={13} color="var(--text-tertiary)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets…" aria-label="搜索资源"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="清除搜索" style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowUpload(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
            borderRadius: 6, background: 'var(--accent)', color: '#fff',
            border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Upload size={13} /> Upload
        </button>
      </div>

      {/* Type filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterType('all')}
          style={{
            padding: '3px 10px', borderRadius: 12, border: 'none',
            background: filterType === 'all' ? 'var(--accent)' : 'var(--bg-card)',
            color: filterType === 'all' ? '#fff' : 'var(--text-secondary)',
            fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
          }}
        >
          All ({assets.length})
        </button>
        {Array.from(typeCounts.entries()).map(([type, count]) => {
          const Icon = ASSET_TYPE_ICONS[type as AssetType] || File
          return (
            <button
              key={type}
              onClick={() => setFilterType(type as AssetType)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 12, border: 'none',
                background: filterType === type ? 'var(--accent)' : 'var(--bg-card)',
                color: filterType === type ? '#fff' : 'var(--text-secondary)',
                fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
              }}
            >
              <Icon size={11} /> {ASSET_TYPE_LABELS[type as AssetType]} ({count})
            </button>
          )
        })}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div
          role="dialog"
          aria-modal="true"
          data-overlay="true"
          style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          overscrollBehavior: 'contain',
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24,
            width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            overscrollBehavior: 'contain',
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>Upload Asset</h3>

            <div style={{ marginBottom: 10 }}>
              <label htmlFor="asset-upload-name" style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Name</label>
              <input
                id="asset-upload-name"
                name="asset-name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="File name"
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--bg-input)',
                  color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Type</label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as AssetType)}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--bg-input)',
                  color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                }}
              >
                {Object.entries(ASSET_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>File</label>
              <button
                onClick={handleChooseFile}
                disabled={isUploading}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 6,
                  border: '1px dashed var(--border)', background: 'var(--bg-input)',
                  color: uploadFilePath ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: 12, cursor: isUploading ? 'default' : 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <Upload size={14} />
                {uploadFilePath
                  ? uploadFilePath.split(/[\\/]/).pop()
                  : 'Choose a file…'}
              </button>
            </div>

            {isUploading && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span>Uploading…</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${uploadProgress}%`,
                    background: uploadProgress === 100 ? 'var(--success)' : 'var(--accent)',
                    borderRadius: 2, transition: 'width .3s',
                  }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowUpload(false)}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadName.trim() || isUploading}
                style={{
                  padding: '6px 18px', borderRadius: 6, border: 'none',
                  background: uploadName.trim() && !isUploading ? 'var(--accent)' : 'var(--border)',
                  color: uploadName.trim() && !isUploading ? '#fff' : 'var(--text-tertiary)',
                  fontSize: 12, fontWeight: 600, cursor: uploadName.trim() && !isUploading ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                {isUploading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Uploading</span>
                ) : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset list */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13,
        }}>
          <FolderOpen size={32} color="var(--text-tertiary)" style={{ marginBottom: 8, opacity: 0.5 }} />
          <div>{search ? 'No matching assets' : 'No assets yet. Upload files to get started.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map((a) => {
            const Icon = ASSET_TYPE_ICONS[a.type] || File
            return (
              <div
                key={a.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 8,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 6,
                  background: 'var(--bg-input)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={16} color="var(--text-secondary)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', gap: 8, marginTop: 2 }}>
                    <span>{ASSET_TYPE_LABELS[a.type]}</span>
                    <span>{formatSize(a.size)}</span>
                    <span>{a.uploaderName}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Clock size={9} /> {formatTimeAgo(a.uploadedAt)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Globe size={9} /> Updated {formatTimeAgo(a.updatedAt)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '4px 8px', borderRadius: 4,
                      border: '1px solid var(--border)', color: 'var(--accent)',
                      fontSize: 10, textDecoration: 'none', cursor: 'pointer',
                      background: 'transparent', fontFamily: 'inherit',
                    }}
                  >
                    Open
                  </a>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(a.id)}
                    style={{
                      padding: 4, borderRadius: 4, border: 'none',
                      background: 'transparent', cursor: 'pointer',
                      color: 'var(--text-tertiary)',
                    }}
                    title="Delete"
                    aria-label={`删除资源 ${a.name}`}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {confirmDeleteId && (
        <ConfirmDialog
          title="确认删除资源"
          message="删除后该项目资源将不可恢复，确定要删除吗？"
          onConfirm={() => {
            const id = confirmDeleteId
            setConfirmDeleteId(null)
            void handleDeleteAsset(id)
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const FolderOpen = ({ size, color, style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)
