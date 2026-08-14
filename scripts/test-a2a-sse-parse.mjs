import http from 'http'
import { StringDecoder } from 'string_decoder'

const base = 'http://127.0.0.1:52020'
const question = process.argv[2] || '用一句话介绍你自己是谁'

const login = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tenant_id: 'tenant_demo', username: 'admin', password: 'admin' }),
}).then((r) => r.json())

const agents = await fetch(`${base}/a2a/agents`, {
  headers: { Authorization: `Bearer ${login.token}` },
}).then((r) => r.json())
const list = agents.agents || agents
const card = list.find((x) => String(x.name || '').includes('4490'))
const aid = (card.url || '').split('/').pop()
console.log('agent', aid, card.name)

const body = JSON.stringify({
  message: { role: 'user', parts: [{ type: 'text', text: question }] },
})

const t0 = Date.now()
await new Promise((resolve, reject) => {
  const req = http.request(
    {
      hostname: '127.0.0.1',
      port: 52020,
      path: `/a2a/agents/${aid}/tasks`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${login.token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
    },
    (res) => {
      const dec = new StringDecoder('utf8')
      let buffer = ''
      let full = ''
      let parseFails = 0

      const handle = (payload) => {
        const data = payload.data && typeof payload.data === 'object' ? payload.data : payload
        const kind = String(data.kind || payload.event || '')
        if (kind === 'stream_delta' && typeof data.content === 'string') full += data.content
        if (kind === 'stream_replace' && typeof data.content === 'string') full = data.content
        if ((kind === 'complete' || payload.event === 'complete') && typeof data.reply === 'string' && data.reply) {
          full = data.reply
        }
      }

      const consume = () => {
        while (true) {
          const sep = buffer.indexOf('\n\n')
          if (sep < 0) break
          const raw = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          for (const line of raw.split('\n')) {
            const t = line.trim()
            if (!t.startsWith('data:')) continue
            const js = t.startsWith('data: ') ? t.slice(6) : t.slice(5).trimStart()
            if (!js || js === '[DONE]') continue
            try {
              handle(JSON.parse(js))
            } catch (e) {
              parseFails += 1
              console.warn('parse fail', e.message, js.slice(0, 100))
            }
          }
        }
      }

      res.on('data', (chunk) => {
        buffer += dec.write(chunk)
        consume()
      })
      res.on('end', () => {
        buffer += dec.end()
        consume()
        const text = full.trim()
        console.log('ELAPSED_S', ((Date.now() - t0) / 1000).toFixed(1))
        console.log('PARSE_FAILS', parseFails)
        console.log('CONTENT_LEN', text.length)
        console.log('SNIP', text.slice(0, 300))
        console.log('PASS', text.length > 20)
        resolve()
      })
      res.on('error', reject)
    },
  )
  req.on('error', reject)
  req.write(body)
  req.end()
})
