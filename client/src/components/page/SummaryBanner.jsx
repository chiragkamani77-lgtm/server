import { cn } from '@/lib/utils'

const THEMES = {
  blue:   { bg: 'bg-blue-600',   text: 'text-blue-200',   val: 'text-white' },
  indigo: { bg: 'bg-indigo-600', text: 'text-indigo-200', val: 'text-white' },
  green:  { bg: 'bg-emerald-600', text: 'text-emerald-200', val: 'text-white' },
  slate:  { bg: 'bg-slate-700',  text: 'text-slate-300',  val: 'text-white' },
  teal:   { bg: 'bg-teal-600',   text: 'text-teal-200',   val: 'text-white' },
}

/**
 * Colored banner below the PageHeader showing key numbers.
 * Props:
 *   items   – Array of { label: string, value: string }
 *   color   – 'blue' | 'indigo' | 'green' | 'slate' | 'teal'  (default 'blue')
 *   icon    – optional Lucide icon element on the right
 */
export function SummaryBanner({ items = [], color = 'blue', icon }) {
  const t = THEMES[color] || THEMES.blue
  return (
    <div className={cn('px-4 py-3 flex items-center justify-between shrink-0', t.bg)}>
      <div className={cn('flex gap-6', items.length === 1 && 'flex-col gap-0')}>
        {items.map(({ label, value }, i) => (
          <div key={i}>
            <p className={cn('text-xs', t.text)}>{label}</p>
            <p className={cn('font-bold leading-tight', i === 0 ? 'text-2xl' : 'text-xl', t.val)}>
              {value}
            </p>
          </div>
        ))}
      </div>
      {icon && (
        <div className="opacity-40">{icon}</div>
      )}
    </div>
  )
}
