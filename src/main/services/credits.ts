// ============================================================
// Credits service — balance tracking, consumption, expiry
// ============================================================

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { CreditBalance, BspPlan, TopupPack } from '../../lib/types'

interface CreditStore {
  currentBalance: CreditBalance
  topupPurchases: TopupPurchase[]
}

interface TopupPurchase {
  id: string
  credits: number
  price: number
  purchasedAt: string
  expiresAt: string
  remaining: number
}

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'credits.json')
}

function loadStore(): CreditStore {
  const p = getStorePath()
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')) }
    catch { /* corrupt file, recreate */ }
  }
  return createDefaultStore()
}

function saveStore(store: CreditStore): void {
  const dir = path.dirname(getStorePath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2), 'utf-8')
}

function getNextMonth(date: Date): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1)
  return d
}

function getPlanCredits(plan: BspPlan): { base: number; bonus: number } {
  switch (plan) {
    case 'free':       return { base: 500, bonus: 0 }
    case 'standard':   return { base: 2000, bonus: 2000 }
    case 'advanced':   return { base: 4000, bonus: 5000 }
    case 'flagship':   return { base: 20000, bonus: 30000 }
    case 'enterprise': return { base: 20000, bonus: 0 }
  }
}

function createDefaultStore(): CreditStore {
  const now = new Date()
  const expiresDate = getNextMonth(now)
  const { base, bonus } = getPlanCredits('free')
  return {
    currentBalance: {
      total: base + bonus,
      used: 0,
      remaining: base + bonus,
      expiresAt: expiresDate.toISOString(),
      plan: 'free',
      baseCredits: base,
      bonusCredits: bonus,
      resetDate: expiresDate.toISOString(),
    },
    topupPurchases: [],
  }
}

class CreditsService {
  private store: CreditStore

  constructor() {
    this.store = loadStore()
  }

  getBalance(): CreditBalance {
    this.checkReset()
    return { ...this.store.currentBalance }
  }

  getPlanInfo(): { plan: BspPlan; planName: string; monthlyCredits: number } {
    const { base, bonus } = getPlanCredits(this.store.currentBalance.plan)
    const names: Record<BspPlan, string> = {
      free: '体验版', standard: '标准版', advanced: '高级版',
      flagship: '旗舰版', enterprise: '企业版',
    }
    return { plan: this.store.currentBalance.plan, planName: names[this.store.currentBalance.plan], monthlyCredits: base + bonus }
  }

  consume(amount: number): { success: boolean; remaining: number; error?: string } {
    this.checkReset()
    this.expireTopups()

    let needed = amount
    const now = new Date()

    // Phase 1: Deduct from top-up packs (earliest expiry first)
    const activeTopups = this.store.topupPurchases
      .filter(t => t.remaining > 0 && new Date(t.expiresAt) > now)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())

    for (const topup of activeTopups) {
      if (needed <= 0) break
      const deduct = Math.min(needed, topup.remaining)
      topup.remaining -= deduct
      needed -= deduct
    }

    // Phase 2: Deduct from bonus credits (expire sooner)
    if (needed > 0 && this.store.currentBalance.bonusCredits > 0) {
      const deduct = Math.min(needed, this.store.currentBalance.bonusCredits)
      this.store.currentBalance.bonusCredits -= deduct
      this.store.currentBalance.used += deduct
      needed -= deduct
    }

    // Phase 3: Deduct from base credits
    if (needed > 0 && this.store.currentBalance.baseCredits > 0) {
      const deduct = Math.min(needed, this.store.currentBalance.baseCredits)
      this.store.currentBalance.baseCredits -= deduct
      this.store.currentBalance.used += deduct
      needed -= deduct
    }

    if (needed > 0) {
      return { success: false, remaining: this.getRemaining(), error: '积分不足' }
    }

    this.recalcBalance()
    saveStore(this.store)
    return { success: true, remaining: this.getRemaining() }
  }

  topup(pack: TopupPack): CreditBalance {
    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + pack.validityDays)

    this.store.topupPurchases.push({
      id: `topup-${now.getTime()}`,
      credits: pack.credits,
      price: pack.price,
      purchasedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      remaining: pack.credits,
    })

    this.recalcBalance()
    saveStore(this.store)
    return this.getBalance()
  }

  changePlan(plan: BspPlan): CreditBalance {
    const { base, bonus } = getPlanCredits(plan)
    const now = new Date()
    const resetDate = getNextMonth(now)
    this.store.currentBalance = {
      total: base + bonus,
      used: 0,
      remaining: base + bonus,
      expiresAt: resetDate.toISOString(),
      plan,
      baseCredits: base,
      bonusCredits: bonus,
      resetDate: resetDate.toISOString(),
    }
    // Clear old topups
    this.store.topupPurchases = this.store.topupPurchases.filter(t => t.remaining > 0 && new Date(t.expiresAt) > now)
    saveStore(this.store)
    return this.getBalance()
  }

  private checkReset(): void {
    const now = new Date()
    const resetDate = new Date(this.store.currentBalance.resetDate)
    if (now >= resetDate) {
      const { base, bonus } = getPlanCredits(this.store.currentBalance.plan)
      const nextReset = getNextMonth(now)
      this.store.currentBalance = {
        total: base + bonus,
        used: 0,
        remaining: base + bonus,
        expiresAt: nextReset.toISOString(),
        plan: this.store.currentBalance.plan,
        baseCredits: base,
        bonusCredits: bonus,
        resetDate: nextReset.toISOString(),
      }
      // On reset, also expire old topups within the month
      this.expireTopups()
      saveStore(this.store)
    }
  }

  private expireTopups(): void {
    const now = new Date()
    this.store.topupPurchases = this.store.topupPurchases.filter(t => new Date(t.expiresAt) > now && t.remaining > 0)
  }

  private recalcBalance(): void {
    const topupRemaining = this.store.topupPurchases.reduce((sum, t) => sum + t.remaining, 0)
    this.store.currentBalance.total = this.store.currentBalance.baseCredits + this.store.currentBalance.bonusCredits + topupRemaining
    this.store.currentBalance.remaining = this.store.currentBalance.baseCredits + this.store.currentBalance.bonusCredits + topupRemaining
  }

  private getRemaining(): number {
    const topupRemaining = this.store.topupPurchases.reduce((sum, t) => sum + t.remaining, 0)
    return this.store.currentBalance.baseCredits + this.store.currentBalance.bonusCredits + topupRemaining
  }
}

export const creditsService = new CreditsService()
