import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from '@/main/services/ipc-handlers'
import { updateService } from '@/main/services/update-service'
import { startFastApi, stopFastApi } from '@/main/services/fastapi-bridge'

// Enable CDP remote debugging for diagnostics
app.commandLine.appendSwitch('remote-debugging-port', '9222')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
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

app.whenReady().then(() => {
  registerIpcHandlers()
  updateService.init()
  createWindow()

  // Start the Python FastAPI backend
  startFastApi().catch((err: Error) => {
    console.error('[Main] Failed to start FastAPI backend:', err.message)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  stopFastApi().catch((err: Error) => {
    console.error('[Main] Failed to stop FastAPI backend:', err.message)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
