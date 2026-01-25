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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Filter, Trash2, Upload, ChevronLeft, ChevronRight } from 'lucide-react'

export default function Expenses() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()

  const [expenses, setExpenses] = useState([])
  const [sites, setSites] = useState([])
  const [categories, setCategories] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)

  const [filters, setFilters] = useState({
    siteId: '',
    category: '',
    startDate: '',
    endDate: '',
  })

  const [form, setForm] = useState({
    siteId: '',
    categoryId: '',
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

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      const { data } = await expensesApi.create({
        siteId: form.siteId,
        categoryId: form.categoryId,
        amount: parseFloat(form.amount),
        description: form.description,
        vendorName: form.vendorName,
        expenseDate: form.expenseDate,
      })

      if (selectedFile) {
        await expensesApi.uploadReceipt(data._id, selectedFile)
      }

      toast({ title: 'Expense added successfully' })
      setIsAddOpen(false)
      resetForm()
      fetchExpenses()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to add expense',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id) => {
    try {
      await expensesApi.delete(id)
      toast({ title: 'Expense deleted' })
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
      amount: '',
      description: '',
      vendorName: '',
      expenseDate: new Date().toISOString().split('T')[0],
    })
    setSelectedFile(null)
  }

  const clearFilters = () => {
    setFilters({ siteId: '', category: '', startDate: '', endDate: '' })
    setPagination({ ...pagination, page: 1 })
  }

  const totalFiltered = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">
            Track and manage all expenses
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
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
          <div className="grid gap-4 md:grid-cols-5">
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
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Added By</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                  <TableCell className="text-right font-medium">
                    {formatCurrency(expense.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {expense.receiptPath && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={expense.receiptPath} target="_blank" rel="noopener noreferrer">
                            <Upload className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {(isAdmin || expense.user?._id === user?._id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(expense._id)}
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
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
              <DialogDescription>
                Record a new expense entry
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
              <div className="space-y-2">
                <Label>Amount (Rs.)</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="5000"
                  required
                  min="0"
                  step="0.01"
                />
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
              <Button type="submit">Add Expense</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
