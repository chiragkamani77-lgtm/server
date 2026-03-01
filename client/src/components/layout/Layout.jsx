import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Sidebar } from './Sidebar'
import { Menu } from 'lucide-react'

export function Layout() {
  const { isAuthenticated, loading } = useAuth()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    // h-screen + overflow-hidden = fixed viewport; both columns scroll independently
    <div className="h-screen flex overflow-hidden">
      {/* Desktop Sidebar — scrolls independently */}
      <Sidebar />

      {/* Mobile Sidebar Drawer */}
      <Sidebar
        isMobile={true}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main content column */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile-only top bar */}
        <div className="md:hidden flex items-center gap-3 h-14 px-4 border-b bg-white shrink-0 z-10">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-gray-900">Construction</span>
        </div>

        {/* Scrollable main area */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
