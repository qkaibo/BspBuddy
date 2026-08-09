/**
 * L2 unit checks for auth/SOP ACL rules (no Electron required).
 * Mirrors canViewLibrary / canEdit / last-admin guards used in services.
 */

function isAdmin(actor) {
  return actor.roles.includes('admin')
}

function canViewLibrary(actor, skill) {
  if (skill.tenantId && skill.tenantId !== actor.tenantId) return false
  if (isAdmin(actor)) return true
  return skill.ownerUserId === actor.userId
}

function canEdit(actor, skill) {
  return canViewLibrary(actor, skill) && (isAdmin(actor) || skill.ownerUserId === actor.userId)
}

function countActiveAdmins(members, excludeUserId) {
  return members.filter(
    (m) => m.id !== excludeUserId && m.status === 'active' && m.roles.includes('admin'),
  ).length
}

const results = []
function pass(name, detail = '') {
  results.push({ ok: true })
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail = '') {
  results.push({ ok: false })
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`)
}

const admin = { tenantId: 'local', userId: 'u_admin', username: 'admin', roles: ['admin'] }
const zhang = { tenantId: 'local', userId: 'u_zhangsan', username: 'zhangsan', roles: ['member'] }
const lisi = { tenantId: 'local', userId: 'u_lisi', username: 'lisi', roles: ['member'] }

const zhangDraft = { id: 'sop-meeting-notes', ownerUserId: 'u_zhangsan', tenantId: 'local', status: 'draft' }
const lisiDraft = { id: 'sop-onboarding-lisi', ownerUserId: 'u_lisi', tenantId: 'local', status: 'draft' }
const square = { id: 'sop-contract-review', ownerUserId: 'u_admin', tenantId: 'local', status: 'published', isOverall: true }

console.log('=== auth ACL unit checks ===\n')

if (canViewLibrary(zhang, zhangDraft) && !canViewLibrary(zhang, lisiDraft)) {
  pass('member sees own draft only')
} else fail('member sees own draft only')

if (canViewLibrary(admin, lisiDraft) && canEdit(admin, lisiDraft)) {
  pass('admin can view/edit any library row (Phase 1)')
} else fail('admin can view/edit any library row (Phase 1)')

if (!canEdit(lisi, zhangDraft)) pass('member cannot edit others draft')
else fail('member cannot edit others draft')

if (!canViewLibrary(zhang, { ...lisiDraft, tenantId: 'other' })) {
  pass('cross-tenant blocked')
} else fail('cross-tenant blocked')

const members = [
  { id: 'u_admin', status: 'active', roles: ['admin'] },
  { id: 'u_zhangsan', status: 'active', roles: ['member'] },
]
if (countActiveAdmins(members, 'u_admin') === 0) pass('last admin guard detects sole admin')
else fail('last admin guard detects sole admin')

// square visibility: same tenant + published + overall (not owner-gated)
function squareVisible(actor, skill) {
  return (!skill.tenantId || skill.tenantId === actor.tenantId)
    && skill.status === 'published'
    && skill.isOverall
}
if (squareVisible(lisi, square) && !squareVisible(lisi, zhangDraft)) {
  pass('square list ignores owner for published overall')
} else fail('square list ignores owner for published overall')

const bad = results.filter((r) => !r.ok).length
console.log(`\n=== ${results.length - bad}/${results.length} passed ===`)
process.exit(bad ? 1 : 0)
