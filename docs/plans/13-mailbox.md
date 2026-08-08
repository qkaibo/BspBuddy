# 13 — 邮箱 (Agent Mail)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Mailbox.md`
> Status: ❌ P3 待开发

## 功能概要

BspBuddy 的 Agent Mail 服务：用户与 AI 之间通过邮件形式的异步任务交流。不是通用 IMAP/SMTP 邮件客户端，而是专门的 Agent 邮件服务。

## 发送 Agent Mail

- 指定 ID + 标题 + 内容 → AI 处理 → 结果以邮件形式返回
- 支持指定工作空间

## 收件箱

- 左侧邮件列表(搜索+筛选)
- 右侧邮件内容面板
- 不同来源的邮件徽标标识

## 邮件状态

| 状态 | 说明 |
|------|------|
| 等待处理 | 用户发送，等待 Agent 处理 |
| 处理中 | Agent 正在处理 |
| 已完成 | Agent 已完成并回复 |
| 已读 | 用户已读 |

## 实现文件

```
src/components/MailPanel.tsx         - 邮箱面板
src/main/services/mail-service.ts    - Agent Mail 服务
src/lib/mail-types.ts                - 邮件类型定义
```

## 验收标准

- [ ] 收件箱列表 → 搜索+筛选
- [ ] 发送 Agent Mail → Agent 处理 → 结果返回收件箱
- [ ] 邮件状态变更通知
