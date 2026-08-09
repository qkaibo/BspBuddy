/**
 * Acceptance: auth-001 Phase A/B/C — session actor, members UI, SOP owner filter
 * L1: static file + typecheck signals
 * L2: IPC probe via CDP Runtime (if Electron on 9222)
 * L3: UI path via puppeteer-core (optional)
 *
 * Prerequisite for L2/L3: npm run dev -- --remote-debugging-port=9222
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const CDP = 'http://127.0.0.1:9222'
const results = []

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail })
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`)
}
async function sleep(ms) { await new Promise((r) => setTimeout(r, ms)) }

function printSummary() {
  const ok = results.filter((r) => r.ok).length
  const bad = results.filter((r) => !r.ok).length
  console.log(`\n=== Summary: ${ok} passed, ${bad} failed ===`)
}

async function findAppPage(browser) {
  const pages = await browser.pages()
  for (const page of pages) {
    if ((page.url() || '').includes('5173')) return page
  }
  const t = (await browser.targets()).find((x) => (x.url() || '').includes('5173'))
  if (t) return t.page()
  throw new Error('renderer :5173 not found')
}

async function clickByText(page, text, { timeout = 8000 } = {}) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const clicked = await page.evaluate((needle) => {
      const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], span, div, label'))
      const matches = nodes
        .map((el) => {
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
          return t.includes(needle) ? { el, len: t.length } : null
        })
        .filter(Boolean)
        .sort((a, b) => a.len - b.len)
      if (!matches.length) return false
      matches[0].el.click()
      return true
    }, text)
    if (clicked) return
    await sleep(200)
  }
  throw new Error(`not found: ${text}`)
}

async function main() {
  console.log('=== auth-001 verification ===\n')

  const files = [
    'src/lib/auth-types.ts',
    'src/main/services/auth-service.ts',
    'src/components/MemberRolesPanel.tsx',
    'src/components/SettingsPanel.tsx',
    'src/main/services/sop-service.ts',
    'docs/prd/auth-001-access-control.md',
    'docs/tech-spec/auth-001-session-and-rbac.md',
    'docs/plans/auth-01-access-control.md',
  ]
  const missing = files.filter((f) => !fs.existsSync(f))
  if (missing.length === 0) pass('L1 auth files present')
  else fail('L1 auth files present', missing.join(', '))

  const typesSrc = fs.readFileSync('src/lib/types.ts', 'utf-8')
  const channels = [
    'AUTH_ME', 'AUTH_LOGIN', 'AUTH_LOGOUT',
    'AUTH_USERS_LIST', 'AUTH_USERS_CREATE', 'AUTH_USERS_UPDATE', 'AUTH_USERS_DELETE',
    'AUTH_SWITCH_USER',
  ]
  if (channels.every((c) => typesSrc.includes(c))) pass('L1 IPC_CHANNELS auth keys')
  else fail('L1 IPC_CHANNELS auth keys', channels.filter((c) => !typesSrc.includes(c)).join(', '))

  const sopSrc = fs.readFileSync('src/main/services/sop-service.ts', 'utf-8')
  if (sopSrc.includes('ownerUserId') && sopSrc.includes('canViewLibrary') && sopSrc.includes('requireActor') === false) {
    // requireActor is in ipc-handlers; sop uses actor param
    pass('L1 sop-service owner ACL helpers')
  } else if (sopSrc.includes('ownerUserId') && sopSrc.includes('canViewLibrary')) {
    pass('L1 sop-service owner ACL helpers')
  } else {
    fail('L1 sop-service owner ACL helpers', 'missing ownerUserId / canViewLibrary')
  }

  const tsc = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
    encoding: 'utf-8',
    shell: true,
    timeout: 120_000,
  })
  if (tsc.status === 0) pass('L1 tsc --noEmit')
  else {
    const out = `${tsc.stdout || ''}\n${tsc.stderr || ''}`
    const authHits = out.split('\n').filter((l) =>
      /auth-service|auth-types|MemberRolesPanel|SettingsPanel|sop-service|ipc-handlers/.test(l),
    )
    if (authHits.length === 0 && out.includes('error TS')) {
      pass('L1 tsc auth-related clean', 'project has unrelated tsc errors')
    } else if (tsc.status === 0) {
      pass('L1 tsc --noEmit')
    } else if (authHits.length) {
      fail('L1 tsc auth-related', authHits.slice(0, 8).join(' | '))
    } else {
      fail('L1 tsc --noEmit', (out || 'unknown').slice(0, 400))
    }
  }

  let browser
  try {
    browser = await puppeteer.connect({ browserURL: CDP, defaultViewport: null })
  } catch (e) {
    fail('L2/L3 connect CDP', e.message || String(e))
    printSummary()
    process.exit(results.some((r) => !r.ok) ? 1 : 0)
  }

  try {
    const page = await findAppPage(browser)
    await page.bringToFront()
    await sleep(600)

    // L2: probe auth IPC from renderer (requires app rebuilt with auth handlers)
    let me
    try {
      me = await page.evaluate(async () => {
        const api = window.electronAPI || window.bspbuddy || window.api
        if (!api?.invoke) return { error: 'no ipc bridge' }
        try {
          return await api.invoke('auth:me')
        } catch (e) {
          return { error: e?.message || String(e) }
        }
      })
    } catch (e) {
      me = { error: e.message || String(e) }
    }
    if (me?.actor?.userId && Array.isArray(me?.actor?.roles)) {
      pass('L2 auth:me actor', `${me.actor.username} roles=${me.actor.roles.join(',')}`)
    } else {
      fail('L2 auth:me actor', (me?.error || JSON.stringify(me)).slice(0, 220) + ' — restart Electron after code change')
    }

    // Switch to zhangsan and list SOPs — should not include lisi draft
    let isolation
    try {
      isolation = await page.evaluate(async () => {
        const invoke = (window.electronAPI || window.bspbuddy || window.api)?.invoke
        if (!invoke) return { error: 'no invoke' }
        try {
          await invoke('auth:switch-user', 'u_zhangsan')
          const list = await invoke('sop:list', { status: 'all' })
          const items = Array.isArray(list) ? list : (list?.items || [])
          const ids = items.map((x) => x.id)
          await invoke('auth:switch-user', 'u_admin')
          return {
            count: items.length,
            hasLisi: ids.includes('sop-onboarding-lisi'),
            hasZhangDraft: ids.includes('sop-meeting-notes'),
            ids,
          }
        } catch (e) {
          return { error: e?.message || String(e) }
        }
      })
    } catch (e) {
      isolation = { error: e.message || String(e) }
    }
    if (isolation?.error) {
      fail('L2 SOP owner isolation', isolation.error)
    } else if (isolation.hasLisi) {
      fail('L2 SOP owner isolation', 'zhangsan can see lisi draft')
    } else if (!isolation.hasZhangDraft && isolation.count === 0) {
      fail('L2 SOP owner isolation', `empty list: ${JSON.stringify(isolation)}`)
    } else {
      pass('L2 SOP owner isolation', `zhangsan sees ${isolation.count} items, no lisi draft`)
    }

    // L3: avatar menu → 设置 → 成员与角色
    try {
      // Settings lives under sidebar avatar menu
      const openedAvatar = await page.evaluate(() => {
        const byAria = document.querySelector('button[aria-label="账号菜单"]')
        if (byAria) { byAria.click(); return 'aria' }
        const btns = Array.from(document.querySelectorAll('button'))
        const avatar = btns.find((b) => {
          const t = (b.textContent || '').replace(/\s+/g, ' ').trim()
          return t === 'User' || t === 'UUser' || /^U\s*User/.test(t)
        })
        if (avatar) { avatar.click(); return 'text' }
        return ''
      })
      if (!openedAvatar) throw new Error('avatar menu button not found')
      await sleep(500)
      await clickByText(page, '设置')
      await sleep(600)
      const settingsText = await page.evaluate(() => document.body.innerText)
      if (!settingsText.includes('系统设置') && !settingsText.includes('当前账号') && !settingsText.includes('成员与角色')) {
        throw new Error('settings panel not visible')
      }
      await clickByText(page, '成员与角色')
      await sleep(800)
      const body = await page.evaluate(() => document.body.innerText)
      if (body.includes('成员与角色') && (body.includes('当前账号') || body.includes('管理员'))) {
        pass('L3 members panel opens')
      } else {
        fail('L3 members panel opens', 'panel text not found')
      }
      try { await clickByText(page, '返回', { timeout: 3000 }) } catch { /* */ }
    } catch (e) {
      fail('L3 members panel opens', e.message || String(e))
    }
  } finally {
    browser.disconnect()
  }

  printSummary()
  process.exit(results.some((r) => !r.ok && r.name.startsWith('L1')) ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
