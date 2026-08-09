export interface ResourceSummary {
  id: string
  name: string
  description?: string
  status?: string
  version?: string
  metadata?: Record<string, unknown>
}

export interface ModelSummary {
  id: string
  name: string
  model: string
  provider: string
  enabled: boolean
  isDefault: boolean
}
