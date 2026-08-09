import { useEffect, useState } from 'react'
import { History, RotateCcw, Trash2, X } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { SkillVersion } from '../lib/sop-types'
import { ConfirmDialog } from './ConfirmDialog'

const ipc = createIpcClient()

interface Props {
  skillId: string
  skillName: string
  onClose: () => void
  onRolledBack: () => void
}

export function SopVersionDialog({ skillId, skillName, onClose, onRolledBack }: Props) {
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmRollback, setConfirmRollback] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await ipc.invoke(IPC_CHANNELS.SOP_VERSIONS, skillId) as { versions?: SkillVersion[]; error?: string }
      if (res?.error) {
        setError(res.error)
        setVersions([])
      } else {
        setVersions(Array.isArray(res?.versions) ? res.versions : [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载版本失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [skillId])

  async function doRollback(version: number) {
    const res = await ipc.invoke(IPC_CHANNELS.SOP_ROLLBACK, skillId, version) as { error?: string }
    if (res?.error) {
      setError(res.error)
      return
    }
    onRolledBack()
    onClose()
  }

  async function doDelete(version: number) {
    const res = await ipc.invoke(IPC_CHANNELS.SOP_DELETE_VERSION, skillId, version) as { error?: string }
    if (res?.error) {
      setError(res.error)
      return
    }
    await load()
  }

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
    background: 'transparent', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
    color: 'var(--text-secondary)',
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="版本管理"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480, maxWidth: '92vw', maxHeight: '80vh',
          background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <History size={14} color="var(--accent)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>版本管理</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {skillName}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" style={{ ...btn, border: 'none', padding: 4 }}>
            <X size={14} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--danger)' }}>{error}</div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 12 }}>加载中…</div>
          )}
          {!loading && versions.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 12 }}>
              暂无版本快照。保存或发布后会生成版本。
            </div>
          )}
          {!loading && versions.map((v) => (
            <div
              key={v.id || `${v.version}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                border: '1px solid var(--border)', background: 'var(--bg-root)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>v{v.version}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {new Date(v.createdAt).toLocaleString()}
                  {v.createdBy ? ` · ${v.createdBy}` : ''}
                  {` · ${v.contentJson?.nodes?.length || 0} 节点`}
                </div>
              </div>
              <button type="button" style={btn} onClick={() => setConfirmRollback(v.version)} title="回滚到此版本" aria-label={`回滚到版本 ${v.version}`}>
                <RotateCcw size={11} aria-hidden="true" /> 回滚
              </button>
              <button
                type="button"
                style={{ ...btn, color: 'var(--danger)' }}
                onClick={() => setConfirmDelete(v.version)}
                title="删除此版本"
                aria-label={`删除版本 ${v.version}`}
                disabled={versions.length <= 1}
              >
                <Trash2 size={11} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {confirmRollback != null && (
        <ConfirmDialog
          title="确认回滚"
          message={`将当前内容替换为 v${confirmRollback} 的快照，并生成新版本。确定继续？`}
          confirmLabel="确认回滚"
          danger={false}
          onConfirm={() => {
            const v = confirmRollback
            setConfirmRollback(null)
            void doRollback(v)
          }}
          onCancel={() => setConfirmRollback(null)}
        />
      )}
      {confirmDelete != null && (
        <ConfirmDialog
          title="确认删除版本"
          message={`删除 v${confirmDelete}？不可删除唯一版本。`}
          confirmLabel="删除"
          onConfirm={() => {
            const v = confirmDelete
            setConfirmDelete(null)
            void doDelete(v)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
