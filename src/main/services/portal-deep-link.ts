/**
 * Portal SSO 深链：bspbuddy://auth/sso?code=… 或 bspbuddy://auth/session?token=…
 */
import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import { loginWithPortalCode, setAuthToken } from './fastapi-bridge'

export function registerBspbuddyProtocolClient(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('bspbuddy', process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient('bspbuddy')
  }
}

export function extractBspbuddyUrl(argv: string[] = process.argv): string | null {
  return argv.find((a) => typeof a === 'string' && a.startsWith('bspbuddy://')) || null
}

export async function handleBspbuddyDeepLink(raw: string): Promise<{ ok: boolean; error?: string }> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, error: 'invalid_url' }
  }
  if (url.protocol !== 'bspbuddy:') return { ok: false, error: 'wrong_protocol' }

  const hostPath = `${url.host}${url.pathname}`.replace(/^\/+/, '').toLowerCase()
  // bspbuddy://auth/sso?code=… 或 bspbuddy://auth/session?token=…
  if (hostPath.includes('auth/sso') || hostPath.endsWith('sso')) {
    const code = url.searchParams.get('code') || ''
    const tenantId = url.searchParams.get('tenant_id') || undefined
    const result = await loginWithPortalCode(code, tenantId)
    focusMainWindow()
    return result.ok ? { ok: true } : { ok: false, error: result.error }
  }

  if (hostPath.includes('auth/session') || hostPath.endsWith('session')) {
    const token = url.searchParams.get('token') || ''
    if (!token) return { ok: false, error: 'missing_token' }
    setAuthToken(token, { source: 'portal-session' })
    focusMainWindow()
    return { ok: true }
  }

  focusMainWindow()
  return { ok: false, error: 'unknown_path' }
}

function focusMainWindow(): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}
