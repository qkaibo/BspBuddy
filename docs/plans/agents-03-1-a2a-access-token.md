# agents-03-1 — A2A 接入 Token（IDE / 外部客户端）

> 对应文档: `docs/prd/agents-005-a2a-access-token.md`  
> Tech Spec: `docs/tech-spec/agents-005-a2a-access-token.md`  
> 关联: `agents-004` / `agents-03`、`auth-001`、`skills-003`（边界：不做商店入口）  
> Status: 🟢 Phase A–C 可演示 | Priority: P0

## 功能概要

在**系统设置 → A2A 接入**提供用户级 Token 的签发、一次性明文复制、列表与吊销，供外部 IDE 以 Bearer 调用 `/a2a/*`。  
不挂技能商店；存储复用 `AgentSkillToken`，`purpose=a2a` 与技能 Runtime 区分。

## 一、已落地范围

```
文档:
  docs/prd/agents-005-a2a-access-token.md
  docs/tech-spec/agents-005-a2a-access-token.md
  docs/plans/agents-03-1-a2a-access-token.md
  docs/README.md / docs/CONTEXT.md

后端:
  app/db/models.py                     ← purpose + token_suffix
  app/db/database.py                   ← SQLite 迁移
  app/api/skills_extras.py             ← purpose / bba2a_ 前缀
  app/security/auth.py                 ← bbsk_ + bba2a_
  app/a2a/agent_card.py                ← 默认 Base URL → 127.0.0.1:52020
  app/config.py                        ← BASE_URL 注释

桌面:
  src/components/A2AAccessPanel.tsx
  src/components/SettingsPanel.tsx     ← 入口
  src/renderer/App.tsx                 ← a2a-access view
  src/lib/types.ts + ipc-handlers.ts   ← TOKEN_* + BACKEND_ME + PROBE
  src/main/services/fastapi-bridge.ts  ← 启动时注入 BASE_URL

自测:
  scripts/selftest_a2a_access_token.py
  scripts/selftest_a2a_access_token_l2.py  ← 签发 → /a2a/agents → 吊销 401
```

## 二、Phase 状态

| Phase | 内容 | 状态 |
|-------|------|:--:|
| A | Tech Spec + `purpose` / `bba2a_` 鉴权 | ✅ |
| B | 设置 → A2A 接入 UI（签发/复制/列表/吊销/说明） | ✅ |
| C | Base URL 对齐 + 页内「测试 /a2a/agents」 | ✅ |

## 三、非目标（仍成立）

- 租户级全局 Token  
- 技能商店作为 A2A 主入口  
- 统一桌面 Phase1 本地登录与 FastAPI 用户（完整统一归 auth-001）

## 四、手动验收

1. 重启桌面 → 系统设置 → A2A 接入  
2. 「用当前会话测试 /a2a/agents」应成功  
3. 签发 Token → 「用此 Token 测试」应成功；复制给 IDE  
4. 吊销后旧 Token 调 `/a2a/agents` 应 401  
5. Agent Card `url` 主机应与页内 Base URL 一致（`http://127.0.0.1:52020`）
