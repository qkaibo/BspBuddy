# 06 — 插件生态 (Plugins + Skills + MCP + Expert)

> 对应 SPEC: `specs/Plugins.md`, `specs/From-Beginner-to-Expert-Guide/Plug-In.md`, `specs/From-Beginner-to-Expert-Guide/Skills-Market.md`, `specs/From-Beginner-to-Expert-Guide/Expert-Center.md`, `specs/From-Beginner-to-Expert-Guide/MCP-Guide.md`
> Status: ❌ P3 待开发

## 功能概要

WorkBuddy 核心扩展系统：
- **技能(Skills)**: 教会 AI 完成特定任务的工具能力(发邮件、查股价、调API)
- **MCP**: AI 的 "USB 接口"，连接外部工具和服务
- **专家(Expert)**: 角色化 AI(人设+方法论+工具链)；专家团:(多Agent协作)
- **插件(Plugin)**: 打包 Skill + MCP + Slash Commands + Hooks + Agents 统一分发

## 一、插件系统 (Plugins)

### 插件类型 (5种)

| 类型 | 说明 |
|------|------|
| Skill | 技能插件，添加特定领域能力 |
| MCP | 连接外部服务和数据源 |
| Hook | 钩子插件，特定时机自动执行操作 |
| Agent | 智能体插件，专门任务处理能力 |
| Rule | 规则插件，定义行为规范 |

### 查看和安装
1. 左侧插件按钮 → 插件管理页面
2. 浏览内置插件列表(名称/作者/分类)
3. 点击安装
4. 管理已安装: 点击插件 → 管理 → 查看详情/卸载

### 添加第三方市场
点击 + 按钮 → 输入插件市场地址 → 浏览和安装

### 常用插件推荐
文档处理、数据分析、网络搜索、文件管理

## 二、插件组成 (Plug-In)

一个插件可打包以下组件:

| 组件 | 说明 | 示例 |
|------|------|------|
| 技能 (Skills) | 教会 AI 完成某类任务 | — |
| MCP 连接 | 对接外部服务 | 连接邮箱、网盘 |
| **快捷指令 (Slash Commands)** | 对话中输入简短命令触发 | `/周报` 一键生成 |
| 自动化规则 (Hooks) | 特定时机自动执行 | 生成文件后自动检查格式 |
| 智能体 (Agents) | 专属 AI 助手 | — |

### 插件市场
- 浏览推荐插件 → 一键安装
- 管理: 启用/禁用/更新
- 关键词搜索定位目标插件

## 三、技能市场 (Skills-Market)

### 概念
Skill = 封装可执行脚本与工作流，使 AI 在用户授权下完成具体动作。

### 安装技能
- **上传技能**: 导入本地技能包 (`.skill` 文件)
- **查找技能**: 输入任务描述，WorkBuddy 自动查找相关技能
- **创建技能**: 输入任务描述，WorkBuddy 自动创建技能

### 技能管理
- 启用/关闭: 无需卸载，随时开关
- 搜索: 关键词快速定位
- **批量卸载**: 支持批量操作
- 建议: 仅启用当前任务所需技能，减少无关干扰

### 安全警告 (SPEC明确)
- 恶意提示词注入、越权访问、后门程序隐患
- Skill 可能将输入发往第三方
- 安装前仔细查看权限申请、来源说明、脚本内容
- 涉及文件删除/批量写入/资金操作时先小范围验证

## 四、专家中心 (Expert-Center)

### 专家 (角色切换)
以「人设 + 方法论 + 工具链」让 WorkBuddy 用特定领域专家身份执行任务。

### 专家团 (协作执行)
由多位专家分工协作，团长自动拆解、并行执行并整合交付。

| 维度 | Skill | 专家 | 专家团 |
|------|-------|------|--------|
| 关系 | 工具能力 | AI顾问(能力+经验) | 多位专家+协作流程 |
| 怎么选 | 需要某种工具能力 | 明确单点问题 | 任务复杂，需多角色配合 |

### 使用方式
1. 打开专家中心 (左侧边栏点击专家)
2. 专家卡片: 能力介绍/擅长领域/任务示例
3. 专家团卡片: 能力介绍/擅长领域/团队成员/任务示例
4. 点击召唤 → 进入对话界面 → 描述任务

### 我的专家 (SPEC明确)
用户可**自创专家**: 创建属于你的专家，分享专业知识。按行业分类浏览。

## 五、MCP 配置

### 概念
MCP = AI 的 "USB 接口"，可视化连接外部工具和服务。

### 核心价值
| 能力 | 说明 |
|------|------|
| 上下文共享 | 提供文件内容、数据库记录等上下文 |
| 工具调用 | 暴露文件读写、接口调用等能力给模型 |
| 可组合工作流 | 多个工具串联自动化流程 |
| 数据控制 | 本地或受控方式运行 |

### 配置级别
| 级别 | 路径 | 场景 |
|------|------|------|
| 用户级 | `~/.workbuddy/mcp.json` | 配置一次，所有项目复用 |
| 项目级 | `<项目>/.workbuddy/mcp.json` | 仅当前项目生效 |

### MCP 市场
访问外部腾讯云 MCP 市场获取更多开放生态能力(非内置列表)。

### 快速上手: 企微机器人
1. 企微群 → 群机器人 → 获取 WebHook URL
2. 侧边栏 插件 → MCP服务器 → 配置MCP
3. 填写: `{ "mcpServers": { "wecom": { "command": "uvx", "args": ["wecom-bot-mcp-server"], "env": { "WECOM_WEBHOOK_URL": "..." }}}}`
4. 保存 → 绿色=成功, 红色=检查配置

### 最佳实践
- 公共能力配用户级；专属接入配项目级
- 从成熟示例起步
- 描述尽量明确
- 妥善保管 WebHook URL
- 检查 JSON 格式

## 六、实现任务 (实现细节)

### 06-1 技能数据模型
```typescript
interface Skill {
  id: string; name: string; description: string
  category: string; version: string; author: string
  installed: boolean; enabled: boolean
}
```

### 06-2 插件包格式 (实现细节)
```
.plugin/
├── manifest.json
├── skills/
├── mcp/
├── slash-commands/    // Slash Commands
├── hooks/
├── agents/
└── rules/
```

### 06-3 IPC 通道 (实现细节)
```typescript
SKILL_LIST/INSTALL/UNINSTALL/TOGGLE: 'skill:*'
MCP_LIST/CONNECT/DISCONNECT: 'mcp:*'
EXPERT_LIST/SUMMON: 'expert:*'
PLUGIN_INSTALL/UNINSTALL: 'plugin:*'
```

## 七、验收标准

- [ ] 安装 PPT Skill → 对话中自动调用
- [ ] 创建"数据分析专家" → 专家身份回复
- [ ] 召唤"市场分析专家团" → 团长拆解+并行执行+整合输出
- [ ] 配置 WeCom MCP → Agent 可发送企微消息
- [ ] 输入 `/周报` → 自动执行周报生成
- [ ] 安装第三方插件 → 技能+MCP+专家一次性就绪
- [ ] 自然语言查找技能: "我需要处理PDF" → 自动推荐相关技能
- [ ] 批量卸载多个技能
- [ ] 技能安装前显示安全警告和权限说明
