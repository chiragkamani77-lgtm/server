import { ChevronLeft } from 'lucide-react'

/**
 * Sticky top bar for every page.
 * Props:
 *   title      – page title (string)
 *   subtitle   – small grey text below title (string | node, optional)
 *   children   – action buttons placed on the right
 *   onBack     – if provided, shows a back arrow on the left
 */
export function PageHeader({ title, subtitle, children, onBack }) {
  return (
    <div className="bg-white border-b px-4 py-3 flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-1.5 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 shrink-0 -ml-1"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
  )
}
