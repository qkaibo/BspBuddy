import type { TaskPlan, TaskStep } from '../lib/types'
import { CheckCircle, Circle, Loader2, XCircle, ChevronDown, ChevronRight, Clock, SkipForward } from 'lucide-react'
import { useState } from 'react'

interface Props {
  plan: TaskPlan | null
  collapsed?: boolean
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed': return <CheckCircle size={14} color="var(--success)" />
    case 'running': return <Loader2 size={14} color="var(--accent)" style={{ animation: 'spin 2s linear infinite' }} />
    case 'failed': return <XCircle size={14} color="var(--danger)" />
    case 'skipped': return <SkipForward size={14} color="var(--text-tertiary)" />
    case 'ready': return <Circle size={14} color="var(--warning)" />
    default: return <Circle size={14} color="var(--border)" />
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'var(--success)'
    case 'running': return 'var(--accent)'
    case 'failed': return 'var(--danger)'
    case 'ready': return 'var(--warning)'
    case 'skipped': return 'var(--text-tertiary)'
    default: return 'var(--border)'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'pending': return 'Waiting'
    case 'ready': return 'Ready'
    case 'running': return 'Running...'
    case 'completed': return 'Done'
    case 'failed': return 'Failed'
    case 'skipped': return 'Skipped'
    default: return status
  }
}

interface StepDetail {
  params?: Record<string, unknown>
  result?: unknown
}

function StepRow({ step }: { step: TaskStep }) {
  const [expanded, setExpanded] = useState(false)

  const duration = step.completedAt && step.startedAt
    ? `${((step.completedAt - step.startedAt) / 1000).toFixed(1)}s`
    : step.startedAt
    ? 'running...'
    : ''

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 0', cursor: 'pointer', fontSize: 12,
          color: 'var(--text-secondary)',
        }}
      >
        {getStatusIcon(step.status)}
        <span style={{ flex: 1 }}>{step.description}</span>
        {duration && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{duration}</span>}
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </div>

      {expanded && (
        <div style={{
          marginLeft: 22, padding: '6px 10px', marginBottom: 4,
          background: 'var(--bg-input)', borderRadius: 6,
          fontSize: 11, fontFamily: 'monospace',
        }}>
          <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>Tool: {step.toolName}</div>
          {step.toolParams && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Params: </span>
              <span style={{ wordBreak: 'break-all' }}>{JSON.stringify(step.toolParams, null, 2)}</span>
            </div>
          )}
          {step.result && (
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Result: </span>
              <span style={{ wordBreak: 'break-all', display: 'block' }}>
                {typeof step.result === 'string' ? step.result : JSON.stringify(step.result, null, 2)}
              </span>
            </div>
          )}
          {step.error && (
            <div style={{ color: 'var(--danger)' }}>Error: {step.error}</div>
          )}
        </div>
      )}
    </div>
  )
}

export function Timeline({ plan }: Props) {
  if (!plan) return null

  const done = plan.steps.filter((s) => s.status === 'completed').length
  const total = plan.steps.length
  const percent = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
      padding: 14, border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={13} color="var(--accent)" />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Execution Timeline</span>
        </div>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 10,
          background: plan.status === 'completed' ? 'var(--success-bg)' : plan.status === 'failed' ? 'var(--danger-bg)' : 'var(--accent-light)',
          color: plan.status === 'completed' ? 'var(--success)' : plan.status === 'failed' ? 'var(--danger)' : 'var(--accent)',
        }}>
          {done}/{total} ({percent}%)
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3, borderRadius: 2, background: 'var(--bg-input)',
        overflow: 'hidden', marginBottom: 10,
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          width: `${percent}%`,
          background: plan.status === 'failed' ? 'var(--danger)' : 'var(--accent)',
          transition: 'width .3s ease',
        }} />
      </div>

      {/* Steps */}
      {plan.steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </div>
  )
}
