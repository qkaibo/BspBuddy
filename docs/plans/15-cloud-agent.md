# 15 — 企业智能体 (CloudAgent)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/CloudAgent.md`
> Status: ❌ P3 待开发

## 功能概要

云端 AI Agent 运行平台，提供完整的 Agent 生命周期管理：创建 Runtime（云端沙箱）、实时对话（ACP/SSE协议）、版本管理与快照回滚、部署产物到公网、渠道接入、凭据管理、Agent 评测。

> 此功能是企业级后台功能，依赖云端 API。本地独立开发可模拟 UI 和数据流。

## 一、核心概念

### Agent
AI 助手的完整配置：模型、角色（System Prompt）、技能、工具、MCP连接。

### Runtime (云端沙箱)
企业智能体的核心资源，一个独立的 Agent 运行环境。
每个 Runtime 包含：
- 云端沙箱实例（完整 Linux 文件系统 + 终端）
- Agent 配置信息 Manifest（声明式 JSON 配置）
- 一个或多个 Session

### Manifest
Agent 的声明式配置文件（JSON）。定义 Agent 的身份、能力、工作空间和运行环境。

最小配置示例：
```json
{
  "id": "my-agent",
  "name": "My Agent",
  "manifestVersion": "1.0"
}
```

### Session
用户与 Agent 之间的完整会话。一个 Runtime 下可有多个 Session，每个 Session 维护独立的对话历史和文件存储。

Session 超过 10 分钟无访问自动休眠以节省资源，再次访问时自动唤醒。

### 版本 (Version) vs 快照 (Checkpoint)
- Version: Agent 配置的版本管理，支持查看/编辑版本历史、发布、回滚
- Checkpoint: Session 的状态快照，可随时回滚到历史状态

## 二、核心能力

### Agent 创建与配置

1. 登录企业坐席账号 → 企业后台 → 企业智能体
2. 填写基础配置：名称、模型（Auto/内置模型列表）、System Prompt
3. 配置技能/专家/MCP：挂载 Skill 包，绑定 Expert，填写 MCP Server 配置
4. 高级配置：
   - 记忆：开启后跨轮次保持上下文
   - 知识库：关联官方和自定义知识库，Agent 通过 RAG 检索
5. Test Run：在左侧对话框测试 Agent 响应效果

### ACP 协议与 SSE 协议

- ACP 协议：发送指令给 Agent
- SSE 协议：接收 Agent 的流式输出和工具调用结果

### 部署到公网
Agent 在沙箱中构建的 Web 应用或静态资源可发布到公网。

### 渠道接入
支持企微 AIBot、QQ 机器人、飞书、钉钉。每条接入记录对应一个 Bot → Session 的绑定关系。

### 凭据管理
安全的凭据存储和代理注入。Agent 调用 MCP/Skill/外部 API 时，系统自动将对应认证凭据加密注入请求中，无需在代码或配置中明文暴露密钥。

### Agent 评测
通过标准化评测任务衡量 Agent 回答质量。选择目标 Agent 和评测数据集，系统自动逐条运行测试用例并计算得分。

## 三、实现任务

### 15-1 数据模型 (`src/lib/cloud-agent.ts`)

```typescript
interface CloudAgent {
  id: string
  name: string
  status: 'running' | 'idle' | 'failed'
  manifest: Manifest
  skills: string[]
  experts: string[]
  mcpServers: MCPConfig[]
  memory: boolean
  knowledgeBase: string[]
  createdAt: number
}

interface Manifest {
  id: string
  name: string
  manifestVersion: string
  systemPrompt?: string
  model?: string
  runtime?: { cpu: string; memory: string; storage: string }
}

interface CloudRuntime {
  id: string
  agentId: string
  status: 'running' | 'sleeping' | 'failed'
  sessions: CloudSession[]
  sandbox: SandboxInfo
}

interface SandboxInfo {
  id: string
  filesystem: string      // Linux 文件系统路径
  terminal: boolean        // 终端访问
  createdAt: number
}

interface Version {
  id: string
  agentId: string
  version: string
  manifest: Manifest
  changelog: string
  publishedAt: number
}

interface Checkpoint {
  id: string
  sessionId: string
  label: string
  snapshot: string         // 会话状态快照
  createdAt: number
}
```

### 15-2 企业智能体 UI

**Agent 管理页** (`src/components/CloudAgentPanel.tsx`)
- Agent 列表：名称 + 状态 + 操作(接入/版本管理/编辑/克隆/删除)
- 创建向导：基础配置 → 技能/专家/MCP → 高级配置 → Test Run
- 接入链接：生成分享链接，团队成员打开可见独立 Session
- 评测入口：选择 Agent + 数据集 → 查看评分结果

**Runtime 监控页**
- 展示沙箱运行状态：运行中 / 休眠 / 失败
- 自动休眠：10 分钟空闲 → 自动暂停；访问时自动唤醒

**Session 管理页**
- Session 列表：每个 Session 独立对话历史和文件
- 删除 Session：永久清除对话记录和文件

### 15-3 IPC 通道

```typescript
CLOUD_AGENT_LIST: 'cloud-agent:list'
CLOUD_AGENT_CREATE: 'cloud-agent:create'
CLOUD_AGENT_START: 'cloud-agent:start'
CLOUD_AGENT_STOP: 'cloud-agent:stop'
CLOUD_AGENT_DELETE: 'cloud-agent:delete'
CLOUD_AGENT_VERSION: 'cloud-agent:version'
CLOUD_AGENT_DEPLOY: 'cloud-agent:deploy'
CLOUD_AGENT_EVALUATE: 'cloud-agent:evaluate'
```

### 15-4 后端依赖

所有核心功能依赖企业后台 API。本地开发阶段：
- Agent 创建/管理 UI → 可完整实现
- Runtime/Session/部署 → 需要云端服务
- 评测 → 需要云端服务
- 渠道接入 → 各平台 Bot 配置 + 云端 API

## 四、验收标准

- [ ] 创建 Agent 并配置 System Prompt/模型/技能/知识库
- [ ] Test Run 测试 Agent 响应
- [ ] Runtime 状态监控：运行中/休眠/失败
- [ ] Version 管理：查看/编辑/发布/回滚
- [ ] Session 管理：独立对话历史 + 自动休眠/唤醒
- [ ] 部署 Web 应用到公网
- [ ] 渠道接入（企微 AIBot / QQ / 飞书 / 钉钉）
- [ ] 凭据代理注入：Agent 调用外部服务无需暴露密钥
- [ ] 评测任务执行并查看评分结果
