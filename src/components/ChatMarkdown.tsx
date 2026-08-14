import type { CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const mono =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Cascadia Mono", monospace'

const CITE_RE =
  /^(?:[-*]\s+)?(?:`([^`]+)`|((?:[A-Za-z0-9_./\\-]+\/)+[A-Za-z0-9_./\\+-]+\.[A-Za-z0-9_+-]+))\s+L(\d+)(?:\s*[-–—]\s*L?(\d+))?\s*[：:…]?\s*$/

/**
 * Models sometimes emit GFM tables as one line:
 * `| a | b | |---|---| | c | d |`
 */
function expandCollapsedGfmTables(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      if (!line.includes('|') || !/-{3,}/.test(line)) return line
      const cells = line.split('|').map((c) => c.trim())
      const isSep = (c: string) => /^:?-{3,}:?$/.test(c)
      const sepStart = cells.findIndex(isSep)
      if (sepStart < 0) return line
      let sepEnd = sepStart
      while (sepEnd < cells.length && isSep(cells[sepEnd])) sepEnd += 1
      const colCount = sepEnd - sepStart
      if (colCount < 1) return line

      const before = cells.slice(0, sepStart).filter((c) => c !== '')
      const after = cells.slice(sepEnd).filter((c) => c !== '')
      if (before.length === 0 && after.length === 0) return line
      if (before.length < colCount) return line

      const header = before.length === colCount ? before : before.slice(-colCount)
      const rows: string[] = []
      rows.push(`| ${header.join(' | ')} |`)
      rows.push(`| ${Array.from({ length: colCount }, () => '---').join(' | ')} |`)
      for (let i = 0; i + colCount <= after.length; i += colCount) {
        rows.push(`| ${after.slice(i, i + colCount).join(' | ')} |`)
      }
      return rows.join('\n')
    })
    .join('\n')
}

function isOpeningFence(line: string): boolean {
  // Opening: ```c / ```c:110…  Closing: bare ```
  return /^\s*```\S+/.test(line)
}

function isFenceLine(line: string): boolean {
  return /^\s*```/.test(line)
}

function looksLikeCodeLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (isFenceLine(line)) return false
  if (t.startsWith('#') || t.startsWith('>') || t.startsWith('|')) return false
  if (CITE_RE.test(line)) return false
  return (
    /[{};=]|\/\/|\/\*|\*\/|->|::/.test(t)
    || /^\s+/.test(line)
    || /^(if|for|while|return|const|static|struct|typedef|case|else)\b/.test(t)
  )
}

function fenceInfo(lang: string, startLine: number, path?: string): string {
  // Single token so react-markdown keeps it as language-* className.
  const encodedPath = path ? encodeURIComponent(path) : ''
  return encodedPath ? `${lang}:${startLine}:${encodedPath}` : `${lang}:${startLine}`
}

function parsePathAndStart(line: string): { path?: string; start?: number } {
  const startMatch = line.match(/\bL(\d+)\b/i)
  const path =
    line.match(/`([^`]+\.[A-Za-z0-9_+-]+)`/)?.[1]
    || line.match(/((?:[A-Za-z0-9_./\\-]+\/)+[A-Za-z0-9_./\\+-]+\.[A-Za-z0-9_+-]+)/)?.[1]
  return {
    path: path?.trim(),
    start: startMatch ? Number(startMatch[1]) : undefined,
  }
}

/** Look at up to 3 preceding lines for `path` + L110 (citation may not be alone on its line). */
function findCitationAbove(lines: string[], index: number): { path?: string; start?: number } {
  for (let k = index - 1; k >= Math.max(0, index - 3); k--) {
    const hit = parsePathAndStart(lines[k] || '')
    if (hit.start) return hit
  }
  return {}
}

function fenceLang(info: string): string {
  const token = info.trim().split(/\s+/)[0] || 'c'
  // Keep "c:110:..." intact; only strip when info is "c" or "c path=..."
  if (/^[A-Za-z0-9_+-]+$/.test(token)) return token
  if (/^[A-Za-z0-9_+-]+:\d+/.test(token)) return token.split(':')[0] || 'c'
  return token.split(/[:{]/)[0] || 'c'
}

/** Wrap bare “path L110:” + following code-ish lines into a fenced block. */
function fenceBareCitations(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const cite = lines[i].match(CITE_RE)
    const next = lines[i + 1]
    if (
      cite
      && next
      && !isFenceLine(next)
      && looksLikeCodeLine(next)
    ) {
      const path = (cite[1] || cite[2] || '').trim()
      const start = Number(cite[3] || 1)
      const codeLines: string[] = []
      let j = i + 1
      while (j < lines.length && looksLikeCodeLine(lines[j])) {
        codeLines.push(lines[j])
        j += 1
      }
      out.push(`\`\`\`${fenceInfo('c', start, path || undefined)}`)
      out.push(...codeLines)
      out.push('```')
      i = j
      continue
    }
    // Soft: path/Lxxx buried in prose, next lines are bare code (no fence yet)
    const soft = parsePathAndStart(lines[i])
    const citeHint =
      Boolean(soft.path)
      || /L\d+\s*[-–—]\s*L?\d+/i.test(lines[i])
      || /附近/.test(lines[i])
    if (
      soft.start
      && citeHint
      && next
      && !isFenceLine(next)
      && looksLikeCodeLine(next)
    ) {
      const codeLines: string[] = []
      let j = i + 1
      while (j < lines.length && looksLikeCodeLine(lines[j])) {
        codeLines.push(lines[j])
        j += 1
      }
      if (codeLines.length > 0) {
        out.push(lines[i])
        out.push(`\`\`\`${fenceInfo('c', soft.start, soft.path)}`)
        out.push(...codeLines)
        out.push('```')
        i = j
        continue
      }
    }
    out.push(lines[i])
    i += 1
  }
  return out.join('\n')
}

/**
 * Citation above an existing fence → inject real start line / path into fence info.
 */
function attachCodeFenceCitations(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const next = lines[i + 1]
    const cite = line.match(CITE_RE)

    if (cite && next && isOpeningFence(next)) {
      const path = (cite[1] || cite[2] || '').trim()
      const start = Number(cite[3] || 1)
      const info = next.trim().slice(3).trim()
      const lang = fenceLang(info)
      out.push(`\`\`\`${fenceInfo(lang, start, path || undefined)}`)
      i += 1
      continue
    }

    if (next && isOpeningFence(next)) {
      const info = next.trim().slice(3).trim()
      const alreadyNumbered = /:\d+\b/.test(info)
      const nearby = findCitationAbove(lines, i + 1)
      // Also allow citation on the current line (soft)
      const soft = parsePathAndStart(line)
      const start = soft.start || nearby.start
      const path = soft.path || nearby.path
      if (start && !alreadyNumbered) {
        const lang = fenceLang(info)
        // Keep prose line; only rewrite the fence
        out.push(line)
        out.push(`\`\`\`${fenceInfo(lang, start, path)}`)
        i += 1
        continue
      }
    }

    out.push(line)
  }
  return out.join('\n')
}

/** `附近：```c` mid-line → prose + fence on its own line (otherwise ``` leaks as text). */
function breakInlineFences(md: string): string {
  return md
    // opening fence glued to prose
    .replace(/([^\n`])```([A-Za-z0-9_+:=%-]*)/g, '$1\n\n```$2')
    // code + closing fence glued on one line: `foo;```` → `foo;` + newline + fence
    .replace(/([^\n`])```(\s*)$/gm, '$1\n```')
}

/** Lift indented fences to column 0 so list nesting stays clean. */
function outdentFencedCodeBlocks(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const open = lines[i].match(/^(\s+)```(.*)$/)
    if (open) {
      const indent = open[1]
      out.push(`\`\`\`${open[2].trim()}`)
      i += 1
      while (i < lines.length) {
        const line = lines[i]
        if (line.trimStart().startsWith('```')) {
          out.push('```')
          i += 1
          break
        }
        out.push(indent && line.startsWith(indent) ? line.slice(indent.length) : line.trimStart())
        i += 1
      }
      continue
    }
    out.push(lines[i])
    i += 1
  }
  return out.join('\n')
}

/** Auto-close an open fence before a top-level heading or EOF. */
function closeUnclosedFences(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let open = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trimStart()
    if (trimmed.startsWith('```')) {
      out.push(open ? '```' : line.replace(/^\s+/, ''))
      open = !open
      continue
    }
    if (open && /^#{1,6}\s/.test(trimmed) && !line.startsWith(' ') && !line.startsWith('\t')) {
      out.push('```')
      out.push('')
      open = false
    }
    out.push(line)
  }
  if (open) out.push('```')
  return out.join('\n')
}

function normalizeMarkdown(md: string): string {
  return attachCodeFenceCitations(
    fenceBareCitations(
      closeUnclosedFences(
        outdentFencedCodeBlocks(
          breakInlineFences(
            expandCollapsedGfmTables(md),
          ),
        ),
      ),
    ),
  )
}

function parseFenceMeta(className: string | undefined): { startLine: number; path?: string } {
  const raw = String(className || '')
  const token = raw.match(/language-([^\s]+)/)?.[1] || ''
  // language-c:110 or language-c:110:encodedPath
  const m = token.match(/^([^:]*):(\d+)(?::(.+))?$/)
  if (m) {
    let path: string | undefined
    if (m[3]) {
      try {
        path = decodeURIComponent(m[3])
      } catch {
        path = m[3]
      }
    }
    return { startLine: Math.max(1, Number(m[2]) || 1), path }
  }
  return { startLine: 1 }
}

function CodeBlock({
  text,
  startLine,
  path,
}: {
  text: string
  startLine: number
  path?: string
}) {
  const lines = text.replace(/\n$/, '').split('\n')
  const lastNo = startLine + Math.max(lines.length, 1) - 1
  const gutterWidth = `${String(lastNo).length}ch`

  const wrap: CSSProperties = {
    margin: '0 0 12px',
    borderRadius: 6,
    border: '1px solid rgba(15, 23, 42, 0.1)',
    background: '#f4f6f9',
    overflow: 'hidden',
  }

  const header: CSSProperties = {
    padding: '6px 10px',
    fontSize: 12,
    lineHeight: 1.4,
    color: 'var(--text-secondary)',
    background: '#eef1f5',
    borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
    fontFamily: mono,
    wordBreak: 'break-all',
  }

  const scroller: CSSProperties = {
    margin: 0,
    padding: '6px 0',
    overflowX: 'auto',
    fontSize: 12.5,
    lineHeight: 1.55,
    color: 'var(--text-primary)',
    background: '#f4f6f9',
  }

  const row: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    minWidth: '100%',
  }

  const gutter: CSSProperties = {
    flex: `0 0 calc(${gutterWidth} + 18px)`,
    width: `calc(${gutterWidth} + 18px)`,
    padding: '0 10px 0 8px',
    textAlign: 'right',
    userSelect: 'none',
    color: '#94a3b8',
    background: '#eef1f5',
    borderRight: '1px solid rgba(15, 23, 42, 0.08)',
    fontFamily: mono,
  }

  const codeCell: CSSProperties = {
    flex: '1 1 auto',
    padding: '0 12px',
    whiteSpace: 'pre',
    fontFamily: mono,
  }

  return (
    <div className="bb-code-block" style={wrap}>
      {path ? <div style={header}>{path}</div> : null}
      <pre style={scroller}>
        {lines.map((line, idx) => (
          <div key={idx} style={row}>
            <span style={gutter}>{startLine + idx}</span>
            <code style={codeCell}>{line.length ? line : ' '}</code>
          </div>
        ))}
      </pre>
    </div>
  )
}

const tableWrap: CSSProperties = {
  margin: '0 0 12px',
  overflowX: 'auto',
  borderRadius: 8,
  border: '1px solid rgba(15,23,42,0.1)',
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  lineHeight: 1.5,
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  background: 'rgba(15,23,42,0.04)',
  borderBottom: '1px solid rgba(15,23,42,0.12)',
  fontWeight: 650,
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
}

const tdStyle: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid rgba(15,23,42,0.06)',
  verticalAlign: 'top',
}

const components: Components = {
  h1: ({ children }) => (
    <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px', lineHeight: 1.35 }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: 16, fontWeight: 700, margin: '14px 0 8px', lineHeight: 1.4 }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 14, fontWeight: 650, margin: '12px 0 6px', lineHeight: 1.4 }}>{children}</h3>
  ),
  p: ({ children }) => (
    <p style={{ margin: '0 0 10px' }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul style={{ margin: '0 0 10px', paddingLeft: 20 }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: '0 0 10px', paddingLeft: 20 }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ marginBottom: 4 }}>{children}</li>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 650 }}>{children}</strong>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const text = String(children).replace(/\n$/, '')
    const isBlock = Boolean(className) || text.includes('\n')
    if (!isBlock) {
      return (
        <code
          style={{
            fontFamily: mono,
            fontSize: 12.5,
            background: 'rgba(15,23,42,0.06)',
            borderRadius: 4,
            padding: '1px 5px',
          }}
        >
          {text}
        </code>
      )
    }
    const meta = parseFenceMeta(className)
    return <CodeBlock text={text} startLine={meta.startLine} path={meta.path} />
  },
  pre: ({ children }) => <>{children}</>,
  hr: () => (
    <hr style={{ border: 'none', borderTop: '1px solid rgba(15,23,42,0.08)', margin: '12px 0' }} />
  ),
  blockquote: ({ children }) => (
    <blockquote
      style={{
        margin: '0 0 10px',
        padding: '6px 12px',
        borderLeft: '3px solid rgba(37,99,235,0.45)',
        color: 'var(--text-secondary)',
        background: 'rgba(37,99,235,0.04)',
      }}
    >
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div style={tableWrap}>
      <table style={tableStyle}>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => <th style={thStyle}>{children}</th>,
  td: ({ children }) => <td style={tdStyle}>{children}</td>,
}

interface Props {
  content: string
}

/** Renders assistant chat content as Markdown (headings, lists, GFM tables, light code gutters). */
export function ChatMarkdown({ content }: Props) {
  if (!content.trim()) return null
  const normalized = normalizeMarkdown(content)
  return (
    <div className="bb-chat-markdown" style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {normalized}
      </ReactMarkdown>
    </div>
  )
}
