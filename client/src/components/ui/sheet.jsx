import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
SheetOverlay.displayName = 'SheetOverlay'

const SheetContent = React.forwardRef(({ className, children, side = 'right', title, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 bg-white shadow-2xl',
        'data-[state=open]:animate-in data-[state=closed]:animate-out duration-300',
        side === 'right' && [
          'inset-y-0 right-0 h-full w-full sm:max-w-md',
          'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        ],
        side === 'left' && [
          'inset-y-0 left-0 h-full w-full sm:max-w-md',
          'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
        ],
        side === 'bottom' && [
          'inset-x-0 bottom-0 w-full',
          'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        ],
        className
      )}
      {...props}
    >
      {side === 'bottom' ? (
        <>
          {/* Hidden title for accessibility */}
          <DialogPrimitive.Title className="sr-only">{title || 'Dialog'}</DialogPrimitive.Title>
          {children}
        </>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b px-5 py-4">
            <DialogPrimitive.Title className="text-base font-semibold text-gray-900">
              {title}
            </DialogPrimitive.Title>
            <SheetClose className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>
          {/* Body */}
          <div className="h-[calc(100%-64px)] overflow-y-auto">
            {children}
          </div>
        </>
      )}
    </DialogPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = 'SheetContent'

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetPortal, SheetOverlay }
