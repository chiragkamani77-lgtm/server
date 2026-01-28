import { useAuth } from '@/context/AuthContext'

/**
 * Custom hook for expense permissions based on user role
 * Role 1 (Developer/Admin): Full access to all operations
 * Role 2 (Engineer/Site Manager): Can manage own and subordinates' expenses
 * Role 3 (Supervisor/Worker): Can create and view own expenses only
 */
export function useExpensePermissions() {
  const { user, isAdmin } = useAuth()

  const permissions = {
    // Can create new expenses
    canCreate: Boolean(user),

    // Can view all expenses (Admin sees all, others see filtered by role)
    canViewAll: isAdmin,

    // Can edit an expense
    canEdit: (expense) => {
      if (!expense) return false
      if (isAdmin) return true // Admin can edit any pending expense
      // Users can only edit their own pending expenses
      return expense.user?._id === user?._id && expense.status === 'pending'
    },

    // Can delete an expense
    canDelete: (expense) => {
      if (!expense) return false
      if (isAdmin) return true // Admin can delete any expense
      // Users can only delete their own pending expenses
      return expense.user?._id === user?._id && expense.status === 'pending'
    },

    // Can approve/reject expenses
    canApprove: isAdmin,

    // Can mark as paid
    canMarkPaid: isAdmin,

    // Can upload receipt
    canUploadReceipt: (expense) => {
      if (!expense) return false
      if (isAdmin) return true
      // Users can upload to their own expenses
      return expense.user?._id === user?._id
    },

    // Can view expense details
    canViewDetails: Boolean(user),

    // Can see amounts (may be hidden for supervisors viewing subordinate expenses)
    canSeeAmount: (expense) => {
      if (!expense) return true
      if (isAdmin) return true
      // If amountHidden flag is set, hide amount
      if (expense.amountHidden) return false
      return true
    },

    // User role
    role: user?.role,
    isAdmin,
    userId: user?._id,
  }

  return permissions
}
