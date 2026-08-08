# 05 — 远程助理 (Claw + 8 IM Platforms)

> 对应 SPEC: `specs/Claw.md`, `specs/WeixinBot-Guide.md`, `specs/Wechat-Guide.md`, `specs/Wecom-Guide.md`, `specs/QQ-Guide.md`, `specs/Feishu-Guide.md`, `specs/Dingtalk-Guide.md`, `specs/YuanBaoPai-Guide.md`, `specs/From-Beginner-to-Expert-Guide/Assistant.md`
> Status: ❌ P3 待开发

## 功能概要

用户通过手机 IM 应用远程控制电脑上的 WorkBuddy 执行任务，结果回推至手机。支持 6 个平台(微信助理、微信客服号、企业微信、QQ、飞书、钉钉)和元宝派。

## 关键行为模型 (SPEC 明确)

| 特性 | 普通任务 | 远程助理 |
|------|----------|----------|
| 工作目录 | 自由指定 | 固定使用助理专属文件夹 |
| 对话会话 | 支持多个并行 | 仅一个会话，所有远程指令集中处理 |
| 上下文管理 | 可清空历史重新开始 | 保留完整对话历史，不可清空 |
| 跨设备 | 仅本地 | 从手机发起，可在桌面继续，可在桌面查看完整执行记录 |

## 一、助理执行记录页面

**文件**: `src/components/AssistantPanel.tsx`

- 查看远程任务的完整执行记录：思考过程、操作步骤、生成文件、最终结果
- 访问路径: 左下角头像 → 设置 → 助理设置 (SPEC明确路径)

## 二、平台接入 (7个平台)

### 微信助理 (推荐)

| 项目 | 详情 |
|------|------|
| 接入方式 | 纯二维码扫码绑定，**无需填写 App ID、App Secret 等开发凭证** |
| 版本要求 | WorkBuddy >= 4.6.4, 微信 >= 8.0.70 |
| 账号要求 | WorkBuddy 与微信使用同一账号或已关联 |
| 特性 | 支持语音消息(微信语音转文字)、图片、文件附件 |
| 跨设备 | 手机发送任务 → 桌面继续调整 → 回到手机接收结果 |

### 微信客服号

| 项目 | 详情 |
|------|------|
| 接入方式 | 纯二维码扫码绑定，**不需要 App ID、App Secret** |
| 与微信Bot区别 | 不同的绑定通道，功能相同 |

### 企业微信

| 项目 | 详情 |
|------|------|
| 接入方式 | WebSocket 长连接 或 URL 回调模式 |
| 凭证(Bot创建): 长连接模式 | Bot ID + Secret |
| 凭证(Bot创建): URL回调模式 | Token + Encoding-AESKey |
| 管理员 vs 普通成员 | 管理员在企业管理后台创建；普通成员通过企业微信客户端创建 |
| 特性 | 群聊 @bot 支持、专用任务群(长期绑定)、通知/提醒推送、扫码快速绑定 |
| 安全 | 消息加密传输、来源校验、敏感操作需用户在手机IM内确认 |

### QQ

| 项目 | 详情 |
|------|------|
| 接入方式 | 三模式: 二维码扫码 / WebSocket长连接 / URL回调 |
| 凭证 | AppID + AppSecret (从QQ开放平台获取) |
| 前提 | 实名认证QQ账号 |
| 安全 | AppSecret不可明文保存，二次查看将强制重置 |

### 飞书

| 项目 | 详情 |
|------|------|
| 接入方式 | 自建应用 WebSocket 或 URL 回调 |
| 凭证 | App ID + App Secret + Encrypt Key |
| 前提 | 企业账号，需有应用创建权限 |
| 配置步骤 | 权限管理(批量导入/导出权限) → 事件订阅(接收消息 + 卡片回传交互) |

### 钉钉

| 项目 | 详情 |
|------|------|
| 接入方式 | 开发者控制台 Bot 创建 |
| 凭证 | AppKey + AppSecret |
| 前提 | 企业管理员账号 |
| 必需权限 | `Card.Streaming.Write`, `Card.Instance.Write`, `qyapi_robot_sendmsg` |
| 配置步骤 | 创建应用 → 添加Bot能力 → 配置权限 → HTTP推送(AES Key + Token) → 发布审核 |
| 特性 | 群聊 @bot + 单聊 |

### 元宝派

| 项目 | 详情 |
|------|------|
| 接入方式 | 二维码扫码绑定(主要), AppID/AppSecret(备选) |
| 凭证 | AppID(填写为App Key) + AppSecret |
| 特性 | 社区派模式: Bot加入派, @bot发起任务, 结果全员可见, 实时输出分享 |
| 配置流程 | 元宝App创建 → WorkBuddy绑定 → 元宝App确认"我已操作" → 私聊测试 → 加入派部署 |

## 三、远程审批模型 (关键修正)

**错误理解(已修正)**: 敏感操作 → 本地弹窗确认
**正确理解**: 敏感操作(文件删除/系统配置修改/命令执行) → **用户在手机IM内审批确认**，不是电脑弹窗。

- 绑定身份：关联账号，支持灵活换绑
- 来源校验：每一条远程指令执行多层来源校验
- 高风险任务确认：需用户在IM内确认后方可执行

## 四、解绑流程

1. 左下角头像 → 设置 → 助理设置
2. 点击对应平台卡片右侧的解绑按钮
3. 解绑后: 本地配置删除、平台侧Bot仍存在但不收消息、历史记录保留、其他平台不受影响

## 五、实现任务

### 05-1 IM Bridge Service (实现细节)

**文件**: `src/main/services/im-bridge.ts`

```typescript
interface IMAdaptor {
  platform: string
  connect(config: PlatformConfig): Promise<void>
  disconnect(): Promise<void>
  onMessage(handler: (msg: IMessage) => void): void
  sendApprovalRequest(userId: string, action: string, details: string): Promise<boolean>
  sendMessage(userId: string, content: string, artifacts?: Artifact[]): Promise<void>
}
```

### 05-2 各平台 Adaptor (实现细节)

按SPEC各平台接入方式实现:

| 平台 | 文件 | 接入方式 | 特有功能 |
|------|------|----------|----------|
| 微信Bot | `weixin-bot.ts` | 扫码, 无凭证 | 语音消息 |
| 微信客服 | `wechat-cs.ts` | 扫码, 无凭证 | - |
| 企业微信 | `wecom.ts` | WS/URL回调 | 群聊@bot, 专用群 |
| QQ | `qq.ts` | 扫码/WS/URL三模式 | AppSecret不可明文 |
| 飞书 | `feishu.ts` | 自建应用 | 权限+事件订阅 |
| 钉钉 | `dingtalk.ts` | Bot创建 | 发布审核流程 |
| 元宝派 | `yuanbao.ts` | 扫码+AppID/Secret | 社区派 |

### 05-3 助理管理与执行

**约束**:
- 仅一个远程会话，所有IM平台指令集中处理
- 固定助理专属工作目录(非用户指定)
- 历史不可清除
- 跨设备继续: IM发起的任务可在桌面端主界面看到并继续调整

**安全**:
- 多层来源校验
- 手机IM内审批敏感操作(非本地弹窗)
- 内容防护不覆盖安全规则

### 05-4 IPC 通道 (实现细节)

```typescript
IM_CONNECT: 'im:connect'
IM_DISCONNECT: 'im:disconnect'
IM_STATUS: 'im:status'
IM_APPROVE: 'im:approve'
```

## 六、验收标准

- [ ] 微信Bot扫码绑定 → 助理Tab显示绿色已连接
- [ ] 手机微信发"帮我写周报" → WorkBuddy自动生成 → 结果推回微信
- [ ] 敏感操作(删除文件) → 手机IM收到审批请求 → 确认后执行
- [ ] 微信发语音消息 → 转换为文字 → Agent理解并执行
- [ ] 企业微信群聊@bot → Agent执行 → 结果推回群聊
- [ ] 钉钉发布审核通过 → Bot正常工作
- [ ] 元宝派 @bot → 结果全员可见
- [ ] 解绑某平台 → 其他平台不受影响
