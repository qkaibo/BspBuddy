import type { Tool } from '../../../lib/types'
import { toolRegistry } from './registry'
import { permissionService } from '../permission-service'
import * as fs from 'fs'
import * as path from 'path'

const readFileTool: Tool = {
  name: 'file_read',
  description: 'Read the contents of a file from the local filesystem',
  category: 'file',
  parameters: [
    { name: 'filePath', type: 'string', description: 'Absolute path to the file to read', required: true },
    { name: 'encoding', type: 'string', description: 'File encoding (default: utf-8)', required: false },
  ],
  async execute(params) {
    const filePath = params.filePath as string
    const encoding = (params.encoding as BufferEncoding) || 'utf-8'

    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` }
    }

    const content = fs.readFileSync(filePath, { encoding })
    const stat = fs.statSync(filePath)

    return {
      success: true,
      data: { content, lineCount: content.split('\n').length },
      artifacts: [
        {
          name: path.basename(filePath),
          path: filePath,
          mimeType: 'text/plain',
          size: stat.size,
        },
      ],
    }
  },
}

const writeFileTool: Tool = {
  name: 'file_write',
  description: 'Write content to a file on the local filesystem',
  category: 'file',
  parameters: [
    { name: 'filePath', type: 'string', description: 'Absolute path to write the file', required: true },
    { name: 'content', type: 'string', description: 'Content to write', required: true },
  ],
  async execute(params) {
    const filePath = params.filePath as string
    const content = params.content as string

    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // On Windows, backup existing file before overwriting
    if (process.platform === 'win32' && fs.existsSync(filePath)) {
      await permissionService.backupFile(filePath)
    }

    fs.writeFileSync(filePath, content, 'utf-8')
    const stat = fs.statSync(filePath)

    return {
      success: true,
      data: { filePath, size: stat.size },
      artifacts: [
        {
          name: path.basename(filePath),
          path: filePath,
          mimeType: 'text/plain',
          size: stat.size,
        },
      ],
    }
  },
}

const listDirTool: Tool = {
  name: 'file_list',
  description: 'List files and directories in a given path',
  category: 'file',
  parameters: [
    { name: 'dirPath', type: 'string', description: 'Directory path to list', required: true },
    { name: 'pattern', type: 'string', description: 'Optional glob pattern filter', required: false },
  ],
  async execute(params) {
    const dirPath = params.dirPath as string

    if (!fs.existsSync(dirPath)) {
      return { success: false, error: `Directory not found: ${dirPath}` }
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const pattern = (params.pattern as string) || '*'

    const files = entries
      .filter((e) => {
        if (pattern === '*') return true
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
        return regex.test(e.name)
      })
      .map((e) => ({
        name: e.name,
        isDirectory: e.isDirectory(),
        isFile: e.isFile(),
      }))

    return { success: true, data: { path: dirPath, entries: files } }
  },
}

export function registerFileTools(): void {
  toolRegistry.register(readFileTool)
  toolRegistry.register(writeFileTool)
  toolRegistry.register(listDirTool)
}
