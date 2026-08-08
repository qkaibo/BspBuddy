# 07 — 项目协作 (Project Collaboration)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Project.md`
> Status: ❌ P3 待开发

## 功能概要

团队协作能力：项目和任务两层结构，成员共享上下文、标准与知识。项目承载指令/连接器/专家/技能/资料等共享配置；任务在项目中创建，支持分享、转交和协作。

## 核心能力

- 项目配置: 指令/连接器/专家/Skill
- 成员邀请: 复制链接 → 申请备注 → 管理员审批
- 资产/资料库: 每个项目独立空间(默认 5GB)
- 分享与转交: 任务可分享链接、打包转交
- 连接器双授权: 公共授权(云端) + 个人授权(仅本地)

## 实现文件

```
src/components/ProjectPanel.tsx      - 项目列表/详情
src/components/ProjectDetail.tsx     - 项目详情页
src/components/ProjectAssets.tsx     - 资产/资料库
src/components/ProjectInvite.tsx     - 邀请成员
src/lib/project-types.ts             - 项目类型定义
```

## 验收标准

- [ ] 创建项目并配置指令/连接器/专家/Skill
- [ ] 邀请成员 → 链接 → 审批 → 加入
- [ ] 项目内创建任务 → 自动注入项目指令/资料库/个人记忆
- [ ] 任务分享 → 他人可打开并加入会话
- [ ] 公共授权连接器 → 全员可用; 个人授权 → 仅自己可用
