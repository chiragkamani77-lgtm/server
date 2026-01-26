import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { contractsApi, sitesApi, usersApi, fundsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
import {
  Plus, FileText, Users, IndianRupee, ChevronLeft, ChevronRight,
  Trash2, Edit, Play, CreditCard, Calendar, CheckCircle, Clock, Filter
} from 'lucide-react'

const CONTRACT_TYPES = [
  { value: 'fixed', label: 'Fixed Price', description: 'Total amount for completed work' },
  { value: 'milestone', label: 'Milestone Based', description: 'Payments based on work milestones' },
  { value: 'daily', label: 'Daily Rate', description: 'Based on attendance and daily rate' },
]

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  terminated: 'bg-red-100 text-red-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
}

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
]

export default function Contracts() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()

  const [contracts, setContracts] = useState([])
  const [sites, setSites] = useState([])
  const [workers, setWorkers] = useState([])
  const [fundAllocations, setFundAllocations] = useState([])
  const [summary, setSummary] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [editingId, setEditingId] = useState(null)

  const [filters, setFilters] = useState({
    siteId: '',
    status: '',
    contractType: '',
    workerId: '',
  })

  const [form, setForm] = useState({
    workerId: '',
    siteId: '',
    fundAllocationId: '',
    contractType: 'fixed',
    title: '',
    description: '',
    totalAmount: '',
    numberOfInstallments: '1',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    dailyRate: '',
    workDescription: '',
    terms: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    installmentNumber: '',
    amount: '',
    paymentMode: 'cash',
    referenceNumber: '',
    notes: '',
  })

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    fetchContracts()
  }, [pagination.page, filters])

  const fetchInitialData = async () => {
    try {
      const [sitesRes, workersRes, fundsRes] = await Promise.all([
        sitesApi.getAll(),
        usersApi.getChildren(),
        fundsApi.getAll({ status: 'disbursed' })
      ])
      setSites(sitesRes.data)
      setWorkers(workersRes.data || [])
      setFundAllocations(fundsRes.data?.allocations || [])
    } catch (error) {
      console.error('Error fetching initial data:', error)
    }
  }

  const fetchContracts = async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.page,
        limit: 20,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      }
      const [contractsRes, summaryRes] = await Promise.all([
        contractsApi.getAll(params),
        contractsApi.getSummary(),
      ])
      setContracts(contractsRes.data.contracts)
      setPagination(contractsRes.data.pagination)
      setSummary(summaryRes.data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch contracts',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const contractData = {
        workerId: form.workerId,
        siteId: form.siteId,
        fundAllocationId: form.fundAllocationId || null,
        contractType: form.contractType,
        title: form.title,
        description: form.description,
        totalAmount: parseFloat(form.totalAmount),
        numberOfInstallments: parseInt(form.numberOfInstallments) || 1,
        startDate: form.startDate,
        endDate: form.endDate || null,
        dailyRate: form.dailyRate ? parseFloat(form.dailyRate) : null,
        workDescription: form.workDescription,
        terms: form.terms,
      }

      if (editingId) {
        await contractsApi.update(editingId, contractData)
        toast({ title: 'Contract updated successfully' })
      } else {
        await contractsApi.create(contractData)
        toast({ title: 'Contract created successfully' })
      }
      setIsAddOpen(false)
      resetForm()
      fetchContracts()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save contract',
        variant: 'destructive',
      })
    }
  }

  const handleActivate = async (id) => {
    try {
      await contractsApi.activate(id)
      toast({ title: 'Contract activated' })
      fetchContracts()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to activate contract',
        variant: 'destructive',
      })
    }
  }

  const handlePayment = async (e) => {
    e.preventDefault()
    try {
      await contractsApi.recordPayment(selectedContract._id, {
        installmentNumber: parseInt(paymentForm.installmentNumber),
        amount: parseFloat(paymentForm.amount),
        paymentMode: paymentForm.paymentMode,
        referenceNumber: paymentForm.referenceNumber,
        notes: paymentForm.notes,
        fundAllocationId: selectedContract.fundAllocation?._id,
      })
      toast({ title: 'Payment recorded successfully' })
      setIsPaymentOpen(false)
      resetPaymentForm()
      fetchContracts()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to record payment',
        variant: 'destructive',
      })
    }
  }

  const openPaymentDialog = async (contract) => {
    try {
      const res = await contractsApi.getOne(contract._id)
      setSelectedContract(res.data)
      setIsPaymentOpen(true)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load contract details',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (contract) => {
    setForm({
      workerId: contract.worker?._id || '',
      siteId: contract.site?._id || '',
      fundAllocationId: contract.fundAllocation?._id || '',
      contractType: contract.contractType,
      title: contract.title,
      description: contract.description || '',
      totalAmount: contract.totalAmount.toString(),
      numberOfInstallments: contract.numberOfInstallments.toString(),
      startDate: contract.startDate.split('T')[0],
      endDate: contract.endDate ? contract.endDate.split('T')[0] : '',
      dailyRate: contract.dailyRate?.toString() || '',
      workDescription: contract.workDescription || '',
      terms: contract.terms || '',
    })
    setEditingId(contract._id)
    setIsAddOpen(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this contract?')) return
    try {
      await contractsApi.delete(id)
      toast({ title: 'Contract deleted' })
      fetchContracts()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete contract',
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setForm({
      workerId: '',
      siteId: '',
      fundAllocationId: '',
      contractType: 'fixed',
      title: '',
      description: '',
      totalAmount: '',
      numberOfInstallments: '1',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      dailyRate: '',
      workDescription: '',
      terms: '',
    })
    setEditingId(null)
  }

  const resetPaymentForm = () => {
    setPaymentForm({
      installmentNumber: '',
      amount: '',
      paymentMode: 'cash',
      referenceNumber: '',
      notes: '',
    })
    setSelectedContract(null)
  }

  const clearFilters = () => {
    setFilters({ siteId: '', status: '', contractType: '', workerId: '' })
    setPagination({ ...pagination, page: 1 })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Labor Contracts</h1>
          <p className="text-muted-foreground">
            Manage worker contracts with partial payment tracking
          </p>
        </div>
        {(isAdmin || user?.role === 2) && (
          <Button onClick={() => { resetForm(); setIsAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.overall.totalContracts}</div>
              <p className="text-xs text-muted-foreground">
                Value: {formatCurrency(summary.overall.totalContractValue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <IndianRupee className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.overall.totalPaid)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(summary.overall.totalRemaining)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {summary.byStatus.find(s => s._id === 'active')?.count || 0}
              </div>
            </CardContent>
          </Card>
        </div>
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
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => {
                  setFilters({ ...filters, status: value === 'all' ? '' : value })
                  setPagination({ ...pagination, page: 1 })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={filters.contractType}
                onValueChange={(value) => {
                  setFilters({ ...filters, contractType: value === 'all' ? '' : value })
                  setPagination({ ...pagination, page: 1 })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {CONTRACT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
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

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contracts</CardTitle>
          <CardDescription>Showing {contracts.length} of {pagination.total} entries</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contract</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No contracts found
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((contract) => (
                <TableRow key={contract._id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{contract.title}</p>
                      <p className="text-xs text-muted-foreground">{contract.contractNumber}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {contract.worker?.name}
                    </div>
                  </TableCell>
                  <TableCell>{contract.site?.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {CONTRACT_TYPES.find(t => t.value === contract.contractType)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(contract.totalAmount)}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(contract.totalPaid)}
                  </TableCell>
                  <TableCell>
                    <div className="w-24">
                      <Progress value={contract.progressPercentage} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {contract.progressPercentage}% ({contract.paidInstallmentsCount}/{contract.numberOfInstallments})
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[contract.status]}>{contract.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {contract.status === 'draft' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivate(contract._id)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Activate
                        </Button>
                      )}
                      {contract.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPaymentDialog(contract)}
                        >
                          <CreditCard className="h-3 w-3 mr-1" />
                          Pay
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(contract)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {isAdmin && contract.totalPaid === 0 && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(contract._id)}>
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

      {/* Add/Edit Contract Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit' : 'New'} Labor Contract</DialogTitle>
              <DialogDescription>
                Create a contract with partial payment installments
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <Label>Site *</Label>
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
                        <SelectItem key={site._id} value={site._id}>{site.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contract Title *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Plumbing work for Building A"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contract Type *</Label>
                  <Select
                    value={form.contractType}
                    onValueChange={(value) => setForm({ ...form, contractType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <p>{type.label}</p>
                            <p className="text-xs text-muted-foreground">{type.description}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Total Amount (Rs.) *</Label>
                  <Input
                    type="number"
                    value={form.totalAmount}
                    onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                    placeholder="100000"
                    required
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number of Installments *</Label>
                  <Input
                    type="number"
                    value={form.numberOfInstallments}
                    onChange={(e) => setForm({ ...form, numberOfInstallments: e.target.value })}
                    placeholder="6"
                    required
                    min="1"
                  />
                </div>
                {form.contractType === 'daily' && (
                  <div className="space-y-2">
                    <Label>Daily Rate (Rs.)</Label>
                    <Input
                      type="number"
                      value={form.dailyRate}
                      onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
                      placeholder="500"
                      min="1"
                    />
                  </div>
                )}
              </div>

              {form.totalAmount && form.numberOfInstallments && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Payment per installment: </span>
                    <span className="font-bold">
                      {formatCurrency(Math.ceil(parseFloat(form.totalAmount) / parseInt(form.numberOfInstallments)))}
                    </span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
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
                </div>
              )}

              <div className="space-y-2">
                <Label>Work Description</Label>
                <Textarea
                  value={form.workDescription}
                  onChange={(e) => setForm({ ...form, workDescription: e.target.value })}
                  placeholder="Detailed description of work to be done..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Terms & Conditions</Label>
                <Textarea
                  value={form.terms}
                  onChange={(e) => setForm({ ...form, terms: e.target.value })}
                  placeholder="Payment terms, work conditions, etc."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">{editingId ? 'Update' : 'Create'} Contract</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={(open) => { setIsPaymentOpen(open); if (!open) resetPaymentForm(); }}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handlePayment}>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                {selectedContract && (
                  <span>
                    {selectedContract.title} - {selectedContract.worker?.name}
                    <br />
                    Total: {formatCurrency(selectedContract.totalAmount)} |
                    Paid: {formatCurrency(selectedContract.totalPaid)} |
                    Remaining: {formatCurrency(selectedContract.remainingAmount)}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedContract && (
                <>
                  {/* Installments Overview */}
                  <div className="space-y-2">
                    <Label>Installments</Label>
                    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {selectedContract.installments?.map((inst) => (
                        <div
                          key={inst.installmentNumber}
                          className={`p-3 flex justify-between items-center ${
                            inst.status === 'paid' ? 'bg-green-50' :
                            inst.status === 'partial' ? 'bg-yellow-50' : ''
                          }`}
                        >
                          <div>
                            <p className="font-medium">Installment {inst.installmentNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              Due: {formatCurrency(inst.amount)}
                              {inst.paidAmount > 0 && ` | Paid: ${formatCurrency(inst.paidAmount)}`}
                            </p>
                          </div>
                          <Badge className={
                            inst.status === 'paid' ? 'bg-green-100 text-green-800' :
                            inst.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {inst.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Select Installment *</Label>
                      <Select
                        value={paymentForm.installmentNumber}
                        onValueChange={(value) => {
                          setPaymentForm({ ...paymentForm, installmentNumber: value })
                          const inst = selectedContract.installments?.find(i => i.installmentNumber === parseInt(value))
                          if (inst) {
                            setPaymentForm(prev => ({
                              ...prev,
                              installmentNumber: value,
                              amount: (inst.amount - inst.paidAmount).toString()
                            }))
                          }
                        }}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedContract.installments?.filter(i => i.status !== 'paid').map((inst) => (
                            <SelectItem key={inst.installmentNumber} value={inst.installmentNumber.toString()}>
                              #{inst.installmentNumber} - {formatCurrency(inst.amount - inst.paidAmount)} remaining
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (Rs.) *</Label>
                      <Input
                        type="number"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                        placeholder="Amount"
                        required
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Payment Mode</Label>
                      <Select
                        value={paymentForm.paymentMode}
                        onValueChange={(value) => setPaymentForm({ ...paymentForm, paymentMode: value })}
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
                        value={paymentForm.referenceNumber}
                        onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                        placeholder="Transaction ID"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      placeholder="Payment notes..."
                      rows={2}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!paymentForm.installmentNumber || !paymentForm.amount}>
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
