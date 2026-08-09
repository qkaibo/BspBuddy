import { useState } from 'react'
import {
  Gift, FolderOpen, Check, Plus, Globe, Mic,
  Send, FileText, Landmark, BarChart3, Microscope, Video,
  Presentation, ClipboardList, Code, Palette, X,
} from 'lucide-react'
import type { ModelOption } from '../lib/types'
import { ModelSelector } from './ModelSelector'

interface Props {
  onPrompt: (text: string) => void
  onSceneChange?: (scene: string) => void
  onSkillClick?: (skillId: string) => void
  onSelectWorkspace?: () => void
  workspacePath?: string
  modelId?: string
  onModelChange?: (model: ModelOption) => void
}

const SCENES = [
  { id: 'office', label: '日常办公', icon: null },
  { id: 'code', label: '代码开发', icon: Code },
  { id: 'design', label: '设计创意', icon: Palette },
]

const SKILLS = [
  { id: 'doc', label: '文档处理', icon: FileText, color: 'var(--accent)' },
  { id: 'finance', label: '金融服务', icon: Landmark, color: 'var(--warning)' },
  { id: 'data', label: '数据分析及可视化', icon: BarChart3, color: 'var(--success)' },
  { id: 'research', label: '深度研究', icon: Microscope, color: 'var(--purple)' },
  { id: 'video', label: '视频生成', icon: Video, color: 'var(--danger)' },
  { id: 'slides', label: '幻灯片', icon: Presentation, color: 'var(--warning)' },
  { id: 'pm', label: '产品管理', icon: ClipboardList, color: 'var(--accent)' },
]

export function WelcomeScreen({
  onPrompt,
  onSceneChange,
  onSkillClick,
  onSelectWorkspace,
  workspacePath,
  modelId = 'deepseek-chat',
  onModelChange,
}: Props) {
  const [activeScene, setActiveScene] = useState('office')
  const [activeSkill, setActiveSkill] = useState<string | null>(null)
  const [composerText, setComposerText] = useState('')

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
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, width: '100%', height: '100%', overflowY: 'auto', position: 'relative' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 28px 72px' }}>
        {/* Hero Title */}
        <div style={{ textAlign: 'center', marginBottom: 32, marginTop: 24 }}>
          <h1 style={{
            fontSize: 'var(--font-display)', fontWeight: 700, margin: 0, marginBottom: 6,
            letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.2,
          }}>
            BspBuddy, 我帮你
          </h1>
          <p style={{
            margin: 0, fontSize: 'var(--font-label)', color: 'var(--text-tertiary)',
            letterSpacing: '0.02em',
          }}>
            选场景或技能，直接在下方开始
          </p>
        </div>

        {/* Scene Tabs */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 6,
          marginBottom: 28,
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
                  transition: 'background .15s, border-color .15s, color .15s',
                }}
              >
                {Icon && <Icon size={13} />}
                {scene.label}
              </button>
            )
          })}
        </div>

        {/* Skill Icon Row — unified icon tiles */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 10,
          marginBottom: 28, flexWrap: 'wrap',
        }}>
          {SKILLS.map((skill) => {
            const isSelected = activeSkill === skill.id
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => handleSkillClick(skill.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '10px 12px', borderRadius: 12,
                  border: isSelected ? '1px solid rgba(37, 99, 235, 0.22)' : '1px solid transparent',
                  background: isSelected ? 'var(--bg-active)' : 'transparent',
                  cursor: 'pointer', fontSize: 'var(--font-label)',
                  color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                  fontFamily: 'inherit', minWidth: 72,
                  transition: 'background .15s, border-color .15s, color .15s',
                }}
              >
                <span
                  className={`bb-icon-tile${isSelected ? ' bb-icon-tile--active' : ''}`}
                  style={isSelected ? undefined : { color: skill.color, borderColor: 'rgba(15,23,42,0.06)' }}
                  aria-hidden="true"
                >
                  <skill.icon size={16} strokeWidth={1.75} color="currentColor" />
                </span>
                <span style={{ lineHeight: 1.35, textAlign: 'center', fontWeight: isSelected ? 600 : 400 }}>{skill.label}</span>
              </button>
            )
          })}
        </div>

        {/* Composer Card — floating dock style */}
        <div className="bb-composer-float" style={{ marginBottom: 16 }}>
          {/* Skill Chip */}
          {activeSkill && (
            <div style={{ padding: '12px 16px 0' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 12,
                background: 'var(--success-bg)', color: 'var(--success)',
                fontSize: 12, fontWeight: 500, border: '1px solid rgba(22, 163, 74, 0.2)',
              }}>
                Skill {activeSkill}
                <button
                  type="button"
                  onClick={() => setActiveSkill(null)}
                  aria-label="清除技能"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--success)', padding: 0, marginLeft: 2,
                  }}
                >
                  <X size={11} aria-hidden="true" />
                </button>
              </span>
            </div>
          )}

          {/* Textarea */}
          <textarea
            name="welcome-composer"
            aria-label="任务描述"
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你的任务，BspBuddy 帮你完成…"
            style={{
              width: '100%', minHeight: 88, padding: '16px 18px 10px',
              border: 'none', outline: 'none', resize: 'none',
              fontSize: 14, color: 'var(--text-primary)',
              background: 'transparent', fontFamily: 'inherit',
              lineHeight: 1.65,
            }}
          />

          {/* Composer Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 14px 14px',
            boxShadow: '0 -1px 0 rgba(15, 23, 42, 0.04)',
          }}>
            {/* Left: attachment button */}
            <button
              type="button"
              title="添加附件"
              aria-label="添加附件"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', padding: 0,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <Plus size={16} aria-hidden="true" />
            </button>

            {/* Right: controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Globe button */}
              <button
                type="button"
                aria-label="网络搜索"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', padding: 0,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <Globe size={15} aria-hidden="true" />
              </button>

              {/* Model Selector — shared component, auto-loads tenant + local */}
              <ModelSelector
                selectedId={modelId}
                onChange={onModelChange}
              />

              {/* Mic button */}
              <button
                type="button"
                aria-label="语音输入"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', padding: 0,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <Mic size={15} aria-hidden="true" />
              </button>

              {/* Send button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!composerText.trim()}
                aria-label="发送消息"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: '50%',
                  background: composerText.trim() ? 'var(--text-primary)' : 'var(--bg-input)',
                  border: 'none', cursor: composerText.trim() ? 'pointer' : 'default',
                  color: composerText.trim() ? 'var(--bg-root)' : 'var(--text-tertiary)',
                  padding: 0, transition: 'background .15s, color .15s',
                }}
              >
                <Send size={14} aria-hidden="true" />
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
