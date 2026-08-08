# 14 — 灵感沉淀 (Inspiration)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Inspiration.md`
> Status: ❌ P3 待开发

## 功能概要

灵感沉淀是 BspBuddy 的知识库/笔记系统。从对话中选中内容一键沉淀为"灵感"，形成结构化知识库。灵感沉淀后，拆分储存、生成摘要、关联标签，类型包括实时回想、内容沉淀等。

## 灵感类型

- **对话沉淀**: 选中对话内容 → 一键保存为灵感
- **随手记**: 快捷笔记(草稿/标签/分类)
- **资料沉淀**: 上传文件 → 自动提取关键信息
- **网页内容**: URL 输入 → 自动抓取并结构化保存

## 实现文件

```
src/components/InspirationPanel.tsx          - 灵感面板
src/components/InspirationDetail.tsx          - 灵感详情
src/main/services/inspiration-service.ts     - 灵感服务
src/lib/inspiration-types.ts                 - 灵感类型定义
```

## 验收标准

- [ ] 对话中选中文字 → 一键沉淀为灵感
- [ ] 灵感沉淀后 → 自动提取摘要+标签+来源
- [ ] 灵感面板 → 搜索/筛选/分类浏览/编辑/删除
- [ ] 对话中 Agent 自动引用关联灵感
