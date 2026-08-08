import { useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown, BarChart3, X } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'

const ipc = createIpcClient()

interface Props {
  onClose: () => void
}

export function FeedbackPanel({ onClose }: Props) {
  const [summary, setSummary] = useState<{ total: number; good: number; bad: number; goodRate: number } | null>(null)

  useEffect(() => {
    ipc.invoke(IPC_CHANNELS.FEEDBACK_SUMMARY).then((s) => {
      if (s) setSummary(s as any)
    }).catch(() => {
      setSummary({ total: 0, good: 0, bad: 0, goodRate: 0 })
    })
  }, [])

  const s = summary
  const goodRate = s?.total ? Math.round((s.good / s.total) * 100) : 0

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={18} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>反馈看板</span>
        </div>
        <button onClick={onClose} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>x</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard icon={<ThumbsUp size={18} color="#22c55e" />} label="好评" value={s?.good ?? 0} color="#22c55e" />
          <StatCard icon={<ThumbsDown size={18} color="#ef4444" />} label="差评" value={s?.bad ?? 0} color="#ef4444" />
          <StatCard icon={<BarChart3 size={18} color="var(--accent)" />} label="总计" value={s?.total ?? 0} color="var(--accent)" />
        </div>

        {/* Good rate */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)',
          padding: '16px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>好评率</div>
          <div style={{ width: '100%', height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${goodRate}%`, height: '100%',
              background: goodRate >= 80 ? '#22c55e' : goodRate >= 50 ? '#f59e0b' : '#ef4444',
              borderRadius: 4, transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>
            <span>{goodRate}%</span>
            <span>{s?.total ?? 0} 条反馈</span>
          </div>
        </div>

        {/* Summary text */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)',
          padding: '16px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>数据说明</div>
          <p>反馈数据来自对话中消息气泡的赞/踩操作。好评率和差评率用于衡量专家回复质量和用户满意度。</p>
          <p style={{ marginTop: 8 }}>后续版本将支持按专家/技能维度拆分统计，以及 6 桶分析。</p>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)',
      padding: '14px', textAlign: 'center' as const,
    }}>
      <div style={{ marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
