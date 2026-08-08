import { Globe } from 'lucide-react'

interface Props {
  url?: string
  htmlContent?: string
}

export function BrowserPreview({ url, htmlContent }: Props) {
  if (!url && !htmlContent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', gap: 8 }}>
        <Globe size={32} opacity={0.3} />
        <span style={{ fontSize: 13 }}>No preview available</span>
        <span style={{ fontSize: 11 }}>HTML artifacts will be previewed here</span>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px', background: 'var(--bg-input)',
        borderBottom: '1px solid var(--border)', fontSize: 11,
      }}>
        <Globe size={12} color="var(--text-secondary)" />
        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {url || 'HTML Preview'}
        </span>
      </div>
      <iframe
        srcDoc={htmlContent}
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: '100%', height: 'calc(100% - 29px)',
          border: 'none', background: '#fff',
        }}
        title="Browser Preview"
      />
    </div>
  )
}
