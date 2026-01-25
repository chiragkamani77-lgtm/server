import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building,
  Receipt,
  Users,
  FileText,
  Settings,
} from 'lucide-react'

const navItems = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: [1, 2, 3],
  },
  {
    title: 'Sites',
    href: '/sites',
    icon: Building,
    roles: [1, 2, 3],
  },
  {
    title: 'Expenses',
    href: '/expenses',
    icon: Receipt,
    roles: [1, 2, 3],
  },
  {
    title: 'Users',
    href: '/users',
    icon: Users,
    roles: [1, 2],
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: FileText,
    roles: [1, 2],
  },
  {
    title: "Categories",
    href: "/categories",
    icon: Settings,
    roles: [1, 2],
  }
]

export function Sidebar() {
  const location = useLocation()
  const { user } = useAuth()

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(user?.role)
  )

  return (
    <aside className="hidden w-64 border-r bg-gray-50/40 md:block">
      <nav className="flex flex-col gap-2 p-4">
        {filteredItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
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
    </aside>
  )
}
