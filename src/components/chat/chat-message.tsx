'use client'

import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, User, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ChatMessage as ChatMessageType, ChatAction } from './chat-context'

// ============================================================================
// Props
// ============================================================================
interface ChatMessageProps {
  message: ChatMessageType
}

// ============================================================================
// Component
// ============================================================================
export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        'flex gap-3 p-4',
        isUser ? 'bg-muted/50' : 'bg-background'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {isUser ? 'Du' : 'Assistent'}
          </span>
          {!isUser && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>

        {/* Message Content with Markdown */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Style lists properly
              ul: ({ children }) => (
                <ul className="list-disc pl-4 space-y-1">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-4 space-y-1">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="text-sm">{children}</li>
              ),
              // Style paragraphs
              p: ({ children }) => (
                <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
              ),
              // Style bold text
              strong: ({ children }) => (
                <strong className="font-semibold">{children}</strong>
              ),
              // Style links
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              // Style code blocks
              code: ({ children }) => (
                <code className="bg-muted px-1 py-0.5 rounded text-xs">{children}</code>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
          {/* Streaming cursor animation */}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse" />
          )}
        </div>

        {/* Sources */}
        {!isUser && message.metadata?.sources && message.metadata.sources.length > 0 && (
          <div className="pt-2 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Quellen:</p>
            <div className="flex flex-wrap gap-1">
              {message.metadata.sources.map((source, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-xs font-normal"
                >
                  {source.article_name} - {source.supplier_name}: {source.price.toFixed(2)} €
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!isUser && !message.isStreaming && message.metadata?.actions && message.metadata.actions.length > 0 && (
          <div className="pt-3 flex flex-wrap gap-2">
            {message.metadata.actions.map((action, index) => (
              <ActionButton key={index} action={action} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

// ============================================================================
// Action Button Component
// ============================================================================
function ActionButton({ action }: { action: ChatAction }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs gap-1.5"
      asChild
    >
      <Link href={action.url}>
        <span>{action.icon}</span>
        <span>{action.label}</span>
      </Link>
    </Button>
  )
}
