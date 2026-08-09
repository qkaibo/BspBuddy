import type { CSSProperties, ReactNode } from 'react'

const shellStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
}

/**
 * Main-content slot wrapper: fills the workspace between Sidebar and optional ResultPanel.
 * Direct panel children stretch via `.content-shell` rules in index.css;
 * fixed overlays (dialog / presentation) are excluded.
 */
export function ContentShell({ children }: { children: ReactNode }) {
  return (
    <div className="content-shell bb-main-canvas" style={shellStyle}>
      {children}
    </div>
  )
}
