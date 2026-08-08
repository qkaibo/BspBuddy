// ============================================================
// Expert types for BspBuddy
// ============================================================

// ---------- Expert lifecycle ----------
export type ExpertStatus = 'draft' | 'online' | 'offline'

// ---------- Expert bindings ----------
export interface ExpertBindings {
  sopSkills: string[]
  skills: string[]
  mcpServers: string[]
  knowledgeBases: string[]
  connectors: string[]
  modelId?: string
}

// ---------- Expert ----------
export interface Expert {
  id: string
  name: string
  title: string
  description: string
  avatar?: string
  persona: string
  methodology: string
  toolChain: string[]
  skills: string[]
  categories: string[]
  examples: ExpertExample[]
  isCustom: boolean
  createdAt?: number
  updatedAt?: number
  rating?: number
  usageCount?: number
  status: ExpertStatus
  isOverall: boolean
  bindings: ExpertBindings
}

export interface ExpertExample {
  title: string
  description: string
  prompt: string
  expectedOutput: string
}

// ---------- Expert Team ----------
export interface ExpertTeam {
  id: string
  name: string
  description: string
  lead: Expert
  members: ExpertTeamMember[]
  collaborationFlow: string
  categories: string[]
  examples: ExpertExample[]
  rating?: number
  usageCount?: number
}

export interface ExpertTeamMember {
  expert: Expert
  role: string
  responsibilities: string[]
}

// ---------- Expert Creation ----------
export interface ExpertCreationRequest {
  name: string
  title: string
  description: string
  persona: string
  methodology: string
  toolChain: string[]
  skills: string[]
  categories: string[]
}

// ---------- Expert Summon Result ----------
export interface ExpertSummonResult {
  success: boolean
  expert?: Expert
  sessionId?: string
  welcomeMessage?: string
  error?: string
}

// ---------- Expert Team Execution ----------
export interface ExpertTeamExecution {
  id: string
  teamId: string
  task: string
  status: 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed'
  plan?: ExpertTeamPlan
  results?: ExpertTeamResult[]
  progress?: number
}

export interface ExpertTeamPlan {
  steps: ExpertTeamStep[]
  leaderComment: string
}

export interface ExpertTeamStep {
  id: string
  assignee: string
  role: string
  description: string
  dependencies: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: string
}

export interface ExpertTeamResult {
  expertName: string
  role: string
  output: string
  artifacts?: string[]
}
