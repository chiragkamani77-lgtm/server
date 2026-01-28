import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { expensesApi, sitesApi, categoriesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Filter, Trash2, Upload, ChevronLeft, ChevronRight, CheckCircle, Eye, X, Edit } from 'lucide-react'
import { FundAllocationSelector } from '@/components/FundAllocationSelector'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'other', label: 'Other' },
]

export default function Expenses() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()

  const [expenses, setExpenses] = useState([])
  const [sites, setSites] = useState([])
  const [categories, setCategories] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [approveExpense, setApproveExpense] = useState(null)
  const [viewExpense, setViewExpense] = useState(null)
  const [approveForm, setApproveForm] = useState({
    status: 'approved',
    approvedAmount: '',
    approvalNotes: '',
    paymentMethod: '',
    paymentReference: '',
  })

  const [filters, setFilters] = useState({
    siteId: '',
    category: '',
    startDate: '',
    endDate: '',
  })

  const [form, setForm] = useState({
    siteId: '',
    categoryId: '',
    fundAllocationId: '',
    amount: '',
    description: '',
    vendorName: '',
    expenseDate: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    fetchExpenses()
  }, [filters, pagination.page])

  const fetchInitialData = async () => {
    try {
      const [sitesRes, categoriesRes] = await Promise.all([
        sitesApi.getAll(),
        categoriesApi.getAll(),
      ])
      setSites(sitesRes.data)
      setCategories(categoriesRes.data)
    } catch (error) {
      console.error('Error fetching initial data:', error)
    }
  }

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.page,
        limit: 20,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      }
      const { data } = await expensesApi.getAll(params)
      setExpenses(data.expenses)
      setPagination(data.pagination)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch expenses',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const expenseData = {
        siteId: form.siteId,
        categoryId: form.categoryId,
        fundAllocationId: form.fundAllocationId,
        amount: parseFloat(form.amount),
        description: form.description,
        vendorName: form.vendorName,
        expenseDate: form.expenseDate,
      }

      if (editingId) {
        await expensesApi.update(editingId, expenseData)
        if (selectedFile) {
          await expensesApi.uploadReceipt(editingId, selectedFile)
        }
        toast({ title: 'Expense updated successfully' })
      } else {
        const { data } = await expensesApi.create(expenseData)
        if (selectedFile) {
          await expensesApi.uploadReceipt(data._id, selectedFile)
        }
        toast({ title: 'Expense added successfully' })
      }

      setIsAddOpen(false)
      resetForm()
      fetchExpenses()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save expense',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (expense) => {
    setForm({
      siteId: expense.site?._id || '',
      categoryId: expense.category?._id || '',
      fundAllocationId: expense.fundAllocation?._id || '',
      amount: (expense.requestedAmount || expense.amount).toString(),
      description: expense.description || '',
      vendorName: expense.vendorName || '',
      expenseDate: expense.expenseDate.split('T')[0],
    })
    setEditingId(expense._id)
    setIsAddOpen(true)
  }

  const handleDelete = async () => {
    try {
      await expensesApi.delete(deleteId)
      toast({ title: 'Expense deleted' })
      setDeleteId(null)
      fetchExpenses()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete expense',
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setForm({
      siteId: '',
      categoryId: '',
      fundAllocationId: '',
      amount: '',
      description: '',
      vendorName: '',
      expenseDate: new Date().toISOString().split('T')[0],
    })
    setSelectedFile(null)
    setEditingId(null)
  }

  const clearFilters = () => {
    setFilters({ siteId: '', category: '', startDate: '', endDate: '' })
    setPagination({ ...pagination, page: 1 })
  }

  const handleApprove = async (e) => {
    e.preventDefault()
    try {
      await expensesApi.approve(approveExpense._id, {
        status: approveForm.status,
        approvedAmount: parseFloat(approveForm.approvedAmount),
        approvalNotes: approveForm.approvalNotes,
        paymentMethod: approveForm.paymentMethod || null,
        paymentReference: approveForm.paymentReference || null,
      })
      toast({ title: `Expense ${approveForm.status === 'paid' ? 'paid' : 'approved'} successfully` })
      setApproveExpense(null)
      resetApproveForm()
      fetchExpenses()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to approve expense',
        variant: 'destructive',
      })
    }
  }

  const resetApproveForm = () => {
    setApproveForm({
      status: 'approved',
      approvedAmount: '',
      approvalNotes: '',
      paymentMethod: '',
      paymentReference: '',
    })
  }

  const openApproveDialog = (expense) => {
    setApproveForm({
      status: 'approved',
      approvedAmount: expense.requestedAmount?.toString() || expense.amount?.toString() || '',
      approvalNotes: '',
      paymentMethod: '',
      paymentReference: '',
    })
    setApproveExpense(expense)
  }

  const totalFiltered = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Track and manage all expenses
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Site</Label>
              <Select
                value={filters.siteId}
                onValueChange={(value) => {
                  setFilters({ ...filters, siteId: value === 'all' ? '' : value })
                  setPagination({ ...pagination, page: 1 })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site._id} value={site._id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={filters.category}
                onValueChange={(value) => {
                  setFilters({ ...filters, category: value === 'all' ? '' : value })
                  setPagination({ ...pagination, page: 1 })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat._id} value={cat._id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From Date</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => {
                  setFilters({ ...filters, startDate: e.target.value })
                  setPagination({ ...pagination, page: 1 })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => {
                  setFilters({ ...filters, endDate: e.target.value })
                  setPagination({ ...pagination, page: 1 })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button variant="outline" className="w-full" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {expenses.length} of {pagination.total} entries
        </p>
        <p className="font-medium">
          Total: {formatCurrency(totalFiltered)}
        </p>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Added By</TableHead>
              <TableHead className="text-right">Requested</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No expenses found
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((expense) => (
                <TableRow key={expense._id}>
                  <TableCell>{formatDate(expense.expenseDate)}</TableCell>
                  <TableCell>{expense.site?.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{expense.category?.name}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {expense.description || '-'}
                  </TableCell>
                  <TableCell>{expense.vendorName || '-'}</TableCell>
                  <TableCell>{expense.user?.name}</TableCell>
                  <TableCell className="text-right">
                    {expense.amountHidden ? (
                      <span className="text-muted-foreground text-xs">Hidden</span>
                    ) : (
                      formatCurrency(expense.requestedAmount || expense.amount || 0)
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {expense.amountHidden ? (
                      <span className="text-muted-foreground text-xs">Hidden</span>
                    ) : expense.approvedAmount ? (
                      formatCurrency(expense.approvedAmount)
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[expense.status || 'pending']}>
                      {expense.status || 'pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewExpense(expense)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {expense.receiptPath && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={expense.receiptPath} target="_blank" rel="noopener noreferrer">
                            <Upload className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {/* Developer can approve pending expenses */}
                      {isAdmin && expense.status === 'pending' && !expense.amountHidden && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openApproveDialog(expense)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                      )}
                      {/* Developer can mark approved as paid */}
                      {isAdmin && expense.status === 'approved' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setApproveForm({
                              status: 'paid',
                              approvedAmount: expense.approvedAmount?.toString() || '',
                              approvalNotes: '',
                              paymentMethod: '',
                              paymentReference: '',
                            })
                            setApproveExpense(expense)
                          }}
                        >
                          Mark Paid
                        </Button>
                      )}
                      {/* Developer can edit any pending, others only their own pending */}
                      {(isAdmin || (expense.user?._id === user?._id && expense.status === 'pending')) && expense.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(expense)}
                          title="Edit expense"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {/* Developer can delete any, others only their own pending */}
                      {(isAdmin || (expense.user?._id === user?._id && expense.status === 'pending')) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(expense._id)}
                          title="Delete expense"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={pagination.page === 1}
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={pagination.page === pagination.pages}
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit' : 'Add'} Expense</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update expense entry' : 'Record a new expense entry'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Site</Label>
                <Select
                  value={form.siteId}
                  onValueChange={(value) => setForm({ ...form, siteId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site._id} value={site._id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(value) => setForm({ ...form, categoryId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat._id} value={cat._id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FundAllocationSelector
                value={form.fundAllocationId}
                onChange={(value) => setForm({ ...form, fundAllocationId: value })}
                requestedAmount={parseFloat(form.amount || 0)}
                required={true}
                label="Fund Allocation"
              />
              <div className="space-y-2">
                <Label>{isAdmin ? 'Amount (Rs.)' : 'Requested Amount (Rs.)'}</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="5000"
                  required
                  min="0"
                  step="0.01"
                />
                {!isAdmin && (
                  <p className="text-xs text-muted-foreground">
                    Developer will approve the final payment amount
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Cement purchase - 50 bags"
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor Name</Label>
                <Input
                  value={form.vendorName}
                  onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                  placeholder="ABC Suppliers"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Receipt (optional)</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">{editingId ? 'Update' : 'Add'} Expense</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Approve/Pay Dialog - Developer Only */}
      <Dialog open={!!approveExpense} onOpenChange={(open) => !open && setApproveExpense(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleApprove}>
            <DialogHeader>
              <DialogTitle>
                {approveForm.status === 'paid' ? 'Mark as Paid' : 'Approve Expense'}
              </DialogTitle>
              <DialogDescription>
                {approveExpense && (
                  <span>
                    {approveExpense.user?.name} requested {formatCurrency(approveExpense.requestedAmount || approveExpense.amount || 0)} for {approveExpense.description || 'expense'}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {approveForm.status !== 'paid' && (
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select
                    value={approveForm.status}
                    onValueChange={(value) => setApproveForm({ ...approveForm, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approve</SelectItem>
                      <SelectItem value="paid">Approve & Pay</SelectItem>
                      <SelectItem value="rejected">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {approveForm.status !== 'rejected' && (
                <div className="space-y-2">
                  <Label>Approved Amount (Rs.) *</Label>
                  <Input
                    type="number"
                    value={approveForm.approvedAmount}
                    onChange={(e) => setApproveForm({ ...approveForm, approvedAmount: e.target.value })}
                    placeholder="Amount to pay"
                    required
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the actual amount you will pay from your fund
                  </p>
                </div>
              )}
              {(approveForm.status === 'paid') && (
                <>
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select
                      value={approveForm.paymentMethod}
                      onValueChange={(value) => setApproveForm({ ...approveForm, paymentMethod: value === 'none' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Reference</Label>
                    <Input
                      value={approveForm.paymentReference}
                      onChange={(e) => setApproveForm({ ...approveForm, paymentReference: e.target.value })}
                      placeholder="UTR / Cheque No. / Transaction ID"
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={approveForm.approvalNotes}
                  onChange={(e) => setApproveForm({ ...approveForm, approvalNotes: e.target.value })}
                  placeholder="Any notes for this approval..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setApproveExpense(null)}>
                Cancel
              </Button>
              <Button type="submit">
                {approveForm.status === 'rejected' ? 'Reject' : approveForm.status === 'paid' ? 'Pay' : 'Approve'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Expense Dialog */}
      <Dialog open={!!viewExpense} onOpenChange={(open) => !open && setViewExpense(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Expense Details
              <Button variant="ghost" size="icon" onClick={() => setViewExpense(null)}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {viewExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Added By</p>
                  <p className="font-medium">{viewExpense.user?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDate(viewExpense.expenseDate)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Site</p>
                  <p className="font-medium">{viewExpense.site?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <Badge variant="outline">{viewExpense.category?.name}</Badge>
                </div>
              </div>
              {!viewExpense.amountHidden && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Requested Amount</p>
                    <p className="font-medium">{formatCurrency(viewExpense.requestedAmount || viewExpense.amount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Approved Amount</p>
                    <p className="font-bold text-lg">
                      {viewExpense.approvedAmount ? formatCurrency(viewExpense.approvedAmount) : '-'}
                    </p>
                  </div>
                </div>
              )}
              {viewExpense.amountHidden && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Amount details are hidden for this entry</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={STATUS_COLORS[viewExpense.status || 'pending']}>
                    {viewExpense.status || 'pending'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vendor</p>
                  <p className="font-medium">{viewExpense.vendorName || '-'}</p>
                </div>
              </div>
              {viewExpense.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{viewExpense.description}</p>
                </div>
              )}
              {viewExpense.paymentMethod && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="font-medium">
                      {PAYMENT_METHODS.find(m => m.value === viewExpense.paymentMethod)?.label || viewExpense.paymentMethod}
                    </p>
                  </div>
                  {viewExpense.paymentReference && (
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Reference</p>
                      <p className="font-medium">{viewExpense.paymentReference}</p>
                    </div>
                  )}
                </div>
              )}
              {viewExpense.approvalNotes && (
                <div>
                  <p className="text-sm text-muted-foreground">Approval Notes</p>
                  <p className="font-medium">{viewExpense.approvalNotes}</p>
                </div>
              )}
              {viewExpense.receiptPath && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Receipt</p>
                  <a
                    href={viewExpense.receiptPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <Upload className="h-4 w-4" />
                    View Receipt
                  </a>
                </div>
              )}
              <div className="pt-4 border-t text-xs text-muted-foreground">
                <p>Created: {formatDate(viewExpense.createdAt)}</p>
                {viewExpense.approvedBy && (
                  <p>Approved by: {viewExpense.approvedBy?.name} on {formatDate(viewExpense.approvalDate)}</p>
                )}
                {viewExpense.paidDate && (
                  <p>Paid on: {formatDate(viewExpense.paidDate)}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this expense record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
