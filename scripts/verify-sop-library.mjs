/**
 * Acceptance: SOP 创作台 (agents-003) — list / create / edit / publish / scope handoff
 * Prerequisite: npm run dev -- --remote-debugging-port=9222
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

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
  console.log('=== SOP 创作台 verification ===\n')

  const files = [
    'src/components/SopLibraryPanel.tsx',
    'src/components/SopDistillEditor.tsx',
    'src/components/SopWorkbench.tsx',
    'src/main/services/sop-service.ts',
    'src/lib/sop-types.ts',
  ]
  if (files.every((f) => fs.existsSync(f))) pass('L1 sop creation files present')
  else fail('L1 sop creation files present', files.filter((f) => !fs.existsSync(f)).join(', '))

  let browser
  try {
    browser = await puppeteer.connect({ browserURL: CDP, defaultViewport: null })
  } catch (e) {
    fail('L2/L3 connect CDP', e.message || String(e))
    printSummary()
    process.exit(1)
  }

  try {
    let page = await findAppPage(browser)
    await page.bringToFront()
    await sleep(800)

    // L2: list
    const list = await page.evaluate(async () => window.electronAPI.invoke('sop:list'))
    const arr = Array.isArray(list) ? list : (list?.items || [])
    if (arr.length >= 3) pass('L2 sop:list', `${arr.length} items`)
    else fail('L2 sop:list', `count=${arr.length}`)

    // L2: create → update → publish
    const created = await page.evaluate(async () => {
      const res = await window.electronAPI.invoke('sop:create', {
        blank: true,
        name: '验收测试 SOP',
      })
      return res
    })
    const skill = created?.skill
    if (skill?.id) pass('L2 sop:create', skill.id)
    else fail('L2 sop:create', JSON.stringify(created))

    if (skill?.id) {
      const updated = await page.evaluate(async (id) => {
        return window.electronAPI.invoke('sop:update', id, {
          name: '验收测试 SOP',
          businessDomain: '验收',
          stepsText: '第一步收集信息\n第二步核对\n第三步归档',
        })
      }, skill.id)
      if (updated?.skill?.contentJson?.nodes?.length >= 3) {
        pass('L2 sop:update', `${updated.skill.contentJson.nodes.length} nodes`)
      } else fail('L2 sop:update', JSON.stringify(updated?.error || updated))

      const pub = await page.evaluate(async (id) => {
        return window.electronAPI.invoke('sop:publish', id)
      }, skill.id)
      if (pub?.skill?.status === 'published') pass('L2 sop:publish', `v${pub.skill.version}`)
      else fail('L2 sop:publish', JSON.stringify(pub?.error || pub))
    }

    // L3: open UI 创作台
    async function ensurePage() {
      try {
        await page.title()
        return page
      } catch {
        page = await findAppPage(browser)
        await page.bringToFront()
        return page
      }
    }

    try {
      page = await ensurePage()
      await page.evaluate(() => {
        const nav = Array.from(document.querySelectorAll('button')).find((b) =>
          (b.textContent || '').includes('专家·技能·连接器'))
        nav?.click()
      })
      await sleep(500)
      page = await ensurePage()
      await clickByText(page, '技能与插件')
      await sleep(600)
      page = await ensurePage()
      await clickByText(page, 'SOP', { exact: true })
      await sleep(500)
      page = await ensurePage()
      await clickByText(page, 'SOP 创作台')
      await sleep(700)
      page = await ensurePage()

      const hasStudio = await page.evaluate(() => {
        const t = document.body.innerText || ''
        return t.includes('SOP 创作台') && (t.includes('我的 SOP 库') || t.includes('新增'))
      })
      if (hasStudio) pass('L3 open 创作台')
      else fail('L3 open 创作台', 'panel text missing')

      // Open editor: prefer row「编辑」; fallback create via header menu
      page = await ensurePage()
      const opened = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
        const clickText = (needle) => {
          const nodes = Array.from(document.querySelectorAll('button'))
          const el = nodes.find((b) => ((b.textContent || '').replace(/\s+/g, ' ').trim()).includes(needle))
          if (!el) return false
          el.click()
          return true
        }
        if (clickText('编辑')) {
          await sleep(800)
          const t = document.body.innerText || ''
          if (t.includes('返回列表') && t.includes('保存')) return 'edit'
        }
        if (!clickText('新增')) return ''
        await sleep(200)
        if (!clickText('新建空白 SOP')) return ''
        await sleep(900)
        const t2 = document.body.innerText || ''
        return (t2.includes('返回列表') && t2.includes('保存')) ? 'create' : ''
      })
      if (opened) pass('L3 open editor', opened)
      else fail('L3 open editor', 'edit/create menu failed')

      if (opened) {
        page = await ensurePage()
        await clickByText(page, '返回列表')
        await sleep(500)
        page = await ensurePage()
      }

      // Mode switch back to scope
      await clickByText(page, '专家归属')
      await sleep(500)
      page = await ensurePage()
      const scopeOk = await page.evaluate(() => (document.body.innerText || '').includes('当前专家'))
      if (scopeOk) pass('L3 switch to 专家归属')
      else fail('L3 switch to 专家归属')
    } catch (e) {
      fail('L3 UI path', e.message || String(e))
    }
  } finally {
    try { browser.disconnect() } catch { /* ignore */ }
  }

  printSummary()
  process.exit(results.some((r) => !r.ok) ? 1 : 0)
}

function printSummary() {
  console.log('\n--- Summary ---')
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  }
  const ok = results.filter((r) => r.ok).length
  console.log(`\n${ok}/${results.length} passed`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
