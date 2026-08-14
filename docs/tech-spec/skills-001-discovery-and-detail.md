---
id: skills-001-api
title: 企业技能商店 — 技术规格
type: tech-spec
related: [skills-001, skills-002, skills-003-runtime, agents-002]
---

## 1. 概述

实现 skills-001：租户内技能发现列表、详情（含版本与统计）、**导入**与**发布**、升版、加入「我的技能」。建立在 `POST /api/enterprise/general-skills/import-package` / `import-skillhub` 与 `GeneralSkill` 模型之上。

## 2. 设计目标

- 列表可搜索/筛选，禁止空数组假商店（seed ≥3）
- 导入必须含 `SKILL.md`；发布表单必填 name/slug/描述/版本/包
- 卡片与详情展示 `download_count` / `invoke_count` / `star_count`
- 卡片与详情展示作者归属：`author_user_id` / `author_display_name` / `is_mine`（当前用户是否上传者）
- 轻量排行榜：`GET .../leaderboard`；`downloads`/`invokes`/`stars` 技能热度，`authors` 上传者；无币/抽奖
- 「加入我的技能」≠ 绑定专家（绑定仍 agents-002）
- 上企业商店：`ensure_open_gallery_admin`（租户 admin）

## 3. API 设计

前缀：`/api/enterprise`

| Method | Path | 说明 |
|--------|------|------|
| GET | `/general-skills/store` | 商店列表；query: `q`, `source`, `category_id`, `sort`, `featured`；项含统计与作者 |
| GET | `/general-skills/leaderboard` | 热度/上传者排行；`metric`=`downloads`\|`invokes`\|`stars`\|`authors`，`category_id`，`limit`（默认 10，≤50）；`kind`=`skills`\|`authors` |
| GET | `/general-skills/{slug}` | 详情（含统计、access_level） |
| GET | `/general-skills/{slug}/revisions` | 版本列表 |
| POST | `/general-skills/{slug}/revisions` | 升版 |
| POST | `/general-skills/import-package` | 文件导入 **或** 发布上架（带 name/slug/description/version/changelog/access_level/category_id） |
| POST | `/general-skills/import-skillhub` | URL 导入（扩展 access_level/category_id/version） |
| POST | `/general-skills/{slug}/library` | 加入我的技能 |
| DELETE | `/general-skills/{slug}/library` | 移出 |
| GET | `/general-skills/library/me` | 当前用户库 |
| GET | `/general-skills/{slug}/download` | ZIP；门禁后 **`download_count += 1`** |
| POST | `/general-skills/{slug}/star` | 收藏切换；更新 **`star_count`** |
| GET | `/skill-categories` | 分类 |

### 统计打点

| 字段 | 递增时机 | 实现位置 |
|------|----------|----------|
| `download_count` | ZIP 下载成功写出前 | `GET .../download` |
| `invoke_count` | runtime `intent=invoke`；或 `POST .../run` / `run/stream` 过门禁后 | `general_skills.py` |
| `star_count` | star / unstar | `skills_extras.py` |

> `GET .../runtime?intent=install` **不**计入调用（安装拉壳 ≠ 使用）。

### 列表项 Schema（节选）

```json
{
  "slug": "pdf",
  "name": "pdf",
  "description": "…",
  "version": "1.0.0",
  "source": "external",
  "access_level": "L1",
  "is_highlighted": true,
  "author_user_id": "u_123",
  "author_display_name": "张三",
  "is_mine": false,
  "download_count": 12,
  "invoke_count": 40,
  "star_count": 2,
  "category_name": "通用类",
  "in_library": false,
  "updated_at": "…"
}
```

> `is_mine`：服务端按 `author_user_id == current_user.id` 计算。导入/发布写入 `author_user_id`；seed 演示技能归属 `admin`。

### 排行榜 Schema（节选）

```json
{
  "metric": "downloads",
  "items": [
    {
      "rank": 1,
      "metric_value": 42,
      "slug": "demo-hello",
      "name": "Demo Hello",
      "author_display_name": "Administrator",
      "is_mine": true,
      "download_count": 42,
      "invoke_count": 10,
      "star_count": 3
    }
  ]
}
```

> seed 为演示写入非零计数，避免空榜假 UI。`metric=authors` 时 `kind=authors`，返回 `authors[]`（`rank` / `author_display_name` / `skill_count` / `is_mine`），`items` 为空。

### import-package / 发布 Request（扩展）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| filename / content_base64 | string | 是 | 包 |
| name / slug / description | string | 发布建议必填 | 导入可从 SKILL.md 解析 |
| version | string | 否 | 默认 `1.0.0` |
| changelog | string | 否 | 初始 revision 文案；默认「初始导入」 |
| access_level | string | 否 | 默认 `L1` |
| category_id | string | 否 | |
| status | string | 否 | 默认 `published` |
| source | string | 否 | 文件导入 `local`；URL 导入 `external` |

## 4. 数据模型

### 4.1 `general_skills` 扩展字段

见 skills-003-runtime §4.1（同一迁移）。含 `download_count` / `invoke_count` / `star_count`。

### 4.2 `general_skill_revisions`

见 skills-003-runtime §4.2。

### 4.3 `user_skill_library` / `skill_categories` / `user_skill_stars`

见实现；star 表 Unique `(tenant_id, user_id, skill_id)`。

## 5. 核心流程

### 5.1 发现 → 加入库 → 装专家

```
GET /general-skills/store?q=pdf
  → 打开详情（展示统计）
  → POST /general-skills/{slug}/library
  → resource:import(general_skill)
```

### 5.2 导入

```
UI 检测 URL/ZIP
  → 无 SKILL.md → 400 / 禁止确认
  → import-package | import-skillhub
  → ensure_open_gallery_admin（企业商店）
  → 写 general_skills + 初始 revision
```

### 5.3 发布

```
填写 name/slug/描述/版本/changelog + 选包
  → POST import-package（同导入通道，元数据完整）
  → 列表可见；统计从 0 起计
```

## 6. 安全

- 列表：租户隔离；商店仅 `published`  
- 上架企业商店：admin  
- 下载：skills-002；升版：作者或 admin  
- 导入 URL：服务端拉取，防 SSRF  

## 7. 与 PRD 的差异

| PRD | 现状 | 后置 |
|-----|------|------|
| 评论 Tab | 不做 | — |
| 安全扫描 | 文案占位 | 独立引擎 |
| 卡片/列表双视图 | 仅卡片 | 列表视图 |
| 收藏/分享 | 已做 | — |
| 统计展示 | 卡片+详情已做 | — |
| 排行榜 | 技能热度 + 上传者（按发布数） | Panda 币 / 抽奖不做 |

## 8. 前端落点

```
src/components/SkillStorePanel.tsx       ← 发现 + 排行 + 详情抽屉 + 统计文案
src/components/SkillImportDialog.tsx     ← 导入（URL/文件/检测）
src/components/SkillPublishDialog.tsx    ← 发布技能
src/components/SkillInstallPanel.tsx     ← skills-003，详情嵌入
src/components/SkillAccessAdminPanel.tsx ← 审批 Tab
```