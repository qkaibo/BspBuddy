import { aiService } from './ai'
import { orchestrator } from './orchestrator'
import { toolRegistry } from './tools/registry'
import { memoryService } from './memory-service'
import type { AgentMode, TaskPlan } from '../../lib/types'

const OFFICE_SYSTEM_PROMPT = `你是 BspBuddy，一个专业的办公助手。你帮助用户完成文档生成、数据处理、信息检索、报告撰写、PPT制作等办公任务。

## 核心能力
- 📄 Word 文档：撰写报告、方案、纪要、合同等
- 📊 Excel 表格：数据处理、分析、图表生成
- 📽️ PPT 演示：根据内容自动生成演示文稿
- 📑 PDF 处理：提取、分析、总结 PDF 内容
- 🌐 信息搜索：联网查询最新信息、资料
- 📁 文件管理：读写、整理本地文件

## 工作模式
当前模式: <mode_placeholder>
- **Craft 模式**: 直接执行任务，生成最终产物。自动规划步骤并执行。
- **Ask 模式**: 只回答问题，提供方案和建议，不执行任何工具操作。
- **Plan 模式**: 生成详细的任务计划，等待用户确认后才执行。

## 可用工具
<tools_placeholder>

<memory_placeholder>

## 响应规则
1. 当用户请求需要工具执行的办公任务时（如生成Word、分析Excel、制作PPT），Craft 模式下直接输出 plan 类型；Plan 模式下输出 plan 类型但标注待确认；Ask 模式下输出 chat 类型。
2. 纯问答、咨询、建议类问题，直接输出 chat 类型。
3. 步骤描述要用中文，清晰说明每一步做什么、为什么这么做。
4. 步骤间如有依赖关系，按正确顺序排列。
5. 生成文件时，默认保存到用户桌面或指定的工作空间。

## 响应格式
需要工具的任务:
\`\`\`json
{
  "type": "plan",
  "summary": "整体任务描述",
  "steps": [
    {
      "description": "读取销售数据Excel文件",
      "tool": "file_read",
      "params": { "filePath": "/path/to/sales.xlsx" }
    }
  ]
}
\`\`\`

纯对话:
\`\`\`json
{
  "type": "chat",
  "content": "你的回复内容"
}
\`\`\`
`

export class OfficeAgent {
  private abortController: AbortController | null = null

  async plan(userInput: string, mode: AgentMode): Promise<{
    type: 'plan' | 'chat'
    summary?: string
    steps?: Array<{ description: string; tool: string; params: Record<string, unknown> }>
    content?: string
  }> {
    this.abortController = new AbortController()

    const tools = toolRegistry.toFunctionDefinitions()
    const toolsJson = tools.map(t => `- **${t.name}**: ${t.description}`).join('\n')
    const modeText = mode === 'craft' ? 'Craft（直接执行）'
      : mode === 'plan' ? 'Plan（先生成计划，待用户确认后执行）'
      : 'Ask（仅回答问题和建议，不执行操作）'

    // Inject memory context
    const relevantMemories = memoryService.getContextForQuery(userInput, 10)
    const memoryContext = relevantMemories.length > 0
      ? memoryService.formatContext(relevantMemories)
      : '暂无用户记忆信息。随着更多对话，BspBuddy 将自动学习你的偏好和背景。'

    const systemPrompt = OFFICE_SYSTEM_PROMPT
      .replace('<mode_placeholder>', modeText)
      .replace('<tools_placeholder>', toolsJson)
      .replace('<memory_placeholder>', memoryContext)

    const modeHint = mode === 'ask'
      ? '（注意：当前是Ask模式，只需回答/建议，不要生成执行计划）'
      : mode === 'plan'
      ? '（注意：当前是Plan模式，请生成详细的步骤计划，标注"waiting_confirmation"状态）'
      : '（Craft模式，直接生成可执行计划）'

    try {
      const result = await aiService.plan(userInput + modeHint, tools)

      // Force chat mode in Ask mode
      if (mode === 'ask' && result.type === 'plan') {
        return {
          type: 'chat',
          content: `以下是我建议的执行计划：\n\n**目标**: ${result.summary}\n\n**步骤**:\n${(result.steps || []).map((s, i) => `${i + 1}. ${s.description}`).join('\n')}\n\n如有需要，请切换到 Craft 模式让我执行。`,
        }
      }

      return result
    } finally {
      this.abortController = null
    }
  }

  async executePlan(userIntent: string, steps: Array<{ description: string; tool: string; params: Record<string, unknown> }>): Promise<TaskPlan> {
    const plan = orchestrator.createPlan(userIntent, steps)

    this.abortController = new AbortController()

    try {
      const result = await orchestrator.execute(plan)
      return result
    } finally {
      this.abortController = null
    }
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
}

export const officeAgent = new OfficeAgent()
