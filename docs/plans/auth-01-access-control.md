---
id: auth-01
title: 全产品身份与访问控制
type: plan
related: [auth-001, auth-001-api, agents-003, agents-002-sop, 10-permission, agents-02]
---

# auth-01 — 全产品身份与访问控制

> 对应 PRD: [auth-001](../prd/auth-001-access-control.md) · Tech Spec: [auth-001-api](../tech-spec/auth-001-session-and-rbac.md)  
> Status: 🟡 Phase A–C 桌面可演示（本地会话 + 成员 UI + SOP actor 过滤）；云端 IAM / 完整登录壳未做  
> Priority: 与 Agents 域权限对接相关；**勿与 plan 10（Agent Permission Modes）混名**

## 功能概要

统一 BspBuddy 的登录会话、租户成员与角色（RBAC），向 SOP/专家等资源 ACL 提供 `actor`，并与 Agent 工具沙箱（[10-permission](./10-permission.md)）保持文档与实现双轨分离。

```
auth（本 plan）
  ├─ 资源 ACL 对接（如 SOP Phase E）
  └─ Agent Permission Modes（plan 10）——交叉引用，不合并实现
```

## 分期任务

### Phase A — 会话身份统一 ✅ 桌面可演示

- [x] 主进程 `auth-service`：`Actor { tenantId, userId, username, roles }`
- [x] Phase 1 单用户模拟（`tenant_id=local`），claims 形状对齐 Tech Spec；种子 admin/zhangsan/lisi
- [x] IPC：`auth:me` / `auth:login` / `auth:logout`（本地 mock + pbkdf2）
- [x] 领域 handler 样板：sop:* 从 session 注入 actor，拒绝 renderer 自报 userId
- [x] 文档/注释标注 `TODO: replace with real auth session`
- [ ] 独立登录视图（`activeView: login`）— Phase 1 用自动本地会话跳过 UI

### Phase B — 成员与角色 UI ✅ 可演示（L3 需人工/CDP）

- [x] 设置面板入口「成员与角色」+「当前账号」+ Phase 1「切换模拟用户」
- [x] 管理员：列表 / 新建 / 编辑 / 禁用；角色 member|admin
- [x] 非管理员：无破坏性按钮；API 403
- [x] 保护：不可删自己；不可移除最后一个 admin
- [x] L3：实际启动应用走通管理主路径（`scripts/verify-auth.mjs` CDP 9222：设置→成员与角色）

### Phase C — 资源 ACL 对接（SOP Phase E）🟡 桌面可演示

- [x] sop:* 全量带 actor 过滤（owner 或 admin；广场按 tenant+published+isOverall）
- [x] 种子 / 迁移写入 `ownerUserId` / `tenantId`
- [x] 多账号切换后 list 不泄露他账号草稿（单元规则 + IPC 脚本）
- [x] 专家 bindings 仍正交（未放宽库 edit）
- [ ] grants 细粒度；与 FastAPI 云端 JWT 对齐 — 待后续
- [ ] README / agents-02 状态仅在 L3 全过后再标 ✅

### Phase D — 与 plan 10 交叉引用（文档 + 边界）✅

- [x] Composer「默认权限」文案不出现「管理员/成员角色」语义（保持工具沙箱表述）
- [x] auth 设置页 / 成员页脚注指向：工具沙箱见权限模式；资源权见各创作台
- [x] RBAC 服务命名为 `auth-service`（不复用 `permission-service`）
- [x] 保持 [10-permission](./10-permission.md) 仅描述 Agent Permission Modes

## 改动范围（预期）

```
docs/prd/auth-001-access-control.md          — 已起草
docs/tech-spec/auth-001-session-and-rbac.md  — 已起草
src/lib/auth-types.ts                        — 已建
src/main/services/auth-service.ts            — 已建
src/main/services/ipc-handlers.ts            — auth:* + sop actor 注入
src/components/SettingsPanel.tsx             — 当前账号 / 切换用户 / 入口
src/components/MemberRolesPanel.tsx          — 已建
src/lib/types.ts / sop-types.ts              — 通道 + owner 字段
src/main/services/sop-service.ts             — Phase C 过滤
scripts/verify-auth.mjs / verify-auth-unit.mjs
```

## 验收标准（计划级）

- [x] Phase A：任意受保护 sop IPC 具备 actor；无会话失败可预期
- [x] Phase B：管理员可管理成员；成员不可（API + UI 分支）
- [x] Phase C：SOP「我的库」按用户隔离（桌面本地；L2 单元 + 脚本）
- [x] Phase D：文档与 UI 不将 plan 10 与 auth RBAC 混称
- [x] 不得在 Phase A 未完成时把多用户 ACL 标 ✅（现标 🟡 可演示）

## 依赖与交叉引用

| 文档 | 关系 |
|------|------|
| auth-001 / auth-001-api | 本 plan 的产品与技术权威 |
| agents-02 Phase E | 首个资源 ACL 落地消费者 |
| agents-003 / agents-002-sop | SOP ACL 细则；身份从属 auth |
| 10-permission | 仅 Agent 沙箱；实现排期可并行但模型独立 |
