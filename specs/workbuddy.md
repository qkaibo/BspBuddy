# WorkBuddy SPEC — 总索引

> 来源: https://www.codebuddy.cn/docs/workbuddy/
> 抓取: 2026-08-03 ｜ 共 38 篇 ｜ WebFetch 全文

---

## 目录结构（与网站对齐）

```
specs/
├── workbuddy.md                          ← 本索引
│
├── Overview.md                           # 简介：核心能力+场景+对比
├── Quickstart.md                         # 快速开始：产品概述+三区域UI
├── FirstTask.md                          # 第一个任务：下载→登录→新建→查看
├── Create-Task.md                        # 创建任务：描述/空间/@上下文
├── Task-Management.md                    # 任务管理：列表/搜索/6状态/7操作
├── Conversation.md                       # 任务对话：输入/上传/顶部4按钮/中断
├── Results.md                            # 结果查看：四视图(概览/浏览器/变更/产物)
├── Plugins.md                            # 插件系统：5种插件类型
├── Pricing.md                            # 定价：个人版/企业版/加量包
├── Credits.md                            # 积分：消耗/扣减/有效期
├── Claw.md                               # 助理：远程控制总览+7平台
│
├── WeixinBot-Guide.md                    # 微信助理接入(扫码绑定)
├── Wechat-Guide.md                       # 微信客服号接入(扫码绑定)
├── Wecom-Guide.md                        # 企业微信接入(长连接)
├── QQ-Guide.md                           # QQ机器人接入
├── Feishu-Guide.md                       # 飞书接入(WS/URL回调)
├── Dingtalk-Guide.md                     # 钉钉接入
├── YuanBaoPai-Guide.md                   # 元宝派接入
│
└── From-Beginner-to-Expert-Guide/
    ├── Task-Bar.md                       # 新建任务栏：三模式+五模型+工作空间+技能
    ├── Project.md                        # 项目：协作/资产库/自动化/任务流转
    ├── Assistant.md                      # 助理功能说明：8平台/安全/解绑
    ├── Connector.md                      # 连接器：邮箱/文档/乐享/TAPD/网盘
    ├── Permission-Modes.md               # 权限模式：默认(沙箱) vs 完全放开
    ├── Plug-In.md                        # 插件组成：Skill/MCP/Slash/Hook/Agent
    ├── Skills-Market.md                  # 技能市场：安装/上传/查找/创建/20+包
    ├── Expert-Center.md                  # 专家中心：专家 vs 专家团 vs Skill
    ├── MCP-Guide.md                      # MCP配置：用户级/项目级+企微示例
    ├── Memory.md                         # 记忆：偏好提取+跨对话个性化
    ├── Ispiration.md                     # 灵感：精选成品案例+一键复刻
    ├── Exploration.md                    # 探索：社区案例作品集
    ├── Design-Idea.md                    # 设计创意：WorkBuddy × Ardot
    ├── Mailbox.md                        # 我的邮箱：专属Agent邮箱
    ├── CloudAgent.md                     # 企业智能体：Runtime/Session/评测
    ├── Automation-Guide.md               # 自动化：定时任务/模板/推送
    ├── Data.md                           # 数据管理：分享文件/归档任务
    ├── Setting.md                        # 系统设置：语言/字体/简洁模式/防休眠
    ├── Installation-Win-Guide.md         # Windows安装指南
    └── Installation-Mac-Guide.md         # Mac安装指南
```

---

## 核心功能速查

| # | 模块 | 关键点 |
|---|------|--------|
| 1 | 工作模式 | Ask(问答) / Craft(执行) / Plan(先计划) |
| 2 | UI 布局 | 左侧任务列表 + 中间对话区 + 右侧四视图结果面板 |
| 3 | 模型 | MiniMax / 智谱GLM / Kimi / DeepSeek / 混元 |
| 4 | 任务管理 | 6状态 + 7操作 + 搜索筛选 + 多任务并行 |
| 5 | 任务对话 | @引用/粘贴/拖拽上传 + 执行展示 + 停止中断 |
| 6 | 结果查看 | 概览(文件树) / 浏览器 / 变更(diff) / 产物 |
| 7 | 技能 Skills | 20+内置包 + 安装/上传/创建 + OpenClaw |
| 8 | 专家 Expert | 专家(角色切换) + 专家团(协作执行) |
| 9 | MCP | 用户级/项目级 + 可视化UI + 企微示例 |
| 10 | 连接器 | 邮箱/文档/乐享/TAPD/网盘 + 自定义 |
| 11 | 项目协作 | 指令/资产库(5GB)/任务流转/自动化 |
| 12 | 助理 | 8平台远程(微信/QQ/飞书/钉钉/元宝) |
| 13 | 权限 | 默认权限(沙箱+备份) / 完全放开 |
| 14 | 自动化 | 定时触发 + 模板(新闻/周报/etc) + 推送 |
| 15 | 插件 | Skill/MCP/Hook/Agent/Rule + Slash Commands |
| 16 | 设计创意 | Ardot画布：一句话生成UI/海报/PPT |

---

## 需求优先级

### P0 — 核心骨架
- 三模式切换(Ask/Craft/Plan) + 模型选择下拉
- 自然语言 → 拆解 → 计划展示 → 进度
- 右侧结果面板(产物/文件树/变更)
- 任务列表(分组+搜索+状态筛选)

### P1 — 办公工具
- Python sidecar: Word/Excel/PPT/PDF
- 网络搜索 + 文件上传(拖拽/粘贴/@引用)

### P2 — 对话交互
- 执行时间线 + 停止按钮 + 对话内搜索 + 历史提问
- 分享任务 + 会话持久化

### P3 — 高级
- 技能系统 / Slash Commands / 连接器 / MCP配置
- 自动化 / 项目协作 / 远程助理 / 浏览器预览 / 权限模式
