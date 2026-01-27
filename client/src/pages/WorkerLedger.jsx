import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { ledgerApi, sitesApi, usersApi, fundsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { Plus, Wallet, TrendingUp, TrendingDown, Filter, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft } from 'lucide-react'

const CATEGORIES = [
  { value: 'salary', label: 'Salary' },
  { value: 'advance', label: 'Advance' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'deduction', label: 'Deduction' },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'other', label: 'Other' },
]

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'other', label: 'Other' },
]

export default function WorkerLedger() {
  const { user, isAdmin, isSupervisor } = useAuth()
  const { toast } = useToast()

  const [entries, setEntries] = useState([])
  const [sites, setSites] = useState([])
  const [workers, setWorkers] = useState([])
  const [fundAllocations, setFundAllocations] = useState([])
  const [selectedWorkerBalance, setSelectedWorkerBalance] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)

  const [filters, setFilters] = useState({
    workerId: '',
    siteId: '',
    type: '',
    category: '',
  })

  const [form, setForm] = useState({
    workerId: '',
    siteId: '',
    fundAllocationId: '',
    type: 'debit',
    amount: '',
    category: 'salary',
    description: '',
    transactionDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    paymentMode: 'cash',
  })

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [pagination.page, filters])

  useEffect(() => {
    if (filters.workerId) {
      fetchWorkerBalance(filters.workerId)
    } else {
      setSelectedWorkerBalance(null)
    }
  }, [filters.workerId])

  const fetchInitialData = async () => {
    try {
      const [sitesRes, workersRes, fundsRes] = await Promise.all([
        sitesApi.getAll(),
        usersApi.getChildren(),
        fundsApi.getAll({ status: 'disbursed' })
      ])
      setSites(sitesRes.data)
      setWorkers(workersRes.data)
      setFundAllocations(fundsRes.data?.allocations || [])
    } catch (error) {
      console.error('Error fetching initial data:', error)
    }
  }

  const fetchEntries = async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.page,
        limit: 50,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      }
      const { data } = await ledgerApi.getAll(params)
      setEntries(data.entries)
      setPagination(data.pagination)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch ledger entries',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchWorkerBalance = async (workerId) => {
    try {
      const { data } = await ledgerApi.getBalance(workerId)
      setSelectedWorkerBalance(data)
    } catch (error) {
      console.error('Error fetching balance:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await ledgerApi.create({
        workerId: form.workerId,
        siteId: form.siteId || null,
        fundAllocationId: form.fundAllocationId || null,
        type: form.type,
        amount: parseFloat(form.amount),
        category: form.category,
        description: form.description,
        transactionDate: form.transactionDate,
        referenceNumber: form.referenceNumber,
        paymentMode: form.paymentMode,
      })
      toast({ title: 'Ledger entry added' })
      setIsAddOpen(false)
      resetForm()
      fetchEntries()
      if (filters.workerId === form.workerId) {
        fetchWorkerBalance(form.workerId)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to add entry',
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setForm({
      workerId: '',
      siteId: '',
      fundAllocationId: '',
      type: 'debit',
      amount: '',
      category: 'salary',
      description: '',
      transactionDate: new Date().toISOString().split('T')[0],
      referenceNumber: '',
      paymentMode: 'cash',
    })
  }

  const clearFilters = () => {
    setFilters({ workerId: '', siteId: '', type: '', category: '' })
    setPagination({ ...pagination, page: 1 })
  }

  // Calculate totals from current entries
  const totalCredits = entries.filter(e => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0)
  const totalDebits = entries.filter(e => e.type === 'debit').reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Worker Ledger</h1>
          <p className="text-muted-foreground">
            Track worker payments, advances, and deductions
          </p>
        </div>
        {(isAdmin || isSupervisor) && (
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits (Page)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalCredits)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Debits (Page)</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalDebits)}</div>
          </CardContent>
        </Card>
        {selectedWorkerBalance && (
          <Card className="border-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{selectedWorkerBalance.worker.name}'s Balance</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${selectedWorkerBalance.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(selectedWorkerBalance.balance))}
                <span className="text-sm font-normal ml-1">
                  {selectedWorkerBalance.balance >= 0 ? '(Due to worker)' : '(Due from worker)'}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
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
              <Label>Worker</Label>
              <Select
                value={filters.workerId}
                onValueChange={(value) => {
                  setFilters({ ...filters, workerId: value === 'all' ? '' : value })
                  setPagination({ ...pagination, page: 1 })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Workers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workers</SelectItem>
                  {workers.map((worker) => (
                    <SelectItem key={worker._id} value={worker._id}>{worker.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                    <SelectItem key={site._id} value={site._id}>{site.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={filters.type}
                onValueChange={(value) => {
                  setFilters({ ...filters, type: value === 'all' ? '' : value })
                  setPagination({ ...pagination, page: 1 })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
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
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Ledger Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ledger Entries</CardTitle>
          <CardDescription>Showing {entries.length} of {pagination.total} entries</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Amount</TableHead>
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
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No ledger entries found
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry._id}>
                  <TableCell>{formatDate(entry.transactionDate)}</TableCell>
                  <TableCell className="font-medium">{entry.worker?.name}</TableCell>
                  <TableCell>
                    <Badge className={entry.type === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      <span className="flex items-center gap-1">
                        {entry.type === 'credit' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {entry.type}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {CATEGORIES.find(c => c.value === entry.category)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{entry.description || '-'}</TableCell>
                  <TableCell>{entry.site?.name || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {PAYMENT_MODES.find(m => m.value === entry.paymentMode)?.label}
                    {entry.referenceNumber && <span className="block text-xs">Ref: {entry.referenceNumber}</span>}
                  </TableCell>
                  <TableCell className={`text-right font-bold ${entry.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                    {entry.type === 'credit' ? '+' : '-'}{formatCurrency(entry.amount)}
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
          <span className="text-sm">Page {pagination.page} of {pagination.pages}</span>
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

      {/* Add Entry Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add Ledger Entry</DialogTitle>
              <DialogDescription>Record a payment, advance, or deduction</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Worker *</Label>
                <Select
                  value={form.workerId}
                  onValueChange={(value) => setForm({ ...form, workerId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((worker) => (
                      <SelectItem key={worker._id} value={worker._id}>{worker.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select
                    value={form.type}
                    onValueChange={(value) => setForm({ ...form, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Credit (Payment to worker)</SelectItem>
                      {/* <SelectItem value="debit">Debit (Advance/Due from worker)</SelectItem> */}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) => setForm({ ...form, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (Rs.) *</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="5000"
                    required
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={form.transactionDate}
                    onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Site</Label>
                  <Select
                    value={form.siteId}
                    onValueChange={(value) => setForm({ ...form, siteId: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select site (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific site</SelectItem>
                      {sites.map((site) => (
                        <SelectItem key={site._id} value={site._id}>{site.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Mode</Label>
                  <Select
                    value={form.paymentMode}
                    onValueChange={(value) => setForm({ ...form, paymentMode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {fundAllocations.length > 0 && (
                <div className="space-y-2">
                  <Label>Fund Source (Optional)</Label>
                  <Select
                    value={form.fundAllocationId}
                    onValueChange={(value) => setForm({ ...form, fundAllocationId: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Link to fund allocation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific fund</SelectItem>
                      {fundAllocations.map((allocation) => (
                        <SelectItem key={allocation._id} value={allocation._id}>
                          {allocation.fromUser?.name} → {formatCurrency(allocation.amount)} ({allocation.purpose})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Link this entry to a fund allocation for tracking</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input
                  value={form.referenceNumber}
                  onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                  placeholder="Transaction ID, Cheque No, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Weekly salary payment"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Add Entry</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
