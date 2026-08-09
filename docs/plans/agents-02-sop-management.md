# agents-02 — SOP 创作与管理

> 对应文档: `docs/prd/agents-003-sop-management.md`  
> Tech Spec: `docs/tech-spec/agents-002-sop.md`  
> 关联: [agents-01](agents-01-expert-management.md)、[agents-01-1 Scope 工作台](agents-01-1-editor-ux.md)  
> Status: 🟡 Phase A 可演示（编辑器 MVP / 蒸馏 mock）

## 功能概要

补齐 **SOP 从哪来**：在已有专家 Scope 归属工作台（agents-002）之外，建设 SOP **创作台**——列表、蒸馏编辑器、版本与发布，并与 Scope「复制归属」衔接。

**不做（本 plan）：** 改写 agents-002 的 scope/import UX；专家编辑器内绑资源。

## 分期任务

### Phase A — SOP 列表（创作模式） ✅

- [x] 区分 PluginPanel SOP 区「创作模式 / 归属模式」入口与文案（`SopWorkbench`）
- [x] 我的 SOP 库列表：搜索、状态筛选、空态 CTA（`SopLibraryPanel`）
- [x] CRUD：`sop:list` / `create` / `update` / `delete` 接本地 sop-service + 合格 seed（≥3 条）
- [x] 生命周期按钮：publish / draft / archive（本地状态机）

### Phase B — 蒸馏编辑器 🟡 MVP

- [x] 大模态左右栏：对话蒸馏 + 步骤/节点预览（非完整拖拽画布）
- [x] 空白新建进入编辑器
- [x] 蒸馏 mock（分步进度 + 生成 SkillCard）；真实 SSE TODO
- [x] 步骤文本编辑 + 保存 `contentJson`
- [ ] 文件上传提取（md/docx/txt）— 未做
- [ ] 流程图拖拽画布 — 未做

### Phase C — 发布与版本 🟡 部分

- [x] 版本列表 / 回滚（`SopVersionDialog`）
- [x] 发布后 version++ 与快照
- [x] 从广场复制到我的库（非 bindings）
- [ ] 删除版本在极端并发下的边界 — 基础可用

### Phase D — 与 Scope 工作台衔接 🟡 部分

- [x] 发布成功 CTA → 打开归属模式（agents-002）
- [x] Scope 复制源仍为 published（广场规则：isOverall）
- [ ] L3 全链路人工验收（脚本 `scripts/verify-sop-library.mjs` 已备，需 Electron CDP）
- [x] 更新 `docs/README.md` 状态（行为符合 Phase A + 编辑器 MVP）

### Phase E — 用户权限隔离 🟡 桌面可演示（依赖 auth-01）

> 产品模型已在 PRD/Tech Spec 锁定：**「我的库」按用户权限隔离，不是本机全员共享。**  
> 身份来自 [auth-01](./auth-01-access-control.md)；本 Phase 消费 actor，不另建用户表。

- [x] 数据模型补齐 `tenantId` / `ownerUserId`；迁移/seed 归属会话用户（grants 仍后置）
- [x] 主进程会话注入 actor；所有 `sop:*` IPC 服务端按身份过滤与鉴权（不信任 renderer 自报 userId）
- [x] `sop:list` / `get`：仅返回当前用户有权项；草稿默认仅 owner（Phase 1：admin 可覆盖）
- [x] 写操作（update/publish/draft/archive/rollback/delete）强制 edit 检查
- [x] 广场：同租户 `isOverall && published` 可 list/clone；克隆副本 owner=当前用户
- [x] 正交性：专家 bindings 未放宽库 edit
- [x] Phase 1 本地会话模拟：代码标注 `TODO: replace with real auth session`
- [ ] grants 细粒度；云端 JWT；L3 全过后再标 ✅

## 改动范围（预估）

```
新增/大改:
  src/components/SopLibraryPanel.tsx
  src/components/SopDistillEditor.tsx
  src/components/SopVersionDialog.tsx
  src/components/SopWorkbench.tsx
  src/main/services/sop-service.ts
  src/lib/sop-types.ts
  src/lib/types.ts                            ← IPC_CHANNELS 扩展
  scripts/verify-sop-library.mjs

可能改动:
  src/components/SopSkillsPanel.tsx           ← 模式衔接文案 / onGoCreate
  src/components/PluginPanel.tsx              ← SopWorkbench
  src/main/services/ipc-handlers.ts
  src/main/services/resource-mocks.ts
  src/components/pickers/SopSkillPicker.tsx

Phase E（权限，待开发）额外可能改动:
  src/main/services/sop-service.ts            ← actor 过滤 / owner 字段
  src/lib/sop-types.ts                        ← tenantId / ownerUserId
  会话 / auth 注入点（主进程）                 ← 禁止 renderer 自报身份鉴权
```

## 验收

| 标准 | L1 | L2 | L3 | 备注 |
|------|:--:|:--:|:--:|------|
| 创作台列表 CRUD + 生命周期 | ✅ | ✅ | ✅ | `scripts/verify-sop-library.mjs` 8/8（CDP 9222） |
| 蒸馏编辑器可用 | ✅ | ✅ | ✅ | MVP：步骤文本 + mock 蒸馏；打开编辑器已验 |
| 版本回滚 | ✅ | ☐ | ☐ | IPC + 弹窗已接线，脚本未覆盖回滚点击 |
| 发布 → Scope 归属衔接 | ✅ | ✅ | ✅ | L2 publish + L3 切到「专家归属」；复制绑专家沿用 agents-002 |
| 用户权限隔离（Phase E） | ✅ | ✅ | ✅ | `verify-auth-unit` + `verify-auth.mjs`（CDP：me/隔离/成员面板） |

> 声称通过时必须附 L1/L2/L3 表；UI 必须以 L3 为准。  
> 权限相关不得用「本机只有一个用户所以等于隔离」代替验收。
