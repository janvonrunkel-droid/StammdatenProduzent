'use client'

import { createContext, useContext, useState, useCallback, ReactNode, Dispatch, SetStateAction } from 'react'

// ============================================================================
// Types
// ============================================================================
// Action button type for chat responses
export interface ChatAction {
  label: string
  icon: '📊' | '📈' | '🔍' | '📄' | '📋'
  type: 'link'
  url: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean // Added for streaming support
  metadata?: {
    sources?: Array<{
      type: string
      article_name: string
      supplier_name: string
      price: number
      date: string
      document_number?: string | null
    }>
    actions?: ChatAction[]
    keywords?: string[]
    articles_found?: number
    prices_found?: number
  }
  created_at: string
}

export interface ChatSession {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

interface ChatContextType {
  // UI State
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  showHistory: boolean
  setShowHistory: (show: boolean) => void

  // Session State
  currentSessionId: string | null
  setCurrentSessionId: (id: string | null) => void

  // Messages State
  messages: ChatMessage[]
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void

  // Loading State
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Streaming State
  isStreaming: boolean
  setIsStreaming: (streaming: boolean) => void

  // Actions
  startNewChat: () => void
}

// ============================================================================
// Context
// ============================================================================
const ChatContext = createContext<ChatContextType | undefined>(undefined)

// ============================================================================
// Provider
// ============================================================================
export function ChatProvider({ children }: { children: ReactNode }) {
  // UI State
  const [isOpen, setIsOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Session State
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  // Messages State
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // Loading State
  const [isLoading, setIsLoading] = useState(false)

  // Streaming State
  const [isStreaming, setIsStreaming] = useState(false)

  // Add a single message
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message])
  }, [])

  // Update an existing message (for streaming)
  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === id ? { ...msg, ...updates } : msg
      )
    )
  }, [])

  // Start a new chat
  const startNewChat = useCallback(() => {
    setCurrentSessionId(null)
    setMessages([])
    setShowHistory(false)
  }, [])

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        setIsOpen,
        showHistory,
        setShowHistory,
        currentSessionId,
        setCurrentSessionId,
        messages,
        setMessages,
        addMessage,
        updateMessage,
        isLoading,
        setIsLoading,
        isStreaming,
        setIsStreaming,
        startNewChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================
export function useChatContext() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return context
}
