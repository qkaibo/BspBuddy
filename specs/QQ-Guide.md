# WorkBuddy 接入 QQ 指南

> 来源: https://www.codebuddy.cn/docs/workbuddy/QQ-Guide
> 抓取: 2026-08-03

---

本指南将帮助您将 WorkBuddy 接入 QQ，让您可以通过 QQ 随时随地远程操控电脑上的 WorkBuddy 完成任务。

## 前提条件

- 已在电脑上安装 WorkBuddy，并开启了助理远程控制功能
- 拥有一个已完成实名认证的 QQ 账号

## 配置步骤

### 1. 注册并登录 QQ 开放平台

打开浏览器，访问 QQ 开放平台，使用 QQ 扫码登录。

### 2. 创建机器人

点击创建机器人。点击后会立刻成功，机器人会给你的 QQ 发一条成功消息。

### 3. 配置凭证

复制机器人的 AppID 和 AppSecret。AppSecret 不支持明文保存，二次查看将会强制重置，请自行妥善保存。

### 4. 在 WorkBuddy 中完成配置

1. 打开 WorkBuddy → 点击助理设置
2. 配置 QQ 机器人集成：QQ 扫码连接已创建的机器人，或选择 WebSocket 长连接 / 使用 URL 回调填入 AppID 和 AppSecret 后点击注册
3. 配置成功后在助理设置中显示「已连接」，助理中可以看到 QQ 图标
