// L3: precise leaf-based QCM4490 card click + chat
const puppeteer = require('puppeteer-core')

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null })
  const page = (await browser.pages())[0]
  await page.setViewport({ width: 1400, height: 900 })

  // ensure expert center visible
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const sub = btns.find((b) => (b.textContent || '').trim() === '专家中心')
    if (sub) sub.click()
  })
  await sleep(2500)

  // find the QCM4490 leaf text node and click it (event bubbles to card)
  const hit = await page.evaluate(() => {
    const leaves = [...document.querySelectorAll('*')].filter((n) => {
      if (n.childElementCount !== 0) return false
      const t = (n.textContent || '').trim()
      if (!t.includes('QCM4490')) return false
      const r = n.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
    if (!leaves.length) return { ok: false, count: 0 }
    const leaf = leaves[0]
    // climb to card ancestor (a few levels up)
    let card = leaf
    for (let i = 0; i < 4; i++) {
      if (card.parentElement) card = card.parentElement
    }
    card.click()
    return { ok: true, leaf: leaf.tagName, cardText: (card.textContent || '').trim().slice(0, 60) }
  })
  console.log('HIT:', JSON.stringify(hit))
  await sleep(3500)

  const v = await page.evaluate(() => document.body.innerText)
  const summoned = v.includes('QCM4490') && v.includes('充电专家') && v.includes('请描述你的任务')
  console.log('SUMMONED:', summoned ? 'YES' : 'CHECK')
  console.log('TAIL:', JSON.stringify(v.slice(-200)))

  const typed = await page.evaluate(() => {
    const ta = document.querySelector('textarea')
    if (!ta) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, '你好，介绍一下你自己')
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })
  console.log('TYPED:', typed)
  await sleep(400)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const send = btns.find((b) => (b.getAttribute('aria-label') || '').includes('发送')) || btns.find((b) => (b.textContent || '').includes('发送'))
    if (send) send.click()
  })
  console.log('SEND CLICKED')

  for (let i = 0; i < 55; i++) {
    await sleep(2000)
    const state = await page.evaluate(() => {
      const t = document.body.innerText
      const lines = t.split('\n').filter((l) => l.trim())
      const tail = lines.slice(-8).join(' | ').slice(0, 200)
      return { hasError: t.includes('模型调用失败') || t.includes('Connection error'), tail }
    })
    if (state.hasError) {
      console.log(`[${i}] FAIL: ${state.tail}`)
      await browser.disconnect()
      process.exit(1)
    }
    if (state.tail.includes('QCM4490') && !state.tail.includes('Thinking') && state.tail.includes('熟悉') || (state.tail.includes('我是') && state.tail.includes('QCM4490'))) {
      console.log(`[${i}] PASS: ${state.tail}`)
      await browser.disconnect()
      process.exit(0)
    }
  }
  console.log('TIMEOUT')
  await browser.disconnect()
  process.exit(1)
}
main().catch((e) => { console.error('CDP FAILED:', e.message); process.exit(1) })
