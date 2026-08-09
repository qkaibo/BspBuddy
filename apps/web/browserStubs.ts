// ============================================================
// Browser stubs — mock Electron APIs for web runtime
// Injected before React renders in web mode.
// ============================================================

declare global {
  interface Window {
    __WEB__: true
  }
}

;(() => {
  window.__WEB__ = true

  // Backend REST API base (matching FastAPI port)
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:52020'

  // ---- IPC-to-REST routing ----
  const IPC_TO_REST: Record<string, { method: string; path: string }> = {
    'model-config:list': { method: 'GET', path: '/api/enterprise/model-configs' },
    'model-config:create': { method: 'POST', path: '/api/enterprise/model-configs' },
    'model-config:protocols': { method: 'GET', path: '/api/enterprise/model-configs/protocols' },
    'expert:list': { method: 'GET', path: '/api/chat/agents' },
    'auth:me': { method: 'GET', path: '/api/auth/me' },
  }

  const fetchWithTenant = async (method: string, path: string, body?: unknown) => {
    const url = `${API_BASE}${path}?tenant_id=tenant_demo`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
  }

  // ---- electronAPI polyfill ----
  ;(window as any).electronAPI = {
    invoke: async (channel: string, ...args: unknown[]) => {
      // Check if channel can be routed to REST
      const route = IPC_TO_REST[channel]
      if (route) {
        try {
          return await fetchWithTenant(route.method, route.path, args[0])
        } catch {
          return channel.endsWith(':list') ? [] : null
        }
      }

      // Electron-only channels return errors
      if (channel.startsWith('task:')) {
        return { content: 'Web 版本暂不支持此功能，请使用桌面版本。', plan: null, artifacts: [] }
      }
      if (channel.startsWith('file:')) {
        return { success: false, error: 'Web 版本不支持文件系统操作' }
      }

      console.warn('[BrowserStub] Unsupported IPC channel:', channel)
      return null
    },
    on: () => { /* no-op */ },
    off: () => { /* no-op */ },
    cwd: () => '/',
  }

  console.log('[BrowserStub] Web runtime initialized, API base:', API_BASE)
})()
