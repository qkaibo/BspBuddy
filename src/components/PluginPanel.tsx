import { useState, useEffect, type CSSProperties, type ReactNode } from 'react'
import { Box, Puzzle, Plus, Trash2, Globe, Search as SearchIcon, Shield, Zap, Server } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Plugin, PluginMarket, PluginType } from '../lib/plugin-types'
import { MCPConfigPanel } from './MCPConfigPanel'
import { SopWorkbench } from './SopWorkbench'
import { SkillsPanel } from './SkillsPanel'
import { SkillStorePanel } from './SkillStorePanel'
import { McpPanel } from './McpPanel'
import { ConfirmDialog } from './ConfirmDialog'
import { PanelChrome } from './ui/PanelChrome'

const ipc = createIpcClient()

const TYPE_LABELS: Record<PluginType, string> = {
  skill: '技能',
  mcp: 'MCP',
  hook: '钩子',
  agent: '智能体',
  rule: '规则',
}

type PanelTab = 'installed' | 'market' | 'skills' | 'general-skills' | 'skill-store' | 'mcp' | 'knowledge'

interface Props {
  onClose: () => void
  workspacePath?: string
  /** StaffDeck: open directly on SOP tab when coming from ExpertCenter */
  initialTab?: PanelTab
}

export function PluginPanel({ onClose, workspacePath: _workspacePath, initialTab = 'installed' }: Props) {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [marketPlugins, setMarketPlugins] = useState<Plugin[]>([])
  const [markets, setMarkets] = useState<PluginMarket[]>([])
  const [showAddMarket, setShowAddMarket] = useState(false)
  const [marketUrl, setMarketUrl] = useState('')
  const [marketName, setMarketName] = useState('')
  const [activeTab, setActiveTab] = useState<PanelTab>(initialTab)
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<PluginType | 'all'>('all')
  const [installing, setInstalling] = useState<string | null>(null)
  const [confirmUninstallId, setConfirmUninstallId] = useState<string | null>(null)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    loadPlugins()
    loadMarketPlugins()
    loadMarkets()
  }, [])

  async function loadPlugins() {
    try {
      const list = (await ipc.invoke(IPC_CHANNELS.PLUGIN_LIST)) as Plugin[]
      setPlugins(Array.isArray(list) ? list : [])
    } catch {
      setPlugins([])
    }
  }

  async function loadMarketPlugins() {
    setMarketPlugins([
      {
        id: 'plugin-market-files', name: '智能文件管理', version: '2.0.0', author: 'FileMaster',
        description: '自动分类、批量重命名、清理重复文件', type: 'skill', category: 'productivity',
        installed: false, enabled: false, icon: 'folder',
      },
      {
        id: 'plugin-market-data', name: '数据分析平台', version: '1.8.0', author: 'DataLabs',
        description: '高级数据分析、可视化、报表生成', type: 'agent', category: 'data',
        installed: false, enabled: false, icon: 'bar-chart',
      },
      {
        id: 'plugin-market-auto', name: '自动化工作流', version: '3.0.0', author: 'FlowBot',
        description: '创建复杂自动化工作流，串联多步骤任务', type: 'hook', category: 'productivity',
        installed: false, enabled: false, icon: 'zap',
      },
      {
        id: 'plugin-market-codereview', name: '代码审查规则', version: '1.3.0', author: 'CodeQuality',
        description: '自动代码规范检查和安全审查规则', type: 'rule', category: 'development',
        installed: false, enabled: false, icon: 'shield',
      },
    ])
  }

  async function loadMarkets() {
    try {
      const list = (await ipc.invoke(IPC_CHANNELS.PLUGIN_MARKET_LIST)) as PluginMarket[]
      setMarkets(Array.isArray(list) ? list : [])
    } catch {
      setMarkets([])
    }
  }

  async function handleInstall(pluginId: string) {
    setInstalling(pluginId)
    const result = await ipc.invoke(IPC_CHANNELS.PLUGIN_INSTALL, pluginId) as { success: boolean; error?: string; warnings?: string[] }
    setInstalling(null)
    if (result.success) {
      await loadPlugins()
      await loadMarketPlugins()
    }
  }

  async function handleUninstall(pluginId: string) {
    await ipc.invoke(IPC_CHANNELS.PLUGIN_UNINSTALL, pluginId)
    await loadPlugins()
  }

  async function handleAddMarket() {
    if (!marketUrl.trim()) return
    await ipc.invoke(IPC_CHANNELS.PLUGIN_MARKET_ADD, marketUrl.trim(), marketName.trim() || undefined)
    setMarketUrl('')
    setMarketName('')
    setShowAddMarket(false)
    await loadMarkets()
  }

  const filtered = (Array.isArray(activeTab === 'installed' ? plugins : marketPlugins)
    ? (activeTab === 'installed' ? plugins : marketPlugins)
    : []
  ).filter((p) => {
    if (selectedType !== 'all' && p.type !== selectedType) return false
    if (search && !(p.name || '').includes(search) && !(p.description || '').includes(search)) return false
    return true
  })

  const tabs: { id: PanelTab; label: string }[] = [
    { id: 'installed', label: '已安装' },
    { id: 'market', label: '插件市场' },
    { id: 'skills', label: 'SOP' },
    { id: 'general-skills', label: '通用技能' },
    { id: 'skill-store', label: '技能商店' },
    { id: 'mcp', label: 'MCP' },
    { id: 'knowledge', label: '知识库' },
  ]

  function renderChrome(body: ReactNode, toolbar?: ReactNode, bodyStyle?: CSSProperties) {
    return (
      <PanelChrome
        title="插件与资源"
        icon={<Puzzle size={16} strokeWidth={1.75} />}
        onClose={onClose}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as PanelTab)}
        toolbar={toolbar}
        bodyStyle={bodyStyle ?? { padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {body}
      </PanelChrome>
    )
  }

  // SOP tab — Scope (agents-002) + 创作台 (agents-003)
  if (activeTab === 'skills') {
    return renderChrome(<SopWorkbench initialMode="scope" />)
  }

  // General Skills tab — StaffDeck scope pattern (agents-002)
  if (activeTab === 'general-skills') {
    return renderChrome(<SkillsPanel />)
  }

  if (activeTab === 'skill-store') {
    return renderChrome(<SkillStorePanel />)
  }

  if (activeTab === 'mcp') {
    return renderChrome(<McpPanel />)
  }

  if (activeTab === 'knowledge') {
    return renderChrome(
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, lineHeight: 1.6 }}>
        知识库将按同样的「当前专家 scope + 从广场/同事复制」模式实现。
        <br />当前请先用 SOP Tab 管理流程能力。
      </div>,
    )
  }

  const listToolbar = (
    <>
      <div className="bb-search" style={{ flex: 1 }}>
        <SearchIcon size={13} color="var(--text-tertiary)" aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          name="plugin-search"
          aria-label="搜索插件"
          placeholder="搜索插件…"
        />
      </div>
      <select
        className="bb-select"
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value as PluginType | 'all')}
        aria-label="插件类型筛选"
        style={{ width: 'auto', minWidth: 108 }}
      >
        <option value="all">全部类型</option>
        <option value="skill">技能</option>
        <option value="mcp">MCP</option>
        <option value="hook">钩子</option>
        <option value="agent">智能体</option>
        <option value="rule">规则</option>
      </select>
      {activeTab === 'market' && (
        <button type="button" className="bb-btn bb-btn-secondary" onClick={() => setShowAddMarket(!showAddMarket)}>
          <Plus size={12} aria-hidden="true" /> 市场源
        </button>
      )}
    </>
  )

  return renderChrome(
    <>
      {showAddMarket && activeTab === 'market' && (
        <div style={{ padding: '10px 16px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <input className="bb-input" value={marketName} onChange={(e) => setMarketName(e.target.value)} placeholder="名称" style={{ width: 100 }} />
          <input className="bb-input" value={marketUrl} onChange={(e) => setMarketUrl(e.target.value)} placeholder="市场 URL" style={{ flex: 1 }} />
          <button type="button" className="bb-btn bb-btn-primary" onClick={() => void handleAddMarket()}>添加</button>
        </div>
      )}

      {activeTab === 'market' && markets.length > 0 && (
        <div style={{ padding: '8px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          {markets.map((m) => (
            <span key={m.id} className="bb-chip bb-chip-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Globe size={10} aria-hidden="true" /> {m.name}
            </span>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 20px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-tertiary)', fontSize: 'var(--font-body)', lineHeight: 1.6 }}>
            {activeTab === 'installed' ? '暂无已安装插件，可到「插件市场」安装' : '暂无匹配的插件'}
          </div>
        )}
        {filtered.map((plugin) => (
          <div key={plugin.id} className="bb-list-card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent-light)', flexShrink: 0,
              }}>
                {plugin.type === 'mcp' ? <Server size={15} strokeWidth={1.75} color="var(--accent)" />
                  : plugin.type === 'rule' ? <Shield size={15} strokeWidth={1.75} color="var(--accent)" />
                    : plugin.type === 'hook' ? <Zap size={15} strokeWidth={1.75} color="var(--accent)" />
                      : <Box size={15} strokeWidth={1.75} color="var(--accent)" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--font-title)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{plugin.name}</span>
                  <span style={{ fontSize: 'var(--font-micro)', color: 'var(--text-tertiary)' }}>v{plugin.version}</span>
                  <span className="bb-chip" style={{ background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>{TYPE_LABELS[plugin.type]}</span>
                </div>
                <div style={{ fontSize: 'var(--font-label)', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>{plugin.description}</div>
                <div style={{ fontSize: 'var(--font-micro)', color: 'var(--text-tertiary)', marginTop: 4 }}>by {plugin.author}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {activeTab === 'installed' ? (
                  <button
                    type="button"
                    className="bb-icon-btn"
                    onClick={() => setConfirmUninstallId(plugin.id)}
                    aria-label={`卸载插件 ${plugin.name}`}
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="bb-btn bb-btn-primary"
                    onClick={() => void handleInstall(plugin.id)}
                    disabled={installing === plugin.id}
                    style={{ opacity: installing === plugin.id ? 0.6 : 1 }}
                  >
                    {installing === plugin.id ? '安装中…' : '安装'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {confirmUninstallId && (
        <ConfirmDialog
          title="确认卸载"
          message="卸载后将移除该插件及其配置，确定要继续吗？"
          confirmLabel="确认卸载"
          onConfirm={() => {
            const id = confirmUninstallId
            setConfirmUninstallId(null)
            void handleUninstall(id)
          }}
          onCancel={() => setConfirmUninstallId(null)}
        />
      )}
    </>,
    listToolbar,
  )
}
