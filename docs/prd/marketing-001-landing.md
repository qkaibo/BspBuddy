---
id: marketing-001
title: BspBuddy 官网落地页
type: prd
related: [arch-expert-agent, agents-001]
---

# BspBuddy 官网落地页

## 1. 概述

为产品提供对外叙事页（静态站），结构参考协作智能平台类落地页（Hero → 机制 → 场景 → 能力 → 对比 → 角色 → CTA），内容对齐 BspBuddy：**领域专家系统 + 后台知识库（MCP）+ 桌面 / IDE 接入**。

本页不做登录与业务功能；CTA 指向桌面客户端、知识库控制台、IDE MCP 文档占位。

## 2. 用户场景

| 角色 | 场景 | 动机 |
|------|------|------|
| 领域工程师 | 打开官网理解产品是什么 | 确认是否适合 BSP / 充电等领域排障与适配 |
| 技术负责人 | 看接入面（桌面 / IDE / 知识库） | 评估能否接入现有仓库与知识引擎 |
| 访客 | 对比「通用助手」与「领域专家」 | 快速抓住差异 |

## 3. 信息架构

| # | 区块 | 文案重心 |
|---|------|----------|
| 1 | Nav | 机制 / 知识 / 接入 / 能力 / 生态 |
| 2 | Hero | 品牌 BspBuddy + 一句主张 + 双 CTA + 专家×知识×接入示意图 |
| 3 | Why | 为什么要领域专家，而不是一个万能助手 |
| 4 | Knowledge | 后台知识库：领域 / 基线 / 项目三层（经 MCP） |
| 5 | Mechanism | 四步：选专家 → 挂知识 → Desktop/IDE 提问 → 引用与拍板 |
| 6 | Surfaces | 桌面工作台 · IDE（Cursor）· 知识库 Console |
| 7 | Capabilities | 专家绑定、SOP/Skill、MCP 检索、可见引用 |
| 8 | Compare | 通用 Chat vs 编码助手 vs BspBuddy |
| 9 | Ecosystem | SOP / Skill / MCP / Knowledge Space / Team（规划） |
| 10 | CTA + Footer | 下载 / 文档 / MCP |

## 4. 核心主张（文案）

- **主标题：** 领域专家，带着知识进工作流  
- **副文：** 后台搭好知识库，桌面与 IDE 召唤同一位专家——检索有出处，结论可拍板。  
- **差异：** 不是更会聊天，而是更懂你的领域与基线。

## 5. 视觉方向

- 深色工程风（非蓝紫渐变 SaaS 模板）
- 强调色：琥珀铜 `#c47a3a`；背景墨色 `#0b0d12`
- Hero 一屏：品牌 + 标题 + 一句支撑 + CTA + 一张主导产品图（无叠贴纸片）
- 字体：展示用衬线或几何无衬线组合，避免 Inter/系统默认栈独占

## 6. 交付物

| 路径 | 说明 |
|------|------|
| `website/index.html` | 单页落地 |
| `website/styles.css` | 样式 |
| `website/README.md` | 本地预览与部署说明 |
| `website/Dockerfile` + `nginx.conf` | 容器化静态站 |
| `website/pack.ps1` / `pack.sh` | 产出 `dist/` + zip |

## 7. 部署

静态站，无服务端构建依赖。支持：

1. **打包目录** — `npm run website:pack` → 上传 `website/dist/`
2. **Docker** — `npm run website:docker` → `docker run -p 8080:80 …`
3. **Pages / CDN** — 直接 Publish `website` 或 `website/dist`

## 8. 验收

- [ ] 首屏可读：品牌、主张、CTA、产品图
- [ ] 讲清三件事：专家 / 知识库 / Desktop+IDE
- [ ] 提及 MCP 与可私有部署（页脚或徽章）
- [ ] 桌面与移动宽度下不崩版
- [ ] 不出现 WorkBuddy 旧名
- [ ] `website:pack` 产出可独立托管的 `dist/`
- [ ] Docker 镜像监听 80 可打开首页
