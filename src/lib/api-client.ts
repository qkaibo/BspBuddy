/* eslint-disable @typescript-eslint/no-explicit-any */

const BASE_URL = 'http://127.0.0.1:52020'
const TENANT_ID = 'tenant_demo'

let authToken: string | null = null

export function setApiToken(token: string | null): void {
  authToken = token
}

function withTenant(path: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}tenant_id=${TENANT_ID}`
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }
  return headers
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${withTenant(path)}`, {
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function apiPost<T = any>(path: string, body?: unknown): Promise<T> {
  // Inject tenant_id into body for FastAPI Pydantic validation
  const data = body && typeof body === 'object' && !Array.isArray(body)
    ? { tenant_id: TENANT_ID, ...(body as Record<string, unknown>) }
    : body
  const res = await fetch(`${BASE_URL}${withTenant(path)}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: data ? JSON.stringify(data) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function apiPut<T = any>(path: string, body: unknown): Promise<T> {
  // Inject tenant_id into body for FastAPI Pydantic validation
  const data = body && typeof body === 'object' && !Array.isArray(body)
    ? { tenant_id: TENANT_ID, ...(body as Record<string, unknown>) }
    : body
  const res = await fetch(`${BASE_URL}${withTenant(path)}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${withTenant(path)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

/** Auto-login and store the token */
export async function apiLogin(tenantId = 'tenant_demo', username = 'admin', password = 'admin'): Promise<boolean> {
  try {
    const result = await apiPost<any>('/api/auth/login', { tenant_id: tenantId, username, password })
    if (result.token) {
      setApiToken(result.token)
      return true
    }
  } catch {
    // ignore
  }
  return false
}
