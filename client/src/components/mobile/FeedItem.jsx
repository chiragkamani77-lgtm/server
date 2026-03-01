/**
 * Splitwise-style list row with a colored avatar circle.
 *
 * Props:
 *   seed       – string used to pick a consistent avatar color (e.g. name or id)
 *   title      – primary line
 *   subtitle   – secondary line (string or node)
 *   meta       – third line, often a status badge (node)
 *   amount     – formatted string shown on the right (optional)
 *   amountClass – extra className for amount text (e.g. 'text-green-600')
 *   badge      – { label, className } pill on the right (optional, alternative to amount)
 *   onClick    – makes the row tappable
 */

const PALETTE = [
  'bg-orange-400', 'bg-blue-400', 'bg-emerald-400',
  'bg-purple-400', 'bg-pink-400', 'bg-teal-400', 'bg-rose-400',
  'bg-indigo-400', 'bg-cyan-400', 'bg-amber-500',
]

export function seedColor(str = '') {
  // Deterministic color from first char code
  return PALETTE[str.charCodeAt(0) % PALETTE.length]
}

export function FeedItem({
  seed = '',
  title = '',
  subtitle,
  meta,
  amount,
  amountClass = '',
  badge,
  onClick,
}) {
  const initial = (seed || title || '?')[0].toUpperCase()
  const bgColor = seedColor(seed || title)

  return (
    <div
      className={`px-4 py-4 flex items-center gap-3 ${onClick ? 'cursor-pointer active:bg-gray-50' : ''}`}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${bgColor} text-white text-sm font-bold`}>
        {initial}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
        {subtitle && (
          typeof subtitle === 'string'
            ? <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
            : <div className="mt-0.5">{subtitle}</div>
        )}
        {meta && <div className="mt-1">{meta}</div>}
      </div>

      {/* Right side */}
      <div className="shrink-0 text-right">
        {amount && (
          <p className={`text-sm font-bold text-gray-900 ${amountClass}`}>{amount}</p>
        )}
        {badge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>
    </div>
  )
}
