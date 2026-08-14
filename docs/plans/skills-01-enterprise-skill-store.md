---
id: skills-01
title: 企业技能商店与 Agent Runtime — 实现计划
type: plan
related: [skills-001, skills-002, skills-003, skills-001-api, skills-002-api, skills-003-runtime, agents-002]
---

# skills-01 — 企业技能商店与 Agent Runtime

> 对应 PRD: `skills-001` / `skills-002` / `skills-003`  
> Tech Spec: `skills-001-api` / `skills-002-api` / `skills-003-runtime`  
> 对照: `docs/reference/skills-hub-capability-inventory.md`  
> Status: ✅ Phase A–E 已落地（含轻量排行榜）；延期项见 Phase D/E 备注 | 分支: 待创建 `feat/skills-01-enterprise-store`

## 功能概要

把 Skills Hub 可借鉴能力落到 BspBuddy：

1. 租户技能商店（发现 / 详情 / 导入升版 / 我的技能）
2. L1–L3 访问分级与申请审批
3. 一键安装指令 + runtime 壳协议（Cursor + BspBuddy）
4. 轻量技能热度排行（下载 / 调用 / 收藏）

**不做：** Panda 币、抽奖、评论、安全扫描引擎、外部 SkillHub 联邦。

## 与现有组件关系

```
已有:
  general_skills 表 + import*/publish/run API
  GeneralSkillRunner（read/execute）
  agents-002 SkillsPanel（装到专家）
  agents-004 Agent Loop 调 general_skill.*

本计划新增:
  商店 UI + library + revisions
  access 门禁模块 + grants
  runtime / install-prompt / agent-rules mdc
  SkillInstallPanel
```

用户主路径：

```
SkillStore 发现 → 详情 → [加入我的技能] → agents-002 装专家
                 → [一键安装] → 复制指令 → Cursor 写壳
                 → L3 拦截 → 申请 → 作者批准 → 重试
```

## 一、改动范围（总览）

```
新增:
  backend/app/general_skills/access.py
  backend/app/general_skills/runtime.py
  backend/app/general_skills/shortcut.py
  backend/app/api/agent_rules.py
  backend/skills/agent-rules/bspbuddy-skills.mdc
  backend/skills/agent-rules/bspbuddy-skills.bootstrap.mdc
  backend/app/db/migrations/...（或 SQLModel create）
  src/components/SkillStorePanel.tsx
  src/components/SkillDetailDrawer.tsx
  src/components/SkillInstallPanel.tsx
  src/components/SkillAccessRequestDialog.tsx
  src/components/SkillAccessAdminPanel.tsx

修改:
  backend/app/db/models.py                 ← 扩展 GeneralSkill + 新表
  backend/app/api/general_skills.py        ← 列表筛选、runtime、download、library
  backend/app/general_skills/schema.py     ← Read/Runtime schemas
  backend/app/db/seed.py                   ← ≥3 条商店技能 + categories
  src/components/...SkillsPanel / PluginPanel ← 入口「技能商店」
  src/lib/types.ts
  docs/README.md
```

## 二、Phase A — 数据模型 + Runtime + 规则（skills-003 核心）

**目标：** 后端可 `GET runtime` / `install-prompt` / `agent-rules`；L1 默认可调。

### A1. Schema 迁移

- `general_skills` 增加：`access_level`, `version`, `package_digest`, `author_user_id`, `source`, `is_highlighted`, `category_id`, 计数器, `secure_content_enabled`, `allow_local_download`
- 新建 `general_skill_revisions`, `user_skill_library`, `skill_categories`
- 存量行：`access_level=L1`, `version` 从 metadata 或 `0.1.0`

### A2. Runtime 模块

- `runtime.py`：组装 digest、shortcut_skill_md、manifest
- `shortcut.py`：模板生成壳 Markdown
- 路由：`GET /{slug}/runtime`, `GET /{slug}/files/{path}`, `GET /{slug}/install-prompt`

### A3. Agent 规则

- 静态 bootstrap + full mdc
- `GET /api/enterprise/agent-rules/bspbuddy-skills.mdc`

### A4. Seed

- ≥3 条 published 技能（可用现有 import 样例）
- 分类：通用/研发/测试等

### A 验收

- [x] 登录后 `GET runtime?intent=install` 对 L1 返回 200 + shortcut_skill_md
- [x] `install-prompt?platform=cursor` 含 slug、runtime URL、rules URL、禁 token 文案
- [x] 匿名 GET bootstrap mdc 含 `BSPBUDDY_SKILLS_BOOTSTRAP_V1_INTEGRITY_CHECK`
- [x] 无 SKILL 时 404；archived → 410
- 自测脚本：`python scripts/selftest_skills_phase_a.py`

## 三、Phase B — 访问分级（skills-002）

**目标：** L1/L2/L3 门禁 + 申请审批；runtime/download/run 全挂载。

### B1. access 模块

- `can_invoke` / `can_download` / `can_read_full_body`
- 统一 403 信封

### B2. Grants API

- access-requests CRUD/decide、grants revoke、whitelist PUT
- 表：`skill_access_grants`, `skill_access_whitelist`

### B3. 挂载

- runtime、files、run、download、skill-md

### B4. 前端

- `SkillAccessRequestDialog`
- 详情徽章 + 作者 `SkillAccessAdminPanel`

### B 验收

- [x] L2：可 runtime，无授权 download → 403 + `request_download`
- [x] L3：无授权 runtime → 403 + `request_use`；无下载入口
- [x] 批准后重试成功；撤销后再次 403
- [x] pending 申请幂等
- 自测脚本：`python scripts/selftest_skills_phase_b.py`
- [x] 前端申请/审批弹窗（Phase C 商店详情一并做，或独立补）
  - 申请弹窗：`SkillAccessRequestDialog` 已接入详情
  - 作者审批列表 UI：`SkillAccessRequestDialog` + 商店「授权审批」`SkillAccessAdminPanel`

## 四、Phase C — 商店 UI + 库 + 升版（skills-001）

**目标：** 桌面可逛商店、导入、加入库、详情一键安装面板。

### C1. 列表/详情 API 补齐

- 列表 query：q/source/category/sort/featured
- revisions、library、download ZIP、categories

### C2. 前端商店

- `SkillStorePanel`：搜索/筛选/卡片
- `SkillDetailDrawer`：版本、SKILL.md、操作区
- 嵌入 `SkillInstallPanel`（A 已定 API）

### C3. 导入/升版 UX

- 扩展现有 import 对话框：category + access_level
- 升版表单：version + changelog + package

### C4. 与 agents-002 衔接

- 「安装到专家」复用 `resource:import`
- 「我的技能」数据源改为 `library/me` ∪ 原个人创建

### C 验收

- [x] 商店 ≥3 条可点；搜索→详情→加入库→装专家全链路（UI + API；装专家复用 resource:import）
- [x] 升版后 revisions 可见；runtime version 随主表更新（POST revisions）
- [x] 一键安装可复制指令；L3 未授权不生成可执行指令（403）
- [x] 导入缺 SKILL.md 明确失败（商店「导入技能」+ API 400；`selftest_skills_phase_d`）
- 自测脚本：`python scripts/selftest_skills_phase_c.py`
- [x] 前端申请弹窗（详情内 SkillAccessRequestDialog）

## 五、Phase D — Token / 收藏 / 审批收口

**已完成：**

- [x] Agent token 签发 / 列表 / 撤销（`bbsk_*`，auth 回退）；商店「Agent Token」复制一次
- [x] star 切换 + 详情「分享」复制 `bspbuddy://skills/{slug}`
- [x] 作者/管理员授权审批 inbox UI（商店「授权审批」Tab）
- [x] 商店导入对话框（URL/文件 + 检测预览 + L1–L3/category）+ **发布技能**表单（`SkillPublishDialog`）
- [x] 版本 Tab 升版表单
- [x] 安全 Tab 占位（「即将上线」说明，无假扫描结果）
- [x] 卡片/详情展示「下载 / 调用 / 收藏」；`download_count` / `invoke_count` / `star_count` 打点（download、runtime invoke、run、star）
- 自测脚本：`python scripts/selftest_skills_phase_d.py`

**明确延期（不做伪实现）：**

- runtime digest 漂移时 Agent Loop 热更新
- department 白名单（仍保留 user 白名单 API）
- 安全扫描引擎（仅 UI 占位）
- 上架前内容审核流（与授权「审批」区分；当前不做）
- Panda 币 / 抽奖（排行含技能热度 + 上传者上传数）

## 五-E、Phase E — 轻量排行榜（skills-001 增补）

**目标：** 商店顶栏「排行」：技能热度 Top 10 + 上传者榜；点技能行开详情。

### E1. API

- `GET /general-skills/leaderboard?metric=&category_id=&limit=`
- `metric=downloads|invokes|stars` → `kind=skills` + `items`
- `metric=authors` → `kind=authors` + `authors`（按 published 技能数）

### E2. UI

- `SkillStorePanel` 分段：商店 | 排行 | 审批
- 排行指标：下载 | 调用 | 收藏 | **上传者**
- 点技能行开详情；上传者行仅展示

### E3. Seed

- 演示技能差异化热度计数
- ≥2 名作者有上传数（admin + user_demo）

### E 验收

- [x] leaderboard 三种 metric 均返回有序列表
- [x] UI 顶栏「排行」可切换；点行开详情
- [x] 无币/抽奖入口
- 自测：`python scripts/selftest_skills_phase_e.py`

## 六、提交批次建议

| Commit | 内容 |
|--------|------|
| 1 | docs 已合并；本 plan |
| 2 | DB 迁移 + seed categories/skills |
| 3 | runtime + shortcut + agent-rules |
| 4 | access 门禁 + grants API |
| 5 | 商店列表/详情/library API |
| 6 | SkillStore + Detail + Install UI |
| 7 | Access 申请/审批 UI + agents-002 衔接 |

## 七、风险

| 风险 | 缓解 |
|------|------|
| 与现 SkillsPanel 双数据源混乱 | library 为「可安装」真源；个人创建自动入 library |
| L3 与现 run 接口破坏 | 默认 L1；存量兼容 |
| Cursor 无法带桌面 cookie | Phase D agent-token；或用户粘贴后 Agent 走登录说明 |
| digest/大文件性能 | manifest 按需拉；壳保持短 |

## 八、文档同步

- 实现每 Phase 后更新 PRD/Tech Spec 状态勾选  
- 行为符合后再改 `docs/README.md` 状态灯  
- 禁止未改 docs 先铺大 UI（spec-driven-dev）
