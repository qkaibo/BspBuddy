import { useState } from 'react'
import { X, Send, User, FileText, Zap, Network, BookOpen, Link, Cpu, Play, Save } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Expert, ExpertBindings, ExpertStatus } from '../lib/expert-types'

const ipc = createIpcClient()

interface Props {
  expert: Expert | null
  onClose: () => void
}

type EditorTab = 'basic' | 'persona' | 'sopSkills' | 'skills' | 'mcp' | 'knowledge' | 'connectors' | 'model'

const TABS: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
  { id: 'basic', label: '基础信息', icon: <User size={12} /> },
  { id: 'persona', label: '人设', icon: <FileText size={12} /> },
  { id: 'sopSkills', label: 'SOP技能', icon: <Zap size={12} /> },
  { id: 'skills', label: 'Skill', icon: <Zap size={12} /> },
  { id: 'mcp', label: 'MCP', icon: <Network size={12} /> },
  { id: 'knowledge', label: '知识库', icon: <BookOpen size={12} /> },
  { id: 'connectors', label: '连接器', icon: <Link size={12} /> },
  { id: 'model', label: '模型', icon: <Cpu size={12} /> },
]

export function ExpertEditorModal({ expert, onClose }: Props) {
  const isNew = !expert
  const [activeTab, setActiveTab] = useState<EditorTab>('basic')
  const [testRunOpen, setTestRunOpen] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [testResponse, setTestResponse] = useState('')

  const [name, setName] = useState(expert?.name || '')
  const [title, setTitle] = useState(expert?.title || '')
  const [description, setDescription] = useState(expert?.description || '')
  const [avatar, setAvatar] = useState(expert?.avatar || '')
  const [persona, setPersona] = useState(expert?.persona || '')
  const [methodology, setMethodology] = useState(expert?.methodology || '')
  const [categories, setCategories] = useState<string[]>(expert?.categories || [])
  const [newCategory, setNewCategory] = useState('')
  const [bindings, setBindings] = useState<ExpertBindings>(expert?.bindings || {
    sopSkills: [],
    skills: [],
    mcpServers: [],
    knowledgeBases: [],
    connectors: [],
    modelId: undefined,
  })

  function updateBindings<K extends keyof ExpertBindings>(key: K, value: ExpertBindings[K]) {
    setBindings((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(status: ExpertStatus) {
    const payload: Partial<Expert> & { name: string; description: string; persona: string } = {
      name, title, description, avatar: avatar || undefined,
      persona, methodology,
      categories,
      bindings,
      status,
      isOverall: expert?.isOverall || false,
    }
    if (isNew) {
      await ipc.invoke(IPC_CHANNELS.EXPERT_CREATE, payload)
    } else {
      await ipc.invoke(IPC_CHANNELS.EXPERT_UPDATE, { ...expert!, ...payload })
    }
    onClose()
  }

  async function handleTestRun() {
    if (!testMessage.trim()) return
    setTestRunOpen(true)
    try {
      const result = await ipc.invoke(IPC_CHANNELS.EXPERT_TEST_RUN, {
        persona,
        methodology,
        bindings,
        message: testMessage,
      }) as { response: string }
      setTestResponse(result?.response || '(无响应)')
    } catch {
      setTestResponse('Test Run 暂不可用（需要后端 Agent 支持）')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        width: '800px', maxWidth: '90vw', height: '550px', maxHeight: '85vh',
        background: 'var(--bg-card)', borderRadius: 12, display: 'flex', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
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
                <Field label="名称 *" value={name} onChange={setName} placeholder="如：法律顾问" />
                <Field label="头衔" value={title} onChange={setTitle} placeholder="如：法律咨询专家" />
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>描述 *</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述该专家的能力和适用场景" rows={2}
                    style={textareaStyle}
                  />
                </div>
                <Field label="头像 URL" value={avatar} onChange={setAvatar} placeholder="可选" />
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>分类标签</label>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {categories.map((c, i) => (
                      <span key={i} style={chipStyle('var(--accent-light)', 'var(--accent)')}>
                        {c} <button onClick={() => setCategories(categories.filter((_, j) => j !== i))} style={removeBtnStyle}>x</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newCategory.trim()) { setCategories([...categories, newCategory.trim()]); setNewCategory('') } }}
                      placeholder="添加分类..." style={inputStyle}
                    />
                    <button onClick={() => { if (newCategory.trim()) { setCategories([...categories, newCategory.trim()]); setNewCategory('') } }}
                      style={addBtnStyle}
                    >添加</button>
                  </div>
                </div>
              </EditorSection>
            )}

            {activeTab === 'persona' && (
              <EditorSection label="人设 (System Prompt)">
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>人设</label>
                  <textarea value={persona} onChange={(e) => setPersona(e.target.value)}
                    placeholder="定义专家的人格、知识背景和行为风格，将作为 System Prompt 注入对话"
                    rows={8}
                    style={textareaStyle}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>方法论</label>
                  <input value={methodology} onChange={(e) => setMethodology(e.target.value)}
                    placeholder="如：SWOT分析 + 案例研究 + 法规检索"
                    style={inputStyle}
                  />
                </div>
              </EditorSection>
            )}

            {activeTab === 'sopSkills' && (
              <BindingListEditor label="绑定的 SOP 技能" ids={bindings.sopSkills} onChange={(v) => updateBindings('sopSkills', v)} />
            )}

            {activeTab === 'skills' && (
              <BindingListEditor label="绑定的 Skill" ids={bindings.skills} onChange={(v) => updateBindings('skills', v)} />
            )}

            {activeTab === 'mcp' && (
              <BindingListEditor label="绑定的 MCP 服务器" ids={bindings.mcpServers} onChange={(v) => updateBindings('mcpServers', v)} />
            )}

            {activeTab === 'knowledge' && (
              <BindingListEditor label="绑定的知识库" ids={bindings.knowledgeBases} onChange={(v) => updateBindings('knowledgeBases', v)} />
            )}

            {activeTab === 'connectors' && (
              <BindingListEditor label="绑定的连接器" ids={bindings.connectors} onChange={(v) => updateBindings('connectors', v)} />
            )}

            {activeTab === 'model' && (
              <EditorSection label="模型绑定">
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>模型 ID（留空使用全局默认）</label>
                  <select value={bindings.modelId || ''} onChange={(e) => updateBindings('modelId', e.target.value || undefined)}
                    style={inputStyle}
                  >
                    <option value="">全局默认</option>
                    <option value="deepseek-chat">DeepSeek</option>
                    <option value="hunyuan">腾讯混元</option>
                    <option value="glm-4">智谱 GLM</option>
                    <option value="kimi">Kimi</option>
                    <option value="minimax">MiniMax</option>
                  </select>
                </div>
              </EditorSection>
            )}

            {/* Test Run section */}
            {testRunOpen && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Play size={12} /> Test Run
                </div>
                {testResponse ? (
                  <div style={{ padding: '10px', borderRadius: 6, background: 'var(--bg-input)', fontSize: 11, color: 'var(--text-secondary)', maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    {testResponse}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={testMessage} onChange={(e) => setTestMessage(e.target.value)} placeholder="输入测试消息..."
                      style={{ flex: 1, ...inputStyle }}
                    />
                    <button onClick={handleTestRun} disabled={!testMessage.trim()}
                      style={{ ...addBtnStyle, opacity: testMessage.trim() ? 1 : 0.5 }}
                    >
                      <Send size={11} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, gap: 8,
          }}>
            <button onClick={() => setTestRunOpen(!testRunOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                color: 'var(--text-secondary)',
              }}
            >
              <Play size={12} /> Test Run
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
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

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  )
}

function BindingListEditor({ label, ids, onChange }: { label: string; ids: string[]; onChange: (v: string[]) => void }) {
  const [newId, setNewId] = useState('')

  return (
    <EditorSection label={label}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {ids.map((id, i) => (
          <span key={i} style={chipStyle('var(--success-bg)', 'var(--success)')}>
            {id} <button onClick={() => onChange(ids.filter((_, j) => j !== i))} style={removeBtnStyle}>x</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input value={newId} onChange={(e) => setNewId(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newId.trim()) { onChange([...ids, newId.trim()]); setNewId('') } }}
          placeholder={`输入 ${label} ID...`}
          style={inputStyle}
        />
        <button onClick={() => { if (newId.trim()) { onChange([...ids, newId.trim()]); setNewId('') } }}
          style={addBtnStyle}
        >添加</button>
      </div>
    </EditorSection>
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

const addBtnStyle: React.CSSProperties = {
  padding: '5px 12px', borderRadius: 4, border: 'none',
  background: 'var(--accent)', color: '#fff', fontSize: 11,
  cursor: 'pointer', fontFamily: 'inherit',
}

const removeBtnStyle: React.CSSProperties = {
  marginLeft: 4, background: 'none', border: 'none',
  cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 10,
}

function chipStyle(bg: string, color: string): React.CSSProperties {
  return {
    fontSize: 10, padding: '2px 6px', borderRadius: 3,
    background: bg, color,
    display: 'inline-flex', alignItems: 'center', gap: 2,
  }
}
