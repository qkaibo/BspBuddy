import type { CSSProperties } from 'react'

/** Shared root style so sidebar panels fill the App content slot. */
export const PANEL_ROOT_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: 'transparent',
  position: 'relative',
}

export function panelRootStyle(extra?: CSSProperties): CSSProperties {
  return extra ? { ...PANEL_ROOT_STYLE, ...extra } : PANEL_ROOT_STYLE
}
