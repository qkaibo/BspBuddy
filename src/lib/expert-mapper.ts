// ============================================================
// Expert ↔ FastAPI AgentProfile mapper
// Maps between BspBuddy's Expert type and StaffDeck's AgentProfile schema.
// Bindings and BspBuddy-specific fields are stored in the metadata JSON column.
// ============================================================

import type { Expert, ExpertBindings, ExpertExample, ExpertStatus } from './expert-types'

/** Raw shape returned by FastAPI GET /api/chat/agents or /api/enterprise/agents */
export interface FastApiAgent {
  id: string
  name: string
  description: string | null
  persona_prompt: string | null
  is_overall: boolean
  status: string
  metadata: Record<string, unknown>
  resources?: unknown[]
  tenant_id?: string
  created_at?: string
  updated_at?: string
}

/** Shape sent to FastAPI POST/PUT /api/enterprise/agents */
export interface FastApiAgentRequest {
  name: string
  description?: string
  persona_prompt?: string
  is_overall?: boolean
  bindings?: ExpertBindings
  bspbuddy_status?: string
  metadata?: Record<string, unknown>
}

// ---------- Status mapping ----------

const BSPBUDDY_TO_STAFFDECK_STATUS: Record<string, string> = {
  online: 'active',
  offline: 'archived',
  draft: 'active',
}

const STAFFDECK_TO_BSPBUDDY_STATUS: Record<string, ExpertStatus> = {
  active: 'online',
  archived: 'offline',
}

// ---------- Bindings helpers ----------

function defaultBindings(): ExpertBindings {
  return {
    sopSkills: [],
    skills: [],
    mcpServers: [],
    knowledgeBases: [],
    connectors: [],
  }
}

function extractBindings(metadata: Record<string, unknown> | undefined): ExpertBindings {
  const raw = metadata?.bindings as Record<string, unknown> | undefined
  if (!raw || typeof raw !== 'object') return defaultBindings()
  return {
    sopSkills: Array.isArray(raw.sopSkills) ? (raw.sopSkills as string[]) : [],
    skills: Array.isArray(raw.skills) ? (raw.skills as string[]) : [],
    mcpServers: Array.isArray(raw.mcpServers) ? (raw.mcpServers as string[]) : [],
    knowledgeBases: Array.isArray(raw.knowledgeBases) ? (raw.knowledgeBases as string[]) : [],
    connectors: Array.isArray(raw.connectors) ? (raw.connectors as string[]) : [],
    modelId: raw.modelId as string | undefined,
    expertModelCatalogId: raw.expertModelCatalogId as string | undefined,
  }
}

function extractStatus(metadata: Record<string, unknown> | undefined, dbStatus: string): ExpertStatus {
  const bspStatus = metadata?.bspbuddy_status as string | undefined
  if (bspStatus === 'draft' || bspStatus === 'online' || bspStatus === 'offline') {
    return bspStatus
  }
  return STAFFDECK_TO_BSPBUDDY_STATUS[dbStatus] || 'online'
}

// ---------- Mapper functions ----------

/**
 * Map a FastAPI AgentProfile response to BspBuddy's Expert type.
 * BspBuddy-specific fields (title, methodology, etc.) are extracted from
 * the `metadata` JSON column.
 */
export function mapAgentToExpert(agent: FastApiAgent): Expert {
  const meta = agent.metadata || {}
  return {
    id: agent.id,
    name: agent.name,
    title: (meta.title as string) || '',
    description: agent.description || '',
    avatar: meta.avatar as string | undefined,
    persona: agent.persona_prompt || '',
    methodology: (meta.methodology as string) || '',
    toolChain: Array.isArray(meta.toolChain) ? (meta.toolChain as string[]) : [],
    skills: Array.isArray(meta.skills) ? (meta.skills as string[]) : [],
    categories: Array.isArray(meta.categories) ? (meta.categories as string[]) : [],
    examples: Array.isArray(meta.examples)
      ? (meta.examples as ExpertExample[])
      : [],
    isCustom: meta.isCustom === true,
    createdAt: (meta.createdAt as number) || undefined,
    updatedAt: (meta.updatedAt as number) || undefined,
    rating: (meta.rating as number) || undefined,
    usageCount: (meta.usageCount as number) || undefined,
    status: extractStatus(meta, agent.status),
    isOverall: agent.is_overall,
    bindings: extractBindings(meta),
  }
}

/**
 * Map BspBuddy's Expert type to a FastAPI create/update request body.
 * BspBuddy-specific fields are packed into `metadata` for persistence.
 */
export function mapExpertToAgentRequest(expert: Expert): FastApiAgentRequest {
  const metadata: Record<string, unknown> = {}
  if (expert.title) metadata.title = expert.title
  if (expert.methodology) metadata.methodology = expert.methodology
  if (Array.isArray(expert.toolChain) && expert.toolChain.length) metadata.toolChain = expert.toolChain
  if (Array.isArray(expert.skills) && expert.skills.length) metadata.skills = expert.skills
  if (Array.isArray(expert.categories) && expert.categories.length) metadata.categories = expert.categories
  if (Array.isArray(expert.examples) && expert.examples.length) metadata.examples = expert.examples
  if (expert.isCustom) metadata.isCustom = true
  if (expert.createdAt) metadata.createdAt = expert.createdAt
  if (expert.updatedAt) metadata.updatedAt = expert.updatedAt
  if (expert.rating !== undefined) metadata.rating = expert.rating
  if (expert.usageCount !== undefined) metadata.usageCount = expert.usageCount
  if (expert.avatar) metadata.avatar = expert.avatar

  return {
    name: expert.name,
    description: expert.description,
    persona_prompt: expert.persona,
    is_overall: expert.isOverall,
    bindings: expert.bindings,
    bspbuddy_status: expert.status,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  }
}

/**
 * Map a list of FastAPI agent responses to Expert array.
 */
export function mapAgentsToExperts(agents: FastApiAgent[]): Expert[] {
  if (!Array.isArray(agents)) return []
  return agents
    .filter((a): a is FastApiAgent => !!a && typeof a === 'object' && !!a.id)
    .map(mapAgentToExpert)
}
