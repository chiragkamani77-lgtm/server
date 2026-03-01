import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * Search input + optional extra filter controls (date pickers, selects…).
 * Props:
 *   search       – current search string
 *   onSearch     – (value: string) => void
 *   placeholder  – input placeholder text
 *   children     – any extra filter controls (selects, date inputs…)
 */
export function SearchFilterBar({ search, onSearch, placeholder = 'Search...', children }) {
  return (
    <div className="bg-white border-b px-4 py-2 flex flex-col sm:flex-row gap-2 shrink-0">
      {onSearch !== undefined && (
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder={placeholder}
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      )}
      {children && (
        <div className="flex gap-2 flex-wrap items-center">{children}</div>
      )}
    </div>
  )
}
