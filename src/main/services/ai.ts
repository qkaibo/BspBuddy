/**
 * @deprecated  Phase 2: LLM calls now go through backend proxy /api/chat/proxy/send.
 * This local AIService is kept only as a fallback for when the backend is unavailable.
 */
import type { FunctionDefinition } from '../../lib/types'
import OpenAI from 'openai'

interface AIConfig {
  apiKey: string
  baseUrl?: string
  model?: string
}

const DEFAULT_CONFIG: AIConfig = {
  apiKey: process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || '',
  baseUrl: process.env.OPENAI_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.openai.com/v1',
  model: process.env.AI_MODEL || 'gpt-4o',
}

const SYSTEM_PROMPT = `You are BspBuddy, a powerful AI desktop assistant. Your job is to understand user requests and decompose them into concrete, executable steps using the available tools.

## Rules
1. ALWAYS respond with a structured task plan when a task involves file operations, data processing, web search, or document generation.
2. For simple conversations or questions, respond naturally without calling tools.
3. Steps should be ordered correctly — if step B depends on step A's output, list A first.
4. Each step maps to exactly ONE tool. Choose the most appropriate tool.
5. Be specific in step descriptions — explain what the step does and why.

## Available tools
<tools_placeholder>

## Response format for tasks
When the user requests a task that needs tool execution, respond with a JSON plan:

\`\`\`json
{
  "type": "plan",
  "summary": "Brief description of overall goal",
  "steps": [
    {
      "description": "Read the sales Excel file",
      "tool": "excel_read",
      "params": { "filePath": "sales.xlsx" }
    }
  ]
}
\`\`\`

For simple responses (no tools needed), respond with:
\`\`\`json
{
  "type": "chat",
  "content": "Your natural language response"
}
\`\`\`
`

export class AIService {
  private client: OpenAI
  private model: string

  constructor(config: Partial<AIConfig> = {}) {
    const merged = { ...DEFAULT_CONFIG, ...config }
    this.client = new OpenAI({
      apiKey: merged.apiKey,
      baseURL: merged.baseUrl,
      timeout: 30000, // 30s timeout to avoid hanging
      maxRetries: 1,
    })
    this.model = merged.model || 'gpt-4o'
  }

  async plan(userInput: string, tools: FunctionDefinition[], memoryContext?: string): Promise<{
    type: 'plan' | 'chat'
    summary?: string
    steps?: Array<{ description: string; tool: string; params: Record<string, unknown> }>
    content?: string
  }> {
    const toolsJson = JSON.stringify(tools, null, 2)
    const systemPrompt = SYSTEM_PROMPT.replace('<tools_placeholder>', toolsJson)

    try {
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ]
      if (memoryContext) {
        messages.push({ role: 'system', content: memoryContext })
      }
      messages.push({ role: 'user', content: userInput })

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: 4096,
      })

      const text = response.choices[0]?.message?.content || ''

      // Try to extract JSON from ```json code fences
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim())
          return parsed
        } catch {
          // JSON parse failed (likely unescaped newlines inside content string).
          // Fall through to extract content manually.
        }
        // Try to extract just the "content" field value
        const contentMatch = jsonMatch[1].match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/)
        if (contentMatch) {
          const content = contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
          return { type: 'chat' as const, content }
        }
        return { type: 'chat' as const, content: text }
      }

      // No JSON fences — try raw parse, fallback to plain text
      try {
        const parsed = JSON.parse(text.trim())
        return parsed
      } catch {
        return { type: 'chat' as const, content: text }
      }
    } catch (err) {
      console.error('[AIService.plan] API call failed:', err)
      const status = (err as any)?.status ? ` (HTTP ${(err as any).status})` : ''
      const code = (err as any)?.code ? ` [${(err as any).code}]` : ''
      const message = err instanceof Error ? err.message : JSON.stringify(err)
      return {
        type: 'chat',
        content: `模型调用失败${status}${code}: ${message}`,
      }
    }
  }

  async functionCall(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    tools: FunctionDefinition[],
  ): Promise<{
    content: string | null
    toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>
  }> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters as Record<string, unknown>,
        },
      })),
      tool_choice: 'auto',
      temperature: 0.3,
    })

    const choice = response.choices[0]?.message
    const toolCalls = (choice?.tool_calls || []).map((tc) => ({
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }))

    return {
      content: choice?.content || null,
      toolCalls,
    }
  }
}

export const aiService = new AIService()
