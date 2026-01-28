import { useState } from 'react'
import { expensesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle, X, Loader } from 'lucide-react'

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'other', label: 'Other' },
]

/**
 * ExpenseActions Component
 * Handles approve, reject, and mark as paid actions for expenses
 * Props:
 * - expense: Expense object to act on
 * - isOpen: Dialog open state
 * - onClose: Close callback
 * - onSuccess: Success callback
 * - action: 'approve' | 'reject' | 'pay'
 */
export function ExpenseActions({ expense, isOpen, onClose, onSuccess, action = 'approve' }) {
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    status: action === 'reject' ? 'rejected' : action === 'pay' ? 'paid' : 'approved',
    approvedAmount: expense?.requestedAmount || '',
    approvalNotes: '',
    paymentMethod: '',
    paymentReference: '',
  })
  const [errors, setErrors] = useState({})

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (form.status === 'approved' || form.status === 'paid') {
      if (!form.approvedAmount || parseFloat(form.approvedAmount) <= 0) {
        newErrors.approvedAmount = 'Valid approved amount is required'
      }
    }

    if (form.status === 'paid') {
      if (!form.paymentMethod) {
        newErrors.paymentMethod = 'Payment method is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return

    setSubmitting(true)
    try {
      const payload = {
        status: form.status,
      }

      if (form.status === 'approved' || form.status === 'paid') {
        payload.approvedAmount = parseFloat(form.approvedAmount)
      }

      if (form.approvalNotes) {
        payload.approvalNotes = form.approvalNotes
      }

      if (form.status === 'paid') {
        payload.paymentMethod = form.paymentMethod
        if (form.paymentReference) {
          payload.paymentReference = form.paymentReference
        }
      }

      await expensesApi.approve(expense._id, payload)
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Failed to process expense:', error)
      setErrors({ submit: error.response?.data?.message || 'Failed to process expense' })
    } finally {
      setSubmitting(false)
    }
  }

  const getTitle = () => {
    switch (action) {
      case 'reject':
        return 'Reject Expense'
      case 'pay':
        return 'Mark as Paid'
      default:
        return 'Approve Expense'
    }
  }

  const getDescription = () => {
    switch (action) {
      case 'reject':
        return 'Are you sure you want to reject this expense?'
      case 'pay':
        return 'Enter payment details to mark this expense as paid.'
      default:
        return 'Review and approve this expense request.'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Expense Details Summary */}
          <div className="rounded-lg bg-gray-50 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Requested Amount:</span>
              <span className="font-medium">₹{expense?.requestedAmount?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Description:</span>
              <span className="font-medium truncate ml-2">{expense?.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Vendor:</span>
              <span className="font-medium">{expense?.vendorName || 'N/A'}</span>
            </div>
          </div>

          {/* Approved Amount (for approve/pay actions) */}
          {(action === 'approve' || action === 'pay') && (
            <div className="space-y-2">
              <Label htmlFor="approvedAmount">
                Approved Amount <span className="text-red-500">*</span>
              </Label>
              <Input
                id="approvedAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter approved amount"
                value={form.approvedAmount}
                onChange={(e) => handleChange('approvedAmount', e.target.value)}
                className={errors.approvedAmount ? 'border-red-500' : ''}
              />
              {errors.approvedAmount && (
                <p className="text-sm text-red-500">{errors.approvedAmount}</p>
              )}
            </div>
          )}

          {/* Payment Method (for pay action) */}
          {action === 'pay' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">
                  Payment Method <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(value) => handleChange('paymentMethod', value)}
                >
                  <SelectTrigger className={errors.paymentMethod ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.paymentMethod && (
                  <p className="text-sm text-red-500">{errors.paymentMethod}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentReference">Payment Reference</Label>
                <Input
                  id="paymentReference"
                  placeholder="Enter payment reference/transaction ID"
                  value={form.paymentReference}
                  onChange={(e) => handleChange('paymentReference', e.target.value)}
                />
              </div>
            </>
          )}

          {/* Approval Notes */}
          <div className="space-y-2">
            <Label htmlFor="approvalNotes">
              {action === 'reject' ? 'Rejection Reason' : 'Notes'}{' '}
              {action === 'reject' && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id="approvalNotes"
              placeholder={action === 'reject' ? 'Enter reason for rejection' : 'Enter any notes (optional)'}
              value={form.approvalNotes}
              onChange={(e) => handleChange('approvalNotes', e.target.value)}
              rows={3}
            />
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {errors.submit}
            </div>
          )}

          {/* Action Buttons */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              variant={action === 'reject' ? 'destructive' : 'default'}
            >
              {submitting ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {action === 'reject' ? (
                    <>
                      <X className="mr-2 h-4 w-4" />
                      Reject
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {action === 'pay' ? 'Mark as Paid' : 'Approve'}
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
