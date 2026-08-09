import type { CSSProperties, ReactNode } from 'react'
import { X } from 'lucide-react'
import { panelRootStyle } from '../../lib/panel-layout'

interface PanelChromeProps {
  title: string
  icon?: ReactNode
  onClose?: () => void
  tabs?: { id: string; label: string }[]
  activeTab?: string
  onTabChange?: (id: string) => void
  toolbar?: ReactNode
  children: ReactNode
  /** Extra styles on the scrollable body */
  bodyStyle?: CSSProperties
}

/**
 * Shared panel chrome: title bar + optional tabs + body.
 * Keeps sidebar panels visually consistent (spacing, type, hairline borders).
 */
export function PanelChrome({
  title,
  icon,
  onClose,
  tabs,
  activeTab,
  onTabChange,
  toolbar,
  children,
  bodyStyle,
}: PanelChromeProps) {
  return (
    <div style={panelRootStyle()} className="bb-panel">
      <header className="bb-panel-header">
        <div className="bb-panel-header-left">
          {icon ? <span className="bb-panel-icon" aria-hidden="true">{icon}</span> : null}
          <h1 className="bb-panel-title">{title}</h1>
        </div>
        {onClose ? (
          <button type="button" className="bb-icon-btn" onClick={onClose} aria-label={`关闭${title}`}>
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {tabs && tabs.length > 0 ? (
        <nav className="bb-tabs" aria-label={`${title}分区`}>
          {tabs.map((tab) => {
            const active = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                className={`bb-tab${active ? ' bb-tab--active' : ''}`}
                onClick={() => onTabChange?.(tab.id)}
                aria-current={active ? 'page' : undefined}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      ) : null}

      {toolbar ? <div className="bb-panel-toolbar">{toolbar}</div> : null}

      <div className="bb-panel-body" style={bodyStyle}>
        {children}
      </div>
    </div>
  )
}
