# 14 — 灵感与探索 (Inspiration + Exploration)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Ispiration.md`, `specs/From-Beginner-to-Expert-Guide/Exploration.md`
> (探索与灵感为同一功能，探索页面 404 但内容同灵感)
> Status: ❌ P3 待开发

## 功能概要

不知道从哪开始？打开灵感，浏览精选作品案例。一键「做同款」自动预填 Prompt + 加载 Skill + 配置专家，零门槛生成专属版本。

## 一、核心特性

| 特性 | 说明 |
|------|------|
| 七大场景全覆盖 | 日常和工作高频需求，按需挑选 |
| 一键复刻 | 选中案例自动预填 Prompt/Skill/专家 |
| 节省 Token | 精调案例上下文，减少冗余消耗 |
| 社区智慧 | 复用高手经验，掌握最佳实践 |

## 二、操作流程

### 进入
- 左侧边栏 → 更多 → 灵感
- 精选板块随机展示热门案例
- 按场景分类搜索

### 选择案例
- 点击案例 → 查看预览 + 工具集 + 详情
- **红心收藏**喜欢的案例

### 做同款
- 点击「制作我的版本」
- 自动预填 Prompt + 加载关联 Skill + 专家配置
- 可直接生成，或修改细节后生成

### 成果查看
- 右侧产物页面查看结果
- 生成网页文件时**自动打开内置浏览器预览**

## 三、灵感 vs Skill vs 专家

| 模块 | 角色 | 回答的问题 |
|------|------|------------|
| Skill | 能力 | WorkBuddy 能做什么 |
| 专家 | 能力 | WorkBuddy 中的谁能帮我做 |
| 灵感 | 成果 | 用这些能力实际做出了什么 |

## 四、积分消耗

- 浏览: 不消耗积分
- 做同款: 按实际触发的 Skill/专家模块消耗

## 五、实现任务 (实现细节)

### 14-1 灵感页面 (`src/components/InspirationPanel.tsx`)

- 分类浏览: 按七大场景分类
- 案例卡片: 预览图 + 名称 + 使用的 Skill/专家 + 红心收藏
- 案例详情: 预览(内置浏览器) + 工具集 + 描述

### 14-2 做同款流程

```typescript
interface InspirationPreset {
  prompt: string
  skillIds: string[]
  expertId?: string
  previewUrl?: string
}
```

- 点击「制作我的版本」→ 载入 Preset → 填入对话输入框(可修改) → 发送
- 关联 Skill/专家自动就位

### 14-3 IPC 通道

```
INSPIRATION_LIST: 'inspiration:list'
INSPIRATION_DETAIL: 'inspiration:detail'
INSPIRATION_FAVORITE: 'inspiration:favorite'
INSPIRATION_FORK: 'inspiration:fork'   // 做同款
```

## 六、验收标准

- [ ] 灵感页面 → 七大场景分类浏览
- [ ] 选择案例 → 预览 + 工具集 + 红心收藏
- [ ] 做同款 → 自动预填 Prompt + Skill + 专家 → 一键生成
- [ ] 生成网页 → 内置浏览器自动预览
- [ ] 浏览灵感不消耗积分
