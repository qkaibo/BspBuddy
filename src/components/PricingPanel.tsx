// ============================================================
// PricingPanel — Subscription plans comparison & top-up packs
// ============================================================

import { useState } from 'react'
import { ArrowLeft, Check, Coins, Plus } from 'lucide-react'
import { PRICING_PLANS, TOPUP_PACKS } from '../lib/types'
import type { BspPlan } from '../lib/types'

interface Props {
  currentPlan?: BspPlan
  onClose: () => void
}

export function PricingPanel({ currentPlan = 'free', onClose }: Props) {
  const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'recurring-monthly' | 'yearly' | 'recurring-yearly'>('monthly')

  const getDisplayPrice = (plan: typeof PRICING_PLANS[number]) => {
    switch (selectedBilling) {
      case 'monthly': return plan.monthlyPrice === 0 ? '免费' : `${plan.monthlyPrice}元/月`
      case 'recurring-monthly': return plan.recurringMonthlyPrice ? `${plan.recurringMonthlyPrice}元/月` : '—'
      case 'yearly': return plan.yearlyPrice ? `${plan.yearlyPrice}元/年` : '—'
      case 'recurring-yearly': return plan.recurringYearlyPrice ? `${plan.recurringYearlyPrice}元/年` : '—'
    }
  }

  const getUnitPrice = (plan: typeof PRICING_PLANS[number]) => {
    switch (selectedBilling) {
      case 'monthly': return plan.monthlyPrice === 0 ? '免费' : `${plan.monthlyPrice}元/月`
      case 'recurring-monthly': return `${plan.recurringMonthlyPrice}元/月`
      case 'yearly': return plan.yearlyPrice ? `${Math.round(plan.yearlyPrice / 12)}元/月` : '—'
      case 'recurring-yearly': return plan.recurringYearlyPrice ? `${Math.round(plan.recurringYearlyPrice / 12)}元/月` : '—'
    }
  }

  const getDiscount = () => {
    switch (selectedBilling) {
      case 'recurring-monthly': return '7折'
      case 'yearly': return '7折'
      case 'recurring-yearly': return '7折 x 8折'
      default: return ''
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', overflow: 'hidden' }}>
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}>
          <ArrowLeft size={16} color="var(--text-secondary)" />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>套餐选择</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{
          display: 'flex', gap: 6, marginBottom: 24, background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)', padding: 4, border: '1px solid var(--border)',
        }}>
          {([
            { id: 'monthly' as const, label: '月付' },
            { id: 'recurring-monthly' as const, label: '连续包月' },
            { id: 'yearly' as const, label: '年付' },
            { id: 'recurring-yearly' as const, label: '连续包年' },
          ]).map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedBilling(opt.id)}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: 4, border: 'none',
                fontSize: 11, fontWeight: selectedBilling === opt.id ? 600 : 400,
                background: selectedBilling === opt.id ? 'var(--accent)' : 'transparent',
                color: selectedBilling === opt.id ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {getDiscount() && (
          <div style={{
            textAlign: 'center', marginBottom: 20, fontSize: 12, color: 'var(--accent)',
            background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)',
            padding: '6px 12px', fontWeight: 600,
          }}>
            连续包月/年付享{getDiscount()}优惠
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {PRICING_PLANS.map(plan => {
            const isCurrent = plan.id === currentPlan
            return (
              <div
                key={plan.id}
                style={{
                  background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                  border: isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)',
                  padding: 16, display: 'flex', flexDirection: 'column',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {plan.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  {getDisplayPrice(plan)}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                  ({getUnitPrice(plan)})
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-light)', marginBottom: 12,
                }}>
                  <Coins size={12} color="var(--accent)" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                    {plan.totalCredits.toLocaleString()}积分/月
                  </span>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <FeatureItem label="代码补全" value={plan.codeCompletions} />
                  <FeatureItem label="自动任务" value={plan.autoTasks} />
                  <FeatureItem label="模型" value={plan.modelAccess} />
                  <FeatureItem label="项目数" value={`${plan.maxProjects}个/人`} />
                  <FeatureItem label="成员数" value={`${plan.maxMembers}人/项目`} />
                  <FeatureItem label="助理数" value={`${plan.maxAssistants}个/人`} />
                </div>

                <button
                  disabled={isCurrent}
                  style={{
                    marginTop: 12, width: '100%', padding: '8px 0',
                    borderRadius: 'var(--radius-sm)', border: isCurrent ? '1px solid var(--border)' : 'none',
                    background: isCurrent ? 'transparent' : 'var(--accent)',
                    color: isCurrent ? 'var(--text-tertiary)' : '#fff',
                    fontSize: 12, fontWeight: 600, cursor: isCurrent ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {isCurrent ? '当前方案' : '立即订阅'}
                </button>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Plus size={14} color="var(--text-secondary)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>加量包</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>(有效期30天)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {TOPUP_PACKS.map(pack => (
              <div
                key={`${pack.credits}-${pack.price}`}
                style={{
                  background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', padding: 16, textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                  {pack.credits.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>积分</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                  ¥{pack.price}
                </div>
                <button style={{
                  width: '100%', padding: '6px 0', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--accent)', background: 'transparent',
                  color: 'var(--accent)', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  立即购买
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
      <Check size={10} color="var(--accent)" style={{ flexShrink: 0 }} />
      <span style={{ color: 'var(--text-primary)' }}>{label}</span>
      <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto', textAlign: 'right' }}>{value}</span>
    </div>
  )
}
