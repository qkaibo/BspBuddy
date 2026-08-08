import { BrowserWindow } from 'electron'
import { v4 as uuid } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { execSync } from 'child_process'
import { IPC_CHANNELS } from '../../lib/types'
import type { PermissionRequest, PermissionResponse, PermissionAction, PermissionOperationType, PermissionScope } from '../../lib/types'

type PendingRequest = {
  resolve: (value: PermissionResponse) => void
  reject: (reason: Error) => void
}

const SENSITIVE_FILE_NAMES = [
  '.env', '.env.local', '.env.production', '.env.development',
  'credentials.json', 'credentials', 'secrets.json', 'secrets',
  '.npmrc', '.git-credentials', 'id_rsa', 'id_ed25519',
  'known_hosts', 'authorized_keys', '.pem', '.key',
  'config.json', 'settings.json', '.gitconfig',
]

const SENSITIVE_DIR_NAMES = [
  '.ssh', '.gnupg', '.aws', '.azure', '.config',
]

const SENSITIVE_PATH_SEGMENTS = [
  'AppData', 'Application Data', '.config',
  'System32', 'Windows', 'Program Files', 'Program Files (x86)',
  '/etc', '/usr', '/bin', '/sbin', '/var', '/boot',
  '.git', 'node_modules', '__pycache__',
]

const PROTECTED_USER_DIRS = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos']

const DANGEROUS_COMMANDS = [
  'rm -rf', 'del /f', 'del /s', 'rd /s', 'rd /q',
  'format', 'fdisk', 'mkfs',
  ':(){ :|:& };:',  // fork bomb
  'chmod 777', 'chmod -R 777',
  '> /dev/sda', 'dd if=',
  'shutdown', 'reboot', 'halt',
]

const NETWORK_DOMAINS = [
  'localhost', '127.0.0.1', '::1', '0.0.0.0',
]

export class PermissionService {
  currentMode: 'default' | 'full_access' = 'default'
  workspacePath: string = ''
  private pendingRequests: Map<string, PendingRequest> = new Map()

  setWorkspace(workspacePath: string): void {
    this.workspacePath = path.resolve(workspacePath)
  }

  setMode(mode: 'default' | 'full_access'): void {
    this.currentMode = mode
  }

  getMode(): 'default' | 'full_access' {
    return this.currentMode
  }

  async check(req: Omit<PermissionRequest, 'id'>): Promise<PermissionResponse> {
    if (this.currentMode === 'full_access') {
      return { requestId: '', action: 'allow' }
    }

    const scope = this.getScope(req.target)
    const request: PermissionRequest = {
      id: uuid(),
      type: req.type,
      target: req.target,
      scope,
      reason: req.reason,
    }

    // Auto-allow workspace file operations (not delete)
    if (scope === 'workspace' && req.type === 'file_write') {
      return { requestId: request.id, action: 'allow' }
    }

    // Auto-allow reading files anywhere
    if (req.type !== 'file_write' && req.type !== 'file_delete' && req.type !== 'execute' && req.type !== 'network') {
      return { requestId: request.id, action: 'allow' }
    }

    // Needs confirmation
    return this.requestConfirmation(request)
  }

  isProtected(filePath: string): boolean {
    const resolved = path.resolve(filePath).toLowerCase()
    const basename = path.basename(filePath).toLowerCase()
    const dirname = path.dirname(resolved)

    // Check sensitive file names
    if (SENSITIVE_FILE_NAMES.some((name) => basename === name || basename.endsWith(name))) {
      return true
    }

    // Check sensitive directories in path
    if (SENSITIVE_DIR_NAMES.some((dir) => resolved.includes(path.sep + dir.toLowerCase() + path.sep) || resolved.startsWith(dir.toLowerCase() + path.sep))) {
      return true
    }

    // Check sensitive path segments
    if (SENSITIVE_PATH_SEGMENTS.some((seg) => resolved.includes(seg.toLowerCase()))) {
      return true
    }

    // Check protected user directories
    const homeDir = os.homedir().toLowerCase()
    if (dirname === homeDir) {
      return PROTECTED_USER_DIRS.some((dir) => basename === dir.toLowerCase())
    }

    // Check if in protected user directories
    for (const protectedDir of PROTECTED_USER_DIRS) {
      const protectedPath = path.join(homeDir, protectedDir).toLowerCase()
      if (resolved.startsWith(protectedPath + path.sep) || resolved === protectedPath) {
        return true
      }
    }

    return false
  }

  getScope(filePath: string): PermissionScope {
    if (this.isProtected(filePath)) return 'protected'

    const resolved = path.resolve(filePath)
    if (this.workspacePath && resolved.startsWith(this.workspacePath)) {
      return 'workspace'
    }

    const homeDir = os.homedir()
    if (resolved.startsWith(homeDir)) return 'workspace'

    return 'external'
  }

  sanitizeCommand(cmd: string): string {
    const lower = cmd.toLowerCase().trim()

    for (const dangerous of DANGEROUS_COMMANDS) {
      if (lower.includes(dangerous.toLowerCase())) {
        // Wrap dangerous commands with safety prefixes
        if (lower.startsWith('rm ') || lower.startsWith('del ')) {
          return cmd + ' --interactive'
        }
      }
    }

    // For network commands, add timeout
    if (lower.startsWith('curl ') || lower.startsWith('wget ')) {
      return `${cmd} --max-time 30`
    }

    return cmd
  }

  async backupFile(filePath: string): Promise<string | null> {
    if (process.platform !== 'win32') return null
    if (!fs.existsSync(filePath)) return null

    try {
      const stat = fs.statSync(filePath)
      if (!stat.isFile()) return null

      const dir = path.dirname(filePath)
      const ext = path.extname(filePath)
      const name = path.basename(filePath, ext)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(dir, `${name}.backup-${timestamp}${ext}`)

      fs.copyFileSync(filePath, backupPath)
      return backupPath
    } catch {
      return null
    }
  }

  async safeDelete(targetPath: string): Promise<{ success: boolean; movedToTrash: boolean; backupPath?: string }> {
    if (!fs.existsSync(targetPath)) {
      return { success: true, movedToTrash: false }
    }

    // On Windows, try to move to recycle bin first
    if (process.platform === 'win32') {
      try {
        const escapedPath = targetPath.replace(/'/g, "''")
        const psCommand = `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${escapedPath}', 'OnlyErrorDialogs', 'SendToRecycleBin')`
        execSync(`powershell -NoProfile -Command "${psCommand}"`, {
          timeout: 10000,
        })
        return { success: true, movedToTrash: true }
      } catch {
        // Fall through to backup-based safe delete
      }
    }

    // Backup before delete
    const backupPath = await this.backupFile(targetPath)

    // Delete
    try {
      const stat = fs.statSync(targetPath)
      if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(targetPath)
      }
      return { success: true, movedToTrash: false, backupPath: backupPath || undefined }
    } catch (err) {
      return { success: false, movedToTrash: false, backupPath: backupPath || undefined }
    }
  }

  isNetworkRequest(target: string): boolean {
    try {
      const url = new URL(target)
      // Check if targeting localhost/private network
      if (NETWORK_DOMAINS.some((d) => url.hostname === d)) {
        return true
      }
      return false
    } catch {
      return false
    }
  }

  private requestConfirmation(request: PermissionRequest): Promise<PermissionResponse> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject })

      const win = BrowserWindow.getAllWindows()[0]
      if (!win) {
        this.pendingRequests.delete(request.id)
        // No window available, auto-allow in full_access or deny in default
        resolve({ requestId: request.id, action: 'deny' })
        return
      }

      // Send permission request to renderer
      win.webContents.send(IPC_CHANNELS.PERMISSION_REQUEST, request)

      // Timeout after 60 seconds - auto-deny
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id)
          resolve({ requestId: request.id, action: 'deny' })
        }
      }, 60000)
    })
  }

  handleResponse(requestId: string, action: PermissionAction): void {
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      this.pendingRequests.delete(requestId)
      pending.resolve({ requestId, action })
    }
  }
}

export const permissionService = new PermissionService()
