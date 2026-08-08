# 13 — Agent 邮箱 (Mailbox)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Mailbox.md`
> Status: ❌ P3 待开发

## 功能概要

每个用户的专属开发助手邮箱地址(`xxx.agent@agent.qq.com`)，由 Agent Mail 提供底层邮件服务。

**核心心智**: 邮件是给 Agent 的「工作信箱」——收件在界面看，干活在对话里。

> 此功能依赖 Agent Mail 服务。本地独立开发需模拟邮件服务。

## 一、核心特性

| 特性 | 说明 |
|------|------|
| **独立身份** | 独立的助手身份，不借用用户个人邮箱代发 |
| **界面与对话分工** | 界面查看管理邮件，对话由 WorkBuddy 起草发送 |
| **邮件驱动 AI** | 邮件到达即可触发 AI 处理，结果回到对话和邮箱 |
| **用户可控** | 回复/转发等对外动作不自动发送，必须经用户确认 |
| **数据隔离** | 邮箱绑定到账号实例，个人版/企业版隔离 |

## 二、开通流程 (SPEC明确)

### 两种开通入口

| 入口 | 流程 |
|------|------|
| 界面开通 | 左侧边栏 → 更多 → 我的邮箱 → 同意补充协议 → SMS 验证码验证 |
| 对话内开通 | 首次让 AI 发邮件 → 弹出开通卡片 → 同意后后台开通, 不打断当前任务 |

开通必要条件: 手机号注册 + 短信验证码。

## 三、邮箱界面功能

**访问路径**: 左侧边栏 → 更多 → 我的邮箱(位于"我的文件"下方)

### 收信、发信
- 收信/发信两个标签页
- 时间分组: 今天、昨天、上周、更早

### 邮件详情
- 发件人、收件人、正文、附件(显示文件大小 + 下载)

### 邮件管理
- 标记已读/未读
- 删除
- 关键词搜索

### 添加到对话
将整封邮件(标题、正文、发件人、时间、附件)作为上下文注入对话。

### 发邮件
列表页右上角入口 → 点击跳转新对话 → 预填示例指令(不自动发送, 需用户确认)

### 管理邮箱
列表页右上角 → 跳转邮箱管理页面

## 四、通知中心

左侧栏顶部「通知中心」接收:
- 新邮件提醒
- 开通成功/冻结/封禁
- 授权吊销

## 五、邮箱状态模型

| 状态 | 说明 | 操作 |
|------|------|------|
| 运行中 | 正常收发邮件 | 界面+对话均可使用 |
| 已停用 | 用户主动停用 | 一键打开设置 |
| 已封禁/冻结 | 违反规则 | 显示错误码和原因, 前往管理页面处理 |

## 六、对话中收发邮件 (关键安全原则)

### 确认门控 (SPEC 明确)

回复/转发属于「对外行动」，必须留一道用户确认，避免误发。

流程: Agent 起草内容 → **用户确认**(不自动发送) → 代理发送

### 典型场景

| 场景 | 操作方式 |
|------|----------|
| 会议纪要发送 | WorkBuddy 整理 → 发送到指定邮箱 |
| 发票/合同处理 | 邮件添加对话 → 提取关键字段 + 摘要 |
| 长邮件总结 | 邮件线程交给 WorkBuddy → 要点 + 待办 |
| 回复草稿 | WorkBuddy 起草 → 用户确认后发送 |
| 资讯简报 | 订阅邮件汇总 → 行业简报 |

## 七、安全与隔离

- 附件安全扫描
- 内容防护不覆盖安全规则
- 数据隔离: 个人版/企业版邮箱独立
- 回复/转发不自动发送

## 八、积分消耗

- 查看和管理邮件: **不消耗积分**
- 对话中处理邮件/起草回复/总结: 按正常任务消耗积分

## 九、实现任务 (实现细节)

### 13-1 数据模型 (`src/lib/mailbox-types.ts`)

```typescript
interface AgentMailbox {
  id: string
  address: string               // xxx.agent@agent.qq.com
  status: 'active' | 'disabled' | 'frozen' | 'banned'
  unreadCount: number
  totalCount: number
}

interface AgentMail {
  id: string
  from: string; to: string
  subject: string; body: string
  attachments: Attachment[]
  receivedAt: number; readAt?: number
  threadId?: string
  labels: string[]
}

interface OutboundAction {
  id: string
  type: 'reply' | 'forward' | 'new'
  to: string; subject: string
  draftBody: string
  status: 'draft' | 'confirmed' | 'sent' | 'cancelled'
}
```

### 13-2 Agent Mail 服务 (实现细节)

**文件**: `src/main/services/agent-mail.ts`

```typescript
class AgentMailService {
  // 开通流程
  activate(phone: string, smsCode: string): Promise<AgentMailbox>
  // 收发
  fetchMails(folder: 'inbox' | 'sent', page?: number): Promise<AgentMail[]>
  getMailDetail(mailId: string): Promise<AgentMail>
  // 对话集成
  injectIntoContext(mailId: string): Promise<MessageContext>
  // 确认门控: 回复/转发不自动发
  draftReply(mailId: string, body: string): Promise<OutboundAction>
  confirmSend(actionId: string): Promise<void>
  cancelSend(actionId: string): Promise<void>
}
```

### 13-3 前端页面 (实现细节)

**文件**: `src/components/MailboxPanel.tsx`

- 邮箱概览: 地址 + 状态 + 未读数
- 收件/发件列表: 时间分组 + 搜索
- 邮件详情: from/to/subject/body/附件/下载
- 添加到对话按钮: 一键注入上下文
- 发邮件入口: 跳转新对话 + 预填

### 13-4 开通流程 (实现细节)

**文件**: `src/components/ActivateMailbox.tsx`

```typescript
// 步骤:
// 1: 同意补充协议
// 2: 输入手机号 + SMS 验证码
// 3: 创建邮箱地址
// 4: 完成
```

### 13-5 确认门控 (实现细节)

```typescript
// Agent 起草回复 → 预览卡片(不发送)
// 用户点击确认 → 实际发送
// 用户点击取消 → 废弃草稿
interface SendConfirmation {
  to: string; subject: string
  body: string; attachments: string[]
  requiresConfirmation: true  // 对外行动强制确认
}
```

### 13-6 IPC 通道

```
MAILBOX_STATUS:    'mailbox:status'
MAILBOX_ACTIVATE:  'mailbox:activate'
MAIL_FETCH:        'mail:fetch'
MAIL_DETAIL:       'mail:detail'
MAIL_DRAFT:        'mail:draft'
MAIL_CONFIRM_SEND: 'mail:confirm-send'
MAIL_CONTEXT:      'mail:context'    // 注入邮件到对话上下文
```

## 十、验收标准

- [ ] 开通邮箱 → 获得 `xxx.agent@agent.qq.com` 地址
- [ ] 收到新邮件 → 通知中心提醒 + 添加到对话
- [ ] 发票邮件 → 提取关键字段并生成摘要
- [ ] 长邮件线程 → 总结要点和待办
- [ ] 起草回复 → 预览确认 → 发送
- [ ] 取消确认 → 回复不发送
- [ ] 附件安全扫描 → 下载
- [ ] 停用邮箱 → 一键重新激活
