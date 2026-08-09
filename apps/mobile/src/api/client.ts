// ============================================================
// Mobile REST client — Bearer token authentication
// Unlike desktop (cookie-based), mobile uses Authorization header.
// ============================================================

import { getAccessToken, setAccessToken, getRefreshToken, clearTokens } from '../storage'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:52020'
const REFRESH_URL = `${API_BASE}/api/auth/token/refresh`

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await getRefreshToken()
  if (!refresh) return null

  try {
    const res = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) {
      await clearTokens()
      return null
    }
    const data = await res.json()
    await setAccessToken(data.access_token)
    return data.access_token
  } catch {
    return null
  }
}

export async function apiFetch<T>(
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  let token = await getAccessToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  // Single-flight token refresh on 401
  if (res.status === 401 && token) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken()
    }
    const newToken = await refreshPromise
    refreshPromise = null

    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
    }
  }

  if (!res.ok) {
    throw new Error(`API ${method} ${endpoint} failed: ${res.status}`)
  }

  return res.json()
}
