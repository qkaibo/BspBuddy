// ============================================================
// CreditDisplay — Credit balance bar shown in sidebar footer
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { Coins, Clock } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { CreditBalance } from '../lib/types'

const ipc = createIpcClient()

interface Props {
  collapsed?: boolean
  onOpenPricing?: () => void
}

export function CreditDisplay({ collapsed = false, onOpenPricing }: Props) {
  const [balance, setBalance] = useState<CreditBalance | null>(null)

  const loadBalance = useCallback(async () => {
    const result = await ipc.invoke(IPC_CHANNELS.CREDITS_BALANCE) as CreditBalance
    setBalance(result)
  }, [])

  useEffect(() => {
    loadBalance()
  }, [loadBalance])

  if (!balance) return null

  const percent = balance.total > 0 ? Math.round((balance.used / (balance.total + balance.used)) * 100) : 0
  const barColor = percent > 90 ? 'var(--danger)' : percent > 70 ? 'var(--warning, #f59e0b)' : 'var(--accent)'
  const planLabels: Record<string, string> = {
    free: '体验版', standard: '标准版', advanced: '高级版',
    flagship: '旗舰版', enterprise: '企业版',
  }
  const daysUntilExpiry = Math.max(0, Math.ceil((new Date(balance.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  if (collapsed) {
    return (
      <div style={{ padding: '4px', display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={onOpenPricing}
          title={`${balance.remaining}/${balance.total} credits`}
          aria-label={`积分 ${balance.remaining}/${balance.total}，打开套餐`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2 }}
        >
          <Coins size={16} aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Coins size={14} color={barColor} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
            {planLabels[balance.plan] || balance.plan}
          </span>
        </div>
        <button
          onClick={onOpenPricing}
          style={{
            fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', padding: 0,
          }}
        >
          升级
        </button>
      </div>

      <div style={{ marginBottom: 4 }}>
        <div style={{
          height: 4, borderRadius: 2, background: 'var(--bg-input)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${percent}%`, background: barColor,
            borderRadius: 2, transition: 'width .3s ease',
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          剩余 <strong style={{ color: 'var(--text-primary)' }}>{balance.remaining.toLocaleString()}</strong>
          {' / '}{balance.total.toLocaleString()}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
        <Clock size={9} color="var(--text-tertiary)" />
        <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          {daysUntilExpiry}天后到期
        </span>
      </div>
    </div>
  )
}
