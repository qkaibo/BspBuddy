// ============================================================
// AutomationPanel — task list, create wizard, templates, logs
// ============================================================

import { useState, useEffect } from 'react'
import {
  Zap, Clock, Play, Pause, Trash2, Plus, RotateCcw, AlertTriangle,
  CheckCircle, XCircle, FileText, Newspaper, Heart, BookOpen,
  ChevronLeft, ChevronRight, Calendar, Settings, Activity, Bell, BellOff,
  Terminal, Shield, Info, History, Download, Timer, BarChart3, X,
  RefreshCw, Eye, EyeOff
} from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS, AVAILABLE_MODELS } from '../lib/types'
import type { AutomationTask, AutomationLog, AutomationConfig, AutomationTemplate } from '../lib/automation-types'
import { AUTOMATION_TEMPLATES, SAFETY_RULES, CONCURRENCY_LIMITS } from '../lib/automation-types'
import { ConfirmDialog } from './ConfirmDialog'

const ipc = createIpcClient()

interface Props {
  onClose: () => void
}

type ViewMode = 'list' | 'create' | 'edit' | 'logs' | 'templates'

type WizardStep = 'template' | 'name' | 'workspace' | 'prompt' | 'model' | 'schedule' | 'push' | 'review'

const FREQUENCY_LABELS: Record<string, string> = {
  'every-minute': '每分钟',
  'every-5min': '每5分钟',
  'every-10min': '每10分钟',
  'every-30min': '每30分钟',
  hourly: '每小时',
  'every-6h': '每6小时',
  'every-12h': '每12小时',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  custom: '自定义',
}

const STATUS_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  idle: { label: '空闲', color: '#22c55e', bg: '#22c55e15' },
  running: { label: '运行中', color: '#3b82f6', bg: '#3b82f615' },
  error: { label: '错误', color: '#ef4444', bg: '#ef444415' },
  paused: { label: '已暂停', color: '#f59e0b', bg: '#f59e0b15' },
}

const LOG_STATUS_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />,
  failed: <XCircle className="w-4 h-4" style={{ color: '#ef4444' }} />,
  timeout: <Timer className="w-4 h-4" style={{ color: '#f59e0b' }} />,
  cancelled: <X className="w-4 h-4" style={{ color: '#6b7280' }} />,
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  newspaper: <Newspaper className="w-5 h-5" />,
  'file-text': <FileText className="w-5 h-5" />,
  heart: <Heart className="w-5 h-5" />,
  'book-open': <BookOpen className="w-5 h-5" />,
}

export function AutomationPanel({ onClose }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [tasks, setTasks] = useState<AutomationTask[]>([])
  const [logs, setLogs] = useState<AutomationLog[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>('template')
  const [wizardValues, setWizardValues] = useState<Partial<AutomationConfig>>({})
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showSafetyWarning, setShowSafetyWarning] = useState(false)

  // Log detail
  const [selectedLog, setSelectedLog] = useState<AutomationLog | null>(null)

  useEffect(() => {
    loadTasks()
  }, [])

  useEffect(() => {
    if (selectedTaskId && viewMode === 'logs') {
      loadLogs(selectedTaskId)
    }
  }, [selectedTaskId, viewMode])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function loadTasks() {
    const list = (await ipc.invoke(IPC_CHANNELS.AUTOMATION_LIST)) as AutomationTask[]
    setTasks(list)
  }

  async function loadLogs(taskId?: string) {
    const lgs = (await ipc.invoke(IPC_CHANNELS.AUTOMATION_LOGS, taskId || undefined)) as AutomationLog[]
    setLogs(lgs)
  }

  async function handleCreate(config: AutomationConfig) {
    const result = (await ipc.invoke(IPC_CHANNELS.AUTOMATION_CREATE, config)) as {
      success: boolean; task?: AutomationTask; errors?: string[]
    }
    if (result.success) {
      showToast('自动化任务已创建')
      setViewMode('list')
      resetWizard()
      loadTasks()
    } else {
      setValidationErrors(result.errors || ['创建失败'])
    }
    return result
  }

  async function handleUpdate(taskId: string, updates: Partial<AutomationConfig>) {
    const result = (await ipc.invoke(IPC_CHANNELS.AUTOMATION_UPDATE, taskId, updates)) as {
      success: boolean; task?: AutomationTask; errors?: string[]
    }
    if (result.success) {
      showToast('任务已更新')
      setViewMode('list')
      resetWizard()
      loadTasks()
    } else {
      setValidationErrors(result.errors || ['更新失败'])
    }
    return result
  }

  async function handleDelete(taskId: string) {
    await ipc.invoke(IPC_CHANNELS.AUTOMATION_DELETE, taskId)
    showToast('任务已删除')
    loadTasks()
  }

  async function handleToggle(taskId: string, enabled: boolean) {
    const result = (await ipc.invoke(IPC_CHANNELS.AUTOMATION_TOGGLE, taskId, enabled)) as {
      success: boolean; task?: AutomationTask
    }
    if (result.success) {
      showToast(enabled ? '任务已启用' : '任务已暂停')
      loadTasks()
    } else {
      showToast('操作失败')
    }
  }

  async function handleTrigger(taskId: string) {
    const result = (await ipc.invoke(IPC_CHANNELS.AUTOMATION_TRIGGER, taskId)) as {
      success: boolean; log: AutomationLog
    }
    if (result.success) {
      showToast('试运行完成')
    } else {
      showToast(result.log.error || '试运行失败')
    }
    loadTasks()
    loadLogs(taskId)
  }

  async function handleCheckSafety(prompt: string) {
    const result = (await ipc.invoke(IPC_CHANNELS.AUTOMATION_CHECK_SAFETY, prompt)) as {
      safe: boolean; warnings: string[]
    }
    return result
  }

  function resetWizard() {
    setWizardStep('template')
    setWizardValues({})
    setSelectedTemplateId(null)
    setEditingTaskId(null)
    setValidationErrors([])
    setShowSafetyWarning(false)
  }

  function selectTemplate(template: AutomationTemplate) {
    setSelectedTemplateId(template.id)
    setWizardValues((prev) => ({
      ...prev,
      ...template.defaultConfig,
      name: template.name,
      pushToMiniProgram: template.pushRecommend,
    }))
    setWizardStep('name')
  }

  function startEdit(task: AutomationTask) {
    setEditingTaskId(task.id)
    setWizardValues({
      name: task.name,
      workspacePath: task.workspacePath,
      prompt: task.prompt,
      modelId: task.modelId,
      skillIds: task.skillIds,
      schedule: {
        frequency: task.schedule.frequency,
        cron: task.schedule.cron,
        startDate: task.schedule.startDate,
        endDate: task.schedule.endDate,
      },
      pushToMiniProgram: task.pushToMiniProgram,
    })
    setWizardStep('name')
    setViewMode('edit')
  }

  function startCreate() {
    resetWizard()
    setViewMode('create')
  }

  const steps: WizardStep[] = ['template', 'name', 'workspace', 'prompt', 'model', 'schedule', 'push', 'review']
  const currentStepIdx = steps.indexOf(wizardStep)

  async function handleWizardNext() {
    if (wizardStep === 'prompt') {
      const safetyResult = await handleCheckSafety(wizardValues.prompt || '')
      if (!safetyResult.safe) {
        setShowSafetyWarning(true)
      }
    }
    const nextIdx = currentStepIdx + 1
    if (nextIdx < steps.length) {
      setWizardStep(steps[nextIdx])
    }
  }

  function handleWizardPrev() {
    const prevIdx = currentStepIdx - 1
    if (prevIdx >= 0) {
      setWizardStep(steps[prevIdx])
    }
  }

  async function handleWizardSubmit() {
    const config = wizardValues as AutomationConfig
    if (!config.name || !config.prompt || !config.modelId || !config.schedule) {
      setValidationErrors(['请完整填写所有必填字段'])
      return
    }

    setValidationErrors([])
    if (editingTaskId) {
      await handleUpdate(editingTaskId, wizardValues)
    } else {
      await handleCreate(config)
    }
  }

  function formatTime(ts?: number): string {
    if (!ts) return '—'
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin}分钟前`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}小时前`
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function formatDuration(ms?: number): string {
    if (!ms) return '—'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  const isEditing = !!editingTaskId

  // ── Render helpers ──

  function renderTaskRow(task: AutomationTask) {
    const badge = STATUS_BADGES[task.status] || STATUS_BADGES.idle
    const successRate = task.stats.totalRuns > 0
      ? Math.round((task.stats.successRuns / task.stats.totalRuns) * 100)
      : 0

    return (
      <div
        key={task.id}
        className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-secondary/30 cursor-pointer transition-colors"
        onClick={() => {
          setSelectedTaskId(task.id)
          setViewMode('logs')
          loadLogs(task.id)
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{task.name}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ color: badge.color, backgroundColor: badge.bg }}
            >
              {badge.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(task.lastRunAt)}</span>
            <span>{task.schedule.frequency ? FREQUENCY_LABELS[task.schedule.frequency] : task.schedule.cron}</span>
            {task.pushToMiniProgram && <span className="text-primary">小程序</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-center">
          <div className="w-10">
            <div className="text-xs font-semibold text-green-500">{task.stats.successRuns}</div>
            <div className="text-[10px] text-muted-foreground">成功</div>
          </div>
          <div className="w-10">
            <div className="text-xs font-semibold text-red-500">{task.stats.failedRuns}</div>
            <div className="text-[10px] text-muted-foreground">失败</div>
          </div>
          <div className="w-12">
            <div className="text-xs font-semibold">{successRate}%</div>
            <div className="text-[10px] text-muted-foreground">成功率</div>
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-accent transition-colors"
            onClick={() => handleTrigger(task.id)}
            title="试运行"
            aria-label="试运行"
          >
            <Play className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-accent transition-colors"
            onClick={() => startEdit(task)}
            title="编辑"
            aria-label="编辑任务"
          >
            <Settings className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-accent transition-colors"
            onClick={() => handleToggle(task.id, !task.enabled)}
            title={task.enabled ? '暂停' : '启用'}
            aria-label={task.enabled ? '暂停任务' : '启用任务'}
          >
            {task.enabled
              ? <Pause className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
              : <Play className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            }
          </button>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
            onClick={() => setConfirmDeleteId(task.id)}
            title="删除"
            aria-label="删除任务"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  function renderLogEntry(log: AutomationLog) {
    const isSelected = selectedLog?.id === log.id
    return (
      <div
        key={log.id}
        className={`flex items-start gap-3 px-4 py-2.5 border-b border-border/50 cursor-pointer transition-colors ${isSelected ? 'bg-secondary/50' : 'hover:bg-secondary/20'}`}
        onClick={() => setSelectedLog(log)}
      >
        <div className="mt-0.5">{LOG_STATUS_ICONS[log.status]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{log.taskName}</span>
            <span className="text-[10px] px-1 py-0.5 rounded bg-secondary text-muted-foreground">
              {log.status === 'success' ? '成功' : log.status === 'failed' ? '失败' : log.status === 'timeout' ? '超时' : '取消'}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">{log.result || log.error}</div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
            <span>{formatTime(log.triggerTime)}</span>
            <span>{formatDuration(log.duration)}</span>
            {log.files.length > 0 && <span>{log.files.length} 个文件</span>}
          </div>
        </div>
      </div>
    )
  }

  // ── View: Template Picker ──
  function renderTemplatePicker() {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">选择模板</h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            选择一个模板快速开始，或跳过模板从零配置
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {AUTOMATION_TEMPLATES.map((template) => (
              <button
                key={template.id}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border
                           hover:border-primary/50 hover:bg-secondary/30 transition-colors text-left"
                onClick={() => selectTemplate(template)}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"
                  style={{ color: 'var(--primary)' }}>
                  {TEMPLATE_ICONS[template.icon]}
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium">{template.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{template.description}</div>
                  <div className="mt-1.5 flex items-center justify-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      template.estimatedCost === 'low' ? 'bg-green-500/10 text-green-500' :
                      template.estimatedCost === 'medium' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-orange-500/10 text-orange-500'
                    }`}>
                      {template.estimatedCost === 'low' ? '低消耗' : template.estimatedCost === 'medium' ? '中消耗' : '高消耗'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            className="w-full mt-4 py-2.5 rounded-lg border border-dashed border-border
                       hover:border-primary/50 hover:text-primary transition-colors text-sm text-muted-foreground"
            onClick={() => setWizardStep('name')}
          >
            跳过模板，从零创建
          </button>
        </div>
      </div>
    )
  }

  // ── View: Wizard form fields ──
  function renderWizardStep() {
    switch (wizardStep) {
      case 'name':
        return (
          <div className="flex-1 flex flex-col p-4">
            <label htmlFor="automation-task-name" className="text-xs font-medium mb-2 text-muted-foreground">任务名称</label>
            <input
              id="automation-task-name"
              name="automation-task-name"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm
                         focus-visible:outline-none focus-visible:border-primary transition-colors"
              placeholder="例如：每日AI新闻推送"
              value={wizardValues.name || ''}
              onChange={(e) => setWizardValues((p) => ({ ...p, name: e.target.value }))}
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground mt-2">为你的自动化任务起一个易于识别的名称</p>
          </div>
        )
      case 'workspace':
        return (
          <div className="flex-1 flex flex-col p-4">
            <label htmlFor="automation-workspace" className="text-xs font-medium mb-2 text-muted-foreground">工作空间路径</label>
            <input
              id="automation-workspace"
              name="automation-workspace"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm
                         focus-visible:outline-none focus-visible:border-primary transition-colors"
              placeholder="留空自动分配 automation-xxxx 工作空间"
              value={wizardValues.workspacePath || ''}
              onChange={(e) => setWizardValues((p) => ({ ...p, workspacePath: e.target.value }))}
            />
            <div className="mt-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-[10px] text-blue-400">
                任务仅在指定工作目录内进行文件读写，无法访问其他目录。
                留空则自动创建专用工作空间。
              </p>
            </div>
          </div>
        )
      case 'prompt':
        return (
          <div className="flex-1 flex flex-col p-4">
            <label htmlFor="automation-prompt" className="text-xs font-medium mb-2 text-muted-foreground">提示词 (Prompt)</label>
            <textarea
              id="automation-prompt"
              name="automation-prompt"
              className="flex-1 w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm
                         focus-visible:outline-none focus-visible:border-primary transition-colors resize-none font-mono"
              placeholder="输入自动化任务的目标和输出要求…"
              value={wizardValues.prompt || ''}
              onChange={(e) => setWizardValues((p) => ({ ...p, prompt: e.target.value }))}
              rows={8}
            />
            {showSafetyWarning && wizardValues.prompt && (
              <div className="mt-2 p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
                <p className="text-[10px] text-yellow-500" style={{ whiteSpace: 'pre-wrap' }}>
                  {SAFETY_RULES.warningMessage}
                </p>
              </div>
            )}
          </div>
        )
      case 'model':
        return (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            <span className="text-xs font-medium mb-2 text-muted-foreground" id="automation-model-label">选择模型</span>
            <div className="space-y-2" role="group" aria-labelledby="automation-model-label">
              {AVAILABLE_MODELS.map((model) => (
                <button
                  type="button"
                  key={model.id}
                  aria-pressed={wizardValues.modelId === model.id}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                    wizardValues.modelId === model.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30'
                  }`}
                  onClick={() => setWizardValues((p) => ({ ...p, modelId: model.id }))}
                >
                  <div className={`w-2 h-2 rounded-full ${wizardValues.modelId === model.id ? 'bg-primary' : 'bg-muted'}`} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{model.name}</div>
                    <div className="text-[10px] text-muted-foreground">{model.description}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{model.provider}</div>
                </button>
              ))}
            </div>
          </div>
        )
      case 'schedule':
        return (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            <span className="text-xs font-medium mb-2 text-muted-foreground" id="automation-freq-label">执行频率</span>
            <div className="grid grid-cols-3 gap-2 mb-4" role="group" aria-labelledby="automation-freq-label">
              {Object.entries(FREQUENCY_LABELS).filter(([k]) => k !== 'custom').map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={wizardValues.schedule?.frequency === key}
                  className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                    wizardValues.schedule?.frequency === key
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                  onClick={() => setWizardValues((p) => ({
                    ...p,
                    schedule: { ...p.schedule!, frequency: key as any, cron: undefined, startDate: p.schedule?.startDate || new Date().toISOString().split('T')[0], endDate: p.schedule?.endDate },
                  }))}
                >
                  {label}
                </button>
              ))}
            </div>
            <label htmlFor="automation-cron" className="text-xs font-medium mb-2 text-muted-foreground">Cron 表达式 (可选)</label>
            <input
              id="automation-cron"
              name="automation-cron"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono
                         focus-visible:outline-none focus-visible:border-primary transition-colors"
              placeholder="0 9 * * *"
              value={wizardValues.schedule?.cron || ''}
              onChange={(e) => setWizardValues((p) => ({
                ...p,
                schedule: { ...p.schedule!, cron: e.target.value, frequency: 'custom' as any, startDate: p.schedule?.startDate || new Date().toISOString().split('T')[0], endDate: p.schedule?.endDate },
              }))}
            />
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label htmlFor="automation-start-date" className="text-[10px] text-muted-foreground">开始日期</label>
                <input
                  id="automation-start-date"
                  name="automation-start-date"
                  type="date"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm
                             focus-visible:outline-none focus-visible:border-primary transition-colors"
                  value={wizardValues.schedule?.startDate || ''}
                  onChange={(e) => setWizardValues((p) => ({
                    ...p,
                    schedule: { ...p.schedule!, startDate: e.target.value, frequency: p.schedule?.frequency || 'daily' as any, cron: p.schedule?.cron, endDate: p.schedule?.endDate },
                  }))}
                />
              </div>
              <div>
                <label htmlFor="automation-end-date" className="text-[10px] text-muted-foreground">截止日期 (可选)</label>
                <input
                  id="automation-end-date"
                  name="automation-end-date"
                  type="date"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm
                             focus-visible:outline-none focus-visible:border-primary transition-colors"
                  value={wizardValues.schedule?.endDate || ''}
                  onChange={(e) => setWizardValues((p) => ({
                    ...p,
                    schedule: { ...p.schedule!, endDate: e.target.value || undefined, frequency: p.schedule?.frequency || 'daily' as any, cron: p.schedule?.cron, startDate: p.schedule?.startDate || new Date().toISOString().split('T')[0] },
                  }))}
                />
              </div>
            </div>
            <div className="mt-3 p-2 rounded-lg bg-secondary/50 border border-border/50 flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-[10px] text-muted-foreground">
                <div>最大执行时长: {Math.round(CONCURRENCY_LIMITS.defaultMaxDurationMs / 60000)} 分钟</div>
                <div>最大并发任务: {CONCURRENCY_LIMITS.maxConcurrentTasks} 个</div>
                <div className="mt-1">
                  建议先以低频率试运行，确认结果符合预期后再提高频率
                </div>
              </div>
            </div>
          </div>
        )
      case 'push':
        return (
          <div className="flex-1 flex flex-col p-4">
            <span className="text-xs font-medium mb-3 text-muted-foreground" id="automation-push-label">推送到 BspBuddy 小程序</span>
            <button
              type="button"
              role="switch"
              aria-checked={!!wizardValues.pushToMiniProgram}
              aria-labelledby="automation-push-label"
              className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                wizardValues.pushToMiniProgram
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30'
              }`}
              onClick={() => setWizardValues((p) => ({ ...p, pushToMiniProgram: !p.pushToMiniProgram }))}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                wizardValues.pushToMiniProgram ? 'bg-primary/10' : 'bg-secondary'
              }`}>
                {wizardValues.pushToMiniProgram
                  ? <Bell className="w-5 h-5 text-primary" />
                  : <BellOff className="w-5 h-5 text-muted-foreground" />
                }
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-medium">
                  {wizardValues.pushToMiniProgram ? '已开启推送' : '未开启推送'}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {wizardValues.pushToMiniProgram
                    ? '任务完成后通过安全链路同步摘要+链接到小程序'
                    : '仅在本地执行任务，不上传任何数据'
                  }
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                wizardValues.pushToMiniProgram ? 'border-primary' : 'border-muted'
              }`}>
                {wizardValues.pushToMiniProgram && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>
            </button>
          </div>
        )
      case 'review':
        return (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            <h3 className="text-sm font-semibold mb-3">确认任务配置</h3>
            <div className="space-y-3">
              <ConfigRow label="任务名称" value={wizardValues.name} />
              <ConfigRow label="工作空间" value={wizardValues.workspacePath || '自动分配'} />
              <ConfigRow label="模型" value={AVAILABLE_MODELS.find((m) => m.id === wizardValues.modelId)?.name || wizardValues.modelId} />
              <ConfigRow label="频率" value={wizardValues.schedule?.cron || FREQUENCY_LABELS[wizardValues.schedule?.frequency || 'daily'] || '每天'} />
              <ConfigRow label="日期区间" value={`${wizardValues.schedule?.startDate || ''} ~ ${wizardValues.schedule?.endDate || '无截止'}`} />
              <ConfigRow label="推送小程序" value={wizardValues.pushToMiniProgram ? '是' : '否'} />
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">提示词</div>
                <div className="p-2 rounded-lg bg-secondary border border-border text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {wizardValues.prompt}
                </div>
              </div>
            </div>
            {validationErrors.length > 0 && (
              <div className="mt-3 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                {validationErrors.map((e, i) => (
                  <div key={i} className="text-[11px] text-red-400 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{e}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      default:
        return renderTemplatePicker()
    }
  }

  // ── View: Logs with detail ──
  function renderLogsView() {
    const selectedTask = tasks.find((t) => t.id === selectedTaskId)
    const taskLogs = logs.filter((l) => l.taskId === selectedTaskId)
    return (
      <div className="flex-1 flex overflow-hidden">
        {/* Log list */}
        <div className="w-80 border-r border-border flex flex-col">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold truncate">{selectedTask?.name || '执行日志'}</h3>
              <p className="text-[10px] text-muted-foreground">{taskLogs.length} 条记录</p>
            </div>
            <button
              type="button"
              className="p-1 rounded hover:bg-accent transition-colors"
              onClick={() => {
                setViewMode('list')
                setSelectedLog(null)
              }}
              title="返回列表"
              aria-label="返回列表"
            >
              <X className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {taskLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <History className="w-8 h-8 opacity-30" />
                <p className="text-xs">暂无执行记录</p>
              </div>
            )}
            {taskLogs.map(renderLogEntry)}
          </div>
          <div className="px-4 py-2 border-t border-border">
            <button
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                         bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
              onClick={() => selectedTaskId && handleTrigger(selectedTaskId)}
            >
              <Play className="w-4 h-4" />
              试运行
            </button>
          </div>
        </div>

        {/* Log detail */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {selectedLog ? (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold">执行详情</h3>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  selectedLog.status === 'success' ? 'bg-green-500/10 text-green-500' :
                  selectedLog.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                  'bg-yellow-500/10 text-yellow-500'
                }`}>
                  {selectedLog.status === 'success' ? '成功' : selectedLog.status === 'failed' ? '失败' : selectedLog.status === 'timeout' ? '超时' : '取消'}
                </span>
              </div>
              <div className="space-y-3">
                <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="触发时间" value={new Date(selectedLog.triggerTime).toLocaleString('zh-CN')} />
                <DetailRow icon={<Timer className="w-3.5 h-3.5" />} label="执行耗时" value={formatDuration(selectedLog.duration)} />
                <DetailRow icon={<Terminal className="w-3.5 h-3.5" />} label="执行结果" value={selectedLog.result || selectedLog.error || '—'} multiline />
                {selectedLog.error && (
                  <DetailRow icon={<AlertTriangle className="w-3.5 h-3.5" />} label="错误信息" value={selectedLog.error} error />
                )}
                {selectedLog.files.length > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> 生成文件
                    </div>
                    <div className="space-y-1">
                      {selectedLog.files.map((f, i) => (
                        <div key={i} className="text-xs p-2 rounded bg-secondary font-mono text-muted-foreground truncate">
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Activity className="w-10 h-10 opacity-20" />
              <p className="text-xs">选择左侧日志查看详情</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── View: Main list ──
  function renderTaskList() {
    const tasksByStatus = {
      running: tasks.filter((t) => t.status === 'running'),
      idle: tasks.filter((t) => t.status === 'idle'),
      error: tasks.filter((t) => t.status === 'error'),
      paused: tasks.filter((t) => t.status === 'paused'),
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">自动化任务</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {tasks.length} 个任务 · {tasksByStatus.running.length} 运行中
            </p>
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm
                       hover:bg-primary/20 transition-colors"
            onClick={startCreate}
          >
            <Plus className="w-4 h-4" />
            新建任务
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border/50 text-[10px] text-muted-foreground bg-secondary/10">
          <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />总执行 {tasks.reduce((s, t) => s + t.stats.totalRuns, 0)} 次</span>
          <span>成功 {tasks.reduce((s, t) => s + t.stats.successRuns, 0)}</span>
          <span>失败 {tasks.reduce((s, t) => s + t.stats.failedRuns, 0)}</span>
        </div>

        {tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Zap className="w-12 h-12 opacity-20" />
            <div className="text-center">
              <p className="text-sm">暂无自动化任务</p>
              <p className="text-[11px] mt-1">创建一个定时任务，让 BspBuddy 自动执行重复性工作</p>
            </div>
            <button
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm
                         hover:bg-primary/20 transition-colors mt-2"
              onClick={startCreate}
            >
              <Plus className="w-4 h-4" />
              创建第一个任务
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {tasksByStatus.running.map(renderTaskRow)}
            {tasksByStatus.idle.map(renderTaskRow)}
            {tasksByStatus.error.map(renderTaskRow)}
            {tasksByStatus.paused.map(renderTaskRow)}
          </div>
        )}
      </div>
    )
  }

  // ── View: Create/Edit wizard ──
  function renderWizard() {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Wizard header */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="p-1 rounded hover:bg-accent transition-colors"
                onClick={() => { setViewMode('list'); resetWizard() }}
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <h2 className="text-sm font-semibold">{isEditing ? '编辑任务' : '新建自动化任务'}</h2>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              步骤 {currentStepIdx > 0 ? currentStepIdx : 1}/{steps.length - 1}
            </div>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-1 mt-2">
            {steps.filter((s) => s !== 'template').map((step, idx) => {
              const stepIdx = steps.indexOf(step)
              const isActive = stepIdx === currentStepIdx
              const isDone = stepIdx < currentStepIdx
              return (
                <div key={step} className="flex items-center gap-1 flex-1">
                  <div
                    className={`flex-1 h-1 rounded-full transition-colors ${
                      isActive ? 'bg-primary' : isDone ? 'bg-primary/40' : 'bg-secondary'
                    }`}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Wizard content */}
        {wizardStep === 'template' && !isEditing ? renderTemplatePicker() : renderWizardStep()}

        {/* Wizard footer */}
        {wizardStep !== 'template' && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <button
              className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
              onClick={() => {
                if (wizardStep === 'name' && !isEditing) {
                  setWizardStep('template')
                } else {
                  handleWizardPrev()
                }
              }}
            >
              上一步
            </button>
            {wizardStep === 'review' ? (
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm
                           hover:opacity-90 transition-colors"
                onClick={handleWizardSubmit}
              >
                <CheckCircle className="w-4 h-4" />
                {isEditing ? '保存修改' : '创建任务'}
              </button>
            ) : (
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm
                           hover:bg-primary/20 transition-colors"
                onClick={handleWizardNext}
              >
                下一步
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Main render ──
  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 w-full h-full bg-background relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-sm font-semibold">自动化</h1>
        </div>
        <button
          type="button"
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
          onClick={onClose}
          title="关闭"
          aria-label="关闭自动化面板"
        >
          <X className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>

      {/* Content */}
      {viewMode === 'logs' ? (
        renderLogsView()
      ) : viewMode === 'create' || viewMode === 'edit' ? (
        renderWizard()
      ) : (
        renderTaskList()
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-foreground text-background text-sm shadow-lg
                        animate-slide-up z-50"
        >
          {toast}
        </div>
      )}
      {confirmDeleteId && (
        <ConfirmDialog
          title="确认删除任务"
          message="删除后该自动化任务及其运行记录将不可恢复，确定要删除吗？"
          onConfirm={() => {
            const id = confirmDeleteId
            setConfirmDeleteId(null)
            void handleDelete(id)
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}

// ── Small helper components ──

function ConfigRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-xs font-medium truncate ml-4 max-w-[60%]">{value || '—'}</span>
    </div>
  )
}

function DetailRow({ icon, label, value, error, multiline }: {
  icon: React.ReactNode
  label: string
  value: string
  error?: boolean
  multiline?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
        {icon} {label}
      </div>
      <div className={`text-xs p-2 rounded bg-secondary ${error ? 'text-red-400' : 'text-foreground'} ${multiline ? 'whitespace-pre-wrap' : ''}`}>
        {value}
      </div>
    </div>
  )
}
