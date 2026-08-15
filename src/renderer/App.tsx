import { useState, useCallback, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Sidebar } from '../components/Sidebar'
import { WelcomeScreen } from '../components/WelcomeScreen'
import { ChatPanel } from '../components/ChatPanel'
import type { ActiveResource } from '../components/ConversationContextBar'
import { ResultPanel } from '../components/ResultPanel'
import { PluginPanel } from '../components/PluginPanel'
import { ExpertCenter } from '../components/ExpertCenter'
import { MemoryPanel } from '../components/MemoryPanel'
import { ConnectorPanel } from '../components/ConnectorPanel'
import { ProjectPanel } from '../components/ProjectPanel'
import { PricingPanel } from '../components/PricingPanel'
import { DataPanel } from '../components/DataPanel'
import { SettingsPanel } from '../components/SettingsPanel'
import { MemberRolesPanel } from '../components/MemberRolesPanel'
import { MailboxPanel } from '../components/MailboxPanel'
import { ActivateMailbox } from '../components/ActivateMailbox'
import { CloudAgentPanel } from '../components/CloudAgentPanel'
import { InspirationPanel } from '../components/InspirationPanel'
import { AssistantPanel } from '../components/AssistantPanel'
import { AssistantSettings } from '../components/AssistantSettings'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { AutomationPanel } from '../components/AutomationPanel'
import { PolicyPanel } from '../components/PolicyPanel'
import { ModelConfigSettings } from '../components/ModelConfigSettings'
import { ExpertModelCatalogPanel } from '../components/ExpertModelCatalogPanel'
import { ContentShell } from '../components/ContentShell'
import { AppTitleBar } from '../components/AppTitleBar'
import type { AgentMailbox } from '../lib/mailbox-types'
import { useAgent } from '../hooks/useAgent'
import { useSession } from '../hooks/useSession'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { Artifact, Message, TaskPlan, ModelOption } from '../lib/types'
import type { Expert, ExpertTeam } from '../lib/expert-types'

const ipc = createIpcClient()

type ViewType = 'chat' | 'plugins' | 'experts' | 'connectors' | 'projects' | 'mailbox' | 'activate-mailbox' | 'settings' | 'member-roles' | 'pricing' | 'data' | 'memory' | 'cloud-agent' | 'inspiration' | 'assistant' | 'assistant-settings' | 'model-config' | 'expert-model-catalog' | 'feedback' | 'automation' | 'policy'

export default function App() {
  const { messages, activePlan, isProcessing, mode, setMode, modelId, setModelId, sendMessage, stopAgent, setMessages } = useAgent()
  const { saveSession, loadSession, listSessions } = useSession()
  const [collapsed, setCollapsed] = useState(false)
  const [sessions, setSessions] = useState<Array<{ id: string; title: string; date: string; active: boolean; workspace?: string; updatedAt?: number }>>([])
  const [workspacePath, setWorkspacePath] = useState<string>()
  const [panelVisible, setPanelVisible] = useState(false)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [fileChanges, setFileChanges] = useState<Array<{ filePath: string; description: string; addedLines?: number; removedLines?: number }>>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>()
  const [activeView, setActiveView] = useState<ViewType>('chat')
  const [pluginsInitialTab, setPluginsInitialTab] = useState<'installed' | 'market' | 'skills' | 'general-skills' | 'skill-store' | 'mcp' | 'knowledge'>('installed')
  const [expertContext, setExpertContext] = useState<{ expert?: Expert; sessionId?: string }>({})
  const [activeResources, setActiveResources] = useState<ActiveResource[]>([])
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string }>({ id: 'user-1', name: 'User', role: 'admin' })

  const syncAuthUser = useCallback(async () => {
    try {
      const me = await ipc.invoke(IPC_CHANNELS.AUTH_ME) as {
        user?: { id: string; displayName?: string; username: string; roles: string[] }
        error?: string
      }
      if (me?.user) {
        setCurrentUser({
          id: me.user.id,
          name: me.user.displayName || me.user.username,
          role: me.user.roles.includes('admin') ? 'admin' : 'member',
        })
      }
    } catch { /* session may not be ready */ }
  }, [])

  // Portal SSO / FastAPI token 变更后刷新侧栏账号
  useEffect(() => {
    const onAuthChanged = (payload?: { user?: { id?: string; display_name?: string; username?: string; role?: string } | null }) => {
      const u = payload?.user
      if (u && (u.display_name || u.username || u.id)) {
        setCurrentUser({
          id: String(u.id || 'portal-user'),
          name: String(u.display_name || u.username || 'User'),
          role: String(u.role || '').toLowerCase() === 'admin' ? 'admin' : 'member',
        })
        return
      }
      void syncAuthUser()
    }
    ipc.on(IPC_CHANNELS.EXPERT_AUTH_CHANGED, onAuthChanged)
    return () => {
      ipc.off(IPC_CHANNELS.EXPERT_AUTH_CHANGED, onAuthChanged)
    }
  }, [syncAuthUser])

  // Load sessions on startup
  useEffect(() => {
    listSessions().then(async (loaded) => {
      if (loaded.length === 0) {
        const id = uuid()
        const defaults = [
          { id, title: 'New Task', date: 'Now', active: true },
        ]
        setSessions(defaults)
        setCurrentSessionId(id)
      } else {
        // Load last session data first, so expertContext / activeResources
        // are in state before setting currentSessionId (avoids auto-save
        // race that would overwrite the session file with empty data).
        const lastId = loaded[0]?.id
        if (lastId) {
          try {
            const session = await loadSession(lastId)
            if (session?.expertContext) setExpertContext(session.expertContext as any)
            if (session?.activeResources) setActiveResources(session.activeResources as any)
            setMessages(session?.messages || [])
            if (session?.workspace) setWorkspacePath(session.workspace)
            if (session?.mode) setMode(session.mode as any)
            if (session?.modelId) setModelId(session.modelId)
          } catch { /* session load optional on startup */ }
        }
        setSessions(loaded.map((s) => ({ ...s, active: false })).map((s, i) => i === 0 ? { ...s, active: true } : s))
        setCurrentSessionId(loaded[0]?.id)
      }
    })
    void syncAuthUser()
  }, [syncAuthUser])

  // Auto-save after messages change; bump current task to top (最近使用)
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      const session = sessions.find((s) => s.id === currentSessionId)
      if (session) {
        const now = Date.now()
        saveSession(currentSessionId, session.title, messages, activePlan, workspacePath, mode, modelId, expertContext, activeResources)
        setSessions((prev) => {
          const idx = prev.findIndex((s) => s.id === currentSessionId)
          if (idx < 0) return prev
          const current = { ...prev[idx], updatedAt: now, active: true }
          if (idx === 0) {
            return [current, ...prev.slice(1).map((s) => ({ ...s, active: false }))]
          }
          const rest = prev.filter((s) => s.id !== currentSessionId).map((s) => ({ ...s, active: false }))
          return [current, ...rest]
        })
      }
    }
  }, [messages, activePlan, currentSessionId, expertContext, activeResources])

  const handleSend = async (t: string) => {
    if (messages.length === 0) {
      setSessions((prev) => {
        const current = prev.find((s) => s.active)
        if (!current) return prev
        const rest = prev.filter((s) => s.id !== current.id)
        return [{ ...current, title: t.slice(0, 40), updatedAt: Date.now() }, ...rest]
      })
    }
    const expertInfo = expertContext?.expert
      ? { name: expertContext.expert.name, title: expertContext.expert.title, methodology: expertContext.expert.methodology, toolChain: expertContext.expert.toolChain, persona: expertContext.expert.persona }
      : undefined
    const result = await sendMessage(t, modelId, expertContext?.expert?.id, expertInfo, activeResources)
    if (result.artifacts && result.artifacts.length > 0) {
      setArtifacts((prev) => [...prev, ...result.artifacts!])
      setPanelVisible(true)
    }
    if (result.fileChanges && result.fileChanges.length > 0) {
      setFileChanges((prev) => [...prev, ...result.fileChanges!])
    }
  }

  const handleSelectWorkspace = useCallback(async () => {
    const result = await ipc.invoke(IPC_CHANNELS.FILE_DIALOG, { type: 'open' })
    if (result && Array.isArray(result) && result.length > 0) {
      setWorkspacePath(result[0])
    }
  }, [])

  const handleNewSession = () => {
    const id = uuid()
    const now = Date.now()
    setSessions((p) => [{ id, title: 'New Task', date: 'Now', active: true, workspace: workspacePath, updatedAt: now }, ...p.map((s) => ({ ...s, active: false }))])
    setCurrentSessionId(id)
    setMessages([])
    setArtifacts([])
    setFileChanges([])
    setExpertContext({})
    setActiveResources([])
    setPanelVisible(false)
    setActiveView('chat')
  }

  const handleSelectSession = async (id: string) => {
    // Load data first, before setting currentSessionId,
    // so the auto-save effect won't fire with stale (empty) expertContext.
    const session = await loadSession(id)
    if (session) {
      setMessages(session.messages || [])
      if (session.workspace) setWorkspacePath(session.workspace)
      if (session.mode) setMode(session.mode as any)
      if (session.modelId) setModelId(session.modelId)
      if (session.expertContext) setExpertContext(session.expertContext as any)
      if (session.activeResources) setActiveResources(session.activeResources as any)
    }
    const now = Date.now()
    setSessions((p) => {
      const current = p.find((s) => s.id === id)
      if (!current) return p.map((s) => ({ ...s, active: s.id === id }))
      const rest = p.filter((s) => s.id !== id)
      return [{ ...current, active: true, updatedAt: now }, ...rest.map((s) => ({ ...s, active: false }))]
    })
    setCurrentSessionId(id)
    setActiveView('chat')
    // Touch disk so next cold start also sorts by last used
    if (session) {
      void saveSession(
        id,
        session.title || 'New Task',
        session.messages || [],
        session.plan || null,
        session.workspace,
        session.mode,
        session.modelId,
        session.expertContext,
        session.activeResources,
      )
    }
  }

  const hasMsg = messages.length > 0

  const handleSummonExpert = useCallback((expert: Expert, sessionId: string, welcomeMessage: string) => {
    // Create a new session for this expert
    const id = sessionId || uuid()
    const title = expert.title || expert.name
    setSessions((p) => [{ id, title, date: 'Now', active: true, workspace: workspacePath, updatedAt: Date.now() }, ...p.map((s) => ({ ...s, active: false }))])
    setCurrentSessionId(id)
    setArtifacts([])
    setFileChanges([])
    setPanelVisible(false)
    setExpertContext({ expert, sessionId: id })
    setActiveResources([{ id: expert.id, type: 'expert' as const, name: title }])
    setActiveView('chat')
    setMessages([{
      id: uuid(),
      role: 'assistant',
      content: welcomeMessage,
      timestamp: Date.now(),
    }])
  }, [workspacePath])

  const handleTeamExecute = useCallback(async (team: ExpertTeam, task: string) => {
    setActiveView('chat')
    const result = await ipc.invoke(IPC_CHANNELS.EXPERT_TEAM_EXECUTE, team.id, task) as { success: boolean; execution?: any; error?: string }
    if (result.success && result.execution) {
      const welcomeMsg: Message = {
        id: uuid(),
        role: 'assistant',
        content: `## 👥 专家团「${team.name}」已启动\n\n${result.execution.plan?.leaderComment || `正在处理任务: ${task}`}\n\n团长将自动拆解任务，并行执行并整合交付。`,
        timestamp: Date.now(),
      }
      setMessages([welcomeMsg])
      handleSend(result.execution.plan?.leaderComment || task)
    }
  }, [setMessages])

  const handleNavigateToChat = useCallback(() => {
    setActiveView('chat')
  }, [])

  const handleModelChange = useCallback((model: ModelOption) => {
    setModelId(model.id)
  }, [setModelId])

  const handleSceneChange = useCallback((scene: string) => {
    // Scene change handler - can be extended later
  }, [])

  const handleSkillClick = useCallback((skillId: string) => {
    // Skill click handler - can be extended later
  }, [])

  return (
    <div className="bb-app-shell">
      <AppTitleBar />
      <div className="bb-app-body">
      <Sidebar
        sessions={sessions}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        activeView={activeView}
        currentUser={currentUser}
        onNavigate={(view) => {
          if (view === 'plugins') setPluginsInitialTab('installed')
          setActiveView(view)
        }}
      />
      <div className="bb-main-stage">
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          <ContentShell>
          {activeView === 'plugins' ? (
            <PluginPanel
              key={`plugins-${pluginsInitialTab}`}
              onClose={() => {
                setPluginsInitialTab('installed')
                handleNavigateToChat()
              }}
              workspacePath={workspacePath}
              initialTab={pluginsInitialTab}
            />
          ) : activeView === 'experts' ? (
            <ExpertCenter
              onClose={handleNavigateToChat}
              onSummonExpert={handleSummonExpert}
              onTeamExecute={handleTeamExecute}
              onManageSop={() => {
                setPluginsInitialTab('skills')
                setActiveView('plugins')
              }}
              onManageSkill={() => {
                setPluginsInitialTab('general-skills')
                setActiveView('plugins')
              }}
              onManageMcp={() => {
                setPluginsInitialTab('mcp')
                setActiveView('plugins')
              }}
            />
          ) : activeView === 'memory' ? (
            <MemoryPanel onClose={handleNavigateToChat} />
          ) : activeView === 'connectors' ? (
            <ConnectorPanel onClose={handleNavigateToChat} workspacePath={workspacePath} />
          ) : activeView === 'projects' ? (
            <ProjectPanel
              onNavigateToChat={handleNavigateToChat}
              currentUser={currentUser}
              onUpdateUser={(name) => setCurrentUser(p => ({ ...p, name }))}
            />
          ) : activeView === 'pricing' ? (
            <PricingPanel onClose={handleNavigateToChat} />
          ) : activeView === 'data' ? (
            <DataPanel onClose={handleNavigateToChat} />
          ) : activeView === 'settings' ? (
            <SettingsPanel
              onClose={handleNavigateToChat}
              onNavigateData={() => setActiveView('data')}
              onNavigateAssistant={() => setActiveView('assistant-settings')}
              onNavigateMembers={() => setActiveView('member-roles')}
              onNavigateModelConfig={() => setActiveView('model-config')}
              onNavigateExpertModels={() => setActiveView('expert-model-catalog')}
              onSessionChanged={() => { void syncAuthUser() }}
              onCheckUpdate={() => {
                ipc.invoke(IPC_CHANNELS.UPDATE_CHECK)
              }}
            />
          ) : activeView === 'member-roles' ? (
            <MemberRolesPanel onBack={() => setActiveView('settings')} />
          ) : activeView === 'mailbox' ? (
            <MailboxPanel
              onClose={handleNavigateToChat}
              onInjectToChat={async (mailId) => {
                const ctx = await ipc.invoke(IPC_CHANNELS.MAIL_CONTEXT, mailId) as { subject: string; from: string; body: string } | null
                if (ctx) {
                  setActiveView('chat')
                  handleSend(`处理以下邮件内容：\n\n## ${ctx.subject}\n发件人: ${ctx.from}\n\n${ctx.body}`)
                }
              }}
              onActivate={() => setActiveView('activate-mailbox')}
            />
          ) : activeView === 'activate-mailbox' ? (
            <ActivateMailbox
              onBack={() => setActiveView('mailbox')}
              onComplete={(mailbox: AgentMailbox) => {
                setTimeout(() => setActiveView('mailbox'), 1500)
              }}
            />
          ) : activeView === 'cloud-agent' ? (
            <CloudAgentPanel onClose={handleNavigateToChat} />
          ) : activeView === 'inspiration' ? (
            <InspirationPanel onClose={handleNavigateToChat} onFork={(preset) => handleSend(preset.prompt)} />
          ) : activeView === 'assistant' ? (
            <AssistantPanel onNavigateToSettings={() => setActiveView('assistant-settings')} />
          ) : activeView === 'assistant-settings' ? (
            <AssistantSettings onBack={() => setActiveView('settings')} />
          ) : activeView === 'model-config' ? (
            <ModelConfigSettings onBack={() => setActiveView('settings')} />
          ) : activeView === 'expert-model-catalog' ? (
            <ExpertModelCatalogPanel onBack={() => setActiveView('settings')} />
          ) : activeView === 'feedback' ? (
            <FeedbackPanel onClose={handleNavigateToChat} />
          ) : activeView === 'automation' ? (
            <AutomationPanel onClose={handleNavigateToChat} />
          ) : activeView === 'policy' ? (
            <PolicyPanel onClose={handleNavigateToChat} />
          ) : hasMsg ? (
            <ChatPanel
              messages={messages}
              activePlan={activePlan}
              isProcessing={isProcessing}
              mode={mode}
              workspacePath={workspacePath}
              modelId={modelId}
              activeResources={activeResources}
              onResourcesChange={setActiveResources}
              onModeChange={setMode}
              onModelChange={(m) => setModelId(m.id)}
              onSend={handleSend}
              onStop={stopAgent}
              onSelectWorkspace={handleSelectWorkspace}
            />
          ) : (
            <WelcomeScreen
              onPrompt={handleSend}
              onSceneChange={handleSceneChange}
              onSkillClick={handleSkillClick}
              onSelectWorkspace={handleSelectWorkspace}
              workspacePath={workspacePath}
              modelId={modelId}
              onModelChange={handleModelChange}
            />
          )}
          </ContentShell>
          {activeView === 'chat' && (
            <ResultPanel
              artifacts={artifacts}
              workspacePath={workspacePath}
              visible={panelVisible}
              onToggle={() => setPanelVisible(false)}
              changes={fileChanges}
            />
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
