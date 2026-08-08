# 19 — 专家配置管理 (StaffDeck 融合)

> 对应文档: `docs/prd/prd-016-expert-management.md`
> 来源: StaffDeck `prd-001 数字员工管理` + `prd-014 开放广场`
> Status: 🟡 开发中 | 分支: `feature/expert-management`

## 功能概要

在保留现有 WorkBuddy 式专家使用体验的基础上，引入 StaffDeck 的专家生命周期管理能力。用户在 BspBuddy 中既能「使用专家」完成任务，也能「管理专家」创建/编辑/配置/发布。

核心变化：
- ExpertCenter 从纯使用面板升级为「使用 + 管理」双模式
- Expert 数据模型从标签字符串升级为资源绑定（SOP/知识库/MCP/模型）
- 新增广场功能：发布专家供他人复制使用

## 一、与现有 Plan 06 的关系

Plan 06 覆盖插件/Skill/MCP/Expert 的**使用侧**（浏览、安装、召唤）。Plan 19 覆盖**管理侧**（创建、编辑、绑定、发布）。两者共享数据，在 ExpertCenter 同一个面板内通过 Tab 切换。

| 维度 | Plan 06 (不改) | Plan 19 (新增) |
|------|---------------|----------------|
| 入口 | ExpertCenter | 同一个 ExpertCenter |
| Tab | 使用 Tab | 管理 Tab |
| 角色 | 用户（使用专家） | 用户作为创建者（管理专家） |
| 核心操作 | 浏览→召唤→对话 | 创建→编辑→绑定→上线→发布 |
| Skill/MCP | 面板内安装管理 | 专家编辑弹窗内引用绑定 |

## 二、改动范围

```
受到影响:
  src/components/ExpertCenter.tsx    ← 重构：拆为 使用/管理 双 Tab
  src/lib/expert-types.ts            ← 扩展：status / isOverall / bindings
  src/components/Sidebar.tsx         ← 微调：「更多」菜单加邮箱+反馈入口
  src/renderer/App.tsx               ← 微调：ViewType 加 'feedback'
  docs/plans/README.md               ← 已更新

新增:
  docs/prd/prd-016-expert-management.md     ← PRD 文档
  docs/README.md                            ← 文档索引
  docs/CONTEXT.md                           ← 领域术语表
  src/components/ExpertEditorModal.tsx      ← 专家编辑弹窗（左侧Tab+右侧编辑区）
  src/components/ExpertSquare.tsx           ← 广场浏览（使用Tab的子Tab）
  src/components/FeedbackPanel.tsx          ← 反馈看板
  src/lib/feedback-types.ts                 ← 反馈类型定义
  src/main/services/feedback.ts             ← 反馈服务
```

## 三、实现任务

### 19-1 数据模型扩展 (`src/lib/expert-types.ts`)

扩展现有 `Expert` 接口，新增字段：

```typescript
interface Expert {
  // ... 现有字段不动 ...
  
  // 生命周期
  status: 'draft' | 'online' | 'offline'
  isOverall: boolean          // 是否发布到广场
  
  // 资源绑定
  bindings: {
    sopSkills: string[]
    skills: string[]
    mcpServers: string[]
    knowledgeBases: string[]
    connectors: string[]
    modelId?: string
  }
}
```

### 19-2 ExpertCenter 重构 (`src/components/ExpertCenter.tsx`)

```
现状: 3 个 Tab — 专家 / 专家团 / 我的专家(简单表单)
改造: 2 个顶层 Tab — [使用] / [管理]

[使用] Tab（保留现有逻辑，不动）:
  ├── 子Tab: 我的专家 / 专家团 / 广场(新增)
  ├── 专家卡片浏览 + 召唤
  └── 专家团浏览 + 执行

[管理] Tab（全新）:
  ├── 我的专家列表（带状态筛选）
  ├── + 新建专家
  ├── 卡片操作：编辑 / 上线 / 下线 / 发布广场 / 删除
  └── 点击编辑 → 打开 ExpertEditorModal
```

### 19-3 专家编辑弹窗 (`src/components/ExpertEditorModal.tsx`)

左侧 Tab 导航 + 右侧编辑区：

```
Tab: 基础信息 / 人设 / SOP技能 / Skill / MCP / 知识库 / 连接器 / 模型

底部: [Test Run] [取消] [保存草稿] [上线]
```

Test Run：弹窗内展开对话区域，用当前配置测试效果。

### 19-4 广场 (`src/components/ExpertSquare.tsx`)

- 子 Tab（放在 使用 Tab 内）
- 搜索 + 分类筛选
- 专家卡片 + 详情抽屉（前后导航）
- [复制到我] → 创建独立副本（技能/知识库建立分支关系）
- 数据源：`expert:square-list`（isOverall=true）

### 19-5 侧边栏微调 (`src/components/Sidebar.tsx`)

「更多」菜单新增两项：

```
更多 ▼
├── 资料库
├── 灵感
├── 邮箱      ← 从隐藏提升
└── 反馈      ← 新增
```

ViewType 新增 `'feedback'`，App.tsx 渲染 FeedbackPanel。

### 19-6 反馈系统 (`src/components/FeedbackPanel.tsx`)

独立的反馈看板页面（第一版可先做简单统计，后续完善 6 桶分析）：

- 好评率 / 差评率 / 反馈总数
- 按专家/技能维度拆分
- 消息气泡赞/踩（互斥）在 ChatPanel 内实现

### 19-7 IPC 通道

```typescript
// 专家管理（新增）
EXPERT_UPDATE: 'expert:update'
EXPERT_DELETE: 'expert:delete'
EXPERT_TOGGLE_STATUS: 'expert:toggle-status'
EXPERT_TOGGLE_OVERALL: 'expert:toggle-overall'
EXPERT_SQUARE_LIST: 'expert:square-list'
EXPERT_CLONE: 'expert:clone'
EXPERT_TEST_RUN: 'expert:test-run'

// SOP 技能（新增）
SOP_LIST: 'sop:list'
SOP_CREATE: 'sop:create'
SOP_DELETE: 'sop:delete'

// 知识库（新增）
KNOWLEDGE_LIST: 'knowledge:list'
KNOWLEDGE_CREATE: 'knowledge:create'
KNOWLEDGE_DELETE: 'knowledge:delete'

// 反馈（新增）
FEEDBACK_SUMMARY: 'feedback:summary'
FEEDBACK_LIST: 'feedback:list'
```

## 四、分期实施

| 批次 | 内容 | 提交信息 |
|:---:|------|------|
| 1 | `expert-types.ts` 数据模型扩展 | `docs: add prd-016 & extend expert data model` |
| 2 | ExpertCenter 重构：使用/管理双 Tab 布局 | `feat: restructure ExpertCenter with use/manage tabs` |
| 3 | ExpertEditorModal（基础信息+人设+技能绑定+模型+Test Run） | `feat: add expert editor with bindings & test run` |
| 4 | ExpertSquare（广场浏览+复制） | `feat: add expert square for browsing public agents` |
| 5 | 侧边栏微调（邮箱+反馈入口） + 反馈系统基础 | `feat: add mailbox & feedback entry in sidebar` |

后续迭代：
- SOP 蒸馏编辑器（`docs/tech-spec/ts-025`）→ 提升 PluginPanel 技能 Tab
- 知识库管理（OKF）→ PluginPanel 新 Tab 或 资料库扩充

## 五、验收标准

- [ ] 管理 Tab 可查看/筛选/新建/编辑/删除专家
- [ ] 专家编辑弹窗可绑定 SOP/Skill/MCP/知识库/连接器/模型
- [ ] Test Run 可测试当前配置的对话效果
- [ ] 上线后专家出现在使用 Tab，可召唤使用
- [ ] 广场可浏览并复制他人公开的专家
- [ ] 使用 Tab 保持现有 WorkBuddy 体验不变
- [ ] 侧边栏「更多」可进入邮箱和反馈页面
