import { useState } from 'react'
import {
  Gift, ChevronRight, FolderOpen, Check, Plus, Globe, Mic,
  Send, FileText, Landmark, BarChart3, Microscope, Video,
  Presentation, ClipboardList, Code, Palette, X,
} from 'lucide-react'
import type { ModelOption } from '../lib/types'
import { AVAILABLE_MODELS } from '../lib/types'

interface Props {
  onPrompt: (text: string) => void
  onSceneChange?: (scene: string) => void
  onSkillClick?: (skillId: string) => void
  onSelectWorkspace?: () => void
  workspacePath?: string
  modelId?: string
  models?: ModelOption[]
  onModelChange?: (model: ModelOption) => void
}

const SCENES = [
  { id: 'office', label: '日常办公', icon: null },
  { id: 'code', label: '代码开发', icon: Code },
  { id: 'design', label: '设计创意', icon: Palette },
]

const SKILLS = [
  { id: 'doc', label: '文档处理', icon: FileText, color: '#4f6ef7' },
  { id: 'finance', label: '金融服务', icon: Landmark, color: '#f59e0b' },
  { id: 'data', label: '数据分析及可视化', icon: BarChart3, color: '#22c55e' },
  { id: 'research', label: '深度研究', icon: Microscope, color: '#a855f7' },
  { id: 'video', label: '视频生成', icon: Video, color: '#ef4444' },
  { id: 'slides', label: '幻灯片', icon: Presentation, color: '#ff9f0a' },
  { id: 'pm', label: '产品管理', icon: ClipboardList, color: '#5ac8fa' },
]

export function WelcomeScreen({
  onPrompt,
  onSceneChange,
  onSkillClick,
  onSelectWorkspace,
  workspacePath,
  modelId = 'deepseek-chat',
  models = AVAILABLE_MODELS,
  onModelChange,
}: Props) {
  const [activeScene, setActiveScene] = useState('office')
  const [activeSkill, setActiveSkill] = useState<string | null>(null)
  const [composerText, setComposerText] = useState('')
  const [modelOpen, setModelOpen] = useState(false)

  const currentModel = models.find((m) => m.id === modelId) || models[0]

  const handleSceneClick = (sceneId: string) => {
    setActiveScene(sceneId)
    onSceneChange?.(sceneId)
  }

  const handleSkillClick = (skillId: string) => {
    const wasActive = activeSkill === skillId
    if (wasActive) {
      setActiveSkill(null)
    } else {
      setActiveSkill(skillId)
    }
    onSkillClick?.(skillId)
  }

  const handleSend = () => {
    const text = composerText.trim()
    if (!text) return
    onPrompt(text)
    setComposerText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px 60px' }}>
        {/* Top Right Promo */}
        <div style={{
          position: 'absolute', top: 12, right: 16,
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer',
          padding: '4px 8px', borderRadius: 12,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <Gift size={13} color="#f59e0b" />
          <span>做任务赢积分好礼</span>
          <ChevronRight size={11} />
        </div>

        {/* Hero Title */}
        <div style={{ textAlign: 'center', marginBottom: 28, marginTop: 20 }}>
          <h1 style={{
            fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 4,
            letterSpacing: '-.5px', color: 'var(--text-primary)',
          }}>
            BspBuddy, 我帮你
          </h1>
        </div>

        {/* Scene Tabs */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 4,
          marginBottom: 24,
        }}>
          {SCENES.map((scene) => {
            const isActive = activeScene === scene.id
            const Icon = scene.icon
            return (
              <button
                key={scene.id}
                onClick={() => handleSceneClick(scene.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 16px', borderRadius: 20,
                  border: isActive ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: 12, fontWeight: isActive ? 600 : 400,
                  fontFamily: 'inherit',
                  background: isActive ? 'var(--text-primary)' : 'var(--bg-card)',
                  color: isActive ? 'var(--bg-root)' : 'var(--text-secondary)',
                  transition: 'all .15s',
                }}
              >
                {Icon && <Icon size={13} />}
                {scene.label}
              </button>
            )
          })}
        </div>

        {/* Skill Icon Row */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8,
          marginBottom: 24, flexWrap: 'wrap',
        }}>
          {SKILLS.map((skill) => {
            const isSelected = activeSkill === skill.id
            return (
              <button
                key={skill.id}
                onClick={() => handleSkillClick(skill.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 10px', borderRadius: 10,
                  border: isSelected ? `1px solid ${skill.color}` : '1px solid transparent',
                  background: isSelected ? `${skill.color}10` : 'none',
                  cursor: 'pointer', fontSize: 11,
                  color: 'var(--text-secondary)',
                  fontFamily: 'inherit', minWidth: 64,
                  transition: 'all .15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${skill.color}10`
                  e.currentTarget.style.borderColor = skill.color
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'none'
                    e.currentTarget.style.borderColor = 'transparent'
                  }
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `${skill.color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <skill.icon size={16} color={skill.color} />
                </div>
                <span style={{ lineHeight: 1.3, textAlign: 'center' }}>{skill.label}</span>
              </button>
            )
          })}
        </div>

        {/* Composer Card */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 16,
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
          marginBottom: 12,
        }}>
          {/* Skill Chip */}
          {activeSkill && (
            <div style={{ padding: '10px 16px 0' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 12,
                background: '#22c55e18', color: '#22c55e',
                fontSize: 12, fontWeight: 500, border: '1px solid #22c55e30',
              }}>
                Skill {activeSkill}
                <button
                  onClick={() => setActiveSkill(null)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#22c55e', padding: 0, marginLeft: 2,
                  }}
                >
                  <X size={11} />
                </button>
              </span>
            </div>
          )}

          {/* Textarea */}
          <textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你的任务，BspBuddy 帮你完成..."
            style={{
              width: '100%', minHeight: 80, padding: '14px 16px',
              border: 'none', outline: 'none', resize: 'none',
              fontSize: 14, color: 'var(--text-primary)',
              background: 'transparent', fontFamily: 'inherit',
              lineHeight: 1.6,
            }}
          />

          {/* Composer Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px 12px',
            borderTop: '1px solid var(--border)',
          }}>
            {/* Left: attachment button */}
            <button
              title="添加附件"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', padding: 0,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <Plus size={16} />
            </button>

            {/* Right: controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Globe button */}
              <button
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', padding: 0,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <Globe size={15} />
              </button>

              {/* Model Selector */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setModelOpen(!modelOpen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 8,
                    background: 'var(--bg-hover)', border: '1px solid var(--border)',
                    cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)',
                    fontFamily: 'inherit',
                  }}
                >
                  {currentModel?.name || 'Model'}
                  <span style={{ fontSize: 9, opacity: 0.5 }}>∨</span>
                </button>
                {modelOpen && (
                  <div
                    style={{
                      position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
                      background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
                      zIndex: 100, minWidth: 160, padding: '4px 0',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          onModelChange?.(m)
                          setModelOpen(false)
                        }}
                        style={{
                          width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                          padding: '6px 14px', border: 'none', background: m.id === modelId ? 'var(--bg-hover)' : 'none',
                          cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                          color: m.id === modelId ? 'var(--accent)' : 'var(--text-primary)',
                          fontWeight: m.id === modelId ? 600 : 400,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={(e) => { if (m.id !== modelId) e.currentTarget.style.background = 'none' }}
                      >
                        <span>{m.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{m.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mic button */}
              <button
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', padding: 0,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <Mic size={15} />
              </button>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!composerText.trim()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: '50%',
                  background: composerText.trim() ? 'var(--text-primary)' : 'var(--bg-input)',
                  border: 'none', cursor: composerText.trim() ? 'pointer' : 'default',
                  color: composerText.trim() ? 'var(--bg-root)' : 'var(--text-tertiary)',
                  padding: 0, transition: 'all .15s',
                }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Below Composer: Workspace + Permission */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
        }}>
          <button
            onClick={onSelectWorkspace}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <FolderOpen size={13} />
            {workspacePath ? (
              <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {workspacePath.split(/[/\\]/).pop() || workspacePath}
              </span>
            ) : (
              <span>选择工作空间</span>
            )}
            <span style={{ fontSize: 9, opacity: 0.5 }}>∨</span>
          </button>

          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <Check size={13} />
            <span>默认权限</span>
            <span style={{ fontSize: 9, opacity: 0.5 }}>∨</span>
          </button>

          {/* Activity Card placeholder */}
          <div style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Gift size={12} color="#f59e0b" />
            <span>活动</span>
          </div>
        </div>
      </div>
    </div>
  )
}
