# 09 — 自动化 (Automation / Scheduler)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Automation-Guide.md`
> Status: ❌ P3 待开发

## 功能概要

配置自动化任务，BspBuddy 按设定时间自动执行周期性、重复性任务，结果保存到指定目录，并可推送到 BspBuddy 小程序。

## 配置项

| 配置项 | 说明 |
|--------|------|
| 名称 | 区分不同自动化任务 |
| 工作空间 | 默认自动分配 `automation-xxxx` |
| 提示词 | 任务目标和输出要求 |
| 模型和技能 | 指定执行该任务的模型和技能 |
| 定时规则 | 执行频率(cron)和有效日期区间 |
| 推送到小程序 | 开启后通过安全链路同步到云端 |

## 模板系统

| 模板 | 描述 |
|------|------|
| 新闻推送 | 每日 AI 新闻推送 |
| 周报生成 | 自动汇总生成周报 |
| 体检预约 | 定期体检预约提醒和处理 |
| 学习计划 | 学习计划定时推送和跟踪 |

## 结果推送

**仅推送至 BspBuddy 小程序**，不是 IM/邮件。

## 入口（主界面侧栏）

- **不在一级导航**；从侧栏「更多」→「自动化」进入。
- 一级导航中原「自动化」位置改为「知识库」（见 `agents-01` 侧栏约定）。

## 实现文件

```
src/components/Sidebar.tsx           - 「更多」菜单入口
src/components/AutomationPanel.tsx   - 自动化任务面板
src/renderer/App.tsx                 - ViewType `automation` 渲染面板
src/main/services/scheduler.ts       - 调度服务
src/lib/automation-types.ts          - 自动化类型定义
```

## 验收标准

- [ ] 创建自动化任务并设置 cron → 按时执行
- [ ] 推送到小程序开关打开 → 任务完成后小程序收到通知
- [ ] 任务频率/最大执行时长/并发控制生效
- [ ] 试运行 → 立即执行一次验证效果
- [ ] 执行日志完整: 状态/耗时/产出文件
