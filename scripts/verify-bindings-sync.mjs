// L2: 验证本地绑定同步到后端 AgentResourceBinding
// 测试：RESOURCE_IMPORT → 后端可见 | RESOURCE_UNBIND → 后端移除
//
// 需要：FastAPI 后端运行中 + Electron 应用运行中（或单独测试后端 API）
// 用法选项：
//   A) node scripts/verify-bindings-sync.mjs <backend_url> <agent_id>
//   B) 先启动 Electron，脚本通过 CDP 连接到 9222 端口测试 IPC 层
import http from 'http'

// ── 配置 ──
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
  return new Promise((resolve, reject) => {
    const url = tenantUrl(path)
    const data = body ? JSON.stringify({ tenant_id: TENANT_ID, ...body }) : undefined
    const parsed = new URL(url)
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers,
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
    req.on('error', reject)
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
  console.log(`\n🔍 L2: 绑定同步验证\n   Backend: ${BACKEND_URL}\n`)

  // 1. Get available agents
  const agentsResp = await api('GET', '/api/chat/agents')
  if (agentsResp.status !== 200) {
    console.log(`  ⚠️  无法获取专家列表 (HTTP ${agentsResp.status}) — 后端可能未运行\n`)
    console.log('   跳过 API 测试。请先启动后端: cd backend && uvicorn app.main:app --reload\n')
    process.exit(0)
  }
  const agents = Array.isArray(agentsResp.data) ? agentsResp.data : []
  check('有可用的专家列表', agents.length > 0, `${agents.length} 个专家`)

  if (agents.length === 0) {
    console.log('\n  ❌ 无可用专家，无法继续测试\n')
    process.exit(1)
  }

  const testAgent = agents.find(a => a.name?.includes('充电')) || agents[0]
  console.log(`  测试专家: ${testAgent.name} (${testAgent.id})\n`)

  // 2. Get available general skills
  const skillsResp = await api('GET', '/api/enterprise/general-skills')
  check('获取通用技能列表', skillsResp.status === 200)
  const skills = Array.isArray(skillsResp.data) ? skillsResp.data : []

  if (skills.length === 0) {
    console.log('\n  ⚠️  无通用技能可用\n')
  } else {
    console.log(`  可选技能: ${skills.map(s => s.name).join(', ')}\n`)
  }

  // 3. Get current bindings for agent
  const beforeResp = await api('GET', `/api/enterprise/agents/${testAgent.id}/resources`)
  check('获取现有绑定', beforeResp.status === 200)
  const beforeBindings = Array.isArray(beforeResp.data) ? beforeResp.data : []
  const beforeSkillCount = beforeBindings.filter(b => b.resource_type === 'general_skill').length
  console.log(`  现有 general_skill 绑定: ${beforeSkillCount}\n`)

  if (skills.length === 0) {
    console.log('\n  ── 使用工具资源测试绑定 ──\n')
  }

  // 4. Find a resource to add (use a general_skill if available, otherwise a tool)
  // Get available tools
  const toolsResp = await api('GET', '/api/enterprise/tools')
  const tools = Array.isArray(toolsResp.data) ? toolsResp.data : []
  check('获取工具列表', toolsResp.status === 200, `${tools.length} 个工具`)

  let testResourceType
  let testResourceId
  let testResourceName

  if (skills.length > 0) {
    testResourceType = 'general_skill'
    testResourceId = skills[0].id
    testResourceName = skills[0].name
  } else if (tools.length > 0) {
    testResourceType = 'tool'
    testResourceId = tools[0].id
    testResourceName = tools[0].name
  } else {
    console.log('\n  ⚠️  无可用资源 (skill/tool)，无法测试绑定\n')
    console.log('\n  📊 结果:')
    console.log(`    通过: ${passed} | 失败: ${failed}`)
    process.exit(failed > 0 ? 1 : 0)
  }

  console.log(`  测试添加: ${testResourceType} / ${testResourceName} (${testResourceId})\n`)

  // 5. Build merged binding list (simulating syncAgentBindingsToBackend 'add')
  const existing = Array.isArray(beforeResp.data) ? beforeResp.data : []
  const typeList = existing
    .filter(r => r.resource_type === testResourceType)
    .map(r => ({ resource_type: r.resource_type, resource_id: r.resource_id, status: r.status }))

  const seen = new Set(typeList.map(r => r.resource_id))
  // Only add the test resource if not already bound
  if (!seen.has(testResourceId)) {
    typeList.push({ resource_type: testResourceType, resource_id: testResourceId, status: 'active' })
  }

  const otherTypes = existing
    .filter(r => r.resource_type !== testResourceType)
    .map(r => ({ resource_type: r.resource_type, resource_id: r.resource_id, status: r.status }))

  const merged = [...otherTypes, ...typeList]

  // 6. PUT updated bindings
  const putResp = await api('PUT', `/api/enterprise/agents/${testAgent.id}/resources`, {
    resources: merged,
  })
  check('PUT 更新绑定', putResp.status === 200, `HTTP ${putResp.status}`)

  // 7. Verify bindings after add
  const afterResp = await api('GET', `/api/enterprise/agents/${testAgent.id}/resources`)
  check('验证绑定已持久化', afterResp.status === 200)
  const afterBindings = Array.isArray(afterResp.data) ? afterResp.data : []
  const hasBinding = afterBindings.some(b => b.resource_type === testResourceType && b.resource_id === testResourceId)
  check(`绑定创建成功（${testResourceType}/${testResourceName}）`, hasBinding)
  const afterCount = afterBindings.filter(b => b.resource_type === testResourceType).length
  console.log(`  绑定后 ${testResourceType} 数量: ${afterCount}\n`)

  // 8. Unbind (remove) — simulate syncAgentBindingsToBackend 'remove'
  const removed = existing
    .filter(r => !(r.resource_type === testResourceType && r.resource_id === testResourceId))
    .map(r => ({ resource_type: r.resource_type, resource_id: r.resource_id, status: r.status }))

  const removeResp = await api('PUT', `/api/enterprise/agents/${testAgent.id}/resources`, {
    resources: removed,
  })
  check('PUT 移除绑定', removeResp.status === 200, `HTTP ${removeResp.status}`)

  // 9. Verify binding removed
  const finalResp = await api('GET', `/api/enterprise/agents/${testAgent.id}/resources`)
  check('验证绑定已移除', finalResp.status === 200)
  const finalBindings = Array.isArray(finalResp.data) ? finalResp.data : []
  const stillBound = finalBindings.some(b => b.resource_type === testResourceType && b.resource_id === testResourceId)
  check('绑定已删除', !stillBound)
  const finalCount = finalBindings.filter(b => b.resource_type === testResourceType).length
  console.log(`  最终 ${testResourceType} 数量: ${finalCount} (期望 < ${afterCount})\n`)

  // ── Summary ──
  console.log('📊 结果:')
  console.log(`  通过: ${passed} | 失败: ${failed}\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(`\n  ❌ 脚本异常: ${err.message}`)
  process.exit(1)
})
