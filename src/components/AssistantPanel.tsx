import { useEffect, useRef, useState } from 'react'
import { Bot, RotateCcw, Send, Sparkles, UserRound, X } from 'lucide-react'
import type { Incident } from '../data/incidents'
import { getAssistantReply } from '../assistant'

type Message = {
  id: number
  role: 'assistant' | 'user'
  text: string
}

type AssistantPanelProps = {
  events: Incident[]
  onClose: () => void
  selectedIncident: Incident | null
}

const welcomeMessage: Message = {
  id: 0,
  role: 'assistant',
  text: 'Hi! I can help explain the map and its sample signals. What would you like to explore?',
}

const suggestions = [
  'Explain the selected signal',
  'How does SAR work?',
  'Summarize visible events',
]

export function AssistantPanel({
  events,
  onClose,
  selectedIncident,
}: AssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage])
  const [draft, setDraft] = useState('')
  const nextId = useRef(1)
  const endOfMessagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function sendMessage(text: string) {
    const question = text.trim()
    if (!question) return

    const userMessage: Message = {
      id: nextId.current++,
      role: 'user',
      text: question,
    }
    const assistantMessage: Message = {
      id: nextId.current++,
      role: 'assistant',
      text: getAssistantReply(question, selectedIncident, events),
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      assistantMessage,
    ])
    setDraft('')
  }

  function resetConversation() {
    setMessages([welcomeMessage])
    nextId.current = 1
    setDraft('')
    inputRef.current?.focus()
  }

  return (
    <aside aria-label="SAR AI assistant" className="assistant-panel">
      <header className="assistant-header">
        <div className="assistant-heading-icon"><Bot size={18} /></div>
        <div className="assistant-heading-copy">
          <strong>SAR assistant</strong>
          <span><i /> MAP-AWARE DEMO</span>
        </div>
        <button
          aria-label="Start a new chat"
          className="assistant-header-button"
          onClick={resetConversation}
          title="New chat"
          type="button"
        >
          <RotateCcw size={15} />
        </button>
        <button
          aria-label="Close assistant"
          className="assistant-header-button"
          onClick={onClose}
          type="button"
        >
          <X size={17} />
        </button>
      </header>

      <div aria-live="polite" className="assistant-messages" role="log">
        {messages.map((message) => (
          <div className={`chat-message chat-${message.role}`} key={message.id}>
            <div className="chat-avatar">
              {message.role === 'assistant' ? <Sparkles size={14} /> : <UserRound size={14} />}
            </div>
            <div className="chat-bubble">
              {message.role === 'assistant' && (
                <span className="chat-sender">SAR ASSISTANT</span>
              )}
              <p>{message.text}</p>
            </div>
          </div>
        ))}
        <div ref={endOfMessagesRef} />
      </div>

      {messages.length === 1 && (
        <div className="assistant-suggestions">
          <span>TRY ASKING</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => sendMessage(suggestion)}
              type="button"
            >
              <Sparkles size={12} />
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        className="assistant-compose"
        onSubmit={(event) => {
          event.preventDefault()
          sendMessage(draft)
        }}
      >
        <input
          aria-label="Ask the SAR assistant"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about this map..."
          ref={inputRef}
          value={draft}
        />
        <button aria-label="Send message" disabled={!draft.trim()} type="submit">
          <Send size={15} />
        </button>
      </form>

      <p className="assistant-disclaimer">
        Demo assistant · Replies use sample data, not a live AI model.
      </p>
    </aside>
  )
}
