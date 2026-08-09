import { contextBridge, ipcRenderer } from 'electron'

type RendererCallback = (...args: unknown[]) => void
type IpcListener = (event: Electron.IpcRendererEvent, ...args: unknown[]) => void

const listenerMap = new Map<string, Map<RendererCallback, IpcListener>>()

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: RendererCallback) => {
    const wrapper: IpcListener = (_event, ...args) => callback(...args)
    if (!listenerMap.has(channel)) listenerMap.set(channel, new Map())
    listenerMap.get(channel)!.set(callback, wrapper)
    ipcRenderer.on(channel, wrapper)
  },
  off: (channel: string, callback?: RendererCallback) => {
    if (callback && listenerMap.has(channel)) {
      const wrapper = listenerMap.get(channel)!.get(callback)
      if (wrapper) {
        ipcRenderer.removeListener(channel, wrapper)
        listenerMap.get(channel)!.delete(callback)
        if (listenerMap.get(channel)!.size === 0) listenerMap.delete(channel)
      }
    } else {
      ipcRenderer.removeAllListeners(channel)
      listenerMap.delete(channel)
    }
  },
  cwd: () => ipcRenderer.invoke('app:cwd'),
})
