// ============================================================
// PolicyPanel — 策略管理：主从布局 + 步骤条 + 效果预览（policy-001 B2）
// ============================================================

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { ScrollText, X } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import { PanelChrome } from './ui/PanelChrome'

const ipc = createIpcClient()

interface Props {
  onClose: () => void
}

type TabId = 'rules' | 'packs' | 'bindings' | 'preview'
type PaneMode = 'browse' | 'create'

interface PolicyRule {
  id: string
  slug: string
  title: string
  body_md: string
  severity: string
  status: string
  content_hash: string
  updated_at: string
}

interface PolicyPack {
  id: string
  slug: string
  name: string
  description?: string | null
  kind: string
  rule_ids: string[]
  version: string
  updated_at: string
}

interface PolicyBinding {
  id: string
  pack_id: string
  pack_slug?: string | null
  target_type: string
  target_key: string
  priority: number
  enabled: boolean
  updated_at: string
}

interface ExpertOption {
  id: string
  name: string
}

interface ResolvedPreview {
  policy_version?: string
  packs?: Array<{ slug: string; kind: string; name: string }>
  rules?: Array<{ slug: string; title: string; source_kind: string; source_pack_slug: string }>
  error?: string
}

const KIND_LABEL: Record<string, string> = {
  org_baseline: '公司基线',
  project: '项目',
  mode: 'Mode',
  expert: '专家',
}

const TARGET_LABEL: Record<string, string> = {
  tenant: '整个租户',
  project: '指定项目',
  mode: '指定 Mode',
  expert: '指定专家',
}

const SEVERITY_LABEL: Record<string, string> = {
  required: '必须遵守',
  recommended: '建议遵守',
}

const SEVERITY_SHORT: Record<string, string> = {
  required: '必须',
  recommended: '建议',
}

type BadgeTone = 'required' | 'recommended' | 'neutral'

function severityTone(severity?: string): BadgeTone {
  if (severity === 'required') return 'required'
  if (severity === 'recommended') return 'recommended'
  return 'neutral'
}

function toneStyle(tone: BadgeTone): CSSProperties {
  if (tone === 'required') {
    return {
      background: 'rgba(239, 68, 68, 0.12)',
      color: '#b91c1c',
      border: '1px solid rgba(239, 68, 68, 0.28)',
    }
  }
  if (tone === 'recommended') {
    return {
      background: 'rgba(37, 99, 235, 0.10)',
      color: '#1d4ed8',
      border: '1px solid rgba(37, 99, 235, 0.25)',
    }
  }
  return {
    background: 'var(--bg-hover)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  }
}

const SEED_PREVIEW = {
  project_key: 'github.com/demo/bspbuddy-app',
  mode: 'review',
}

const fieldStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--text-tertiary)',
  marginBottom: 4,
}

function slugify(text: string): string {
  const ascii = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  if (!ascii) return `rule-${Date.now().toString(36)}`
  // Prefer ASCII-ish slug; if mostly CJK, use compact hash-ish fallback
  if (/^[\u4e00-\u9fff-]+$/.test(ascii) || ascii.length < 2) {
    return `rule-${ascii.replace(/-/g, '').slice(0, 8) || Date.now().toString(36)}`
  }
  return ascii.replace(/[\u4e00-\u9fff]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || `rule-${Date.now().toString(36)}`
}

export function PolicyPanel({ onClose }: Props) {
  const [tab, setTab] = useState<TabId>('rules')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [rules, setRules] = useState<PolicyRule[]>([])
  const [packs, setPacks] = useState<PolicyPack[]>([])
  const [bindings, setBindings] = useState<PolicyBinding[]>([])
  const [experts, setExperts] = useState<ExpertOption[]>([])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paneMode, setPaneMode] = useState<PaneMode>('browse')
  const [query, setQuery] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [slugManual, setSlugManual] = useState(false)

  const [ruleForm, setRuleForm] = useState({ slug: '', title: '', body_md: '', severity: 'required' })
  const [packForm, setPackForm] = useState({
    slug: '',
    name: '',
    kind: 'project',
    version: '1.0.0',
    rule_ids: [] as string[],
  })
  const [bindingForm, setBindingForm] = useState({
    pack_id: '',
    target_type: 'project',
    target_key: '',
    priority: 0,
  })

  const [previewKey, setPreviewKey] = useState(SEED_PREVIEW.project_key)
  const [previewMode, setPreviewMode] = useState(SEED_PREVIEW.mode)
  const [previewExpert, setPreviewExpert] = useState('')
  const [preview, setPreview] = useState<ResolvedPreview | null>(null)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [backendHint, setBackendHint] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const status = await ipc.invoke(IPC_CHANNELS.EXPERT_FASTAPI_STATUS).catch(() => null) as {
        ready?: boolean
        online?: boolean
        baseUrl?: string
        error?: string
      } | null
      const online = Boolean(status?.online ?? status?.ready)
      setBackendOnline(online)
      setBackendHint(
        online
          ? (status?.baseUrl || '')
          : (status?.error || '本地 FastAPI 未就绪，策略接口不可用'),
      )
      if (!online) {
        setRules([])
        setPacks([])
        setBindings([])
        setError(status?.error || '本地服务未连接。请确认 BspBuddy 已启动后端，或点击侧栏「本地服务」重试。')
        return
      }
      const [r, p, b, exp] = await Promise.all([
        ipc.invoke(IPC_CHANNELS.POLICY_RULES_LIST) as Promise<PolicyRule[]>,
        ipc.invoke(IPC_CHANNELS.POLICY_PACKS_LIST) as Promise<PolicyPack[]>,
        ipc.invoke(IPC_CHANNELS.POLICY_BINDINGS_LIST) as Promise<PolicyBinding[]>,
        ipc.invoke(IPC_CHANNELS.EXPERT_LIST).catch(() => []) as Promise<Array<{ id: string; name?: string }>>,
      ])
      const ruleRows = Array.isArray(r) ? r : []
      const packRows = Array.isArray(p) ? p : []
      const bindingRows = Array.isArray(b) ? b : []
      const expertOpts = (Array.isArray(exp) ? exp : [])
        .map((e) => ({ id: e.id, name: e.name || e.id }))
        .filter((e) => e.id)
      setRules(ruleRows)
      setPacks(packRows)
      setBindings(bindingRows)
      setExperts(expertOpts)
      setPreviewExpert((prev) => prev || expertOpts[0]?.id || '')
      setBindingForm((prev) => ({
        ...prev,
        pack_id: prev.pack_id || packRows[0]?.id || '',
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载策略失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  function switchTab(next: TabId) {
    setTab(next)
    setPaneMode('browse')
    setShowAdvanced(false)
    setSlugManual(false)
    setError(null)
    setQuery('')
    if (next === 'rules') setSelectedId(rules[0]?.id ?? null)
    else if (next === 'packs') setSelectedId(packs[0]?.id ?? null)
    else if (next === 'bindings') setSelectedId(bindings[0]?.id ?? null)
    else setSelectedId(null)
  }

  // Keep selection when data reloads
  useEffect(() => {
    if (paneMode === 'create' || tab === 'preview') return
    if (tab === 'rules') {
      if (!selectedId || !rules.some((r) => r.id === selectedId)) setSelectedId(rules[0]?.id ?? null)
    } else if (tab === 'packs') {
      if (!selectedId || !packs.some((p) => p.id === selectedId)) setSelectedId(packs[0]?.id ?? null)
    } else if (tab === 'bindings') {
      if (!selectedId || !bindings.some((b) => b.id === selectedId)) setSelectedId(bindings[0]?.id ?? null)
    }
  }, [rules, packs, bindings, tab, selectedId, paneMode])

  function startCreate() {
    setPaneMode('create')
    setShowAdvanced(false)
    setSlugManual(false)
    setError(null)
    if (tab === 'rules') {
      setRuleForm({ slug: '', title: '', body_md: '', severity: 'required' })
    } else if (tab === 'packs') {
      setPackForm({ slug: '', name: '', kind: 'project', version: '1.0.0', rule_ids: [] })
    } else if (tab === 'bindings') {
      setBindingForm({
        pack_id: packs[0]?.id || '',
        target_type: 'project',
        target_key: '',
        priority: 0,
      })
    }
  }

  async function createRule() {
    const title = ruleForm.title.trim()
    const body = ruleForm.body_md.trim()
    const slug = (slugManual ? ruleForm.slug : slugify(title)).trim()
    if (!title || !body) {
      setError('请填写标题与正文')
      return
    }
    if (!slug) {
      setError('请填写或生成标识（高级）')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await ipc.invoke(IPC_CHANNELS.POLICY_RULES_CREATE, {
        slug,
        title,
        body_md: ruleForm.body_md,
        severity: ruleForm.severity,
        status: 'published',
      }) as PolicyRule
      setPaneMode('browse')
      await loadAll()
      if (created?.id) setSelectedId(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建规则失败')
    } finally {
      setBusy(false)
    }
  }

  async function createPack() {
    const name = packForm.name.trim()
    const slug = (slugManual ? packForm.slug : slugify(name)).trim()
    if (!name || packForm.rule_ids.length === 0) {
      setError('请填写名称，并至少选择一条规则')
      return
    }
    if (!slug) {
      setError('请填写或生成标识（高级）')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await ipc.invoke(IPC_CHANNELS.POLICY_PACKS_CREATE, {
        slug,
        name,
        kind: packForm.kind,
        version: packForm.version || '1.0.0',
        rule_ids: packForm.rule_ids,
      }) as PolicyPack
      setPaneMode('browse')
      await loadAll()
      if (created?.id) setSelectedId(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建策略包失败')
    } finally {
      setBusy(false)
    }
  }

  async function createBinding() {
    if (!bindingForm.pack_id || !bindingForm.target_type) {
      setError('请选择策略包与绑定对象类型')
      return
    }
    if (bindingForm.target_type !== 'tenant' && !bindingForm.target_key.trim()) {
      setError(bindingForm.target_type === 'expert' ? '请选择专家' : '请填写绑定对象')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await ipc.invoke(IPC_CHANNELS.POLICY_BINDINGS_CREATE, {
        pack_id: bindingForm.pack_id,
        target_type: bindingForm.target_type,
        target_key: bindingForm.target_type === 'tenant' ? '' : bindingForm.target_key.trim(),
        priority: Number(bindingForm.priority) || 0,
        enabled: true,
      }) as PolicyBinding
      setPaneMode('browse')
      await loadAll()
      if (created?.id) setSelectedId(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建绑定失败')
    } finally {
      setBusy(false)
    }
  }

  async function runPreview() {
    setBusy(true)
    setError(null)
    try {
      const data = await ipc.invoke(IPC_CHANNELS.POLICY_RESOLVED, {
        project_key: previewKey.trim() || undefined,
        mode: previewMode.trim() || undefined,
        expert_id: previewExpert.trim() || undefined,
      }) as ResolvedPreview
      setPreview(data)
    } catch (e) {
      setPreview({ error: e instanceof Error ? e.message : '预览失败' })
    } finally {
      setBusy(false)
    }
  }

  function toggleRuleInPack(id: string) {
    setPackForm((prev) => ({
      ...prev,
      rule_ids: prev.rule_ids.includes(id)
        ? prev.rule_ids.filter((x) => x !== id)
        : [...prev.rule_ids, id],
    }))
  }

  const ruleById = useMemo(() => new Map(rules.map((r) => [r.id, r])), [rules])
  const packById = useMemo(() => new Map(packs.map((p) => [p.id, p])), [packs])

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rules
    return rules.filter((r) => r.title.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q))
  }, [rules, query])

  const filteredPacks = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return packs
    return packs.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
  }, [packs, query])

  const filteredBindings = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return bindings
    return bindings.filter((b) => {
      const packName = packById.get(b.pack_id)?.name || b.pack_slug || ''
      const expertName = experts.find((e) => e.id === b.target_key)?.name || ''
      return (
        packName.toLowerCase().includes(q)
        || b.target_key.toLowerCase().includes(q)
        || expertName.toLowerCase().includes(q)
        || (TARGET_LABEL[b.target_type] || '').includes(q)
      )
    })
  }, [bindings, query, packById, experts])

  const selectedRule = rules.find((r) => r.id === selectedId) || null
  const selectedPack = packs.find((p) => p.id === selectedId) || null
  const selectedBinding = bindings.find((b) => b.id === selectedId) || null

  const tabs = [
    { id: 'rules', label: `规则库 (${rules.length})` },
    { id: 'packs', label: `策略包 (${packs.length})` },
    { id: 'bindings', label: `绑定下发 (${bindings.length})` },
    { id: 'preview', label: '效果预览' },
  ]

  const canCreate = tab !== 'preview'

  const toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', flexWrap: 'wrap' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 11,
        color: backendOnline === false ? 'var(--danger)' : 'var(--text-tertiary)',
        minWidth: 0,
        flex: 1,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: backendOnline === true ? '#16a34a' : backendOnline === false ? '#ef4444' : 'var(--text-tertiary)',
        }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {backendOnline === true
            ? `本地服务已连接${backendHint ? ` · ${backendHint}` : ''}`
            : backendOnline === false
              ? `本地服务未连接${backendHint ? ` · ${backendHint}` : ''}`
              : '正在检测本地服务…'}
        </span>
      </div>
      <button type="button" className="bb-btn bb-btn--ghost" onClick={() => void loadAll()} disabled={loading || busy}>
        刷新
      </button>
      {canCreate ? (
        <button
          type="button"
          className="bb-btn bb-btn--primary"
          onClick={startCreate}
          disabled={busy || loading}
        >
          {tab === 'rules' ? '新建规则' : tab === 'packs' ? '新建策略包' : '新建绑定'}
        </button>
      ) : null}
    </div>
  )

  return (
    <PanelChrome
      title="策略管理"
      icon={<ScrollText size={16} strokeWidth={1.75} />}
      onClose={onClose}
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => switchTab(id as TabId)}
      toolbar={toolbar}
      bodyStyle={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {error ? (
        <div style={{
          margin: '12px 16px 0', padding: '10px 12px', borderRadius: 8,
          background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', fontSize: 12, flexShrink: 0,
        }}>
          {error}
          <button type="button" className="bb-btn bb-btn--ghost" style={{ marginLeft: 8 }} onClick={() => void loadAll()}>
            重试
          </button>
        </div>
      ) : null}

      {loading ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 12, padding: 24 }}>加载策略数据…</div>
      ) : null}

      {!loading && tab === 'preview' ? (
        <PreviewPane
          previewKey={previewKey}
          previewMode={previewMode}
          previewExpert={previewExpert}
          experts={experts}
          preview={preview}
          busy={busy}
          onKey={setPreviewKey}
          onMode={setPreviewMode}
          onExpert={setPreviewExpert}
          onRun={() => void runPreview()}
          onFillSeed={() => {
            setPreviewKey(SEED_PREVIEW.project_key)
            setPreviewMode(SEED_PREVIEW.mode)
            if (experts[0]) setPreviewExpert(experts[0].id)
          }}
        />
      ) : null}

      {!loading && tab !== 'preview' ? (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <aside style={{
            width: 260, flexShrink: 0, borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', minHeight: 0,
          }}>
            <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
              <input
                style={fieldStyle}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tab === 'rules' ? '搜索规则标题…' : tab === 'packs' ? '搜索策略包…' : '搜索绑定…'}
              />
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
              {tab === 'rules' && filteredRules.length === 0 ? <EmptyList hint="没有匹配的规则" /> : null}
              {tab === 'rules' && filteredRules.map((r) => (
                <ListItem
                  key={r.id}
                  active={paneMode === 'browse' && selectedId === r.id}
                  title={r.title}
                  meta={r.slug}
                  badge={SEVERITY_SHORT[r.severity] || r.severity}
                  badgeTone={severityTone(r.severity)}
                  onClick={() => { setPaneMode('browse'); setSelectedId(r.id); setError(null) }}
                />
              ))}
              {tab === 'packs' && filteredPacks.length === 0 ? <EmptyList hint="没有匹配的策略包" /> : null}
              {tab === 'packs' && filteredPacks.map((p) => (
                <ListItem
                  key={p.id}
                  active={paneMode === 'browse' && selectedId === p.id}
                  title={p.name}
                  meta={`${KIND_LABEL[p.kind] || p.kind} · v${p.version}`}
                  badge={KIND_LABEL[p.kind] || p.kind}
                  onClick={() => { setPaneMode('browse'); setSelectedId(p.id); setError(null) }}
                />
              ))}
              {tab === 'bindings' && filteredBindings.length === 0 ? <EmptyList hint="没有匹配的绑定" /> : null}
              {tab === 'bindings' && filteredBindings.map((b) => {
                const packName = packById.get(b.pack_id)?.name || b.pack_slug || '未知策略包'
                const expertName = experts.find((e) => e.id === b.target_key)?.name
                const keyLabel = b.target_type === 'tenant'
                  ? '当前租户'
                  : b.target_type === 'expert' && expertName
                    ? expertName
                    : (b.target_key || '—')
                return (
                  <ListItem
                    key={b.id}
                    active={paneMode === 'browse' && selectedId === b.id}
                    title={packName}
                    meta={`${TARGET_LABEL[b.target_type] || b.target_type} → ${keyLabel}`}
                    onClick={() => { setPaneMode('browse'); setSelectedId(b.id); setError(null) }}
                  />
                )
              })}
            </div>
          </aside>

          <section style={{ flex: 1, overflow: 'auto', padding: 16, minWidth: 0 }}>
            {paneMode === 'create' && tab === 'rules' ? (
              <CreateForm
                title="新建规则"
                onCancel={() => setPaneMode('browse')}
                onSubmit={() => void createRule()}
                busy={busy}
                submitLabel="创建规则"
              >
                <Field label="标题">
                  <input
                    style={fieldStyle}
                    value={ruleForm.title}
                    onChange={(e) => {
                      const title = e.target.value
                      setRuleForm((prev) => ({
                        ...prev,
                        title,
                        slug: slugManual ? prev.slug : slugify(title),
                      }))
                    }}
                    placeholder="例如：禁止提交密钥"
                  />
                </Field>
                <Field label="严重度">
                  <select
                    style={fieldStyle}
                    value={ruleForm.severity}
                    onChange={(e) => setRuleForm({ ...ruleForm, severity: e.target.value })}
                  >
                    <option value="required">必须遵守</option>
                    <option value="recommended">建议遵守</option>
                  </select>
                </Field>
                <Field label="正文">
                  <textarea
                    style={{ ...fieldStyle, minHeight: 160, resize: 'vertical' }}
                    value={ruleForm.body_md}
                    onChange={(e) => setRuleForm({ ...ruleForm, body_md: e.target.value })}
                    placeholder="用 Markdown 写清要求与示例…"
                  />
                </Field>
                <AdvancedToggle open={showAdvanced} onToggle={() => setShowAdvanced((v) => !v)} />
                {showAdvanced ? (
                  <Field label="标识（slug，一般无需改）">
                    <input
                      style={fieldStyle}
                      value={ruleForm.slug}
                      onChange={(e) => {
                        setSlugManual(true)
                        setRuleForm({ ...ruleForm, slug: e.target.value })
                      }}
                      placeholder="自动由标题生成"
                    />
                  </Field>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                    标识将自动生成：{ruleForm.slug || '（填写标题后生成）'}
                  </div>
                )}
              </CreateForm>
            ) : null}

            {paneMode === 'create' && tab === 'packs' ? (
              <CreateForm
                title="新建策略包"
                onCancel={() => setPaneMode('browse')}
                onSubmit={() => void createPack()}
                busy={busy}
                submitLabel="创建策略包"
              >
                <Field label="名称">
                  <input
                    style={fieldStyle}
                    value={packForm.name}
                    onChange={(e) => {
                      const name = e.target.value
                      setPackForm((prev) => ({
                        ...prev,
                        name,
                        slug: slugManual ? prev.slug : slugify(name),
                      }))
                    }}
                    placeholder="例如：演示项目规范包"
                  />
                </Field>
                <Field label="类型">
                  <select
                    style={fieldStyle}
                    value={packForm.kind}
                    onChange={(e) => setPackForm({ ...packForm, kind: e.target.value })}
                  >
                    {Object.entries(KIND_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="包含规则">
                  {packForm.rule_ids.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {packForm.rule_ids.map((id) => {
                        const r = ruleById.get(id)
                        return (
                          <Chip key={id} onRemove={() => toggleRuleInPack(id)}>
                            {r?.title || id}
                          </Chip>
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                      尚未选择。从下方列表勾选（至少一条）。
                    </div>
                  )}
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 4,
                    maxHeight: 200, overflow: 'auto',
                    border: '1px solid var(--border)', borderRadius: 8, padding: 8,
                  }}>
                    {rules.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        暂无规则，请先到「规则库」创建。
                      </div>
                    ) : rules.map((r) => (
                      <label
                        key={r.id}
                        style={{
                          display: 'flex', gap: 8, alignItems: 'center', fontSize: 12,
                          color: 'var(--text-primary)', padding: '4px 2px', cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={packForm.rule_ids.includes(r.id)}
                          onChange={() => toggleRuleInPack(r.id)}
                        />
                        <span style={{ flex: 1 }}>{r.title}</span>
                        <span style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 999, flexShrink: 0,
                          ...toneStyle(severityTone(r.severity)),
                        }}>
                          {SEVERITY_SHORT[r.severity] || r.severity}
                        </span>
                      </label>
                    ))}
                  </div>
                </Field>
                <AdvancedToggle open={showAdvanced} onToggle={() => setShowAdvanced((v) => !v)} />
                {showAdvanced ? (
                  <>
                    <Field label="标识（slug）">
                      <input
                        style={fieldStyle}
                        value={packForm.slug}
                        onChange={(e) => {
                          setSlugManual(true)
                          setPackForm({ ...packForm, slug: e.target.value })
                        }}
                      />
                    </Field>
                    <Field label="版本">
                      <input
                        style={fieldStyle}
                        value={packForm.version}
                        onChange={(e) => setPackForm({ ...packForm, version: e.target.value })}
                      />
                    </Field>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                    标识将自动生成：{packForm.slug || '（填写名称后生成）'} · 版本 {packForm.version}
                  </div>
                )}
              </CreateForm>
            ) : null}

            {paneMode === 'create' && tab === 'bindings' ? (
              <CreateForm
                title="新建绑定"
                onCancel={() => setPaneMode('browse')}
                onSubmit={() => void createBinding()}
                busy={busy}
                submitLabel="创建绑定"
              >
                <Field label="选择策略包">
                  {packs.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>请先创建策略包</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {packs.map((p) => {
                        const active = bindingForm.pack_id === p.id
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setBindingForm({ ...bindingForm, pack_id: p.id })}
                            style={{
                              textAlign: 'left',
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: `1px solid ${active ? 'var(--accent, var(--border-strong, var(--border)))' : 'var(--border)'}`,
                              background: active ? 'var(--bg-hover)' : 'var(--bg-card)',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                              {KIND_LABEL[p.kind] || p.kind} · {(p.rule_ids || []).length} 条规则
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </Field>
                <Field label="绑到哪里">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {Object.entries(TARGET_LABEL).map(([k, v]) => {
                      const active = bindingForm.target_type === k
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setBindingForm({ ...bindingForm, target_type: k, target_key: '' })}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: `1px solid ${active ? 'var(--accent, var(--border))' : 'var(--border)'}`,
                            background: active ? 'var(--bg-hover)' : 'transparent',
                            color: 'var(--text-primary)',
                            fontSize: 12,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {v}
                        </button>
                      )
                    })}
                  </div>
                </Field>
                {bindingForm.target_type === 'tenant' ? (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    将应用到当前租户下所有工程（公司基线常用）。
                  </div>
                ) : bindingForm.target_type === 'expert' ? (
                  <Field label="专家">
                    <select
                      style={fieldStyle}
                      value={bindingForm.target_key}
                      onChange={(e) => setBindingForm({ ...bindingForm, target_key: e.target.value })}
                    >
                      <option value="">选择专家…</option>
                      {experts.map((e) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </Field>
                ) : bindingForm.target_type === 'project' ? (
                  <Field label="仓库标识">
                    <input
                      style={fieldStyle}
                      value={bindingForm.target_key}
                      onChange={(e) => setBindingForm({ ...bindingForm, target_key: e.target.value })}
                      placeholder="例如 github.com/org/repo"
                    />
                  </Field>
                ) : (
                  <Field label="Mode 名称">
                    <input
                      style={fieldStyle}
                      value={bindingForm.target_key}
                      onChange={(e) => setBindingForm({ ...bindingForm, target_key: e.target.value })}
                      placeholder="例如 review"
                    />
                  </Field>
                )}
                <AdvancedToggle open={showAdvanced} onToggle={() => setShowAdvanced((v) => !v)} />
                {showAdvanced ? (
                  <Field label="同层优先级（数字越大越优先，一般保持 0）">
                    <input
                      style={fieldStyle}
                      type="number"
                      value={bindingForm.priority}
                      onChange={(e) => setBindingForm({ ...bindingForm, priority: Number(e.target.value) || 0 })}
                    />
                  </Field>
                ) : null}
              </CreateForm>
            ) : null}

            {paneMode === 'browse' && tab === 'rules' ? (
              selectedRule ? (
                <DetailBlock
                  title={selectedRule.title}
                  badges={[
                    {
                      label: SEVERITY_LABEL[selectedRule.severity] || selectedRule.severity,
                      tone: severityTone(selectedRule.severity),
                    },
                    {
                      label: selectedRule.status === 'published' ? '已发布' : selectedRule.status,
                      tone: 'neutral',
                    },
                  ]}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                    标识 {selectedRule.slug}
                  </div>
                  <pre style={{
                    margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.55,
                    color: 'var(--text-secondary)', fontFamily: 'inherit',
                  }}>
                    {selectedRule.body_md}
                  </pre>
                </DetailBlock>
              ) : (
                <Empty hint="还没有规则。点击右上角「新建规则」录入第一条团队规范。" />
              )
            ) : null}

            {paneMode === 'browse' && tab === 'packs' ? (
              selectedPack ? (
                <DetailBlock
                  title={selectedPack.name}
                  badges={[
                    { label: KIND_LABEL[selectedPack.kind] || selectedPack.kind, tone: 'neutral' },
                    { label: `v${selectedPack.version}`, tone: 'neutral' },
                  ]}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                    标识 {selectedPack.slug}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>包含规则</div>
                  {(selectedPack.rule_ids || []).length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>（空包）</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(selectedPack.rule_ids || []).map((id) => {
                        const r = ruleById.get(id)
                        return (
                          <button
                            key={id}
                            type="button"
                            className="bb-btn bb-btn--ghost"
                            style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                            onClick={() => {
                              if (!r) return
                              setTab('rules')
                              setPaneMode('browse')
                              setSelectedId(r.id)
                            }}
                          >
                            {r ? r.title : id}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </DetailBlock>
              ) : (
                <Empty hint="还没有策略包。把多条规则编成包，再绑定下发。" />
              )
            ) : null}

            {paneMode === 'browse' && tab === 'bindings' ? (
              selectedBinding ? (
                (() => {
                  const pack = packById.get(selectedBinding.pack_id)
                  const packName = pack?.name || selectedBinding.pack_slug || selectedBinding.pack_id
                  const expertName = experts.find((e) => e.id === selectedBinding.target_key)?.name
                  const keyLabel = selectedBinding.target_type === 'tenant'
                    ? '当前租户'
                    : selectedBinding.target_type === 'expert' && expertName
                      ? expertName
                      : (selectedBinding.target_key || '—')
                  return (
                    <DetailBlock
                      title={packName}
                      badges={[
                        {
                          label: TARGET_LABEL[selectedBinding.target_type] || selectedBinding.target_type,
                          tone: 'neutral',
                        },
                        {
                          label: selectedBinding.enabled ? '已启用' : '已禁用',
                          tone: selectedBinding.enabled ? 'recommended' : 'neutral',
                        },
                      ]}
                    >
                      <dl style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        <div><dt style={{ display: 'inline', color: 'var(--text-tertiary)' }}>作用对象：</dt><dd style={{ display: 'inline', margin: 0 }}>{keyLabel}</dd></div>
                        <div><dt style={{ display: 'inline', color: 'var(--text-tertiary)' }}>同层优先级：</dt><dd style={{ display: 'inline', margin: 0 }}>{selectedBinding.priority}</dd></div>
                        {pack ? (
                          <div><dt style={{ display: 'inline', color: 'var(--text-tertiary)' }}>包类型：</dt><dd style={{ display: 'inline', margin: 0 }}>{KIND_LABEL[pack.kind] || pack.kind}</dd></div>
                        ) : null}
                      </dl>
                      <button
                        type="button"
                        className="bb-btn bb-btn--ghost"
                        style={{ marginTop: 16 }}
                        onClick={() => switchTab('preview')}
                      >
                        去效果预览看 IDE 会拿到什么
                      </button>
                    </DetailBlock>
                  )
                })()
              ) : (
                <Empty hint="还没有绑定。把策略包挂到租户 / 项目 / Mode / 专家。" />
              )
            ) : null}
          </section>
        </div>
      ) : null}
    </PanelChrome>
  )
}

function PreviewPane({
  previewKey,
  previewMode,
  previewExpert,
  experts,
  preview,
  busy,
  onKey,
  onMode,
  onExpert,
  onRun,
  onFillSeed,
}: {
  previewKey: string
  previewMode: string
  previewExpert: string
  experts: ExpertOption[]
  preview: ResolvedPreview | null
  busy: boolean
  onKey: (v: string) => void
  onMode: (v: string) => void
  onExpert: (v: string) => void
  onRun: () => void
  onFillSeed: () => void
}) {
  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
        模拟 IDE 打开工程时的上下文，查看叠加后最终生效的规则（不改动任何绑定）。
      </div>
      <div style={{
        padding: 14, borderRadius: 10, border: '1px solid var(--border)',
        background: 'var(--bg-card)', marginBottom: 14, maxWidth: 560,
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button type="button" className="bb-btn bb-btn--ghost" onClick={onFillSeed}>
            填入演示场景
          </button>
          <button type="button" className="bb-btn bb-btn--primary" disabled={busy} onClick={onRun}>
            预览叠加结果
          </button>
        </div>
        <Field label="仓库标识">
          <input style={fieldStyle} value={previewKey} onChange={(e) => onKey(e.target.value)} placeholder="github.com/org/repo" />
        </Field>
        <Field label="Mode">
          <input style={fieldStyle} value={previewMode} onChange={(e) => onMode(e.target.value)} placeholder="review" />
        </Field>
        <Field label="专家">
          <select style={fieldStyle} value={previewExpert} onChange={(e) => onExpert(e.target.value)}>
            <option value="">（不叠加专家包）</option>
            {experts.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </Field>
      </div>

      {!preview ? (
        <Empty hint="设置场景后点击「预览叠加结果」。也可用「填入演示场景」快速试跑 seed 数据。" />
      ) : preview.error ? (
        <div style={{ color: 'var(--danger)', fontSize: 12 }}>{preview.error}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            版本 {preview.policy_version || '—'}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>生效包</div>
            {(preview.packs || []).length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>无</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {(preview.packs || []).map((p) => (
                  <li key={`${p.slug}-${p.kind}`}>{p.name}（{KIND_LABEL[p.kind] || p.kind}）</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>最终规则</div>
            {(preview.rules || []).length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>无</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(preview.rules || []).map((r) => (
                  <div
                    key={r.slug}
                    style={{
                      padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      来自 {KIND_LABEL[r.source_kind] || r.source_kind} · {r.source_pack_slug}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function AdvancedToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        border: 'none', background: 'transparent', color: 'var(--text-tertiary)',
        fontSize: 11, padding: '4px 0', marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {open ? '收起高级选项' : '展开高级选项'}
    </button>
  )
}

function CreateForm({
  title,
  children,
  onCancel,
  onSubmit,
  busy,
  submitLabel,
}: {
  title: string
  children: ReactNode
  onCancel: () => void
  onSubmit: () => void
  busy: boolean
  submitLabel: string
}) {
  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{title}</div>
        <button type="button" className="bb-btn bb-btn--ghost" onClick={onCancel} disabled={busy}>取消</button>
      </div>
      {children}
      <button type="button" className="bb-btn bb-btn--primary" disabled={busy} onClick={onSubmit}>
        {submitLabel}
      </button>
    </div>
  )
}

function DetailBlock({
  title,
  badges,
  children,
}: {
  title: string
  badges?: Array<{ label: string; tone?: BadgeTone }>
  children: ReactNode
}) {
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</div>
      {badges && badges.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {badges.map((b) => (
            <span
              key={b.label}
              style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 999,
                ...toneStyle(b.tone || 'neutral'),
              }}
            >
              {b.label}
            </span>
          ))}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function ListItem({
  title,
  meta,
  badge,
  badgeTone = 'neutral',
  active,
  onClick,
}: {
  title: string
  meta: string
  badge?: string
  badgeTone?: BadgeTone
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '10px 10px', marginBottom: 4, borderRadius: 8,
        border: `1px solid ${active ? 'var(--border)' : 'transparent'}`,
        background: active ? 'var(--bg-hover)' : 'transparent',
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{meta}</div>
        </div>
        {badge ? (
          <span style={{
            fontSize: 9, padding: '1px 6px', borderRadius: 999, flexShrink: 0,
            ...toneStyle(badgeTone),
          }}>
            {badge}
          </span>
        ) : null}
      </div>
    </button>
  )
}

function Chip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 999, fontSize: 11,
      background: 'var(--bg-hover)', color: 'var(--text-primary)',
    }}>
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="移除"
        style={{
          border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
          display: 'inline-flex', color: 'var(--text-tertiary)',
        }}
      >
        <X size={12} />
      </button>
    </span>
  )
}

function Empty({ hint }: { hint: string }) {
  return (
    <div style={{
      padding: 28, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)',
      border: '1px dashed var(--border)', borderRadius: 10,
    }}>
      {hint}
    </div>
  )
}

function EmptyList({ hint }: { hint: string }) {
  return (
    <div style={{ padding: 16, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
      {hint}
    </div>
  )
}
