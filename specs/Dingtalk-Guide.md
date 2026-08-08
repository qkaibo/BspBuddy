# WorkBuddy 接入钉钉指南

> 来源: https://www.codebuddy.cn/docs/workbuddy/Dingtalk-Guide
> 抓取: 2026-08-03

---

本指南将帮助您在钉钉中配置 WorkBuddy 机器人，让您可以通过钉钉随时随地远程操控电脑上的 WorkBuddy 完成编程任务。

## 前提条件

- 已在电脑上安装 WorkBuddy，并开启了助理远程控制功能
- 拥有一个具有企业管理员权限的钉钉账号

## 配置步骤

### 1. 登录钉钉开发者后台

访问钉钉开发者后台，使用管理员账号登录。

### 2. 创建应用

「应用开发」→「创建应用」→ 填写应用名称和描述 → 点击保存

### 3. 添加机器人能力

应用创建成功后自动跳转到「添加应用能力」页面 →「机器人」→「添加机器人」→ 填写机器人名称、描述、预览图 → 确认发布

### 4. 配置应用权限

「权限管理」→ 搜索并开通以下权限：
- `Card.Streaming.Write`
- `Card.Instance.Write`
- `qyapi_robot_sendmsg`

### 5. 获取应用凭证

- 「凭证与基础信息」→ 获取 Client ID (AppKey) 和 Client Secret (AppSecret)
- 「开发配置 - 事件订阅」→ 推送方式选择「HTTP推送」→ 刷新获取 AES Key 和 Token

### 6. 在 WorkBuddy 中配置钉钉

打开 WorkBuddy → 助理设置 → 钉钉集成 → 填入 Client ID 和 Client Secret

两种连接模式：
- **WebSocket 长连接（推荐）**：适用于个人/家庭/办公室用户
- **URL 回调模式**：适用于有服务器、有公网 IP 的用户

### 7. 发布应用

创建版本 → 填写版本描述 → 确认发布 → 等待审核通过

## 开始使用

### 在群聊中使用

在群里 @机器人 并发送需求 → WorkBuddy 自动执行任务并回复结果

### 单聊使用

在钉钉搜索框中搜索机器人名称 → 点击进入对话窗口直接发送消息
