# 12 — Ardot 设计创意 (Design-Idea)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Design-Idea.md`
> Status: ❌ P3 待开发

## 功能概要

BspBuddy 深度集成腾讯设计 Ardot 画布：在对话中一句话生成 UI、PPT、海报等设计稿，对话实时修改，云端双向同步，一键跳转 Ardot 精细化编辑。

> Ardot 是腾讯自研 AI 设计智能体协作平台。本功能依赖 Ardot API。

## 核心能力

- 对话生成设计稿：自然语言描述 → AI 实时在 Ardot 画布生成
- 对话驱动修改：智能框选+对话、纯语言指挥、粘贴参考
- 跳转 Ardot 精细化编辑：像素级对齐、组件化编辑、多格式导出
- 从设计稿生成应用代码

## 授权权限

| 权限 | 说明 |
|------|------|
| 读取画布内容 | 读取设计稿中的元素、样式、布局信息 |
| 编辑画布 | 代表用户在 Ardot 画布上执行设计操作 |
| 云端同步 | 与 Ardot 浏览器端保持实时双向同步 |

## 实现文件

```
src/components/DesignCreativeTab.tsx   - 设计创意 Tab
src/main/services/ardot-service.ts     - Ardot 服务
src/lib/design-types.ts                - 设计类型定义
```

## 验收标准

- [ ] 设计创意 Tab → 输入「设计一个移动端登录页」→ Ardot 画布生成 UI
- [ ] 对话修改「把按钮改成蓝色」→ 画布实时更新
- [ ] 「生成应用」→ 输出 React/HTML 代码
