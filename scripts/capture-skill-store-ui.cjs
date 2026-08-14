// Navigate to Skill Store and capture screenshots via Electron CDP
const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

async function sleep(ms) { await new Promise((r) => setTimeout(r, ms)) }

async function clickByText(page, text, exact = false) {
  const ok = await page.evaluate((t, exactMatch) => {
    const nodes = [...document.querySelectorAll('button, a, [role="button"], span, div')]
    const el = nodes.find((n) => {
      const s = (n.textContent || '').replace(/\s+/g, ' ').trim()
      if (exactMatch) return s === t
      return s.includes(t)
    })
    if (!el) return false
    el.click()
    return true
  }, text, exact)
  return ok
}

async function main() {
  const outDir = path.join(__dirname)
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null })
  const pages = await browser.pages()
  const page = pages.find((p) => (p.url() || '').includes('localhost') || (p.url() || '').includes('5173')) || pages[0]
  console.log('page url', page.url(), 'title', await page.title())
  await page.setViewport({ width: 1440, height: 900 })
  await sleep(800)

  // Open plugins via sidebar submenu
  let clicked = await clickByText(page, '专家·技能·连接器')
  console.log('parent menu', clicked)
  await sleep(400)
  clicked = await clickByText(page, '技能与插件', true)
  if (!clicked) clicked = await clickByText(page, '技能与插件')
  console.log('plugins', clicked)
  await sleep(1000)

  clicked = await clickByText(page, '技能商店', true)
  console.log('skill-store tab', clicked)
  await sleep(1500)

  const body = await page.evaluate(() => document.body.innerText.slice(0, 2500))
  console.log('BODY:\n', body)

  const shot1 = path.join(outDir, 'ui-skill-store-browse.png')
  await page.screenshot({ path: shot1, fullPage: false })
  console.log('saved', shot1)

  // Open first skill card if present
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('button.bb-card')]
    if (cards[0]) cards[0].click()
  })
  await sleep(800)
  const shot2 = path.join(outDir, 'ui-skill-store-detail.png')
  await page.screenshot({ path: shot2, fullPage: false })
  console.log('saved', shot2)

  await browser.disconnect()
}

main().catch((e) => { console.error('ERR', e); process.exit(1) })
