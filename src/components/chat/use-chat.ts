'use client'

import { useCallback, useRef } from 'react'
import { useChatContext, ChatMessage, ChatSession, ChatAction } from './chat-context'
import { toast } from 'sonner'

// ============================================================================
// Types
// ============================================================================
interface ChatSource {
  type: string
  article_name: string
  supplier_name: string
  price: number
  date: string
  document_number?: string | null
}

interface SendMessageResponse {
  session_id: string
  message_id: string
  response: {
    content: string
    sources: ChatSource[]
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
    updateMessage,
    isLoading,
    setIsLoading,
    isStreaming,
    setIsStreaming,
    setShowHistory,
  } = useChatContext()

  // Abort controller for cancelling streams
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Parse the Vercel AI SDK text stream format
   * The toTextStreamResponse returns plain text chunks
   */
  const parseStreamChunk = (chunk: string): string => {
    // toTextStreamResponse returns plain text, not formatted data
    return chunk
  }

  /**
   * Send a message and stream the response
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading || isStreaming) return

    // Cancel any previous stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setIsLoading(true)
    setIsStreaming(true)

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

    // Create placeholder for assistant message
    const assistantMessageId = `streaming-${Date.now()}`
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      session_id: currentSessionId || '',
      role: 'assistant',
      content: '',
      isStreaming: true,
      created_at: new Date().toISOString(),
    }
    addMessage(assistantMessage)

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content.trim(),
          session_id: currentSessionId || undefined,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Fehler beim Senden der Nachricht')
      }

      // Get metadata from headers
      const sessionId = response.headers.get('X-Chat-Session-Id') || currentSessionId
      const messageId = response.headers.get('X-Chat-Message-Id') || assistantMessageId
      const sourcesHeader = response.headers.get('X-Chat-Sources')
      const articlesFound = parseInt(response.headers.get('X-Chat-Articles-Found') || '0', 10)
      const pricesFound = parseInt(response.headers.get('X-Chat-Prices-Found') || '0', 10)

      let sources: ChatSource[] = []
      let actions: ChatAction[] = []
      try {
        if (sourcesHeader) {
          sources = JSON.parse(sourcesHeader)
        }
      } catch {
        // Ignore parse errors for sources
      }

      // Parse actions from headers
      const actionsHeader = response.headers.get('X-Chat-Actions')
      try {
        if (actionsHeader) {
          actions = JSON.parse(actionsHeader)
        }
      } catch {
        // Ignore parse errors for actions
      }

      // Update session ID if new session was created
      if (sessionId && sessionId !== currentSessionId) {
        setCurrentSessionId(sessionId)
      }

      // Update user message with correct session_id
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempUserMessageId
            ? { ...msg, session_id: sessionId || '' }
            : msg
        )
      )

      // Read the stream
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      const decoder = new TextDecoder()
      let accumulatedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // toTextStreamResponse returns plain text chunks
        const chunk = decoder.decode(value, { stream: true })
        const textContent = parseStreamChunk(chunk)
        accumulatedContent += textContent
        updateMessage(assistantMessageId, { content: accumulatedContent })
      }

      // Mark streaming as complete and add metadata
      updateMessage(assistantMessageId, {
        id: messageId,
        session_id: sessionId || '',
        content: accumulatedContent,
        isStreaming: false,
        metadata: {
          sources,
          actions,
          articles_found: articlesFound,
          prices_found: pricesFound,
        },
      })

      setIsLoading(false)
      setIsStreaming(false)

    } catch (error) {
      // Handle abort gracefully
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Stream was cancelled')
        setIsLoading(false)
        setIsStreaming(false)
        return
      }

      console.error('Chat error:', error)
      toast.error(error instanceof Error ? error.message : 'Fehler beim Senden der Nachricht')

      // Remove both messages on error
      setMessages(prev => prev.filter(msg =>
        msg.id !== tempUserMessageId && msg.id !== assistantMessageId
      ))

      setIsLoading(false)
      setIsStreaming(false)
    }
  }, [currentSessionId, setCurrentSessionId, addMessage, updateMessage, setMessages, isLoading, isStreaming, setIsLoading, setIsStreaming])

  /**
   * Cancel an ongoing stream
   */
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    setIsLoading(false)
  }, [setIsLoading, setIsStreaming])

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
    isStreaming,
    sendMessage,
    cancelStream,
    fetchSessions,
    loadSession,
    deleteSession,
  }
}
