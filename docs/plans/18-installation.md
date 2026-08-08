# 18 — 安装与部署 (Installation)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Installation-n-Deployment.md`
> Status: ❌ P3 待开发

## 功能概要

BspBuddy 客户端下载安装流程：支持 Windows、macOS 版本，安装引导、首次使用指南、自动更新。

## 核心能力

- 多平台支持: Windows + macOS
- 安装引导: 首次启动引导设置
- 自动更新: 检测新版本 → 后台下载 → 安装
- 数据迁移: 从旧版本迁移数据

## 实现文件

```
src/main/services/updater.ts              - 自动更新服务
src/renderer/components/Onboarding.tsx    - 首次使用引导
```

## 验收标准

- [ ] Windows/macOS 安装包构建
- [ ] 首次启动 → 引导页 → 设置完基础配置
- [ ] 自动更新检测 → 下载 → 安装 → 重启
- [ ] 数据迁移无丢失
