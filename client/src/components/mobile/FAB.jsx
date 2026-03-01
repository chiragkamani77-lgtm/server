import { Plus } from 'lucide-react'

/**
 * Floating Action Button (bottom-right).
 * Props:
 *   onClick – callback
 *   label   – aria-label (default 'Add')
 *   icon    – Lucide icon component (default Plus)
 */
export function FAB({ onClick, label = 'Add', icon: Icon = Plus }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-6 right-5 h-14 w-14 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-full shadow-xl flex items-center justify-center transition-transform z-40"
    >
      <Icon className="h-6 w-6" />
    </button>
  )
}
