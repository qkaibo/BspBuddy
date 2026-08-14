---
id: skills-hub-capability-inventory
title: Skills Hub 能力对照清单（ThunderSoft → BspBuddy）
type: reference
related: [skills-001, skills-002, skills-003, agents-002]
---

# Skills Hub 能力对照清单

> 来源：登录后浏览 [skills.thundersoft.com](https://skills.thundersoft.com/) + 公开 bootstrap 规则 `/api/agent-cli/thundersoft-skills-hub.mdc`（2026-08-13）。
> 用途：产品取舍依据。本文件**不承诺**交付；正式需求以 `docs/prd/skills-00*.md` 为准。

## 1. 产品边界差异

| 维度 | ThunderSoft Skills Hub | BspBuddy |
|------|------------------------|----------|
| 形态 | 企业 Web 技能商店 | Electron 桌面工作台 + FastAPI 后端 |
| 技能主路径 | 发现 → 一键装到外部 Agent（Cursor/Claude…） | 个人目录 → **安装到专家** → Agent Loop 执行 |
| 执行 | 本地壳 + 远程 `/runtime` | `GeneralSkillRunner`（read / execute） |
| 身份 | 飞书 SSO + Agent token | 桌面会话 / auth-001 RBAC |
| 激励 | Panda 币、抽奖 | 不做；**轻量排行榜**（技能热度 + 上传者）借鉴 |

## 2. 能力对照总表

| # | Skills Hub 能力 | BspBuddy 现状 | 决策 | 落点 |
|---|-----------------|---------------|------|------|
| A1 | 发现首页：搜索、来源 Tab、职能分类、排序、卡片/列表 | 个人技能目录 + 广场只读雏形（agents-002） | **借鉴增强** | skills-001 |
| A2 | 技能卡片：作者、版本、下载/调用/Star、标签、精选 | 卡片字段不完整 | **借鉴** | skills-001 |
| A3 | 详情：版本历史、SKILL.md、样例、评论、安全 Tab | 编辑器有 name/desc/version；无商店详情 | **部分做** | skills-001（评论/安全扫描后置） |
| A4 | 导入：URL / GitHub / ClawHub / ZIP / 批量上传 | `general-skill:import*` 已有 | **对齐补强** | skills-001 |
| A5 | 发布 / New Version / changelog | publish API 雏形 | **借鉴** | skills-001 |
| A6 | 收藏 / 分享链接 / 仪表盘 | 无或弱 | **后置** | 不进首批 PRD |
| B1 | L1/L2/L3：调用 vs 下载分离 | 无分级 | **要做** | skills-002 |
| B2 | 申请使用 / 申请下载 / 白名单 / 审批 | 无 | **要做** | skills-002 |
| B3 | 受控正文 `secure_content` | 无 | **要做** | skills-002 |
| C1 | 「告诉 Agent」一键安装指令 | 无 | **要做** | skills-003 |
| C2 | Agent 规则 `.mdc` / sync-rules | 无 SkillHub 规则通道 | **要做（BspBuddy 版）** | skills-003 |
| C3 | 本地壳 SKILL.md + `/runtime` 实时内容 | 全量包进库执行 | **要做** | skills-003 |
| C4 | `.skillhub_token` / 凭证不进对话 | 无 | **要做（BspBuddy token）** | skills-003 |
| C5 | 跨平台路径（Cursor/Claude/Codex…） | 仅 BspBuddy / Cursor 工作区 | **裁剪**：优先本产品 + Cursor | skills-003 |
| C6 | 401/403 自愈 + 飞书登录卡片 | 不适用 | **裁剪**：桌面会话 + 申请流 | skills-002 / skills-003 |
| D1 | 排行榜 / Panda 币 / 抽奖 | 无 | **裁剪**：技能热度 + 上传者上传数；币与抽奖不做 | skills-001 |
| D2 | Admin 运营后台大盘 | 无独立商店 Admin | **后置** | — |
| D3 | 安全扫描 / skill-quality-reviewer 准入 | 无 | **后置** | skills-001 验收外可选 |

## 3. Skills Hub 路由与页面（观察）

| 路由 | 页面 | 备注 |
|------|------|------|
| `/` `/skills` | 发现 | 搜索、筛选、排序 |
| `/skills/:slug` | 详情 | 一键安装、下载 ZIP、Tab |
| `/upload` | 发布 | ZIP + 元数据 |
| `/search` | 搜索 | 含 GitHub 发现 |
| `/dashboard` | 我的仪表盘 | 授权/收藏等 |
| `/stars` | 收藏 | |
| `/leaderboard` | 排行榜 | **借鉴轻量版**（skills-001；无币） |
| `/lottery` | Panda 币兑换池 | 不做 |
| `/security` | 信息安全说明 | 可参考文案结构 |
| `/admin` | 管理后台 | 后置 |
| `/login` `/auth/*` | 飞书登录 | 身份体系不同 |

## 4. Skills Hub 关键 API（观察，非 BspBuddy 契约）

| 能力 | 路径（Skills Hub） |
|------|-------------------|
| 列表/详情 | `GET /skills`, `GET /skills/{slug}` |
| Runtime | `GET /api/skills/{slug}/runtime` |
| Agent 规则 | `GET /api/agent-cli/thundersoft-skills-hub.mdc` |
| CLI | `GET /api/agent-cli/skillhub_agent.py` |
| 安装码兑换 | `POST /api/skills/{slug}/exchange-install-code` |
| 申请授权 | `POST /api/skills/{slug}/request-access` |
| 导入 | `POST /skills/import/url`, batch-upload |
| 收藏 | star / unstar |

## 5. L1 / L2 / L3 语义（照搬产品语义，实现另议）

| 级别 | 调用（runtime / 安装壳） | ZIP / install-bundle 下载 |
|------|--------------------------|---------------------------|
| L1 | 登录即可 | 登录即可 |
| L2 | 登录即可 | 需「申请下载」通过 |
| L3 | 需「申请使用」通过 | **禁止** |

## 6. 一键安装指令模板（观察）

```
请帮我安装 SkillHub 技能：{slug}

SkillHub 平台：{origin}
技能入口：{origin}/api/skills/{slug}/runtime

若你尚未加载 SkillHub 规则，请先 GET {origin}/api/agent-cli/thundersoft-skills-hub.mdc 学习规则，
然后按规则完成 {slug} 的安装与执行。
鉴权与 token 处理一律按规则自动进行，不要把任何 token、Authorization 头或 .skillhub_token 路径展示给我。
```

BspBuddy 应对等产出「告诉 BspBuddy / Cursor Agent」的指令，见 skills-003。

## 7. 与 agents-002 的分工

| 文档 | 负责 |
|------|------|
| agents-002 | 专家 Scope 下：个人技能安装/卸载、内联编辑、绑定同步 |
| skills-001 | 企业/租户技能商店的发现、详情、导入发布 |
| skills-002 | 访问级别与授权审批 |
| skills-003 | Agent 安装协议、本地壳、runtime、凭证规则 |

用户路径衔接：

```
skills-001 发现/导入 → 进入「我的技能」
  → agents-002 安装到专家
  → skills-003（可选）用一键指令装到 Cursor / 同步 runtime 壳
  → skills-002 在 L2/L3 时拦截下载或调用
```
