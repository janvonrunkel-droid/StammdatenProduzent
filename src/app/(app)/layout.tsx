import { AppHeader } from '@/components/app-header'
import { ChatSidebar } from '@/components/chat'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        {children}
      </main>
      <ChatSidebar />
    </div>
  )
}
