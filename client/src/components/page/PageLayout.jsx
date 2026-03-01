import { cn } from '@/lib/utils'

/**
 * Full-bleed page wrapper — breaks out of Layout's p-6.
 * All pages that use Khatabook-style UI wrap with this.
 */
export function PageLayout({ children, className }) {
  return (
    <div className={cn('flex flex-col bg-gray-50 -m-6', className)}>
      {children}
    </div>
  )
}
