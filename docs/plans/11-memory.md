# 11 — 记忆系统 (Memory)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Memory.md`
> Status: 🟡 P3 基础完成（自动提取 + 上下文注入已实现）

## 功能概要

BspBuddy 从会话历史中提取个人信息形成记忆数据，在后续对话中作为背景信息参考。对话越多，越懂用户。记忆数据仅用户本人可见，可编辑/删除/关闭。

## 已实现

| 功能点 | 实现位置 | 说明 |
|---|---|---|
| 记忆存储 | `memory-service.ts` | JSON 文件存储，四种类型（fact/preference/relationship/follow_up） |
| 正则提取 | `memory-service.ts` extractFromConversations | 从用户消息中匹配"我是..."/"我喜欢..."/"XX是我的"等模式 |
| 对话式编辑 | `memory-service.ts` editInstruction | 支持"记住XX"/"忘记XX"/自动识别类型 |
| 上下文注入 | `agent.ts` + `ipc-handlers.ts` | 每轮对话前检索相关记忆注入 system prompt |
| 自动提取 | `ipc-handlers.ts` MEMORY_EXTRACT | 每轮对话结束后从当前消息历史提取新记忆 |
| 外部导入 | `memory-service.ts` importFromExternal | 支持 JSON/文本批量导入 |
| 历史搜索 | `memory-service.ts` searchSessionHistory | 按关键词搜索历史会话 |
| 关闭开关 | `memory-service.ts` setEnabled | 可关闭记忆提取 |
| 管理面板 | `MemoryPanel.tsx` | IPC handler 注册了完整 MEMORY_* channel |

## 待完善

| 功能点 | 描述 | 任务 |
|---|---|---|
| LLM 提取替代正则 | 当前用正则匹配模式提取，非 LLM 驱动 | 【P3-m1】改为后台异步调用 LLM 从整段会话中提取，提升质量 |
| 定时自动整理 | plan 要求"每晚自动整理" | 【P3-m2】用 scheduler 每天凌晨跑一次全局提取 |
| UI 面板对接 | MemoryPanel 已存在但未接入实际 IPC 调用 | 【P3-m3】前端对接 MEMORY_LIST/EDIT/DELETE/CLEAR |

## 实现文件

```
src/components/MemoryPanel.tsx          - 记忆管理面板
src/main/services/memory-service.ts     - 记忆服务
src/lib/memory-types.ts                 - 记忆类型定义
```
