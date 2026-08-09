import { useState, type CSSProperties } from 'react'
import { SopSkillsPanel } from './SopSkillsPanel'
import { SopLibraryPanel } from './SopLibraryPanel'
import { panelRootStyle } from '../lib/panel-layout'

export type SopWorkbenchMode = 'scope' | 'library'

interface Props {
  /** scope = 专家归属 (agents-002); library = SOP 创作台 (agents-003) */
  initialMode?: SopWorkbenchMode
}

/**
 * SOP Tab host: mode switch between Scope affiliation and Creation library.
 * Keeps the two PRDs from mixing entry copy / primary actions.
 */
export function SopWorkbench({ initialMode = 'scope' }: Props) {
  const [mode, setMode] = useState<SopWorkbenchMode>(initialMode)

  const tabBtn = (active: boolean): CSSProperties => ({
    padding: '6px 12px',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'inherit',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontWeight: active ? 600 : 400,
  })

  // Fill parent PanelChrome body (avoid nested height:100% fighting flex)
  return (
    <div style={panelRootStyle({ height: 'auto', flex: 1 })}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-card)',
          flexShrink: 0,
        }}
        role="tablist"
        aria-label="SOP 模式"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'scope'}
          onClick={() => setMode('scope')}
          style={tabBtn(mode === 'scope')}
        >
          专家归属
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'library'}
          onClick={() => setMode('library')}
          style={tabBtn(mode === 'library')}
        >
          SOP 创作台
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', paddingRight: 4 }}>
          {mode === 'scope' ? '复制到专家 · 不创作内容' : '新建 / 编辑 / 发布 · 不绑专家'}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {mode === 'scope' ? (
          <SopSkillsPanel onGoCreate={() => setMode('library')} />
        ) : (
          <SopLibraryPanel onGoScope={() => setMode('scope')} />
        )}
      </div>
    </div>
  )
}
