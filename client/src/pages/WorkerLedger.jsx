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
import { Plus, Wallet, TrendingUp, TrendingDown, Filter, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, Edit, Trash2 } from 'lucide-react'
import { FundAllocationSelector } from '@/components/FundAllocationSelector'
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

const CATEGORIES = [
  { value: 'salary', label: 'Salary' },
  { value: 'pending_salary', label: 'Pending Salary' },
  { value: 'advance', label: 'Advance' },
  { value: 'bonus', label: 'Bonus' },
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
  const [selectedWorkerPendingSalary, setSelectedWorkerPendingSalary] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [isPaySalaryOpen, setIsPaySalaryOpen] = useState(false)
  const [isBulkPayOpen, setIsBulkPayOpen] = useState(false)
  const [bulkPendingWorkers, setBulkPendingWorkers] = useState([])
  const [selectedWorkers, setSelectedWorkers] = useState([])
  const [bulkSummary, setBulkSummary] = useState(null)

  const [filters, setFilters] = useState({
    workerId: '',
    siteId: '',
    type: '',
    category: '',
    startDate: '',
    endDate: '',
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

  const [paySalaryForm, setPaySalaryForm] = useState({
    fundAllocationId: '',
    amount: '',
    deductAdvances: true,
    partialPayment: false,
    paymentMode: 'cash',
    referenceNumber: '',
    notes: '',
  })

  const [bulkPayForm, setBulkPayForm] = useState({
    fundAllocationId: '',
    paymentMode: 'cash',
    referenceNumber: '',
    notes: '',
  })

  useEffect(() => {
    fetchInitialData()
    fetchOverallSummary()
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [pagination.page, filters])

  useEffect(() => {
    if (filters.workerId) {
      fetchWorkerBalance(filters.workerId)
      fetchWorkerPendingSalary(filters.workerId)
    } else {
      setSelectedWorkerBalance(null)
      setSelectedWorkerPendingSalary(null)
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

  const fetchWorkerPendingSalary = async (workerId) => {
    try {
      const { data } = await ledgerApi.getPendingSalary(workerId)
      setSelectedWorkerPendingSalary(data)
    } catch (error) {
      console.error('Error fetching pending salary:', error)
      setSelectedWorkerPendingSalary(null)
    }
  }

  const isEntryEditable = (entry) => {
    // Developers (admin) can edit and delete any entry without restrictions
    if (!isAdmin) return false
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const ledgerData = {
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
      }

      if (editingId) {
        await ledgerApi.update(editingId, ledgerData)
        toast({ title: 'Ledger entry updated' })
      } else {
        await ledgerApi.create(ledgerData)
        toast({ title: 'Ledger entry added' })
      }

      setIsAddOpen(false)
      resetForm()
      fetchEntries()
      if (filters.workerId === form.workerId) {
        fetchWorkerBalance(form.workerId)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save entry',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (entry) => {
    if (!isEntryEditable(entry)) {
      toast({
        title: 'Cannot Edit',
        description: 'This entry cannot be edited (too old, auto-generated, or already paid)',
        variant: 'destructive',
      })
      return
    }

    setForm({
      workerId: entry.worker?._id || '',
      siteId: entry.site?._id || '',
      fundAllocationId: entry.fundAllocation?._id || '',
      type: entry.type,
      amount: entry.amount.toString(),
      category: entry.category,
      description: entry.description || '',
      transactionDate: entry.transactionDate.split('T')[0],
      referenceNumber: entry.referenceNumber || '',
      paymentMode: entry.paymentMode || 'cash',
    })
    setEditingId(entry._id)
    setIsAddOpen(true)
  }

  const handleDelete = async () => {
    try {
      await ledgerApi.delete(deleteId)
      toast({ title: 'Ledger entry deleted' })
      setDeleteId(null)
      fetchEntries()
      if (filters.workerId) {
        fetchWorkerBalance(filters.workerId)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete entry',
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
    setEditingId(null)
  }

  const clearFilters = () => {
    setFilters({ workerId: '', siteId: '', type: '', category: '', startDate: '', endDate: '' })
    setPagination({ ...pagination, page: 1 })
  }

  const viewPaymentHistory = () => {
    setFilters({
      ...filters,
      category: 'salary',
      type: 'credit',
    })
    setPagination({ ...pagination, page: 1 })
  }

  const handlePaySalary = async (e) => {
    e.preventDefault()
    if (!filters.workerId) return

    try {
      await ledgerApi.paySalary({
        workerId: filters.workerId,
        fundAllocationId: paySalaryForm.fundAllocationId || null,
        amount: parseFloat(paySalaryForm.amount),
        deductAdvances: paySalaryForm.deductAdvances,
        paymentMode: paySalaryForm.paymentMode,
        referenceNumber: paySalaryForm.referenceNumber,
        notes: paySalaryForm.notes,
      })

      toast({ title: 'Salary paid successfully' })
      setIsPaySalaryOpen(false)
      resetPaySalaryForm()
      fetchEntries()
      fetchWorkerBalance(filters.workerId)
      fetchWorkerPendingSalary(filters.workerId)
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to pay salary',
        variant: 'destructive',
      })
    }
  }

  const resetPaySalaryForm = () => {
    setPaySalaryForm({
      fundAllocationId: '',
      amount: '',
      deductAdvances: true,
      partialPayment: false,
      paymentMode: 'cash',
      referenceNumber: '',
      notes: '',
    })
  }

  const openPaySalaryDialog = () => {
    if (!selectedWorkerPendingSalary) return

    // Pre-fill amount with net payable
    const netPayable = selectedWorkerPendingSalary.netPayable || 0
    setPaySalaryForm({
      ...paySalaryForm,
      amount: netPayable > 0 ? netPayable.toString() : '',
      deductAdvances: true,
      partialPayment: false,
    })
    setIsPaySalaryOpen(true)
  }

  const fetchOverallSummary = async () => {
    try {
      const { data } = await ledgerApi.getAllPendingSalaries()
      setBulkSummary(data.summary || null)
    } catch (error) {
      console.error('Error fetching overall summary:', error)
    }
  }

  const fetchAllPendingSalaries = async () => {
    try {
      const { data } = await ledgerApi.getAllPendingSalaries()
      setBulkPendingWorkers(data.workers || [])
      setBulkSummary(data.summary || null)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch pending salaries',
        variant: 'destructive',
      })
    }
  }

  const openBulkPayDialog = async () => {
    await fetchAllPendingSalaries()
    setIsBulkPayOpen(true)
  }

  const toggleWorkerSelection = (workerId) => {
    setSelectedWorkers(prev =>
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    )
  }

  const selectAllWorkers = () => {
    setSelectedWorkers(bulkPendingWorkers.map(w => w.worker._id))
  }

  const deselectAllWorkers = () => {
    setSelectedWorkers([])
  }

  const handleBulkPaySalary = async (e) => {
    e.preventDefault()

    if (selectedWorkers.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one worker',
        variant: 'destructive',
      })
      return
    }

    try {
      const { data } = await ledgerApi.bulkPaySalary({
        workerIds: selectedWorkers,
        fundAllocationId: bulkPayForm.fundAllocationId,
        paymentMode: bulkPayForm.paymentMode,
        referenceNumber: bulkPayForm.referenceNumber,
        notes: bulkPayForm.notes,
      })

      toast({
        title: 'Bulk payment successful',
        description: data.message,
      })
      setIsBulkPayOpen(false)
      setSelectedWorkers([])
      resetBulkPayForm()
      fetchEntries()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to process bulk payment',
        variant: 'destructive',
      })
    }
  }

  const resetBulkPayForm = () => {
    setBulkPayForm({
      fundAllocationId: '',
      paymentMode: 'cash',
      referenceNumber: '',
      notes: '',
    })
  }

  const getSelectedTotals = () => {
    const selected = bulkPendingWorkers.filter(w => selectedWorkers.includes(w.worker._id))
    return {
      count: selected.length,
      totalPending: selected.reduce((sum, w) => sum + w.totalPending, 0),
      totalAdvances: selected.reduce((sum, w) => sum + w.totalAdvances, 0),
      totalNetPayable: selected.reduce((sum, w) => sum + w.netPayable, 0),
    }
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
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={openBulkPayDialog} className="w-full sm:w-auto">
              <Wallet className="h-4 w-4 mr-2" />
              Bulk Pay Salary
            </Button>
            <Button onClick={() => setIsAddOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </Button>
          </div>
        )}
      </div>

      {/* Real-time Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workers with Pending</CardTitle>
            <Wallet className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bulkSummary?.totalWorkers || 0}</div>
            <p className="text-xs text-muted-foreground">Need salary payment</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending Salary</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(bulkSummary?.totalPending || 0)}</div>
            <p className="text-xs text-muted-foreground">From attendance</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Advances</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(bulkSummary?.totalAdvances || 0)}</div>
            <p className="text-xs text-muted-foreground">To be deducted</p>
          </CardContent>
        </Card>
        <Card className="border-green-300 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Payable</CardTitle>
            <Wallet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(bulkSummary?.totalNetPayable || 0)}</div>
            <p className="text-xs text-muted-foreground">After advance deductions</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Salary Summary Card */}
      {selectedWorkerPendingSalary && selectedWorkerPendingSalary.totalPending > 0 && (
        <Card className="border-orange-300 bg-orange-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Pending Salary Summary - {selectedWorkerPendingSalary.worker.name}</CardTitle>
                <CardDescription>Accumulated from attendance records</CardDescription>
              </div>
              {(isAdmin || isSupervisor) && (
                <Button onClick={openPaySalaryDialog}>
                  <Wallet className="h-4 w-4 mr-2" />
                  Pay Salary
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Pending Salary</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(selectedWorkerPendingSalary.totalPending)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Outstanding Advances</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(selectedWorkerPendingSalary.totalAdvances)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Net Payable</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(selectedWorkerPendingSalary.netPayable)}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Based on {selectedWorkerPendingSalary.attendanceCount || 0} attendance records
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
              <Label>Start Date</Label>
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
              <Label>End Date</Label>
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
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={viewPaymentHistory}>
                  Payment History
                </Button>
                <Button variant="outline" className="flex-1" onClick={clearFilters}>
                  Clear
                </Button>
              </div>
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
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 9 : 8} className="text-center text-muted-foreground py-8">
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
                  {isAdmin && (
                    <TableCell className="text-right">
                      {isEntryEditable(entry) ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(entry)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(entry._id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  )}
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
      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit' : 'Add'} Ledger Entry</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update ledger entry details' : 'Record a payment, advance, or deduction'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Worker *</Label>
                <Select
                  value={form.workerId}
                  onValueChange={(value) => {
                    // Auto-select worker's first assigned site
                    const workerSites = sites.filter(site =>
                      site.assignedUsers?.some(userId => userId === value)
                    )
                    const firstSiteId = workerSites.length > 0 ? workerSites[0]._id : ''
                    setForm({ ...form, workerId: value, siteId: firstSiteId })
                  }}
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
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => {
                    // All categories are credit (payment to worker)
                    setForm({ ...form, category: value, type: 'credit' })
                  }}
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
                <p className="text-xs text-muted-foreground">
                  ↑ Payment to worker
                </p>
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
              <Button type="submit">{editingId ? 'Update' : 'Add'} Entry</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pay Salary Dialog */}
      <Dialog open={isPaySalaryOpen} onOpenChange={setIsPaySalaryOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handlePaySalary}>
            <DialogHeader>
              <DialogTitle>Pay Salary</DialogTitle>
              <DialogDescription>
                {selectedWorkerPendingSalary && (
                  <span>
                    Pay pending salary to {selectedWorkerPendingSalary.worker.name}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              {selectedWorkerPendingSalary && (
                <div className="bg-blue-50 p-4 rounded-lg space-y-2 border border-blue-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Pending Salary:</span>
                    <span className="font-bold text-orange-600">
                      {formatCurrency(selectedWorkerPendingSalary.totalPending)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Outstanding Advances:</span>
                    <span className="font-bold text-red-600">
                      -{formatCurrency(selectedWorkerPendingSalary.totalAdvances)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-blue-300">
                    <span className="font-medium">Net Payable:</span>
                    <span className="font-bold text-green-700 text-lg">
                      {formatCurrency(selectedWorkerPendingSalary.netPayable)}
                    </span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="partialPayment"
                    checked={paySalaryForm.partialPayment}
                    onChange={(e) => {
                      const isPartial = e.target.checked
                      const netPayable = selectedWorkerPendingSalary?.netPayable || 0
                      setPaySalaryForm({
                        ...paySalaryForm,
                        partialPayment: isPartial,
                        amount: isPartial ? '' : (netPayable > 0 ? netPayable.toString() : '')
                      })
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="partialPayment" className="text-sm font-normal cursor-pointer">
                    Partial payment (pay less than full amount)
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Amount to Pay (Rs.) *</Label>
                <Input
                  type="number"
                  value={paySalaryForm.amount}
                  onChange={(e) => setPaySalaryForm({ ...paySalaryForm, amount: e.target.value })}
                  placeholder="Enter amount"
                  required
                  min="0"
                  step="0.01"
                  disabled={!paySalaryForm.partialPayment}
                  className={!paySalaryForm.partialPayment ? 'bg-green-50 font-semibold' : ''}
                />
                <p className="text-xs text-muted-foreground">
                  {paySalaryForm.partialPayment
                    ? '✏️ Enter custom amount for partial payment'
                    : `✓ Full payment: ${formatCurrency(selectedWorkerPendingSalary?.netPayable || 0)}`
                  }
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="deductAdvances"
                    checked={paySalaryForm.deductAdvances}
                    onChange={(e) => setPaySalaryForm({ ...paySalaryForm, deductAdvances: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="deductAdvances" className="text-sm font-normal cursor-pointer">
                    Automatically deduct outstanding advances from this payment
                  </Label>
                </div>
              </div>
              {fundAllocations.length > 0 && (
                <div className="space-y-2">
                  <Label>Fund Source (Optional)</Label>
                  <Select
                    value={paySalaryForm.fundAllocationId}
                    onValueChange={(value) => setPaySalaryForm({ ...paySalaryForm, fundAllocationId: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fund allocation" />
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
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Mode *</Label>
                  <Select
                    value={paySalaryForm.paymentMode}
                    onValueChange={(value) => setPaySalaryForm({ ...paySalaryForm, paymentMode: value })}
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
                <div className="space-y-2">
                  <Label>Reference Number</Label>
                  <Input
                    value={paySalaryForm.referenceNumber}
                    onChange={(e) => setPaySalaryForm({ ...paySalaryForm, referenceNumber: e.target.value })}
                    placeholder="UTR / Cheque No."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={paySalaryForm.notes}
                  onChange={(e) => setPaySalaryForm({ ...paySalaryForm, notes: e.target.value })}
                  placeholder="Salary payment for the month..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaySalaryOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Pay Salary</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Pay Salary Dialog */}
      <Dialog open={isBulkPayOpen} onOpenChange={(open) => {
        setIsBulkPayOpen(open)
        if (!open) {
          setSelectedWorkers([])
          resetBulkPayForm()
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleBulkPaySalary}>
            <DialogHeader>
              <DialogTitle>Bulk Salary Payment</DialogTitle>
              <DialogDescription>
                Select workers and pay their pending salaries at once
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Summary */}
              {bulkSummary && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="font-medium mb-2">Overall Summary</h3>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Workers</p>
                      <p className="font-bold text-lg">{bulkSummary.totalWorkers}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Pending</p>
                      <p className="font-bold text-lg text-orange-600">{formatCurrency(bulkSummary.totalPending)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Advances</p>
                      <p className="font-bold text-lg text-red-600">-{formatCurrency(bulkSummary.totalAdvances)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Net Payable</p>
                      <p className="font-bold text-lg text-green-600">{formatCurrency(bulkSummary.totalNetPayable)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Selected Summary */}
              {selectedWorkers.length > 0 && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h3 className="font-medium mb-2">Selected Workers Summary</h3>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Selected</p>
                      <p className="font-bold text-lg">{getSelectedTotals().count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Pending</p>
                      <p className="font-bold text-lg text-orange-600">{formatCurrency(getSelectedTotals().totalPending)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Advances</p>
                      <p className="font-bold text-lg text-red-600">-{formatCurrency(getSelectedTotals().totalAdvances)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Amount to Pay</p>
                      <p className="font-bold text-lg text-green-700">{formatCurrency(getSelectedTotals().totalNetPayable)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Worker Selection */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Select Workers</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAllWorkers}>
                      Select All
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={deselectAllWorkers}>
                      Deselect All
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {bulkPendingWorkers.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No workers with pending salaries found
                    </div>
                  ) : (
                    <div className="divide-y">
                      {bulkPendingWorkers.map((item) => (
                        <div
                          key={item.worker._id}
                          className="p-3 hover:bg-muted/50 cursor-pointer flex items-center gap-3"
                          onClick={() => toggleWorkerSelection(item.worker._id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedWorkers.includes(item.worker._id)}
                            onChange={() => toggleWorkerSelection(item.worker._id)}
                            className="h-4 w-4 rounded border-gray-300"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{item.worker.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.attendanceCount} attendance records
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-600">{formatCurrency(item.netPayable)}</p>
                                <p className="text-xs text-muted-foreground">
                                  Pending: {formatCurrency(item.totalPending)}
                                  {item.totalAdvances > 0 && ` | Adv: ${formatCurrency(item.totalAdvances)}`}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Details */}
              {selectedWorkers.length > 0 && (
                <>
                  <div className="space-y-2">
                    <Label>Fund Allocation *</Label>
                    <FundAllocationSelector
                      value={bulkPayForm.fundAllocationId}
                      onChange={(value) => setBulkPayForm({ ...bulkPayForm, fundAllocationId: value })}
                      requestedAmount={getSelectedTotals().totalNetPayable}
                      required={true}
                      label="Fund Source"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Payment Mode *</Label>
                      <Select
                        value={bulkPayForm.paymentMode}
                        onValueChange={(value) => setBulkPayForm({ ...bulkPayForm, paymentMode: value })}
                        required
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
                    <div className="space-y-2">
                      <Label>Reference Number</Label>
                      <Input
                        value={bulkPayForm.referenceNumber}
                        onChange={(e) => setBulkPayForm({ ...bulkPayForm, referenceNumber: e.target.value })}
                        placeholder="Batch reference"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={bulkPayForm.notes}
                      onChange={(e) => setBulkPayForm({ ...bulkPayForm, notes: e.target.value })}
                      placeholder="Bulk salary payment for..."
                    />
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBulkPayOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={selectedWorkers.length === 0}
              >
                Pay {selectedWorkers.length} Worker{selectedWorkers.length !== 1 ? 's' : ''} - {formatCurrency(getSelectedTotals().totalNetPayable)}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ledger Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this ledger entry? This action cannot be undone and may affect the worker's balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
