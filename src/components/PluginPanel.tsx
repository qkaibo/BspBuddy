import { useState, useEffect } from 'react'
import { Box, Puzzle, Plus, Trash2, Download, Globe, ExternalLink, Search as SearchIcon, Shield, Zap, Server } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Plugin, PluginMarket, PluginType } from '../lib/plugin-types'
import { SkillMarketPanel } from './SkillMarketPanel'
import { MCPConfigPanel } from './MCPConfigPanel'

const ipc = createIpcClient()

const TYPE_LABELS: Record<PluginType, string> = {
  skill: '技能',
  mcp: 'MCP',
  hook: '钩子',
  agent: '智能体',
  rule: '规则',
}

interface Props {
  onClose: () => void
  workspacePath?: string
}

type PanelTab = 'installed' | 'market' | 'skills' | 'mcp'

export function PluginPanel({ onClose, workspacePath }: Props) {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [marketPlugins, setMarketPlugins] = useState<Plugin[]>([])
  const [markets, setMarkets] = useState<PluginMarket[]>([])
  const [showAddMarket, setShowAddMarket] = useState(false)
  const [marketUrl, setMarketUrl] = useState('')
  const [marketName, setMarketName] = useState('')
  const [activeTab, setActiveTab] = useState<PanelTab>('installed')
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<PluginType | 'all'>('all')
  const [installing, setInstalling] = useState<string | null>(null)

  useEffect(() => {
    loadPlugins()
    loadMarketPlugins()
    loadMarkets()
  }, [])

  async function loadPlugins() {
    const list = (await ipc.invoke(IPC_CHANNELS.PLUGIN_LIST)) as Plugin[]
    setPlugins(list)
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
    const list = (await ipc.invoke(IPC_CHANNELS.PLUGIN_MARKET_LIST)) as PluginMarket[]
    setMarkets(list)
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

  const filtered = (activeTab === 'installed' ? plugins : marketPlugins).filter((p) => {
    if (selectedType !== 'all' && p.type !== selectedType) return false
    if (search && !p.name.includes(search) && !p.description.includes(search)) return false
    return true
  })

  if (activeTab === 'skills') {
    return <SkillMarketPanel onClose={() => setActiveTab('installed')} />
  }

  if (activeTab === 'mcp') {
    return <MCPConfigPanel onClose={() => setActiveTab('installed')} workspacePath={workspacePath} />
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Puzzle size={18} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>插件管理</span>
        </div>
        <button onClick={onClose} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>x</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        {([
          { id: 'installed' as const, label: '已安装' },
          { id: 'market' as const, label: '插件市场' },
          { id: 'skills' as const, label: '技能' },
          { id: 'mcp' as const, label: 'MCP' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 12px', border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setShowAddMarket(!showAddMarket)}
          style={{
            padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'inherit',
            marginLeft: 'auto',
          }}
          title="添加第三方市场"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Add market form */}
      {showAddMarket && (
        <div style={{ padding: '10px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input
              value={marketName}
              onChange={(e) => setMarketName(e.target.value)}
              placeholder="市场名称 (可选)"
              style={{
                flex: '0 0 120px', padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)',
                fontSize: 11, fontFamily: 'inherit', background: 'var(--bg-input)', color: 'var(--text-primary)',
              }}
            />
            <input
              value={marketUrl}
              onChange={(e) => setMarketUrl(e.target.value)}
              placeholder="输入插件市场地址..."
              style={{
                flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)',
                fontSize: 11, fontFamily: 'inherit', background: 'var(--bg-input)', color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={handleAddMarket}
              style={{
                padding: '5px 12px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff',
                fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              添加
            </button>
          </div>
          {markets.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {markets.map((m) => (
                <span key={m.id} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                  <Globe size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                  {m.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-input)', borderRadius: 4, padding: '4px 8px', flex: 1 }}>
          <SearchIcon size={12} color="var(--text-tertiary)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'installed' ? '搜索已安装插件...' : '搜索市场插件...'}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />
        </div>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as PluginType | 'all')}
          style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 11, fontFamily: 'inherit', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
        >
          <option value="all">全部类型</option>
          <option value="skill">技能</option>
          <option value="mcp">MCP</option>
          <option value="hook">钩子</option>
          <option value="agent">智能体</option>
          <option value="rule">规则</option>
        </select>
      </div>

      {/* Plugin List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
            {activeTab === 'installed' ? '暂无已安装插件' : '市场中没有更多插件'}
          </div>
        )}
        {filtered.map((plugin) => (
          <div
            key={plugin.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
              background: 'var(--bg-card)', marginBottom: 6, border: '1px solid var(--border)',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: plugin.installed ? 'var(--accent-light)' : 'var(--bg-hover)', flexShrink: 0,
            }}>
              <Puzzle size={16} color={plugin.installed ? 'var(--accent)' : 'var(--text-tertiary)'} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{plugin.name}</span>
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>
                  {TYPE_LABELS[plugin.type]}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>v{plugin.version}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {plugin.description}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {plugin.author} {plugin.category && `· ${plugin.category}`}
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              {plugin.installed ? (
                <button
                  onClick={() => handleUninstall(plugin.id)}
                  style={{
                    padding: '4px 10px', borderRadius: 4, border: '1px solid var(--danger)',
                    background: 'transparent', color: 'var(--danger)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  卸载
                </button>
              ) : (
                <button
                  onClick={() => handleInstall(plugin.id)}
                  disabled={installing === plugin.id}
                  style={{
                    padding: '4px 10px', borderRadius: 4, border: 'none',
                    background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                    opacity: installing === plugin.id ? 0.6 : 1,
                  }}
                >
                  {installing === plugin.id ? '安装中...' : '安装'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
