# agents-01-1 — 专家资源 StaffDeck Scope 工作台

> 对应文档: `docs/prd/agents-002-editor-ux.md`
> 父 Plan: [agents-01 — 专家配置管理](agents-01-expert-management.md)
> Status: ✅ 已完成

## 功能概要

按 StaffDeck 重做资源体验，区分三种资源管理模型：

| 资源 | 模型 | 操作语义 | 实现 |
|------|------|------|------|
| SOP | 复制模型 | 创作→发布→从广场/同事复制 | SopSkillsPanel + ResourceImportDialog |
| 通用技能 | **个人安装模型** | 个人创建→按需安装/卸载→内容编辑 | SkillsPanel（import dialog 仅 SOP 用） |
| MCP 服务器 | 直接配置 | URL+名称+测试→直接添加 | McpPanel |

1. **Expert Scope**（当前专家）贯穿 SOP / 通用技能 / MCP 页  
2. **SopSkillsPanel**：只列出当前专家已有 SOP + 搜索 + 从广场/同事复制  
3. **SkillsPanel**：**个人技能目录**（仅创建者可见）— 已安装 + 可安装列表，一键安装/卸载，**技能编辑器**  
4. **McpPanel**：列出当前专家 MCP 服务器 + 直接添加（URL+名称+测试连接）+ 从同事复制  
5. **专家中心**：「管理 SOP」「管理 Skill」「管理 MCP」跳转  
6. **技能编辑**：点击技能卡片 ✎ → 弹出编辑器 modal，可改 name / description / category / version / permissions。**无脚本编辑**——本地无执行引擎，真正执行走 FastAPI GeneralSkillRunner。

> **不包含 SOP 创作台**（新建/蒸馏/发布）。见 [agents-02](agents-02-sop-management.md) / PRD agents-003。

## 改动文件

```
src/lib/expert-scope.ts
src/lib/skill-types.ts                       (+ SkillUpdateParams)
src/hooks/useExpertScope.ts
src/components/SopSkillsPanel.tsx
src/components/SkillsPanel.tsx                (+ 编辑按钮 + 编辑器 modal)
src/components/McpPanel.tsx                   (+ new)
src/components/PluginPanel.tsx
src/components/ExpertCenter.tsx
src/renderer/App.tsx
src/main/services/expert-service.ts          (+ unbindResources)
src/main/services/skill-service.ts           (+ update 方法，per-user isolation)
src/lib/types.ts                              (+ SKILL_UPDATE, RESOURCE_UNBIND)
src/main/services/ipc-handlers.ts             (+ SKILL_UPDATE handler)
docs/prd/agents-002-editor-ux.md
```

## 验收

| 标准 | L1 | L2 | L3 | 备注 |
|------|:--:|:--:|:--:|------|
| Scope SOP 工作台 | ✅ | ✅ | ✅ | `scripts/verify-expert-resource-bind.mjs` |
| Scope 通用技能工作台 | ✅ | ✅ | ✅ | IPC 验证：GENERAL_SKILL_LIST(9)、RESOURCE_IMPORT/UNBIND 通过；per-user 隔离 + 编辑器完整 |
| Scope MCP 工作台 | ✅ | ✅ | ✅ | IPC 验证：RESOURCE_IMPORT/UNBIND mcp、MCP_LIST 全通过 |
| 技能编辑 | ✅ | ✅ | — | `SKILL_UPDATE`(name/desc/cat/ver/perms) + 持久化 + owner 隔离 + 部分更新；**无脚本编辑**（本地无执行引擎，真正执行走 FastAPI GeneralSkillRunner） |
