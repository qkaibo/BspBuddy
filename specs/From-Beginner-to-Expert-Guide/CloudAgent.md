# 企业智能体

> 来源: https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/CloudAgent
> 抓取: 2026-08-03

---

## 概述

企业智能体是一个云端 AI Agent 运行平台，为开发者提供完整的 Agent 生命周期管理能力：

- 创建和管理 Agent 运行环境(Runtime)：每个 Runtime 是一个独立的云端沙箱实例，包含完整的文件系统和终端环境
- 与 Agent 进行实时对话：通过 ACP 协议、SSE 协议发送指令，接收 Agent 的流式输出和工具调用结果
- 管理版本和快照：创建 Checkpoint 和 Version，支持随时回滚到历史状态
- 发布部署产物：将 Agent 在沙箱中构建的 Web 应用或静态资源发布到公网

## 核心概念

### Agent

Agent 定义了一个 AI 助手的完整配置：使用什么模型、扮演什么角色（系统提示词）、拥有哪些技能和工具。

### Runtime

Runtime 是企业智能体的核心资源，代表一个独立的 Agent 运行环境，是 Session 背后真正运行的云端沙箱环境。

每个 Runtime 包含：
- 一个云端沙箱实例（完整的 Linux 文件系统和终端）
- Agent 的配置信息（Manifest），是声明式配置文件（JSON），定义了 Agent 的身份、能力、工作空间和运行环境
- 一个或多个 Session（对话会话）

创建 Runtime 时会自动创建一个初始 Session。

### Session

Session 代表一个用户与 Agent 之间的完整会话过程。一个 Runtime 下可以有多个 Session，每个 Session 维护独立的对话历史和 Agent 上下文。

## 快速开始

### 创建 Agent

在 WorkBuddy 中登录分配了企业坐席的个人账号，点击右上角企业智能体进入企业后台-企业智能体开始创建 Agent。

#### 填写基础配置

1. 填写 Agent 名称
2. 选择模型：支持采用 Auto 模式自动选择或选择模型管理-模型列表中的内置模型
3. System Prompt：在输入框中定义 Agent 的角色、行为规范和约束条件

#### 配置技能/专家/MCP

- 技能：为 Agent 挂载技能包，扩充特定领域能力
- 专家：为 Agent 绑定专家，扩展领域能力
- MCP：填写 MCP Server 配置，发布时与连接器合并生效

#### 高级配置

- 记忆：开启后 Agent 会记住多轮对话中的重要信息，跨轮次保持上下文
- 知识库：关联官方知识库和企业在后台配置的自定义知识库，Agent 可通过 RAG 检索获取知识库中的相关信息

#### Manifest

Manifest 是 Agent 的声明式配置，在创建 Agent 时传入，可在企业后台编辑管理。

最小配置示例：

```json
{
  "id": "my-agent",
  "name": "My Agent",
  "manifestVersion": "1.0"
}
```

#### Test Run

在左侧对话框切换 Test Run 模式，使用当前配置对话测试 Agent 的响应效果。

### 渠道接入

支持接入企微 AIBot、QQ 机器人、飞书和钉钉接收和回复 Agent 消息。在企业后台可以管理 Agent 的即时通讯渠道，每条接入记录对应一个 Bot → Session 的绑定关系。

### 凭据管理

凭据管理为 Agent 提供安全的凭据存储和代理注入能力。当 Agent 调用 MCP 服务、Skill 技能或外部 API 时，系统会自动将对应的认证凭据注入请求中，无需在代码或配置中明文暴露密钥。

凭据以加密方式存储，仅在 Agent 运行时由代理层解密并注入请求头。

## 管理 Agent

### Agent 页面

进入企业后台的企业智能体-Agent 板块可以查看已创建的 Agent 信息，对 Agent 进行接入、版本管理、编辑、克隆、删除等操作。

- 接入链接：团队成员打开链接可见的独立 Session
- 版本管理：点击对应 Agent 的版本发布操作，进入版本管理页面，查看和编辑版本历史

### Runtime 页面

Runtime 页面面向运维管理，展示沙箱的真实运行状态：
- 运行中 = 沙箱正在活跃服务
- 休眠 = 空闲超时后自动暂停（再次访问自动唤醒）
- 失败 = 沙箱创建或启动异常

### Session 页面

当用户通过分享链接打开 Agent 或通过 API 调用时，系统会自动创建一个专属 Session。

- 对话历史独立：每个 Session 拥有独立的对话历史和文件存储
- 自动休眠机制：Session 超过 10 分钟无访问会自动休眠以节省资源，再次访问时自动唤醒

删除 Session 将永久清除对话记录和文件。

## Agent 评测

通过标准化的评测任务衡量 Agent 的回答质量。选择目标 Agent 和评测数据集，系统会自动逐条运行测试用例并按照指定的评分方式计算得分。
