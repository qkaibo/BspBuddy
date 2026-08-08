# BspBuddy 实现计划 — 总索引

> 基于 38 篇 SPEC 文档 + StaffDeck 融合，按功能域分组，共 19 个 Plan 文件
> 每个 Plan 文件位于 `docs/plans/`，本 README 仅作进度看板
>
> **UI 布局说明（2026-08-04）：** 桌面端欢迎态布局以截图参考 SPEC 为准 —— [`../components/workbuddy-reference-layout.spec.md`](../components/workbuddy-reference-layout.spec.md)（优先级高于旧 docs 文字推断）。实现品牌为 BspBuddy。

## 进度总览

| # | Plan | 对应 SPEC | Phase | 状态 | 交叉验证 |
|---|------|-----------|-------|:--:|:--:|
| 01 | [task-bar](../../docs/plans/01-task-bar.md) | Task-Bar | P0 | ✅ 已完成 | ✅ |
| 02 | [task-management](../../docs/plans/02-task-management.md) | Create-Task, Task-Management | P0 | ✅ 已完成 | ✅ |
| 03 | [conversation](../../docs/plans/03-conversation.md) | Conversation | P0 | ✅ 已完成 | ✅ |
| 04 | [results](../../docs/plans/04-results.md) | Results | P0 | ✅ 已完成 | ✅ |
| 05 | [claw-assistant](../../docs/plans/05-claw-assistant.md) | Claw, WeixinBot-Guide, Wechat-Guide, Wecom-Guide, QQ-Guide, Feishu-Guide, Dingtalk-Guide, YuanBaoPai-Guide, Assistant | P3 | ❌ 待开发 | ✅ 修复 |
| 06 | [plugins-ecosystem](../../docs/plans/06-plugins-ecosystem.md) | Plugins, Plug-In, Skills-Market, Expert-Center, MCP-Guide | P3 | ❌ 待开发 | ✅ 修复 |
| 07 | [project](../../docs/plans/07-project.md) | Project | P3 | ❌ 待开发 | ✅ 修复 |
| 08 | [connector](../../docs/plans/08-connector.md) | Connector | P3 | ❌ 待开发 | ✅ 修复 |
| 09 | [automation](../../docs/plans/09-automation.md) | Automation-Guide | P3 | ❌ 待开发 | ✅ 修复 |
| 10 | [permission](../../docs/plans/10-permission.md) | Permission-Modes | P3 | ❌ 待开发 | ✅ 修复 |
| 11 | [memory](../../docs/plans/11-memory.md) | Memory | P3 | ❌ 待开发 | ✅ 修复 |
| 12 | [design-idea](../../docs/plans/12-design-idea.md) | Design-Idea | P3 | ❌ 待开发 | ✅ 修复 |
| 13 | [mailbox](../../docs/plans/13-mailbox.md) | Mailbox | P3 | ❌ 待开发 | ✅ 修复 |
| 14 | [inspiration](../../docs/plans/14-inspiration.md) | Ispiration, Exploration | P3 | ❌ 待开发 | ✅ 修复 |
| 15 | [cloud-agent](../../docs/plans/15-cloud-agent.md) | CloudAgent | P3 | ❌ 待开发 | ✅ 修复 |
| 16 | [pricing](../../docs/plans/16-pricing.md) | Pricing, Credits | P3 | ❌ 待开发 | ✅ 修复 |
| 17 | [data-settings](../../docs/plans/17-data-settings.md) | Data, Setting | P3 | ❌ 待开发 | ✅ 修复 |
| 18 | [installation](../../docs/plans/18-installation.md) | Installation-Win-Guide, Installation-Mac-Guide | P3 | ❌ 待开发 | ✅ 修复 |
| 19 | [expert-management](../../docs/plans/19-expert-management.md) | ✦ StaffDeck: prd-001 Agent 管理, prd-014 开放广场 | P3 | 🟡 开发中 | — |

## 修复记录

### 2026-08-03 — 交叉验证批量修复

#### 根本性不匹配 (2个) — 完全重写
| Plan | 问题 | 修复要点 |
|------|------|----------|
| 12-design-idea | 编造了 Excalidraw/tldraw/Figma 替代方案 | 恢复 Ardot 为唯一目标，补充授权权限(三权限)、手机号自动关联、双向同步、组件化编辑、生成应用按钮 |
| 15-cloud-agent | Runtime 定义错误，缺失核心概念 | 修正 Runtime 定义(云端沙箱+文件系统+终端)，补充 ACP/SSE协议、Manifest声明式配置、RAG知识库、Test Run、评测系统、休眠/唤醒、凭证代理注入、渠道接入详情 |

#### 严重不足 (4个) — 重写
| Plan | 问题 | 修复要点 |
|------|------|------|
| 05-claw-assistant | 微信接入方式/凭证错误，缺失各平台特性 | 修正为二维码扫码、远程审批在IM内非本地、固定工作目录+单session+历史不可清除、各平台独有功能、解绑流程 |
| 06-plugins-ecosystem | 缺失 Slash Commands/我的专家/批量卸载 | 补充5种插件类型、Slash Commands、自创专家、自然语言查找、第三方市场URL、安全警告面板 |
| 09-automation | 推送方式错误(IM/邮件)，模板错误 | 修正为仅推送到小程序，模板改为SPEC指定的体检预约/学习计划，补充工作空间配置/模型技能选择/有效日期/并发控制 |
| 13-mailbox | 编造 IMAP/SMTP架构 | 改为 Agent Mail 服务，补充开通流程(协议+SMS验证)、状态模型、添加到对话、确认门控、附件扫描、通知中心事件 |

#### 一般不足 (4个) — 重写
| Plan | 问题 | 修复要点 |
|------|------|------|
| 07-project | 缺失双授权模式细节 | 补充公共/个人授权票据管理(个人不上云)、协作禁用个人连接器、专家/Skill/连接器选择范围和置顶规则、邀请备注+消息中心审批、URL书签资产、web/桌面Skill库分离 |
| 08-connector | 缺失腾讯会议连接器 | 补充腾讯会议、两种架构(MCP+CLI/Skill+CLI)、4种应用场景、QQ邮箱销权路径 |
| 10-permission | 权限UI位置错误，缺失备份/沙箱 | 修正UI为输入框下方下拉菜单，补充Windows文件备份、安全删除/回收站、沙箱约束命令、取消后替代方案展示、用完即关建议 |
| 11-memory | 缺失记忆类型和导入流程 | 补充4种记忆类型(fact/preference/relationship/follow_up)、对话式编辑、会话历史搜索、import流程(复制prompt→粘贴→添加)、免费提取 |

#### 轻微 (4个) — 重写
| Plan | 问题 | 修复要点 |
|------|------|------|
| 14-inspiration | 未合并 Exploration | 合并为同一功能，补充七大场景、红心收藏、内置浏览器预览、与Skill/Expert区别 |
| 16-pricing | 积分额度错误，缺折扣模型 | 补充精确积分(500/4000/9000/50000)、折扣(连续月付7折/年付7折/连续年付再8折)、加量包规则、扣减优先级、有效期、企业共享积分 |
| 17-data-settings | 简洁模式默认值错误 | 修正默认ON，强调视觉层面变化非结构变化，补充非高风险自动安装、设置入口路径 |
| 18-installation | 缺失协议勾选/芯片选择 | 补充登录协议勾选、版本排除说明、Mac芯片选择指导、手动更新入口、语言切换入口 |

## Phase 说明

| Phase | 范围 |
|-------|------|
| P0 核心骨架 | 三模式 + 模型选择 + 任务拆解 + 结果面板 + 任务列表 |
| P1 办公工具 | Python Office 工具链 + 搜索 + 文件上传 |
| P2 对话交互 | 时间线 + 停止 + 搜索 + 持久化 |
| P3 高级功能 | 远程助理、插件生态、项目协作、连接器、自动化、权限、记忆、创意画布、邮箱、灵感、企业智能体、定价积分、数据管理、设置、安装 |

## 开发优先级建议

1. **P0-P2 已完成** → 不需要额外开发
2. **P3 第一批** → 06 插件生态 (Skills/MCP/Expert) + 19 专家管理 (StaffDeck 融合) + 05 远程助理 (Claw)
3. **P3 第二批** → 07 项目协作 + 08 连接器 + 09 自动化
4. **P3 第三批** → 10 权限 + 11 记忆 + 14 灵感
5. **P3 第四批** → 12 创意画布 + 13 邮箱 + 15 企业智能体
6. **P3 收尾** → 16 定价 + 17 数据设置 + 18 安装
