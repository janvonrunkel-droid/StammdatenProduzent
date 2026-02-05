'use client'

import { SidebarProvider } from '@/components/ui/sidebar'
import { AppHeader } from '@/components/app-header'
import { AppSidebar } from '@/components/app-sidebar'
import { ChatSidebar } from '@/components/chat'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Sidebar - nur auf Desktop (>=1024px), einklappbar */}
        <div className="hidden lg:block">
          <AppSidebar />
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col">
          <AppHeader />
          <main className="flex-1">{children}</main>
        </div>

        {/* Chat Sidebar - fixed Button + Sheet Overlay */}
        <ChatSidebar />
      </div>
    </SidebarProvider>
  )
}
