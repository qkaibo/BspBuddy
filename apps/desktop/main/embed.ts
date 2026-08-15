/**
 * Portal 单窗嵌入入口：在宿主 BrowserWindow 内挂载完整 BspBuddy UI（WebContentsView）。
 * 由 Portal Desktop require/import，勿单独作为 app 入口。
 */
import { BrowserWindow, WebContentsView } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from '@/main/services/ipc-handlers'
import {
  ensureFastApiReady,
  loginWithPortalCode as bridgeLoginWithPortalCode,
  registerBroadcastTarget,
  startFastApiHealthMonitor,
} from '@/main/services/fastapi-bridge'

export type EmbedBounds = { x: number; y: number; width: number; height: number }

let bootstrapped = false
let embedView: WebContentsView | null = null
let hostWindow: BrowserWindow | null = null

export async function bootstrapEmbed(): Promise<void> {
  if (bootstrapped) return
  registerIpcHandlers()
  startFastApiHealthMonitor()
  await ensureFastApiReady()
  bootstrapped = true
  console.log('[BspBuddyEmbed] bootstrap ok')
}

function resolvePreload(): string {
  // out/main/embed.js → out/preload/index.mjs
  return join(__dirname, '../preload/index.mjs')
}

function resolveRendererUrl(): string {
  const base = process.env.BSPBUDDY_RENDERER_URL || process.env.ELECTRON_RENDERER_URL || ''
  if (base) {
    const u = new URL(base)
    u.searchParams.set('portal_embed', '1')
    return u.toString()
  }
  // file URL + query
  const file = join(__dirname, '../renderer/index.html')
  return `file://${file.replace(/\\/g, '/')}?portal_embed=1`
}

export async function mountEmbedView(
  parent: BrowserWindow,
  bounds: EmbedBounds,
): Promise<WebContentsView> {
  if (!bootstrapped) await bootstrapEmbed()
  hostWindow = parent

  if (embedView) {
    setEmbedBounds(bounds)
    showEmbed()
    return embedView
  }

  const view = new WebContentsView({
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  registerBroadcastTarget(view.webContents)
  parent.contentView.addChildView(view)
  view.setBounds(bounds)

  const url = resolveRendererUrl()
  console.log('[BspBuddyEmbed] loading', url)
  if (url.startsWith('file://')) {
    const filePath = join(__dirname, '../renderer/index.html')
    await view.webContents.loadFile(filePath, { query: { portal_embed: '1' } })
  } else {
    await view.webContents.loadURL(url)
  }

  embedView = view
  return view
}

export function setEmbedBounds(bounds: EmbedBounds): void {
  if (embedView) embedView.setBounds(bounds)
}

export function showEmbed(): void {
  if (!embedView || !hostWindow || hostWindow.isDestroyed()) return
  // Ensure on top of sibling content views by re-adding last
  try {
    hostWindow.contentView.addChildView(embedView)
  } catch {
    /* already attached */
  }
  embedView.setVisible(true)
}

export function hideEmbed(): void {
  if (!embedView) return
  embedView.setVisible(false)
}

export function isEmbedMounted(): boolean {
  return Boolean(embedView)
}

export async function loginWithPortalCode(
  code: string,
  tenantId?: string,
): Promise<{ ok: true; token: string; user: unknown; tenant_id: string } | { ok: false; error: string }> {
  if (!bootstrapped) await bootstrapEmbed()
  return bridgeLoginWithPortalCode(code, tenantId)
}

export function destroyEmbed(): void {
  if (embedView && hostWindow && !hostWindow.isDestroyed()) {
    try {
      hostWindow.contentView.removeChildView(embedView)
    } catch {
      /* ignore */
    }
  }
  if (embedView) {
    try {
      embedView.webContents.close()
    } catch {
      /* ignore */
    }
  }
  embedView = null
  hostWindow = null
}
