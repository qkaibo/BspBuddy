// L2 test: expert chat via /api/chat/proxy/send with agent_id
// Verifies the fixed path (agent_id → model_for_agent → ExpertModelCatalog/fallback).
const axios = require('axios')

const BASE = 'http://127.0.0.1:52020'
const AGENT_ID = 'agent_1979a69222264971' // QCM4490 充电专家

async function main() {
  // 1. login
  const login = await axios.post(`${BASE}/api/auth/login`, {
    tenant_id: 'tenant_demo',
    username: 'admin',
    password: 'admin',
  })
  const token = login.data?.token
  if (!token) throw new Error('login failed: ' + JSON.stringify(login.data))
  console.log('LOGIN OK')

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const qs = 'tenant_id=tenant_demo'

  // 2. send chat turn through the proxy with agent_id only
  console.log('--- POST /api/chat/proxy/send with agent_id ---')
  const body = {
    agent_id: AGENT_ID,
    messages: [
      { role: 'system', content: '你是 QCM4490 充电专家。' },
      { role: 'user', content: '你好，简单介绍一下你自己' },
    ],
    temperature: 0.3,
    max_tokens: 512,
  }
  try {
    const res = await axios.post(`${BASE}/api/chat/proxy/send?${qs}`, body, { headers, timeout: 90000 })
    console.log('STATUS', res.status)
    console.log('MODEL', res.data.model)
    console.log('CONTENT', (res.data.content || '').slice(0, 200))
    console.log('PASS: expert chat through agent_id works')
  } catch (err) {
    console.log('STATUS', err.response?.status)
    console.log('DETAIL', JSON.stringify(err.response?.data || err.message).slice(0, 500))
    throw err
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
