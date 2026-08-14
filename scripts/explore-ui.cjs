// Dump full body text after opening expert center
const puppeteer = require('puppeteer-core')

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null })
  const page = (await browser.pages())[0]
  await page.setViewport({ width: 1400, height: 900 })

  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const parent = btns.find((b) => (b.textContent || '').includes('专家·技能·连接器'))
    if (parent) parent.click()
  })
  await new Promise((r) => setTimeout(r, 600))
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const sub = btns.find((b) => (b.textContent || '').trim() === '专家中心')
    if (sub) sub.click()
  })
  await new Promise((r) => setTimeout(r, 2000))

  const text = await page.evaluate(() => document.body.innerText)
  console.log('BODY TEXT:')
  console.log(text.slice(0, 2000))
  await browser.disconnect()
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
