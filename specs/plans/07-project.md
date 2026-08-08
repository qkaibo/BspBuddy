# 07 — 项目协作 (Project Collaboration)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Project.md`
> Status: ❌ P3 待开发

## 功能概要

团队协作能力：项目和任务两层结构，成员共享上下文、标准与知识。项目承载指令/连接器/专家/技能/资料等共享配置；任务在项目中创建，支持分享、转交和协作。

## 一、项目配置

| 配置项 | 说明 |
|--------|------|
| 名称 | 项目标识 |
| 指令 | 对 AI 的全局行为规则，所有任务自动继承 |
| 连接器 | 项目可用的外部服务，支持公共授权和个人授权 |
| 专家 | 项目可召唤的领域专家 |
| 技能 Skill | 项目可调用的技能包 |

## 二、核心能力

### 项目动态

| 类别 | 包含事件 |
|------|----------|
| 与我有关 | 别人定向分享/转交任务给我 |
| 成员动态 | 上传/更新文件、邀请成员、公开任务、增删 Skill/专家/连接器、更改指令 |
| 自动化 | 自己创建的自动化任务通知(仅自己可见) |

### 项目管理

- 创建: 左侧导航栏 → 项目 → + 新建 → 填写名称/指令/连接器/Skill/专家
- 模板: 预设业务模板，选择后自动预填配置，可在此基础上修改
- 邀请成员: 右上角邀请 → 复制链接 → 被邀请人点击链接并填写备注 → 管理员在消息中心审批
- 管理: 项目卡片 → 项目详情页，支持搜索

### 任务 (对话会话)

- 项目中创建任务: 项目详情页底部输入框
- 创建时自动注入: 项目指令(拼入上下文) + 项目资料库(reference形式) + 个人记忆

**任务中专家/Skill/连接器选择范围:**

| 配置项 | 选择范围 | 排序规则 |
|--------|----------|----------|
| 专家 | 项目专家 + 个人专家 + 专家中心所有 | 项目专家置顶 |
| Skill | 项目Skill + 已安装Skill + 现场导入Skill | 项目Skill置顶 |
| 连接器 | 公共授权 + 项目个人授权 + 连接器管理 | 公共授权置顶 |

### 资产/资料库

- 访问: 项目详情页 → 资产标签页
- 存储: 每个项目独立空间(默认 5GB)，依托腾讯网盘
- 文件类型: 文档/表格/幻灯片/PDF/图片/视频/音频/URL书签/Markdown/其他
- 上传来源: 本地文件 / 产物文件
- 实时显示已用空间

### 分享与转交

- 分享: 任务顶栏邀请按钮 → 复制链接 → 他人打开进入同一会话
- 转交: 顶栏流转图标 → 打包产物+进度摘要+标题/描述/处理人/状态/截止日期+附件 → 移交

### 连接器授权模式 (双授权)

| 授权方式 | 说明 | 票据位置 |
|----------|------|----------|
| 公共授权 | 管理员配置一次，全员共用 | 云端 |
| 个人授权 | 每人各自授权，票据不共享 | 仅本地，不上云 |
| 同时存在 | 同一连接器两种方式可并存 | — |

**关键约束 (SPEC明确)**:
- 协作任务中个人授权连接器全部禁用，仅公共授权连接器可用
- 公共授权连接器调用日志仅管理员可见(审计合规)

### 自动化 (项目级)

- 仅定时执行一种触发形态
- 个人级别，仅创建者可见可管理

## 三、实现任务 (实现细节)

### 07-1 项目数据模型 (`src/lib/project-types.ts`)

```typescript
interface Project {
  id: string; name: string; description?: string
  instructions: string           // 全局指令
  connectors: ConnectorConfig[]  // 公共授权 + 个人授权
  skills: string[]; experts: string[]
  members: ProjectMember[]
  storage: { used: number; limit: number } // 默认 5GB
  assets: ProjectAsset[]
  createdAt: number
}

interface ProjectMember {
  userId: string; role: 'admin' | 'member'
  joinedAt: number
}

interface ProjectAsset {
  id: string; name: string; type: string
  url: string; size: number
  uploader: string; uploadedAt: number
}

interface ProjectTask {
  id: string; projectId: string
  title: string
  status: 'todo' | 'in_progress' | 'done'
  assignee?: string; deadline?: number
  conversationId?: string       // 对话会话 ID
}
```

### 07-2 项目页面 (实现细节)

**文件**: `src/components/ProjectPanel.tsx`

- 项目列表(搜索) / 项目详情
- 动态标签页(与我有关/成员动态/自动化)
- 任务标签页(发起/列表)
- 资产标签页(上传/浏览/文件列表+更新追踪)
- 邀请成员流程(链接复制 → 审批)
- 任务分享/转交 UI

### 07-3 Web 与桌面端 Skill 库分离

```typescript
// 项目Skill → 云端统一, 双端一致
// 个人Skill → Web端和桌面端互不相通
// 任务中选择Skill时: 桌面任务只能选桌面个人Skill, 云上任务只能选云上个人Skill
```

### 07-4 IPC 通道

```
PROJECT_LIST/CREATE/UPDATE/DELETE: 'project:*'
PROJECT_MEMBER_ADD/REMOVE: 'project:member:*'
PROJECT_ASSET_LIST/UPLOAD: 'project:asset:*'
PROJECT_TASK_CREATE/SHARE/TRANSFER: 'project:task:*'
```

## 四、验收标准

- [ ] 创建项目并配置指令/连接器/专家/Skill
- [ ] 邀请成员 → 链接 → 填写备注 → 管理员审批 → 加入
- [ ] 项目内创建任务 → 自动注入项目指令/资料库/个人记忆
- [ ] 任务分享 → 他人可打开并加入会话
- [ ] 任务转交 → 产物+进度摘要+附件打包移交
- [ ] 上传文件到项目资产 → 显示上传者和时间
- [ ] 公共授权连接器 → 全员可用; 个人授权 → 仅自己可用
- [ ] 协作任务中个人授权连接器被禁用
