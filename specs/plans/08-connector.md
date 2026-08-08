# 08 — 连接器 (Connector)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Connector.md`
> Status: ❌ P3 待开发

## 功能概要

连接器将 WorkBuddy 与外部服务对接，实现数据互通与能力扩展。当前支持 QQ邮箱、腾讯文档、腾讯乐享、腾讯会议、TAPD、腾讯网盘，并支持自定义连接器。

## 一、架构说明

| 实现模式 | 说明 |
|----------|------|
| MCP + CLI | 标准化协议，通用外部服务接入 |
| Skill + CLI | 内置脚本封装 |

## 二、应用场景

| 场景 | 说明 | 示例 |
|------|------|------|
| 数据查询 | 从外部数据源获取信息 | 查询数据库、检索文档 |
| 服务调用 | 调用第三方 API 完成操作 | 发送邮件、创建日程 |
| 文件管理 | 访问云端存储与文件系统 | 读取网盘文件、上传附件 |
| 消息通知 | 与即时通讯工具集成 | 发送企微/飞书消息 |

## 三、已支持连接器

### QQ 邮箱

**连接方式**: 连接器管理页面 → QQ邮箱卡片 + → 跳转授权页(二维码) → QQ邮箱 App(7.1.5+/鸿蒙 0.2.9+)扫码授权 → 手机确认 → 浏览器弹窗打开完成。

**功能**: 收发/搜索/整理邮件，自然语言读取内容、汇总线程、管理文件夹。

**撤销**: QQ邮箱 App → 设置 → 账号 → 安全管理 → 应用授权。

### 腾讯文档

### 腾讯乐享

支持搜索/创建/管理乐享知识库文档，导入 Markdown、按标签整理、追踪更新。

### 腾讯会议

(SPEC 明确列出在支持的连接器中)

### TAPD

### 腾讯网盘

### 自定义连接器

- 连接器管理页面右上角自定义连接器按钮
- 配置方式与 MCP 配置类似，详细参考 MCP 配置
- 访问范围由用户配置决定，WorkBuddy 不预设范围

> 新增连接器将同步更新隐私协议相关条款。

## 四、实现任务 (实现细节)

### 08-1 数据模型 (`src/lib/connector-types.ts`)

```typescript
interface ConnectorDef {
  id: string; name: string; description: string
  provider: 'qqmail' | 'tencent-docs' | 'tencent-lexiang' | 'tencent-meeting' | 'tapd' | 'tencent-pan' | 'custom'
  icon?: string
  authType: 'oauth' | 'qrcode' | 'apikey' | 'mcp'
  connected: boolean
  architecture: 'MCP+CLI' | 'Skill+CLI' // 实现模式
}

interface ConnectorConnection {
  id: string; defId: string; status: 'active' | 'expired' | 'revoked'
  scope: string[]; connectedAt: number
}
```

### 08-2 连接器管理页面 (实现细节)

**文件**: `src/components/ConnectorPanel.tsx`

- 列表展示: 名称 + 图标 + 状态(已连接/未连接) + 开关
- 连接流程: 点击 + → 授权的流程(各连接器不同)
- 自定义连接器: 右上角按钮 → 输入 MCP Server 配置 → 安装
- 禁用/断开: 切换开关
- 应用场景标签: 数据查询/服务调用/文件管理/消息通知

### 08-3 各连接器实施

| 连接器 | 授权方式 | 实现 (实现细节) |
|--------|----------|--------------|
| QQ邮箱 | QR扫码 | `connectors/qqmail.ts` — 生成二维码 → 监听确认 → MCP连接 |
| 腾讯文档 | OAuth | `connectors/tencent-docs.ts` |
| 腾讯乐享 | OAuth | `connectors/lexiang.ts` |
| 腾讯会议 | OAuth | `connectors/tencent-meeting.ts` |
| TAPD | API Key | `connectors/tapd.ts` |
| 腾讯网盘 | OAuth | `connectors/tencent-pan.ts` |
| 自定义 | MCP | `connectors/custom.ts` |

### 08-4 IPC 通道

```
CONNECTOR_LIST: 'connector:list'
CONNECTOR_CONNECT: 'connector:connect'
CONNECTOR_DISCONNECT: 'connector:disconnect'
CONNECTOR_STATUS: 'connector:status'
```

## 五、验收标准

- [ ] QQ邮箱连接器 → 扫码授权 → Agent 可读邮件总结线程
- [ ] 腾讯会议连接器 → 授权 → Agent 可创建/查询会议
- [ ] 腾讯乐享连接器 → 授权 → Agent 可搜索/管理知识库
- [ ] 自定义连接器 → 输入 MCP Server 配置 → 对接到 WorkBuddy
- [ ] 禁用连接器 → 开关关闭 → Agent 无法调用
- [ ] QQ邮箱撤销 → 到 App 安全管理中操作
