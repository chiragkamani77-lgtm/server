import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { billsApi, sitesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useBulkSelect } from '@/hooks/use-bulk-select'
import { useLoading } from '@/hooks/use-loading'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  PageLayout, PageHeader, SummaryBanner, SearchFilterBar,
  ListItem, ActionBtn, PagePagination, EmptyState,
} from '@/components/page'
import {
  Plus, FileText, Trash2, Edit, Check, Download, Upload, Eye, IndianRupee,
} from 'lucide-react'
import { FundAllocationSelector } from '@/components/FundAllocationSelector'

const GST_RATES = [
  { value: 0, label: '0% (Exempt)' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18% (Standard)' },
  { value: 28, label: '28%' },
]

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  credited: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function Bills() {
  const { isAdmin, isEngineer } = useAuth()
  const canManage = isAdmin || isEngineer
  const { toast } = useToast()
  const loadingStates = useLoading()

  const [bills, setBills] = useState([])
  const [summary, setSummary] = useState(null)
  const [sites, setSites] = useState([])
  const [vendorSuggestions, setVendorSuggestions] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [viewBill, setViewBill] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', startDate: '', endDate: '' })

  const [form, setForm] = useState({
    siteId: '',
    vendorName: '',
    invoiceNumber: '',
    billDate: new Date().toISOString().split('T')[0],
    totalAmount: '',
    baseAmount: '',
    gstAmount: '',
    gstRate: 18,
    description: '',
  })

  const bulkSelect = useBulkSelect(
    bills,
    billsApi.bulkDelete,
    (count) => { toast({ title: `${count} bill(s) deleted` }); fetchData() },
    (error) => { toast({ title: 'Error', description: error.response?.data?.message || 'Failed to delete', variant: 'destructive' }) }
  )

  useEffect(() => { fetchInitial() }, [])
  useEffect(() => { fetchData() }, [pagination.page, filters])

  const fetchInitial = async () => {
    try {
      const [vendorsRes, sitesRes] = await Promise.all([
        billsApi.getVendorSuggestions(),
        sitesApi.getAll(),
      ])
      setVendorSuggestions(vendorsRes.data || [])
      setSites(sitesRes.data || [])
    } catch (e) { console.error(e) }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.page,
        limit: 20,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      }
      const [billsRes, summaryRes] = await Promise.all([
        billsApi.getAll(params),
        billsApi.getSummary(),
      ])
      setBills(billsRes.data.bills)
      setPagination(billsRes.data.pagination)
      setSummary(summaryRes.data)
    } catch {
      toast({ title: 'Failed to fetch bills', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    await loadingStates.withCreating(async () => {
      const billData = {
        siteId: form.siteId || null,
        vendorName: form.vendorName,
        invoiceNumber: form.invoiceNumber,
        billDate: form.billDate,
        baseAmount: parseFloat(form.baseAmount),
        gstAmount: parseFloat(form.gstAmount) || 0,
        gstRate: parseInt(form.gstRate) || 18,
        description: form.description,
        billType: 'material',
      }
      try {
        if (editingId) {
          await billsApi.update(editingId, billData)
          toast({ title: 'Bill updated' })
        } else {
          await billsApi.create(billData)
          toast({ title: 'Bill added' })
        }
        setSheetOpen(false)
        resetForm()
        fetchData()
      } catch (error) {
        toast({ title: 'Error', description: error.response?.data?.message || 'Failed to save', variant: 'destructive' })
      }
    })
  }

  const handleStatusUpdate = async (id, status) => {
    try {
      await billsApi.updateStatus(id, status)
      toast({ title: `Bill marked as ${status}` })
      fetchData()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to update', variant: 'destructive' })
    }
  }

  const handleEdit = (bill) => {
    const totalAmount = bill.totalAmount || (parseFloat(bill.baseAmount) + parseFloat(bill.gstAmount))
    setForm({
      siteId: bill.site?._id || '',
      vendorName: bill.vendorName,
      invoiceNumber: bill.invoiceNumber || '',
      billDate: bill.billDate.split('T')[0],
      totalAmount: totalAmount.toString(),
      baseAmount: bill.baseAmount.toString(),
      gstAmount: bill.gstAmount.toString(),
      gstRate: bill.gstRate || 18,
      description: bill.description || '',
    })
    setEditingId(bill._id)
    setSheetOpen(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this bill?')) return
    try {
      await billsApi.delete(id)
      toast({ title: 'Bill deleted' })
      fetchData()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to delete', variant: 'destructive' })
    }
  }

  const resetForm = () => {
    setForm({
      siteId: '',
      vendorName: '',
      invoiceNumber: '',
      billDate: new Date().toISOString().split('T')[0],
      totalAmount: '',
      baseAmount: '',
      gstAmount: '',
      gstRate: 18,
      description: '',
    })
    setEditingId(null)
  }

  const handleGstRateChange = (rate) => {
    const total = parseFloat(form.totalAmount) || 0
    const base = total / (1 + rate / 100)
    const gst = total - base
    setForm({ ...form, gstRate: rate, baseAmount: base.toFixed(2), gstAmount: gst.toFixed(2) })
  }

  const handleTotalAmountChange = (value) => {
    const total = parseFloat(value) || 0
    const base = total / (1 + form.gstRate / 100)
    const gst = total - base
    setForm({ ...form, totalAmount: value, baseAmount: base.toFixed(2), gstAmount: gst.toFixed(2) })
  }

  const handleReceiptUpload = async (billId, file) => {
    setUploadingReceipt(billId)
    try {
      await billsApi.uploadReceipt(billId, file)
      toast({ title: 'Receipt uploaded' })
      fetchData()
    } catch {
      toast({ title: 'Failed to upload receipt', variant: 'destructive' })
    } finally {
      setUploadingReceipt(null)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      const response = await billsApi.exportCsv(params)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.setAttribute('download', `bills-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast({ title: 'Exported' })
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const filteredBills = bills.filter((b) => {
    if (!search) return true
    const q = search.toLowerCase()
    return b.vendorName?.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q) || b.invoiceNumber?.toLowerCase().includes(q)
  })

  const totalAmount = summary?.totals?.totalAmount || 0
  const totalGst = summary?.totals?.totalGstAmount || 0

  return (
    <PageLayout>
      <PageHeader title="GST Bills" subtitle={`${pagination.total} entries`}>
        {bulkSelect.selectedCount > 0 && (
          <Button size="sm" variant="destructive" onClick={bulkSelect.deleteSelected} disabled={bulkSelect.deleting}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete {bulkSelect.selectedCount}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4 mr-1" />
          {exporting ? '...' : 'Export'}
        </Button>
        <Button size="sm" onClick={() => { resetForm(); setSheetOpen(true) }} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="h-4 w-4 mr-1" />
          Add Bill
        </Button>
      </PageHeader>

      <SummaryBanner
        color="indigo"
        icon={<IndianRupee className="h-8 w-8" />}
        items={[
          { label: 'Total Amount', value: formatCurrency(totalAmount) },
          { label: 'Total GST', value: formatCurrency(totalGst) },
        ]}
      />

      <SearchFilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search supplier, invoice no..."
      >
        <Select value={filters.status || 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? '' : v }))}>
          <SelectTrigger className="h-9 w-32 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="credited">Credited</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </SearchFilterBar>

      <div className="flex-1">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : filteredBills.length === 0 ? (
          <EmptyState
            message="No bills found"
            action={
              <Button variant="outline" size="sm" onClick={() => { resetForm(); setSheetOpen(true) }}>
                <Plus className="h-4 w-4 mr-1" /> Add First Bill
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredBills.map((bill) => (
              <ListItem
                key={bill._id}
                avatar={(bill.vendorName || 'B').charAt(0)}
                avatarColor="indigo"
                title={bill.vendorName}
                subtitle={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-400">{formatDate(bill.billDate)}</span>
                    {bill.invoiceNumber && <span className="text-xs text-gray-400">• {bill.invoiceNumber}</span>}
                    {bill.description && <span className="text-xs text-gray-400 truncate max-w-[120px]">• {bill.description}</span>}
                    <span className="text-xs text-gray-400">• GST {formatCurrency(bill.gstAmount)}</span>
                  </div>
                }
                amount={formatCurrency(bill.totalAmount)}
                badge={{ label: bill.status, className: STATUS_COLORS[bill.status] || '' }}
                selected={bulkSelect.isSelected(bill._id)}
                onSelect={() => bulkSelect.toggleSelect(bill._id)}
                actions={
                  <>
                    <ActionBtn onClick={() => setViewBill(bill)} title="View Details" icon={Eye} hoverClass="hover:text-indigo-600 hover:bg-indigo-50" />
                    <label className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer" title="Upload Receipt">
                      <input type="file" className="hidden" accept="image/*,.pdf"
                        onChange={(e) => e.target.files?.[0] && handleReceiptUpload(bill._id, e.target.files[0])}
                        disabled={uploadingReceipt === bill._id} />
                      {uploadingReceipt === bill._id
                        ? <span className="text-[10px] text-gray-500">...</span>
                        : <Upload className="h-4 w-4" />}
                    </label>
                    {canManage && bill.status === 'pending' && (
                      <ActionBtn
                        onClick={() => handleStatusUpdate(bill._id, 'credited')}
                        title="Mark Credited"
                        icon={Check}
                        hoverClass="hover:text-blue-600 hover:bg-blue-50"
                      />
                    )}
                    <ActionBtn onClick={() => handleEdit(bill)} title="Edit" icon={Edit} hoverClass="hover:text-indigo-600 hover:bg-indigo-50" />
                    {canManage && (
                      <ActionBtn
                        onClick={() => handleDelete(bill._id)}
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

      {/* Add / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) resetForm() }}>
        <SheetContent title={editingId ? 'Edit Bill' : 'Add New Bill'}>
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {/* Amount first */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Total Amount ₹ *</Label>
                <Input type="number" value={form.totalAmount}
                  onChange={(e) => handleTotalAmountChange(e.target.value)}
                  placeholder="e.g. 11800" required min="0" autoFocus />
              </div>
              <div className="space-y-1">
                <Label>GST Rate</Label>
                <Select value={form.gstRate.toString()} onValueChange={(v) => handleGstRateChange(parseInt(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map((r) => (
                      <SelectItem key={r.value} value={r.value.toString()}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* GST breakdown — shown as soon as amount is entered */}
            {form.totalAmount && (
              <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Base Amount</p>
                  <p className="font-semibold">{formatCurrency(parseFloat(form.baseAmount || 0))}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">GST ({form.gstRate}%)</p>
                  <p className="font-semibold">{formatCurrency(parseFloat(form.gstAmount || 0))}</p>
                </div>
              </div>
            )}

            {/* Wallet balance — auto, no dropdown */}
            {form.totalAmount && (
              <FundAllocationSelector requestedAmount={parseFloat(form.totalAmount || 0)} />
            )}

            {/* Remaining fields visible after amount entered */}
            {form.totalAmount && (
              <>
                {/* Vendor quick select */}
                {vendorSuggestions.length > 0 && !editingId && (
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Recent Suppliers</Label>
                    <Select onValueChange={(v) => setForm((f) => ({ ...f, vendorName: v }))}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Pick a previous supplier..." />
                      </SelectTrigger>
                      <SelectContent>
                        {vendorSuggestions.map((v) => (
                          <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Supplier / Vendor Name *</Label>
                  <Input value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                    placeholder="e.g. ABC Steel Traders" required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Invoice Number</Label>
                    <Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                      placeholder="INV-001" />
                  </div>
                  <div className="space-y-1">
                    <Label>Bill Date *</Label>
                    <Input type="date" value={form.billDate}
                      onChange={(e) => setForm({ ...form, billDate: e.target.value })} required />
                  </div>
                </div>

                {isAdmin && sites.length > 0 && (
                  <div className="space-y-1">
                    <Label>Site (Optional)</Label>
                    <Select
                      value={form.siteId || 'none'}
                      onValueChange={(v) => setForm({ ...form, siteId: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select site" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No specific site</SelectItem>
                        {sites.map((s) => (
                          <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1">
                  <Label>What is this bill for?</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="e.g. Steel rods - 2 tons for Block A" rows={2} />
                </div>
              </>
            )}

            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 text-base" disabled={loadingStates.creating || !form.totalAmount}>
              {loadingStates.creating ? 'Saving...' : editingId ? 'Update Bill' : 'Add Bill'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* View Bill Sheet */}
      <Sheet open={!!viewBill} onOpenChange={(open) => !open && setViewBill(null)}>
        <SheetContent title="Bill Details">
          {viewBill && (
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center">
                  <span className="text-indigo-600 text-lg font-bold">{viewBill.vendorName?.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{viewBill.vendorName}</p>
                  <p className="text-xs text-gray-400">{viewBill.invoiceNumber || 'No invoice no.'}</p>
                </div>
              </div>

              <div className="rounded-xl bg-indigo-600 p-4 text-white">
                <p className="text-xs text-indigo-200">Total Amount</p>
                <p className="text-3xl font-bold">{formatCurrency(viewBill.totalAmount)}</p>
                <p className="text-xs text-indigo-200 mt-1">
                  Base {formatCurrency(viewBill.baseAmount)} + GST {formatCurrency(viewBill.gstAmount)} ({viewBill.gstRate || 18}%)
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-500">Date</span>
                  <span className="text-sm font-medium">{formatDate(viewBill.billDate)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-500">Status</span>
                  <Badge className={`${STATUS_COLORS[viewBill.status] || ''}`}>{viewBill.status}</Badge>
                </div>
                {viewBill.fundAllocation && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-500">Linked Fund</span>
                    <span className="text-sm font-medium">{viewBill.fundAllocation.name || '-'}</span>
                  </div>
                )}
                {viewBill.description && (
                  <div className="py-2">
                    <span className="text-sm text-gray-500">Description</span>
                    <p className="text-sm font-medium mt-1">{viewBill.description}</p>
                  </div>
                )}
              </div>

              {viewBill.receiptPath && (
                <a href={viewBill.receiptPath} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-indigo-600 text-sm font-medium">
                  <FileText className="h-4 w-4" /> View Receipt
                </a>
              )}

              {canManage && viewBill.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700 h-11" size="sm"
                    onClick={() => { handleStatusUpdate(viewBill._id, 'credited'); setViewBill(null) }}>
                    Mark Credited
                  </Button>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700 h-11" size="sm"
                    onClick={() => { handleStatusUpdate(viewBill._id, 'paid'); setViewBill(null) }}>
                    Mark Paid
                  </Button>
                </div>
              )}

              <p className="text-xs text-gray-400">
                Added by {viewBill.createdBy?.name || 'Unknown'} · {formatDate(viewBill.createdAt)}
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PageLayout>
  )
}
