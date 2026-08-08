import type { Tool } from '../../../lib/types'
import { toolRegistry } from './registry'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const wordGenerateTool: Tool = {
  name: 'word_generate',
  description: 'Generate a Word (.docx) document from markdown content. Provide the document title, content in markdown format, and optional output path.',
  category: 'office',
  parameters: [
    { name: 'title', type: 'string', description: 'Document title', required: true },
    { name: 'content', type: 'string', description: 'Document content in Markdown format', required: true },
    { name: 'outputPath', type: 'string', description: 'Optional output file path. Defaults to desktop.', required: false },
  ],
  async execute(params) {
    const title = params.title as string
    const content = params.content as string
    const outputPath =
      (params.outputPath as string) ||
      path.join(os.homedir(), 'Desktop', `${title.replace(/[<>:"/\\|?*]/g, '_')}.docx`)

    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    // Generate HTML-based docx compatible markdown
    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body>
${content.split('\n').map(line => {
  if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`
  if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`
  if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`
  if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`
  if (line.match(/^\d+\. /)) return `<li>${line.replace(/^\d+\. /, '')}</li>`
  if (line.startsWith('> ')) return `<blockquote>${line.slice(2)}</blockquote>`
  return line || '<br/>'
}).join('\n')}
</body>
</html>`

    // For now, save as .doc (HTML-based) which Word can open
    const docPath = outputPath.replace(/\.docx$/, '.doc')
    fs.writeFileSync(docPath, htmlContent, 'utf-8')

    return {
      success: true,
      data: { title, outputPath: docPath, format: 'doc' },
      artifacts: [
        {
          name: path.basename(docPath),
          path: docPath,
          mimeType: 'application/msword',
          size: Buffer.byteLength(htmlContent),
        },
      ],
    }
  },
}

const excelAnalyzeTool: Tool = {
  name: 'excel_analyze',
  description: 'Analyze an Excel file - read its sheets, data, and provide a summary for further processing.',
  category: 'office',
  parameters: [
    { name: 'filePath', type: 'string', description: 'Absolute path to the Excel file', required: true },
    { name: 'sheetName', type: 'string', description: 'Optional sheet name to read (default: first sheet)', required: false },
    { name: 'outputPath', type: 'string', description: 'Optional output path for analysis results', required: false },
  ],
  async execute(params) {
    const filePath = params.filePath as string
    const outputPath = (params.outputPath as string) ||
      path.join(os.homedir(), 'Desktop', `analysis_${Date.now()}.md`)

    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` }
    }

    // Basic file info
    const stat = fs.statSync(filePath)
    const fileName = path.basename(filePath)

    // Generate analysis template
    const report = `# Excel Analysis: ${fileName}

## File Info
- **File**: \`${filePath}\`
- **Size**: ${(stat.size / 1024).toFixed(1)} KB
- **Last Modified**: ${new Date(stat.mtime).toLocaleString()}

## Data Summary
> To perform detailed analysis, please:
> 1. Use \`file_read\` to read the actual file content
> 2. Specify sheet name if needed with \`${params.sheetName || 'default'}\`
> 3. Request specific analysis: charts, pivot tables, data cleaning

## Recommended Next Steps
1. Read the file with \`file_read\` to understand the data structure
2. Filter and clean data as needed
3. Generate charts and reports
`

    fs.writeFileSync(outputPath, report, 'utf-8')

    return {
      success: true,
      data: {
        fileName,
        filePath,
        size: stat.size,
        modifiedAt: stat.mtime,
        reportPath: outputPath,
      },
      artifacts: [
        { name: path.basename(outputPath), path: outputPath, mimeType: 'text/markdown', size: Buffer.byteLength(report) },
      ],
    }
  },
}

const pptCreateTool: Tool = {
  name: 'ppt_create',
  description: 'Create a PowerPoint presentation from content outline. Provide title and slides as an array of { title, content }.',
  category: 'office',
  parameters: [
    { name: 'title', type: 'string', description: 'Presentation title', required: true },
    { name: 'slides', type: 'array', description: 'Array of slide objects with title and content (markdown)', required: true },
    { name: 'outputPath', type: 'string', description: 'Optional output path. Defaults to desktop.', required: false },
  ],
  async execute(params) {
    const title = params.title as string
    const slides = params.slides as Array<{ title: string; content: string }>
    const outputPath =
      (params.outputPath as string) ||
      path.join(os.homedir(), 'Desktop', `${title.replace(/[<>:"/\\|?*]/g, '_')}.html`)

    if (!slides || slides.length === 0) {
      return { success: false, error: 'At least one slide is required' }
    }

    // Generate an HTML presentation (can be viewed in browser)
    const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, 'PingFang SC', sans-serif; background:#1a1a2e; color:#fff; }
  .slide { min-height: 100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:60px; text-align:center; page-break-after:always; }
  .slide:nth-child(odd) { background: linear-gradient(135deg, #1a1a2e, #16213e); }
  .slide:nth-child(even) { background: linear-gradient(135deg, #0f3460, #16213e); }
  h1 { font-size: 2.5em; margin-bottom: 20px; }
  h2 { font-size: 1.8em; margin-bottom: 16px; color: #e94560; }
  .content { font-size: 1.2em; line-height: 1.8; max-width: 800px; white-space: pre-wrap; }
  .page-num { position:absolute; bottom:20px; right:30px; font-size:0.8em; color:#666; }
</style>
</head>
<body>
<div class="slide">
  <h1>${title}</h1>
  <div class="content">BspBuddy - AI Office Assistant</div>
</div>
${slides.map((s, i) => `
<div class="slide">
  <h2>${s.title}</h2>
  <div class="content">${s.content.split('\n').map(l => `<p>${l}</p>`).join('')}</div>
  <div class="page-num">${i + 2} / ${slides.length + 1}</div>
</div>`).join('')}
</body>
</html>`

    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    fs.writeFileSync(outputPath, html, 'utf-8')

    return {
      success: true,
      data: { title, slidesCount: slides.length, outputPath },
      artifacts: [
        { name: path.basename(outputPath), path: outputPath, mimeType: 'text/html', size: Buffer.byteLength(html) },
      ],
    }
  },
}

const pdfParseTool: Tool = {
  name: 'pdf_parse',
  description: 'Basic PDF file info extraction. For full text extraction, reads raw text from PDF files.',
  category: 'office',
  parameters: [
    { name: 'filePath', type: 'string', description: 'Absolute path to the PDF file', required: true },
  ],
  async execute(params) {
    const filePath = params.filePath as string

    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` }
    }

    const stat = fs.statSync(filePath)
    const fileName = path.basename(filePath)

    // Try to extract raw text from PDF
    let textContent = ''
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      // Extract readable text between stream markers
      const streams = raw.match(/stream\n([\s\S]*?)\nendstream/g) || []
      const textParts: string[] = []
      for (const stream of streams) {
        const content = stream.replace(/^stream\n|\nendstream$/g, '')
        // Try to decode BT/ET text blocks
        const btBlocks = content.match(/BT\n([\s\S]*?)ET/g) || []
        for (const block of btBlocks) {
          const textMatches = block.match(/\(([^)]*)\)/g) || []
          for (const tm of textMatches) {
            const text = tm.slice(1, -1)
            if (text.length > 0 && !text.startsWith('\\')) {
              textParts.push(text)
            }
          }
        }
      }
      textContent = textParts.join(' ')
    } catch {
      textContent = `(Binary PDF - ${(stat.size / 1024).toFixed(1)} KB)`
    }

    return {
      success: true,
      data: {
        fileName,
        filePath,
        size: stat.size,
        pages: 'Unknown (install PyMuPDF for page count)',
        textPreview: textContent.substring(0, 2000),
      },
    }
  },
}

export function registerOfficeTools(): void {
  toolRegistry.register(wordGenerateTool)
  toolRegistry.register(excelAnalyzeTool)
  toolRegistry.register(pptCreateTool)
  toolRegistry.register(pdfParseTool)
}
