import { useState } from 'react'
import { expensesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useExpensePermissions } from '@/hooks/useExpensePermissions'
import { ExpenseForm } from './ExpenseForm'
import { ExpenseActions } from './ExpenseActions'
import { ExpenseDetails } from './ExpenseDetails'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  Eye,
  Edit,
  Trash2,
  Upload,
  CheckCircle,
  XCircle,
  DollarSign,
  Loader,
} from 'lucide-react'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

/**
 * ExpenseTable Component
 * Reusable table for displaying expenses with role-based actions
 * Props:
 * - expenses: Array of expense objects
 * - loading: Loading state
 * - onRefresh: Callback to refresh the data
 * - siteId: (optional) Site ID for filtering
 * - showSiteColumn: (optional) Show site column (default: true)
 */
export function ExpenseTable({
  expenses = [],
  loading = false,
  onRefresh,
  siteId = null,
  showSiteColumn = true,
}) {
  const permissions = useExpensePermissions()
  const { toast } = useToast()

  const [editExpense, setEditExpense] = useState(null)
  const [deleteExpense, setDeleteExpense] = useState(null)
  const [viewExpense, setViewExpense] = useState(null)
  const [approveData, setApproveData] = useState({ expense: null, action: 'approve' })
  const [uploading, setUploading] = useState(null)

  const handleEdit = (expense) => {
    if (!permissions.canEdit(expense)) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to edit this expense.',
        variant: 'destructive',
      })
      return
    }
    setEditExpense(expense)
  }

  const handleDelete = async () => {
    if (!deleteExpense || !permissions.canDelete(deleteExpense)) return

    try {
      await expensesApi.delete(deleteExpense._id)
      toast({
        title: 'Success',
        description: 'Expense deleted successfully.',
      })
      setDeleteExpense(null)
      onRefresh?.()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete expense.',
        variant: 'destructive',
      })
    }
  }

  const handleUploadReceipt = async (expenseId, file) => {
    setUploading(expenseId)
    try {
      await expensesApi.uploadReceipt(expenseId, file)
      toast({
        title: 'Success',
        description: 'Receipt uploaded successfully.',
      })
      onRefresh?.()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to upload receipt.',
        variant: 'destructive',
      })
    } finally {
      setUploading(null)
    }
  }

  const handleFileChange = (e, expenseId) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUploadReceipt(expenseId, file)
    }
  }

  const handleApprove = (expense, action) => {
    if (!permissions.canApprove) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to approve expenses.',
        variant: 'destructive',
      })
      return
    }
    setApproveData({ expense, action })
  }

  const renderAmount = (expense) => {
    if (!permissions.canSeeAmount(expense)) {
      return <span className="text-gray-400 italic">Hidden</span>
    }

    return (
      <div className="space-y-1">
        <div className="text-sm">
          <span className="text-gray-600">Req:</span> {formatCurrency(expense.requestedAmount)}
        </div>
        {expense.approvedAmount && (
          <div className="text-sm font-medium text-green-600">
            <span className="text-gray-600">App:</span> {formatCurrency(expense.approvedAmount)}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No expenses found.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {showSiteColumn && <TableHead>Site</TableHead>}
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Added By</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense._id}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(expense.expenseDate)}
                </TableCell>
                {showSiteColumn && (
                  <TableCell>{expense.site?.name || 'N/A'}</TableCell>
                )}
                <TableCell>{expense.category?.name || 'N/A'}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {expense.description}
                </TableCell>
                <TableCell>{expense.vendorName || '-'}</TableCell>
                <TableCell>{expense.user?.name || 'N/A'}</TableCell>
                <TableCell>{renderAmount(expense)}</TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[expense.status]}>
                    {expense.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {/* View Details */}
                    {permissions.canViewDetails && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewExpense(expense)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Upload Receipt */}
                    {permissions.canUploadReceipt(expense) && (
                      <div className="relative">
                        <input
                          type="file"
                          id={`receipt-${expense._id}`}
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={(e) => handleFileChange(e, expense._id)}
                          disabled={uploading === expense._id}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            document.getElementById(`receipt-${expense._id}`).click()
                          }
                          disabled={uploading === expense._id}
                          title="Upload Receipt"
                        >
                          {uploading === expense._id ? (
                            <Loader className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Download Receipt */}
                    {expense.receiptPath && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(expense.receiptPath, '_blank')}
                        title="Download Receipt"
                      >
                        <Upload className="h-4 w-4 text-green-600" />
                      </Button>
                    )}

                    {/* Approve (Admin only) */}
                    {permissions.canApprove && expense.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleApprove(expense, 'approve')}
                        title="Approve"
                      >
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </Button>
                    )}

                    {/* Reject (Admin only) */}
                    {permissions.canApprove && expense.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleApprove(expense, 'reject')}
                        title="Reject"
                      >
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    )}

                    {/* Mark as Paid (Admin only) */}
                    {permissions.canMarkPaid && expense.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleApprove(expense, 'pay')}
                        title="Mark as Paid"
                      >
                        <DollarSign className="h-4 w-4 text-blue-600" />
                      </Button>
                    )}

                    {/* Edit */}
                    {permissions.canEdit(expense) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(expense)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Delete */}
                    {permissions.canDelete(expense) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteExpense(expense)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      {editExpense && (
        <Dialog open={Boolean(editExpense)} onOpenChange={() => setEditExpense(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Expense</DialogTitle>
            </DialogHeader>
            <ExpenseForm
              expense={editExpense}
              onSuccess={() => {
                setEditExpense(null)
                onRefresh?.()
                toast({
                  title: 'Success',
                  description: 'Expense updated successfully.',
                })
              }}
              onCancel={() => setEditExpense(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={Boolean(deleteExpense)} onOpenChange={() => setDeleteExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Details Dialog */}
      {viewExpense && (
        <ExpenseDetails
          expense={viewExpense}
          isOpen={Boolean(viewExpense)}
          onClose={() => setViewExpense(null)}
        />
      )}

      {/* Approve/Reject/Pay Dialog */}
      {approveData.expense && (
        <ExpenseActions
          expense={approveData.expense}
          isOpen={Boolean(approveData.expense)}
          onClose={() => setApproveData({ expense: null, action: 'approve' })}
          onSuccess={() => {
            onRefresh?.()
            toast({
              title: 'Success',
              description: 'Expense processed successfully.',
            })
          }}
          action={approveData.action}
        />
      )}
    </>
  )
}
