import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useExpensePermissions } from '@/hooks/useExpensePermissions'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

/**
 * ExpenseDetails Component
 * Shows detailed view of an expense
 * Props:
 * - expense: Expense object
 * - isOpen: Dialog open state
 * - onClose: Close callback
 */
export function ExpenseDetails({ expense, isOpen, onClose }) {
  const permissions = useExpensePermissions()

  if (!expense) return null

  const DetailRow = ({ label, value, className = '' }) => (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-gray-600 font-medium">{label}:</span>
      <span className={`text-right ${className}`}>{value || 'N/A'}</span>
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Expense Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Status</h3>
            <Badge className={STATUS_COLORS[expense.status]}>
              {expense.status?.toUpperCase()}
            </Badge>
          </div>

          {/* Basic Information */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold mb-2">Basic Information</h4>
            <DetailRow label="Site" value={expense.site?.name} />
            <DetailRow label="Category" value={expense.category?.name} />
            <DetailRow label="Expense Date" value={formatDate(expense.expenseDate)} />
            <DetailRow label="Created By" value={expense.user?.name} />
            <DetailRow label="Vendor Name" value={expense.vendorName} />
          </div>

          {/* Amount Information */}
          {permissions.canSeeAmount(expense) && (
            <div className="bg-blue-50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold mb-2">Amount Details</h4>
              <DetailRow
                label="Requested Amount"
                value={formatCurrency(expense.requestedAmount)}
                className="text-blue-600 font-medium"
              />
              {expense.approvedAmount && (
                <DetailRow
                  label="Approved Amount"
                  value={formatCurrency(expense.approvedAmount)}
                  className="text-green-600 font-semibold"
                />
              )}
            </div>
          )}

          {/* Description */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold mb-2">Description</h4>
            <p className="text-gray-700 whitespace-pre-wrap">{expense.description}</p>
          </div>

          {/* Approval Information */}
          {(expense.status === 'approved' || expense.status === 'paid' || expense.status === 'rejected') && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold mb-2">
                {expense.status === 'rejected' ? 'Rejection' : 'Approval'} Information
              </h4>
              {expense.approvedBy && (
                <DetailRow
                  label={expense.status === 'rejected' ? 'Rejected By' : 'Approved By'}
                  value={expense.approvedBy?.name}
                />
              )}
              {expense.approvalDate && (
                <DetailRow
                  label={expense.status === 'rejected' ? 'Rejection Date' : 'Approval Date'}
                  value={formatDate(expense.approvalDate)}
                />
              )}
              {expense.approvalNotes && (
                <div className="pt-2">
                  <p className="text-gray-600 font-medium mb-1">Notes:</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{expense.approvalNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Payment Information */}
          {expense.status === 'paid' && (
            <div className="bg-green-50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold mb-2">Payment Information</h4>
              {expense.paidDate && (
                <DetailRow label="Payment Date" value={formatDate(expense.paidDate)} />
              )}
              {expense.paymentMethod && (
                <DetailRow
                  label="Payment Method"
                  value={expense.paymentMethod.replace('_', ' ').toUpperCase()}
                />
              )}
              {expense.paymentReference && (
                <DetailRow label="Payment Reference" value={expense.paymentReference} />
              )}
            </div>
          )}

          {/* Receipt */}
          {expense.receiptPath && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Receipt</h4>
              <a
                href={expense.receiptPath}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                View Receipt
              </a>
            </div>
          )}

          {/* Fund Allocation */}
          {expense.fundAllocation && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold mb-2">Fund Allocation</h4>
              <DetailRow
                label="Allocation ID"
                value={expense.fundAllocation._id?.slice(-8)}
              />
              {expense.fundAllocation.purpose && (
                <DetailRow label="Purpose" value={expense.fundAllocation.purpose} />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
