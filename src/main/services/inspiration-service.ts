// ============================================================
// Inspiration (灵感) service — curated showcase cases, favorites, fork
// ============================================================

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { InspirationCase, InspirationPreset, FavoriteItem, InspirationCategory } from '../../lib/plugin-types'

// ========== 灵感案例库 ==========

const BUILTIN_CASES: InspirationCase[] = [
  // ---- 文档办公 ----
  {
    id: 'inspo-doc-001',
    category: 'document',
    title: '自动生成项目周报',
    description: '输入本周工作要点，AI 自动生成格式规范、重点突出的项目周报，包含本周完成、下周计划、风险与问题三大板块。',
    tags: ['周报', '文档', '自动化'],
    toolsUsed: ['文档处理套件', '文案写手'],
    skillIds: ['plugin-builtin-doc'],
    expertId: 'expert-builtin-writer',
    expertName: '文案写手',
    prompt: '帮我生成本周的周报。本周完成了：\n1. 【填写本周完成的工作】\n\n下周计划：\n2. 【填写下周计划】\n\n遇到的困难/风险：\n3. 【填写风险或问题】',
    favoriteCount: 2580,
    createdAt: 1704000000000,
    featured: true,
  },
  {
    id: 'inspo-doc-002',
    category: 'document',
    title: '会议纪要智能整理',
    description: '上传会议录音转文字或粘贴会议记录，AI 帮你提炼关键决策、行动项和责任人，生成标准会议纪要。',
    tags: ['会议纪要', '效率', '文档'],
    toolsUsed: ['文档处理套件'],
    skillIds: ['plugin-builtin-doc'],
    prompt: '请根据以下会议记录整理出一份标准的会议纪要，包含：会议主题、参会人员、讨论要点、决策事项、行动项（含责任人和截止日期）。\n\n会议记录：\n【粘贴或上传会议记录】',
    favoriteCount: 1920,
    createdAt: 1705000000000,
  },
  {
    id: 'inspo-doc-003',
    category: 'document',
    title: 'PPT 一键生成',
    description: '只需提供大纲和要点，AI 自动生成结构清晰、排版美观的 PPT 演示文稿。',
    tags: ['PPT', '演示', '设计'],
    toolsUsed: ['文档处理套件'],
    skillIds: ['plugin-builtin-doc'],
    prompt: '请帮我生成一份 PPT，主题是：【填写主题】\n\n大纲：\n1. 封面页\n2. 背景介绍\n3. 核心内容（3-5页）\n4. 数据展示\n5. 总结与下一步\n\n风格要求：简洁商务风',
    favoriteCount: 3450,
    createdAt: 1706000000000,
    featured: true,
  },

  // ---- 数据分析 ----
  {
    id: 'inspo-data-001',
    category: 'data',
    title: '销售数据深度分析',
    description: '导入销售数据表格，让数据分析专家帮你挖掘趋势、识别异常、生成可视化报告和商业建议。',
    tags: ['销售', '分析', '可视化'],
    toolsUsed: ['文档处理套件', '智能搜索'],
    skillIds: ['plugin-builtin-doc', 'plugin-builtin-search'],
    expertId: 'expert-builtin-data',
    expertName: '数据分析师',
    prompt: '请分析我提供的销售数据，输出以下内容：\n1. 整体趋势概览\n2. 各产品线/区域的对比分析\n3. 异常数据识别\n4. 增长机会建议\n\n数据文件：【附上数据】',
    favoriteCount: 4210,
    createdAt: 1707000000000,
    featured: true,
  },
  {
    id: 'inspo-data-002',
    category: 'data',
    title: '竞品市场调研报告',
    description: 'AI 搜索竞品信息，自动整理成完整的市场调研报告，包含竞争格局、功能对比、优劣势分析。',
    tags: ['市场调研', '竞品分析', '报告'],
    toolsUsed: ['智能搜索', '文档处理套件'],
    skillIds: ['plugin-builtin-search', 'plugin-builtin-doc'],
    expertId: 'expert-builtin-data',
    expertName: '数据分析师',
    prompt: '请帮我做一份竞品分析报告，分析对象是：【填写竞品名称】\n\n分析维度：\n1. 产品定位和核心功能\n2. 定价策略\n3. 用户评价和口碑\n4. 优势劣势对比\n5. 对我们的启示和建议',
    favoriteCount: 1870,
    createdAt: 1708000000000,
  },
  {
    id: 'inspo-data-003',
    category: 'data',
    title: 'Excel 自动化报表',
    description: '描述你的报表需求，AI 自动生成包含公式、图表和数据透视表的 Excel 报表模板。',
    tags: ['Excel', '报表', '自动化'],
    toolsUsed: ['文档处理套件'],
    skillIds: ['plugin-builtin-doc'],
    prompt: '请帮我创建一个 Excel 报表，用途是：【填写报表用途】\n\n包含以下内容：\n1. 数据汇总表\n2. 按【维度】分类的数据透视表\n3. 趋势折线图\n4. 占比饼图\n\n数据如下：\n【粘贴或上传数据】',
    favoriteCount: 2980,
    createdAt: 1709000000000,
    featured: true,
  },

  // ---- 代码开发 ----
  {
    id: 'inspo-dev-001',
    category: 'development',
    title: 'RESTful API 快速搭建',
    description: '描述你的 API 需求，全栈开发专家帮你生成完整的后端 API 代码，包含路由、控制器、验证和数据层。',
    tags: ['API', '后端', '全栈'],
    toolsUsed: ['终端增强'],
    skillIds: ['plugin-builtin-terminal'],
    expertId: 'expert-builtin-dev',
    expertName: '全栈开发',
    prompt: '请帮我搭建一个 RESTful API，技术栈：【填写技术栈，如 Node.js + Express + PostgreSQL】\n\n功能需求：\n1. 用户注册/登录（JWT 认证）\n2. CRUD 操作 — 资源名：【填写】\n3. 分页查询\n4. 数据校验\n\n请生成完整的项目结构和代码。',
    favoriteCount: 5100,
    createdAt: 1710000000000,
    featured: true,
  },
  {
    id: 'inspo-dev-002',
    category: 'development',
    title: 'React 组件库搭建',
    description: '从零搭建企业级 React 组件库，包含组件开发模板、Storybook、测试框架和打包配置。',
    tags: ['React', '组件库', '前端'],
    toolsUsed: ['终端增强'],
    skillIds: ['plugin-builtin-terminal'],
    expertId: 'expert-builtin-dev',
    expertName: '全栈开发',
    prompt: '请帮我搭建一个 React 组件库项目，要求：\n1. 使用 TypeScript\n2. 配置 Rollup/Vite 打包\n3. 集成 Storybook\n4. 配置 ESLint + Prettier\n5. 包含一个示例 Button 组件\n6. 单元测试框架',
    favoriteCount: 3760,
    createdAt: 1711000000000,
    featured: true,
  },
  {
    id: 'inspo-dev-003',
    category: 'development',
    title: 'Python 数据处理脚本',
    description: '编写 Python 脚本批量处理文件：格式转换、数据清洗、批量重命名，提高日常工作效率。',
    tags: ['Python', '脚本', '自动化'],
    toolsUsed: ['终端增强'],
    skillIds: ['plugin-builtin-terminal'],
    prompt: '请帮我写一个 Python 脚本，功能是：【填写需求】\n\n要求：\n1. 支持文件夹批量处理\n2. 错误处理和日志记录\n3. 命令行参数支持\n4. 进度显示',
    favoriteCount: 2340,
    createdAt: 1712000000000,
  },

  // ---- 创意设计 ----
  {
    id: 'inspo-creative-001',
    category: 'creative',
    title: '品牌宣传文案一稿多版',
    description: '输入产品/品牌信息，AI 生成适配不同平台的宣传文案：朋友圈、公众号、小红书、抖音口播等。',
    tags: ['文案', '营销', '多平台'],
    toolsUsed: ['文档处理套件'],
    skillIds: ['plugin-builtin-doc'],
    expertId: 'expert-builtin-writer',
    expertName: '文案写手',
    prompt: '请为以下产品/品牌生成多平台宣传文案：\n产品：【填写产品名称和简介】\n\n请分别为以下平台各生成一版：\n1. 朋友圈（短小精炼，适合社交分享）\n2. 微信公众号（深度长文风格）\n3. 小红书（活泼种草风格）\n4. 抖音口播脚本（口语化，15-30秒）',
    favoriteCount: 3120,
    createdAt: 1713000000000,
    featured: true,
  },
  {
    id: 'inspo-creative-002',
    category: 'creative',
    title: '活动策划方案生成',
    description: '只需描述活动目标和预算，AI 生成完整的活动策划方案，包含流程设计、物料清单、风险预案。',
    tags: ['活动策划', '方案', '创意'],
    toolsUsed: ['文档处理套件'],
    skillIds: ['plugin-builtin-doc'],
    expertId: 'expert-builtin-pm',
    expertName: 'PM',
    prompt: '请帮我策划一场活动：\n活动类型：【团建/发布会/年会/促销】\n预算：【填写预算范围】\n参与人数：【填写人数】\n目标：【填写活动目标】\n\n请输出完整的活动策划方案。',
    favoriteCount: 1650,
    createdAt: 1714000000000,
  },

  // ---- 学习研究 ----
  {
    id: 'inspo-learn-001',
    category: 'learning',
    title: '技术学习路线规划',
    description: '想学新技术但不知从何下手？AI 为你定制学习路线图，包含阶段目标、推荐资源和实战项目。',
    tags: ['学习', '路线图', '技能'],
    toolsUsed: ['智能搜索'],
    skillIds: ['plugin-builtin-search'],
    prompt: '我想学习：【填写技术/技能名称】\n\n背景：\n- 当前水平：【初学者/有一定基础/进阶】\n- 每天可用时间：【X小时】\n- 学习目标：【填写目标，如找到相关工作/完成个人项目】\n\n请制定一份详细的学习路线图。',
    favoriteCount: 4870,
    createdAt: 1715000000000,
    featured: true,
  },
  {
    id: 'inspo-learn-002',
    category: 'learning',
    title: '论文阅读总结 + 翻译',
    description: '上传外文论文 PDF，AI 帮你提取核心观点、研究方法和关键结论，同时支持中英对照翻译。',
    tags: ['论文', '总结', '翻译'],
    toolsUsed: ['文档处理套件', '智能搜索'],
    skillIds: ['plugin-builtin-doc', 'plugin-builtin-search'],
    prompt: '请帮我总结这篇论文，输出：\n1. 论文核心观点（3-5句话）\n2. 研究方法概述\n3. 关键发现和结论\n4. 对相关领域的启示\n\n论文内容：【粘贴或上传】',
    favoriteCount: 2780,
    createdAt: 1716000000000,
  },

  // ---- 效率工具 ----
  {
    id: 'inspo-prod-001',
    category: 'productivity',
    title: '邮件智能分类与回复',
    description: 'AI 自动分析邮件内容、判断紧急程度，并生成专业得体的回复草稿，大幅提升邮件处理效率。',
    tags: ['邮件', '效率', '自动化'],
    toolsUsed: ['文档处理套件'],
    skillIds: ['plugin-builtin-doc'],
    expertId: 'expert-builtin-writer',
    expertName: '文案写手',
    prompt: '请帮我处理以下邮件：\n\n邮件内容：\n【粘贴邮件原文】\n\n请完成：\n1. 判断邮件类型和紧急程度\n2. 提取关键信息\n3. 生成一封专业的回复草稿',
    favoriteCount: 1560,
    createdAt: 1717000000000,
  },
  {
    id: 'inspo-prod-002',
    category: 'productivity',
    title: '多文件格式批量转换',
    description: '一键将多个文件在不同格式间批量转换：Word → PDF、Excel → CSV、Markdown → HTML 等。',
    tags: ['文件转换', '批量', '效率'],
    toolsUsed: ['文档处理套件'],
    skillIds: ['plugin-builtin-doc'],
    prompt: '请帮我把【输入文件路径】中的文件从【原格式】批量转换为【目标格式】。\n\n要求：\n1. 保持原有文件名\n2. 输出到【指定目录】\n3. 转换完成后生成转换报告',
    favoriteCount: 1230,
    createdAt: 1718000000000,
  },
  {
    id: 'inspo-prod-003',
    category: 'productivity',
    title: '工作日报/周报/月报一键生成',
    description: '简单描述你的工作内容，AI 自动生成日报、周报或月报，格式专业，重点突出。',
    tags: ['日报', '周报', '月报'],
    toolsUsed: ['文档处理套件'],
    skillIds: ['plugin-builtin-doc'],
    expertId: 'expert-builtin-writer',
    expertName: '文案写手',
    prompt: '请帮我生成一份【日报/周报/月报】：\n\n工作内容：\n【简要描述完成的工作】\n\n遇到的问题和解决方案：\n【描述】\n\n下阶段计划：\n【描述】',
    favoriteCount: 3890,
    createdAt: 1719000000000,
    featured: true,
  },

  // ---- 生活娱乐 ----
  {
    id: 'inspo-life-001',
    category: 'lifestyle',
    title: '旅行攻略智能规划',
    description: '输入目的地、预算和偏好，AI 帮你规划行程、推荐景点美食、安排交通住宿，生成专属旅行攻略。',
    tags: ['旅行', '攻略', '规划'],
    toolsUsed: ['智能搜索', '文档处理套件'],
    skillIds: ['plugin-builtin-search', 'plugin-builtin-doc'],
    prompt: '请帮我规划一趟旅行：\n目的地：【填写城市/国家】\n出行天数：【X天X晚】\n预算：【填写预算范围】\n偏好：【美食/人文/自然/购物】\n\n请输出详细行程规划，包含每日安排、景点推荐、美食推荐和预算分配。',
    favoriteCount: 5210,
    createdAt: 1720000000000,
    featured: true,
  },
  {
    id: 'inspo-life-002',
    category: 'lifestyle',
    title: '健康饮食计划制定',
    description: '根据你的身体数据、饮食偏好和健康目标，AI 定制一周的健康饮食计划和购物清单。',
    tags: ['健康', '饮食', '计划'],
    toolsUsed: ['智能搜索'],
    skillIds: ['plugin-builtin-search'],
    prompt: '请帮我制定一份一周健康饮食计划：\n个人情况：\n- 身高/体重：【填写】\n- 健康目标：【减脂/增肌/保持】\n- 饮食偏好/忌口：【填写】\n- 每天做饭时间：【X分钟】\n\n请输出每日三餐安排、食谱和购物清单。',
    favoriteCount: 2340,
    createdAt: 1721000000000,
  },
  {
    id: 'inspo-life-003',
    category: 'lifestyle',
    title: '个人年度总结与新年计划',
    description: '回顾过去一年的收获与成长，AI 帮你梳理亮点、总结经验，并制定新一年的目标和行动计划。',
    tags: ['总结', '计划', '成长'],
    toolsUsed: ['文档处理套件'],
    skillIds: ['plugin-builtin-doc'],
    expertId: 'expert-builtin-writer',
    expertName: '文案写手',
    prompt: '请帮我写一份个人年度总结与新年计划：\n\n过去一年回顾：\n- 工作/学习上的收获：【填写】\n- 个人成长：【填写】\n- 遗憾/不足：【填写】\n\n新一年的目标：\n- 工作/事业：【填写】\n- 学习/技能：【填写】\n- 生活/健康：【填写】\n\n请写一篇温暖有力量感的年度总结。',
    favoriteCount: 1780,
    createdAt: 1722000000000,
  },
]

// ========== 持久化存储 ==========

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'inspiration')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getFavoritesPath(): string {
  return path.join(getDataDir(), 'favorites.json')
}

function loadFavorites(): FavoriteItem[] {
  const p = getFavoritesPath()
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as FavoriteItem[] } catch { return [] }
}

function saveFavorites(favorites: FavoriteItem[]): void {
  fs.writeFileSync(getFavoritesPath(), JSON.stringify(favorites, null, 2), 'utf-8')
}

// ========== Service ==========

export const inspirationService = {
  /** 获取灵感案例列表，支持按分类筛选和搜索 */
  list(opts?: { category?: InspirationCategory; search?: string; featured?: boolean }): InspirationCase[] {
    let cases = [...BUILTIN_CASES]

    if (opts?.category) {
      cases = cases.filter((c) => c.category === opts.category)
    }
    if (opts?.search) {
      const q = opts.search.toLowerCase()
      cases = cases.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    if (opts?.featured) {
      cases = cases.filter((c) => c.featured)
    }

    return cases
  },

  /** 获取案例详情 */
  getDetail(caseId: string): InspirationCase | undefined {
    return BUILTIN_CASES.find((c) => c.id === caseId)
  },

  /** 按分类分组获取案例 */
  getByCategory(): Record<InspirationCategory, InspirationCase[]> {
    const result: Record<string, InspirationCase[]> = {}
    for (const c of BUILTIN_CASES) {
      if (!result[c.category]) result[c.category] = []
      result[c.category].push(c)
    }
    return result as Record<InspirationCategory, InspirationCase[]>
  },

  /** 获取精选热门案例（随机 N 个 featured 案例，不够则用普通案例补充） */
  getFeatured(count = 6): InspirationCase[] {
    const featured = BUILTIN_CASES.filter((c) => c.featured)
    if (featured.length >= count) {
      // 随机选取
      const shuffled = [...featured].sort(() => Math.random() - 0.5)
      return shuffled.slice(0, count)
    }
    const remaining = count - featured.length
    const normal = BUILTIN_CASES.filter((c) => !c.featured).sort(() => Math.random() - 0.5)
    return [...featured, ...normal.slice(0, remaining)]
  },

  /** 收藏/取消收藏案例 */
  toggleFavorite(caseId: string): { favorited: boolean; favorites: FavoriteItem[] } {
    const favs = loadFavorites()
    const idx = favs.findIndex((f) => f.caseId === caseId)
    if (idx >= 0) {
      favs.splice(idx, 1)
      saveFavorites(favs)
      return { favorited: false, favorites: favs }
    }
    favs.push({ caseId, favoritedAt: Date.now() })
    saveFavorites(favs)
    return { favorited: true, favorites: favs }
  },

  /** 检查案例是否已收藏 */
  isFavorited(caseId: string): boolean {
    return loadFavorites().some((f) => f.caseId === caseId)
  },

  /** 获取收藏列表 */
  getFavorites(): InspirationCase[] {
    const favs = loadFavorites()
    const favIds = new Set(favs.map((f) => f.caseId))
    return BUILTIN_CASES.filter((c) => favIds.has(c.id))
  },

  /** 做同款：根据案例生成预设 */
  fork(caseId: string): { success: boolean; preset?: InspirationPreset; error?: string } {
    const c = BUILTIN_CASES.find((c) => c.id === caseId)
    if (!c) return { success: false, error: `找不到灵感案例: ${caseId}` }

    const preset: InspirationPreset = {
      caseId: c.id,
      prompt: c.prompt,
      skillIds: c.skillIds,
      expertId: c.expertId,
      previewUrl: c.previewUrl,
    }

    return { success: true, preset }
  },
}
