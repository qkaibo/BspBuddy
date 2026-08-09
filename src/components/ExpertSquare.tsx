import { useState, useEffect } from 'react'
import { Search, Star, Copy, ChevronLeft, ChevronRight, User } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import { apiGet } from '../lib/api-client'
import type { Expert } from '../lib/expert-types'
import { mapAgentsToExperts } from '../lib/expert-mapper'
import type { FastApiAgent } from '../lib/expert-mapper'

const ipc = createIpcClient()

interface Props {
  onCopyExpert: (expert: Expert) => void
}

export function ExpertSquare({ onCopyExpert }: Props) {
  const [experts, setExperts] = useState<Expert[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [detailExpert, setDetailExpert] = useState<Expert | null>(null)
  const [detailIndex, setDetailIndex] = useState<number>(-1)

  useEffect(() => {
    async function loadSquare() {
      try {
        const status = await ipc.invoke(IPC_CHANNELS.EXPERT_FASTAPI_STATUS) as { ready: boolean }
        if (status?.ready) {
          try {
            const agents = await apiGet<FastApiAgent[]>('/api/chat/agents?is_overall=true')
            setExperts(mapAgentsToExperts(agents))
            return
          } catch { /* fall through to IPC */ }
        }
      } catch { /* fall through to IPC */ }
      ipc.invoke(IPC_CHANNELS.EXPERT_SQUARE_LIST).then((list) => setExperts(list as Expert[]))
    }
    loadSquare()
  }, [])

  const allCategories = ['all', ...new Set(experts.flatMap((e) => e.categories || []))]

  const filtered = experts.filter((e) => {
    if (selectedCategory !== 'all' && !(e.categories || []).includes(selectedCategory)) return false
    if (
      search
      && !(e.name || '').includes(search)
      && !(e.title || '').includes(search)
      && !(e.description || '').includes(search)
    ) return false
    return true
  })

  function openDetail(expert: Expert) {
    const idx = filtered.findIndex((e) => e.id === expert.id)
    setDetailExpert(expert)
    setDetailIndex(idx)
  }

  function navigateDetail(dir: -1 | 1) {
    const newIdx = detailIndex + dir
    if (newIdx >= 0 && newIdx < filtered.length) {
      setDetailExpert(filtered[newIdx])
      setDetailIndex(newIdx)
    }
  }

  return (
    <div>
      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-input)', borderRadius: 4, padding: '4px 8px', flex: 1 }}>
          <Search size={12} color="var(--text-tertiary)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            name="expert-square-search"
            aria-label="搜索广场专家"
            placeholder="搜索广场专家…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />
        </div>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 11, fontFamily: 'inherit', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
        >
          <option value="all">全部行业</option>
          {allCategories.filter((c) => c !== 'all').map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>广场暂无公开专家</div>
      )}

      {/* Cards */}
      {filtered.map((expert) => (
        <button
          type="button"
          key={expert.id}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '14px', borderRadius: 10, background: 'var(--bg-card)', marginBottom: 8,
            border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit',
          }}
          onClick={() => openDetail(expert)}
          aria-label={`查看专家 ${expert.name}`}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-light)', flexShrink: 0, fontSize: 16 }}>
              {expert.name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{expert.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{expert.title}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{expert.description}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                {(expert.categories || []).map((c) => (
                  <span key={c} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>{c}</span>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>
                {expert.rating && <span><Star size={10} color="var(--warning)" style={{ verticalAlign: 'middle' }} aria-hidden="true" /> {expert.rating}</span>}
                {expert.usageCount && <span>{expert.usageCount.toLocaleString()} 次使用</span>}
              </div>
            </div>
          </div>
        </button>
      ))}

      {/* Detail Drawer */}
      {detailExpert && (
        <div
          role="dialog"
          aria-modal="true"
          data-overlay="true"
          style={{
          position: 'fixed', inset: 0, zIndex: 210,
          background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end',
          overscrollBehavior: 'contain',
        }} onClick={() => setDetailExpert(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '380px', height: '100%', background: 'var(--bg-card)',
              borderLeft: '1px solid var(--border)', overflowY: 'auto',
              display: 'flex', flexDirection: 'column',
              overscrollBehavior: 'contain',
            }}
          >
            {/* Navigation bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" onClick={() => navigateDetail(-1)} disabled={detailIndex <= 0} aria-label="上一位专家"
                  style={{ padding: '4px', borderRadius: 4, border: 'none', background: 'none', cursor: detailIndex > 0 ? 'pointer' : 'default', color: 'var(--text-secondary)', opacity: detailIndex > 0 ? 1 : 0.3 }}
                ><ChevronLeft size={16} aria-hidden="true" /></button>
                <button type="button" onClick={() => navigateDetail(1)} disabled={detailIndex >= filtered.length - 1} aria-label="下一位专家"
                  style={{ padding: '4px', borderRadius: 4, border: 'none', background: 'none', cursor: detailIndex < filtered.length - 1 ? 'pointer' : 'default', color: 'var(--text-secondary)', opacity: detailIndex < filtered.length - 1 ? 1 : 0.3 }}
                ><ChevronRight size={16} aria-hidden="true" /></button>
              </div>
              <button type="button" onClick={() => setDetailExpert(null)} aria-label="关闭详情" style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-tertiary)' }}>×</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-light)', fontSize: 20, flexShrink: 0 }}>
                  {detailExpert.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{detailExpert.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{detailExpert.title}</div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                {detailExpert.description}
              </div>

              <Section label="人设" value={detailExpert.persona} />
              <Section label="方法论" value={detailExpert.methodology} />

              {detailExpert.categories.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>分类</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {detailExpert.categories.map((c) => (
                      <span key={c} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {detailExpert.bindings && (
                <>
                  {(detailExpert.bindings?.sopSkills?.length || 0) > 0 && (
                    <Section label="SOP 技能" value={(detailExpert.bindings?.sopSkills || []).join('、')} />
                  )}
                  {(detailExpert.bindings?.skills?.length || 0) > 0 && (
                    <Section label="Skill" value={(detailExpert.bindings?.skills || []).join('、')} />
                  )}
                  {(detailExpert.bindings?.mcpServers?.length || 0) > 0 && (
                    <Section label="MCP" value={(detailExpert.bindings?.mcpServers || []).join('、')} />
                  )}
                  {(detailExpert.bindings?.knowledgeBases?.length || 0) > 0 && (
                    <Section label="知识库" value={(detailExpert.bindings?.knowledgeBases || []).join('、')} />
                  )}
                  {detailExpert.bindings?.modelId && (
                    <Section label="绑定模型" value={detailExpert.bindings.modelId} />
                  )}
                </>
              )}
            </div>

            {/* Bottom action */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { onCopyExpert(detailExpert); setDetailExpert(null) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 0', borderRadius: 8, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                }}
              >
                <Copy size={14} /> 复制到我的专家
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{value}</div>
    </div>
  )
}
