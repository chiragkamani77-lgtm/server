import { useState, useEffect } from 'react'
import { expensesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'
import { useBulkSelect } from '@/hooks/use-bulk-select'
import { useExpensePermissions } from '@/hooks/useExpensePermissions'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { ExpenseActions } from '@/components/expenses/ExpenseActions'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  PageLayout, PageHeader, SummaryBanner, SearchFilterBar,
  ListItem, ActionBtn, PagePagination, EmptyState,
} from '@/components/page'
import { Plus, Trash2, TrendingUp, Edit, CheckCircle } from 'lucide-react'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function Expenses() {
  const permissions = useExpensePermissions()
  const { toast } = useToast()

  const [expenses, setExpenses] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editExpense, setEditExpense] = useState(null)
  const [approveExpense, setApproveExpense] = useState(null)
  const [approveAction, setApproveAction] = useState('approve')
  const [search, setSearch] = useState('')
  const [totalAmount, setTotalAmount] = useState(0)
  const [filters, setFilters] = useState({ startDate: '', endDate: '' })

  const bulkSelect = useBulkSelect(
    expenses,
    expensesApi.bulkDelete,
    (count) => { toast({ title: `${count} expense(s) deleted` }); loadExpenses() },
    (error) => { toast({ title: 'Error', description: error.response?.data?.message || 'Failed to delete', variant: 'destructive' }) }
  )

  useEffect(() => { loadExpenses() }, [filters, pagination.page])

  const loadExpenses = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.page,
        limit: 20,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      }
      const { data } = await expensesApi.getAll(params)
      const list = data.expenses || []
      setExpenses(list)
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 })
      setTotalAmount(list.reduce((s, e) => s + (e.approvedAmount || e.requestedAmount || 0), 0))
    } catch {
      toast({ title: 'Failed to load expenses', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    setSheetOpen(false)
    setEditExpense(null)
    loadExpenses()
    toast({ title: editExpense ? 'Expense updated' : 'Expense added' })
  }

  const openAdd = () => { setEditExpense(null); setSheetOpen(true) }
  const openEdit = (expense) => { setEditExpense(expense); setSheetOpen(true) }

  const handleDelete = async (expense) => {
    if (!confirm('Delete this expense?')) return
    try {
      await expensesApi.delete(expense._id)
      toast({ title: 'Expense deleted' })
      loadExpenses()
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  const filteredExpenses = expenses.filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.description?.toLowerCase().includes(q) ||
      e.vendorName?.toLowerCase().includes(q) ||
      e.site?.name?.toLowerCase().includes(q)
    )
  })

  return (
    <PageLayout>
      <PageHeader title="Expenses" subtitle={`${pagination.total} entries`}>
        {bulkSelect.selectedCount > 0 && (
          <Button size="sm" variant="destructive" onClick={bulkSelect.deleteSelected} disabled={bulkSelect.deleting}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete {bulkSelect.selectedCount}
          </Button>
        )}
        {permissions.canCreate && (
          <Button size="sm" onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </PageHeader>

      <SummaryBanner
        color="blue"
        icon={<TrendingUp className="h-8 w-8" />}
        items={[{ label: 'Total this page', value: formatCurrency(totalAmount) }]}
      />

      <SearchFilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search description, vendor, site..."
      >
        <Input type="date" className="h-9 text-sm w-36" value={filters.startDate}
          onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
        <Input type="date" className="h-9 text-sm w-36" value={filters.endDate}
          onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
        {(filters.startDate || filters.endDate) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ startDate: '', endDate: '' })}>Clear</Button>
        )}
      </SearchFilterBar>

      <div className="flex-1">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <EmptyState
            message="No expenses found"
            action={permissions.canCreate && (
              <Button variant="outline" size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-1" /> Add First Expense
              </Button>
            )}
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredExpenses.map((expense) => (
              <ListItem
                key={expense._id}
                avatar={(expense.vendorName || expense.description || 'E').charAt(0)}
                avatarColor="blue"
                title={expense.description || expense.vendorName || 'Expense'}
                subtitle={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-400">{formatDate(expense.expenseDate)}</span>
                    {expense.site?.name && <span className="text-xs text-gray-400">• {expense.site.name}</span>}
                    {expense.vendorName && expense.description && (
                      <span className="text-xs text-gray-400">• {expense.vendorName}</span>
                    )}
                  </div>
                }
                amount={formatCurrency(expense.approvedAmount || expense.requestedAmount || 0)}
                badge={{ label: expense.status, className: STATUS_COLORS[expense.status] || '' }}
                selected={bulkSelect.isSelected(expense._id)}
                onSelect={() => bulkSelect.toggleSelect(expense._id)}
                actions={
                  <>
                    {permissions.canEdit(expense) && (
                      <ActionBtn onClick={() => openEdit(expense)} title="Edit" icon={Edit} />
                    )}
                    {permissions.canApprove && expense.status === 'pending' && (
                      <ActionBtn
                        onClick={() => { setApproveExpense(expense); setApproveAction('approve') }}
                        title="Approve"
                        icon={CheckCircle}
                        hoverClass="hover:text-green-600 hover:bg-green-50"
                      />
                    )}
                    {permissions.canDelete(expense) && (
                      <ActionBtn
                        onClick={() => handleDelete(expense)}
                        title="Delete"
                        icon={Trash2}
                        hoverClass="hover:text-red-600 hover:bg-red-50"
                      />
                    )}
                  </>
                }
              />
            ))}
          </div>
        )}
      </div>

      <PagePagination
        page={pagination.page}
        pages={pagination.pages}
        total={pagination.total}
        onChange={(page) => setPagination((p) => ({ ...p, page }))}
      />

      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) setEditExpense(null) }}>
        <SheetContent title={editExpense ? 'Edit Expense' : 'Add Expense'}>
          <div className="px-5 py-4">
            <ExpenseForm
              expense={editExpense}
              onSuccess={handleSuccess}
              onCancel={() => { setSheetOpen(false); setEditExpense(null) }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ExpenseActions
        expense={approveExpense}
        action={approveAction}
        isOpen={!!approveExpense}
        onClose={() => setApproveExpense(null)}
        onSuccess={() => { setApproveExpense(null); loadExpenses() }}
      />
    </PageLayout>
  )
}
