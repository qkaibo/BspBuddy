import { spawn, ChildProcess } from 'child_process'
import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import * as http from 'http'
import { IPC_CHANNELS } from '../../lib/types'

const FASTAPI_PORT = 52020
const FASTAPI_HOST = '127.0.0.1'
const FASTAPI_BASE = `http://${FASTAPI_HOST}:${FASTAPI_PORT}`
/** Main-process health poll interval (auth-001). Do not rely on renderer timers. */
export const FASTAPI_HEALTH_INTERVAL_MS = 15_000

let pythonProcess: ChildProcess | null = null
let ready = false
let authToken: string | null = null
/** Last known FastAPI / Portal user (for Sidebar AUTH_ME). */
let authUser: Record<string, unknown> | null = null
let healthTimer: ReturnType<typeof setInterval> | null = null
let healthProbeInFlight = false

export type FastApiStatusPayload = {
  ready: boolean
  online: boolean
  baseUrl: string
  latencyMs?: number
  error?: string
  checkedAt: number
}

function getBackendDir(): string {
  if (process.env.BSPBUDDY_BACKEND_DIR) {
    return process.env.BSPBUDDY_BACKEND_DIR
  }
  // In development, the backend is at <project>/backend
  // In production (packaged), it would be in resources/backend
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend')
  }
  return path.join(app.getAppPath(), 'backend')
}

/** Extra webContents (e.g. Portal-embedded WebContentsView) that are not BrowserWindows. */
const extraWebContents = new Set<Electron.WebContents>()

export function registerBroadcastTarget(wc: Electron.WebContents): void {
  extraWebContents.add(wc)
  wc.once('destroyed', () => {
    extraWebContents.delete(wc)
  })
}

function forEachWebContents(fn: (wc: Electron.WebContents) => void): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) fn(win.webContents)
  }
  for (const wc of extraWebContents) {
    if (!wc.isDestroyed()) fn(wc)
  }
}

function broadcastFastApiStatus(status: FastApiStatusPayload | { probing: true }): void {
  forEachWebContents((wc) => {
    wc.send(IPC_CHANNELS.EXPERT_FASTAPI_STATUS_CHANGED, status)
  })
}

async function killProcessOnPort(): Promise<void> {
  try {
    const { exec } = await import('child_process')
    return new Promise((resolve) => {
      exec(`netstat -ano | findstr :${FASTAPI_PORT}`, (_err, stdout) => {
        const lines = stdout.split('\n').filter(l => l.includes('LISTENING'))
        for (const line of lines) {
          const match = line.match(/\d+$/m)
          if (match) {
            exec(`taskkill /F /PID ${match[0]}`)
          }
        }
        resolve()
      })
    })
  } catch {
    // ignore
  }
}

function httpHealthCheck(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${FASTAPI_BASE}/api/health`, { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

export async function startFastApi(): Promise<void> {
  // Do not gate on `ready` — health monitor may flip it before we own a process
  if (pythonProcess) return

  const backendDir = getBackendDir()
  console.log('[FastAPIBridge] Starting FastAPI from:', backendDir)

  await killProcessOnPort()

  pythonProcess = spawn('python', ['-m', 'uvicorn', 'single_port_app:app', '--host', FASTAPI_HOST, '--port', String(FASTAPI_PORT)], {
    cwd: backendDir,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      // Align Agent Card urls with the desktop bridge listen address (agents-005 Phase C)
      BASE_URL: FASTAPI_BASE,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  pythonProcess.stdout?.on('data', (data: Buffer) => {
    const text = data.toString().trim()
    if (text) console.log('[FastAPI]', text)
  })
  pythonProcess.stderr?.on('data', (data: Buffer) => {
    const text = data.toString().trim()
    if (text) console.log('[FastAPI]', text)
  })
  pythonProcess.on('exit', (code) => {
    console.log('[FastAPIBridge] Process exited with code:', code)
    pythonProcess = null
    ready = false
  })

  // Poll health endpoint
  for (let i = 0; i < 60; i++) {
    const ok = await httpHealthCheck()
    if (ok) {
      ready = true
      console.log('[FastAPIBridge] FastAPI is ready on port', FASTAPI_PORT)
      // Auto-login to get token
      await autoLogin()
      return
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error('FastAPI did not start within 60 seconds')
}

/** Portal embed：已有外部 API 则复用，不强杀端口。 */
export async function ensureFastApiReady(): Promise<void> {
  if (pythonProcess && ready) return
  if (await httpHealthCheck()) {
    ready = true
    if (!authToken) await autoLogin()
    console.log('[FastAPIBridge] Reusing existing FastAPI on port', FASTAPI_PORT)
    return
  }
  await startFastApi()
}

async function autoLogin(): Promise<void> {
  try {
    const axios = await import('axios')
    const res = await axios.default.post(`${FASTAPI_BASE}/api/auth/login`, {
      tenant_id: 'tenant_demo',
      username: 'admin',
      password: 'admin',
    })
    if (res.data?.token) {
      setAuthToken(res.data.token, { source: 'auto-login', user: res.data.user })
      console.log('[FastAPIBridge] Auto-login successful, token obtained')
    }
  } catch (err) {
    console.warn('[FastAPIBridge] Auto-login failed (backend may not have seeded admin yet):', err)
  }
}

export function getToken(): string | null {
  return authToken
}

export function getCachedAuthUser(): Record<string, unknown> | null {
  return authUser
}

export function setAuthToken(token: string | null, meta?: { source?: string; user?: unknown }): void {
  authToken = token
  if (!token) {
    authUser = null
  } else if (meta?.user && typeof meta.user === 'object') {
    authUser = meta.user as Record<string, unknown>
  }
  const payload = {
    token,
    source: meta?.source || 'manual',
    user: meta?.user ?? authUser,
    at: Date.now(),
  }
  forEachWebContents((wc) => {
    wc.send(IPC_CHANNELS.EXPERT_AUTH_CHANGED, payload)
  })
  // token-only 深链：补拉 /api/auth/me，再广播一次带 user 的变更
  if (token && !meta?.user) {
    void refreshAuthUserFromApi()
  }
}

/** GET /api/auth/me → 刷新缓存并通知渲染进程（Portal SSO 后侧栏显示账号） */
export async function refreshAuthUserFromApi(): Promise<Record<string, unknown> | null> {
  if (!authToken) {
    authUser = null
    return null
  }
  try {
    const axios = await import('axios')
    const res = await axios.default.get(`${FASTAPI_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
      timeout: 10000,
    })
    if (res.data && typeof res.data === 'object') {
      authUser = res.data as Record<string, unknown>
      forEachWebContents((wc) => {
        wc.send(IPC_CHANNELS.EXPERT_AUTH_CHANGED, {
          token: authToken,
          source: 'me-refresh',
          user: authUser,
          at: Date.now(),
        })
      })
      return authUser
    }
  } catch (err) {
    console.warn('[FastAPIBridge] refreshAuthUserFromApi failed:', err)
  }
  return authUser
}

/**
 * 优先返回 Portal / FastAPI 会话用户（侧栏与 AUTH_ME）；无 token 时返回 null，由本地 auth-service 兜底。
 */
export async function resolveFastApiAuthMe(): Promise<{
  user: {
    id: string
    tenantId: string
    username: string
    displayName?: string
    roles: Array<'admin' | 'member'>
    status: 'active'
    createdAt: number
    updatedAt: number
  }
  actor: {
    tenantId: string
    userId: string
    username: string
    roles: Array<'admin' | 'member'>
  }
} | null> {
  if (!authToken) return null
  let raw = authUser
  if (!raw) {
    raw = await refreshAuthUserFromApi()
  }
  if (!raw) return null
  const id = String(raw.id || '')
  const username = String(raw.username || raw.display_name || 'user')
  const displayName = raw.display_name != null ? String(raw.display_name) : undefined
  const tenantId = String(raw.tenant_id || 'tenant_demo')
  const roleRaw = String(raw.role || 'member').toLowerCase()
  const roles: Array<'admin' | 'member'> = roleRaw === 'admin' ? ['admin'] : ['member']
  const now = Date.now()
  return {
    user: {
      id,
      tenantId,
      username,
      displayName,
      roles,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    actor: {
      tenantId,
      userId: id,
      username,
      roles,
    },
  }
}

/** Portal 一次性 code → Buddy JWT（覆盖 auto-login 的 admin 会话） */
export async function loginWithPortalCode(
  code: string,
  tenantId?: string,
): Promise<{ ok: true; token: string; user: unknown; tenant_id: string } | { ok: false; error: string }> {
  const trimmed = (code || '').trim()
  if (!trimmed) return { ok: false, error: 'missing_code' }
  try {
    const axios = await import('axios')
    const body: Record<string, string> = { code: trimmed }
    if (tenantId) body.tenant_id = tenantId
    const res = await axios.default.post(`${FASTAPI_BASE}/api/auth/portal`, body, { timeout: 15000 })
    if (!res.data?.token) return { ok: false, error: 'no_token' }
    setAuthToken(res.data.token, { source: 'portal', user: res.data.user })
    console.log('[FastAPIBridge] Portal SSO login ok:', res.data.user?.display_name || res.data.user?.username)
    return {
      ok: true,
      token: res.data.token,
      user: res.data.user,
      tenant_id: res.data.tenant_id || 'tenant_demo',
    }
  } catch (err: unknown) {
    const detail =
      (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
      (err instanceof Error ? err.message : 'portal_login_failed')
    console.warn('[FastAPIBridge] Portal SSO login failed:', detail)
    return { ok: false, error: String(detail) }
  }
}

export function getFastApiBaseUrl(): string {
  return FASTAPI_BASE
}

export function isFastApiReady(): boolean {
  return ready
}

/** Live /api/health probe; updates in-memory ready flag. */
export async function probeFastApiStatus(): Promise<FastApiStatusPayload> {
  const baseUrl = FASTAPI_BASE
  const checkedAt = Date.now()
  const started = Date.now()
  try {
    const ok = await httpHealthCheck()
    const latencyMs = Date.now() - started
    ready = ok
    if (!ok) {
      return {
        ready: false,
        online: false,
        baseUrl,
        latencyMs,
        error: '健康检查未通过（服务未响应或未启动）',
        checkedAt,
      }
    }
    return { ready: true, online: true, baseUrl, latencyMs, checkedAt }
  } catch (err) {
    ready = false
    return {
      ready: false,
      online: false,
      baseUrl,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : '探测失败',
      checkedAt,
    }
  }
}

/**
 * Periodic /api/health in the main process (survives renderer throttle / remount).
 * Pushes `expert:fastapi-status-changed` after each probe.
 */
export async function probeAndBroadcastFastApiStatus(): Promise<FastApiStatusPayload> {
  const status = await probeFastApiStatus()
  broadcastFastApiStatus(status)
  return status
}

export function startFastApiHealthMonitor(intervalMs = FASTAPI_HEALTH_INTERVAL_MS): void {
  if (healthTimer) return

  const tick = async () => {
    if (healthProbeInFlight) return
    healthProbeInFlight = true
    try {
      broadcastFastApiStatus({ probing: true })
      await probeAndBroadcastFastApiStatus()
    } catch (err) {
      console.warn('[FastAPIBridge] Health monitor tick failed:', err)
    } finally {
      healthProbeInFlight = false
    }
  }

  void tick()
  healthTimer = setInterval(() => { void tick() }, Math.max(5_000, intervalMs))
  console.log('[FastAPIBridge] Health monitor started, intervalMs=', intervalMs)
}

export function stopFastApiHealthMonitor(): void {
  if (healthTimer) {
    clearInterval(healthTimer)
    healthTimer = null
    console.log('[FastAPIBridge] Health monitor stopped')
  }
}

export async function stopFastApi(): Promise<void> {
  stopFastApiHealthMonitor()
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
    ready = false
  }
  await killProcessOnPort()
}

// ---- Tenant resolution ----
// Phase 5: In production, tenant_id is extracted from the user's JWT claims.
// The server-side auth middleware validates the token and the tenant_id query param.
// Until full auth unification, we fall back to 'tenant_demo' for local development.
function resolveTenantId(): string {
  try {
    if (authToken) {
      // Extract tenant_id from JWT payload (unverified extraction for routing)
      const parts = authToken.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
        if (payload.tenant_id) return payload.tenant_id
      }
    }
  } catch {
    // ignore parse errors, fall through to default
  }
  return 'tenant_demo'
}

export async function fastApiFetch<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
  const tenantId = resolveTenantId()
  // Inject tenant_id as query parameter for GET requests
  let url = `${FASTAPI_BASE}${endpoint}`
  const sep = url.includes('?') ? '&' : '?'
  url = `${url}${sep}tenant_id=${tenantId}`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  // Inject tenant_id into body for POST/PUT requests
  let data = body
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    data = { ...(body as Record<string, unknown>), tenant_id: tenantId }
  }

  const { default: axios } = await import('axios')

  const res = await axios({ method, url, headers, data: data ? JSON.stringify(data) : undefined, timeout: 30000 })
  return res.data as T
}
