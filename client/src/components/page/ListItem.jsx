import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const AVATAR_COLORS = {
  blue:   'bg-blue-50 text-blue-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  green:  'bg-emerald-50 text-emerald-600',
  teal:   'bg-teal-50 text-teal-600',
  slate:  'bg-slate-100 text-slate-600',
  amber:  'bg-amber-50 text-amber-600',
}

/**
 * Reusable Khatabook-style list row.
 * Props:
 *   avatar      – single character shown in the circle
 *   avatarColor – 'blue' | 'indigo' | 'green' | 'teal' | 'slate' | 'amber'
 *   title       – primary text (string)
 *   subtitle    – secondary text (string | node)
 *   amount      – formatted string shown on right (optional)
 *   amountClass – extra className for the amount text
 *   badge       – { label, className } shown below amount (optional)
 *   actions     – icon buttons on the far right (node)
 *   selected    – checkbox checked state (optional)
 *   onSelect    – checkbox onChange handler (optional)
 *   onClick     – row click handler (optional)
 */
export function ListItem({
  avatar,
  avatarColor = 'blue',
  title,
  subtitle,
  amount,
  amountClass,
  badge,
  actions,
  selected,
  onSelect,
  onClick,
}) {
  return (
    <div
      className={cn(
        'bg-white px-4 py-3.5 flex items-center gap-3',
        onClick ? 'cursor-pointer active:bg-gray-100' : '',
        'hover:bg-gray-50'
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      {onSelect !== undefined && (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 accent-blue-600 shrink-0"
          checked={!!selected}
          onChange={onSelect}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Avatar circle */}
      <div className={cn('h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold', AVATAR_COLORS[avatarColor] || AVATAR_COLORS.blue)}>
        {avatar?.charAt(0).toUpperCase() || '?'}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
        {subtitle && (
          typeof subtitle === 'string'
            ? <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
            : <div className="mt-0.5">{subtitle}</div>
        )}
      </div>

      {/* Amount + badge */}
      {(amount || badge) && (
        <div className="text-right shrink-0">
          {amount && (
            <p className={cn('text-sm font-bold text-gray-900', amountClass)}>{amount}</p>
          )}
          {badge && (
            <Badge className={cn('text-[10px] px-1.5 py-0 mt-0.5', badge.className)}>
              {badge.label}
            </Badge>
          )}
        </div>
      )}

      {/* Action buttons */}
      {actions && (
        <div className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  )
}

/**
 * Standard action icon button for use inside ListItem actions prop.
 */
export function ActionBtn({ onClick, title, icon: Icon, hoverClass = 'hover:text-blue-600 hover:bg-blue-50' }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn('p-1.5 rounded text-gray-400 transition-colors', hoverClass)}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
