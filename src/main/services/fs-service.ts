import * as fs from 'fs'
import * as path from 'path'
import type { FileNode } from '../../lib/types'

// ============================================================
// File System Service — reads/watches the workspace
// ============================================================

/** Recursively read a directory into a tree structure */
export function readDirRecursive(dirPath: string, depth = 3): FileNode[] {
  if (!fs.existsSync(dirPath)) return []

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  // Directories first, then files
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name)
  })

  for (const entry of sorted) {
    // Skip hidden files and node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'out') continue

    const entryPath = path.join(dirPath, entry.name)
    const node: FileNode = {
      name: entry.name,
      path: entryPath,
      isDirectory: entry.isDirectory(),
    }

    if (entry.isDirectory() && depth > 0) {
      node.children = readDirRecursive(entryPath, depth - 1)
    }

    nodes.push(node)
  }

  return nodes
}

/** Read a file's content */
export function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

/** Write content to a file */
export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filePath, content, 'utf-8')
}

/** Create a new file */
export function createFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    throw new Error(`File already exists: ${filePath}`)
  }
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filePath, '', 'utf-8')
}

/** Create a new directory */
export function createDirectory(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    throw new Error(`Directory already exists: ${dirPath}`)
  }
  fs.mkdirSync(dirPath, { recursive: true })
}

/** Delete a file or directory */
export function deleteFileOrDir(targetPath: string): void {
  if (!fs.existsSync(targetPath)) return
  const stat = fs.statSync(targetPath)
  if (stat.isDirectory()) {
    fs.rmSync(targetPath, { recursive: true, force: true })
  } else {
    fs.unlinkSync(targetPath)
  }
}

/** Rename a file or directory */
export function renameFileOrDir(oldPath: string, newPath: string): void {
  if (!fs.existsSync(oldPath)) {
    throw new Error(`Source not found: ${oldPath}`)
  }
  const dir = path.dirname(newPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.renameSync(oldPath, newPath)
}

/** Detect language from file extension for Monaco */
export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.css': 'css',
    '.html': 'html',
    '.md': 'markdown',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.rb': 'ruby',
    '.php': 'php',
    '.sh': 'shell',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.svg': 'xml',
    '.sql': 'sql',
    '.env': 'plaintext',
    '.gitignore': 'plaintext',
    '.toml': 'toml',
  }
  return map[ext] || 'plaintext'
}

/** Get file info */
export function getFileInfo(filePath: string) {
  if (!fs.existsSync(filePath)) return null
  const stat = fs.statSync(filePath)
  return {
    name: path.basename(filePath),
    path: filePath,
    isDirectory: stat.isDirectory(),
    size: stat.size,
    modifiedAt: stat.mtimeMs,
  }
}
