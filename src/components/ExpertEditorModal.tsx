import { useState, useEffect } from 'react'
import { User, FileText, Save, Cpu } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Expert, ExpertStatus } from '../lib/expert-types'
import type { ExpertModelCatalogEntry } from '../lib/expert-model-types'

const ipc = createIpcClient()

interface Props {
  expert: Expert | null
  onClose: () => void
  isAdmin?: boolean
}

type EditorTab = 'basic' | 'persona' | 'model'

const TABS: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
  { id: 'basic', label: '基础信息', icon: <User size={12} /> },
  { id: 'persona', label: '人设', icon: <FileText size={12} /> },
  { id: 'model', label: '模型', icon: <Cpu size={12} /> },
]

export function ExpertEditorModal({ expert, onClose, isAdmin = true }: Props) {
  const isNew = !expert
  const [activeTab, setActiveTab] = useState<EditorTab>('basic')

  const [name, setName] = useState(expert?.name || '')
  const [title, setTitle] = useState(expert?.title || '')
  const [description, setDescription] = useState(expert?.description || '')
  const [avatar, setAvatar] = useState(expert?.avatar || '')
  const [persona, setPersona] = useState(expert?.persona || '')
  const [methodology, setMethodology] = useState(expert?.methodology || '')
  const [categories, setCategories] = useState<string[]>(expert?.categories || [])
  const [newCategory, setNewCategory] = useState('')
  const [selectedModelId, setSelectedModelId] = useState(expert?.bindings?.expertModelCatalogId || expert?.bindings?.modelId || '')
  const [catalogEntries, setCatalogEntries] = useState<ExpertModelCatalogEntry[]>([])

  useEffect(() => {
    async function loadModels() {
      try {
        const entries = await ipc.invoke(IPC_CHANNELS.EXPERT_MODEL_CATALOG_LIST) as ExpertModelCatalogEntry[]
        const list = Array.isArray(entries) ? entries : []
        setCatalogEntries(list)
        // Auto-select default if no model is bound yet
        if (!selectedModelId) {
          const def = list.find(e => e.is_default && e.enabled) || list.find(e => e.enabled)
          if (def) {
            setSelectedModelId(def.id)
          }
        }
      } catch {
        // Non-blocking
      }
    }
    loadModels()
  }, [])

  async function handleSave(status: ExpertStatus) {
    const expertObj: Expert = {
      id: expert?.id || '',
      name,
      title,
      description,
      avatar: avatar || undefined,
      persona,
      methodology,
      toolChain: [],
      skills: [],
      categories,
      examples: [],
      isCustom: expert?.isCustom || true,
      status,
      isOverall: expert?.isOverall || false,
      bindings: {
        ...(expert?.bindings || { sopSkills: [], skills: [], mcpServers: [], knowledgeBases: [], connectors: [] }),
        expertModelCatalogId: selectedModelId || undefined,
      },
      createdAt: expert?.createdAt,
      updatedAt: Date.now(),
      rating: expert?.rating,
      usageCount: expert?.usageCount,
    }

    // Always use IPC — ensures model binding sync happens
    if (isNew) {
      await ipc.invoke(IPC_CHANNELS.EXPERT_CREATE, expertObj)
    } else {
      await ipc.invoke(IPC_CHANNELS.EXPERT_UPDATE, expertObj)
    }
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-overlay="true"
      style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      overscrollBehavior: 'contain',
    }} onClick={onClose}>
      <div style={{
        width: '800px', maxWidth: '90vw', height: '550px', maxHeight: '85vh',
        background: 'var(--bg-card)', borderRadius: 12, display: 'flex', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overscrollBehavior: 'contain',
      }} onClick={(e) => e.stopPropagation()}>
        {/* Left Tabs */}
        <div style={{
          width: 120, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', padding: '12px 0', flexShrink: 0,
        }}>
          <div style={{ padding: '0 10px 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <User size={13} color="var(--accent)" />
            {isNew ? '新建专家' : '编辑专家'}
          </div>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', border: 'none', background: activeTab === tab.id ? 'var(--bg-hover)' : 'none',
                cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab.id ? 600 : 400,
                borderRight: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                textAlign: 'left' as const,
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Content area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {activeTab === 'basic' && (
              <EditorSection label="基础信息">
                <Field id="expert-name" label="名称 *" value={name} onChange={setName} placeholder="如：法律顾问" />
                <Field id="expert-title" label="头衔" value={title} onChange={setTitle} placeholder="如：法律咨询专家" />
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="expert-description" style={labelStyle}>描述 *</label>
                  <textarea id="expert-description" name="expert-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述该专家的能力和适用场景" rows={2}
                    style={textareaStyle}
                  />
                </div>
                <Field id="expert-avatar" label="头像 URL" value={avatar} onChange={setAvatar} placeholder="可选" />
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="expert-category" style={labelStyle}>分类标签</label>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {categories.map((c, i) => (
                      <span key={i} style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 3,
                        background: 'var(--accent-light)', color: 'var(--accent)',
                        display: 'inline-flex', alignItems: 'center', gap: 2,
                      }}>
                        {c} <button type="button" onClick={() => setCategories(categories.filter((_, j) => j !== i))} aria-label={`移除分类 ${c}`} style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 10 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input id="expert-category" name="expert-category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newCategory.trim()) { setCategories([...categories, newCategory.trim()]); setNewCategory('') } }}
                      placeholder="添加分类…" style={inputStyle}
                    />
                    <button type="button" onClick={() => { if (newCategory.trim()) { setCategories([...categories, newCategory.trim()]); setNewCategory('') } }}
                      style={{ padding: '5px 12px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                    >添加</button>
                  </div>
                </div>
              </EditorSection>
            )}

            {activeTab === 'persona' && (
              <EditorSection label="人设 (System Prompt)">
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="expert-persona" style={labelStyle}>人设</label>
                  <textarea id="expert-persona" name="expert-persona" value={persona} onChange={(e) => setPersona(e.target.value)}
                    placeholder="定义专家的人格、知识背景和行为风格，将作为 System Prompt 注入对话"
                    rows={8}
                    style={textareaStyle}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="expert-methodology" style={labelStyle}>方法论</label>
                  <input id="expert-methodology" name="expert-methodology" value={methodology} onChange={(e) => setMethodology(e.target.value)}
                    placeholder="如：SWOT分析 + 案例研究 + 法规检索"
                    style={inputStyle}
                  />
                </div>
              </EditorSection>
            )}

            {activeTab === 'model' && (
              <EditorSection label="专家专属模型">
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.6 }}>
                  专家运行在<strong>服务器端</strong>，使用独立的 agent loop。模型来自 <strong>专家模型目录</strong>（管理员在「设置 → 专家模型」中维护）。
                </p>

                {/* Read-only for non-admin editing existing expert */}
                {!isNew && !isAdmin && selectedModelId && catalogEntries.length > 0 && (
                  <div>
                    <div style={{
                      padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--bg-input)', marginBottom: 8,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {catalogEntries.find(e => e.id === selectedModelId)?.name || '已绑定模型'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {catalogEntries.find(e => e.id === selectedModelId)?.model || selectedModelId}
                      </div>
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                      <span aria-hidden="true">ⓘ</span> 如需更换模型，请联系管理员。
                    </p>
                  </div>
                )}

                {/* Read-only for non-admin editing when no model selected */}
                {!isNew && !isAdmin && !selectedModelId && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                    未绑定模型。服务器端将自动使用租户<a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>默认专家模型</a>。
                  </div>
                )}

                {/* Selectable list: new expert OR admin editing */}
                {(isNew || isAdmin) && (
                  <>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                      {isNew ? '从管理员维护的模型目录中选择一个作为此专家的专属引擎。' : '更换此专家的专属模型。'}
                      <span style={{ color: '#f59e0b' }}>★ 标记</span>的为租户默认模型。
                    </p>

                    {catalogEntries.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        {catalogEntries.map((e) => (
                          <div
                            key={e.id}
                            onClick={() => setSelectedModelId(e.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 14px', borderRadius: 7,
                              border: selectedModelId === e.id ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                              background: selectedModelId === e.id ? 'var(--accent-light)' : 'var(--bg-input)',
                              cursor: 'pointer', marginBottom: 6,
                              opacity: e.enabled ? 1 : 0.5,
                              transition: 'border-color 0.15s',
                            }}
                          >
                            <div style={{
                              width: 10, height: 10, borderRadius: '50%',
                              border: selectedModelId === e.id ? '3px solid var(--accent)' : '2px solid var(--text-tertiary)',
                              background: selectedModelId === e.id ? 'var(--accent)' : 'transparent',
                              flexShrink: 0,
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {e.name}
                                {e.is_default && (
                                  <span style={{ fontSize: 10, fontWeight: 500, color: '#f59e0b', background: 'rgba(245,158,11,.1)', borderRadius: 4, padding: '0 6px', lineHeight: '18px' }}>默认</span>
                                )}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                                {e.model} · {e.provider}
                                {!e.enabled && ' · 已停用'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {catalogEntries.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
                        暂无专家模型。请联系管理员在「设置 → 专家模型」中添加模型。
                      </div>
                    )}
                  </>
                )}
              </EditorSection>
            )}
          </div>

          {/* Bottom bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, gap: 8,
          }}>
            <button onClick={onClose}
              style={{
                padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                color: 'var(--text-secondary)',
              }}
            >取消</button>
            <button onClick={() => handleSave('draft')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                color: 'var(--text-secondary)',
              }}
            ><Save size={12} /> 保存草稿</button>
            <button onClick={() => handleSave('online')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '7px 16px', borderRadius: 6, border: 'none',
                background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
              }}
            >上线</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditorSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>{label}</div>
      {children}
    </div>
  )
}

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <input id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
  display: 'block', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
  fontSize: 12, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-input)',
}

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
  fontSize: 12, fontFamily: 'inherit', resize: 'vertical', color: 'var(--text-primary)', background: 'var(--bg-input)',
}
