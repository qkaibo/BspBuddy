import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Download, ListTodo, Search, Trash2, Wand2 } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Expert } from '../lib/expert-types'
import { useExpertScope } from '../hooks/useExpertScope'
import { ResourceImportDialog } from './ResourceImportDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { panelRootStyle } from '../lib/panel-layout'

const ipc = createIpcClient()

interface SopItem {
  id: string
  name: string
  skillId?: string
  skill_id?: string
  status?: string
  version?: string | number
  businessDomain?: string
  business_domain?: string
  description?: string
}

interface Props {
  /** Switch to SOP 创作台 (agents-003) — does not create SOP here */
  onGoCreate?: () => void
}

/**
 * StaffDeck SkillsPage pattern (agents-002 Scope):
 * - Work inside current expert scope
 * - List only SOPs owned by that expert
 * - Import from plaza / another expert into current scope (no "pick target" every time)
 * Creation / distill / publish → SopLibraryPanel (agents-003)
 */
export function SopSkillsPanel({ onGoCreate }: Props = {}) {
  const { scopeId, setScopeId } = useExpertScope()
  const [experts, setExperts] = useState<Expert[]>([])
  const [allSops, setAllSops] = useState<SopItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importMode, setImportMode] = useState<'plaza' | 'employee'>('plaza')
  const [importSourceId, setImportSourceId] = useState('')
  const [importSources, setImportSources] = useState<{ value: string; label: string }[]>([])
  const [importItems, setImportItems] = useState<{ id: string; label: string }[]>([])
  const [importSelectedIds, setImportSelectedIds] = useState<string[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [importQuery, setImportQuery] = useState('')

  const current = useMemo(
    () => experts.find((e) => e.id === scopeId) || experts.find((e) => !e.isOverall) || experts[0],
    [experts, scopeId],
  )

  const ownedIds = useMemo(() => new Set(current?.bindings?.sopSkills || []), [current])

  const ownedSops = useMemo(() => {
    if (!current) return []
    // Plaza / overall: show published catalog as the public pool view
    if (current.isOverall) {
      return allSops.filter((s) => s.status === 'published')
    }
    // Bindings may store row id or skillId depending on import source
    return allSops.filter((s) =>
      ownedIds.has(s.id)
      || ownedIds.has(s.skillId || '')
      || ownedIds.has(s.skill_id || ''),
    )
  }, [allSops, current, ownedIds])

  const filteredOwned = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ownedSops
    return ownedSops.filter((s) =>
      (s.name || '').toLowerCase().includes(q)
      || (s.skillId || s.skill_id || '').toLowerCase().includes(q)
      || (s.businessDomain || s.business_domain || '').toLowerCase().includes(q),
    )
  }, [ownedSops, search])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [expertList, sopList] = await Promise.all([
        ipc.invoke(IPC_CHANNELS.EXPERT_LIST) as Promise<Expert[] | { error?: string }>,
        ipc.invoke(IPC_CHANNELS.SOP_LIST) as Promise<SopItem[] | { error?: string; items?: SopItem[] }>,
      ])
      const list = Array.isArray(expertList) ? expertList : []
      setExperts(list)

      if (Array.isArray(sopList)) {
        setAllSops(sopList)
      } else if (sopList && typeof sopList === 'object' && 'error' in sopList && sopList.error) {
        setError(sopList.error)
        setAllSops(Array.isArray(sopList.items) ? sopList.items : [])
      } else {
        setAllSops([])
      }

      if (!scopeId || !list.some((e) => e.id === scopeId)) {
        const fallback = list.find((e) => !e.isOverall) || list[0]
        if (fallback) setScopeId(fallback.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      setExperts([])
      setAllSops([])
    } finally {
      setLoading(false)
    }
  }, [scopeId, setScopeId])

  useEffect(() => { void load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function openImport(mode: 'plaza' | 'employee') {
    if (!current) {
      setError('请先选择一个专家（scope）')
      return
    }
    setImportMode(mode)
    setImportSelectedIds([])
    setImportQuery('')
    setImportError('')

    const published = allSops.filter((s) => s.status === 'published')
    if (mode === 'plaza') {
      const plaza = experts.find((e) => e.isOverall)
      const plazaId = plaza?.id || 'plaza-overall'
      setImportSources([{ value: plazaId, label: plaza?.name || '开放广场' }])
      setImportSourceId(plazaId)
      setImportItems(published.map((s) => {
        const sid = s.skillId || s.skill_id
        const domain = s.businessDomain || s.business_domain
        return {
          id: s.id,
          label: `${s.name}${sid ? ` · ${sid}` : ''}${domain ? ` · ${domain}` : ''}`,
        }
      }))
    } else {
      const sources = experts
        .filter((e) => e.id !== current.id)
        .map((e) => ({ value: e.id, label: e.title ? `${e.name} · ${e.title}` : e.name }))
      setImportSources(sources)
      setImportSourceId(sources[0]?.value || '')
      // For employee copy, show SOPs owned by source (fallback: published catalog)
      const source = experts.find((e) => e.id === sources[0]?.value)
      const sourceOwned = new Set(source?.bindings?.sopSkills || [])
      const items = (sourceOwned.size
        ? published.filter((s) => sourceOwned.has(s.id))
        : published)
      setImportItems(items.map((s) => ({
        id: s.id,
        label: `${s.name}${s.skillId || s.skill_id ? ` · ${s.skillId || s.skill_id}` : ''}`,
      })))
    }

    // Open after source/items are set so controlled select is not empty
    setImportOpen(true)
  }

  async function onImportSourceChange(sourceId: string) {
    setImportSourceId(sourceId)
    setImportSelectedIds([])
    const published = allSops.filter((s) => s.status === 'published')
    if (importMode === 'plaza') {
      setImportItems(published.map((s) => ({
        id: s.id,
        label: `${s.name}${s.skillId || s.skill_id ? ` · ${s.skillId || s.skill_id}` : ''}`,
      })))
      return
    }
    const source = experts.find((e) => e.id === sourceId)
    const sourceOwned = new Set(source?.bindings?.sopSkills || [])
    const items = sourceOwned.size
      ? published.filter((s) => sourceOwned.has(s.id))
      : published
    setImportItems(items.map((s) => ({
      id: s.id,
      label: `${s.name}${s.skillId || s.skill_id ? ` · ${s.skillId || s.skill_id}` : ''}`,
    })))
  }

  const visibleImportItems = useMemo(() => {
    const q = importQuery.trim().toLowerCase()
    const unbound = importItems.filter((i) => !ownedIds.has(i.id))
    if (!q) return unbound
    return unbound.filter((i) => i.label.toLowerCase().includes(q))
  }, [importItems, importQuery, ownedIds])

  async function submitImport() {
    if (!current) return
    if (!importSourceId) {
      setImportError(importMode === 'plaza' ? '请选择开放广场' : '请选择复制来源')
      return
    }
    if (importSelectedIds.length === 0) {
      setImportError('请选择要复制的 SOP')
      return
    }
    setImportLoading(true)
    setImportError('')
    try {
      const result = await ipc.invoke(IPC_CHANNELS.RESOURCE_IMPORT, {
        targetAgentId: current.id,
        sourceAgentId: importSourceId,
        resourceType: 'skill',
        resourceIds: importSelectedIds,
      }) as { status?: string; error?: string }
      if (result?.status === 'error') {
        setImportError(result.error || '复制失败')
        return
      }
      setImportOpen(false)
      showToast(`已复制 ${importSelectedIds.length} 个 SOP 到「${current.name}」`)
      await load()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '复制失败')
    } finally {
      setImportLoading(false)
    }
  }

  async function removeSop(sopId: string) {
    if (!current || current.isOverall) return
    const result = await ipc.invoke(IPC_CHANNELS.RESOURCE_UNBIND, {
      targetAgentId: current.id,
      resourceType: 'skill',
      resourceIds: [sopId],
    }) as { status?: string; error?: string }
    if (result?.status === 'error') {
      setError(result.error || '移除失败')
      return
    }
    showToast('已从当前专家移除')
    await load()
  }

  const btnStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 4, border: '1px solid var(--border)',
    background: 'transparent', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
    color: 'var(--text-secondary)',
  }

  return (
    <div style={panelRootStyle({ height: 'auto', flex: 1 })}>
      {/* Scope bar — StaffDeck agent scope */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)', flexShrink: 0,
      }}>
        <ListTodo size={14} color="var(--accent)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>专家归属</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>当前专家</span>
        <select
          value={current?.id || ''}
          onChange={(e) => setScopeId(e.target.value)}
          aria-label="当前专家"
          style={{
            minWidth: 160, padding: '5px 8px', borderRadius: 4,
            border: '1px solid var(--border)', fontSize: 11, fontFamily: 'inherit',
            background: 'var(--bg-input)', color: 'var(--text-primary)',
          }}
        >
          {experts.map((e) => (
            <option key={e.id} value={e.id}>
              {e.isOverall ? `[广场] ${e.name}` : e.name}{e.title ? ` · ${e.title}` : ''}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => void openImport('plaza')} style={btnStyle} disabled={!current}>
          <Download size={11} /> 从广场复制
        </button>
        <button onClick={() => void openImport('employee')} style={btnStyle} disabled={!current}>
          <Download size={11} /> 从其他专家复制
        </button>
      </div>

      {/* Search owned list */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)', flexShrink: 0,
      }}>
        <Search size={12} color="var(--text-tertiary)" aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          name="sop-search"
          aria-label="搜索 SOP"
          placeholder="搜索当前专家的 SOP 名称 / ID / 业务域…"
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit',
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {filteredOwned.length} / {ownedSops.length}
        </span>
      </div>

      {error && (
        <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--danger)', flexShrink: 0 }}>{error}</div>
      )}

      {/* Owned SOP list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 12 }}>加载中…</div>
        )}
        {!loading && filteredOwned.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-tertiary)', fontSize: 12, lineHeight: 1.6 }}>
            {current?.isOverall
              ? '广场暂无已发布 SOP'
              : `「${current?.name || '当前专家'}」还没有 SOP`}
            <div style={{ marginTop: 8 }}>
              从广场或其他专家复制到当前 scope。新建 / 蒸馏请到「SOP 创作台」。
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              {!current?.isOverall && (
                <button onClick={() => void openImport('plaza')} style={{ ...btnStyle, color: 'var(--accent)' }}>
                  <Download size={11} /> 从广场复制
                </button>
              )}
              {onGoCreate && (
                <button type="button" onClick={onGoCreate} style={{ ...btnStyle, color: 'var(--accent)' }}>
                  <Wand2 size={11} /> 去创作台
                </button>
              )}
            </div>
          </div>
        )}
        {!loading && filteredOwned.map((sop) => (
          <div
            key={sop.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 12px', borderRadius: 8, marginBottom: 6,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--accent-light)',
            }}>
              <ListTodo size={14} color="var(--accent)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{sop.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {sop.skillId || sop.skill_id || sop.id}
                {(sop.businessDomain || sop.business_domain) ? ` · ${sop.businessDomain || sop.business_domain}` : ''}
                {sop.version != null && sop.version !== '' ? ` · v${sop.version}` : ''}
                {sop.status ? ` · ${sop.status}` : ''}
              </div>
              {sop.description && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{sop.description}</div>
              )}
            </div>
            {!current?.isOverall && (
              <button
                type="button"
                onClick={() => setConfirmRemoveId(sop.id)}
                title="从当前专家移除"
                aria-label={`移除 SOP ${sop.name}`}
                style={{
                  ...btnStyle, padding: '4px 6px', color: 'var(--danger)',
                }}
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--text-primary)', color: 'var(--bg-card)',
          padding: '8px 14px', borderRadius: 6, fontSize: 11, zIndex: 50,
        }}>{toast}</div>
      )}
      {confirmRemoveId && (
        <ConfirmDialog
          title="确认移除 SOP"
          message="将从当前专家解绑该 SOP，确定要继续吗？"
          confirmLabel="确认移除"
          onConfirm={() => {
            const id = confirmRemoveId
            setConfirmRemoveId(null)
            void removeSop(id)
          }}
          onCancel={() => setConfirmRemoveId(null)}
        />
      )}

      {importOpen && current && (
        <ResourceImportDialog
          open={importOpen}
          loading={importLoading}
          icon={<Download size={14} />}
          title={importMode === 'plaza'
            ? `从广场复制到「${current.name}」`
            : `从其他专家复制到「${current.name}」`}
          sourcePlaceholder={importMode === 'plaza' ? '选择开放广场' : '选择来源专家'}
          sources={importSources}
          sourceId={importSourceId}
          itemsLabel="选择 SOP（已过滤当前已有；可搜索）"
          items={visibleImportItems}
          selectedIds={importSelectedIds}
          emptyText={importQuery
            ? '没有匹配的 SOP，试试别的关键词'
            : '没有可复制的 SOP（来源为空，或都已拥有）'}
          note={
            <div>
              <div style={{ marginBottom: 8 }}>
                目标固定为当前专家 scope，不会让你在几百条里「绑员工」。
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={11} />
                <input
                  value={importQuery}
                  onChange={(e) => setImportQuery(e.target.value)}
                  placeholder="在可选项中搜索…"
                  style={{
                    flex: 1, padding: '5px 8px', borderRadius: 4,
                    border: '1px solid var(--border)', fontSize: 11, fontFamily: 'inherit',
                    background: 'var(--bg-input)', color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>
          }
          errorText={importError}
          onSourceChange={(v) => { void onImportSourceChange(v) }}
          onSelectedChange={setImportSelectedIds}
          onClose={() => { setImportOpen(false); setImportError('') }}
          onSubmit={() => { void submitImport() }}
        />
      )}
    </div>
  )
}
