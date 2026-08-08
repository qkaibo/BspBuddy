// ============================================================
// IPC client — renderer-side bridge to Electron main process
// ============================================================

export interface IpcClient {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on(channel: string, callback: (...args: unknown[]) => void): void
  off(channel: string, callback: (...args: unknown[]) => void): void
}

/** Create a client that works both in Electron and browser dev mode */
export function createIpcClient(): IpcClient {
  const electronAPI = (window as unknown as Record<string, unknown>).electronAPI as
    | { invoke: (ch: string, ...args: unknown[]) => Promise<unknown>; on: (ch: string, cb: (...args: unknown[]) => void) => void; off: (ch: string, cb: (...args: unknown[]) => void) => void }
    | undefined

  if (electronAPI) {
    return {
      invoke: (ch, ...args) => electronAPI.invoke(ch, ...args),
      on: (ch, cb) => electronAPI.on(ch, cb),
      off: (ch, cb) => electronAPI.off(ch, cb),
    }
  }

  // Browser fallback: talk to local dev server
  return {
    async invoke(channel, ...args) {
      const res = await fetch(`http://localhost:3721/api/${channel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args }),
      })
      return res.json()
    },
    on(_channel, _callback) {
      // no-op in browser mode
    },
    off(_channel, _callback) {
      // no-op in browser mode
    },
  }
}
