import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { billsApi, sitesApi } from '@/lib/api'
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
import { Plus, Receipt, FileText, CreditCard, ChevronLeft, ChevronRight, Trash2, Edit, Check, Filter, Download, Upload, Eye, X, TrendingUp } from 'lucide-react'
import { InvestmentSelector } from '@/components/InvestmentSelector'

const BILL_TYPES = [
  { value: 'material', label: 'Material' },
  { value: 'service', label: 'Service' },
  { value: 'labor', label: 'Labor' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'utility', label: 'Utility' },
  { value: 'other', label: 'Other' },
]

const GST_RATES = [
  { value: 0, label: '0% (Exempt)' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18% (Standard)' },
  { value: 28, label: '28%' },
]

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'other', label: 'Other' },
]

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  credited: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function Bills() {
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  const [bills, setBills] = useState([])
  const [sites, setSites] = useState([])
  const [summary, setSummary] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [viewBill, setViewBill] = useState(null)
  const [vendorSuggestions, setVendorSuggestions] = useState([])
  const [uploadingReceipt, setUploadingReceipt] = useState(null)
  const [exporting, setExporting] = useState(false)

  const [filters, setFilters] = useState({
    siteId: '',
    status: '',
    billType: '',
  })

  const [form, setForm] = useState({
    siteId: '',
    linkedInvestment: '',
    vendorName: '',
    vendorGstNumber: '',
    invoiceNumber: '',
    billDate: new Date().toISOString().split('T')[0],
    totalAmount: '',
    baseAmount: '',
    gstAmount: '',
    gstRate: 18,
    description: '',
    billType: 'material',
    paymentMethod: '',
    paymentReference: '',
  })

  useEffect(() => {
    fetchSites()
  }, [])

  useEffect(() => {
    fetchData()
  }, [pagination.page, filters])

  const fetchSites = async () => {
    try {
      const [sitesRes, vendorsRes] = await Promise.all([
        sitesApi.getAll(),
        billsApi.getVendorSuggestions()
      ])
      setSites(sitesRes.data)
      setVendorSuggestions(vendorsRes.data || [])
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
        linkedInvestment: form.linkedInvestment || null,
        vendorName: form.vendorName,
        vendorGstNumber: form.vendorGstNumber,
        invoiceNumber: form.invoiceNumber,
        billDate: form.billDate,
        baseAmount: parseFloat(form.baseAmount),
        gstAmount: parseFloat(form.gstAmount) || 0,
        gstRate: parseInt(form.gstRate) || 18,
        description: form.description,
        billType: form.billType,
        paymentMethod: form.paymentMethod || null,
        paymentReference: form.paymentReference || null,
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
    const totalAmount = bill.totalAmount || (parseFloat(bill.baseAmount) + parseFloat(bill.gstAmount))
    setForm({
      siteId: bill.site?._id || '',
      linkedInvestment: bill.linkedInvestment?._id || '',
      vendorName: bill.vendorName,
      vendorGstNumber: bill.vendorGstNumber || '',
      invoiceNumber: bill.invoiceNumber || '',
      billDate: bill.billDate.split('T')[0],
      totalAmount: totalAmount.toString(),
      baseAmount: bill.baseAmount.toString(),
      gstAmount: bill.gstAmount.toString(),
      gstRate: bill.gstRate || 18,
      description: bill.description || '',
      billType: bill.billType,
      paymentMethod: bill.paymentMethod || '',
      paymentReference: bill.paymentReference || '',
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
      linkedInvestment: '',
      vendorName: '',
      vendorGstNumber: '',
      invoiceNumber: '',
      billDate: new Date().toISOString().split('T')[0],
      totalAmount: '',
      baseAmount: '',
      gstAmount: '',
      gstRate: 18,
      description: '',
      billType: 'material',
      paymentMethod: '',
      paymentReference: '',
    })
    setEditingId(null)
  }

  const handleGstRateChange = (rate) => {
    const totalAmount = parseFloat(form.totalAmount) || 0
    const baseAmount = totalAmount / (1 + rate / 100)
    const gstAmount = totalAmount - baseAmount
    setForm({
      ...form,
      gstRate: rate,
      baseAmount: baseAmount.toFixed(2),
      gstAmount: gstAmount.toFixed(2)
    })
  }

  const handleTotalAmountChange = (value) => {
    const totalAmount = parseFloat(value) || 0
    const baseAmount = totalAmount / (1 + form.gstRate / 100)
    const gstAmount = totalAmount - baseAmount
    setForm({
      ...form,
      totalAmount: value,
      baseAmount: baseAmount.toFixed(2),
      gstAmount: gstAmount.toFixed(2)
    })
  }

  const handleReceiptUpload = async (billId, file) => {
    try {
      setUploadingReceipt(billId)
      await billsApi.uploadReceipt(billId, file)
      toast({ title: 'Receipt uploaded successfully' })
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to upload receipt',
        variant: 'destructive',
      })
    } finally {
      setUploadingReceipt(null)
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      const response = await billsApi.exportCsv(params)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `bills-export-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast({ title: 'Bills exported successfully' })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export bills',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  const handleVendorSelect = (vendor) => {
    setForm({
      ...form,
      vendorName: vendor.name,
      vendorGstNumber: vendor.gstNumber || '',
    })
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
          <Button onClick={() => { resetForm(); setIsAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Bill
          </Button>
        </div>
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
              <TableHead>Receipt</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
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
                    <div className="flex flex-col gap-1">
                      <Badge className={STATUS_COLORS[bill.status]}>{bill.status}</Badge>
                      {bill.status === 'credited' && bill.fundAllocation && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Investment Created
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {bill.receiptPath ? (
                      <a
                        href={bill.receiptPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        View
                      </a>
                    ) : (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleReceiptUpload(bill._id, e.target.files[0])
                            }
                          }}
                          disabled={uploadingReceipt === bill._id}
                        />
                        <span className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                          {uploadingReceipt === bill._id ? (
                            <span className="animate-spin">⏳</span>
                          ) : (
                            <Upload className="h-3 w-3" />
                          )}
                          Upload
                        </span>
                      </label>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewBill(bill)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isAdmin && bill.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(bill._id, 'credited')}
                        >
                          Credit
                        </Button>
                      )}
                      {isAdmin && bill.status === 'credited' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(bill._id, 'paid')}
                        >
                          Mark Paid
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
              {vendorSuggestions.length > 0 && (
                <div className="space-y-2">
                  <Label>Quick Select Vendor</Label>
                  <Select onValueChange={(value) => {
                    const vendor = vendorSuggestions.find(v => v.name === value)
                    if (vendor) handleVendorSelect(vendor)
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select from previous vendors..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorSuggestions.map((vendor) => (
                        <SelectItem key={vendor.name} value={vendor.name}>
                          {vendor.name} {vendor.gstNumber && `(${vendor.gstNumber})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
              <InvestmentSelector
                value={form.linkedInvestment}
                onChange={(value) => setForm({ ...form, linkedInvestment: value })}
                requestedAmount={parseFloat(form.totalAmount || 0)}
                required={true}
                label="Investment"
              />
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Total Amount (Inc. GST) *</Label>
                  <Input
                    type="number"
                    value={form.totalAmount}
                    onChange={(e) => handleTotalAmountChange(e.target.value)}
                    placeholder="11800"
                    required
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>GST Rate</Label>
                  <Select
                    value={form.gstRate.toString()}
                    onValueChange={(value) => handleGstRateChange(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GST_RATES.map((rate) => (
                        <SelectItem key={rate.value} value={rate.value.toString()}>{rate.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Base Amount (Rs.)</Label>
                  <Input
                    type="number"
                    value={form.baseAmount}
                    readOnly
                    placeholder="10000"
                    className="bg-muted"
                  />
                </div>
              </div>
              {form.totalAmount && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Amount (Inc. GST)</p>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(parseFloat(form.totalAmount || 0))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Base Amount</p>
                      <p className="text-lg font-semibold">{formatCurrency(parseFloat(form.baseAmount || 0))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">GST ({form.gstRate}%)</p>
                      <p className="text-lg font-semibold">{formatCurrency(parseFloat(form.gstAmount || 0))}</p>
                    </div>
                  </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={form.paymentMethod}
                    onValueChange={(value) => setForm({ ...form, paymentMethod: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
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
                    value={form.paymentReference}
                    onChange={(e) => setForm({ ...form, paymentReference: e.target.value })}
                    placeholder="Cheque no. / UTR / Transaction ID"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">{editingId ? 'Update' : 'Add'} Bill</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bill Details View Dialog */}
      <Dialog open={!!viewBill} onOpenChange={(open) => !open && setViewBill(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Bill Details
              <Button variant="ghost" size="icon" onClick={() => setViewBill(null)}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {viewBill && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Vendor</p>
                  <p className="font-medium">{viewBill.vendorName}</p>
                  {viewBill.vendorGstNumber && (
                    <p className="text-xs text-muted-foreground">GST: {viewBill.vendorGstNumber}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Number</p>
                  <p className="font-medium">{viewBill.invoiceNumber || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Bill Date</p>
                  <p className="font-medium">{formatDate(viewBill.billDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Site</p>
                  <p className="font-medium">{viewBill.site?.name || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Base Amount</p>
                  <p className="font-medium">{formatCurrency(viewBill.baseAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">GST ({viewBill.gstRate || 18}%)</p>
                  <p className="font-medium">{formatCurrency(viewBill.gstAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-bold text-lg">{formatCurrency(viewBill.totalAmount)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={STATUS_COLORS[viewBill.status]}>{viewBill.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <Badge variant="outline">
                    {BILL_TYPES.find(t => t.value === viewBill.billType)?.label}
                  </Badge>
                </div>
              </div>
              {viewBill.paymentMethod && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="font-medium">
                      {PAYMENT_METHODS.find(m => m.value === viewBill.paymentMethod)?.label || viewBill.paymentMethod}
                    </p>
                  </div>
                  {viewBill.paymentReference && (
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Reference</p>
                      <p className="font-medium">{viewBill.paymentReference}</p>
                    </div>
                  )}
                </div>
              )}
              {viewBill.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{viewBill.description}</p>
                </div>
              )}
              {viewBill.receiptPath && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Receipt</p>
                  <a
                    href={viewBill.receiptPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    View Receipt Document
                  </a>
                </div>
              )}
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Created by {viewBill.createdBy?.name || 'Unknown'} on {formatDate(viewBill.createdAt)}
                </p>
                {viewBill.creditedDate && (
                  <p className="text-xs text-muted-foreground">
                    Credited on {formatDate(viewBill.creditedDate)}
                  </p>
                )}
                {viewBill.paidDate && (
                  <p className="text-xs text-muted-foreground">
                    Paid on {formatDate(viewBill.paidDate)}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
