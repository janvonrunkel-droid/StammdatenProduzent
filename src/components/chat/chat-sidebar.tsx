'use client'

import { useEffect, useRef } from 'react'
import { MessageSquare, History, Plus, Loader2, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useChatContext } from './chat-context'
import { useChat } from './use-chat'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { ChatSessionList } from './chat-session-list'

// ============================================================================
// Welcome Component (shown when no messages)
// ============================================================================
function ChatWelcome() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
        <Bot className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Chat-Assistent</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-[250px]">
        Ich helfe Ihnen bei Fragen zu Artikeln, Preisen und Lieferanten.
      </p>
      <div className="space-y-2 text-left text-sm">
        <p className="font-medium">Beispiel-Fragen:</p>
        <ul className="space-y-1 text-muted-foreground text-xs">
          <li>&bull; &quot;Wo bekomme ich Beton am günstigsten?&quot;</li>
          <li>&bull; &quot;Was kostet Pflasterstein bei Müller?&quot;</li>
          <li>&bull; &quot;Welche Lieferanten haben Kies?&quot;</li>
        </ul>
      </div>
    </div>
  )
}

// ============================================================================
// Typing Indicator Component
// ============================================================================
function TypingIndicator() {
  return (
    <div className="flex gap-3 p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-2">
        <span className="text-sm font-medium">Assistent</span>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Chat Sidebar Component
// ============================================================================
export function ChatSidebar() {
  const {
    isOpen,
    setIsOpen,
    showHistory,
    setShowHistory,
    messages,
    isLoading,
    startNewChat,
  } = useChatContext()

  const { sendMessage } = useChat()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Use scrollIntoView on the bottom marker element
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {/* Toggle Button - Fixed position */}
      <SheetTrigger asChild>
        <Button
          variant="default"
          size="icon"
          className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full shadow-lg"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      {/* Sidebar Content */}
      <SheetContent
        side="right"
        className="w-full sm:w-[400px] p-0 flex flex-col"
      >
        {showHistory ? (
          <ChatSessionList />
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="p-4 border-b">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg">Chat-Assistent</SheetTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowHistory(true)}
                    title="Chat-Historie"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={startNewChat}
                    title="Neuer Chat"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            {/* Messages Area */}
            <ScrollArea className="flex-1" ref={scrollAreaRef}>
              {messages.length === 0 ? (
                <ChatWelcome />
              ) : (
                <div className="divide-y">
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                  {isLoading && <TypingIndicator />}
                  {/* Invisible marker for auto-scroll */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <ChatInput onSend={sendMessage} isLoading={isLoading} />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
