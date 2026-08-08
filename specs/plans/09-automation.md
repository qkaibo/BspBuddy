# 09 — 自动化 (Automation / Scheduler)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Automation-Guide.md`
> Status: ❌ P3 待开发

## 功能概要

配置自动化任务，WorkBuddy 按设定时间自动执行周期性、重复性任务，结果保存到指定目录，并可推送到 WorkBuddy 小程序。

## 一、自动化任务配置项

| 配置项 | 说明 |
|--------|------|
| 名称 | 区分不同自动化任务 |
| 工作空间 | 指定任务执行目录及文件保存位置；默认自动分配 `automation-xxxx` 工作空间 |
| 提示词 | 任务目标和输出要求 |
| 模型和技能 | 指定执行该任务的模型和技能 |
| 定时规则 | 执行频率(cron)和有效日期区间(起止日期) |
| 推送到小程序 | 开启后通过安全链路同步到云端，小程序可接收 |

## 二、执行机制

- 任务频率、最大执行时长、并发控制统一约束
- 在指定时间以当前登录身份自动发起 Agent 任务
- 本地客户端保存定时任务配置(任务名/prompt/调度规则/工作目录/执行状态)
- 仅在时间规则触发时执行

## 三、模板系统 (SPEC指定模板)

| 模板 | 描述 |
|------|------|
| 新闻推送 | 每日 AI 新闻推送 |
| 周报生成 | 自动汇总生成周报 |
| 体检预约 | 定期体检预约提醒和处理 |
| 学习计划 | 学习计划定时推送和跟踪 |

无需从零编写提示词，选择模板后按需修改即可。

## 四、结果推送

**仅推送至 WorkBuddy 小程序**(SPEC明确, 不是IM/邮件)。
推送通过安全链路同步到云端，小程序可接收通知和数据。

## 五、安全与审计

### 积分消耗
简单提醒类消耗低；代码巡检、文档汇总、连接器分析消耗高。

### 安全提醒 (SPEC明确)
- 无人值守自动执行，审慎设置涉及文件写入/删除/资金操作的 prompt
- 新建任务后建议先以低频率试运行，确认结果符合预期再放大调度频率
- 涉及文件改动/数据变更/对外发送的部分保留可追溯日志
- 第三方服务稳定性/计费由其独立提供

### 数据边界
- 账户身份：沿用当前登录身份调用模型/工具/MCP/连接器
- 用户输入：保存 name/prompt/调度说明
- 行为日志：创建/启停/触发/执行结果与耗时(用于审计)
- 第三方凭证：仅使用已授权凭证，自动化不另存
- 文件读写：仅在指定工作目录内

## 六、实现任务 (实现细节)

### 09-1 数据模型 (`src/lib/automation-types.ts`)

```typescript
interface AutomationTask {
  id: string
  name: string
  workspacePath: string          // 默认 automation-xxxx
  prompt: string
  modelId: string
  skillIds: string[]
  schedule: {
    cron: string                // cron 表达式
    startDate: string
    endDate?: string           // 可选截止日期
  }
  pushToMiniProgram: boolean   // 仅推送到小程序
  enabled: boolean
  status: 'idle' | 'running' | 'error'
  stats: {
    totalRuns: number
    successRuns: number
    failedRuns: number
    avgDuration: number
  }
  lastRunAt?: number
  createdAt: number
}

interface AutomationLog {
  id: string
  taskId: string
  triggerTime: number
  startTime: number
  endTime?: number
  status: 'success' | 'failed' | 'timeout'
  result: string               // Agent 输出
  files: string[]              // 生成的文件
  error?: string
}
```

### 09-2 调度服务 (实现细节)

**文件**: `src/main/services/scheduler.ts`

```typescript
class SchedulerService {
  // 创建/更新/删除定时任务
  create(config: AutomationConfig): Promise<string>
  // 手动触发(测试用)
  trigger(taskId: string): Promise<void>
  // 暂停/恢复
  setEnabled(taskId: string, enabled: boolean): Promise<void>
  // 频率/最大执行时长/并发控制
  validateConfig(config: AutomationConfig): string[]
}
```

### 09-3 前端页面 (实现细节)

**文件**: `src/components/AutomationPanel.tsx`

- 任务列表: 名称 + 状态 + 上次执行时间 + 成功/失败次数
- 创建向导: 名称 → 工作空间 → 提示词 → 模型+技能 → 定时规则(频率+日期区间) → 推送开关
- 模板选择器: 4种模板(新闻推送/周报生成/体检预约/学习计划)
- 执行日志: 时间线视图 + 详细日志
- 试运行按钮: 立即手动触发一次, 验证 prompt 和配置

### 09-4 IPC 通道

```
AUTOMATION_LIST   → 获取自动化任务列表
AUTOMATION_CREATE → 创建自动化任务
AUTOMATION_UPDATE → 更新
AUTOMATION_DELETE → 删除
AUTOMATION_TRIGGER → 手动触发(试运行)
AUTOMATION_TOGGLE → 启用/禁用
```

### 09-5 小程序推送 (实现细节)

- 推送开关绑定 `pushToMiniProgram` 配置
- 安全链路同步: encryption before upload, 仅推送摘要+链接
- 开关关闭时仅在本地执行，不上传任何数据

## 七、验收标准

- [ ] 创建自动化任务并设置 cron → 按时执行
- [ ] 推送到小程序开关打开 → 任务完成后小程序收到通知
- [ ] 选择模板"新闻推送" → 自动填充默认 prompt → 修改后保存
- [ ] 任务频率/最大执行时长/并发控制生效
- [ ] 试运行 → 立即执行一次验证效果
- [ ] 执行日志完整: 状态/耗时/产出文件
- [ ] 安全: 删除文件类型 prompt → 确认提示
