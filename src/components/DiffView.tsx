import { GitFork, Plus, Minus } from 'lucide-react'

interface DiffChange {
  filePath: string
  description: string
  addedLines?: number
  removedLines?: number
}

interface Props {
  changes: DiffChange[]
}

export function DiffView({ changes }: Props) {
  if (changes.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', gap: 8 }}>
        <GitFork size={32} opacity={0.3} />
        <span style={{ fontSize: 13 }}>No file changes</span>
        <span style={{ fontSize: 11 }}>File modifications will appear here</span>
      </div>
    )
  }

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {changes.map((c, i) => (
        <div
          key={i}
          style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
            {c.filePath.split(/[\\/]/).pop()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
            {c.description}
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
            {c.addedLines != null && (
              <span style={{ color: 'var(--success)' }}>
                <Plus size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                +{c.addedLines}
              </span>
            )}
            {c.removedLines != null && (
              <span style={{ color: 'var(--danger)' }}>
                <Minus size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                -{c.removedLines}
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {c.filePath}
          </div>
        </div>
      ))}
    </div>
  )
}
