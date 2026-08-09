import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Download, Search, Trash2, Zap, Plus, Upload, Wand2, X, Edit3 } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Expert } from '../lib/expert-types'
import type { Skill, SkillUpdateParams } from '../lib/skill-types'
import { useExpertScope } from '../hooks/useExpertScope'
import { ConfirmDialog } from './ConfirmDialog'
import { panelRootStyle } from '../lib/panel-layout'

const ipc = createIpcClient()

interface SkillItem {
  id: string
  name: string
  skill_id?: string
  skillId?: string
  status?: string
  version?: string | number
  description?: string
}

/**
 * StaffDeck Skills page — Personal skill catalog
 *
 * Skills are owned by the current user (private). Only the creator can see them.
 * The creator can install their skills to any expert they manage.
 *
 * Skills come from two sources:
 * - GENERAL_SKILL_LIST (FastAPI enterprise catalog) — centrally managed
 * - SKILL_LIST (local skill-service) — per-user: builtins + user-created + uploaded
 *
 * Three ways to add skills:
 * 1. AI-generate from a natural language description
 * 2. Upload a .skill package file
 * 3. Install from enterprise catalog (FastAPI)
 */
export function SkillsPanel() {
  const { scopeId, setScopeId } = useExpertScope()
  const [experts, setExperts] = useState<Expert[]>([])
  const [allSkills, setAllSkills] = useState<SkillItem[]>([])
  const [localSkills, setLocalSkills] = useState<Skill[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createMode, setCreateMode] = useState<'describe' | 'upload'>('describe')
  const [createDescription, setCreateDescription] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---- Edit state ----
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editVersion, setEditVersion] = useState('')
  const [editPermissions, setEditPermissions] = useState<{ type: string; description: string; granted: boolean }[]>([])

  const editingSkill = useMemo(
    () => (editingSkillId ? localSkills.find((s) => s.id === editingSkillId) : null),
    [editingSkillId, localSkills],
  )

  function openEditor(id: string) {
    const s = localSkills.find((sk) => sk.id === id)
    if (!s) return
    setEditingSkillId(id)
    setEditName(s.name)
    setEditDescription(s.description)
    setEditCategory(s.category)
    setEditVersion(s.version)
    setEditPermissions(s.permissions?.map((p) => ({ ...p })) || [])
    setEditError('')
  }

  function closeEditor() {
    setEditingSkillId(null); setEditError('')
  }

  async function handleUpdateSkill() {
    if (!editingSkillId) return
    if (!editName.trim()) { setEditError('技能名称不能为空'); return }
    setEditSaving(true)
    setEditError('')
    try {
      const params: SkillUpdateParams = {
        name: editName.trim(),
        description: editDescription.trim(),
        category: editCategory.trim() || 'custom',
        version: editVersion.trim() || '0.1.0',
        permissions: editPermissions,
      }
      const result = await ipc.invoke(IPC_CHANNELS.SKILL_UPDATE, editingSkillId, params) as { success: boolean; skill?: Skill; error?: string }
      if (!result.success) { setEditError(result.error || '保存失败'); return }
      showToast(`技能 ${result.skill?.name || ''} 已更新`)
      closeEditor()
      await load()
    } catch (e) { setEditError(e instanceof Error ? e.message : '保存失败') }
    finally { setEditSaving(false) }
  }

  function togglePermission(type: string, description: string) {
    setEditPermissions((prev) => {
      const exists = prev.find((p) => p.type === type)
      if (exists) {
        return prev.filter((p) => p.type !== type)
      }
      return [...prev, { type, description, granted: true }]
    })
  }

  const allPermissionTypes: { type: string; description: string }[] = [
    { type: 'file-read', description: '读取文件' },
    { type: 'file-write', description: '写入文件' },
    { type: 'file-delete', description: '删除文件' },
    { type: 'network', description: '访问网络' },
    { type: 'shell', description: 'Shell 执行' },
    { type: 'python', description: 'Python 执行' },
    { type: 'webhook', description: 'Webhook 回调' },
    { type: 'external-api', description: '外部 API' },
    { type: 'clipboard', description: '剪贴板访问' },
    { type: 'browser', description: '浏览器控制' },
  ]

  const current = useMemo(
    () => experts.find((e) => e.id === scopeId) || experts.find((e) => !e.isOverall) || experts[0],
    [experts, scopeId],
  )

  const ownedIds = useMemo(() => new Set(current?.bindings?.skills || []), [current])

  const allPublished = useMemo(() => {
    const map = new Map<string, SkillItem>()
    for (const s of allSkills) {
      if (s.status === 'published') map.set(s.id, s)
    }
    for (const s of localSkills) {
      if (s.enabled) {
        map.set(s.id, { id: s.id, name: s.name, skillId: s.id, description: s.description, status: 'published', version: s.version })
      }
    }
    return [...map.values()]
  }, [allSkills, localSkills])

  const catalogSkills = useMemo(() => allPublished.filter((s) => !ownedIds.has(s.id)), [allPublished, ownedIds])
  const installedSkills = useMemo(() => allPublished.filter((s) => ownedIds.has(s.id)), [allPublished, ownedIds])

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return catalogSkills
    return catalogSkills.filter((s) =>
      (s.name || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q),
    )
  }, [catalogSkills, search])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [expertList, skillList, locSkills] = await Promise.all([
        ipc.invoke(IPC_CHANNELS.EXPERT_LIST) as Promise<Expert[] | { error?: string }>,
        ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_LIST) as Promise<SkillItem[] | { error?: string; items?: SkillItem[] }>,
        ipc.invoke(IPC_CHANNELS.SKILL_LIST) as Promise<Skill[]>,
      ])
      const list = Array.isArray(expertList) ? expertList : []
      setExperts(list)
      if (Array.isArray(skillList)) setAllSkills(skillList)
      else if (skillList && typeof skillList === 'object' && skillList.error) setAllSkills(Array.isArray(skillList.items) ? skillList.items : [])
      setLocalSkills(Array.isArray(locSkills) ? locSkills : [])
      if (!scopeId || !list.some((e) => e.id === scopeId)) {
        const fallback = list.find((e) => !e.isOverall) || list[0]
        if (fallback) setScopeId(fallback.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [scopeId, setScopeId])

  useEffect(() => { void load() }, [load])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2200) }

  async function installSkill(skillId: string) {
    if (!current || current.isOverall) return
    const result = await ipc.invoke(IPC_CHANNELS.RESOURCE_IMPORT, {
      targetAgentId: current.id, sourceAgentId: current.id,
      resourceType: 'general_skill', resourceIds: [skillId],
    }) as { status?: string; error?: string }
    if (result?.status === 'error') { setError(result.error || '安装失败'); return }
    showToast('技能已安装')
    await load()
  }

  async function removeSkill(skillId: string) {
    if (!current || current.isOverall) return
    const result = await ipc.invoke(IPC_CHANNELS.RESOURCE_UNBIND, {
      targetAgentId: current.id, resourceType: 'general_skill', resourceIds: [skillId],
    }) as { status?: string; error?: string }
    if (result?.status === 'error') { setError(result.error || '移除失败'); return }
    showToast('已从当前专家移除')
    await load()
  }

  async function handleCreateByDescription() {
    const desc = createDescription.trim()
    if (!desc) { setCreateError('请输入技能描述'); return }
    setCreateLoading(true)
    setCreateError('')
    try {
      const result = await ipc.invoke(IPC_CHANNELS.SKILL_CREATE, desc) as { success: boolean; skill?: Skill; error?: string }
      if (!result.success) { setCreateError(result.error || '创建失败'); return }
      showToast(`技能 ${result.skill?.name || ''} 已创建`)
      setCreateOpen(false)
      setCreateDescription('')
      setCreateMode('describe')
      await load()
    } catch (e) { setCreateError(e instanceof Error ? e.message : '创建失败') }
    finally { setCreateLoading(false) }
  }

  async function handleUploadPackage() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) { setCreateError('请选择 .skill 文件'); return }
    setCreateLoading(true)
    setCreateError('')
    try {
      const result = await ipc.invoke(IPC_CHANNELS.SKILL_UPLOAD, file.path) as { success: boolean; skill?: Skill; error?: string; warnings?: string[] }
      if (!result.success) { setCreateError(result.error || '上传失败'); return }
      showToast(`技能 ${result.skill?.name || ''} 已上传`)
      setCreateOpen(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setCreateMode('describe')
      await load()
    } catch (e) { setCreateError(e instanceof Error ? e.message : '上传失败') }
    finally { setCreateLoading(false) }
  }

  function closeCreate() {
    setCreateOpen(false); setCreateDescription(''); setCreateError(''); setCreateMode('describe')
  }

  const btnStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 4,
    border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer',
    fontSize: 11, fontFamily: 'inherit', color: 'var(--text-secondary)',
  }

  const installBtnStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 4,
    border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer',
    fontSize: 10, fontFamily: 'inherit', color: 'var(--accent)',
  }

  const labelStyle: CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }
  const inputStyle: CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
    fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)', boxSizing: 'border-box',
  }

  return (
    <div style={panelRootStyle({ height: 'auto', flex: 1 })}>
      {/* Scope bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        <Zap size={14} color="var(--accent)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>当前专家</span>
        <select value={current?.id || ''} onChange={(e) => setScopeId(e.target.value)} aria-label="当前专家"
          style={{ minWidth: 160, padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 11, fontFamily: 'inherit', background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
          {experts.map((e) => (<option key={e.id} value={e.id}>{e.isOverall ? `[广场] ${e.name}` : e.name}{e.title ? ` · ${e.title}` : ''}</option>))}
        </select>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>已安装 {installedSkills.length} 个</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setCreateOpen(true)} style={{ ...btnStyle, color: 'var(--accent)' }} disabled={current?.isOverall}>
          <Plus size={11} /> 创建/上传技能
        </button>
      </div>

      {/* Create/Upload dialog */}
      {createOpen && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => { setCreateMode('describe'); setCreateError('') }}
                style={{ padding: '4px 12px', borderRadius: 4, border: createMode === 'describe' ? '1px solid var(--accent)' : '1px solid var(--border)', background: createMode === 'describe' ? 'var(--accent-light)' : 'transparent', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: createMode === 'describe' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                <Wand2 size={11} style={{ marginRight: 3 }} /> AI 描述生成
              </button>
              <button onClick={() => { setCreateMode('upload'); setCreateError('') }}
                style={{ padding: '4px 12px', borderRadius: 4, border: createMode === 'upload' ? '1px solid var(--accent)' : '1px solid var(--border)', background: createMode === 'upload' ? 'var(--accent-light)' : 'transparent', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: createMode === 'upload' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                <Upload size={11} style={{ marginRight: 3 }} /> 上传技能包
              </button>
            </div>
            <button onClick={closeCreate} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}><X size={14} /></button>
          </div>

          {createMode === 'describe' ? (
            <div>
              <label htmlFor="skill-describe" style={labelStyle}>用自然语言描述你需要的技能</label>
              <textarea id="skill-describe" name="skill-describe" value={createDescription}
                onChange={(e) => { setCreateDescription(e.target.value); setCreateError('') }}
                placeholder="例如：帮我起草一份标准NDA协议，根据对方公司名称自动填充…" rows={3}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => { void handleCreateByDescription() }}
                  disabled={!createDescription.trim() || createLoading}
                  style={{ padding: '5px 14px', borderRadius: 4, border: 'none', background: createDescription.trim() && !createLoading ? 'var(--accent)' : 'var(--bg-input)', color: createDescription.trim() && !createLoading ? '#fff' : 'var(--text-tertiary)', cursor: createDescription.trim() && !createLoading ? 'pointer' : 'not-allowed', fontSize: 11, fontFamily: 'inherit' }}>
                  {createLoading ? '生成中…' : <><Wand2 size={11} style={{ marginRight: 3 }} /> AI 生成</>}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="skill-file" style={labelStyle}>选择 .skill 技能包文件</label>
              <input ref={fileInputRef} id="skill-file" name="skill-file" type="file" accept=".skill,.json"
                onChange={() => setCreateError('')} style={{ ...inputStyle, padding: '4px' }} />
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>.skill 文件为 JSON 格式，包含 name / description / permissions 等字段</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => { void handleUploadPackage() }} disabled={createLoading}
                  style={{ padding: '5px 14px', borderRadius: 4, border: 'none', background: !createLoading ? 'var(--accent)' : 'var(--bg-input)', color: !createLoading ? '#fff' : 'var(--text-tertiary)', cursor: !createLoading ? 'pointer' : 'not-allowed', fontSize: 11, fontFamily: 'inherit' }}>
                  {createLoading ? '上传中…' : <><Upload size={11} style={{ marginRight: 3 }} /> 上传安装</>}
                </button>
              </div>
            </div>
          )}
          {createError && (<div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 4 }}>{createError}</div>)}
        </div>
      )}

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        <Search size={12} color="var(--text-tertiary)" aria-hidden="true" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} name="skill-search" aria-label="搜索我的技能"
          placeholder="搜索可安装的技能…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit' }} />
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>我的技能 {(current?.isOverall ? allPublished : catalogSkills).length} 个</span>
      </div>

      {error && (<div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--danger)', flexShrink: 0 }}>{error}</div>)}

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {loading && (<div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 12 }}>加载中…</div>)}

        {/* Installed */}
        {!loading && installedSkills.length > 0 && !current?.isOverall && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              <Zap size={10} /> 已安装 ({installedSkills.length})
            </div>
            {installedSkills.map((skill) => (
              <div key={skill.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, marginBottom: 4, background: 'var(--accent-light)', border: '1px solid var(--border)' }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent)' }}>
                  <Zap size={11} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{skill.name}</div>
                  {skill.description && (<div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{skill.description}</div>)}
                </div>
                <button type="button" onClick={() => openEditor(skill.id)} title="编辑" aria-label={`编辑 ${skill.name}`}
                  style={{ ...btnStyle, padding: '3px 5px' }}><Edit3 size={11} /></button>
                <button type="button" onClick={() => setConfirmRemoveId(skill.id)} title="卸载" aria-label={`卸载 ${skill.name}`}
                  style={{ ...btnStyle, padding: '3px 5px', color: 'var(--danger)' }}><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Catalog */}
        {!loading && !current?.isOverall && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}><Plus size={10} /> 我的技能 · 点击安装到当前专家</div>
            {filteredCatalog.length === 0 && catalogSkills.length > 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 11 }}>
                {search ? '没有匹配的技能' : '所有技能都已安装'}
              </div>
            )}
            {filteredCatalog.length === 0 && catalogSkills.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 11, lineHeight: 1.6 }}>
                暂无个人技能
                <div style={{ marginTop: 8 }}>点击上方的「创建/上传技能」来添加新技能</div>
              </div>
            )}
            {filteredCatalog.map((skill) => (
              <div key={skill.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, marginBottom: 4, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-hover)' }}>
                  <Zap size={11} color="var(--text-tertiary)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{skill.name}</div>
                  {skill.description && (<div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{skill.description}</div>)}
                </div>
                <button type="button" onClick={() => openEditor(skill.id)} title="编辑" aria-label={`编辑 ${skill.name}`}
                  style={{ ...installBtnStyle, marginRight: 2 }}><Edit3 size={10} /></button>
                <button type="button" onClick={() => { void installSkill(skill.id) }} style={installBtnStyle}>
                  <Download size={10} /> 安装
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Plaza */}
        {!loading && current?.isOverall && allPublished.map((skill) => (
          <div key={skill.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 10px', borderRadius: 6, marginBottom: 4, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-hover)' }}>
              <Zap size={11} color="var(--text-tertiary)" />
            </div>
            <div><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{skill.name}</div>
              {skill.description && (<div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{skill.description}</div>)}</div>
          </div>
        ))}
      </div>

      {toast && (
        <div role="status" aria-live="polite" style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--text-primary)', color: 'var(--bg-card)', padding: '8px 14px', borderRadius: 6, fontSize: 11, zIndex: 50 }}>{toast}</div>
      )}

      {confirmRemoveId && (
        <ConfirmDialog title="确认卸载技能" message="将从当前专家卸载该技能，确定要继续吗？" confirmLabel="确认卸载"
          onConfirm={() => { const id = confirmRemoveId; setConfirmRemoveId(null); void removeSkill(id) }}
          onCancel={() => setConfirmRemoveId(null)} />
      )}

      {/* Skill Editor Modal */}
      {editingSkillId && editingSkill && (
        <div role="dialog" aria-modal="true" aria-label="编辑技能"
          style={{ position: 'absolute', inset: 0, background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <Edit3 size={14} color="var(--accent)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>编辑技能</span>
            <button onClick={closeEditor} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}><X size={16} /></button>
          </div>

          {/* Form */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label htmlFor="edit-skill-name" style={labelStyle}>名称 *</label>
                <input id="edit-skill-name" value={editName} onChange={(e) => setEditName(e.target.value)}
                  style={inputStyle} placeholder="技能名称" />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="edit-skill-category" style={labelStyle}>分类</label>
                  <input id="edit-skill-category" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
                    style={inputStyle} placeholder="custom" />
                </div>
                <div style={{ width: 100 }}>
                  <label htmlFor="edit-skill-version" style={labelStyle}>版本</label>
                  <input id="edit-skill-version" value={editVersion} onChange={(e) => setEditVersion(e.target.value)}
                    style={inputStyle} placeholder="0.1.0" />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="edit-skill-desc" style={labelStyle}>描述</label>
              <textarea id="edit-skill-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
                placeholder="技能描述…" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>权限声明</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 4 }}>
                {allPermissionTypes.map((perm) => {
                  const checked = editPermissions.some((p) => p.type === perm.type)
                  return (
                    <label key={perm.type} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 4,
                      background: checked ? 'var(--accent-light)' : 'var(--bg-hover)',
                      border: checked ? '1px solid var(--accent)' : '1px solid var(--border)',
                      cursor: 'pointer', fontSize: 11, color: 'var(--text-primary)',
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => togglePermission(perm.type, perm.description)}
                        style={{ accentColor: 'var(--accent)' }} />
                      {perm.description}
                    </label>
                  )
                })}
              </div>
            </div>

            {editError && (<div style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 12 }}>{editError}</div>)}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button onClick={closeEditor} style={{ ...btnStyle, padding: '7px 16px' }}>取消</button>
            <button onClick={() => { void handleUpdateSkill() }}
              disabled={!editName.trim() || editSaving}
              style={{ padding: '7px 20px', borderRadius: 4, border: 'none',
                background: editName.trim() && !editSaving ? 'var(--accent)' : 'var(--bg-input)',
                color: editName.trim() && !editSaving ? '#fff' : 'var(--text-tertiary)',
                cursor: editName.trim() && !editSaving ? 'pointer' : 'not-allowed',
                fontSize: 11, fontFamily: 'inherit' }}>
              {editSaving ? '保存中…' : '保存更改'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
