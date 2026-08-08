import { useAgent } from '@/hooks/useAgent'
import { ChatInput } from '@/components/ChatInput'
import { ResultPanel } from '@/components/ResultPanel'
import { Bot, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useState } from 'react'

export default function App() {
  const { messages, activePlan, isProcessing, sendMessage } = useAgent()
  const [showPanel, setShowPanel] = useState(true)

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border glass shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-sm font-semibold">BspBuddy</h1>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
            MVP
          </span>
        </div>
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
          title="Toggle panel"
        >
          {showPanel ? (
            <PanelRightClose className="w-4 h-4 text-muted-foreground" />
          ) : (
            <PanelRightOpen className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Bot className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">Describe what you need, and BspBuddy will take care of it.</p>
                <div className="mt-6 flex flex-wrap gap-2 max-w-lg justify-center">
                  {[
                    'Analyze sales data and generate a report',
                    'Search for the latest AI trends',
                    'Create a project plan document',
                    'Summarize this PDF file',
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => sendMessage(example)}
                      disabled={isProcessing}
                      className="px-3 py-1.5 text-xs rounded-full bg-secondary border border-border
                                 hover:bg-accent text-muted-foreground hover:text-foreground
                                 transition-colors disabled:opacity-50"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`animate-slide-up ${
                  msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : msg.role === 'system'
                        ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                        : 'bg-secondary text-foreground'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.artifacts && msg.artifacts.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      {msg.artifacts.map((a) => (
                        <div
                          key={a.path}
                          className="text-xs text-muted-foreground flex items-center gap-1"
                        >
                          <span className="text-primary">●</span> {a.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isProcessing && !activePlan && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-lg px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse-slow" />
                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse-slow" style={{ animationDelay: '0.2s' }} />
                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse-slow" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <ChatInput onSend={sendMessage} disabled={isProcessing} />
        </div>

        {/* Right panel */}
        {showPanel && (
          <aside className="w-80 border-l border-border glass flex flex-col shrink-0">
            <ResultPanel artifacts={[]} visible={true} onToggle={() => {}} />
          </aside>
        )}
      </main>

      {/* Status bar */}
      <footer className="flex items-center justify-between px-4 py-1 border-t border-border text-[11px] text-muted-foreground shrink-0">
        <span>BspBuddy v0.1.0</span>
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-warning animate-pulse' : 'bg-success'}`} />
          {isProcessing ? 'Processing' : 'Ready'}
        </span>
      </footer>
    </div>
  )
}
