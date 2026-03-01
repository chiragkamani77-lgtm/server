import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { ledgerApi, sitesApi, usersApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'
import { useBulkSelect } from '@/hooks/use-bulk-select'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  PageLayout, PageHeader, SummaryBanner, SearchFilterBar,
  ListItem, ActionBtn, PagePagination, EmptyState,
} from '@/components/page'
import { Plus, Wallet, Edit, Trash2 } from 'lucide-react'

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'other', label: 'Other' },
]

export default function WorkerLedger() {
  const { isAdmin, isSupervisor } = useAuth()
  const { toast } = useToast()

  const [entries, setEntries] = useState([])
  const [sites, setSites] = useState([])
  const [workers, setWorkers] = useState([])
  const [selectedWorkerPendingSalary, setSelectedWorkerPendingSalary] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [isPaySalaryOpen, setIsPaySalaryOpen] = useState(false)
  const [isBulkPayOpen, setIsBulkPayOpen] = useState(false)
  const [bulkPendingWorkers, setBulkPendingWorkers] = useState([])
  const [selectedWorkers, setSelectedWorkers] = useState([])
  const [bulkSummary, setBulkSummary] = useState(null)

  const [filters, setFilters] = useState({
    workerId: '', siteId: '', type: '', startDate: '', endDate: '',
  })

  const bulkSelect = useBulkSelect(
    entries,
    ledgerApi.bulkDelete,
    (count) => { toast({ title: `${count} entry(ies) deleted` }); fetchEntries() },
    (error) => { toast({ title: 'Error', description: error.response?.data?.message || 'Failed', variant: 'destructive' }) }
  )

  const [form, setForm] = useState({
    workerId: '', siteId: '',
    type: 'credit', amount: '',
    description: '', transactionDate: new Date().toISOString().split('T')[0],
    referenceNumber: '', paymentMode: 'cash',
  })

  const [paySalaryForm, setPaySalaryForm] = useState({
    amount: '', deductAdvances: true,
    partialPayment: false, paymentMode: 'cash', referenceNumber: '', notes: '',
  })

  const [bulkPayForm, setBulkPayForm] = useState({
    paymentMode: 'cash', referenceNumber: '', notes: '',
  })

  useEffect(() => { fetchInitialData(); fetchOverallSummary() }, [])
  useEffect(() => { fetchEntries() }, [pagination.page, filters])
  useEffect(() => {
    if (filters.workerId) {
      fetchWorkerPendingSalary(filters.workerId)
    } else {
      setSelectedWorkerPendingSalary(null)
    }
  }, [filters.workerId])

  const fetchInitialData = async () => {
    try {
      const [sitesRes, workersRes] = await Promise.all([
        sitesApi.getAll(),
        usersApi.getChildren(),
      ])
      setSites(sitesRes.data)
      setWorkers(workersRes.data)
    } catch (e) { console.error(e) }
  }

  const fetchEntries = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.page,
        limit: 50,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      }
      const { data } = await ledgerApi.getAll(params)
      setEntries(data.entries)
      setPagination(data.pagination)
    } catch {
      toast({ title: 'Failed to load entries', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const fetchWorkerPendingSalary = async (workerId) => {
    try {
      const { data } = await ledgerApi.getPendingSalary(workerId)
      setSelectedWorkerPendingSalary(data)
    } catch { setSelectedWorkerPendingSalary(null) }
  }

  const fetchOverallSummary = async () => {
    try {
      const { data } = await ledgerApi.getAllPendingSalaries()
      setBulkSummary(data.summary || null)
    } catch (e) { console.error(e) }
  }

  const isEntryEditable = () => isAdmin

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const ledgerData = {
        workerId: form.workerId,
        siteId: form.siteId || null,
        type: form.type,
        amount: parseFloat(form.amount),
        description: form.description,
        transactionDate: form.transactionDate,
        referenceNumber: form.referenceNumber,
        paymentMode: form.paymentMode,
      }
      if (editingId) {
        await ledgerApi.update(editingId, ledgerData)
        toast({ title: 'Entry updated' })
      } else {
        await ledgerApi.create(ledgerData)
        toast({ title: 'Entry added' })
      }
      setSheetOpen(false)
      resetForm()
      fetchEntries()
      if (filters.workerId === form.workerId) fetchWorkerPendingSalary(form.workerId)
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to save', variant: 'destructive' })
    }
  }

  const handleEdit = (entry) => {
    if (!isEntryEditable()) {
      toast({ title: 'Cannot edit this entry', variant: 'destructive' })
      return
    }
    setForm({
      workerId: entry.worker?._id || '',
      siteId: entry.site?._id || '',
      type: entry.type,
      amount: entry.amount.toString(),
      description: entry.description || '',
      transactionDate: entry.transactionDate.split('T')[0],
      referenceNumber: entry.referenceNumber || '',
      paymentMode: entry.paymentMode || 'cash',
    })
    setEditingId(entry._id)
    setSheetOpen(true)
  }

  const handleDelete = async () => {
    try {
      await ledgerApi.delete(deleteId)
      toast({ title: 'Entry deleted' })
      setDeleteId(null)
      fetchEntries()
      if (filters.workerId) fetchWorkerPendingSalary(filters.workerId)
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed', variant: 'destructive' })
    }
  }

  const resetForm = () => {
    setForm({ workerId: '', siteId: '', type: 'credit', amount: '', description: '', transactionDate: new Date().toISOString().split('T')[0], referenceNumber: '', paymentMode: 'cash' })
    setEditingId(null)
  }

  const handlePaySalary = async (e) => {
    e.preventDefault()
    if (!filters.workerId) return
    try {
      await ledgerApi.paySalary({
        workerId: filters.workerId,
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
      fetchWorkerPendingSalary(filters.workerId)
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to pay salary', variant: 'destructive' })
    }
  }

  const resetPaySalaryForm = () => {
    setPaySalaryForm({ amount: '', deductAdvances: true, partialPayment: false, paymentMode: 'cash', referenceNumber: '', notes: '' })
  }

  const openPaySalaryDialog = () => {
    if (!selectedWorkerPendingSalary) return
    const netPayable = selectedWorkerPendingSalary.netPayable || 0
    setPaySalaryForm({ ...paySalaryForm, amount: netPayable > 0 ? netPayable.toString() : '', deductAdvances: true, partialPayment: false })
    setIsPaySalaryOpen(true)
  }

  const fetchAllPendingSalaries = async () => {
    try {
      const { data } = await ledgerApi.getAllPendingSalaries()
      setBulkPendingWorkers(data.workers || [])
      setBulkSummary(data.summary || null)
    } catch {
      toast({ title: 'Failed to fetch pending salaries', variant: 'destructive' })
    }
  }

  const openBulkPayDialog = async () => {
    await fetchAllPendingSalaries()
    setIsBulkPayOpen(true)
  }

  const toggleWorkerSelection = (workerId) => {
    setSelectedWorkers(prev => prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId])
  }

  const getSelectedTotals = () => {
    const selected = bulkPendingWorkers.filter(w => selectedWorkers.includes(w.worker._id))
    return {
      count: selected.length,
      totalPending: selected.reduce((s, w) => s + w.totalPending, 0),
      totalAdvances: selected.reduce((s, w) => s + w.totalAdvances, 0),
      totalNetPayable: selected.reduce((s, w) => s + Math.max(w.netPayable, 0), 0),
    }
  }

  const handleBulkPaySalary = async (e) => {
    e.preventDefault()
    if (selectedWorkers.length === 0) {
      toast({ title: 'Please select at least one worker', variant: 'destructive' })
      return
    }
    try {
      const { data } = await ledgerApi.bulkPaySalary({
        workerIds: selectedWorkers,
        paymentMode: bulkPayForm.paymentMode,
        referenceNumber: bulkPayForm.referenceNumber,
        notes: bulkPayForm.notes,
      })
      toast({ title: 'Bulk payment done', description: data.message })
      setIsBulkPayOpen(false)
      setSelectedWorkers([])
      setBulkPayForm({ paymentMode: 'cash', referenceNumber: '', notes: '' })
      fetchEntries()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed', variant: 'destructive' })
    }
  }

  const totalCredits = entries.filter(e => e.type === 'credit').reduce((s, e) => s + e.amount, 0)
  const totalDebits = entries.filter(e => e.type === 'debit').reduce((s, e) => s + e.amount, 0)

  return (
    <PageLayout>
      <PageHeader title="Worker Ledger" subtitle={`${pagination.total} entries`}>
        {bulkSelect.selectedCount > 0 && (
          <Button size="sm" variant="destructive" onClick={bulkSelect.deleteSelected} disabled={bulkSelect.deleting}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete {bulkSelect.selectedCount}
          </Button>
        )}
        {(isAdmin || isSupervisor) && (
          <>
            <Button size="sm" variant="outline" onClick={openBulkPayDialog}>
              <Wallet className="h-4 w-4 mr-1" />
              Bulk Pay
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setSheetOpen(true) }} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Plus className="h-4 w-4 mr-1" />
              Add Entry
            </Button>
          </>
        )}
      </PageHeader>

      <SummaryBanner
        color="slate"
        icon={<Wallet className="h-8 w-8" />}
        items={[
          { label: 'Workers Pending', value: String(bulkSummary?.totalWorkers || 0) },
          { label: 'Total Pending', value: formatCurrency(bulkSummary?.totalPending || 0) },
          { label: 'Net Payable', value: formatCurrency(bulkSummary?.totalNetPayable || 0) },
        ]}
      />

      {/* Worker pending salary card (shows when a worker is filtered) */}
      {selectedWorkerPendingSalary && selectedWorkerPendingSalary.totalPending > 0 && (
        <div className="mx-4 mt-3 rounded-xl bg-orange-50 border border-orange-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-orange-900">{selectedWorkerPendingSalary.worker.name} — Pending Salary</p>
              <p className="text-xs text-orange-600">{selectedWorkerPendingSalary.attendanceCount || 0} attendance records</p>
            </div>
            {(isAdmin || isSupervisor) && (
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={openPaySalaryDialog}>
                <Wallet className="h-4 w-4 mr-1" /> Pay Salary
              </Button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white rounded-lg p-2">
              <p className="text-xs text-gray-500">Pending</p>
              <p className="font-bold text-orange-600">{formatCurrency(selectedWorkerPendingSalary.totalPending)}</p>
            </div>
            <div className="bg-white rounded-lg p-2">
              <p className="text-xs text-gray-500">Advances</p>
              <p className="font-bold text-red-600">{formatCurrency(selectedWorkerPendingSalary.totalAdvances)}</p>
            </div>
            <div className="bg-white rounded-lg p-2">
              <p className="text-xs text-gray-500">Net Payable</p>
              <p className="font-bold text-green-600">{formatCurrency(selectedWorkerPendingSalary.netPayable)}</p>
            </div>
          </div>
        </div>
      )}

      <SearchFilterBar>
        <Select value={filters.workerId || 'all'} onValueChange={(v) => { setFilters(f => ({ ...f, workerId: v === 'all' ? '' : v })); setPagination(p => ({ ...p, page: 1 })) }}>
          <SelectTrigger className="h-9 w-32 text-sm"><SelectValue placeholder="All Workers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Workers</SelectItem>
            {workers.map(w => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.type || 'all'} onValueChange={(v) => { setFilters(f => ({ ...f, type: v === 'all' ? '' : v })); setPagination(p => ({ ...p, page: 1 })) }}>
          <SelectTrigger className="h-9 w-28 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="credit">💚 Credit</SelectItem>
            <SelectItem value="debit">🔴 Debit</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" className="h-9 text-sm w-36" value={filters.startDate}
          onChange={(e) => { setFilters(f => ({ ...f, startDate: e.target.value })); setPagination(p => ({ ...p, page: 1 })) }} />
        {(filters.workerId || filters.type || filters.startDate) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ workerId: '', siteId: '', type: '', startDate: '', endDate: '' })}>Clear</Button>
        )}
      </SearchFilterBar>

      <div className="flex-1">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            message="No ledger entries found"
            icon={<Wallet className="h-12 w-12" />}
            action={(isAdmin || isSupervisor) && (
              <Button variant="outline" size="sm" onClick={() => { resetForm(); setSheetOpen(true) }}>
                <Plus className="h-4 w-4 mr-1" /> Add First Entry
              </Button>
            )}
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <ListItem
                key={entry._id}
                avatar={entry.worker?.name || 'W'}
                avatarColor={entry.type === 'credit' ? 'green' : 'amber'}
                title={entry.worker?.name || 'Unknown'}
                subtitle={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-400">{formatDate(entry.transactionDate)}</span>
                    {entry.category && entry.category !== 'other' && <span className="text-xs text-gray-400">• {entry.category}</span>}
                    {entry.site?.name && <span className="text-xs text-gray-400">• {entry.site.name}</span>}
                    {entry.paymentMode && <span className="text-xs text-gray-400">• {PAYMENT_MODES.find(m => m.value === entry.paymentMode)?.label}</span>}
                    {entry.description && <span className="text-xs text-gray-400 truncate max-w-[100px]">• {entry.description}</span>}
                  </div>
                }
                amount={`${entry.type === 'credit' ? '+' : '-'}${formatCurrency(entry.amount)}`}
                amountClass={entry.type === 'credit' ? 'text-green-600' : 'text-red-600'}
                badge={{
                  label: entry.type === 'credit' ? '↓ Paid' : '↑ Debit',
                  className: entry.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                }}
                selected={bulkSelect.isSelected(entry._id)}
                onSelect={() => bulkSelect.toggleSelect(entry._id)}
                actions={
                  isEntryEditable() && (
                    <>
                      <ActionBtn onClick={() => handleEdit(entry)} title="Edit" icon={Edit} />
                      <ActionBtn
                        onClick={() => setDeleteId(entry._id)}
                        title="Delete"
                        icon={Trash2}
                        hoverClass="hover:text-red-600 hover:bg-red-50"
                      />
                    </>
                  )
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
        onChange={(page) => setPagination(p => ({ ...p, page }))}
      />

      {/* Add / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) resetForm() }}>
        <SheetContent title={editingId ? 'Edit Entry' : 'Add Ledger Entry'}>
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {/* Amount — shown first */}
            <div className="space-y-1">
              <Label>Amount (₹) *</Label>
              <Input type="number" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="5000" required min="0" autoFocus />
            </div>

            {parseFloat(form.amount) > 0 && (
              <>
                <div className="space-y-1">
                  <Label>Worker *</Label>
                  <Select value={form.workerId} onValueChange={(v) => {
                    const workerSites = sites.filter(s => s.assignedUsers?.some(uid => uid === v))
                    setForm({ ...form, workerId: v, siteId: workerSites[0]?._id || '' })
                  }} required>
                    <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                    <SelectContent>
                      {workers.map(w => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Date *</Label>
                    <Input type="date" value={form.transactionDate}
                      onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label>How Paid</Label>
                    <Select value={form.paymentMode} onValueChange={(v) => setForm({ ...form, paymentMode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Reference (UTR / Cheque No.)</Label>
                  <Input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} placeholder="Optional" />
                </div>

                <div className="space-y-1">
                  <Label>Note / Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Weekly salary payment..." rows={2} />
                </div>
              </>
            )}

            <Button type="submit" disabled={!parseFloat(form.amount) || !form.workerId} className="w-full h-11 text-base bg-amber-600 hover:bg-amber-700">
              {editingId ? 'Update Entry' : 'Add Entry'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Pay Salary Dialog */}
      <Dialog open={isPaySalaryOpen} onOpenChange={setIsPaySalaryOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handlePaySalary}>
            <DialogHeader>
              <DialogTitle>Pay Salary</DialogTitle>
              <DialogDescription>
                {selectedWorkerPendingSalary && `Pay pending salary to ${selectedWorkerPendingSalary.worker.name}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedWorkerPendingSalary && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Pending:</span>
                    <span className="font-bold text-orange-600">{formatCurrency(selectedWorkerPendingSalary.totalPending)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Advances:</span>
                    <span className="font-bold text-red-600">-{formatCurrency(selectedWorkerPendingSalary.totalAdvances)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2">
                    <span>Net Payable:</span>
                    <span className="text-green-700 text-lg">{formatCurrency(selectedWorkerPendingSalary.netPayable)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input type="checkbox" id="partial" checked={paySalaryForm.partialPayment}
                  onChange={(e) => {
                    const partial = e.target.checked
                    const net = selectedWorkerPendingSalary?.netPayable || 0
                    setPaySalaryForm({ ...paySalaryForm, partialPayment: partial, amount: partial ? '' : (net > 0 ? net.toString() : '') })
                  }} className="h-4 w-4 rounded" />
                <Label htmlFor="partial" className="font-normal cursor-pointer text-sm">Partial payment</Label>
              </div>

              <div className="space-y-1">
                <Label>Amount to Pay (₹) *</Label>
                <Input type="number" value={paySalaryForm.amount}
                  onChange={(e) => setPaySalaryForm({ ...paySalaryForm, amount: e.target.value })}
                  required min="0" step="0.01"
                  disabled={!paySalaryForm.partialPayment}
                  className={!paySalaryForm.partialPayment ? 'bg-green-50 font-semibold' : ''} />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="deduct" checked={paySalaryForm.deductAdvances}
                  onChange={(e) => setPaySalaryForm({ ...paySalaryForm, deductAdvances: e.target.checked })} className="h-4 w-4 rounded" />
                <Label htmlFor="deduct" className="font-normal cursor-pointer text-sm">Auto-deduct outstanding advances</Label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Payment Mode *</Label>
                  <Select value={paySalaryForm.paymentMode} onValueChange={(v) => setPaySalaryForm({ ...paySalaryForm, paymentMode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Reference No.</Label>
                  <Input value={paySalaryForm.referenceNumber} onChange={(e) => setPaySalaryForm({ ...paySalaryForm, referenceNumber: e.target.value })} placeholder="UTR / Cheque" />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea value={paySalaryForm.notes} onChange={(e) => setPaySalaryForm({ ...paySalaryForm, notes: e.target.value })} placeholder="Salary payment for the month..." rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsPaySalaryOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">Pay Salary</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Pay Dialog */}
      <Dialog open={isBulkPayOpen} onOpenChange={(open) => { setIsBulkPayOpen(open); if (!open) { setSelectedWorkers([]); setBulkPayForm({ paymentMode: 'cash', referenceNumber: '', notes: '' }) } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleBulkPaySalary}>
            <DialogHeader>
              <DialogTitle>Bulk Salary Payment</DialogTitle>
              <DialogDescription>Select workers and pay their pending salaries at once</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {bulkSummary && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 grid grid-cols-4 gap-3 text-center">
                  <div><p className="text-xs text-gray-500">Workers</p><p className="font-bold text-lg">{bulkSummary.totalWorkers}</p></div>
                  <div><p className="text-xs text-gray-500">Pending</p><p className="font-bold text-lg text-orange-600">{formatCurrency(bulkSummary.totalPending)}</p></div>
                  <div><p className="text-xs text-gray-500">Advances</p><p className="font-bold text-lg text-red-600">-{formatCurrency(bulkSummary.totalAdvances)}</p></div>
                  <div><p className="text-xs text-gray-500">Net Payable</p><p className="font-bold text-lg text-green-600">{formatCurrency(bulkSummary.totalNetPayable)}</p></div>
                </div>
              )}

              {selectedWorkers.length > 0 && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-600">Selected:</span> <span className="font-bold">{getSelectedTotals().count} workers</span></div>
                  <div><span className="text-gray-600">Amount to Pay:</span> <span className="font-bold text-green-700">{formatCurrency(getSelectedTotals().totalNetPayable)}</span></div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="font-semibold">Select Workers</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setSelectedWorkers(bulkPendingWorkers.map(w => w.worker._id))}>All</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSelectedWorkers([])}>None</Button>
                  </div>
                </div>
                <div className="border rounded-lg max-h-52 overflow-y-auto divide-y">
                  {bulkPendingWorkers.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">No pending salaries found</div>
                  ) : bulkPendingWorkers.map((item) => (
                    <div key={item.worker._id}
                      className={`p-3 cursor-pointer flex items-center gap-3 ${item.netPayable >= 0 ? 'hover:bg-gray-50' : 'bg-red-50 hover:bg-red-100/50'}`}
                      onClick={() => toggleWorkerSelection(item.worker._id)}>
                      <input type="checkbox" checked={selectedWorkers.includes(item.worker._id)}
                        onChange={() => toggleWorkerSelection(item.worker._id)}
                        className="h-4 w-4 rounded" onClick={(e) => e.stopPropagation()} />
                      <div className="flex-1 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm">{item.worker.name}</p>
                          <p className="text-xs text-gray-400">{item.attendanceCount} records</p>
                        </div>
                        <div className="text-right">
                          {item.netPayable >= 0
                            ? <p className="font-bold text-green-600 text-sm">{formatCurrency(item.netPayable)}</p>
                            : <p className="font-bold text-red-600 text-sm">Owes {formatCurrency(Math.abs(item.netPayable))}</p>}
                          <p className="text-xs text-gray-400">Pending: {formatCurrency(item.totalPending)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedWorkers.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Payment Mode *</Label>
                      <Select value={bulkPayForm.paymentMode} onValueChange={(v) => setBulkPayForm({ ...bulkPayForm, paymentMode: v })} required>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Reference No.</Label>
                      <Input value={bulkPayForm.referenceNumber} onChange={(e) => setBulkPayForm({ ...bulkPayForm, referenceNumber: e.target.value })} placeholder="Batch ref" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Textarea value={bulkPayForm.notes} onChange={(e) => setBulkPayForm({ ...bulkPayForm, notes: e.target.value })} placeholder="Bulk salary payment for..." rows={2} />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsBulkPayOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={selectedWorkers.length === 0} className="bg-green-600 hover:bg-green-700">
                Pay {selectedWorkers.length} Worker{selectedWorkers.length !== 1 ? 's' : ''} — {formatCurrency(getSelectedTotals().totalNetPayable)}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the ledger entry and may affect the worker's balance.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
