---
id: settings-001
title: AI 模型配置（BYOK / 租户共享）
type: prd
related: [architecture-01]
---

## 概述

BspBuddy 支持两种模型供给模式。用户可以在设置页管理自己的 API key，控制 key 是否上传后端（多端共享）还是仅存本机（隐私优先）。企业管理员可以为租户配置共享模型池，Web/移动端用户无需自行配置 key 即可使用。

---

## 用户场景

| 角色 | 场景 | 动机 |
|------|------|------|
| 个人桌面用户 | 用自己的 DeepSeek key，key 不想离开本机 | 隐私优先：API key 是个人敏感凭据，不应上传到任何服务器 |
| 个人桌面用户 | 用自己的 key，希望在桌面和手机都能用 | 便利优先：key 加密上传后端，多端统一调用 |
| Web 浏览器用户 | 注册后直接开始对话，不想配置 key | 零摩擦力：团队管理员已配好共享 key |
| 企业管理员 | 给团队买了 100 万 token，按租户统一分配 | 集中管理：一人配置，全员共享，配额可控 |
| 企业管理员 | 查看团队用量，停用某个不再需要的模型 | 运维：管理员的模型生命周期管理 |

---

## 功能清单

| # | 功能 | 关联页面 | 说明 |
|---|------|---------|------|
| 1 | 添加个人模型 | 设置 → AI 设置 → 添加 | 填写名称、Base URL、API Key、模型名 |
| 2 | 仅本机保存 | 添加/编辑表单 | **桌面端默认**：key 不上传后端，仅存本地文件。可手动取消以上传后端 |
| 3 | 上传后端 | 添加/编辑表单 | 取消「仅本机保存」后：key 加密存储到后端，多端可用 |
| 4 | 测试连接 | 模型列表 | 验证后自动启用，首个模型自动设为默认 |
| 5 | 设为默认 | 模型列表 | 对话中未指定模型时使用 |
| 6 | 启用/停用 | 模型列表 | 暂时禁用某个配置，不删除 |
| 7 | 编辑模型 | 模型列表 → 编辑 | 改 key、改 base URL、改参数 |
| 8 | 模型列表 | 设置 → AI 设置 | 查看所有已配置模型及状态 |
| 9 | 对话模型选择器 | 聊天页 / 欢迎页 | 下拉选模型，优先展示已启用后端模型 |
| 10 | 租户共享模型（管理员） | 设置 → AI 设置 | 管理员创建的模型自动为租户共享，Web/移动端可见 |

---

## 数据模型

### ModelConfig（后端 SQLite，已存在）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | UUID，`model-` 前缀 |
| tenant_id | string | 是 | 租户 ID |
| name | string | 是 | 用户可读名称，如「DeepSeek 生产」 |
| provider | string | 是 | 固定 `openai_compatible` |
| api_protocol | string | 是 | `openai_chat_completions` / `anthropic_messages` / `gemini_generate_content` |
| base_url | string | 否 | API 端点，如 `https://api.deepseek.com/v1` |
| api_key_encrypted | string | 是 | Fernet 加密后的 API key |
| model | string | 是 | 模型标识，如 `deepseek-chat` |
| temperature | float | 是 | 默认 0.2 |
| max_output_tokens | int | 是 | 默认 8192 |
| trust_status | string | 是 | `unverified` → `verified`（测试连接通过后） |
| is_default | bool | 是 | 租户内唯一默认 |
| enabled | bool | 是 | API key 验证通过且未停用 |

### 新增字段（需加）

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| **storage_mode** | string | 是 | `cloud` | `local` = key 仅存本机 / `cloud` = key 上传后端 |
| **scope** | string | 是 | `personal` | `personal` = 仅自己可见 / `tenant` = 租户内共享（管理员创建时可选） |

### 本地存储（桌面专用）

```
%APPDATA%/BspBuddy/model-configs.json
```

仅在 `storage_mode = local` 时写入。JSON 结构：

```json
{
  "<config_id>": {
    "id": "model_abc123",
    "name": "DeepSeek 本机",
    "model": "deepseek-chat",
    "baseUrl": "https://api.deepseek.com/v1",
    "apiKey": "sk-abc...",
    "enabled": true,
    "isDefault": true,
    "storageMode": "local",
    "scope": "personal",
    "createdAt": "2026-08-09T..."
  }
}
```

---

## 页面与字段

### 设置 → AI 设置（列表页）

```
┌─────────────────────────────────────────────────────────────┐
│ ← 返回     AI 模型配置                              [+ 添加]  │
│                                                             │
│  已配置 3 个模型，2 个已启用                                 │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [默认] DeepSeek (已验证 ✓)                测试 停用 ···  │ │
│ │  deepseek-chat · openai_chat_completions · 上传后端      │ │
│ │  sk-****ab12 · 温度 0.2 · Token 8,192                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 本地模型 (已验证 ✓ 仅本机 🔒)          测试 启用 ···    │ │
│ │  gpt-4o · openai_chat_completions · 仅本机              │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 添加/编辑表单

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 配置名称 | text | 是 | 用户可读，如「DeepSeek 生产环境」 |
| 协议 | select | 是 | `openai_chat_completions` / `anthropic_messages` / `gemini_generate_content` |
| Base URL | text | 是 | API 端点地址 |
| API Key | password | 是 | 填写时明文，保存后只展示掩码 `sk-****abcd` |
| 模型名 | text | 是 | 如 `deepseek-chat`、`gpt-4o` |
| Temperature | number | 否 | 0.0–2.0，默认 0.2 |
| 最大 Token | number | 否 | 默认 8192 |

**仅桌面端可见的额外字段：**

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| **[仅本机保存]** | checkbox | 勾选（默认） | 勾选后 API key 不上传后端，仅存本机文件。**桌面端专属选项**——Web/移动端不存在本地文件系统，此字段不渲染 |

### 平台差异规则

| 字段 | 桌面端 (Electron) | Web 端 | 移动端 (Capacitor) |
|------|:--:|:--:|:--:|
| [仅本机保存] | ✅ 显示，默认勾选 | ❌ 不显示 | ❌ 不显示 |
| [租户共享] | 管理员可见 | 管理员可见 | 管理员可见 |
| 存储位置 | 默认本机 JSON（可改为后端） | 必走后端 | 必走后端 |
| LLM 调用路径 | 默认本机直连（取消后走后端代理） | 后端代理 | 后端代理 |

**管理员可见的额外字段：**

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| **[租户共享]** | checkbox | 不勾选 | 勾选后该模型对租户内所有成员可见（含 Web/移动端） |

### 按钮权限条件

| 按钮 | 条件 |
|------|------|
| 测试连接 | 填写了 Base URL + API Key + 模型名 |
| 启用 | trust_status = verified |
| 设为默认 | enabled = true |
| 编辑 | 自己的模型（scope=personal）或管理员（scope=tenant） |

### ModelSelector 下拉分组（桌面端）

本地模型与云端模型不混排，按来源分组带标题：

```
┌─ 本机模型 ────────────────────┐
│ DeepSeek            🔒 本机   │
│ deepseek-chat · 直连          │
├─ 云端模型 ────────────────────┤
│ DeepSeek            🌐 云端   │
│ deepseek-chat · openai_chat_..│
└───────────────────────────────┘
```

- 每个模型名称右侧紧跟来源标记（🔒 本机 / 🌐 云端），同名也不混淆
- 选中后按钮上同步显示当前模型的来源标记
- Web/移动端只有云端模型一个分组，无「本机模型」标题
- 两个分组都为空时回退展示硬编码的 `AVAILABLE_MODELS` 列表

---

## API 依赖

| 端点 | 触发 | 权限 |
|------|------|------|
| `GET /api/enterprise/model-configs` | 进入设置页 / ModelSelector 加载 | 登录用户 |
| `POST /api/enterprise/model-configs` | 添加模型（storage_mode=cloud 时） | 登录用户 |
| `PUT /api/enterprise/model-configs/{id}` | 编辑模型 | 创建者 / 管理员 |
| `POST /api/enterprise/model-configs/{id}/set-default` | 设为默认 | 创建者 / 管理员 |
| `POST /api/enterprise/model-configs/{id}/test` | 测试连接 | 创建者 / 管理员 |
| `POST /api/chat/proxy/send` | 发送对话消息 | 登录用户 |

### storage_mode = local 时

- `POST /api/enterprise/model-configs` **不传 `api_key` 字段**，后端创建空 key 占位
- 或者**完全不调后端 CREATE**，仅存本地 JSON
- 测试连接由**本地直连**而非后端代理完成

---

## 页面关系

| From | To | 数据耦合 |
|------|----|---------|
| 设置面板 | AI 设置页 | 无 |
| AI 设置页 | 添加/编辑表单 | 表单数据独立 |
| AI 设置页 | 测试连接 | 传 model config id |
| 聊天页 | ModelSelector | 从后端列表 + 本地列表合并加载 |
| 欢迎页 | ModelSelector | 同上 |

---

## 交互链

```
进入设置 → AI 设置
  → [添加模型] → 填写表单
    → 桌面端默认勾选 [仅本机保存]
      ├─ 保持勾选 → key 写本地 JSON → 列表刷新（标记 🔒 本机）→ 对话直连
      └─ 取消勾选 → key 上传后端加密 → 列表刷新（标记 🌐 云端）→ 对话走后端代理
    → [测试连接]
      ├─ 本机 → 本地 AIService 直连测试
      └─ 云 → POST /test → 后端验证 → 自动启用 → 设为默认（首个）
  → 回到聊天页 → ModelSelector 加载列表 → 选择模型
  → 发消息 → IPC → modelId 前缀 local_ → 本机直连 / 否则后端代理 → 回复
```

### Web/移动端特殊逻辑

```
进入 AI 设置（Web/移动端）
  → [添加模型] → 填写表单
    → 无「仅本机保存」选项，API Key 必须上传后端
  → 如果租户已有管理员配置的共享模型 → 列表直接展示，无需自行配置
```

---

## 验收标准

- [ ] 桌面端添加模型 → 默认勾选「仅本机」→ key 写本地 JSON，不上传后端 → 对话使用本地 key 直连 LLM
- [ ] 桌面端添加模型 → 取消勾选「仅本机」→ key 上传后端加密 → 测试连接 → 对话走后端代理
- [ ] Web/移动端添加模型 → 无「仅本机」选项 → 只能上传后端 → 对话走后端代理
- [ ] 管理员添加模型 → 勾选「租户共享」→ Web 端不配 key 直接可用
- [ ] ModelSelector 下拉展示本机模型 + 后端模型合并列表，标记来源
- [ ] 已启用模型或已设为默认的模型不允许本机存储随意删除——删除需确认并清空关联
