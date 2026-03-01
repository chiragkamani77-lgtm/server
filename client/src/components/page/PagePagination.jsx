import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Bottom pagination bar.
 * Props:
 *   page      – current page (1-based)
 *   pages     – total pages
 *   total     – total record count (optional)
 *   onChange  – (newPage: number) => void
 */
export function PagePagination({ page, pages, total, onChange }) {
  if (pages <= 1) return null
  return (
    <div className="bg-white border-t px-4 py-3 flex items-center justify-between shrink-0">
      <p className="text-xs text-gray-500">
        Page {page} of {pages}{total !== undefined && ` • ${total} total`}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8"
          disabled={page === 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8"
          disabled={page === pages} onClick={() => onChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
