import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import * as path from 'path'
import * as http from 'http'

const FASTAPI_PORT = 52020
const FASTAPI_HOST = '127.0.0.1'
const FASTAPI_BASE = `http://${FASTAPI_HOST}:${FASTAPI_PORT}`

let pythonProcess: ChildProcess | null = null
let ready = false
let authToken: string | null = null

function getBackendDir(): string {
  // In development, the backend is at <project>/backend
  // In production (packaged), it would be in resources/backend
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend')
  }
  return path.join(app.getAppPath(), 'backend')
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
  if (ready) return

  const backendDir = getBackendDir()
  console.log('[FastAPIBridge] Starting FastAPI from:', backendDir)

  await killProcessOnPort()

  pythonProcess = spawn('python', ['-m', 'uvicorn', 'single_port_app:app', '--host', FASTAPI_HOST, '--port', String(FASTAPI_PORT)], {
    cwd: backendDir,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
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

async function autoLogin(): Promise<void> {
  try {
    const axios = await import('axios')
    const res = await axios.default.post(`${FASTAPI_BASE}/api/auth/login`, {
      tenant_id: 'tenant_demo',
      username: 'admin',
      password: 'admin',
    })
    if (res.data?.token) {
      authToken = res.data.token
      console.log('[FastAPIBridge] Auto-login successful, token obtained')
    }
  } catch (err) {
    console.warn('[FastAPIBridge] Auto-login failed (backend may not have seeded admin yet):', err)
  }
}

export function getToken(): string | null {
  return authToken
}

export function getFastApiBaseUrl(): string {
  return FASTAPI_BASE
}

export function isFastApiReady(): boolean {
  return ready
}

export async function stopFastApi(): Promise<void> {
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
