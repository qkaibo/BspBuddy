// L2: IPC 层验证 SKILL_UPDATE 流程
// 测试：创建 → 编辑 → 读取完整性
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = resolve(__dirname, '..')
const require = createRequire(import.meta.url)

const { ipcMain, app } = require('electron')

let authService
let skillService

async function setup() {
  // Load services by importing from built source
  const authMod = await import(`file://${resolve(root, 'src/main/services/auth-service.ts')}`)
  authService = authMod.authService

  // Ensure session is loaded
  authService.ensureLoaded()

  // Re-import skill-service to use fresh auth context
  const skillMod = await import(`file://${resolve(root, 'src/main/services/skill-service.ts')}`)
  skillService = skillMod.skillService
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

async function run() {
  console.log('=== L2: SKILL_UPDATE 验证 ===\n')

  // Simulate app paths if not in Electron context
  if (typeof process !== 'undefined' && !process.type) {
    // Running standalone; use temp dir
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    const { mkdirSync, existsSync } = await import('fs')
    const dir = join(tmpdir(), 'bspbuddy-test-skills', 'skills', 'per-user')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    // NOTE: skill-service uses app.getPath('userData') — this won't work standalone
    console.log('  ⚠️  非 Electron 环境，部分测试需要 npm run dev 中验证')
    return
  }

  // --- In Electron context ---
  try {
    await setup()
  } catch (e) {
    console.log(`  ❌ 服务加载失败: ${e.message}`)
    failed++
    return
  }

  const actor = authService.getActor()
  const userId = actor?.userId

  console.log(`  当前用户: ${userId || '(未登录)'}\n`)

  if (!userId) {
    check('登录状态', false, '未登录，无法继续')
    return
  }

  // 1. Create a test skill
  console.log('--- 1. 创建测试技能 ---')
  const createResult = skillService.create('测试技能：根据输入生成报告摘要', userId)
  check('创建成功', createResult.success, createResult.skill?.name)
  check('创建后 ownerUserId 正确', createResult.skill?.ownerUserId === userId)

  const testSkillId = createResult.skill?.id
  check('技能 ID 已生成', !!testSkillId, testSkillId)
  check('初始 name 为描述截断', createResult.skill?.name === '测试技能：根据输入生成报告摘要')

  if (!testSkillId) return

  // 2. List and verify
  console.log('\n--- 2. 列表验证 ---')
  const list1 = skillService.list(userId)
  const found1 = list1.find(s => s.id === testSkillId)
  check('列表中可找到新技能', !!found1)
  check('builtin技能仍然存在', list1.some(s => s.source === 'builtin'))

  // 3. Update name
  console.log('\n--- 3. 修改名称 ---')
  const update1 = skillService.update(testSkillId, { name: '报告摘要生成器' }, userId)
  check('名称更新成功', update1.success)
  check('name 已变为新值', update1.skill?.name === '报告摘要生成器')

  // 4. Update description
  console.log('\n--- 4. 修改描述 ---')
  const update2 = skillService.update(testSkillId, { description: '输入文本后自动生成结构化摘要' }, userId)
  check('描述更新成功', update2.success)
  check('description 已更新', update2.skill?.description === '输入文本后自动生成结构化摘要')

  // 5. Update multiple fields
  console.log('\n--- 5. 批量修改 ---')
  const update3 = skillService.update(testSkillId, {
    category: 'nlp',
    version: '1.2.0',
    scriptContent: 'def run(input): return {"summary": input["text"][:100]}',
    permissions: [
      { type: 'file-read', description: '读取文件', granted: true },
      { type: 'network', description: '访问网络', granted: true },
      { type: 'python', description: 'Python 执行', granted: true },
    ],
  }, userId)
  check('批量更新成功', update3.success)
  check('category 已更新', update3.skill?.category === 'nlp')
  check('version 已更新', update3.skill?.version === '1.2.0')
  check('scriptContent 已更新', update3.skill?.scriptContent === 'def run(input): return {"summary": input["text"][:100]}')
  check('permissions 数量正确', update3.skill?.permissions?.length === 3)
  check('permissions 包含 file-read', update3.skill?.permissions?.some(p => p.type === 'file-read'))
  check('permissions 包含 network', update3.skill?.permissions?.some(p => p.type === 'network'))

  // 6. Remove permissions
  console.log('\n--- 6. 修改权限 ---')
  const update4 = skillService.update(testSkillId, {
    permissions: [
      { type: 'network', description: '访问网络', granted: true },
    ],
  }, userId)
  check('权限缩减成功', update4.success)
  check('permissions 变为 1 条', update4.skill?.permissions?.length === 1)
  check('仅剩 network 权限', update4.skill?.permissions?.[0]?.type === 'network')

  // 7. Re-read and verify persistence
  console.log('\n--- 7. 持久化验证 ---')
  const list2 = skillService.list(userId)
  const found2 = list2.find(s => s.id === testSkillId)
  check('重读后技能仍存在', !!found2)
  check('重读 name 一致', found2?.name === '报告摘要生成器')
  check('重读 description 一致', found2?.description === '输入文本后自动生成结构化摘要')
  check('重读 category 一致', found2?.category === 'nlp')
  check('重读 version 一致', found2?.version === '1.2.0')
  check('重读 scriptContent 一致', found2?.scriptContent === 'def run(input): return {"summary": input["text"][:100]}')
  check('重读 permissions 一致', found2?.permissions?.length === 1)

  // 8. Partial update (only name, preserve others)
  console.log('\n--- 8. 部分字段更新 ---')
  const update5 = skillService.update(testSkillId, { name: '摘要助手' }, userId)
  check('部分更新成功', update5.success)
  check('name 更新为摘要助手', update5.skill?.name === '摘要助手')
  check('description 不变', update5.skill?.description === '输入文本后自动生成结构化摘要')
  check('permissions 不变', update5.skill?.permissions?.length === 1)

  // 9. Update non-existent skill
  console.log('\n--- 9. 非存在技能 ---')
  const updateNonexistent = skillService.update('skill-nonexistent-12345', { name: '不存在' }, userId)
  check('不存在的技能返回失败', !updateNonexistent.success)
  check('错误信息包含权限提示', updateNonexistent.error?.includes('不存在'))

  // 10. Correct ownerUserId preserved
  console.log('\n--- 10. ownerUserId 保持 ---')
  const list3 = skillService.list(userId)
  const found3 = list3.find(s => s.id === testSkillId)
  // ownerUserId is on StoredSkill but not exposed in Skill type
  // Verify by ensuring no other user can see it
  check('技能在列表中', !!found3)

  // 11. Another user can NOT see this skill
  console.log('\n--- 11. 用户隔离 ---')
  const otherUserList = skillService.list('other-user-999')
  const foundOther = otherUserList.find(s => s.id === testSkillId)
  check('其他用户看不到我的技能', !foundOther)
  const allBuiltins = otherUserList.filter(s => s.source === 'builtin')
  check('但能看到 builtin 技能', allBuiltins.length > 0)

  // Cleanup
  console.log('\n--- 清理 ---')
  skillService.uninstall(testSkillId, userId)
  const list4 = skillService.list(userId)
  check('清理成功（技能已删除）', !list4.find(s => s.id === testSkillId))

  console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`)
}

run().catch(e => {
  console.error('验证异常:', e)
  process.exit(1)
})
