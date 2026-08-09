# 17 — 数据与设置 (Data & Settings)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Data-Settings.md`
> Status: 🟡 P3 部分完成（AI 模型配置已接入）

## 功能概要

BspBuddy 系统的全局设置和数据管理：基础设置、AI 设置、深度思考设置、高级设置、快捷键、连接器、自动化、安全设置等。

## 设置分组

| 分组 | 内容 | 状态 |
|------|------|:--:|
| 基础设置 | 语言、开机自启、通知、主题 | ✅ |
| AI 设置 | 默认模型、系统提示词、输出语言 | 🟡 模型管理 ✅ / 提示词待开发 |
| 深度思考设置 | 思考深度、步骤拆解粒度 | ❌ |
| 高级设置 | 日志级别、数据目录、缓存管理 | ❌ |
| 快捷键 | 全局快捷键配置 | ❌ |

## AI 模型配置（已完成）

- **IPC 通道**: `MODEL_CONFIG_LIST/CREATE/UPDATE/SET_DEFAULT/TEST/PROTOCOLS`
- **IPC Handler**: 桥接后端 `/api/enterprise/model-configs`（见 `src/main/services/ipc-handlers.ts`）
- **UI 页面**: `src/components/ModelConfigSettings.tsx` — 完整 CRUD + 测试连接 + 设为默认
- **入口**: 设置面板 → AI 设置（`onNavigateModelConfig`）
- **ModelSelector**: 自动从后端加载已启用模型列表，后端不可用时回退硬编码列表
- **前端类型**: `ModelConfigItem`, `ModelConfigCreateParams`, `ModelConfigUpdateParams`, `ModelConfigTestResult`（见 `src/lib/types.ts`）

### 待后续开发
- [ ] 系统提示词编辑
- [ ] 输出语言设置
- [ ] 深度思考配置
- [ ] 快捷键管理

## 实现文件

```
src/components/SettingsPanel.tsx          - 设置面板
src/components/ModelConfigSettings.tsx    - AI 模型配置管理
src/components/ModelSelector.tsx          - 模型选择器（自动加载后端列表）
src/lib/types.ts                          - 模型配置类型 + IPC 通道
src/main/services/ipc-handlers.ts         - 模型配置 IPC handler
backend/app/api/model_configs.py          - 模型配置 REST API
backend/app/db/models.py                  - ModelConfig 表定义
```

## 验收标准

- [x] AI 设置 → 管理模型配置（添加/编辑/测试/启用/设默认）
- [x] 对话页模型选择器 → 加载后端已启用模型，回退静态列表
- [x] 添加模型 → 填写 Base URL/API Key/模型名 → 测试连接 → 自动启用
- [ ] 基础设置 → 修改语言 → 立即生效
- [ ] 快捷键 → 自定义 → 冲突检测
- [ ] 数据管理 → 清理缓存 → 显示占用空间
