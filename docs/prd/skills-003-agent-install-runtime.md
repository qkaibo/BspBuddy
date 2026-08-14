---
id: skills-003
title: Agent 一键安装与 Runtime 协议
type: prd
related: [skills-001, skills-002, agents-002, agents-004, skills-hub-capability-inventory, skills-003-runtime]
---

## 概述

定义 BspBuddy 技能的 **Agent 分发协议**：用户复制一段「告诉 Agent」的指令，Agent（本产品对话侧或 Cursor）自动完成鉴权、规则同步、写入本地壳 `SKILL.md`，并通过 **runtime API** 拉取最新主指令与资源。解决「人肉下 ZIP、凭证进聊天、版本难更新」的问题。

借鉴 Skills Hub「快捷方式 + 实时 runtime」，按 BspBuddy 边界裁剪：

| 做 | 不做（首期） |
|----|--------------|
| BspBuddy 桌面 + Cursor 平台路径 | 全量 Hermes/Codex/Copilot 多端（预留 enum） |
| 安装指令面板 + 复制 | 飞书登录卡片发卡 |
| `.bspbuddy_skill_token`（或复用会话 token） | 照搬 `.skillhub_token` 品牌与 CLI 文件名 |
| runtime + 本地壳 | 强制用户安装外部 Python CLI（可选后置） |

## 用户场景

| 角色 | 场景 | 动机 |
|------|------|------|
| 工程师 | 在商店点「一键安装」→ 复制指令 → 粘贴到 Cursor | 零文档装技能 |
| 工程师 | 在 BspBuddy 对话里说「安装技能 xxx」 | 本产品内闭环 |
| 配置者 | 装壳成功后把技能绑到专家（agents-002） | 专家可执行 |
| 作者 | 升版后无需用户重下 ZIP，runtime 自动最新 | 持续交付 |
| 安全负责人 | Agent 回复中看不到 token / Bearer | 防凭证泄露 |

## 功能清单

| # | 功能 | 说明 |
|---|------|------|
| 1 | 安装指令面板 | 生成可复制自然语言指令（含平台、slug、API base、规则入口） |
| 2 | 平台选择 | MVP：`bspbuddy` / `cursor`；其它值预留 |
| 3 | 规则文件 | 提供 BspBuddy Skills 引导规则（mdc / 等价），含鉴权与红线 |
| 4 | 本地壳安装 | 写入平台 skills 目录 `{slug}/SKILL.md`（壳，非全文也可） |
| 5 | Runtime | `GET .../runtime` 返回最新主指令、manifest、权限提示 |
| 6 | Token 约定 | 本地文件或安全存储；**禁止**在对话中回显 |
| 7 | 与 L1–L3 联动 | 调用前检查 skills-002；403 展示申请动作 |
| 8 | 安装完成判定 | 壳文件存在 +（可选）自检通过才可对用户说「已安装」 |

## 数据模型

| 实体 / 概念 | 关键字段 |
|-------------|----------|
| Runtime 响应 | `slug`, `version`, `access_level`, `shortcut_skill_md`, `full_instructions`（授权可见）, `manifest[]`（`path`, `sha256`, `download_url`）, `instruction_for_agent` |
| AgentSkillToken | `user_id`, `token_hash`, `expires_at`, `device_label`；明文只写本地 |
| InstallIntent | `intent=install` \| `invoke` 查询参数，影响返回字段 |
| 平台路径映射 | 见下表 |

### 平台路径（MVP）

| `--platform` | rules 目标 | skills 目标 |
|--------------|------------|-------------|
| `cursor` | `.cursor/rules/bspbuddy-skills.mdc` | `.cursor/skills/{slug}/SKILL.md` |
| `bspbuddy` | 产品内规则通道 / 后端绑定 | 用户技能库 + 专家 binding（agents-002） |

### 本地壳语义

- 壳 `SKILL.md`：说明能力摘要 +「执行前必须 GET runtime」+ 禁止打印 token  
- 真源：服务端当前 published revision  
- 升版：壳可不变；runtime digest 变则 Agent 拉新内容  

## 页面与字段

### Agent 一键安装面板（由 skills-001 详情打开）

#### 布局

```
┌──────────────────────────────────────────────────────────┐
│ Agent 一键安装                                      [X]  │
│ 此技能采用「本地壳 + 实时 runtime」：Agent 经 API 拉最新。 │
│ 平台: (•) Cursor  ( ) BspBuddy                           │
│                                                          │
│ 告诉 Agent 的指令（一键复制）                    [复制]  │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 请帮我安装 BspBuddy 技能：{slug}                     │ │
│ │ 平台：https://{api-base}                             │ │
│ │ 技能入口：.../general-skills/{slug}/runtime          │ │
│ │ 若尚未加载规则，请先 GET .../agent-rules/...mdc      │ │
│ │ 鉴权按规则自动处理，不要展示任何 token。             │ │
│ └──────────────────────────────────────────────────────┘ │
│ 💡 冷启动 Agent 可凭此指令完成；无需手动复制令牌。         │
│ ▸ 开发者参考：完整 API 流程（折叠，默认关）               │
└──────────────────────────────────────────────────────────┘
```

#### 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| platform | enum | 是 | `cursor` / `bspbuddy` |
| install_prompt | string | 是 | 只读生成，可复制 |
| api_base | string | 是 | 当前环境 API 根；禁止写死内网 IP 在文档示例外 |

#### 交互

- 切换平台 → 重生成指令文案与路径说明  
- [复制] → 剪贴板 → Toast「已复制」  
- 展开开发者参考 → 展示 runtime / rules URL（**仍不展示用户 token**）  
- 若 skills-002 拒绝调用 → 面板主 CTA 改为「申请使用」，不生成可执行安装指令  

### BspBuddy 内「安装技能」对话流（可选同 PRD MVP）

| 步骤 | 行为 |
|------|------|
| 1 | 用户：「安装技能 {slug}」或粘贴标准指令 |
| 2 | 客户端检查登录会话；无会话 → 登录 |
| 3 | `GET runtime?intent=install`；403 → 走 skills-002 申请 UI |
| 4 | 写入用户库 / 提示「安装到哪个专家」 |
| 5 | 成功文案不含 token |

### 规则文件（产品要求，非页面）

规则必须要求 Agent：

1. 不硬编码 API 地址，使用指令中的平台地址或环境配置  
2. 不向用户展示 token、Authorization、token 文件路径（可说「已保存凭证」）  
3. 401 → 重新登录；403 → 只使用信封 `next_actions`  
4. 登录/授权成功后**继续安装**，禁止无故询问「是否继续最后一步」  
5. 安装完成标准：目标路径存在 `{slug}/SKILL.md`  

## API 依赖

| 端点（规划） | 触发场景 |
|--------------|----------|
| `GET /api/enterprise/general-skills/{slug}/runtime?intent=install\|invoke` | 装壳 / 执行前拉真源 |
| `GET /api/enterprise/agent-rules/bspbuddy-skills.mdc` | 公开或登录后完整规则 |
| `POST /api/enterprise/agent-tokens` | 签发 Agent 用 token（若不用会话 cookie） |
| `GET /api/enterprise/general-skills/{slug}/manifest-file?path=` | 拉 manifest 资源 |
| skills-002 access-requests | 403 后申请 |

### Runtime 响应（授权成功时，示意）

| 字段 | 说明 |
|------|------|
| `shortcut_skill_md` | 写入本地壳的 Markdown |
| `version` / `package_digest` | 缓存与失效 |
| `manifest` | 附加文件列表 |
| `access_level` | 与 skills-002 一致 |

## 页面关系

- **From:** skills-001 详情「一键安装」；对话命令；Cursor 粘贴指令  
- **To:** skills-002 申请；agents-002 绑专家；agents-004 专家委托时可使用已装技能  
- **数据耦合:** revision 发布 → runtime 内容变；grant 撤销 → runtime 403  

## 验收标准

- [x] 详情「一键安装」可复制完整指令（含 slug、api base、runtime、rules URL） — API + SkillInstallPanel  
- [x] 指令与面板文案明确要求 Agent 不回显 token  
- [ ] L1 技能：Cursor 目标路径可写出壳 `SKILL.md`（手工或 Agent 执行后检查）— 待联调审查  
- [x] 作者升版后，runtime 返回新 version；无需重下 ZIP  
- [x] L3 未授权：不生成可执行安装指令 / runtime 403 含 next_actions  
- [x] BspBuddy 内安装成功后，「我的技能」可见，并可走 agents-002 装到专家 — library API + 商店「安装到专家」  
- [x] 开发者参考折叠区不出现用户 Bearer 明文  
- [x] Agent Token（`bbsk_*`）可签发并用其访问 runtime — `selftest_skills_phase_d`  

## 非目标与后续

- 首期不交付独立 `skillhub_agent.py` CLI；若需要，另开 Tech Spec  
- 多平台（Claude Code / Codex 等）仅保留 platform enum 扩展点  
- 与外部 ThunderSoft Skills Hub **联邦同步**不在本 PRD  
