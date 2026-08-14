import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, X, Download, BookPlus, Sparkles, Star, Link2, Upload, KeyRound, Plus } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Expert } from '../lib/expert-types'
import { useExpertScope } from '../hooks/useExpertScope'
import { SkillInstallPanel } from './SkillInstallPanel'
import { SkillAccessRequestDialog } from './SkillAccessRequestDialog'
import { SkillImportDialog } from './SkillImportDialog'
import { SkillPublishDialog } from './SkillPublishDialog'
import { SkillAccessAdminPanel } from './SkillAccessAdminPanel'

const ipc = createIpcClient()

interface StoreItem {
  id: string
  slug: string
  name: string
  description?: string
  version?: string
  source?: string
  access_level?: string
  is_highlighted?: boolean
  category_id?: string | null
  category_name?: string | null
  author_user_id?: string | null
  author_display_name?: string | null
  is_mine?: boolean
  download_count?: number
  invoke_count?: number
  star_count?: number
  in_library?: boolean
  updated_at?: string
}

interface Category {
  id: string
  name: string
  sort_order: number
}

interface Revision {
  id: string
  version: string
  changelog?: string
  created_at: string
}

type DetailTab = 'install' | 'revisions' | 'security'
type StoreView = 'browse' | 'leaderboard' | 'approvals'
type BoardMetric = 'downloads' | 'invokes' | 'stars' | 'authors'

interface LeaderboardItem extends StoreItem {
  rank: number
  metric_value: number
}

interface AuthorLeaderboardItem {
  rank: number
  author_user_id?: string | null
  author_display_name: string
  skill_count: number
  is_mine?: boolean
}

const levelChip = (level: string) => {
  if (level === 'L3') return 'bb-chip bb-chip-danger'
  if (level === 'L2') return 'bb-chip bb-chip-warning'
  return 'bb-chip bb-chip-info'
}

function formatStats(item: Pick<StoreItem, 'download_count' | 'invoke_count' | 'star_count'>) {
  const downloads = item.download_count ?? 0
  const invokes = item.invoke_count ?? 0
  const stars = item.star_count ?? 0
  return `下载 ${downloads} · 调用 ${invokes} · 收藏 ${stars}`
}

function formatAuthor(item: Pick<StoreItem, 'is_mine' | 'author_display_name'>) {
  if (item.is_mine) {
    const name = (item.author_display_name || '').trim()
    return name ? `我上传的 · ${name}` : '我上传的'
  }
  const name = (item.author_display_name || '').trim()
  return name ? `作者 · ${name}` : '作者未知'
}

function metricLabel(metric: BoardMetric) {
  if (metric === 'invokes') return '调用'
  if (metric === 'stars') return '收藏'
  if (metric === 'authors') return '上传'
  return '下载'
}

export function SkillStorePanel() {
  const { scopeId, setScopeId } = useExpertScope()
  const [items, setItems] = useState<StoreItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [experts, setExperts] = useState<Expert[]>([])
  const [q, setQ] = useState('')
  const [source, setSource] = useState('all')
  const [categoryId, setCategoryId] = useState('')
  const [sort, setSort] = useState('latest')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [mineOnly, setMineOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [storeView, setStoreView] = useState<StoreView>('browse')
  const [boardMetric, setBoardMetric] = useState<BoardMetric>('downloads')
  const [boardItems, setBoardItems] = useState<LeaderboardItem[]>([])
  const [boardAuthors, setBoardAuthors] = useState<AuthorLeaderboardItem[]>([])
  const [boardLoading, setBoardLoading] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const [selected, setSelected] = useState<StoreItem | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('install')
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [requestOpen, setRequestOpen] = useState(false)
  const [revVersion, setRevVersion] = useState('')
  const [revChangelog, setRevChangelog] = useState('')

  const current = useMemo(
    () => experts.find((e) => e.id === scopeId) || experts.find((e) => !e.isOverall) || experts[0],
    [experts, scopeId],
  )

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [store, cats, expertList] = await Promise.all([
        ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_STORE_LIST, {
          q: q.trim() || undefined,
          source: source === 'all' ? undefined : source,
          category_id: categoryId || undefined,
          sort,
          featured: featuredOnly || undefined,
        }) as Promise<StoreItem[]>,
        ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_CATEGORIES) as Promise<Category[]>,
        ipc.invoke(IPC_CHANNELS.EXPERT_LIST) as Promise<Expert[] | { error?: string }>,
      ])
      setItems(Array.isArray(store) ? store : [])
      setCategories(Array.isArray(cats) ? cats : [])
      const list = Array.isArray(expertList) ? expertList : []
      setExperts(list)
      if (!scopeId || !list.some((e) => e.id === scopeId)) {
        const fallback = list.find((e) => !e.isOverall) || list[0]
        if (fallback) setScopeId(fallback.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载商店失败')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [q, source, categoryId, sort, featuredOnly, scopeId, setScopeId])

  useEffect(() => {
    void load()
  }, [load])

  const loadBoard = useCallback(async () => {
    setBoardLoading(true)
    setError('')
    try {
      const res = await ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_LEADERBOARD, {
        metric: boardMetric,
        category_id: categoryId || undefined,
        limit: 10,
      }) as {
        metric?: string
        kind?: string
        items?: LeaderboardItem[]
        authors?: AuthorLeaderboardItem[]
      }
      if (res?.kind === 'authors' || boardMetric === 'authors') {
        setBoardAuthors(Array.isArray(res?.authors) ? res.authors : [])
        setBoardItems([])
      } else {
        setBoardItems(Array.isArray(res?.items) ? res.items : [])
        setBoardAuthors([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载排行榜失败')
      setBoardItems([])
      setBoardAuthors([])
    } finally {
      setBoardLoading(false)
    }
  }, [boardMetric, categoryId])

  useEffect(() => {
    if (storeView === 'leaderboard') void loadBoard()
  }, [storeView, loadBoard])

  function switchView(view: StoreView) {
    setStoreView(view)
    setSelected(null)
    setMoreOpen(false)
  }

  async function openDetail(item: StoreItem) {
    setSelected(item)
    setDetailTab('install')
    try {
      const rows = await ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_REVISIONS, item.slug) as Revision[]
      setRevisions(Array.isArray(rows) ? rows : [])
    } catch {
      setRevisions([])
    }
  }

  async function addToLibrary(item: StoreItem) {
    try {
      await ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_LIBRARY_ADD, item.slug)
      showToast('已加入我的技能')
      setSelected((prev) => (prev ? { ...prev, in_library: true } : prev))
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, in_library: true } : x)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '加入失败')
    }
  }

  async function installToExpert(item: StoreItem) {
    if (!current || current.isOverall) {
      setError('请先选择非 overall 专家')
      return
    }
    if (!item.in_library) {
      await addToLibrary(item)
    }
    const result = await ipc.invoke(IPC_CHANNELS.RESOURCE_IMPORT, {
      targetAgentId: current.id,
      sourceAgentId: current.id,
      resourceType: 'general_skill',
      resourceIds: [item.id],
    }) as { status?: string; error?: string }
    if (result?.status === 'error') {
      setError(result.error || '安装到专家失败')
      return
    }
    showToast(`已安装到 ${current.name}`)
  }

  async function toggleStar(item: StoreItem) {
    try {
      const res = await ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_STAR, item.slug) as { star_count?: number; starred?: boolean }
      const count = res.star_count ?? item.star_count ?? 0
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, star_count: count } : x)))
      setSelected((prev) => (prev && prev.id === item.id ? { ...prev, star_count: count } : prev))
      showToast(res.starred ? '已收藏' : '已取消收藏')
    } catch (e) {
      setError(e instanceof Error ? e.message : '收藏失败')
    }
  }

  async function copyShareLink(item: StoreItem) {
    const text = `bspbuddy://skills/${item.slug}`
    try {
      await navigator.clipboard.writeText(text)
      showToast('分享链接已复制')
    } catch {
      setError('复制失败')
    }
  }

  async function createAgentToken() {
    setMoreOpen(false)
    try {
      const res = await ipc.invoke(IPC_CHANNELS.AGENT_SKILL_TOKEN_CREATE, {
        device_label: 'cursor-workspace',
        ttl_hours: 720,
        purpose: 'skill_runtime',
      }) as { token?: string; error?: string }
      if (!res?.token) {
        setError(res?.error || '签发失败')
        return
      }
      await navigator.clipboard.writeText(res.token)
      showToast('Agent Token 已复制（仅显示一次）')
    } catch (e) {
      setError(e instanceof Error ? e.message : '签发 Token 失败')
    }
  }

  async function bumpRevision(item: StoreItem) {
    if (!revVersion.trim() || !revChangelog.trim()) {
      setError('升版需要填写 version 与 changelog')
      return
    }
    try {
      await ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_CREATE_REVISION, item.slug, {
        version: revVersion.trim(),
        changelog: revChangelog.trim(),
      })
      showToast(`已发布 ${revVersion.trim()}`)
      setRevVersion('')
      setRevChangelog('')
      const rows = await ipc.invoke(IPC_CHANNELS.GENERAL_SKILL_REVISIONS, item.slug) as Revision[]
      setRevisions(Array.isArray(rows) ? rows : [])
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '升版失败')
    }
  }

  const needsAccess = selected?.access_level === 'L2' || selected?.access_level === 'L3'
  const visibleItems = useMemo(
    () => (mineOnly ? items.filter((item) => Boolean(item.is_mine)) : items),
    [items, mineOnly],
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--bg-root, #f5f7fa)',
      }}
    >
      {/* Top bar: one primary CTA, quiet secondary nav */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-subtle, #eef1f6)',
          background: 'var(--bg-card, #fff)',
          flexShrink: 0,
        }}
      >
        <div
          role="tablist"
          style={{
            display: 'inline-flex',
            padding: 2,
            borderRadius: 8,
            background: 'var(--bg-input, #f2f4f8)',
            gap: 2,
          }}
        >
          {([
            ['browse', '商店'],
            ['leaderboard', '排行'],
            ['approvals', '审批'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={storeView === id}
              onClick={() => switchView(id)}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: storeView === id ? 600 : 400,
                color: storeView === id ? 'var(--text-primary, #101010)' : 'var(--text-secondary, #5c6370)',
                background: storeView === id ? 'var(--bg-card, #fff)' : 'transparent',
                boxShadow: storeView === id ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="bb-btn bb-btn-secondary"
            onClick={() => setMoreOpen((v) => !v)}
            title="更多"
          >
            <KeyRound size={14} strokeWidth={1.75} />
            开发者
          </button>
          {moreOpen ? (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                minWidth: 200,
                background: 'var(--bg-card, #fff)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(16,24,40,0.12)',
                padding: 6,
                zIndex: 20,
              }}
            >
              <button
                type="button"
                className="bb-btn"
                style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
                onClick={() => void createAgentToken()}
              >
                签发 Agent Token
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary, #8b93a1)', padding: '4px 8px 6px' }}>
                写入工作区 `.bspbuddy_skill_token`，勿粘贴到对话
              </div>
            </div>
          ) : null}
        </div>

        <button type="button" className="bb-btn bb-btn-secondary" onClick={() => setImportOpen(true)}>
          <Upload size={14} strokeWidth={1.75} /> 导入
        </button>
        <button type="button" className="bb-btn bb-btn-primary" onClick={() => setPublishOpen(true)}>
          <Plus size={14} strokeWidth={1.75} /> 发布技能
        </button>
      </div>

      {toast ? (
        <div className="bb-toast" style={{ margin: '8px 16px 0' }}>{toast}</div>
      ) : null}
      {error ? (
        <div style={{ color: 'var(--danger, #dc2626)', fontSize: 12, padding: '8px 16px 0' }}>{error}</div>
      ) : null}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
        {storeView === 'approvals' ? (
          <SkillAccessAdminPanel onToast={showToast} />
        ) : storeView === 'leaderboard' ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div
                role="tablist"
                style={{
                  display: 'inline-flex',
                  padding: 2,
                  borderRadius: 8,
                  background: 'var(--bg-input, #f2f4f8)',
                  gap: 2,
                }}
              >
                {([
                  ['downloads', '下载'],
                  ['invokes', '调用'],
                  ['stars', '收藏'],
                  ['authors', '上传者'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={boardMetric === id}
                    onClick={() => setBoardMetric(id)}
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: boardMetric === id ? 600 : 400,
                      color: boardMetric === id ? 'var(--text-primary, #101010)' : 'var(--text-secondary, #5c6370)',
                      background: boardMetric === id ? 'var(--bg-card, #fff)' : 'transparent',
                      boxShadow: boardMetric === id ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                className="bb-input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={{ width: 120, height: 32, padding: '0 8px' }}
                aria-label="分类"
              >
                <option value="">全部分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {boardLoading ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary, #8b93a1)' }}>加载中…</div>
            ) : null}

            {!boardLoading && boardMetric === 'authors' && boardAuthors.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: 'var(--text-secondary, #5c6370)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  background: 'var(--bg-card, #fff)',
                  borderRadius: 10,
                  border: '1px dashed var(--border, #e2e8f0)',
                }}
              >
                暂无上传者数据。去「商店」导入或发布技能后会出现在这里。
              </div>
            ) : null}

            {!boardLoading && boardMetric !== 'authors' && boardItems.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: 'var(--text-secondary, #5c6370)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  background: 'var(--bg-card, #fff)',
                  borderRadius: 10,
                  border: '1px dashed var(--border, #e2e8f0)',
                }}
              >
                暂无排行数据。去「商店」导入或发布技能后，使用产生的下载/调用/收藏会出现在这里。
              </div>
            ) : null}

            {!boardLoading && boardMetric === 'authors' && boardAuthors.length > 0 ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {boardAuthors.map((item) => (
                  <div
                    key={item.author_user_id || item.author_display_name}
                    data-author-rank={item.rank}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr auto',
                      gap: 12,
                      alignItems: 'center',
                      padding: '12px 14px',
                      background: 'var(--bg-card, #fff)',
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: item.rank <= 3 ? 16 : 13,
                        fontWeight: 700,
                        color: item.rank <= 3 ? 'var(--text-primary, #101010)' : 'var(--text-tertiary, #8b93a1)',
                        textAlign: 'center',
                      }}
                    >
                      {item.rank}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #101010)' }}>
                        {item.author_display_name}
                        {item.is_mine ? (
                          <span className="bb-chip bb-chip-success" style={{ marginLeft: 8, fontWeight: 500 }}>
                            我
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #8b93a1)', marginTop: 4 }}>
                        已发布技能
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #5c6370)', whiteSpace: 'nowrap' }}>
                      上传 {item.skill_count}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {!boardLoading && boardMetric !== 'authors' && boardItems.length > 0 ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {boardItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-skill-rank={item.rank}
                    onClick={() => void openDetail(item)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr auto',
                      gap: 12,
                      alignItems: 'center',
                      textAlign: 'left',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      background: 'var(--bg-card, #fff)',
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: item.rank <= 3 ? 16 : 13,
                        fontWeight: 700,
                        color: item.rank <= 3 ? 'var(--text-primary, #101010)' : 'var(--text-tertiary, #8b93a1)',
                        textAlign: 'center',
                      }}
                    >
                      {item.rank}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #101010)' }}>
                        {item.name}
                        {item.is_mine ? (
                          <span className="bb-chip bb-chip-success" style={{ marginLeft: 8, fontWeight: 500 }}>
                            我上传的
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #8b93a1)', marginTop: 4 }}>
                        {formatAuthor(item)}
                        {item.category_name ? ` · ${item.category_name}` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #5c6370)', whiteSpace: 'nowrap' }}>
                      {metricLabel(boardMetric)} {item.metric_value}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'nowrap',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: '1 1 auto',
                  minWidth: 120,
                  background: 'var(--bg-card, #fff)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: 8,
                  padding: '0 10px',
                  height: 32,
                }}
              >
                <Search size={14} strokeWidth={1.75} color="var(--text-tertiary, #8b93a1)" />
                <input
                  className="bb-input"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    background: 'transparent',
                    boxShadow: 'none',
                    height: 30,
                    padding: '0 2px',
                  }}
                  placeholder="搜索技能…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <select
                className="bb-input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={{ width: 96, flex: '0 0 auto', height: 32, padding: '0 8px' }}
                aria-label="分类"
              >
                <option value="">分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                className="bb-input"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                style={{ width: 80, flex: '0 0 auto', height: 32, padding: '0 8px' }}
                aria-label="来源"
              >
                <option value="all">来源</option>
                <option value="enterprise">企业</option>
                <option value="external">外部</option>
                <option value="local">本地</option>
              </select>
              <select
                className="bb-input"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                style={{ width: 72, flex: '0 0 auto', height: 32, padding: '0 8px' }}
                aria-label="排序"
              >
                <option value="latest">最新</option>
                <option value="downloads">下载</option>
                <option value="stars">收藏</option>
              </select>
              <label
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary, #5c6370)',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                  flex: '0 0 auto',
                  whiteSpace: 'nowrap',
                }}
              >
                <input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} />
                精选
              </label>
              <label
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary, #5c6370)',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                  flex: '0 0 auto',
                  whiteSpace: 'nowrap',
                }}
              >
                <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
                我上传的
              </label>
            </div>

            {loading ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary, #8b93a1)' }}>加载中…</div>
            ) : null}

            {!loading && visibleItems.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: 'var(--text-secondary, #5c6370)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  background: 'var(--bg-card, #fff)',
                  borderRadius: 10,
                  border: '1px dashed var(--border, #e2e8f0)',
                }}
              >
                {mineOnly
                  ? '你还没有上传过技能。点右上角「导入」或「发布技能」。'
                  : '暂无技能。点右上角「导入」上传含 SKILL.md 的包。'}
              </div>
            ) : null}

            {!loading && visibleItems.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {visibleItems.map((item) => {
                  const level = item.access_level || 'L1'
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-skill-card="1"
                      onClick={() => void openDetail(item)}
                      style={{
                        textAlign: 'left',
                        padding: '14px 14px 12px',
                        cursor: 'pointer',
                        background: 'var(--bg-card, #fff)',
                        border: '1px solid var(--border, #e2e8f0)',
                        borderRadius: 10,
                        display: 'grid',
                        gap: 8,
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-border, #bfdbfe)'
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.06)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border, #e2e8f0)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #101010)', lineHeight: 1.35 }}>
                          {item.name}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #8b93a1)', flexShrink: 0 }}>
                          v{item.version || '0.1.0'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary, #5c6370)', lineHeight: 1.45, minHeight: 36 }}>
                        {(item.description || '').slice(0, 72) || '暂无描述'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className={levelChip(level)}>{level}</span>
                        {item.category_name ? (
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary, #8b93a1)' }}>{item.category_name}</span>
                        ) : null}
                        {item.is_highlighted ? <span className="bb-chip bb-chip-info">精选</span> : null}
                        {item.is_mine ? <span className="bb-chip bb-chip-success">我上传的</span> : null}
                        {item.in_library ? (
                          <span style={{ fontSize: 11, color: 'var(--success, #16a34a)' }}>已在库</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #8b93a1)' }}>
                        {formatAuthor(item)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #8b93a1)' }}>
                        {formatStats(item)}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {selected ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16, 24, 40, 0.28)',
            zIndex: 70,
            display: 'grid',
            justifyContent: 'end',
          }}
          onClick={() => setSelected(null)}
        >
          <aside
            style={{
              width: 'min(420px, 100vw)',
              height: '100%',
              background: 'var(--bg-card, #fff)',
              borderLeft: '1px solid var(--border, #e2e8f0)',
              padding: '18px 18px 24px',
              overflow: 'auto',
              display: 'grid',
              gap: 14,
              alignContent: 'start',
              boxShadow: '-12px 0 40px rgba(16,24,40,0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #101010)' }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary, #8b93a1)', marginTop: 4 }}>
                  <span className={levelChip(selected.access_level || 'L1')} style={{ marginRight: 6 }}>
                    {selected.access_level || 'L1'}
                  </span>
                  v{selected.version || '0.1.0'}
                  <span style={{ margin: '0 6px' }}>·</span>
                  {selected.slug}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #5c6370)', marginTop: 6 }}>
                  {formatAuthor(selected)}
                </div>
              </div>
              <button type="button" className="bb-icon-btn" onClick={() => setSelected(null)} aria-label="关闭">
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary, #5c6370)' }}>
              {selected.description || '暂无描述'}
            </p>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary, #8b93a1)' }}>
              {formatStats(selected)}
            </div>

            {/* Action hierarchy: one primary + secondary + icon quiet actions */}
            <div style={{ display: 'grid', gap: 8 }}>
              <button type="button" className="bb-btn bb-btn-primary" style={{ width: '100%' }} onClick={() => void installToExpert(selected)}>
                <Download size={14} strokeWidth={1.75} />
                安装到{current && !current.isOverall ? ` ${current.name}` : '专家'}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="bb-btn bb-btn-secondary" style={{ flex: 1 }} onClick={() => void addToLibrary(selected)}>
                  <BookPlus size={14} strokeWidth={1.75} /> 加入我的技能
                </button>
                {needsAccess ? (
                  <button type="button" className="bb-btn bb-btn-secondary" style={{ flex: 1 }} onClick={() => setRequestOpen(true)}>
                    <Sparkles size={14} strokeWidth={1.75} /> 申请授权
                  </button>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" className="bb-btn" style={{ border: 'none', color: 'var(--text-secondary)' }} onClick={() => void toggleStar(selected)}>
                  <Star size={14} strokeWidth={1.75} /> {selected.star_count ? `已收藏 ${selected.star_count}` : '收藏'}
                </button>
                <button type="button" className="bb-btn" style={{ border: 'none', color: 'var(--text-secondary)' }} onClick={() => void copyShareLink(selected)}>
                  <Link2 size={14} strokeWidth={1.75} /> 分享
                </button>
              </div>
            </div>

            <div
              role="tablist"
              style={{
                display: 'flex',
                gap: 0,
                borderBottom: '1px solid var(--border-subtle, #eef1f6)',
              }}
            >
              {([
                ['install', '一键安装'],
                ['revisions', '版本'],
                ['security', '安全'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={detailTab === id}
                  onClick={() => setDetailTab(id)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: detailTab === id ? 600 : 400,
                    color: detailTab === id ? 'var(--accent, #2563eb)' : 'var(--text-secondary, #5c6370)',
                    borderBottom: detailTab === id ? '2px solid var(--accent, #2563eb)' : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {detailTab === 'install' ? (
              <SkillInstallPanel
                slug={selected.slug}
                accessLevel={selected.access_level || 'L1'}
                canInvoke={(selected.access_level || 'L1') !== 'L3'}
                onRequestAccess={() => setRequestOpen(true)}
              />
            ) : null}

            {detailTab === 'revisions' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gap: 8, padding: 12, background: 'var(--bg-input, #f2f4f8)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>发布新版本</div>
                  <input
                    className="bb-input"
                    placeholder="version，如 0.2.0"
                    value={revVersion}
                    onChange={(e) => setRevVersion(e.target.value)}
                  />
                  <textarea
                    className="bb-input"
                    rows={3}
                    placeholder="changelog"
                    value={revChangelog}
                    onChange={(e) => setRevChangelog(e.target.value)}
                  />
                  <button type="button" className="bb-btn bb-btn-secondary" onClick={() => void bumpRevision(selected)}>
                    发布升版
                  </button>
                </div>
                {revisions.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>暂无版本记录</div>
                ) : (
                  revisions.map((rev) => (
                    <div key={rev.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle, #eef1f6)' }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>v{rev.version}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{rev.created_at}</div>
                      <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>{rev.changelog || '—'}</div>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {detailTab === 'security' ? (
              <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                安全扫描即将上线。当前请人工审阅 SKILL.md 与脚本后再装到生产专家。
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {requestOpen && selected ? (
        <SkillAccessRequestDialog
          slug={selected.slug}
          accessLevel={selected.access_level || 'L1'}
          onClose={() => setRequestOpen(false)}
          onSubmitted={(msg) => showToast(msg)}
        />
      ) : null}

      {importOpen ? (
        <SkillImportDialog
          categories={categories}
          onClose={() => setImportOpen(false)}
          onImported={(slug) => {
            showToast(`已导入 ${slug}`)
            void load()
          }}
        />
      ) : null}

      {publishOpen ? (
        <SkillPublishDialog
          categories={categories}
          onClose={() => setPublishOpen(false)}
          onPublished={(slug) => {
            showToast(`已发布 ${slug}`)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}
