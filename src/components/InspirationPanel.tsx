import { useState, useEffect, useMemo } from 'react'
import {
  Sparkles, Heart,
  Search as SearchIcon, ArrowLeft, Play, Star, Users,
} from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { InspirationCase, InspirationCategory, InspirationPreset } from '../lib/plugin-types'
import { INSPIRATION_CATEGORY_META } from '../lib/plugin-types'

const ipc = createIpcClient()

const ALL_CATEGORIES: InspirationCategory[] = [
  'document', 'data', 'development', 'creative', 'learning', 'productivity', 'lifestyle',
]

interface Props {
  onClose: () => void
  /** 做同款回调：将预设载入对话输入框 */
  onFork?: (preset: InspirationPreset) => void
}

export function InspirationPanel({ onClose, onFork }: Props) {
  const [cases, setCases] = useState<InspirationCase[]>([])
  const [featured, setFeatured] = useState<InspirationCase[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [activeCategory, setActiveCategory] = useState<InspirationCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedCase, setSelectedCase] = useState<InspirationCase | null>(null)
  const [view, setView] = useState<'browse' | 'detail' | 'favorites'>('browse')
  const [forkingId, setForkingId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const list = (await ipc.invoke(IPC_CHANNELS.INSPIRATION_LIST)) as InspirationCase[]
    setCases(list)
    setFeatured(list.filter((c) => c.featured).sort(() => Math.random() - 0.5).slice(0, 8))

    const favList = (await ipc.invoke(IPC_CHANNELS.INSPIRATION_FAVORITES_LIST)) as InspirationCase[]
    setFavorites(new Set(favList.map((f) => f.id)))
  }

  async function handleToggleFavorite(caseId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await ipc.invoke(IPC_CHANNELS.INSPIRATION_FAVORITE, caseId)
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(caseId)) next.delete(caseId)
      else next.add(caseId)
      return next
    })
  }

  async function handleFork(c: InspirationCase) {
    setForkingId(c.id)
    const result = (await ipc.invoke(IPC_CHANNELS.INSPIRATION_FORK, c.id)) as {
      success: boolean
      preset?: InspirationPreset
      error?: string
    }
    setForkingId(null)
    if (result.success && result.preset && onFork) {
      onFork(result.preset)
    }
  }

  async function handleShowDetail(c: InspirationCase) {
    const detail = (await ipc.invoke(IPC_CHANNELS.INSPIRATION_DETAIL, c.id)) as InspirationCase | undefined
    if (detail) {
      setSelectedCase(detail)
      setView('detail')
    }
  }

  const filtered = useMemo(() => {
    let result = cases
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    if (view === 'favorites') {
      result = result.filter((c) => favorites.has(c.id))
    } else if (view === 'browse' && activeCategory !== 'all') {
      result = result.filter((c) => c.category === activeCategory)
    }
    return result
  }, [cases, search, activeCategory, view, favorites])

  function goBack() {
    setView('browse')
    setSelectedCase(null)
  }

  // ====== Detail View ======
  if (view === 'detail' && selectedCase) {
    const meta = INSPIRATION_CATEGORY_META[selectedCase.category]
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={goBack}
            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{selectedCase.title}</div>
          <button
            onClick={(e) => handleToggleFavorite(selectedCase.id, e)}
            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
          >
            <Heart size={18} fill={favorites.has(selectedCase.id) ? '#EF4444' : 'none'} color={favorites.has(selectedCase.id) ? '#EF4444' : 'var(--text-tertiary)'} />
          </button>
          <button onClick={onClose} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>x</button>
        </div>

        {/* Detail Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* Preview placeholder */}
          <div
            style={{
              width: '100%', height: 180, borderRadius: 10, marginBottom: 16,
              background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}44)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${meta.color}33`,
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 48 }}>✨</span>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{selectedCase.title}</div>
            </div>
          </div>

          {/* Category & Tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 500,
                background: `${meta.color}22`, color: meta.color,
              }}
            >
              {meta.label}
            </span>
            {selectedCase.tags.map((tag) => (
              <span key={tag} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                {tag}
              </span>
            ))}
          </div>

          {/* Description */}
          <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)', marginBottom: 20 }}>
            {selectedCase.description}
          </p>

          {/* Tools & Expert */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>使用的工具</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedCase.toolsUsed.map((t) => (
                  <span key={t} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'var(--accent-light)', color: 'var(--accent)' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            {selectedCase.expertName && (
              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>推荐专家</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} color="var(--accent)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedCase.expertName}</span>
                </div>
              </div>
            )}
          </div>

          {/* Prompt Preview */}
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>预设 Prompt</div>
            <pre style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
              {selectedCase.prompt}
            </pre>
          </div>
        </div>

        {/* Bottom action */}
        <div style={{ padding: '12px 16px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={() => handleFork(selectedCase)}
            disabled={forkingId === selectedCase.id}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: forkingId === selectedCase.id ? 0.6 : 1,
            }}
          >
            <Play size={16} />
            {forkingId === selectedCase.id ? '加载中...' : '制作我的版本'}
          </button>
        </div>
      </div>
    )
  }

  // ====== Browse / Favorites View ======
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={18} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>灵感</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => { setView(view === 'favorites' ? 'browse' : 'favorites'); setActiveCategory('all') }}
            style={{
              padding: '4px 10px', borderRadius: 4, border: 'none',
              background: view === 'favorites' ? 'var(--accent-light)' : 'var(--bg-hover)',
              color: view === 'favorites' ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: view === 'favorites' ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Heart size={12} fill={view === 'favorites' ? 'var(--accent)' : 'none'} />
            收藏
          </button>
          <button onClick={onClose} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>x</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-input)', borderRadius: 6, padding: '5px 10px', flex: 1 }}>
          <SearchIcon size={12} color="var(--text-tertiary)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索灵感案例..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {/* Category tabs */}
      {view === 'browse' && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto' }}>
          <button
            onClick={() => setActiveCategory('all')}
            style={{
              padding: '5px 12px', borderRadius: 14, border: 'none', whiteSpace: 'nowrap',
              background: activeCategory === 'all' ? 'var(--accent)' : 'var(--bg-hover)',
              color: activeCategory === 'all' ? '#fff' : 'var(--text-secondary)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: activeCategory === 'all' ? 600 : 400,
            }}
          >
            精选
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const meta = INSPIRATION_CATEGORY_META[cat]
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '5px 12px', borderRadius: 14, border: 'none', whiteSpace: 'nowrap',
                  background: activeCategory === cat ? `${meta.color}22` : 'var(--bg-hover)',
                  color: activeCategory === cat ? meta.color : 'var(--text-secondary)',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: activeCategory === cat ? 600 : 400,
                }}
              >
                {meta.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Featured section — only when browsing "all" with no search */}
        {view === 'browse' && activeCategory === 'all' && !search && featured.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Star size={14} color="#F59E0B" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>热门精选</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {featured.map((c) => (
                <CaseCard
                  key={c.id}
                  c={c}
                  isFavorited={favorites.has(c.id)}
                  forkingId={forkingId}
                  onToggleFavorite={handleToggleFavorite}
                  onFork={handleFork}
                  onShowDetail={handleShowDetail}
                />
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        {view === 'browse' && activeCategory === 'all' && !search && featured.length > 0 && (
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />
        )}

        {/* Case list */}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
            {view === 'favorites' ? '还没有收藏的灵感案例，去浏览案例并点击红心收藏吧' : '没有找到匹配的案例'}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {filtered.map((c) => (
            <CaseCard
              key={c.id}
              c={c}
              isFavorited={favorites.has(c.id)}
              forkingId={forkingId}
              onToggleFavorite={handleToggleFavorite}
              onFork={handleFork}
              onShowDetail={handleShowDetail}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ====== Case Card ======
interface CaseCardProps {
  c: InspirationCase
  isFavorited: boolean
  forkingId: string | null
  onToggleFavorite: (caseId: string, e: React.MouseEvent) => void
  onFork: (c: InspirationCase) => void
  onShowDetail: (c: InspirationCase) => void
}

function CaseCard({ c, isFavorited, forkingId, onToggleFavorite, onFork, onShowDetail }: CaseCardProps) {
  const meta = INSPIRATION_CATEGORY_META[c.category]

  return (
    <div
      onClick={() => onShowDetail(c)}
      style={{
        borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)',
        background: 'var(--bg-card)', cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
    >
      {/* Preview image placeholder */}
      <div
        style={{
          height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, ${meta.color}18, ${meta.color}33)`,
          position: 'relative',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 32 }}>✨</span>
        </div>
        {/* Favorite button */}
        <button
          onClick={(e) => onToggleFavorite(c.id, e)}
          style={{
            position: 'absolute', top: 6, right: 6, width: 26, height: 26,
            borderRadius: '50%', background: 'rgba(0,0,0,0.35)', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Heart size={13} fill={isFavorited ? '#EF4444' : 'none'} color={isFavorited ? '#EF4444' : '#fff'} />
        </button>
      </div>

      {/* Card body */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: `${meta.color}22`, color: meta.color, fontWeight: 500 }}>
            {meta.label}
          </span>
          {c.featured && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: '#F59E0B22', color: '#F59E0B', fontWeight: 500 }}>
              热门
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 4 }}>
          {c.title}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {c.description}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {c.toolsUsed.slice(0, 2).map((t) => (
              <span key={t} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>
                {t}
              </span>
            ))}
            {c.toolsUsed.length > 2 && <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>+{c.toolsUsed.length - 2}</span>}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onFork(c)
            }}
            disabled={forkingId === c.id}
            style={{
              padding: '4px 10px', borderRadius: 4, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 10, cursor: 'pointer',
              fontFamily: 'inherit', opacity: forkingId === c.id ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            <Play size={10} />
            {forkingId === c.id ? '...' : '做同款'}
          </button>
        </div>
      </div>
    </div>
  )
}
