import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Archive, ChevronDown, Copy, FilePlus2, History, ListTodo, Pencil,
  RefreshCw, Search, Send, Trash2, Undo2, Users,
} from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { SopSkill, SopSkillSummary, SopStatus } from '../lib/sop-types'
import { ConfirmDialog } from './ConfirmDialog'
import { SopDistillEditor } from './SopDistillEditor'
import { SopVersionDialog } from './SopVersionDialog'
import { panelRootStyle } from '../lib/panel-layout'

const ipc = createIpcClient()

interface Props {
  /** Navigate to Scope affiliation mode (agents-002) */
  onGoScope?: () => void
}

const STATUS_LABEL: Record<SopStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}

const STATUS_COLOR: Record<SopStatus, string> = {
  draft: 'var(--text-tertiary)',
  published: 'var(--accent)',
  archived: 'var(--danger)',
}

/**
 * SOP 创作台列表（agents-003）— 我的 SOP 库
 * 与 SopSkillsPanel（专家归属）严格分层。
 */
export function SopLibraryPanel({ onGoScope }: Props) {
  const [items, setItems] = useState<SopSkillSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<SopStatus | 'all'>('all')
  const [menuOpen, setMenuOpen] = useState(false)

  const [editorId, setEditorId] = useState<string | null>(null)
  const [editorFocusDistill, setEditorFocusDistill] = useState(false)
  const [versionSkill, setVersionSkill] = useState<SopSkillSummary | null>(null)

  const [confirmPublishId, setConfirmPublishId] = useState<string | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [squareOpen, setSquareOpen] = useState(false)
  const [squareItems, setSquareItems] = useState<SopSkillSummary[]>([])
  const [squareQ, setSquareQ] = useState('')
  const [squareLoading, setSquareLoading] = useState(false)
  const [squareError, setSquareError] = useState('')
  const [postPublishCta, setPostPublishCta] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await ipc.invoke(IPC_CHANNELS.SOP_LIST, {
        status: statusFilter,
        q: debouncedQ,
      }) as SopSkillSummary[] | { error?: string; items?: SopSkillSummary[] }
      if (Array.isArray(list)) {
        setItems(list)
      } else if (list && typeof list === 'object' && 'error' in list && list.error) {
        setError(list.error)
        setItems(Array.isArray(list.items) ? list.items : [])
      } else {
        setItems([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, debouncedQ])

  useEffect(() => { void load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const filtered = useMemo(() => items, [items])

  async function createBlank(openDistillFocus = false) {
    setMenuOpen(false)
    setError('')
    try {
      const res = await ipc.invoke(IPC_CHANNELS.SOP_CREATE, {
        blank: true,
        name: '未命名 SOP',
      }) as { skill?: SopSkill; error?: string }
      if (res?.error || !res.skill) {
        setError(res?.error || '创建失败')
        return
      }
      setEditorFocusDistill(openDistillFocus)
      setEditorId(res.skill.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    }
  }

  async function publish(id: string) {
    const res = await ipc.invoke(IPC_CHANNELS.SOP_PUBLISH, id) as { skill?: SopSkill; error?: string }
    if (res?.error) {
      setError(res.error)
      return
    }
    showToast('已发布 — 可到专家 Scope 工作台归属给专家')
    setPostPublishCta(true)
    await load()
  }

  async function toDraft(id: string) {
    const res = await ipc.invoke(IPC_CHANNELS.SOP_DRAFT, id) as { error?: string }
    if (res?.error) {
      setError(res.error)
      return
    }
    showToast('已转为草稿')
    await load()
  }

  async function archive(id: string) {
    const res = await ipc.invoke(IPC_CHANNELS.SOP_ARCHIVE, id) as { error?: string }
    if (res?.error) {
      setError(res.error)
      return
    }
    showToast('已归档')
    await load()
  }

  async function remove(id: string) {
    const res = await ipc.invoke(IPC_CHANNELS.SOP_DELETE, id) as { ok?: boolean; error?: string }
    if (res?.error) {
      setError(res.error)
      return
    }
    showToast('已删除')
    await load()
  }

  async function openSquare() {
    setMenuOpen(false)
    setSquareOpen(true)
    setSquareError('')
    setSquareLoading(true)
    try {
      const res = await ipc.invoke(IPC_CHANNELS.SOP_SQUARE_LIST, squareQ) as { items?: SopSkillSummary[] }
      setSquareItems(Array.isArray(res?.items) ? res.items : [])
    } catch (e) {
      setSquareError(e instanceof Error ? e.message : '加载广场失败')
    } finally {
      setSquareLoading(false)
    }
  }

  async function cloneFromSquare(sourceId: string) {
    setSquareError('')
    const res = await ipc.invoke(IPC_CHANNELS.SOP_CLONE_FROM_SQUARE, sourceId) as {
      skill?: SopSkill
      error?: string
    }
    if (res?.error || !res.skill) {
      setSquareError(res?.error || '复制失败')
      return
    }
    setSquareOpen(false)
    showToast(`已复制到我的库：「${res.skill.name}」（不会自动绑专家）`)
    setEditorId(res.skill.id)
    await load()
  }

  const btnStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 4, border: '1px solid var(--border)',
    background: 'transparent', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
    color: 'var(--text-secondary)',
  }

  return (
    <div style={panelRootStyle({ height: 'auto', flex: 1 })}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)', flexShrink: 0,
      }}>
        <ListTodo size={14} color="var(--accent)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>SOP 创作台</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>我的 SOP 库</span>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => void load()} style={btnStyle} title="刷新" aria-label="刷新 SOP 列表">
          <RefreshCw size={11} aria-hidden="true" /> 刷新
        </button>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            style={{ ...btnStyle, border: 'none', background: 'var(--accent)', color: '#fff' }}
          >
            <FilePlus2 size={11} /> 新增 <ChevronDown size={11} />
          </button>
          {menuOpen && (
            <div
              style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 20,
                minWidth: 180, background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden',
              }}
            >
              <MenuItem label="新建空白 SOP" onClick={() => void createBlank(false)} />
              <MenuItem label="从文档蒸馏" onClick={() => void createBlank(true)} />
              <MenuItem label="从广场复制到我的库" onClick={() => void openSquare()} />
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)', flexShrink: 0,
      }}>
        <Search size={12} color="var(--text-tertiary)" aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="搜索 SOP"
          placeholder="搜索名称 / ID / 业务域…"
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SopStatus | 'all')}
          aria-label="状态筛选"
          style={{
            padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
            fontSize: 11, fontFamily: 'inherit', background: 'var(--bg-input)', color: 'var(--text-primary)',
          }}
        >
          <option value="all">全部</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="archived">已归档</option>
        </select>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{filtered.length} 条</span>
      </div>

      {error && (
        <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--danger)', flexShrink: 0 }}>{error}</div>
      )}

      {postPublishCta && (
        <div style={{
          margin: '8px 16px 0', padding: '10px 12px', borderRadius: 8,
          background: 'var(--accent-light)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-primary)',
        }}>
          <Users size={14} color="var(--accent)" />
          <div style={{ flex: 1 }}>发布成功。去「专家归属」把 SOP 复制给当前专家（不会自动绑定）。</div>
          <button
            type="button"
            style={{ ...btnStyle, border: 'none', background: 'var(--accent)', color: '#fff' }}
            onClick={() => { setPostPublishCta(false); onGoScope?.() }}
          >
            去归属给专家
          </button>
          <button type="button" style={btnStyle} onClick={() => setPostPublishCta(false)}>关闭</button>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 12 }}>加载中…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-tertiary)', fontSize: 12, lineHeight: 1.6 }}>
            还没有 SOP
            <div style={{ marginTop: 6 }}>新建空白，或从文档蒸馏生成流程。</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
              <button type="button" style={{ ...btnStyle, color: 'var(--accent)' }} onClick={() => void createBlank(false)}>
                <FilePlus2 size={11} /> 新建空白
              </button>
              <button type="button" style={{ ...btnStyle, color: 'var(--accent)' }} onClick={() => void createBlank(true)}>
                从文档蒸馏
              </button>
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr 0.7fr 0.5fr 0.7fr 1.6fr',
              gap: 8, padding: '8px 12px', fontSize: 10, color: 'var(--text-tertiary)',
              background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
            }}>
              <span>SOP 名称</span>
              <span>SOP ID</span>
              <span>业务域</span>
              <span>版本</span>
              <span>状态</span>
              <span>操作</span>
            </div>
            {filtered.map((sop) => {
              const skillId = sop.skillId || sop.skill_id || sop.id
              const domain = sop.businessDomain || sop.business_domain || '—'
              return (
                <div
                  key={sop.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr 1fr 0.7fr 0.5fr 0.7fr 1.6fr',
                    gap: 8, padding: '10px 12px', fontSize: 11, alignItems: 'center',
                    borderBottom: '1px solid var(--border)', background: 'var(--bg-root)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sop.name}
                      {sop.isOverall && (
                        <span style={{
                          marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 3,
                          background: 'var(--accent-light)', color: 'var(--accent)',
                        }}>广场</span>
                      )}
                    </div>
                    {sop.description && (
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sop.description}
                      </div>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{skillId}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{domain}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>v{sop.version ?? '—'}</span>
                  <span style={{ color: STATUS_COLOR[sop.status] || 'var(--text-tertiary)', fontWeight: 600 }}>
                    {STATUS_LABEL[sop.status] || sop.status || '未知'}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {sop.status !== 'archived' && (
                      <button type="button" style={btnStyle} onClick={() => { setEditorFocusDistill(false); setEditorId(sop.id) }}>
                        <Pencil size={10} /> 编辑
                      </button>
                    )}
                    <button type="button" style={btnStyle} onClick={() => setVersionSkill(sop)}>
                      <History size={10} /> 版本
                    </button>
                    {sop.status === 'draft' && (
                      <button type="button" style={{ ...btnStyle, color: 'var(--accent)' }} onClick={() => setConfirmPublishId(sop.id)}>
                        <Send size={10} /> 发布
                      </button>
                    )}
                    {sop.status === 'published' && (
                      <>
                        <button type="button" style={btnStyle} onClick={() => void toDraft(sop.id)}>
                          <Undo2 size={10} /> 转草稿
                        </button>
                        <button type="button" style={{ ...btnStyle, color: 'var(--accent)' }} onClick={() => onGoScope?.()}>
                          <Users size={10} /> 去归属
                        </button>
                      </>
                    )}
                    {sop.status !== 'archived' && (
                      <button type="button" style={btnStyle} onClick={() => setConfirmArchiveId(sop.id)}>
                        <Archive size={10} /> 归档
                      </button>
                    )}
                    {(sop.status === 'draft' || sop.status === 'archived') && (
                      <button type="button" style={{ ...btnStyle, color: 'var(--danger)' }} onClick={() => setConfirmDeleteId(sop.id)}>
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.5, paddingBottom: 16 }}>
          发布后可到「专家归属」把 SOP 复制给专家（Scope 工作台 / agents-002）。本页只负责创作与库管理，不直接绑专家。
        </div>
      </div>

      {toast && (
        <div
          role="status"
          style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--text-primary)', color: 'var(--bg-card)',
            padding: '8px 14px', borderRadius: 6, fontSize: 11, zIndex: 50, maxWidth: '80%',
          }}
        >
          {toast}
        </div>
      )}

      {/* Square clone dialog */}
      {squareOpen && (
        <div
          role="presentation"
          style={{
            position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(0,0,0,.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setSquareOpen(false)}
        >
          <div
            role="dialog"
            aria-label="从广场复制到我的库"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 440, maxWidth: '92vw', maxHeight: '75vh',
              background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
              从广场复制到我的库
            </div>
            <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text-tertiary)' }}>
              得到可编辑草稿副本，不会写入任何专家 bindings。
            </div>
            <div style={{ padding: '0 14px 8px', display: 'flex', gap: 6 }}>
              <input
                value={squareQ}
                onChange={(e) => setSquareQ(e.target.value)}
                placeholder="搜索广场 SOP…"
                style={{
                  flex: 1, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)',
                  fontSize: 11, fontFamily: 'inherit', background: 'var(--bg-input)', color: 'var(--text-primary)',
                }}
              />
              <button type="button" style={btnStyle} onClick={() => void openSquare()}>搜索</button>
            </div>
            {squareError && <div style={{ padding: '0 14px 8px', fontSize: 11, color: 'var(--danger)' }}>{squareError}</div>}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>
              {squareLoading && <div style={{ textAlign: 'center', padding: 24, fontSize: 12, color: 'var(--text-tertiary)' }}>加载中…</div>}
              {!squareLoading && squareItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: 24, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  广场暂无已发布 SOP
                </div>
              )}
              {squareItems.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px',
                    border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      {s.skillId || s.skill_id} · {s.businessDomain || s.business_domain || '—'}
                    </div>
                  </div>
                  <button type="button" style={{ ...btnStyle, color: 'var(--accent)' }} onClick={() => void cloneFromSquare(s.id)}>
                    <Copy size={11} /> 复制到库
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {confirmPublishId && (
        <ConfirmDialog
          title="确认发布"
          message="发布后将出现在广场/可被专家 Scope 复制。确定发布？"
          confirmLabel="发布"
          danger={false}
          onConfirm={() => {
            const id = confirmPublishId
            setConfirmPublishId(null)
            void publish(id)
          }}
          onCancel={() => setConfirmPublishId(null)}
        />
      )}
      {confirmArchiveId && (
        <ConfirmDialog
          title="确认归档"
          message="归档后不可直接编辑。确定归档？"
          confirmLabel="归档"
          onConfirm={() => {
            const id = confirmArchiveId
            setConfirmArchiveId(null)
            void archive(id)
          }}
          onCancel={() => setConfirmArchiveId(null)}
        />
      )}
      {confirmDeleteId && (
        <ConfirmDialog
          title="确认删除"
          message="删除后不可恢复。确定删除该 SOP？"
          confirmLabel="删除"
          onConfirm={() => {
            const id = confirmDeleteId
            setConfirmDeleteId(null)
            void remove(id)
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {versionSkill && (
        <SopVersionDialog
          skillId={versionSkill.id}
          skillName={versionSkill.name}
          onClose={() => setVersionSkill(null)}
          onRolledBack={() => {
            showToast('已回滚并生成新版本')
            void load()
          }}
        />
      )}

      {editorId && (
        <SopDistillEditor
          skillId={editorId}
          focusDistill={editorFocusDistill}
          onClose={() => { setEditorId(null); void load() }}
          onSaved={() => { void load() }}
        />
      )}
    </div>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '9px 12px', border: 'none', background: 'transparent',
        cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {label}
    </button>
  )
}
