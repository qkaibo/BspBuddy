# 08 — 连接器 (Connector)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Connector.md`
> Status: ❌ P3 待开发

## 功能概要

连接器将 BspBuddy 与外部服务对接，实现数据互通与能力扩展。支持 QQ邮箱、腾讯文档、腾讯乐享、腾讯会议、TAPD、腾讯网盘，以及自定义连接器。

## 已支持连接器

| 连接器 | 授权方式 | 实现文件 |
|--------|----------|---------|
| QQ邮箱 | QR扫码 | `connectors/qqmail.ts` |
| 腾讯文档 | OAuth | `connectors/tencent-docs.ts` |
| 腾讯乐享 | OAuth | `connectors/lexiang.ts` |
| 腾讯会议 | OAuth | `connectors/tencent-meeting.ts` |
| TAPD | API Key | `connectors/tapd.ts` |
| 腾讯网盘 | OAuth | `connectors/tencent-pan.ts` |
| 自定义 | MCP | `connectors/custom.ts` |

## 实现文件

```
src/components/ConnectorPanel.tsx     - 连接器管理页面
src/main/services/connector-service.ts - 连接器服务
src/lib/connector-types.ts            - 连接器类型定义
```

## 验收标准

- [ ] QQ邮箱连接器 → 扫码授权 → Agent 可读邮件总结线程
- [ ] 腾讯会议连接器 → 授权 → Agent 可创建/查询会议
- [ ] 自定义连接器 → 输入 MCP Server 配置 → 对接到 BspBuddy
- [ ] 禁用连接器 → 开关关闭 → Agent 无法调用
