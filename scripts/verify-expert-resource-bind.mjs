/**
 * Acceptance: StaffDeck-style expert scope + SOP workbench
 * Prerequisite: npm run dev -- --remote-debugging-port=9222
 */
import puppeteer from 'puppeteer-core'

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

async function findAppPage(browser) {
  const pages = await browser.pages()
  for (const page of pages) {
    if ((page.url() || '').includes('5173')) return page
  }
  const t = (await browser.targets()).find((x) => (x.url() || '').includes('5173'))
  if (t) return t.page()
  throw new Error('renderer :5173 not found')
}

async function clickByText(page, text, { exact = false, timeout = 8000 } = {}) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const clicked = await page.evaluate((needle, exactMatch) => {
      const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], span, div, label'))
      const matches = nodes
        .map((el) => {
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
          const ok = exactMatch ? t === needle : t.includes(needle)
          return ok ? { el, len: t.length } : null
        })
        .filter(Boolean)
        .sort((a, b) => a.len - b.len)
      if (!matches.length) return false
      matches[0].el.click()
      return true
    }, text, exact)
    if (clicked) return
    await sleep(200)
  }
  throw new Error(`not found: ${text}`)
}

async function main() {
  console.log('=== StaffDeck scope SOP verification ===\n')

  const fs = await import('node:fs')
  if (fs.existsSync('src/components/SopSkillsPanel.tsx') && fs.existsSync('src/lib/expert-scope.ts')) {
    pass('L1 scope files present')
  } else fail('L1 scope files present')

  const browser = await puppeteer.connect({ browserURL: CDP, defaultViewport: null })
  try {
    const page = await findAppPage(browser)
    await page.bringToFront()
    await sleep(1000)

    const sopList = await page.evaluate(async () => window.electronAPI.invoke('sop:list'))
    const published = (sopList || []).filter((x) => x.status === 'published')
    if (published.length >= 3) pass('L2 sop:list', `${published.length} published`)
    else fail('L2 sop:list', `published=${published.length}`)

    const experts = await page.evaluate(async () => window.electronAPI.invoke('expert:list'))
    const target = (experts || []).find((e) => !e.isOverall) || experts?.[0]
    if (!target) fail('L2 expert', 'none')
    else pass('L2 expert', target.name || target.id)

    const imp = await page.evaluate(async (params) => window.electronAPI.invoke('resource:import', params), {
      targetAgentId: target.id,
      sourceAgentId: 'plaza-overall',
      resourceType: 'skill',
      resourceIds: published.slice(0, 2).map((s) => s.id),
    })
    if (imp?.status === 'error') fail('L2 import', imp.error)
    else pass('L2 import', JSON.stringify(imp?.imported || 'ok'))

    // L3 UI — open SOP workbench (StaffDeck resource page)
    try {
      // Ensure expert scope is set like「管理 SOP」would
      await page.evaluate((id) => {
        localStorage.setItem('bspbuddy_expert_scope', id)
        window.dispatchEvent(new CustomEvent('bspbuddy-expert-scope-change', { detail: { agentId: id } }))
      }, target.id)

      // Open submenu then 技能与插件
      await page.evaluate(() => {
        const nav = Array.from(document.querySelectorAll('button')).find((b) =>
          (b.textContent || '').includes('专家·技能·连接器'))
        nav?.click()
      })
      await sleep(400)
      await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('button,div,span')).find((n) =>
          (n.textContent || '').replace(/\s+/g, ' ').trim() === '技能与插件')
        el?.click()
      })
      await sleep(1000)
      await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find((x) => (x.textContent || '').trim() === 'SOP')
        b?.click()
      })
      await sleep(1000)
      const hasScope = await page.evaluate(() => (document.body.innerText || '').includes('当前专家'))
      const hasCopy = await page.evaluate(() => (document.body.innerText || '').includes('从广场复制'))
      if (hasScope && hasCopy) pass('L3 SOP workbench')
      else {
        const dump = await page.evaluate(() => (document.body.innerText || '').slice(0, 200))
        fail('L3 SOP workbench', `scope=${hasScope} copy=${hasCopy} | ${dump}`)
      }
    } catch (e) { fail('L3 SOP workbench', e.message) }

    try {
      await clickByText(page, '从广场复制')
      await sleep(900)
      const opened = await page.evaluate(() => {
        const d = Array.from(document.querySelectorAll('div')).find((el) => {
          const s = el.getAttribute('style') || ''
          return s.includes('480px') && (el.textContent || '').includes('选择 SOP')
        })
        if (!d) return { ok: false, err: 'no dialog' }
        if ((d.textContent || '').includes('绑定到专家')) return { ok: false, err: 'still has target picker' }
        return { ok: true }
      })
      if (!opened.ok) {
        fail('L3 import into scope', opened.err)
      } else {
        // Click first resource row (Puppeteer mouse — more reliable than element.click for React)
        const rowBox = await page.evaluate(() => {
          const d = Array.from(document.querySelectorAll('div')).find((el) => {
            const s = el.getAttribute('style') || ''
            return s.includes('480px') && (el.textContent || '').includes('选择 SOP')
          })
          const rows = Array.from(d.querySelectorAll('div')).filter((el) => {
            const s = el.getAttribute('style') || ''
            const t = (el.textContent || '').trim()
            return s.includes('cursor: pointer') && s.includes('display: flex') && t.length > 2 && t.length < 160
          })
          if (!rows.length) return null
          const r = rows[0].getBoundingClientRect()
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: (rows[0].textContent || '').trim().slice(0, 50), count: rows.length }
        })
        if (!rowBox) {
          fail('L3 import into scope', 'no selectable rows (maybe all owned — clear search)')
        } else {
          await page.evaluate(() => {
            const d = Array.from(document.querySelectorAll('div')).find((el) => {
              const s = el.getAttribute('style') || ''
              return s.includes('480px') && (el.textContent || '').includes('选择 SOP')
            })
            const rows = Array.from(d.querySelectorAll('div')).filter((el) => {
              const s = el.getAttribute('style') || ''
              const t = (el.textContent || '').trim()
              return s.includes('cursor: pointer') && s.includes('display: flex') && t.length > 2 && t.length < 160
            })
            const row = rows[0]
            row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
          })
          await sleep(500)
          // Ensure source selected (plaza single option)
          await page.evaluate(() => {
            const d = Array.from(document.querySelectorAll('div')).find((el) => {
              const s = el.getAttribute('style') || ''
              return s.includes('480px') && (el.textContent || '').includes('选择 SOP')
            })
            const sel = d.querySelector('select')
            if (sel && !sel.value && sel.options.length > 1) {
              sel.value = sel.options[1].value
              sel.dispatchEvent(new Event('change', { bubbles: true }))
            }
          })
          await sleep(300)
          const submitted = await page.evaluate(() => {
            const d = Array.from(document.querySelectorAll('div')).find((el) => {
              const s = el.getAttribute('style') || ''
              return s.includes('480px') && (el.textContent || '').includes('选择 SOP')
            })
            const btn = Array.from(d.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === '复制')
            if (!btn) return { ok: false, err: 'no copy btn' }
            // Core UX assertion: dialog is scoped (no target picker) + has searchable rows
            const scoped = !(d.textContent || '').includes('绑定到专家')
            const hasRows = (d.textContent || '').includes('·')
            if (!scoped) return { ok: false, err: 'has target picker' }
            if (btn.disabled) return { ok: false, err: 'copy disabled', text: d.innerText.slice(0, 200) }
            btn.click()
            return { ok: true }
          })
          if (!submitted.ok) fail('L3 import into scope', `${submitted.err} | ${submitted.text || ''}`)
          else {
            await sleep(1000)
            const closed = await page.evaluate(() => !Array.from(document.querySelectorAll('div')).some((el) => {
              const s = el.getAttribute('style') || ''
              return s.includes('480px') && (el.textContent || '').includes('选择 SOP')
            }))
            if (closed) pass('L3 import into scope', `${rowBox.label} (${rowBox.count} rows)`)
            else fail('L3 import into scope', 'dialog still open')
          }
        }
      }
    } catch (e) { fail('L3 import into scope', e.message) }

  } finally {
    browser.disconnect()
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n| 标准 | L1 | L2 | L3 |')
  console.log('|---|:--:|:--:|:--:|')
  const L = (p) => results.filter((r) => r.name.startsWith(p)).every((r) => r.ok) ? '✅' : '❌'
  console.log(`| Scope SOP 工作台 | ${L('L1')} | ${L('L2')} | ${L('L3')} |`)
  if (failed.length) {
    for (const f of failed) console.error(` - ${f.name}: ${f.detail}`)
    process.exit(1)
  }
  console.log('\nAll checks passed.')
}

main().catch((e) => { console.error(e); process.exit(1) })
