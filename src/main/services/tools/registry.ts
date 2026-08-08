import type { Tool, ToolResult, FunctionDefinition } from '../../../lib/types'

class ToolRegistry {
  private tools: Map<string, Tool> = new Map()

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  list(): Tool[] {
    return Array.from(this.tools.values())
  }

  async execute(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { success: false, error: `Tool not found: ${name}` }
    }

    try {
      return await tool.execute(params)
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  toFunctionDefinitions(): FunctionDefinition[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          tool.parameters.map((p) => [
            p.name,
            {
              type: p.type,
              description: p.description,
            },
          ])
        ),
        required: tool.parameters.filter((p) => p.required).map((p) => p.name),
      },
    }))
  }
}

export const toolRegistry = new ToolRegistry()
