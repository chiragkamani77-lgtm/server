import { useAuth } from '@/context/AuthContext'

/**
 * Custom hook for expense permissions based on user role
 * Role 1 (Developer/Admin): Full access to all operations
 * Role 2 (Engineer): Can manage own and subordinates' expenses, can approve
 * Role 3 (Supervisor): Can create and view own expenses only
 * Role 4 (Worker): Can create and view own expenses only
 */
export function useExpensePermissions() {
  const { user, isAdmin, isEngineer } = useAuth()

  const canManageSubordinate = (expense) => {
    if (!expense) return false
    const submitterRole = expense.user?.role
    if (isEngineer) return submitterRole >= 3  // engineer can manage supervisor + worker expenses
    return false
  }

  const permissions = {
    // Can create new expenses
    canCreate: Boolean(user),

    // Can view all expenses (Admin and Engineer see all)
    canViewAll: isAdmin || isEngineer,

    // Can edit an expense
    canEdit: (expense) => {
      if (!expense) return false
      if (isAdmin) return true
      if (canManageSubordinate(expense) && expense.status === 'pending') return true
      return expense.user?._id === user?._id && expense.status === 'pending'
    },

    // Can delete an expense
    canDelete: (expense) => {
      if (!expense) return false
      if (isAdmin) return true
      if (canManageSubordinate(expense) && expense.status === 'pending') return true
      return expense.user?._id === user?._id && expense.status === 'pending'
    },

    // Can approve/reject expenses
    canApprove: isAdmin || isEngineer,

    // Can mark as paid
    canMarkPaid: isAdmin || isEngineer,

    // Can upload receipt
    canUploadReceipt: (expense) => {
      if (!expense) return false
      if (isAdmin || isEngineer) return true
      return expense.user?._id === user?._id
    },

    // Can view expense details
    canViewDetails: Boolean(user),

    // Can see amounts
    canSeeAmount: (expense) => {
      if (!expense) return true
      if (isAdmin || isEngineer) return true
      if (expense.amountHidden) return false
      return true
    },

    role: user?.role,
    isAdmin,
    isEngineer,
    userId: user?._id,
  }

  return permissions
}
