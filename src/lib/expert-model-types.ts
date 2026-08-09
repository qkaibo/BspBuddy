// ExpertModelCatalog types — separate from user ModelConfig

export interface ExpertModelCatalogEntry {
  id: string
  tenant_id: string
  name: string
  provider: string
  api_protocol: string
  base_url: string | null
  api_key_masked: string
  model: string
  temperature: number
  max_output_tokens: number
  enabled: boolean
  is_default: boolean
  created_by_user_id: string
  created_at: string
  updated_at: string
}

export interface ExpertModelCatalogCreateParams {
  tenant_id?: string
  name: string
  provider?: string
  api_protocol?: string
  base_url?: string
  api_key: string
  model: string
  temperature?: number
  max_output_tokens?: number
  is_default?: boolean
}

export interface ExpertModelCatalogUpdateParams {
  tenant_id?: string
  name?: string
  base_url?: string
  api_key?: string
  model?: string
  temperature?: number
  max_output_tokens?: number
  enabled?: boolean
  is_default?: boolean
}
