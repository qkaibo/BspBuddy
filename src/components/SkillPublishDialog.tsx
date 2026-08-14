import { useRef, useState } from 'react'
import { X, Upload } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'

const ipc = createIpcClient()

interface Category {
  id: string
  name: string
}

interface Props {
  categories: Category[]
  onClose: () => void
  onPublished: (slug: string) => void
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64 || '')
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function SkillPublishDialog({ categories, onClose, onPublished }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [changelog, setChangelog] = useState('初始发布')
  const [accessLevel, setAccessLevel] = useState('L1')
  const [categoryId, setCategoryId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function onNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function submit() {
    setError('')
    if (!name.trim()) {
      setError('请填写名称')
      return
    }
    if (!slug.trim()) {
      setError('请填写 slug（创建后不可改）')
      return
    }
    if (!/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$/.test(slug.trim())) {
      setError('slug 仅允许小写字母、数字与中划线')
      return
    }
    if (!description.trim()) {
      setError('请填写描述')
      return
    }
    if (!version.trim()) {
      setError('请填写版本号')
      return
    }
    if (!file) {
      setError('请上传含 SKILL.md 的 ZIP 或 Markdown 包')
      return
    }
    setLoading(true)
    try {
      const content_base64 = await fileToBase64(file)
      const res = await ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_IMPORT_PACKAGE, {
        filename: file.name,
        content_base64,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        version: version.trim(),
        access_level: accessLevel,
        category_id: categoryId || undefined,
        status: 'published',
        changelog: changelog.trim() || '初始发布',
      }) as { slug?: string; error?: string; detail?: string }
      if (res?.error || res?.detail) {
        setError(String(res.error || res.detail))
        return
      }
      if (!res?.slug) {
        setError('发布失败：未返回 slug')
        return
      }
      onPublished(res.slug)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '发布失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(16,24,40,0.28)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 85,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 520,
          maxWidth: '94vw',
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--bg-card, #fff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 10,
          padding: 16,
          display: 'grid',
          gap: 12,
          boxShadow: '0 16px 40px rgba(16,24,40,0.14)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>发布技能</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              创建并发布到企业商店；包内必须含 SKILL.md
            </div>
          </div>
          <button type="button" className="bb-icon-btn" onClick={onClose} aria-label="关闭">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <label style={{ fontSize: 12, display: 'grid', gap: 4 }}>
          名称
          <input className="bb-input" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="显示名称" />
        </label>

        <label style={{ fontSize: 12, display: 'grid', gap: 4 }}>
          slug（创建后不可改）
          <input
            className="bb-input"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value.trim().toLowerCase())
            }}
            placeholder="my-skill"
          />
        </label>

        <label style={{ fontSize: 12, display: 'grid', gap: 4 }}>
          描述
          <textarea
            className="bb-input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="一句话说明用途"
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: 12, display: 'grid', gap: 4 }}>
            版本
            <input className="bb-input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" />
          </label>
          <label style={{ fontSize: 12, display: 'grid', gap: 4 }}>
            访问级别
            <select className="bb-input" value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)}>
              <option value="L1">L1 公开可下载</option>
              <option value="L2">L2 下载需授权</option>
              <option value="L3">L3 仅授权可调用</option>
            </select>
          </label>
        </div>

        <label style={{ fontSize: 12, display: 'grid', gap: 4 }}>
          分类
          <select className="bb-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">未分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 12, display: 'grid', gap: 4 }}>
          changelog
          <input className="bb-input" value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="初始发布" />
        </label>

        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12 }}>技能包（ZIP / SKILL.md）</div>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.md,.markdown,.txt,.skill"
            style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            className="bb-btn bb-btn-secondary"
            style={{ justifyContent: 'flex-start' }}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={14} strokeWidth={1.75} />
            {file ? file.name : '选择文件'}
          </button>
        </div>

        {error ? <div style={{ color: 'var(--danger, #dc2626)', fontSize: 12 }}>{error}</div> : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="bb-btn" onClick={onClose}>取消</button>
          <button type="button" className="bb-btn bb-btn-primary" disabled={loading} onClick={() => void submit()}>
            {loading ? '发布中…' : '确认发布'}
          </button>
        </div>
      </div>
    </div>
  )
}
