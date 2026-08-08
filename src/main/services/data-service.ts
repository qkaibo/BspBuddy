// ============================================================
// Data management service — shared files & archived tasks
// ============================================================

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { SharedFile, ArchivedTask } from '../../lib/types'

interface DataStore {
  sharedFiles: SharedFile[]
  archivedTasks: ArchivedTask[]
}

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'data-manager.json')
}

function loadStore(): DataStore {
  const p = getStorePath()
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')) }
    catch { /* corrupt */ }
  }
  return { sharedFiles: [], archivedTasks: [] }
}

function saveStore(store: DataStore): void {
  const dir = path.dirname(getStorePath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2), 'utf-8')
}

class DataService {
  private store: DataStore

  constructor() {
    this.store = loadStore()
  }

  // ---- Shared Files ----

  getSharedFiles(): SharedFile[] {
    return [...this.store.sharedFiles]
  }

  addSharedFile(file: Omit<SharedFile, 'id' | 'sharedAt' | 'shareUrl'>): SharedFile {
    const newFile: SharedFile = {
      id: `share-${Date.now()}`,
      sharedAt: new Date().toISOString(),
      shareUrl: `https://workbuddy/share/${Date.now().toString(36)}`,
      ...file,
    }
    this.store.sharedFiles.push(newFile)
    saveStore(this.store)
    return newFile
  }

  unshareFile(fileId: string): boolean {
    const idx = this.store.sharedFiles.findIndex(f => f.id === fileId)
    if (idx === -1) return false
    this.store.sharedFiles.splice(idx, 1)
    saveStore(this.store)
    return true
  }

  // ---- Archived Tasks ----

  getArchivedTasks(): ArchivedTask[] {
    return [...this.store.archivedTasks]
  }

  archiveTask(task: Omit<ArchivedTask, 'id' | 'archivedAt'>): ArchivedTask {
    const newTask: ArchivedTask = {
      id: `archive-${Date.now()}`,
      archivedAt: new Date().toISOString(),
      ...task,
    }
    this.store.archivedTasks.push(newTask)
    saveStore(this.store)
    return newTask
  }

  deleteArchivedTask(taskId: string): boolean {
    const idx = this.store.archivedTasks.findIndex(t => t.id === taskId)
    if (idx === -1) return false
    this.store.archivedTasks.splice(idx, 1)
    saveStore(this.store)
    return true
  }

  unarchiveTask(taskId: string): ArchivedTask | null {
    const idx = this.store.archivedTasks.findIndex(t => t.id === taskId)
    if (idx === -1) return null
    const [task] = this.store.archivedTasks.splice(idx, 1)
    saveStore(this.store)
    return task
  }
}

export const dataService = new DataService()
