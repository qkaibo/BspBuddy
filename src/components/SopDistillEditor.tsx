import { useEffect, useState } from 'react'
import { ArrowLeft, Save, Sparkles, Loader2 } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { SkillCard, SopSkill, SopStatus } from '../lib/sop-types'
import { stepsTextFromSkillCard } from '../lib/sop-types'

const ipc = createIpcClient()

interface Props {
  skillId: string
  /** Focus distill input (from-document entry) */
  focusDistill?: boolean
  onClose: () => void
  onSaved: (skill: SopSkill) => void
}

const STATUS_LABEL: Record<SopStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}

/**
 * Distill editor MVP (agents-003 Phase B partial):
 * - Meta: name / description / businessDomain / status (read-only)
 * - Steps text ↔ contentJson (linear SkillCard)
 * - Mock distill from natural language (real SSE pipeline TODO)
 * Full 7-step SSE + canvas drag: TODO Phase B
 */
export function SopDistillEditor({ skillId, focusDistill, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [distilling, setDistilling] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [skill, setSkill] = useState<SopSkill | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [businessDomain, setBusinessDomain] = useState('')
  const [stepsText, setStepsText] = useState('')
  const [distillInput, setDistillInput] = useState('')
  const [pipelineStep, setPipelineStep] = useState('')
  const [contentPreview, setContentPreview] = useState<SkillCard | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await ipc.invoke(IPC_CHANNELS.SOP_GET, skillId) as { skill?: SopSkill; error?: string }
        if (cancelled) return
        if (res?.error || !res.skill) {
          setError(res?.error || '加载失败')
          return
        }
        setSkill(res.skill)
        setName(res.skill.name)
        setDescription(res.skill.description || '')
        setBusinessDomain(res.skill.businessDomain || '')
        setStepsText(stepsTextFromSkillCard(res.skill.contentJson))
        setContentPreview(res.skill.contentJson)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [skillId])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function handleSave() {
    if (!skill) return
    if (skill.status === 'archived') {
      setError('已归档 SOP 不可保存，请先在列表中处理')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await ipc.invoke(IPC_CHANNELS.SOP_UPDATE, skill.id, {
        name,
        description,
        businessDomain,
        stepsText,
      }) as { skill?: SopSkill; error?: string }
      if (res?.error || !res.skill) {
        setError(res?.error || '保存失败')
        return
      }
      setSkill(res.skill)
      setContentPreview(res.skill.contentJson)
      setStepsText(stepsTextFromSkillCard(res.skill.contentJson))
      showToast(res.skill.status === 'draft' && skill.status === 'published'
        ? '已保存并转为草稿'
        : '已保存')
      onSaved(res.skill)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDistill() {
    const text = distillInput.trim()
    if (!text) {
      setError('请先输入流程描述或粘贴文档要点')
      return
    }
    setDistilling(true)
    setError('')
    setPipelineStep('')
    try {
      // TODO: replace with sop:distill/stream SSE (7-step pipeline)
      const pipe = ['generate', 'parse', 'repair', 'segment_fallback', 'normalize', 'reflect', 'complete']
      for (const step of pipe) {
        setPipelineStep(step)
        await new Promise((r) => setTimeout(r, 120))
      }
      const res = await ipc.invoke(IPC_CHANNELS.SOP_DISTILL, { text }) as {
        contentJson?: SkillCard
        error?: string
      }
      if (res?.error || !res.contentJson) {
        setError(res?.error || '蒸馏失败')
        return
      }
      setContentPreview(res.contentJson)
      setStepsText(stepsTextFromSkillCard(res.contentJson))
      if (!name || name === '未命名 SOP') {
        const first = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean)
        if (first) setName(first.slice(0, 40))
      }
      if (!description) setDescription(text.slice(0, 120))
      showToast('蒸馏完成，请检查步骤后保存')
    } catch (e) {
      setError(e instanceof Error ? e.message : '蒸馏失败')
    } finally {
      setDistilling(false)
      setPipelineStep('')
    }
  }

  const field: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 6,
    border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit',
    background: 'var(--bg-input)', color: 'var(--text-primary)', boxSizing: 'border-box',
  }
  const label: React.CSSProperties = {
    fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, display: 'block',
  }
  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
    color: 'var(--text-secondary)',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="SOP 蒸馏编辑器"
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'var(--bg-root)', display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0,
      }}>
        <button type="button" onClick={onClose} style={btn} aria-label="返回列表">
          <ArrowLeft size={14} /> 返回列表
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name || '蒸馏编辑器'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {skill
              ? `${skill.skillId || skill.skill_id || skill.id} · ${STATUS_LABEL[skill.status] || skill.status || '—'} · v${skill.version ?? '—'}`
              : '加载中…'}
            <span style={{ marginLeft: 8, opacity: 0.8 }}>MVP：步骤文本编辑；完整画布/SSE 后续接入</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading || !skill || skill.status === 'archived'}
          style={{
            ...btn, border: 'none', background: 'var(--accent)', color: '#fff',
            opacity: saving || loading ? 0.6 : 1,
          }}
        >
          {saving ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
          保存
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--danger)', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          加载中…
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Left: distill panel */}
          <div style={{
            width: 340, flexShrink: 0, borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', background: 'var(--bg-card)',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              对话蒸馏
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              <div style={{
                fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 12,
                padding: 10, borderRadius: 8, background: 'var(--bg-root)', border: '1px solid var(--border)',
              }}>
                用自然语言描述流程（每行一步），或粘贴制度文档要点。当前为本地 mock 蒸馏（生成线性节点），完整 7 步 SSE 管道标注 TODO。
              </div>
              {pipelineStep && (
                <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8 }}>
                  管道步骤：{pipelineStep}…
                </div>
              )}
              <textarea
                autoFocus={!!focusDistill}
                value={distillInput}
                onChange={(e) => setDistillInput(e.target.value)}
                placeholder={'例如：\n员工提交报销单\n财务校验发票\n按额度路由审批\n归档结果'}
                rows={10}
                style={{ ...field, resize: 'vertical', minHeight: 160 }}
              />
              <button
                type="button"
                onClick={() => void handleDistill()}
                disabled={distilling}
                style={{
                  ...btn, marginTop: 10, width: '100%', justifyContent: 'center',
                  border: 'none', background: 'var(--accent)', color: '#fff',
                  opacity: distilling ? 0.65 : 1,
                }}
              >
                {distilling ? <Loader2 size={13} /> : <Sparkles size={13} />}
                {distilling ? '蒸馏中…' : '开始蒸馏'}
              </button>
            </div>
          </div>

          {/* Right: meta + steps / preview */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={label}>技能名称</label>
                <input value={name} onChange={(e) => setName(e.target.value)} style={field} />
              </div>
              <div>
                <label style={label}>业务域</label>
                <input value={businessDomain} onChange={(e) => setBusinessDomain(e.target.value)} placeholder="如：行政 / 法务" style={field} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>描述</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} style={field} />
              </div>
            </div>

            <label style={label}>流程步骤（每行一步，保存时写入 contentJson）</label>
            <textarea
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              rows={8}
              placeholder="每行一个步骤…"
              style={{ ...field, resize: 'vertical', minHeight: 140, marginBottom: 14 }}
            />

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              节点预览
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(contentPreview?.nodes || []).map((n) => (
                <div
                  key={n.nodeId}
                  style={{
                    padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)',
                    background: 'var(--bg-card)', fontSize: 11,
                  }}
                >
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{n.type}</span>
                  <span style={{ marginLeft: 8, color: 'var(--text-primary)', fontWeight: 600 }}>{n.name}</span>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 3 }}>{n.instruction}</div>
                </div>
              ))}
              {(!contentPreview?.nodes || contentPreview.nodes.length === 0) && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 20, textAlign: 'center' }}>
                  暂无节点 — 请蒸馏或填写步骤后保存
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--text-primary)', color: 'var(--bg-card)',
            padding: '8px 14px', borderRadius: 6, fontSize: 11, zIndex: 50,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
