import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { billsApi, sitesApi, fundsApi } from '@/lib/api'
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
import { Plus, Receipt, FileText, CreditCard, ChevronLeft, ChevronRight, Trash2, Edit, Check, Filter } from 'lucide-react'

const BILL_TYPES = [
  { value: 'material', label: 'Material' },
  { value: 'service', label: 'Service' },
  { value: 'labor', label: 'Labor' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'utility', label: 'Utility' },
  { value: 'other', label: 'Other' },
]

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  credited: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function Bills() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()

  const [bills, setBills] = useState([])
  const [sites, setSites] = useState([])
  const [fundAllocations, setFundAllocations] = useState([])
  const [summary, setSummary] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [filters, setFilters] = useState({
    siteId: '',
    status: '',
    billType: '',
  })

  const [form, setForm] = useState({
    siteId: '',
    fundAllocationId: '',
    vendorName: '',
    vendorGstNumber: '',
    invoiceNumber: '',
    billDate: new Date().toISOString().split('T')[0],
    baseAmount: '',
    gstAmount: '',
    description: '',
    billType: 'material',
  })

  useEffect(() => {
    fetchSites()
  }, [])

  useEffect(() => {
    fetchData()
  }, [pagination.page, filters])

  const fetchSites = async () => {
    try {
      const [sitesRes, fundsRes] = await Promise.all([
        sitesApi.getAll(),
        fundsApi.getAll({ status: 'disbursed' })
      ])
      setSites(sitesRes.data)
      setFundAllocations(fundsRes.data?.allocations || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.page,
        limit: 20,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      }
      const [billsRes, summaryRes] = await Promise.all([
        billsApi.getAll(params),
        billsApi.getSummary(),
      ])
      setBills(billsRes.data.bills)
      setPagination(billsRes.data.pagination)
      setSummary(summaryRes.data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch bills',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const billData = {
        siteId: form.siteId || null,
        fundAllocationId: form.fundAllocationId || null,
        vendorName: form.vendorName,
        vendorGstNumber: form.vendorGstNumber,
        invoiceNumber: form.invoiceNumber,
        billDate: form.billDate,
        baseAmount: parseFloat(form.baseAmount),
        gstAmount: parseFloat(form.gstAmount) || 0,
        description: form.description,
        billType: form.billType,
      }

      if (editingId) {
        await billsApi.update(editingId, billData)
        toast({ title: 'Bill updated successfully' })
      } else {
        await billsApi.create(billData)
        toast({ title: 'Bill added successfully' })
      }
      setIsAddOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save bill',
        variant: 'destructive',
      })
    }
  }

  const handleStatusUpdate = async (id, status) => {
    try {
      await billsApi.updateStatus(id, status)
      toast({ title: `Bill marked as ${status}` })
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update status',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (bill) => {
    setForm({
      siteId: bill.site?._id || '',
      vendorName: bill.vendorName,
      vendorGstNumber: bill.vendorGstNumber || '',
      invoiceNumber: bill.invoiceNumber || '',
      billDate: bill.billDate.split('T')[0],
      baseAmount: bill.baseAmount.toString(),
      gstAmount: bill.gstAmount.toString(),
      description: bill.description || '',
      billType: bill.billType,
    })
    setEditingId(bill._id)
    setIsAddOpen(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this bill?')) return
    try {
      await billsApi.delete(id)
      toast({ title: 'Bill deleted' })
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete bill',
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setForm({
      siteId: '',
      fundAllocationId: '',
      vendorName: '',
      vendorGstNumber: '',
      invoiceNumber: '',
      billDate: new Date().toISOString().split('T')[0],
      baseAmount: '',
      gstAmount: '',
      description: '',
      billType: 'material',
    })
    setEditingId(null)
  }

  const clearFilters = () => {
    setFilters({ siteId: '', status: '', billType: '' })
    setPagination({ ...pagination, page: 1 })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">GST / Government Bills</h1>
          <p className="text-muted-foreground">
            Track and manage all bills with GST details
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Bill
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totals.totalAmount)}</div>
              <p className="text-xs text-muted-foreground">{summary.totals.count} bills</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total GST</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totals.totalGstAmount)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <CreditCard className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(summary.statusSummary.find(s => s._id === 'pending')?.totalAmount || 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credited</CardTitle>
              <Check className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.statusSummary.find(s => s._id === 'credited')?.totalAmount || 0)}
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
          <div className="grid gap-4 md:grid-cols-4">
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="credited">Credited</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={filters.billType}
                onValueChange={(value) => {
                  setFilters({ ...filters, billType: value === 'all' ? '' : value })
                  setPagination({ ...pagination, page: 1 })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {BILL_TYPES.map((type) => (
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

      {/* Bills Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bills</CardTitle>
          <CardDescription>Showing {bills.length} of {pagination.total} entries</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">GST</TableHead>
              <TableHead className="text-right">Total</TableHead>
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
            ) : bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No bills found
                </TableCell>
              </TableRow>
            ) : (
              bills.map((bill) => (
                <TableRow key={bill._id}>
                  <TableCell>{formatDate(bill.billDate)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{bill.vendorName}</p>
                      {bill.vendorGstNumber && (
                        <p className="text-xs text-muted-foreground">GST: {bill.vendorGstNumber}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{bill.invoiceNumber || '-'}</TableCell>
                  <TableCell>{bill.site?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {BILL_TYPES.find(t => t.value === bill.billType)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(bill.baseAmount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(bill.gstAmount)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(bill.totalAmount)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[bill.status]}>{bill.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {isAdmin && bill.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(bill._id, 'credited')}
                        >
                          Credit
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(bill)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(bill._id)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit' : 'Add'} Bill</DialogTitle>
              <DialogDescription>Record a bill with GST details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor Name *</Label>
                  <Input
                    value={form.vendorName}
                    onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                    placeholder="ABC Suppliers"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vendor GST Number</Label>
                  <Input
                    value={form.vendorGstNumber}
                    onChange={(e) => setForm({ ...form, vendorGstNumber: e.target.value })}
                    placeholder="29ABCDE1234F1Z5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Number</Label>
                  <Input
                    value={form.invoiceNumber}
                    onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                    placeholder="INV-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bill Date *</Label>
                  <Input
                    type="date"
                    value={form.billDate}
                    onChange={(e) => setForm({ ...form, billDate: e.target.value })}
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
                      <SelectValue placeholder="Select site" />
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
                  <Label>Bill Type</Label>
                  <Select
                    value={form.billType}
                    onValueChange={(value) => setForm({ ...form, billType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILL_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
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
                  <p className="text-xs text-muted-foreground">Link this bill to a fund allocation for tracking</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base Amount (Rs.) *</Label>
                  <Input
                    type="number"
                    value={form.baseAmount}
                    onChange={(e) => setForm({ ...form, baseAmount: e.target.value })}
                    placeholder="10000"
                    required
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>GST Amount (Rs.)</Label>
                  <Input
                    type="number"
                    value={form.gstAmount}
                    onChange={(e) => setForm({ ...form, gstAmount: e.target.value })}
                    placeholder="1800"
                    min="0"
                  />
                </div>
              </div>
              {form.baseAmount && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Total Amount: <span className="font-bold text-foreground">
                      {formatCurrency(parseFloat(form.baseAmount || 0) + parseFloat(form.gstAmount || 0))}
                    </span>
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Steel rods - 2 tons"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">{editingId ? 'Update' : 'Add'} Bill</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
