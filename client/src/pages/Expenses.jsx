import { useState, useEffect } from 'react'
import { expensesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useBulkSelect } from '@/hooks/use-bulk-select'
import { useLoading } from '@/hooks/use-loading'
import { useExpensePermissions } from '@/hooks/useExpensePermissions'
import {
  ExpenseTable,
  ExpenseForm,
  ExpenseFilters,
} from '@/components/expenses'
import { formatCurrency } from '@/lib/utils'
import { Plus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'

export default function Expenses() {
  const permissions = useExpensePermissions()
  const { toast } = useToast()

  const [expenses, setExpenses] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [summary, setSummary] = useState({ total: 0, count: 0 })

  const [filters, setFilters] = useState({
    siteId: '',
    category: '',
    startDate: '',
    endDate: '',
  })

  // Use custom hooks
  const loadingStates = useLoading()
  const bulkSelect = useBulkSelect(
    expenses,
    expensesApi.bulkDelete,
    (count) => {
      toast({ title: `${count} expense(s) deleted successfully` })
      loadExpenses()
    },
    (error) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete expenses',
        variant: 'destructive',
      })
    }
  )

  useEffect(() => {
    loadExpenses()
  }, [filters, pagination.page])

  const loadExpenses = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.page,
        limit: 20,
        ...filters,
      }

      // Remove empty filters
      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key]
      })

      const response = await expensesApi.getAll(params)
      const data = response.data
      setExpenses(data.expenses || [])
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 })

      // Calculate summary
      const total = (data.expenses || []).reduce((sum, exp) => {
        return sum + (exp.approvedAmount || exp.requestedAmount || 0)
      }, 0)
      setSummary({ total, count: data.expenses?.length || 0 })
    } catch (error) {
      console.error('Failed to load expenses:', error)
      toast({
        title: 'Error',
        description: 'Failed to load expenses.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }))
  }

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
    setPagination((prev) => ({ ...prev, page: 1 })) // Reset to first page
  }

  const handleClearFilters = () => {
    setFilters({
      siteId: '',
      category: '',
      startDate: '',
      endDate: '',
    })
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handleAddSuccess = () => {
    setIsAddOpen(false)
    loadExpenses()
    toast({
      title: 'Success',
      description: 'Expense added successfully.',
    })
  }

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-xs md:text-base text-muted-foreground">Manage and track all expenses</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {bulkSelect.selectedCount > 0 && (
            <Button
              variant="destructive"
              onClick={bulkSelect.deleteSelected}
              disabled={bulkSelect.deleting}
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {bulkSelect.deleting ? 'Deleting...' : `Delete ${bulkSelect.selectedCount}`}
            </Button>
          )}
          {permissions.canCreate && (
            <Button onClick={() => setIsAddOpen(true)} disabled={loadingStates.creating} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              {loadingStates.creating ? 'Adding...' : 'Add Expense'}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filtered Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.count}</div>
            <p className="text-xs text-muted-foreground">On this page</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Amount (Page)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.total)}</div>
            <p className="text-xs text-muted-foreground">Current page total</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <ExpenseFilters
        filters={filters}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {/* Expenses Table */}
      <Card>
        <CardContent className="pt-6">
          <ExpenseTable
            expenses={expenses}
            loading={loading}
            onRefresh={loadExpenses}
            showSiteColumn={true}
            bulkSelect={bulkSelect}
          />

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Expense Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
          </DialogHeader>
          <ExpenseForm onSuccess={handleAddSuccess} onCancel={() => setIsAddOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
