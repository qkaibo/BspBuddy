---
id: skills-001
title: 企业技能商店 — 发现、详情与导入发布
type: prd
related: [skills-002, skills-003, agents-002, skills-hub-capability-inventory, skills-001-api]
---

## 概述

为 BspBuddy 提供**租户内企业技能商店**：浏览/搜索已发布的 General Skill，查看详情与版本，从 URL/ZIP/仓库导入或发布新版本。解决「技能只散落在个人目录、难发现、难复用」的问题。

**不做：** Panda 币、抽奖、评论社区、自动化安全扫描（可后续单独 PRD）。  
**轻量排行榜：** 技能热度（下载/调用/收藏）+ 上传者（按发布数）；无积分、无币。  
**不替代：** agents-002 的「安装到当前专家」——商店负责发现与入库；装到专家仍走 agents-002。

## 用户场景

| 角色 | 场景 | 动机 |
|------|------|------|
| 工程师 | 打开技能商店，按「研发类」筛选，搜索「PDF」 | 快速找到可用技能 |
| 工程师 | 打开详情看版本历史与统计（下载/调用/收藏） | 确认是否值得安装 |
| 工程师 | 打开「排行」看热门技能（下载/调用/收藏） | 快速发现高热度技能 |
| 管理员 | 从 GitHub / ZIP **导入**到企业目录 | 搬运已有包 |
| 管理员 / 作者 | **发布技能**（填元数据 + 上传包） | 新建上架 |
| 配置者 | 「加入我的技能」后去专家页安装 | 衔接个人目录 → 专家绑定 |

## 功能清单

| # | 功能 | 说明 |
|---|------|------|
| 1 | 发现列表 | 搜索、来源、分类、排序（最新/下载/收藏）、精选；单行筛选 |
| 2 | 技能卡片 | name、版本、摘要、级别、分类、精选；**作者归属**（`作者 · 姓名` / `我上传的`）；**统计：下载 / 调用 / 收藏** |
| 3 | 技能详情抽屉 | 描述、作者归属、统计、一键安装 / 版本 / 安全 Tab、操作区 |
| 4 | 加入我的技能 | 关联到用户库（不自动绑专家） |
| 5 | 导入 | URL / ZIP / SKILL.md；检测预览；须含 `SKILL.md` |
| 6 | 发布技能 | 独立表单：name/slug/描述/版本/changelog/包/分类/级别 |
| 7 | 升版 | 详情「版本」Tab；`version` + `changelog`（+ 可选包） |
| 8 | 下载 ZIP | skills-002 门禁；成功则 `download_count+1` |
| 9 | 一键安装入口 | skills-003 安装指令面板 |
| 10 | 授权审批入口 | 顶栏「审批」= L2/L3 授权 inbox（**非**上架内容审核） |
| 11 | 轻量排行榜 | 顶栏「排行」；技能热度（下载/调用/收藏）+ **上传者榜**（按上传数量）；Top 10；点技能行开详情 |

## 数据模型

| 实体 | 关键字段 |
|------|---------|
| `GeneralSkill`（扩展） | `id`, `tenant_id`, `slug`, `name`, `description`, `category_id`, `version`, `source`（`enterprise` / `external` / `local`）, `is_highlighted`, `access_level`（skills-002）, `author_user_id`, `download_count`, `invoke_count`, `star_count`, `status`（`draft` / `published` / `archived`） |
| `GeneralSkillRevision` | `skill_id`, `version`, `changelog`, `package_digest`, `file_size`, `created_at`, `created_by` |
| `UserSkillLibrary` | `user_id`, `skill_id`, `added_at` |
| `SkillCategory` | `id`, `name`, `sort_order` |
| `UserSkillStar` | `user_id`, `skill_id`（驱动 `star_count`） |

> 现有 `general_skills` 表可演进；字段以实现时 schema 为准，PRD 约束语义。

## 页面与字段

### 技能商店发现页（PluginPanel「技能商店」）

#### 布局

```
┌──────────────────────────────────────────────────────────┐
│ [商店|排行|审批]          [开发者▾] [导入] [发布技能]      │
│ [搜索…] [分类▼] [来源▼] [排序▼] [精选] [我上传的]         │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐            │
│ │ name  v1.2 │ │ …          │ │ …          │            │
│ │ 摘要…      │ │            │ │            │            │
│ │ L1 · 分类  │ │            │ │            │            │
│ │ 作者 · 张三 / 我上传的     │ │            │            │
│ │ 下载 n · 调用 n · 收藏 n   │ │            │            │
│ └────────────┘ └────────────┘ └────────────┘            │
└──────────────────────────────────────────────────────────┘
```

#### 排行页（顶栏「排行」）

```
┌──────────────────────────────────────────────────────────┐
│ [商店|排行|审批]                                          │
│ [下载|调用|收藏|上传者]  [分类▼]                           │
│ 技能榜: #1 name · 作者 · 下载 42                          │
│ 上传者榜: #1 张三 · 上传 8 个                             │
└──────────────────────────────────────────────────────────┘
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 指标 `metric` | enum | 是 | `downloads` / `invokes` / `stars` / **`authors`**（默认 downloads） |
| 分类 | id / all | 否 | 可选收窄（上传者榜=该分类下技能数） |
| Top N | int | 否 | 默认 **10**，上限 50 |
| 技能行 | — | — | 名次、name、作者、该指标数值；点击 → 详情抽屉 |
| 上传者行 | — | — | 名次、显示名、`skill_count`；当前用户高亮「我」 |

> 不做：Panda 币、积分、抽奖。上传者榜按 **已发布技能数量** 排序（谁上传/导入得多）。

#### 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 搜索词 `q` | string | 否 | 匹配 name / description / slug |
| 来源 | enum | 否 | `all` / `enterprise` / `external` / `local` |
| 分类 | id / all | 否 | `SkillCategory` |
| 排序 | enum | 是 | `latest` / `downloads` / `stars` |
| 精选 | bool | 否 | `featured=true` |
| 我上传的 | bool | 否 | 前端按 `is_mine` 过滤 |
| 卡片作者 | — | — | `author_display_name`；当前用户为作者时文案 `我上传的 · {name}`，否则 `作者 · {name}`；无作者 `作者未知` |
| 卡片统计 | — | — | 文案固定：`下载 {n} · 调用 {n} · 收藏 {n}` |

#### 交互

- 搜索/筛选 → 刷新 `GET .../store`  
- 点卡片 → 详情抽屉  
- [导入] → 导入向导（搬运）→ Toast → 刷新  
- [发布技能] → 发布表单（新建上架）→ Toast → 刷新  
- [商店|排行|审批]：排行进入热度榜；审批为授权 inbox  

#### 导入 vs 发布

| | 导入 | 发布技能 |
|--|------|----------|
| 意图 | 收进已有包 | 新建上架 |
| 侧重 | 来源 + 检测预览 + 分类/级别 | name/slug/描述/版本/changelog/包 + 分类/级别 |
| 权限 | 上企业商店须租户 **admin** | 同左 |
| 结果 | `published` + 初始 revision | 同左 |

> 「审批」只处理 L2/L3 **使用/下载授权**，不是上架内容审核。

### 技能详情抽屉

#### 布局

```
┌──────────────────────────────────────┐
│ name                           [X]   │
│ L1 · v1.2 · slug                     │
│ 作者 · 张三 / 我上传的 · admin       │
│ 描述…                                │
│ 下载 n · 调用 n · 收藏 n             │
│ [安装到专家]                         │
│ [加入我的技能] [申请授权?]           │
│ [收藏] [分享]                        │
│ [一键安装] [版本] [安全]             │
└──────────────────────────────────────┘
```

#### 字段 / 操作

| 操作 | 显示条件 | 说明 |
|------|----------|------|
| 统计行 | 始终 | download / invoke / star |
| 安装到专家 | 非 overall 专家 | agents-002 `resource:import` |
| 加入我的技能 | 已登录 | `UserSkillLibrary` |
| 申请授权 | L2/L3 | skills-002 |
| 收藏 / 分享 | 已登录 | star；`bspbuddy://skills/{slug}` |
| 一键安装 Tab | 始终 | skills-003 |
| 版本 Tab | 始终 | revisions + 升版表单 |
| 安全 Tab | 始终 | 占位（扫描后置） |

### 导入向导

```
┌──────────────────────────────────────┐
│ 导入技能                        [X]  │
│ ( ) URL   ( ) ZIP / .skill 文件      │
│ [________________________] [检测]    │
│ 预览: name / slug / 是否含 SKILL.md  │
│ 分类 [▼]  访问级别 [L1▼]             │
│              [取消] [确认导入]        │
└──────────────────────────────────────┘
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 来源类型 | enum | 是 | `url` / `file` |
| url / file | string / File | 条件 | 须最终含 `SKILL.md` |
| category_id | id | 否 | |
| access_level | enum | 是 | 默认 `L1` |

- [检测] → 预览；未检测不可确认  
- 缺 SKILL.md → 禁止确认  
- 确认 → `import-package` 或 `import-skillhub`  

### 发布表单

```
┌──────────────────────────────────────┐
│ 发布技能                        [X]  │
│ 名称 / slug / 描述                   │
│ 版本 / 访问级别 / 分类 / changelog   │
│ 技能包 [ZIP / SKILL.md]              │
│              [取消] [确认发布]        │
└──────────────────────────────────────┘
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name / slug / description | string | 是 | slug 创建后不可改 |
| version | semver | 是 | |
| changelog | string | 是 | 写入初始 revision |
| package | File | 是 | 含 SKILL.md |
| category_id | id | 否 | |
| access_level | enum | 是 | |

- 确认 → `POST .../import-package`（带元数据）  
- 升版走详情版本 Tab，不重复点「发布技能」  

## API 依赖

| 端点 | 触发场景 |
|------|----------|
| `GET .../general-skills/store` | 发现列表（含统计） |
| `GET .../general-skills/{slug}` | 详情 |
| `GET/POST .../{slug}/revisions` | 版本 / 升版 |
| `POST .../import-package` | 导入文件 / 发布上架 |
| `POST .../import-skillhub` | 导入 URL |
| `POST .../{slug}/library` | 加入我的技能 |
| `GET .../{slug}/download` | ZIP；`download_count+1` |
| `POST .../{slug}/star` | 收藏；更新 `star_count` |
| `GET .../skill-categories` | 分类 |

统计打点（与 skills-003 共用字段）：

| 计数器 | 何时 +1 |
|--------|---------|
| `download_count` | ZIP 下载成功 |
| `invoke_count` | `GET .../runtime?intent=invoke` 或 `POST .../run`（含 stream）成功通过门禁后 |
| `star_count` | 用户收藏；取消则 −1 |

## 页面关系

- **From:** 插件「技能商店」  
- **To:** skills-003 安装面板；agents-002 装专家；skills-002 申请 / 审批 Tab  
- **数据耦合:** library、revision digest、三类统计计数器  

## 验收标准

- [x] 商店 ≥3 条可点；搜索 → 详情 → 加入库 → 装专家  
- [x] 导入缺 SKILL.md 明确失败；导入含 URL/文件 + 检测预览  
- [x] 发布表单可上架；升版在版本 Tab  
- [x] 卡片与详情展示「下载 / 调用 / 收藏」  
- [x] 顶栏「审批」仅授权申请，不与上架审核混淆  
- [x] 顶栏「排行」：下载/调用/收藏/上传者；Top 10；点技能行开详情  
- [x] 无 Panda 币 / 抽奖入口  
