---
id: skills-003-runtime
title: Agent 一键安装与 Runtime 协议 — 技术规格
type: tech-spec
related: [skills-003, skills-001, skills-002, agents-002, agents-004]
---

## 1. 概述

实现 skills-003：安装指令生成、Agent 引导规则、本地壳写入约定、以及 General Skill **runtime** API。复用现有 `general_skills` 表与 `GeneralSkillRunner`；新增「壳 + 真源」分发通道，不替代专家绑定执行环（agents-004）。

技术范围：

- `GET /api/enterprise/general-skills/{slug}/runtime`
- `GET /api/enterprise/agent-rules/bspbuddy-skills.mdc`
- （可选）`POST /api/enterprise/agent-tokens`
- 前端：安装指令面板组件
- 静态规则文件 + shortcut SKILL.md 生成器

## 2. 设计目标

| 目标 | 做法 |
|------|------|
| 升版无需重下 ZIP | runtime 读当前 published 内容；本地壳可不变 |
| 凭证不进对话 | token 仅本地文件 / 安全存储；规则明文禁止回显 |
| 与 L1–L3 一致 | runtime 走 skills-002 门禁，统一 403 信封 |
| 少新依赖 | 不强制外部 Python CLI；Cursor Agent 用 curl/规则即可 |
| 兼容现网 | 保留 `POST /{slug}/run`；runtime 是分发层，run 是执行层 |

## 3. API 设计

Base：`/api/enterprise/general-skills`（与现路由前缀对齐）。  
认证：桌面会话 Bearer / Cookie；Agent 可用 `AgentSkillToken`。

### 3.1 Runtime

`GET /api/enterprise/general-skills/{slug}/runtime?intent=install|invoke`

**Query**

| 参数 | 类型 | 说明 |
|------|------|------|
| intent | enum | `install`：返回壳 + manifest；`invoke`：返回执行用主指令（可更全） |

**Response 200**

```json
{
  "slug": "markdown-converter",
  "version": "1.0.0",
  "package_digest": "sha256:…",
  "access_level": "L1",
  "shortcut_skill_md": "---\nname: …\n---\n…",
  "skill_markdown": "…完整或授权可见正文…",
  "manifest": [
    { "path": "scripts/foo.py", "sha256": "…", "size": 120, "download_url": "/api/enterprise/general-skills/markdown-converter/files/scripts%2Ffoo.py" }
  ],
  "instruction_for_agent": "执行前必须重新 GET runtime…",
  "api_base_hint": null
}
```

**错误**

| 状态 | 条件 |
|------|------|
| 401 | 未登录 |
| 403 | L3 无 use 授权；body 为 skills-002 信封 |
| 404 | slug 不存在或未 published |
| 410 | 技能 archived |

### 3.2 Manifest 单文件

`GET /api/enterprise/general-skills/{slug}/files/{path}`

- 同 runtime 调用门禁
- L3 未授权：403
- path 禁止 `..`；仅允许 skill package 内相对路径

### 3.3 Agent 规则

`GET /api/enterprise/agent-rules/bspbuddy-skills.mdc`

| 模式 | 行为 |
|------|------|
| 匿名 | 返回 bootstrap（认证 + 红线 + runtime 用法） |
| 已认证 | 返回完整版（含安装完成判定、平台路径表） |

完整性标记字符串（写入文件便于 Agent grep）：

- bootstrap：`BSPBUDDY_SKILLS_BOOTSTRAP_V1_INTEGRITY_CHECK`
- full：`BSPBUDDY_SKILLS_RULE_V1_INTEGRITY_CHECK`

### 3.4 Agent Token（可选 MVP）

若桌面会话 cookie 无法给外部 Cursor 用：

`POST /api/enterprise/agent-tokens`  
Request: `{ "device_label": "cursor-workspace", "ttl_hours": 720 }`  
Response: `{ "token": "…", "expires_at": "…" }`（明文仅此一次）

本地约定查找顺序：

1. `$BSPBUDDY_SKILL_TOKEN_FILE`
2. `./.bspbuddy_skill_token`
3. `~/.bspbuddy_skill_token`

### 3.5 安装指令（前端生成，可后端辅助）

`GET /api/enterprise/general-skills/{slug}/install-prompt?platform=cursor|bspbuddy`

返回 `{ "platform", "prompt_text", "runtime_url", "rules_url" }`，便于 UI 与后端文案一致。

## 4. 数据模型

### 4.1 扩展 `general_skills`（与 skills-001/002 共享）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| access_level | TEXT | NOT NULL DEFAULT `'L1'` | L1/L2/L3 |
| version | TEXT | NOT NULL DEFAULT `'0.1.0'` | semver |
| package_digest | TEXT | NULL | sha256 of package |
| author_user_id | TEXT | NULL INDEX | |
| source | TEXT | DEFAULT `'local'` | enterprise/external/local |
| is_highlighted | BOOL | DEFAULT false | |
| category_id | TEXT | NULL | |
| download_count | INT | DEFAULT 0 | ZIP 下载成功 +1 |
| invoke_count | INT | DEFAULT 0 | runtime `intent=invoke` 或 `POST .../run`（含 stream）过门禁后 +1；`intent=install` 不计 |
| star_count | INT | DEFAULT 0 | 收藏切换增减 |
| secure_content_enabled | BOOL | DEFAULT true | |
| allow_local_download | BOOL | DEFAULT true | L3 强制 false |

现有字段保留：`skill_markdown`, `skill_files_json`, `metadata_json`, `status`, `runtime_config_json` 等。

### 4.2 新表 `general_skill_revisions`（skills-001 共用）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | |
| tenant_id | TEXT | INDEX | |
| skill_id | TEXT | INDEX | → general_skills.id |
| version | TEXT | | |
| changelog | TEXT | | |
| skill_markdown | TEXT | | |
| skill_files_json | JSON | | |
| package_digest | TEXT | | |
| file_size | INT | | |
| created_by | TEXT | | |
| created_at | DATETIME | | |

Unique `(tenant_id, skill_id, version)`。

### 4.3 新表 `agent_skill_tokens`（可选）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | |
| tenant_id | TEXT | INDEX | |
| user_id | TEXT | INDEX | |
| token_hash | TEXT | UNIQUE | sha256 |
| device_label | TEXT | | |
| expires_at | DATETIME | | |
| revoked_at | DATETIME | NULL | |
| created_at | DATETIME | | |

## 5. 核心流程

### 5.1 Cursor 一键安装

```
用户复制 install-prompt
  → Cursor Agent 读规则 mdc（若无则 GET rules）
  → 读取/获取 token（不回显）
  → GET runtime?intent=install
  → 若 403：展示 next_actions，停
  → 写 .cursor/skills/{slug}/SKILL.md ← shortcut_skill_md
  → 按 manifest 下载文件到同目录（剥掉多余 slug/ 前缀）
  → grep 完整性 / 文件存在 → 回复「已安装」
```

### 5.2 BspBuddy 内安装

```
用户「安装技能 slug」或点面板「安装到 BspBuddy」
  → 会话认证
  → GET runtime?intent=install
  → Upsert UserSkillLibrary
  → 可选：引导选择专家 → agents-002 resource import
  → 不在此路径强制 +invoke_count（安装 ≠ 调用；调用见 runtime invoke / run）
```

### 5.3 执行时（与 agents-004 衔接）

```
Harness 调用 general_skill.{slug}
  → POST .../run 或 run/stream → invoke_count += 1
  → 现有两阶段 read/execute 用库内 skill_markdown
  → 演进：read 前可刷新 runtime digest，若漂移则热更新缓存
```

外部 Agent：

```
GET .../runtime?intent=invoke → invoke_count += 1
GET .../runtime?intent=install → 不计调用（仅装壳）
```

首期：**执行仍走库内快照**；runtime 主服务外部 Agent 与壳同步。桌面执行热更新可作为 Phase C。

### 5.4 shortcut_skill_md 生成规则

服务端模板生成，至少包含：

1. YAML front matter：`name`, `description`, `version`, `compat.bspbuddy`
2. 能力摘要（截断 description）
3. 「执行前必须 `GET {runtime_url}`」
4. 「禁止向用户展示 token / Authorization / token 文件路径」
5. `access_level` 提示

## 6. 安全

- runtime / files：强制鉴权；L3 无 grant → 403 信封  
- path traversal 防护  
- token 仅存 hash；响应禁止日志打印明文 token  
- 规则与 install-prompt **永不**内嵌用户 JWT  
- CORS：Agent 规则与 runtime 需允许桌面/Cursor 所用 origin 策略（同站 API 优先）  
- `allow_local_download=false` 时 ZIP 端点直接 403（skills-002）

## 7. 与 PRD 的差异 / 分期

| PRD | 首期实现 | 后置 |
|-----|----------|------|
| 多平台 enum | 只实现 cursor + bspbuddy | claude-code 等 |
| 独立 CLI py | 不做 | 可选 |
| 飞书登录卡片 | 不做 | — |
| 执行环热更新 runtime | Phase C | — |
| Agent token | 若会话可透传可暂缓 | 需要时再开 |

## 8. 文件落点（实现指引）

```
新增/改:
  backend/app/api/general_skills.py          ← runtime, files, install-prompt
  backend/app/api/agent_rules.py             ← mdc 路由（或挂 general_skills）
  backend/app/general_skills/runtime.py      ← 组装 Runtime 响应、shortcut 生成
  backend/app/general_skills/access.py       ← 门禁（与 skills-002 共用）
  backend/skills/agent-rules/bspbuddy-skills.mdc
  backend/skills/agent-rules/bspbuddy-skills.bootstrap.mdc
  src/components/SkillInstallPanel.tsx       ← 一键安装 UI
  src/lib/types.ts                           ← Runtime / InstallPrompt 类型
```
