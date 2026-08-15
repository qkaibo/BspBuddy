// ============================================================
// AppTitleBar — Windows/Linux: BspBuddy + File/Edit/… 同一行
// macOS: 仅拖拽条（系统菜单栏已有 File 等）
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import { BspBuddyMark } from './BspBuddyMark'

const ipc = createIpcClient()

type MenuId = 'file' | 'edit' | 'view' | 'window' | 'help'

interface MenuItem {
  label: string
  action?: () => void
  shortcut?: string
  separator?: boolean
}

function getPlatform(): string {
  const api = (window as unknown as { electronAPI?: { platform?: string } }).electronAPI
  return api?.platform || 'browser'
}

function isPortalEmbed(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('portal_embed') === '1'
  } catch {
    return false
  }
}

export function AppTitleBar() {
  // Portal 单窗嵌入：顶栏由 Portal 壳提供，隐藏自有标题栏
  if (isPortalEmbed()) return null

  const platform = getPlatform()
  const isMac = platform === 'darwin'
  const showMenus = platform === 'win32' || platform === 'linux'
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openMenu) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [openMenu])

  const run = async (channel: string) => {
    setOpenMenu(null)
    try {
      await ipc.invoke(channel)
    } catch (err) {
      console.error('[AppTitleBar]', channel, err)
    }
  }

  const menus: Record<MenuId, { label: string; items: MenuItem[] }> = {
    file: {
      label: 'File',
      items: [
        { label: 'Reload', shortcut: 'Ctrl+R', action: () => void run(IPC_CHANNELS.WINDOW_RELOAD) },
        { separator: true, label: '' },
        { label: 'Exit', shortcut: 'Alt+F4', action: () => void run(IPC_CHANNELS.APP_QUIT) },
      ],
    },
    edit: {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: () => document.execCommand('redo') },
        { separator: true, label: '' },
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => document.execCommand('selectAll') },
      ],
    },
    view: {
      label: 'View',
      items: [
        { label: 'Reload', action: () => void run(IPC_CHANNELS.WINDOW_RELOAD) },
        { label: 'Toggle Developer Tools', shortcut: 'Ctrl+Shift+I', action: () => void run(IPC_CHANNELS.WINDOW_TOGGLE_DEVTOOLS) },
        { separator: true, label: '' },
        { label: 'Toggle Full Screen', shortcut: 'F11', action: () => void run(IPC_CHANNELS.WINDOW_TOGGLE_FULLSCREEN) },
      ],
    },
    window: {
      label: 'Window',
      items: [
        { label: 'Minimize', action: () => { /* overlay handles; no-op fallback */ } },
        { label: 'Toggle Full Screen', action: () => void run(IPC_CHANNELS.WINDOW_TOGGLE_FULLSCREEN) },
      ],
    },
    help: {
      label: 'Help',
      items: [
        { label: 'Toggle Developer Tools', action: () => void run(IPC_CHANNELS.WINDOW_TOGGLE_DEVTOOLS) },
      ],
    },
  }

  return (
    <div
      ref={rootRef}
      className="bb-titlebar"
      style={{
        paddingLeft: isMac ? 78 : 12,
        // Leave room for Windows overlay caption buttons
        paddingRight: showMenus ? 140 : 12,
      }}
    >
      <span className="bb-titlebar-brand" aria-label="BspBuddy">
        <BspBuddyMark size={16} />
        <span>BspBuddy</span>
      </span>

      {showMenus ? (
        <nav className="bb-titlebar-menus" aria-label="应用菜单">
          {(Object.keys(menus) as MenuId[]).map((id) => {
            const menu = menus[id]
            const open = openMenu === id
            return (
              <div key={id} className="bb-titlebar-menu">
                <button
                  type="button"
                  className={`bb-titlebar-menu-btn${open ? ' bb-titlebar-menu-btn--open' : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenu(open ? null : id)
                  }}
                  onMouseEnter={() => {
                    if (openMenu) setOpenMenu(id)
                  }}
                >
                  {menu.label}
                </button>
                {open ? (
                  <div className="bb-titlebar-dropdown" role="menu">
                    {menu.items.map((item, idx) => (
                      item.separator ? (
                        <div key={`sep-${idx}`} className="bb-titlebar-sep" role="separator" />
                      ) : (
                        <button
                          key={`${item.label}-${idx}`}
                          type="button"
                          role="menuitem"
                          className="bb-titlebar-item"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenu(null)
                            item.action?.()
                          }}
                        >
                          <span>{item.label}</span>
                          {item.shortcut ? (
                            <span className="bb-titlebar-shortcut">{item.shortcut}</span>
                          ) : null}
                        </button>
                      )
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>
      ) : null}

      <div className="bb-titlebar-drag" aria-hidden="true" />
    </div>
  )
}
