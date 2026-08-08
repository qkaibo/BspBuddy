# 17 — 数据与设置 (Data & Settings)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Data-Settings.md`
> Status: ❌ P3 待开发

## 功能概要

BspBuddy 系统的全局设置和数据管理：基础设置、AI 设置、深度思考设置、高级设置、快捷键、连接器、自动化、安全设置等。

## 设置分组

| 分组 | 内容 |
|------|------|
| 基础设置 | 语言、开机自启、通知、主题 |
| AI 设置 | 默认模型、系统提示词、输出语言 |
| 深度思考设置 | 思考深度、步骤拆解粒度 |
| 高级设置 | 日志级别、数据目录、缓存管理 |
| 快捷键 | 全局快捷键配置 |

## 实现文件

```
src/components/SettingsPanel.tsx          - 设置面板
src/components/SettingsSection.tsx        - 设置分组
src/lib/settings-types.ts                 - 设置类型定义
```

## 验收标准

- [ ] 设置面板 → 各组选项卡切换
- [ ] 基础设置 → 修改语言 → 立即生效
- [ ] 快捷键 → 自定义 → 冲突检测
- [ ] 数据管理 → 清理缓存 → 显示占用空间
