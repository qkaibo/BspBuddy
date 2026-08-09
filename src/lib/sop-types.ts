// ============================================================
// SOP skill library types (agents-003 / agents-002-sop)
// ============================================================

export type SopStatus = 'draft' | 'published' | 'archived'

export type SopNodeType = 'start' | 'process' | 'decision' | 'action' | 'end'

export interface SopNode {
  nodeId: string
  name: string
  type: SopNodeType
  condition?: string
  instruction: string
  expectedUserInfo?: Record<string, unknown>
  allowedActions?: string[]
}

export interface SopEdge {
  from: string
  to: string
  label?: string
}

export interface SkillCard {
  nodes: SopNode[]
  edges: SopEdge[]
  triggerIntents?: string[]
  interruptionPolicy?: Record<string, unknown>
}

export interface SopSkillSummary {
  id: string
  skillId: string
  name: string
  businessDomain?: string
  description?: string
  status: SopStatus
  version: number
  isOverall: boolean
  updatedAt: number
  /** Resource ACL — owner of this library row */
  ownerUserId?: string
  tenantId?: string
  /** FastAPI / legacy alias */
  skill_id?: string
  business_domain?: string
  owner_user_id?: string
  tenant_id?: string
}

export interface SopSkill extends SopSkillSummary {
  contentJson: SkillCard
  createdAt: number
  createdBy?: string
}

export interface SkillVersion {
  id: string
  skillId: string
  version: number
  contentJson: SkillCard
  createdAt: number
  createdBy?: string
}

export interface SopListParams {
  status?: SopStatus | 'all' | ''
  q?: string
}

export interface SopCreateParams {
  name?: string
  skillId?: string
  blank?: boolean
  businessDomain?: string
  description?: string
  contentJson?: SkillCard
}

export interface SopUpdateParams {
  name?: string
  businessDomain?: string
  description?: string
  contentJson?: SkillCard
  isOverall?: boolean
  /** MVP: free-text steps; service converts to SkillCard when contentJson omitted */
  stepsText?: string
}

export function emptySkillCard(): SkillCard {
  return {
    nodes: [
      { nodeId: 'start', name: '开始', type: 'start', instruction: '流程开始' },
      { nodeId: 'end', name: '结束', type: 'end', instruction: '流程结束' },
    ],
    edges: [{ from: 'start', to: 'end' }],
  }
}

/** Convert newline-separated steps into a linear SkillCard. */
export function skillCardFromStepsText(text: string): SkillCard {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, '').trim())
    .filter(Boolean)

  if (lines.length === 0) return emptySkillCard()

  const nodes: SopNode[] = [
    { nodeId: 'start', name: '开始', type: 'start', instruction: '流程开始' },
  ]
  const edges: SopEdge[] = []
  let prev = 'start'

  lines.forEach((line, i) => {
    const nodeId = `step-${i + 1}`
    nodes.push({
      nodeId,
      name: line.slice(0, 40),
      type: 'process',
      instruction: line,
    })
    edges.push({ from: prev, to: nodeId })
    prev = nodeId
  })

  nodes.push({ nodeId: 'end', name: '结束', type: 'end', instruction: '流程结束' })
  edges.push({ from: prev, to: 'end' })

  return { nodes, edges }
}

export function stepsTextFromSkillCard(card?: SkillCard | null): string {
  if (!card?.nodes?.length) return ''
  return card.nodes
    .filter((n) => n.type === 'process' || n.type === 'action' || n.type === 'decision')
    .map((n) => n.instruction || n.name)
    .join('\n')
}
