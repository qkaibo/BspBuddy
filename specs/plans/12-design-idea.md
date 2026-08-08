# 12 — Ardot 设计创意 (Design-Idea)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Design-Idea.md`
> Status: ❌ P3 待开发

## 功能概要

WorkBuddy 深度集成腾讯设计 Ardot 画布：在对话中一句话生成 UI、PPT、海报等设计稿，对话实时修改，云端双向同步，一键跳转 Ardot 精细化编辑，满意后生成应用代码。

> Ardot 是腾讯自研 AI 设计智能体协作平台。本功能依赖 Ardot API 和云端服务。本地独立开发需 Ardot API key 或使用模拟数据。

## 一、连接流程

1. 打开 WorkBuddy 首页，点击「新建任务」，选择最右侧的**设计创意 Tab**
2. 首次使用弹出授权窗口。WorkBuddy 通过登录手机号自动完成与 Ardot 的身份关联，无需单独注册 Ardot 账号

### 授权权限详情

| 权限 | 说明 |
|------|------|
| 读取画布内容 | 读取设计稿中的元素、样式、布局信息 |
| 编辑画布 | 代表用户在 Ardot 画布上执行新增、修改、删除等设计操作 |
| 云端同步 | 与 Ardot 浏览器端保持实时双向同步 |

连接后所有设计稿存储在云端，换电脑、重新登录均不会丢失。

## 二、核心能力

### 对话生成设计稿

进入设计创意模式后，用自然语言描述设计需求，AI 实时在 Ardot 画布上生成。

**支持的设计类型**: 移动端 App 界面、网站页面/Landing Page、品牌 Logo、海报/Banner、PPT 演示文稿。

### 对话驱动修改

三种修改方式：

| 方式 | 操作 | 适用场景 |
|------|------|----------|
| 智能框选 + 对话 | 在画布中选中位置，描述修改，发送 | 局部精准调整 |
| 纯语言指挥 | 直接在对话中描述修改需求 | 全局调整 |
| 粘贴参考 | 粘贴网页链接或上传参考图片 | 参考其他设计风格 |

每轮修改后，Agent 告知具体改动内容，过程可追溯。

### 跳转 Ardot 精细化编辑

画布 Tab 顶部「用浏览器打开进行编辑」按钮 → 跳转 Ardot 完整编辑器。

Ardot 编辑器能力:
- 所见即所得拖拽编辑
- 像素级精确对齐和间距
- 组件化编辑保持设计一致性
- PNG/SVG/PDF 多格式导出，支持切图标注
- 双向实时同步：Ardot 修改实时回流 WorkBuddy，Agent 可读取最新状态继续对话修改

### 从设计稿生成应用代码

两种触发方式：
- 对话中说「将当前画布中的设计稿生成应用」
- 点击画布 Tab 顶部「生成应用」按钮

生成后可继续用对话调整代码细节，如「用 React 重写」「加 dark mode」「改成 Tailwind 样式」。

## 三、实现任务

### 12-1 设计创意 Tab

**文件**: `src/components/DesignCreativeTab.tsx`

- 新建任务时作为第三个 Tab（Ask / Craft / Plan 之外）
- 进入后显示 Ardot 画布区域（与 04-results 的 Browser Preview 不同）
- 顶栏按钮：「用浏览器打开进行编辑」「生成应用」

### 12-2 Ardot 画布集成

**文件**: `src/main/services/ardot-service.ts`

```typescript
interface ArdotCanvas {
  id: string
  elements: DesignElement[]
  syncedAt: number
}

interface DesignElement {
  id: string
  type: 'rectangle' | 'text' | 'image' | 'button' | 'input'
  x: number; y: number; width: number; height: number
  style: Record<string, string>
  content?: string
}
```

- 画布状态管理：读取/更新/同步
- 与 Ardot 云端 API 通信（或本地模拟）
- 双向同步协议：WebSocket 实时推送画布变更

### 12-3 Agent 设计工具

```typescript
// 工具: design_generate
// 描述: 在 Ardot 画布上生成设计稿
// 参数: { description, type (ui|poster|ppt|logo) }

// 工具: design_edit
// 描述: 修改画布中的设计元素
// 参数: { elementId?, instruction }

// 工具: design_export
// 描述: 导出设计稿为代码
// 参数: { format: 'html' | 'react' | 'vue' }
```

### 12-4 IPC 通道

```typescript
DESIGN_CONNECT: 'design:connect'       // 连接 Ardot (授权)
DESIGN_GENERATE: 'design:generate'     // 生成设计
DESIGN_EDIT: 'design:edit'             // 修改设计
DESIGN_EXPORT: 'design:export'         // 导出代码
DESIGN_SYNC: 'design:sync'             // 画布同步事件
```

### 12-5 环境依赖

| 依赖 | 说明 | 本地方案 |
|------|------|----------|
| Ardot API | 腾讯设计 Ardot 云端服务 | 需要 Ardot API key；无 key 时使用本地 mock 画布 |
| 手机号登录 | 用于自动关联 Ardot 身份 | 对接现有登录系统 |
| 浏览器 | 跳转 Ardot 编辑器使用 | Electron 内嵌或外部浏览器 |

## 四、验收标准

- [ ] 设计创意 Tab → 输入「设计一个移动端登录页」→ Ardot 画布生成 UI
- [ ] 对话修改「把按钮改成蓝色」→ 画布实时更新
- [ ] 「用浏览器打开进行编辑」→ 跳转 Ardot 编辑器
- [ ] 「生成应用」→ 输出 React/HTML 代码
- [ ] 粘贴参考链接 → 画布风格调整
