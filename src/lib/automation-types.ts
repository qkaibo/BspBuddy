// ============================================================
// Automation types — scheduled task models, logs, templates
// ============================================================

export interface AutomationTask {
  id: string
  name: string
  workspacePath: string
  prompt: string
  modelId: string
  skillIds: string[]
  schedule: AutomationSchedule
  pushToMiniProgram: boolean
  enabled: boolean
  status: AutomationTaskStatus
  stats: AutomationStats
  lastRunAt?: number
  createdAt: number
  updatedAt: number
}

export interface AutomationSchedule {
  cron: string
  frequency:
    | 'every-minute'
    | 'every-5min'
    | 'every-10min'
    | 'every-30min'
    | 'hourly'
    | 'every-6h'
    | 'every-12h'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'custom'
  startDate: string
  endDate?: string
  maxDurationMs: number
  maxConcurrency: number
}

export type AutomationTaskStatus = 'idle' | 'running' | 'error' | 'paused'

export interface AutomationStats {
  totalRuns: number
  successRuns: number
  failedRuns: number
  avgDuration: number
  totalCostTokens: number
}

export interface AutomationLog {
  id: string
  taskId: string
  taskName: string
  triggerTime: number
  startTime: number
  endTime?: number
  duration?: number
  status: AutomationLogStatus
  result: string
  files: string[]
  error?: string
  tokenCost?: number
}

export type AutomationLogStatus = 'success' | 'failed' | 'timeout' | 'cancelled'

export interface AutomationConfig {
  name: string
  workspacePath?: string
  prompt: string
  modelId: string
  skillIds: string[]
  schedule: {
    frequency: AutomationSchedule['frequency']
    cron?: string
    startDate: string
    endDate?: string
  }
  pushToMiniProgram: boolean
}

export interface AutomationTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: '推送' | '报告' | '提醒' | '学习'
  defaultConfig: Pick<AutomationConfig, 'prompt' | 'modelId' | 'skillIds' | 'schedule'>
  estimatedCost: 'low' | 'medium' | 'high'
  pushRecommend: boolean
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'template-news',
    name: '新闻推送',
    description: '每日 AI 新闻推送，汇总当日 AI 行业动态与重要进展',
    icon: 'newspaper',
    category: '推送',
    defaultConfig: {
      prompt:
        '请从以下来源搜索今日 AI 行业重要新闻：OpenAI、Google DeepMind、Anthropic、Meta AI、字节跳动豆包、百度文心等。\n要求：\n1. 列出 5-10 条今日/近日重要新闻\n2. 每条提供 2-3 句简要说明\n3. 标注信息来源\n4. 用中文输出，格式为 Markdown',
      modelId: 'deepseek-chat',
      skillIds: ['search-web'],
      schedule: {
        frequency: 'daily',
        cron: '0 9 * * *',
        startDate: new Date().toISOString().split('T')[0],
      },
    },
    estimatedCost: 'medium',
    pushRecommend: true,
  },
  {
    id: 'template-weekly',
    name: '周报生成',
    description: '自动汇总生成周报，包含本周完成、下周计划、风险与问题',
    icon: 'file-text',
    category: '报告',
    defaultConfig: {
      prompt:
        '请根据指定工作目录内的文件和日志生成本周周报。\n要求：\n1. 扫描工作目录内的文档、代码变更记录\n2. 汇总为「本周完成」「下周计划」「风险与问题」三部分\n3. 格式规范，Markdown 输出\n4. 文件保存为 weekly-report-{date}.md',
      modelId: 'hunyuan',
      skillIds: ['doc-read', 'doc-write'],
      schedule: {
        frequency: 'weekly',
        cron: '0 17 * * 5',
        startDate: new Date().toISOString().split('T')[0],
      },
    },
    estimatedCost: 'high',
    pushRecommend: true,
  },
  {
    id: 'template-health',
    name: '体检预约',
    description: '定期体检预约提醒和处理，帮助安排体检事宜',
    icon: 'heart',
    category: '提醒',
    defaultConfig: {
      prompt:
        '体检预约提醒任务：\n1. 检查近期是否有需要安排的体检\n2. 生成体检预约提醒消息\n3. 提醒内容包括：上次体检时间、建议间隔、附近体检机构推荐\n4. 生成提醒文件保存在工作目录',
      modelId: 'deepseek-chat',
      skillIds: [],
      schedule: {
        frequency: 'monthly',
        cron: '0 10 1 * *',
        startDate: new Date().toISOString().split('T')[0],
      },
    },
    estimatedCost: 'low',
    pushRecommend: true,
  },
  {
    id: 'template-learning',
    name: '学习计划',
    description: '学习计划定时推送和跟踪，帮助保持学习节奏',
    icon: 'book-open',
    category: '学习',
    defaultConfig: {
      prompt:
        '根据当前学习进度，生成下一阶段的学习计划：\n1. 回顾上周学习内容\n2. 推荐本周学习主题和资源\n3. 设定本周学习目标（具体可衡量）\n4. 生成学习计划 Markdown 文件',
      modelId: 'deepseek-chat',
      skillIds: ['search-web'],
      schedule: {
        frequency: 'weekly',
        cron: '0 8 * * 1',
        startDate: new Date().toISOString().split('T')[0],
      },
    },
    estimatedCost: 'medium',
    pushRecommend: true,
  },
]

export const SAFETY_RULES = {
  dangerousKeywords: ['删除', 'rm -rf', 'drop table', 'format', '清空', '覆盖写入', 'truncate', '永久删除'],
  sensitiveOperations: ['文件写入', '文件删除', '目录删除', '数据库操作', 'API 调用', '发送邮件'],
  warningMessage:
    '⚠️ 该任务包含文件写入/删除等危险操作。\n建议先以低频率试运行，确认结果符合预期后再放大调度频率。\n无人值守自动执行，请务必审慎设置 prompt。',
}

export const CONCURRENCY_LIMITS = {
  maxConcurrentTasks: 3,
  defaultMaxDurationMs: 30 * 60 * 1000,
  maxDurationMs: 2 * 60 * 60 * 1000,
  minIntervalMs: 60 * 1000,
} as const

export const COST_ESTIMATES: Record<string, { tokensPerRun: number; description: string }> = {
  low: { tokensPerRun: 500, description: '简单提醒类，消耗低' },
  medium: { tokensPerRun: 3000, description: '内容生成类，消耗中等' },
  high: { tokensPerRun: 15000, description: '代码巡检/文档汇总/连接器分析，消耗高' },
}
