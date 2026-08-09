import { useState, useEffect } from 'react'
import { Zap, Search as SearchIcon, Upload, Plus, ToggleLeft, ToggleRight, Trash2, Shield, AlertTriangle, Download, CheckCircle } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Skill, SkillSearchResult } from '../lib/skill-types'
import { ConfirmDialog } from './ConfirmDialog'
import { panelRootStyle } from '../lib/panel-layout'

const ipc = createIpcClient()

interface Props {
  onClose: () => void
}

export function SkillMarketPanel({ onClose }: Props) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SkillSearchResult[]>([])
  const [activeTab, setActiveTab] = useState<'installed' | 'discover' | 'create'>('installed')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchMode, setBatchMode] = useState(false)
  const [createDesc, setCreateDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [showSecurity, setShowSecurity] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmUninstallId, setConfirmUninstallId] = useState<string | null>(null)
  const [confirmBatchUninstall, setConfirmBatchUninstall] = useState(false)

  useEffect(() => {
    loadSkills()
  }, [])

  async function loadSkills() {
    const list = (await ipc.invoke(IPC_CHANNELS.SKILL_LIST)) as Skill[]
    setSkills(list)
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    const results = (await ipc.invoke(IPC_CHANNELS.SKILL_SEARCH, searchQuery)) as SkillSearchResult[]
    setSearchResults(results)
  }

  async function handleInstall(skillId: string) {
    const result = await ipc.invoke(IPC_CHANNELS.SKILL_INSTALL, skillId) as { success: boolean; error?: string; warnings?: string[] }
    if (result.success) {
      setToast('技能安装成功！')
      setTimeout(() => setToast(null), 2000)
      loadSkills()
    } else {
      setToast(result.error || '安装失败')
      setTimeout(() => setToast(null), 3000)
    }
  }

  async function handleUninstall(skillId: string) {
    await ipc.invoke(IPC_CHANNELS.SKILL_UNINSTALL, skillId)
    loadSkills()
  }

  async function handleToggle(skillId: string, enabled: boolean) {
    await ipc.invoke(IPC_CHANNELS.SKILL_TOGGLE, skillId, enabled)
    loadSkills()
  }

  async function handleBatchUninstall() {
    if (selectedIds.size === 0) return
    await ipc.invoke(IPC_CHANNELS.SKILL_BATCH_UNINSTALL, [...selectedIds])
    setSelectedIds(new Set())
    setBatchMode(false)
    loadSkills()
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  async function handleCreate() {
    if (!createDesc.trim()) return
    setCreating(true)
    await ipc.invoke(IPC_CHANNELS.SKILL_CREATE, createDesc)
    setCreating(false)
    setCreateDesc('')
    setToast('技能已创建！')
    setTimeout(() => setToast(null), 2000)
    loadSkills()
  }

  async function handleUpload() {
    // In a real Electron app, we'd use dialog.showOpenDialog
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.skill,.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      // Show security scan first
      const text = await file.text()
      try {
        const pkg = JSON.parse(text)
        const warnings: string[] = []
        for (const perm of (pkg.permissions || [])) {
          if (perm.type === 'file-delete') warnings.push('文件删除权限')
          if (perm.type === 'shell') warnings.push('Shell命令执行权限')
          if (perm.type === 'external-api') warnings.push('第三方API访问权限')
          if (perm.type === 'browser') warnings.push('浏览器控制权限')
          if (perm.type === 'clipboard') warnings.push('剪贴板访问权限')
        }
        if (warnings.length > 0) {
          setShowSecurity(warnings.join('、'))
        }
      } catch {
        setToast('无法解析技能包文件')
        setTimeout(() => setToast(null), 3000)
      }
    }
    input.click()
  }

  const installedSkills = skills.filter((s) => s.installed)
  const discoverSkills = searchResults.length > 0 ? searchResults : []

  return (
    <div style={panelRootStyle()}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>技能市场</span>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭技能市场" style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>×</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        {(['installed', 'discover', 'create'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); if (tab !== 'discover') setSearchResults([]) }}
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tab === 'installed' ? '我的技能' : tab === 'discover' ? '发现技能' : '创建技能'}
          </button>
        ))}
      </div>

      {/* Security Warning Banner */}
      {showSecurity && (
        <div style={{ margin: '8px 12px', padding: '8px 12px', borderRadius: 6, background: 'var(--warning-bg)', border: '1px solid var(--warning)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <AlertTriangle size={14} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)', marginBottom: 2 }}>安全警告</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                该技能包含以下权限: {showSecurity}。安装前请仔细查看权限申请、来源说明和脚本内容。涉及文件删除、批量写入操作时，建议先小范围验证。
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button
                  onClick={() => setShowSecurity(null)}
                  style={{ padding: '3px 10px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  已知风险，继续安装
                </button>
                <button
                  onClick={() => setShowSecurity(null)}
                  style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search bar (discover tab) */}
      {activeTab === 'discover' && (
        <div style={{ padding: '10px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-input)', borderRadius: 6, padding: '6px 10px', flex: 1 }}>
              <SearchIcon size={12} color="var(--text-tertiary)" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                name="skill-search"
                aria-label="搜索技能"
                placeholder="输入任务描述，自动查找相关技能（如：我需要处理PDF）…"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit' }}
              />
            </div>
            <button
              onClick={handleSearch}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              查找
            </button>
          </div>
        </div>
      )}

      {/* Batch mode bar */}
      {activeTab === 'installed' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => setBatchMode(!batchMode)}
              style={{
                padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)',
                background: batchMode ? 'var(--accent-light)' : 'transparent',
                color: batchMode ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {batchMode ? '退出批量' : '批量管理'}
            </button>
            <button onClick={handleUpload} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Upload size={11} /> 上传技能
            </button>
          </div>
          {batchMode && selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setConfirmBatchUninstall(true)}
              style={{
                padding: '3px 10px', borderRadius: 4, border: '1px solid var(--danger)',
                background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Trash2 size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} aria-hidden="true" />
              批量卸载 ({selectedIds.size})
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {/* Installed Skills */}
        {activeTab === 'installed' && (
          <>
            {installedSkills.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>暂无已安装技能</div>
            )}
            {installedSkills.map((skill) => (
              <div
                key={skill.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
                  background: 'var(--bg-card)', marginBottom: 6, border: '1px solid var(--border)',
                  opacity: skill.enabled ? 1 : 0.5,
                }}
              >
                {batchMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(skill.id)}
                    onChange={() => toggleSelect(skill.id)}
                    style={{ flexShrink: 0 }}
                  />
                )}
                <div style={{
                  width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--accent-light)', flexShrink: 0,
                }}>
                  <Zap size={14} color="var(--accent)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{skill.name}</span>
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>{skill.category}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>v{skill.version}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{skill.description}</div>
                  {skill.permissions && skill.permissions.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
                      {skill.permissions.map((p, i) => (
                        <span key={i} style={{ fontSize: 9, padding: '1px 4px', borderRadius: 2, background: p.granted ? 'var(--success-bg)' : 'var(--danger-bg)', color: p.granted ? 'var(--success)' : 'var(--danger)' }}>
                          {p.description}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {!batchMode && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleToggle(skill.id, !skill.enabled)}
                        aria-label={skill.enabled ? `禁用技能 ${skill.name}` : `启用技能 ${skill.name}`}
                        style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', color: skill.enabled ? 'var(--success)' : 'var(--text-tertiary)' }}
                      >
                        {skill.enabled ? <ToggleRight size={18} aria-hidden="true" /> : <ToggleLeft size={18} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmUninstallId(skill.id)}
                        style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        卸载
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Discover Skills */}
        {activeTab === 'discover' && (
          <>
            {searchResults.length === 0 && searchQuery && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>搜索中…</div>
            )}
            {!searchQuery && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
                输入任务描述（如"处理PDF""数据分析"），自动推荐相关技能
              </div>
            )}
            {searchResults.map(({ skill, relevance, matchReason }) => (
              <div
                key={skill.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
                  background: 'var(--bg-card)', marginBottom: 6, border: '1px solid var(--border)',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--accent-light)', flexShrink: 0,
                }}>
                  <Zap size={14} color="var(--accent)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{skill.name}</span>
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--accent-light)', color: 'var(--accent)' }}>
                      匹配度 {relevance}%
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{skill.description}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {skill.author} · {matchReason}
                  </div>
                  {skill.securityWarnings && skill.securityWarnings.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--warning)', marginTop: 2 }}>
                      <AlertTriangle size={10} />
                      {skill.securityWarnings[0]}
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0 }}>
                  {skill.installed ? (
                    <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <CheckCircle size={12} /> 已安装
                    </span>
                  ) : (
                    <button
                      onClick={() => handleInstall(skill.id)}
                      style={{
                        padding: '4px 12px', borderRadius: 4, border: 'none',
                        background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      安装
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Create Skill */}
        {activeTab === 'create' && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              输入任务描述，BspBuddy 将自动为你创建对应的技能
            </div>
            <textarea
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              placeholder="描述你需要的技能，例如：自动抓取指定网页内容并整理为Markdown格式"
              rows={5}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                fontSize: 12, fontFamily: 'inherit', resize: 'vertical', color: 'var(--text-primary)',
                background: 'var(--bg-input)',
              }}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !createDesc.trim()}
              style={{
                marginTop: 12, padding: '8px 20px', borderRadius: 6, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', opacity: creating || !createDesc.trim() ? 0.5 : 1,
              }}
            >
              {creating ? '创建中…' : '创建技能'}
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 16px', borderRadius: 8, background: 'var(--text-primary)', color: '#fff',
          fontSize: 12, boxShadow: 'var(--shadow-lg)', zIndex: 100,
        }}>
          {toast}
        </div>
      )}
      {confirmUninstallId && (
        <ConfirmDialog
          title="确认卸载"
          message="卸载后将移除该技能，确定要继续吗？"
          confirmLabel="确认卸载"
          onConfirm={() => {
            const id = confirmUninstallId
            setConfirmUninstallId(null)
            void handleUninstall(id)
          }}
          onCancel={() => setConfirmUninstallId(null)}
        />
      )}
      {confirmBatchUninstall && (
        <ConfirmDialog
          title="确认批量卸载"
          message={`将卸载已选中的 ${selectedIds.size} 个技能，此操作不可撤销。`}
          confirmLabel="确认卸载"
          onConfirm={() => {
            setConfirmBatchUninstall(false)
            void handleBatchUninstall()
          }}
          onCancel={() => setConfirmBatchUninstall(false)}
        />
      )}
    </div>
  )
}
