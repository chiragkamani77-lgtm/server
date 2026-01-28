import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building,
  Building2,
  Receipt,
  Users,
  FileText,
  Settings,
  TrendingUp,
  Banknote,
  FileSpreadsheet,
  Calendar,
  Wallet,
  X,
} from 'lucide-react'

const navItems = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: [1, 2, 3, 4],
  },
  {
    title: 'Sites',
    href: '/sites',
    icon: Building,
    roles: [1, 2, 3, 4],
  },
  {
    title: 'Expenses',
    href: '/expenses',
    icon: Receipt,
    roles: [1, 2, 3, 4],
  },
  {
    title: 'Investments',
    href: '/investments',
    icon: TrendingUp,
    roles: [1],
  },
  {
    title: 'Fund Allocations',
    href: '/funds',
    icon: Banknote,
    roles: [1, 2, 3],
  },
  {
    title: 'GST Bills',
    href: '/bills',
    icon: FileSpreadsheet,
    roles: [1, 2],
  },
  {
    title: 'Attendance',
    href: '/attendance',
    icon: Calendar,
    roles: [1, 2, 3],  // Supervisor marks attendance for workers
  },
  {
    title: 'Worker Ledger',
    href: '/ledger',
    icon: Wallet,
    roles: [1, 2, 3, 4],  // Worker can view their own salary/advance
  },
  {
    title: 'Users',
    href: '/users',
    icon: Users,
    roles: [1, 2, 3],
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: FileText,
    roles: [1, 2],
  },
  {
    title: 'Categories',
    href: '/categories',
    icon: Settings,
    roles: [1, 2],
  },
  {
    title: 'Organization',
    href: '/organization',
    icon: Building2,
    roles: [1],
  }
]

export function Sidebar({ isMobile = false, isOpen = false, onClose = () => {} }) {
  const location = useLocation()
  const { user } = useAuth()

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(user?.role)
  )

  const handleLinkClick = () => {
    if (isMobile) {
      onClose()
    }
  }

  const sidebarContent = (
    <nav className="flex flex-col gap-2 p-4">
      {filteredItems.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          onClick={handleLinkClick}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900',
            location.pathname === item.href
              ? 'bg-gray-100 text-gray-900'
              : ''
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.title}
        </Link>
      ))}
    </nav>
  )

  // Desktop sidebar - always visible on md and above
  if (!isMobile) {
    return (
      <aside className="hidden w-64 border-r bg-gray-50/40 md:block">
        {sidebarContent}
      </aside>
    )
  }

  // Mobile sidebar - drawer/overlay
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-64 border-r bg-white shadow-xl md:hidden',
          'transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Close button */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center space-x-2">
            <Building2 className="h-6 w-6" />
            <span className="font-bold">Menu</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {sidebarContent}
      </aside>
    </>
  )
}
