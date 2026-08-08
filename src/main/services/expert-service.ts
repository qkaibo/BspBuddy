// ============================================================
// Expert service — manages expert roles, teams, and summoning
// ============================================================

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import type { Expert, ExpertTeam, ExpertSummonResult, ExpertCreationRequest, ExpertTeamExecution, ExpertTeamPlan, ExpertTeamStep } from '../../lib/expert-types'

const BUILTIN_EXPERTS: Expert[] = [
  {
    id: 'expert-builtin-pm',
    name: 'PM',
    title: '项目管理专家',
    description: '帮助制定项目计划、分解任务、评估风险、协调资源',
    persona: '你是一位经验丰富的项目经理，拥有PMP认证，擅长敏捷和瀑布项目管理方法。分析问题时总是从风险、时间线和资源三个维度考虑。',
    methodology: '敏捷Scrum + 风险管理 + 利益相关者分析',
    toolChain: ['甘特图', 'WBS分解', '风险矩阵', '燃尽图'],
    skills: ['项目管理', '风险分析', '资源协调'],
    categories: ['management', 'planning'],
    examples: [
      { title: '制定项目计划', description: '为一个新功能开发制定2周迭代计划', prompt: '我需要为"用户权限管理"功能制定开发计划，团队3人，发布日期2周后', expectedOutput: '详细的任务分解、时间线、风险清单和资源分配建议' },
      { title: '项目复盘', description: '分析项目延期原因', prompt: '上周的项目交付延期了3天，帮我分析原因和改进措施', expectedOutput: '延期原因分析、改进建议和预防措施' },
    ],
    isCustom: false,
    status: 'online',
    isOverall: false,
    bindings: { sopSkills: [], skills: [], mcpServers: [], knowledgeBases: [], connectors: [] },
    rating: 4.8,
    usageCount: 15600,
  },
  {
    id: 'expert-builtin-data',
    name: '数据分析师',
    title: '数据分析专家',
    description: '数据清洗、统计分析、可视化报告和商业洞察',
    persona: '你是一位资深数据分析师，精通SQL、Python数据分析和BI工具。你善于从数据中发现趋势和异常，并提供可操作的商业建议。',
    methodology: 'CRISP-DM + 统计分析 + 可视化叙事',
    toolChain: ['Python Pandas', 'Matplotlib', 'SQL', 'Excel'],
    skills: ['数据分析', '统计建模', '可视化', '商业洞察'],
    categories: ['data', 'analytics'],
    examples: [
      { title: '销售数据分析', description: '分析季度销售数据并提供增长建议', prompt: '分析Q2销售数据，找出增长最快的产品线和区域', expectedOutput: '趋势分析报告、热力图和增长建议' },
    ],
    isCustom: false,
    status: 'online',
    isOverall: false,
    bindings: { sopSkills: [], skills: [], mcpServers: [], knowledgeBases: [], connectors: [] },
    rating: 4.6,
    usageCount: 12300,
  },
  {
    id: 'expert-builtin-writer',
    name: '文案写手',
    title: '专业写作专家',
    description: '撰写各类文案、报告、文章和营销材料',
    persona: '你是一位专业的内容创作者，曾在顶级媒体工作。你的文字简洁有力，善于根据受众和场景调整文风。',
    methodology: '受众分析 + 结构化写作 + 修改润色',
    toolChain: ['Markdown', '文档编辑', '素材库'],
    skills: ['文案写作', '报告撰写', '内容策划'],
    categories: ['writing', 'creative'],
    examples: [
      { title: '撰写周报', description: '根据本周工作自动生成周报', prompt: '帮我生成本周的周报，本周完成了用户登录模块开发、修复了3个线上bug、参与了产品需求评审', expectedOutput: '格式规范的周报文档' },
    ],
    isCustom: false,
    status: 'online',
    isOverall: false,
    bindings: { sopSkills: [], skills: [], mcpServers: [], knowledgeBases: [], connectors: [] },
    rating: 4.7,
    usageCount: 18900,
  },
  {
    id: 'expert-builtin-dev',
    name: '全栈开发',
    title: '全栈开发专家',
    description: '前端、后端、数据库、DevOps全栈开发支持',
    persona: '你是一位资深全栈工程师，精通TypeScript、React、Python、PostgreSQL。你注重代码质量、可维护性和性能优化。',
    methodology: 'TDD + 分层架构 + CI/CD',
    toolChain: ['Git', 'TypeScript', 'React', 'Python', 'Docker'],
    skills: ['前端开发', '后端开发', '数据库', 'DevOps'],
    categories: ['development', 'engineering'],
    examples: [
      { title: '代码审查', description: '审查代码并提供优化建议', prompt: '帮我审查这段API代码的安全性和性能', expectedOutput: '安全问题列表、性能瓶颈分析和改进建议' },
    ],
    isCustom: false,
    status: 'online',
    isOverall: false,
    bindings: { sopSkills: [], skills: [], mcpServers: [], knowledgeBases: [], connectors: [] },
    rating: 4.9,
    usageCount: 22100,
  },
]

const BUILTIN_TEAMS: ExpertTeam[] = [
  {
    id: 'team-builtin-market',
    name: '市场分析专家团',
    description: '由项目管理专家、数据分析师和文案写手组成的专家团，负责完整的市场分析任务',
    lead: BUILTIN_EXPERTS[0],
    members: [
      { expert: BUILTIN_EXPERTS[1], role: '数据分析', responsibilities: ['收集市场数据', '数据清洗分析', '生成分析报告'] },
      { expert: BUILTIN_EXPERTS[2], role: '报告撰写', responsibilities: ['整理分析结果', '撰写市场报告', '制作演示材料'] },
    ],
    collaborationFlow: '团长拆解任务 → 数据分析师采集和分析数据 → 文案写手汇总成报告 → 团长整合交付',
    categories: ['market', 'analysis'],
    examples: [
      { title: '市场调研报告', description: '对某个行业进行完整的市场分析', prompt: '帮我做一份2024年AI编程工具市场分析报告', expectedOutput: '完整的市场分析报告，包含竞争格局、市场规模、趋势预测' },
    ],
    rating: 4.5,
    usageCount: 8900,
  },
  {
    id: 'team-builtin-devops',
    name: '研发交付专家团',
    description: '全栈开发 + PM组成的研发交付团队',
    lead: BUILTIN_EXPERTS[3],
    members: [
      { expert: BUILTIN_EXPERTS[0], role: '项目管理', responsibilities: ['任务分解', '进度跟踪', '风险管理'] },
    ],
    collaborationFlow: 'PM分解需求 → 开发实现功能 → PM检查交付质量 → 团长最终审查',
    categories: ['development', 'delivery'],
    examples: [
      { title: '新功能交付', description: '从需求分析到代码交付', prompt: '帮我实现"数据导出"功能：支持Excel和CSV格式，包含筛选条件', expectedOutput: '完整的功能实现、测试用例和部署文档' },
    ],
    rating: 4.7,
    usageCount: 6700,
  },
]

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'experts')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getUserExpertsPath(): string {
  return path.join(getDataDir(), 'user-experts.json')
}

function loadUserExperts(): Expert[] {
  const p = getUserExpertsPath()
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as Expert[] } catch { return [] }
}

function saveUserExperts(experts: Expert[]): void {
  fs.writeFileSync(getUserExpertsPath(), JSON.stringify(experts, null, 2), 'utf-8')
}

export const expertService = {
  /** List all experts (builtin + user-created) */
  list(): Expert[] {
    return [...BUILTIN_EXPERTS, ...loadUserExperts()]
  },

  /** List all expert teams */
  listTeams(): ExpertTeam[] {
    return BUILTIN_TEAMS
  },

  /** Get a specific expert by ID */
  getExpert(id: string): Expert | undefined {
    return this.list().find((e) => e.id === id)
  },

  /** Summon an expert — returns session init data */
  summon(expertId: string): ExpertSummonResult {
    const expert = this.getExpert(expertId)
    if (!expert) return { success: false, error: `找不到专家: ${expertId}` }

    const sessionId = uuid()
    const welcomeMessage = `👋 你好！我是${expert.title}「${expert.name}」。\n\n我的专长：${expert.methodology}\n工具链：${expert.toolChain.join('、')}\n\n请描述你的任务，我将以专家身份为你提供专业支持。`

    return { success: true, expert, sessionId, welcomeMessage }
  },

  /** Execute a task with an expert team */
  startTeamExecution(teamId: string, task: string): { success: boolean; execution?: ExpertTeamExecution; error?: string } {
    const team = BUILTIN_TEAMS.find((t) => t.id === teamId)
    if (!team) return { success: false, error: `找不到专家团: ${teamId}` }

    const steps: ExpertTeamStep[] = [
      {
        id: uuid(),
        assignee: team.lead.name,
        role: '团长',
        description: `分析任务: "${task.slice(0, 50)}..." 并拆解为子任务`,
        dependencies: [],
        status: 'pending',
      },
      ...team.members.map((m, i) => ({
        id: uuid(),
        assignee: m.expert.name,
        role: m.role,
        description: `${m.role}: ${m.responsibilities[0] || '执行分配的专家任务'}`,
        dependencies: ['step-0'],
        status: 'pending' as const,
      })),
      {
        id: uuid(),
        assignee: team.lead.name,
        role: '团长',
        description: '整合所有成员的输出，形成完整交付物',
        dependencies: team.members.map((_, i) => `step-${i + 1}`),
        status: 'pending' as const,
      },
    ]

    // Attach real IDs to steps for dependency resolution
    const stepIds = steps.map((s) => s.id)
    steps.forEach((s, i) => {
      if (i === 0) s.id = `${teamId}-step-0`
      else if (i === steps.length - 1) s.id = `${teamId}-step-final`
      else s.id = `${teamId}-step-${i}`
    })

    steps.forEach((s) => {
      s.dependencies = s.dependencies.map((dep) => {
        if (dep === 'step-0') return `${teamId}-step-0`
        if (dep.startsWith('step-')) {
          const idx = parseInt(dep.split('-')[1], 10)
          return idx < steps.length - 1 ? `${teamId}-step-${idx}` : `${teamId}-step-final`
        }
        return dep
      })
    })

    const plan: ExpertTeamPlan = {
      steps,
      leaderComment: `任务"${task.slice(0, 30)}..."将由${team.name}协同完成。成员：${team.members.map((m) => `${m.expert.name}(${m.role})`).join('、')}`,
    }

    const execution: ExpertTeamExecution = {
      id: uuid(),
      teamId,
      task,
      status: 'planning',
      plan,
      progress: 0,
    }

    return { success: true, execution }
  },

  /** Create a custom expert */
  create(req: ExpertCreationRequest): ExpertSummonResult {
    const expert: Expert = {
      id: `expert-user-${uuid()}`,
      name: req.name,
      title: req.title,
      description: req.description,
      persona: req.persona,
      methodology: req.methodology,
      toolChain: req.toolChain,
      skills: req.skills,
      categories: req.categories,
      examples: [],
      isCustom: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      rating: 0,
      usageCount: 0,
      status: 'draft',
      isOverall: false,
      bindings: { sopSkills: [], skills: [], mcpServers: [], knowledgeBases: [], connectors: [] },
    }

    const userExperts = loadUserExperts()
    userExperts.push(expert)
    saveUserExperts(userExperts)

    return { success: true, expert, sessionId: uuid(), welcomeMessage: `自定义专家「${expert.name}」已创建成功！` }
  },

  /** Get experts by category */
  getByCategory(category: string): Expert[] {
    return this.list().filter((e) => e.categories.includes(category))
  },

  /** Update an existing expert */
  update(updated: Expert): ExpertSummonResult {
    const userExperts = loadUserExperts()
    const idx = userExperts.findIndex((e) => e.id === updated.id)
    if (idx === -1) return { success: false, error: `找不到专家: ${updated.id}` }

    userExperts[idx] = { ...updated, updatedAt: Date.now() }
    saveUserExperts(userExperts)
    return { success: true, expert: userExperts[idx] }
  },

  /** Delete a user-created expert */
  delete(id: string): { success: boolean; error?: string } {
    const userExperts = loadUserExperts()
    const idx = userExperts.findIndex((e) => e.id === id)
    if (idx === -1) return { success: false, error: `找不到专家: ${id}` }

    userExperts.splice(idx, 1)
    saveUserExperts(userExperts)
    return { success: true }
  },

  /** Toggle expert online/offline status */
  toggleStatus(id: string, status: Expert['status']): ExpertSummonResult {
    const userExperts = loadUserExperts()
    const idx = userExperts.findIndex((e) => e.id === id)
    if (idx === -1) return { success: false, error: `找不到专家: ${id}` }

    userExperts[idx] = { ...userExperts[idx], status, updatedAt: Date.now() }
    saveUserExperts(userExperts)
    return { success: true, expert: userExperts[idx] }
  },

  /** Toggle isOverall (publish/unpublish to square) */
  toggleOverall(id: string, isOverall: boolean): ExpertSummonResult {
    const userExperts = loadUserExperts()
    const idx = userExperts.findIndex((e) => e.id === id)
    if (idx === -1) return { success: false, error: `找不到专家: ${id}` }

    userExperts[idx] = { ...userExperts[idx], isOverall, updatedAt: Date.now() }
    saveUserExperts(userExperts)
    return { success: true, expert: userExperts[idx] }
  },

  /** List experts published to the square */
  squareList(): Expert[] {
    return this.list().filter((e) => e.isOverall && e.status === 'online')
  },

  /** Clone an expert from the square to the user's experts */
  clone(sourceId: string): ExpertSummonResult {
    const source = this.list().find((e) => e.id === sourceId)
    if (!source) return { success: false, error: `找不到专家: ${sourceId}` }

    const clone: Expert = {
      ...source,
      id: `expert-user-${uuid()}`,
      name: `${source.name} (副本)`,
      isCustom: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'draft',
      isOverall: false,
      rating: 0,
      usageCount: 0,
    }

    const userExperts = loadUserExperts()
    userExperts.push(clone)
    saveUserExperts(userExperts)
    return { success: true, expert: clone, sessionId: uuid(), welcomeMessage: `已复制专家「${source.name}」，可在管理 Tab 中编辑。` }
  },

  /** Test run — placeholder for now */
  testRun(_params: { persona: string; methodology: string; bindings: unknown; message: string }): { response: string } {
    return { response: `Test Run 已调用。\n\n人设: ${_params.persona.slice(0, 100)}...\n消息: ${_params.message}\n\n（完整 Agent Test Run 需要后端 AI 服务支持）` }
  },
}
