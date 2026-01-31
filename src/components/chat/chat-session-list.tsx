'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, Trash2, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useChat } from './use-chat'
import { useChatContext, ChatSession } from './chat-context'
import { cn } from '@/lib/utils'

// ============================================================================
// Component
// ============================================================================
export function ChatSessionList() {
  const { fetchSessions, loadSession, deleteSession } = useChat()
  const { currentSessionId, setShowHistory } = useChatContext()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Load sessions on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const data = await fetchSessions()
      setSessions(data)
      setLoading(false)
    }
    load()
  }, [fetchSessions])

  const handleLoadSession = (sessionId: string) => {
    loadSession(sessionId)
  }

  const handleDeleteSession = async (sessionId: string) => {
    setDeletingId(sessionId)
    const success = await deleteSession(sessionId)
    if (success) {
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    }
    setDeletingId(null)
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Heute'
    } else if (diffDays === 1) {
      return 'Gestern'
    } else if (diffDays < 7) {
      return `Vor ${diffDays} Tagen`
    } else {
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowHistory(false)}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">Chat-Historie</h3>
      </div>

      {/* Session List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Keine Chat-Historie vorhanden</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'group flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer',
                  currentSessionId === session.id && 'bg-muted'
                )}
              >
                <button
                  onClick={() => handleLoadSession(session.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <p className="text-sm font-medium truncate">
                    {session.title || 'Unbenannter Chat'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(session.updated_at)}
                  </p>
                </button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 shrink-0"
                      disabled={deletingId === session.id}
                    >
                      {deletingId === session.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Chat löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Diese Aktion kann nicht rückgängig gemacht werden. Der gesamte Chat-Verlauf wird dauerhaft gelöscht.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteSession(session.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Löschen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
