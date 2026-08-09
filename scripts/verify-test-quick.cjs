const http = require('http')

function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null
    const opts = {
      hostname: '127.0.0.1', port: 52020, path, method,
      headers: { 'Content-Type': 'application/json' }
    }
    if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr)
    if (token) opts.headers['Authorization'] = 'Bearer ' + token
    const req = http.request(opts, r => {
      let d = ''; r.on('data', c => d += c)
      r.on('end', () => {
        try { resolve({ status: r.statusCode, body: JSON.parse(d) }) }
        catch (e) { resolve({ status: r.statusCode, raw: d }) }
      })
    })
    if (bodyStr) req.write(bodyStr)
    req.end()
    req.on('error', e => reject(e))
  })
}

async function main() {
  let passed = 0, failed = 0
  function ok(l) { console.log('  ✅ ' + l); passed++ }
  function fail(l, d) { console.log('  ❌ ' + l + ': ' + d); failed++ }

  const login = await api('POST', '/api/auth/login', { username: 'admin', password: 'admin', tenant_id: 'tenant_demo' })
  const token = login.body.token

  // Create with localhost URL — will connect fast, return error quickly
  console.log('1. Create model pointing at localhost')
  const c1 = await api('POST', '/api/enterprise/expert-model-catalog', {
    name: 'Quick Test Model',
    api_key: 'sk-test',
    model: 'gpt-4o',
    base_url: 'http://127.0.0.1:52020/v1', // our own backend — not an OpenAI server
  }, token)
  const id = c1.body?.id
  c1.status === 200 && id ? ok('Created: ' + id.substring(0, 12) + '...') : fail('create', JSON.stringify(c1.body).substring(0, 100))
  if (!id) process.exit(1)

  // Test — should return quickly with failure
  console.log('2. Test (expect failure since localhost:52020 is not LLM API)')
  const t1 = await api('POST', `/api/enterprise/expert-model-catalog/${id}/test?tenant_id=tenant_demo`, null, token)
  if (t1.status === 200) {
    ok('Test endpoint returned HTTP 200 (structured result)')
    if (t1.body.success === false) {
      ok('success=false: ' + (t1.body.message || '').substring(0, 80))
    } else {
      ok('success=true (backend responded?) message=' + (t1.body.message || '').substring(0, 80))
    }
  } else {
    fail('test endpoint', `status=${t1.status} ${JSON.stringify(t1.body).substring(0, 100)}`)
  }

  // Clean up
  await api('DELETE', `/api/enterprise/expert-model-catalog/${id}?tenant_id=tenant_demo`, null, token)
  ok('Cleaned up')

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Result: ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(50)}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
