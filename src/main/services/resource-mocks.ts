// TODO: replace with real API once FastAPI enterprise skills endpoints are stable
// Canonical SOP library seed now lives in sop-service.ts (SkillCard + lifecycle).
// These mocks remain for Knowledge / General Skills and legacy list shape fallbacks.

export interface MockResource {
  id: string
  name: string
  description?: string
  status: 'draft' | 'published' | 'archived'
  version?: string | number
  skill_id?: string
  skillId?: string
  business_domain?: string
  businessDomain?: string
  isOverall?: boolean
}

/** SOP skills — legacy summary shape; prefer sopService.list() */
export const MOCK_SOP_SKILLS: MockResource[] = [
  {
    id: 'sop-contract-review',
    name: '合同审核流程',
    skill_id: 'contract-review',
    skillId: 'contract-review',
    description: '法务合同条款审查、风险标注与修改建议',
    status: 'published',
    version: 2,
    business_domain: '法务',
    businessDomain: '法务',
    isOverall: true,
  },
  {
    id: 'sop-expense-approve',
    name: '报销审批流程',
    skill_id: 'expense-approve',
    skillId: 'expense-approve',
    description: '费用单据校验、额度核对与审批流转',
    status: 'published',
    version: 1,
    business_domain: '行政',
    businessDomain: '行政',
    isOverall: true,
  },
  {
    id: 'sop-code-review',
    name: '研发代码审查 SOP',
    skill_id: 'code-review',
    skillId: 'code-review',
    description: 'PR 规范性、安全与性能检查清单',
    status: 'published',
    version: 2,
    business_domain: '研发',
    businessDomain: '研发',
    isOverall: true,
  },
  {
    id: 'sop-meeting-notes',
    name: '会议纪要整理',
    skill_id: 'meeting-notes',
    skillId: 'meeting-notes',
    description: '录音/纪要结构化与待办提取',
    status: 'draft',
    version: 1,
    business_domain: '通用',
    businessDomain: '通用',
    isOverall: false,
  },
]

/** General skills — structure matches GET /api/enterprise/general-skills */
export const MOCK_GENERAL_SKILLS: MockResource[] = [
  {
    id: 'skill-web-search',
    name: '网页检索',
    skill_id: 'web-search',
    description: '按主题检索公开网页并摘要',
    status: 'published',
    version: '1.1',
  },
  {
    id: 'skill-spreadsheet',
    name: '表格分析',
    skill_id: 'spreadsheet-analyze',
    description: '读取 CSV/Excel 并生成洞察',
    status: 'published',
    version: '1.4',
  },
  {
    id: 'skill-doc-summary',
    name: '长文摘要',
    skill_id: 'doc-summary',
    description: '多文档摘要与要点对比',
    status: 'published',
    version: '1.0',
  },
]

/** Knowledge bases — structure matches GET /api/enterprise/knowledge-bases */
export const MOCK_KNOWLEDGE_BASES: MockResource[] = [
  {
    id: 'kb-hr-policy',
    name: '人事制度库',
    description: '考勤、假期、绩效相关制度文档',
    status: 'published',
    version: '1.0',
  },
  {
    id: 'kb-product-manual',
    name: '产品手册库',
    description: '产品功能说明与 FAQ',
    status: 'published',
    version: '2.3',
  },
  {
    id: 'kb-legal-templates',
    name: '法务模板库',
    description: '合同模板与审查要点',
    status: 'published',
    version: '1.5',
  },
]
