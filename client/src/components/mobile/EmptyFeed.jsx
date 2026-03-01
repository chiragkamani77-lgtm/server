/**
 * Centered empty state for mobile feed lists.
 *
 * Props:
 *   icon    – Lucide icon component
 *   message – primary text (default 'Nothing here yet')
 *   action  – { label, onClick } optional CTA link below message
 */
export function EmptyFeed({ icon: Icon, message = 'Nothing here yet', action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
      {Icon && <Icon className="h-12 w-12 opacity-40" />}
      <p className="text-sm font-medium">{message}</p>
      {action && (
        <button onClick={action.onClick} className="text-sm text-blue-600 font-semibold">
          {action.label}
        </button>
      )}
    </div>
  )
}
