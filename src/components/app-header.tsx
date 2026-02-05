'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MobileNavDrawer } from '@/components/mobile-nav-drawer'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function AppHeader() {
  const router = useRouter()
  const supabase = createClient()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Fehler beim Abmelden')
      return
    }
    toast.success('Erfolgreich abgemeldet')
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Left: Hamburger (Mobile) + Logo */}
          <div className="flex items-center gap-3">
            {/* Hamburger Menu - nur auf Mobile (<1024px) */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Navigation öffnen"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo */}
            <Link href="/dashboard" className="font-semibold">
              Stammdaten Produzent
            </Link>
          </div>

          {/* Right: User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Einstellungen
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <MobileNavDrawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </>
  )
}
