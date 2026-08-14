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
  onImported: (slug: string) => void
}

interface Preview {
  name: string
  slug: string
  hasSkillMd: boolean | null
  note: string
}

type SourceMode = 'file' | 'url'

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

function parseFrontmatter(text: string): { name: string; slug: string; description: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const meta: Record<string, string> = {}
  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const idx = line.indexOf(':')
      if (idx <= 0) continue
      const key = line.slice(0, idx).trim().toLowerCase()
      const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (key && val) meta[key] = val
    }
  }
  const name = meta.name || meta.title || ''
  const slug = meta.slug || meta.id || ''
  return { name, slug, description: meta.description || meta.summary || '' }
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'skill'
}

export function SkillImportDialog({ categories, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<SourceMode>('file')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [accessLevel, setAccessLevel] = useState('L1')
  const [categoryId, setCategoryId] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [detected, setDetected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function detect() {
    setError('')
    setDetected(false)
    setPreview(null)

    if (mode === 'file') {
      if (!file) {
        setError('请先选择 ZIP / SKILL.md 文件')
        return
      }
      const lower = file.name.toLowerCase()
      if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) {
        const text = await file.text()
        const meta = parseFrontmatter(text)
        const name = meta.name || file.name.replace(/\.(md|markdown|txt)$/i, '')
        const hasBody = text.trim().length > 0
        setPreview({
          name,
          slug: meta.slug || slugify(name),
          hasSkillMd: hasBody,
          note: hasBody ? '已识别为 SKILL.md / Markdown' : '文件为空',
        })
        setDetected(true)
        if (!hasBody) setError('SKILL.md 不能为空')
        return
      }
      if (lower.endsWith('.zip') || lower.endsWith('.skill')) {
        setPreview({
          name: file.name.replace(/\.(zip|skill)$/i, ''),
          slug: slugify(file.name.replace(/\.(zip|skill)$/i, '')),
          hasSkillMd: null,
          note: 'ZIP 将在导入时校验是否含 SKILL.md；缺文件会明确报错',
        })
        setDetected(true)
        return
      }
      setError('仅支持 .zip / .skill / SKILL.md')
      return
    }

    const source = url.trim()
    if (!source) {
      setError('请填写 URL 或托管路径')
      return
    }
    const leaf = source.split(/[\\/]/).filter(Boolean).pop() || 'skill'
    const guessName = leaf.replace(/\.(md|markdown|zip)$/i, '')
    setPreview({
      name: guessName,
      slug: slugify(guessName),
      hasSkillMd: null,
      note: '确认导入后由服务端拉取并校验 SKILL.md',
    })
    setDetected(true)
  }

  async function onPickFile(next: File | null) {
    setFile(next)
    setDetected(false)
    setPreview(null)
    setError('')
    if (next) {
      // auto-detect after pick
      setTimeout(() => { void detectAfterPick(next) }, 0)
    }
  }

  async function detectAfterPick(picked: File) {
    const lower = picked.name.toLowerCase()
    if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) {
      const text = await picked.text()
      const meta = parseFrontmatter(text)
      const name = meta.name || picked.name.replace(/\.(md|markdown|txt)$/i, '')
      setPreview({
        name,
        slug: meta.slug || slugify(name),
        hasSkillMd: text.trim().length > 0,
        note: '已识别为 SKILL.md / Markdown',
      })
      setDetected(true)
      return
    }
    if (lower.endsWith('.zip') || lower.endsWith('.skill')) {
      setPreview({
        name: picked.name.replace(/\.(zip|skill)$/i, ''),
        slug: slugify(picked.name.replace(/\.(zip|skill)$/i, '')),
        hasSkillMd: null,
        note: 'ZIP 将在导入时校验是否含 SKILL.md',
      })
      setDetected(true)
    }
  }

  async function submit() {
    if (!detected || !preview) {
      setError('请先点击「检测」预览元数据')
      return
    }
    if (preview.hasSkillMd === false) {
      setError('缺少有效 SKILL.md，无法导入')
      return
    }
    setLoading(true)
    setError('')
    try {
      let res: { slug?: string; error?: string; detail?: string }
      if (mode === 'file') {
        if (!file) {
          setError('请选择文件')
          return
        }
        const content_base64 = await fileToBase64(file)
        res = await ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_IMPORT_PACKAGE, {
          filename: file.name,
          content_base64,
          access_level: accessLevel,
          category_id: categoryId || undefined,
          name: preview.name || undefined,
        }) as { slug?: string; error?: string; detail?: string }
      } else {
        res = await ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_IMPORT_URL, {
          source: url.trim(),
          access_level: accessLevel,
          category_id: categoryId || undefined,
          name: preview.name || undefined,
        }) as { slug?: string; error?: string; detail?: string }
      }
      if (res?.error || res?.detail) {
        setError(String(res.error || res.detail))
        return
      }
      if (!res?.slug) {
        setError('导入失败：未返回 slug')
        return
      }
      onImported(res.slug)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败')
    } finally {
      setLoading(false)
    }
  }

  const canConfirm = detected && preview && preview.hasSkillMd !== false && !loading

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
          width: 460,
          maxWidth: '92vw',
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
          <div style={{ fontSize: 14, fontWeight: 600 }}>导入技能</div>
          <button type="button" className="bb-icon-btn" onClick={onClose} aria-label="关闭">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div role="radiogroup" style={{ display: 'flex', gap: 16, fontSize: 12 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'url'}
              onChange={() => {
                setMode('url')
                setDetected(false)
                setPreview(null)
                setError('')
              }}
            />
            URL
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'file'}
              onChange={() => {
                setMode('file')
                setDetected(false)
                setPreview(null)
                setError('')
              }}
            />
            ZIP / .skill 文件
          </label>
        </div>

        {mode === 'url' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="bb-input"
              style={{ flex: 1 }}
              placeholder="raw SKILL.md / zip / GitHub 路径…"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setDetected(false)
                setPreview(null)
              }}
            />
            <button type="button" className="bb-btn bb-btn-secondary" onClick={() => void detect()}>
              检测
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={inputRef}
              type="file"
              accept=".zip,.md,.markdown,.txt,.skill"
              style={{ display: 'none' }}
              onChange={(e) => void onPickFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="bb-btn bb-btn-secondary"
              style={{ flex: 1, justifyContent: 'flex-start' }}
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={14} strokeWidth={1.75} />
              {file ? file.name : '选择文件'}
            </button>
            <button type="button" className="bb-btn bb-btn-secondary" onClick={() => void detect()} disabled={!file}>
              检测
            </button>
          </div>
        )}

        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: 'var(--bg-input, #f2f4f8)',
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--text-secondary, #5c6370)',
            minHeight: 64,
          }}
        >
          {preview ? (
            <>
              <div><strong style={{ color: 'var(--text-primary)' }}>预览</strong></div>
              <div>name：{preview.name || '—'}</div>
              <div>slug：{preview.slug || '—'}</div>
              <div>
                SKILL.md：
                {preview.hasSkillMd === true ? '是' : preview.hasSkillMd === false ? '否' : '导入时校验'}
              </div>
              <div style={{ color: 'var(--text-tertiary)' }}>{preview.note}</div>
            </>
          ) : (
            <div>预览：name / slug / 是否含 SKILL.md（先点「检测」）</div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
            访问级别
            <select className="bb-input" value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)}>
              <option value="L1">L1 公开可下载</option>
              <option value="L2">L2 下载需授权</option>
              <option value="L3">L3 仅授权可调用</option>
            </select>
          </label>
        </div>

        {error ? <div style={{ color: 'var(--danger, #dc2626)', fontSize: 12 }}>{error}</div> : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="bb-btn" onClick={onClose}>取消</button>
          <button
            type="button"
            className="bb-btn bb-btn-primary"
            disabled={!canConfirm}
            onClick={() => void submit()}
          >
            {loading ? '导入中…' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
