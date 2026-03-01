/**
 * Centered empty state with message and optional action.
 * Props:
 *   message – text to display
 *   action  – optional button/node
 *   icon    – optional Lucide icon element
 */
export function EmptyState({ message = 'Nothing here yet', action, icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
      {icon && <div className="opacity-40">{icon}</div>}
      <p className="text-sm">{message}</p>
      {action}
    </div>
  )
}
