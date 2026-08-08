# 11 — 记忆系统 (Memory)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Memory.md`
> Status: ❌ P3 待开发

## 功能概要

WorkBuddy 从会话历史中提取个人信息形成记忆数据，在后续对话中作为背景信息参考。对话越多，越懂用户。记忆数据仅用户本人可见，每晚整理，可编辑/删除/关闭。

## 一、记忆类型 (SPEC 明确)

从会话中提取的记忆类型:
- **事实信息**: 如职业、公司、所在地等
- **偏好习惯**: 如喜欢的输出格式、常用工具等
- **人物关系**: 如"XX 是我的老板"、"YY 是产品经理"
- **近期跟进事项**: 如"最近在处理 XX 项目"

## 二、核心特性

| 特性 | 说明 |
|------|------|
| 提取频率 | **每晚自动整理**当天会话 |
| 可见性 | 仅本人可见，不共享给第三方 |
| 使用方式 | 注入系统提示词作为上下文 |
| 检索 | 支持会话历史搜索 (如「上周做过什么」「之前聊过的XX」) |

## 三、管理记忆

### 访问入口
- 左下角头像 → 设置 → 记忆

### 查看
- 记忆摘要每晚重新生成
- 打开可查看记忆内容

### 编辑 (对话式编辑)
- 点击右上角编辑图标 → 唤起对话框
- 通过对话的方式告诉 WorkBuddy 要记住或忘记什么

### 删除
- 点击右上角删除图标 → 清空当前记忆

### 导入记忆 (SPEC 流程)

从其他 AI 产品迁移记忆：

1. 点击开始导入
2. 复制示例提示词到其他 AI 产品的对话中
3. 将结果粘贴到下方
4. 点击添加到记忆完成导入

### 一键关闭
- 关闭后不再提取新记忆
- 已生成记忆停止用于后续对话

## 四、积分消耗

**免费**: 记忆提取由 WorkBuddy 自费完成，不额外消耗用户的 token/积分。

## 五、安全与隐私

- 记忆数据仅内部使用，不共享给第三方
- 会话涉及他人个人信息需获得授权
- 关闭/删除后已生成输出不会追溯撤回

## 六、实现任务 (实现细节)

### 11-1 数据模型 (`src/lib/memory-types.ts`)

```typescript
interface MemoryEntry {
  id: string
  type: 'fact' | 'preference' | 'relationship' | 'follow_up' // SPEC 四种类型
  content: string
  source: string          // 源于哪次对话
  confidence: number
  createdAt: number
  updatedAt: number
}

interface MemoryStore {
  entries: MemoryEntry[]
  lastExtractedAt: number
  enabled: boolean         // 一键关闭
}
```

### 11-2 记忆服务 (实现细节)

**文件**: `src/main/services/memory.ts`

```typescript
class MemoryService {
  // 每晚提取(定时任务)
  extractFromConversations(conversations: Conversation[]): Promise<MemoryEntry[]>
  
  // 注入到系统上下文(对话时自动注入相关记忆)
  getContextForQuery(query: string): Promise<MemoryEntry[]>
  
  // 编辑(对话式: 记住/忘记)
  editInstruction(instruction: string): Promise<void>
  
  // 导入(复制其他AI → 粘贴 → 添加)
  importFromExternal(content: string): Promise<MemoryEntry[]>
  
  // 检索会话历史
  searchSessionHistory(query: string): Promise<ConversationSummary[]>
  
  // 管理
  deleteEntry(id: string): Promise<void>
  clearAll(): Promise<void>
  setEnabled(en: boolean): Promise<void>
}
```

### 11-3 前端页面 (实现细节)

**文件**: `src/components/MemoryPanel.tsx`

- 记忆列表: 类型标签(fact/preference/relationship/follow_up) + content
- 编辑模式: 对话小面板, 输入"记住XX"或"忘记YY"
- 导入流程: 示例prompt → 复制 → 粘贴 → 添加
- 一键关闭开关
- 检索框: "上周做过什么" → 历史摘要列表

### 11-4 IPC 通道 (实现细节)

```
MEMORY_LIST/ADD/EDIT/DELETE: 'memory:*'
MEMORY_IMPORT: 'memory:import'
MEMORY_TOGGLE: 'memory:toggle'
MEMORY_SEARCH: 'memory:search:history'
```

## 七、验收标准

- [ ] 晚上自动整理当天会话 → 新记忆条目出现在记忆面板
- [ ] 对话中记住"我是软件工程师" → 后续对话自动引用
- [ ] 点击编辑 → 对话框式输入"忘记XX" → 删除对应记忆
- [ ] 点击导入 → 复制prompt给另一个AI → 粘贴结果 → 记忆添加成功
- [ ] 搜索"上周做过什么" → 返回历史摘要
- [ ] 记忆提取/编辑/使用不消耗积分
- [ ] 一键关闭 → 不再提取新记忆
