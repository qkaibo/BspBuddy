import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from '@/main/services/ipc-handlers'
import { updateService } from '@/main/services/update-service'
import {
  startFastApi,
  stopFastApi,
  startFastApiHealthMonitor,
  stopFastApiHealthMonitor,
} from '@/main/services/fastapi-bridge'
import {
  extractBspbuddyUrl,
  handleBspbuddyDeepLink,
  registerBspbuddyProtocolClient,
} from '@/main/services/portal-deep-link'
import { IPC_CHANNELS } from '@/lib/types'

// Prevent Electron's native "Error" modal (blocks main thread; OK often appears stuck).
process.on('uncaughtException', (err) => {
  console.error('[Main] uncaughtException:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[Main] unhandledRejection:', reason)
})

// Enable CDP remote debugging for diagnostics / L3 UI capture
app.commandLine.appendSwitch('remote-debugging-port', '9222')
app.commandLine.appendSwitch('remote-allow-origins', '*')

app.setName('BspBuddy')

const TITLEBAR_HEIGHT = 36
const isMac = process.platform === 'darwin'

let mainWindow: BrowserWindow | null = null
let pendingDeepLink: string | null = extractBspbuddyUrl(process.argv)

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const deep = extractBspbuddyUrl(argv)
    if (deep) {
      void handleBspbuddyDeepLink(deep)
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

registerBspbuddyProtocolClient()
// macOS cold/warm open via protocol
app.on('open-url', (event, url) => {
  event.preventDefault()
  if (app.isReady()) void handleBspbuddyDeepLink(url)
  else pendingDeepLink = url
})

function buildAppMenu(): void {
  // Windows/Linux: File/Edit live in the in-window titlebar (one row with BspBuddy).
  // Keep native menu only on macOS (system menu bar).
  if (!isMac) {
    Menu.setApplicationMenu(null)
    return
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com')
          },
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'BspBuddy',
    // Custom chrome: brand + File menus share one row (Windows/Linux).
    titleBarStyle: 'hidden',
    ...(isMac
      ? {
          trafficLightPosition: { x: 14, y: 10 },
        }
      : {
          titleBarOverlay: {
            color: '#f0f0f2',
            symbolColor: '#1a1a1a',
            height: TITLEBAR_HEIGHT,
          },
        }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.webContents.openDevTools()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerShellIpc(): void {
  ipcMain.handle(IPC_CHANNELS.APP_GET_PLATFORM, () => process.platform)

  ipcMain.handle(IPC_CHANNELS.APP_QUIT, () => {
    app.quit()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_RELOAD, () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow
    win?.webContents.reload()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_DEVTOOLS, () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow
    win?.webContents.toggleDevTools()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_FULLSCREEN, () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow
    if (!win) return
    win.setFullScreen(!win.isFullScreen())
  })
}

app.whenReady().then(() => {
  buildAppMenu()
  registerIpcHandlers()
  registerShellIpc()
  updateService.init()
  createWindow()

  // Timed /api/health in main process (auth-001) — must not wait on spawn
  startFastApiHealthMonitor()

  // Start the Python FastAPI backend
  startFastApi()
    .then(async () => {
      if (pendingDeepLink) {
        const url = pendingDeepLink
        pendingDeepLink = null
        await handleBspbuddyDeepLink(url)
      }
    })
    .catch((err: Error) => {
      console.error('[Main] Failed to start FastAPI backend:', err.message)
      // 后端已由外部拉起时，仍尝试处理深链换票
      if (pendingDeepLink) {
        const url = pendingDeepLink
        pendingDeepLink = null
        void handleBspbuddyDeepLink(url)
      }
    })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  stopFastApiHealthMonitor()
  stopFastApi().catch((err: Error) => {
    console.error('[Main] Failed to stop FastAPI backend:', err.message)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
