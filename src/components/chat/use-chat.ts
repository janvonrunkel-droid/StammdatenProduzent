'use client'

import { useCallback } from 'react'
import { useChatContext, ChatMessage, ChatSession } from './chat-context'
import { toast } from 'sonner'

// ============================================================================
// Types
// ============================================================================
interface SendMessageResponse {
  session_id: string
  message_id: string
  response: {
    content: string
    sources: Array<{
      type: string
      article_name: string
      supplier_name: string
      price: number
      date: string
      document_number?: string | null
    }>
  }
  metadata: {
    keywords_used: string[]
    articles_found: number
    prices_found: number
  }
}

interface SessionsResponse {
  data: ChatSession[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

interface SessionDetailResponse {
  data: ChatSession & {
    messages: ChatMessage[]
  }
}

// ============================================================================
// Hook
// ============================================================================
export function useChat() {
  const {
    currentSessionId,
    setCurrentSessionId,
    messages,
    setMessages,
    addMessage,
    isLoading,
    setIsLoading,
    setShowHistory,
  } = useChatContext()

  /**
   * Send a message and get a response from the chat API
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    setIsLoading(true)

    // Create optimistic user message
    const tempUserMessageId = `temp-${Date.now()}`
    const userMessage: ChatMessage = {
      id: tempUserMessageId,
      session_id: currentSessionId || '',
      role: 'user',
      content: content.trim(),
      created_at: new Date().toISOString(),
    }

    // Add user message immediately
    addMessage(userMessage)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content.trim(),
          session_id: currentSessionId || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Fehler beim Senden der Nachricht')
      }

      const data: SendMessageResponse = await response.json()

      // Update session ID if new session was created
      if (data.session_id && data.session_id !== currentSessionId) {
        setCurrentSessionId(data.session_id)
      }

      // Update user message with correct session_id
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempUserMessageId
            ? { ...msg, session_id: data.session_id }
            : msg
        )
      )

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: data.message_id,
        session_id: data.session_id,
        role: 'assistant',
        content: data.response.content,
        metadata: {
          sources: data.response.sources,
          articles_found: data.metadata.articles_found,
          prices_found: data.metadata.prices_found,
          keywords: data.metadata.keywords_used,
        },
        created_at: new Date().toISOString(),
      }

      addMessage(assistantMessage)
    } catch (error) {
      console.error('Chat error:', error)
      toast.error(error instanceof Error ? error.message : 'Fehler beim Senden der Nachricht')

      // Remove the optimistic user message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessageId))
    } finally {
      setIsLoading(false)
    }
  }, [currentSessionId, setCurrentSessionId, addMessage, setMessages, isLoading, setIsLoading])

  /**
   * Fetch chat sessions list
   */
  const fetchSessions = useCallback(async (): Promise<ChatSession[]> => {
    try {
      const response = await fetch('/api/chat/sessions')
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Chat-Historie')
      }
      const data: SessionsResponse = await response.json()
      return data.data
    } catch (error) {
      console.error('Error fetching sessions:', error)
      toast.error('Fehler beim Laden der Chat-Historie')
      return []
    }
  }, [])

  /**
   * Load a specific session with its messages
   */
  const loadSession = useCallback(async (sessionId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`)
      if (!response.ok) {
        throw new Error('Session nicht gefunden')
      }
      const data: SessionDetailResponse = await response.json()

      setCurrentSessionId(sessionId)
      setMessages(data.data.messages)
      setShowHistory(false)
    } catch (error) {
      console.error('Error loading session:', error)
      toast.error('Fehler beim Laden der Session')
    } finally {
      setIsLoading(false)
    }
  }, [setCurrentSessionId, setMessages, setShowHistory, setIsLoading])

  /**
   * Delete a chat session
   */
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Fehler beim Löschen der Session')
      }

      // If we deleted the current session, clear it
      if (sessionId === currentSessionId) {
        setCurrentSessionId(null)
        setMessages([])
      }

      toast.success('Chat gelöscht')
      return true
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error('Fehler beim Löschen des Chats')
      return false
    }
  }, [currentSessionId, setCurrentSessionId, setMessages])

  return {
    messages,
    isLoading,
    sendMessage,
    fetchSessions,
    loadSession,
    deleteSession,
  }
}
