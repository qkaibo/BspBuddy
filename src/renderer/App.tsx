import { useState, useCallback, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Sidebar } from '../components/Sidebar'
import { WelcomeScreen } from '../components/WelcomeScreen'
import { ChatPanel } from '../components/ChatPanel'
import { ResultPanel } from '../components/ResultPanel'
import { PluginPanel } from '../components/PluginPanel'
import { ExpertCenter } from '../components/ExpertCenter'
import { MemoryPanel } from '../components/MemoryPanel'
import { ConnectorPanel } from '../components/ConnectorPanel'
import { ProjectPanel } from '../components/ProjectPanel'
import { PricingPanel } from '../components/PricingPanel'
import { DataPanel } from '../components/DataPanel'
import { SettingsPanel } from '../components/SettingsPanel'
import { MailboxPanel } from '../components/MailboxPanel'
import { ActivateMailbox } from '../components/ActivateMailbox'
import { CloudAgentPanel } from '../components/CloudAgentPanel'
import { InspirationPanel } from '../components/InspirationPanel'
import { AssistantPanel } from '../components/AssistantPanel'
import { AssistantSettings } from '../components/AssistantSettings'
import { FeedbackPanel } from '../components/FeedbackPanel'
import type { AgentMailbox } from '../lib/mailbox-types'
import { useAgent } from '../hooks/useAgent'
import { useSession } from '../hooks/useSession'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS, AVAILABLE_MODELS } from '../lib/types'
import type { Artifact, Message, TaskPlan, ModelOption } from '../lib/types'
import type { Expert, ExpertTeam } from '../lib/expert-types'

const ipc = createIpcClient()

type ViewType = 'chat' | 'plugins' | 'experts' | 'connectors' | 'projects' | 'mailbox' | 'activate-mailbox' | 'settings' | 'pricing' | 'data' | 'memory' | 'cloud-agent' | 'inspiration' | 'assistant' | 'assistant-settings' | 'feedback'

export default function App() {
  const { messages, activePlan, isProcessing, mode, setMode, modelId, setModelId, sendMessage, stopAgent, setMessages } = useAgent()
  const { saveSession, loadSession, listSessions } = useSession()
  const [collapsed, setCollapsed] = useState(false)
  const [sessions, setSessions] = useState<Array<{ id: string; title: string; date: string; active: boolean; workspace?: string }>>([])
  const [workspacePath, setWorkspacePath] = useState<string>()
  const [panelVisible, setPanelVisible] = useState(false)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [fileChanges, setFileChanges] = useState<Array<{ filePath: string; description: string; addedLines?: number; removedLines?: number }>>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>()
  const [activeView, setActiveView] = useState<ViewType>('chat')
  const [expertContext, setExpertContext] = useState<{ expert?: Expert; sessionId?: string }>({})
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string }>({ id: 'user-1', name: 'User', role: 'admin' })

  // Load sessions on startup
  useEffect(() => {
    listSessions().then((loaded) => {
      if (loaded.length === 0) {
        const id = uuid()
        const defaults = [
          { id, title: 'New Task', date: 'Now', active: true },
        ]
        setSessions(defaults)
        setCurrentSessionId(id)
      } else {
        setSessions(loaded.map((s) => ({ ...s, active: false })).map((s, i) => i === 0 ? { ...s, active: true } : s))
        setCurrentSessionId(loaded[0]?.id)
      }
    })
  }, [])

  // Auto-save after messages change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      const session = sessions.find((s) => s.id === currentSessionId)
      if (session) {
        saveSession(currentSessionId, session.title, messages, activePlan, workspacePath, mode, modelId)
      }
    }
  }, [messages, activePlan, currentSessionId])

  const handleSend = async (t: string) => {
    if (messages.length === 0) {
      setSessions((prev) => prev.map((s) => s.active ? { ...s, title: t.slice(0, 40) } : s))
    }
    const result = await sendMessage(t)
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
    setSessions((p) => [{ id, title: 'New Task', date: 'Now', active: true, workspace: workspacePath }, ...p.map((s) => ({ ...s, active: false }))])
    setCurrentSessionId(id)
    setMessages([])
    setArtifacts([])
    setFileChanges([])
    setPanelVisible(false)
    setActiveView('chat')
  }

  const handleSelectSession = async (id: string) => {
    setSessions((p) => p.map((s) => ({ ...s, active: s.id === id })))
    setCurrentSessionId(id)

    const session = await loadSession(id)
    if (session) {
      setMessages(session.messages || [])
      if (session.workspace) setWorkspacePath(session.workspace)
      if (session.mode) setMode(session.mode as any)
      if (session.modelId) setModelId(session.modelId)
    }
    setActiveView('chat')
  }

  const hasMsg = messages.length > 0

  const handleSummonExpert = useCallback((expert: Expert, sessionId: string, welcomeMessage: string) => {
    setExpertContext({ expert, sessionId })
    setActiveView('chat')
    setMessages([{
      id: uuid(),
      role: 'assistant',
      content: welcomeMessage,
      timestamp: Date.now(),
    }])
  }, [setMessages])

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
    <div style={{ height: '100vh', display: 'flex', background: 'var(--bg-root)', fontFamily: '-apple-system, sans-serif' }}>
      <Sidebar
        sessions={sessions}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        activeView={activeView}
        onNavigate={(view) => setActiveView(view)}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {activeView === 'plugins' ? (
            <PluginPanel onClose={handleNavigateToChat} workspacePath={workspacePath} />
          ) : activeView === 'experts' ? (
            <ExpertCenter onClose={handleNavigateToChat} onSummonExpert={handleSummonExpert} onTeamExecute={handleTeamExecute} />
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
              onCheckUpdate={() => {
                ipc.invoke(IPC_CHANNELS.UPDATE_CHECK)
              }}
            />
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
          ) : activeView === 'feedback' ? (
            <FeedbackPanel onClose={handleNavigateToChat} />
          ) : hasMsg ? (
            <ChatPanel
              messages={messages}
              activePlan={activePlan}
              isProcessing={isProcessing}
              mode={mode}
              workspacePath={workspacePath}
              modelId={modelId}
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
              models={AVAILABLE_MODELS}
              onModelChange={handleModelChange}
            />
          )}
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
  )
}
