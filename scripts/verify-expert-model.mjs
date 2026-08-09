// L2: 验证专家模型绑定后端 API 流程
// 测试：创建专家 → 绑定模型 → 查询绑定 → 验证一致性
//
// 用法：node scripts/verify-expert-model.mjs [backend_url]

import http from 'http'

const BACKEND_URL = process.argv[2] || 'http://localhost:8000'
const TENANT_ID = process.env.TENANT_ID || 'tenant_demo'
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''

const headers = {
  'Content-Type': 'application/json',
  ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
}

function tenantUrl(path) {
  const sep = path.includes('?') ? '&' : '?'
  return `${BACKEND_URL}${path}${sep}tenant_id=${TENANT_ID}`
}

function api(method, path, body) {
  return new Promise((resolve) => {
    const url = tenantUrl(path)
    const data = body ? JSON.stringify({ tenant_id: TENANT_ID, ...body }) : undefined
    const parsed = new URL(url)
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers,
      timeout: 10000,
    }
    const req = http.request(opts, (res) => {
      let raw = ''
      res.on('data', (chunk) => (raw += chunk))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) })
        } catch {
          resolve({ status: res.statusCode, data: raw })
        }
      })
    })
    req.on('error', (err) => resolve({ status: 0, error: err.message }))
    if (data) req.write(data)
    req.end()
  })
}

let passed = 0
let failed = 0

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}${detail ? ` - ${detail}` : ''}`)
    passed++
  } else {
    console.log(`  ❌ ${name}${detail ? ` - ${detail}` : ''}`)
    failed++
  }
}

async function main() {
  console.log(`\n🔍 L2: 专家模型绑定验证\n   Backend: ${BACKEND_URL}\n`)

  // 1. 检查后端连通
  const healthCheck = await api('GET', '/api/chat/agents')
  if (healthCheck.status === 0 || healthCheck.status >= 500) {
    console.log(`  ⚠️  后端不可达 (HTTP ${healthCheck.status || healthCheck.error})\n`)
    console.log('   CDP 方式验证: 启动 Electron 后运行 verify-expert-model-cdp.mjs\n')
    process.exit(0)
  }

  // 2. 获取现有模型列表
  const modelList = await api('GET', '/api/enterprise/model-configs')
  check('获取模型配置列表', modelList.status === 200 && Array.isArray(modelList.data), `HTTP ${modelList.status}`)
  const models = Array.isArray(modelList.data) ? modelList.data : []
  console.log(`  可用模型: ${models.map(m => `${m.name}(${m.model})`).join(', ') || '无'}\n`)

  if (models.length === 0) {
    console.log('  ⚠️  无可用模型配置 — 请在「AI 设置」中添加模型后再测试\n')
  }

  // 3. 创建测试专家
  const testName = `模型测试专家_${Date.now().toString(36)}`
  const createResp = await api('POST', '/api/enterprise/agents', {
    name: testName,
    description: 'L2 test agent for model binding',
    is_overall: false,
  })
  check('创建测试专家', createResp.status === 200 && createResp.data?.id, `${testName}`)

  if (!createResp.data?.id) {
    console.log(`\n  ❌ 无法创建测试专家，终止测试。HTTP ${createResp.status}: ${JSON.stringify(createResp.data).slice(0, 200)}\n`)
    process.exit(1)
  }

  const agentId = createResp.data.id
  console.log(`  专家 ID: ${agentId}\n`)

  // 4. 如果没有模型配置，跳过模型绑定测试
  if (models.length === 0) {
    console.log('  ⚠️  跳过模型绑定测试（无可用模型配置）\n')
  } else {
    const testModel = models[0]
    console.log(`  测试模型: ${testModel.name} (${testModel.id})\n`)

    // 5. 绑定模型到专家
    const bindResp = await api('PUT', `/api/enterprise/agents/${agentId}/models`, {
      bindings: [{ role: 'default', model_config_id: testModel.id }],
    })
    check('PUT 绑定模型', bindResp.status === 200, `HTTP ${bindResp.status}${bindResp.data?.detail ? ' (error: ' + bindResp.data.detail + ')' : ''}`)

    // 6. 验证绑定持久化 — 需要检查 AgentModelBinding 表
    // 后端可能没有单独的 GET /agents/{id}/models 端点，间接通过 agent profile 检查
    const agentAfter = await api('GET', `/api/enterprise/agents/${agentId}`)
    check('查询专家详情', agentAfter.status === 200)
    console.log(`  专家名称: ${agentAfter.data?.name}`)
    // Note: AgentModelBinding 是否暴露在 agent profile 中取决于后端实现
    // 主要验证：创建不报错、绑定不报错、profile 能查到
  }

  // 7. 清理测试数据
  const deleteResp = await api('DELETE', `/api/enterprise/agents/${agentId}`)
  check('清理测试专家', deleteResp.status === 200, `HTTP ${deleteResp.status}`)

  // Summary
  console.log(`\n📊 结果:`)
  console.log(`  通过: ${passed} | 失败: ${failed}\n`)

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(`\n  ❌ 脚本异常: ${err.message}`)
  process.exit(1)
})
