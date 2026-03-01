import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { ROLE_NAMES } from '@/lib/utils'
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
  LogOut,
} from 'lucide-react'

const navItems = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard, roles: [1, 2, 3, 4] },
  { title: 'Sites', href: '/sites', icon: Building, roles: [1, 2, 3, 4] },
  { title: 'Expenses', href: '/expenses', icon: Receipt, roles: [1, 2, 3, 4] },
  { title: 'Investments', href: '/investments', icon: TrendingUp, roles: [1] },
  { title: 'Fund Allocations', href: '/funds', icon: Banknote, roles: [1, 2, 3] },
  { title: 'GST Bills', href: '/bills', icon: FileSpreadsheet, roles: [1, 2] },
  { title: 'Attendance', href: '/attendance', icon: Calendar, roles: [1, 2, 3] },
  { title: 'Worker Ledger', href: '/ledger', icon: Wallet, roles: [1, 2, 3, 4] },
  { title: 'Users', href: '/users', icon: Users, roles: [1, 2, 3] },
  { title: 'Reports', href: '/reports', icon: FileText, roles: [1, 2] },
  { title: 'Categories', href: '/categories', icon: Settings, roles: [1, 2] },
  { title: 'Organization', href: '/organization', icon: Building2, roles: [1] },
]

export function Sidebar({ isMobile = false, isOpen = false, onClose = () => {} }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const filteredItems = navItems.filter((item) => item.roles.includes(user?.role))

  const handleLinkClick = () => {
    if (isMobile) onClose()
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight">Construction</p>
            <p className="text-[10px] text-blue-300 leading-tight truncate">{user?.name}</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={handleLinkClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.title}
            </Link>
          )
        })}
      </nav>

      {/* User info + logout at bottom */}
      <div className="px-4 py-4 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-full bg-blue-500/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-blue-200">
              {user?.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-200 truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{ROLE_NAMES[user?.role]}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  )

  // Desktop — full height is controlled by the h-screen parent (Layout)
  if (!isMobile) {
    return (
      <aside className="hidden w-56 bg-slate-900 md:flex flex-col shrink-0 overflow-y-auto">
        {sidebarContent}
      </aside>
    )
  }

  // Mobile drawer
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={onClose} />
      <aside className="fixed left-0 top-0 z-50 h-full w-56 bg-slate-900 shadow-2xl md:hidden transform transition-transform duration-300 ease-in-out translate-x-0">
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <span className="font-bold text-white">Menu</span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {sidebarContent}
      </aside>
    </>
  )
}
