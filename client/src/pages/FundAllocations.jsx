import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { fundsApi, usersApi, sitesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Wallet, Edit, Trash2, Check, X, Eye } from 'lucide-react'
import {
  PageLayout, PageHeader, SummaryBanner,
  ListItem, ActionBtn, PagePagination, EmptyState,
} from '@/components/page'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  disbursed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function FundAllocations() {
  const { user, isAdmin, isSupervisor } = useAuth()
  const { toast } = useToast()

  const [allocations, setAllocations] = useState([])
  const [users, setUsers] = useState([])
  const [sites, setSites] = useState([])
  const [flowSummary, setFlowSummary] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [selectedAllocation, setSelectedAllocation] = useState(null)
  const [utilizationData, setUtilizationData] = useState(null)
  const [walletSummary, setWalletSummary] = useState(null)
  const [investmentPool, setInvestmentPool] = useState(null)

  const [form, setForm] = useState({
    toUserId: '',
    siteId: '',
    amount: '',
    description: '',
    referenceNumber: '',
  })

  const amountEntered = parseFloat(form.amount) > 0

  useEffect(() => {
    if (user?._id) fetchData()
  }, [pagination.page, user?._id])

  const fetchData = async () => {
    if (!user?._id) return
    try {
      setLoading(true)
      const [allocationsRes, usersRes, sitesRes, flowRes, walletRes, poolRes] = await Promise.all([
        fundsApi.getAll({ page: pagination.page, limit: 20 }),
        usersApi.getAll(),
        sitesApi.getAll(),
        isAdmin ? fundsApi.getFlowSummary() : Promise.resolve({ data: null }),
        fundsApi.getWalletSummary(),
        isAdmin ? fundsApi.getInvestmentPoolSummary() : Promise.resolve({ data: null }),
      ])
      setAllocations(allocationsRes.data?.allocations || [])
      setPagination(allocationsRes.data?.pagination || { page: 1, pages: 1, total: 0 })
      setUsers((usersRes.data || []).filter(u => isAdmin ? true : u._id !== user?._id).filter(u => u.role !== 4))
      setSites(sitesRes.data || [])
      if (flowRes.data) setFlowSummary(flowRes.data)
      if (walletRes.data) setWalletSummary(walletRes.data)
      if (poolRes.data) setInvestmentPool(poolRes.data)
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to fetch data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const fetchUtilization = async (allocationId) => {
    try {
      const res = await fundsApi.getUtilization(allocationId)
      setUtilizationData(res.data)
      setSelectedAllocation(allocationId)
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch utilization data', variant: 'destructive' })
    }
  }

  const handleToUserChange = (userId) => {
    // Auto-detect site from selected user's assigned site
    const autoSite = sites.find(s =>
      s.assignedUsers?.some(uid => (uid?._id || uid)?.toString() === userId)
    )
    setForm(prev => ({ ...prev, toUserId: userId, siteId: autoSite?._id || '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        toUserId: form.toUserId,
        siteId: form.siteId || null,
        amount: parseFloat(form.amount),
        description: form.description,
        referenceNumber: form.referenceNumber,
      }
      if (editingId) {
        await fundsApi.updateStatus(editingId, payload)
        toast({ title: 'Allocation updated' })
      } else {
        await fundsApi.create(payload)
        toast({ title: 'Funds allocated successfully' })
      }
      setSheetOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to save', variant: 'destructive' })
    }
  }

  const handleEdit = (allocation) => {
    if (!isAllocationEditable(allocation)) {
      toast({ title: 'Cannot edit this allocation', variant: 'destructive' })
      return
    }
    const autoSite = allocation.site?._id || ''
    setForm({
      toUserId: allocation.toUser?._id || '',
      siteId: autoSite,
      amount: allocation.amount.toString(),
      description: allocation.description || '',
      referenceNumber: allocation.referenceNumber || '',
    })
    setEditingId(allocation._id)
    setSheetOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await fundsApi.delete(deleteId)
      toast({ title: 'Allocation deleted' })
      setDeleteId(null)
      fetchData()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to delete', variant: 'destructive' })
    }
  }

  const handleStatusUpdate = async (id, status) => {
    try {
      await fundsApi.updateStatus(id, status)
      toast({ title: `Allocation ${status}` })
      fetchData()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to update status', variant: 'destructive' })
    }
  }

  const resetForm = () => {
    setForm({ toUserId: '', siteId: '', amount: '', description: '', referenceNumber: '' })
    setEditingId(null)
  }

  const isAllocationEditable = (allocation) => {
    if (isAdmin) return true
    if (isSupervisor) return allocation.status === 'pending' || allocation.status === 'approved'
    return false
  }

  const isAllocationDeletable = (allocation) => {
    if (isAdmin) return true
    if (isSupervisor) return allocation.status === 'pending'
    return false
  }

  const summaryItems = walletSummary
    ? [
        {
          label: isAdmin ? 'Investment Pool' : 'Total Received',
          value: isAdmin && investmentPool
            ? formatCurrency(investmentPool.totalInvestment || 0)
            : formatCurrency(walletSummary.totalReceived || 0),
        },
        { label: 'Total Spent', value: formatCurrency(walletSummary.totalSpent || 0) },
        { label: 'Remaining', value: formatCurrency(walletSummary.remainingBalance || 0) },
      ]
    : [{ label: 'Loading...', value: '—' }]

  return (
    <PageLayout>
      <PageHeader title="Fund Allocations" subtitle={`${pagination.total} entries`}>
        {(isAdmin || isSupervisor) && (
          <Button size="sm" onClick={() => { resetForm(); setSheetOpen(true) }} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-1" />
            Allocate
          </Button>
        )}
      </PageHeader>

      <SummaryBanner
        color="blue"
        icon={<Wallet className="h-8 w-8" />}
        items={summaryItems}
      />

      {/* Utilization breakdown mini cards */}
      {walletSummary?.breakdown && (
        <div className="px-4 pb-2 grid grid-cols-3 gap-2">
          <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
            <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wide">Expenses</p>
            <p className="text-sm font-bold text-orange-700 mt-0.5">{formatCurrency(walletSummary.breakdown.expenses?.total || 0)}</p>
            <p className="text-[10px] text-gray-400">{walletSummary.breakdown.expenses?.count || 0} entries</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">GST Bills</p>
            <p className="text-sm font-bold text-blue-700 mt-0.5">{formatCurrency(walletSummary.breakdown.bills?.total || 0)}</p>
            <p className="text-[10px] text-gray-400">{walletSummary.breakdown.bills?.count || 0} bills</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
            <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide">Labour</p>
            <p className="text-sm font-bold text-purple-700 mt-0.5">{formatCurrency(walletSummary.breakdown.ledger?.net || 0)}</p>
            <p className="text-[10px] text-gray-400">Paid out</p>
          </div>
        </div>
      )}

      {/* Fund Flow Overview (Admin only) */}
      {isAdmin && flowSummary && (
        <div className="px-4 pb-2">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fund Flow Overview</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <p className="text-[10px] text-blue-500 mb-1">Dev → Engineer</p>
                <p className="text-sm font-bold text-blue-700">{formatCurrency(flowSummary.fundFlow?.developerToEngineer?.total || 0)}</p>
              </div>
              <div className="text-center p-2 bg-purple-50 rounded-lg">
                <p className="text-[10px] text-purple-500 mb-1">Eng → Supervisor</p>
                <p className="text-sm font-bold text-purple-700">{formatCurrency(flowSummary.fundFlow?.engineerToSupervisor?.total || 0)}</p>
              </div>
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <p className="text-[10px] text-green-500 mb-1">Dev → Supervisor</p>
                <p className="text-sm font-bold text-green-700">{formatCurrency(flowSummary.fundFlow?.developerToSupervisor?.total || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Allocations list */}
      <div className="flex-1">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : allocations.length === 0 ? (
          <EmptyState
            message="No fund allocations yet"
            action={(isAdmin || isSupervisor) && (
              <Button variant="outline" size="sm" onClick={() => { resetForm(); setSheetOpen(true) }}>
                <Plus className="h-4 w-4 mr-1" /> Allocate Funds
              </Button>
            )}
            icon={<Wallet className="h-12 w-12" />}
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {allocations.map((allocation) => (
              <ListItem
                key={allocation._id}
                avatar={allocation.fromUser?.name}
                avatarColor="blue"
                title={`${allocation.fromUser?.name || '—'} → ${allocation.toUser?.name || '—'}`}
                subtitle={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-400">{formatDate(allocation.allocationDate)}</span>
                    {allocation.site?.name && <span className="text-xs text-gray-400">• {allocation.site.name}</span>}
                    {allocation.referenceNumber && (
                      <span className="text-xs text-gray-400">• Ref: {allocation.referenceNumber}</span>
                    )}
                  </div>
                }
                amount={formatCurrency(allocation.amount)}
                badge={{ label: allocation.status, className: STATUS_COLORS[allocation.status] || '' }}
                actions={
                  <>
                    {allocation.status === 'disbursed' && (
                      <ActionBtn
                        onClick={() => fetchUtilization(allocation._id)}
                        title="View Usage"
                        icon={Eye}
                        hoverClass="hover:text-blue-600 hover:bg-blue-50"
                      />
                    )}
                    {isAdmin && allocation.status === 'pending' && (
                      <>
                        <ActionBtn
                          onClick={() => handleStatusUpdate(allocation._id, 'approved')}
                          title="Approve"
                          icon={Check}
                          hoverClass="hover:text-green-600 hover:bg-green-50"
                        />
                        <ActionBtn
                          onClick={() => handleStatusUpdate(allocation._id, 'rejected')}
                          title="Reject"
                          icon={X}
                          hoverClass="hover:text-red-600 hover:bg-red-50"
                        />
                      </>
                    )}
                    {allocation.toUser?._id === user._id && allocation.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => handleStatusUpdate(allocation._id, 'disbursed')}
                      >
                        Mark Received
                      </Button>
                    )}
                    {(isAdmin || isSupervisor) && isAllocationEditable(allocation) && (
                      <ActionBtn onClick={() => handleEdit(allocation)} title="Edit" icon={Edit} />
                    )}
                    {(isAdmin || isSupervisor) && isAllocationDeletable(allocation) && (
                      <ActionBtn
                        onClick={() => setDeleteId(allocation._id)}
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

      {/* Add/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) resetForm() }}>
        <SheetContent title={editingId ? 'Edit Allocation' : 'Allocate Funds'}>
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {/* Amount first */}
            <div className="space-y-1">
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="e.g. 50000"
                required
                min="0"
                autoFocus
              />
            </div>

            {/* Rest shown when amount is entered */}
            {amountEntered && (
              <>
                <div className="space-y-1">
                  <Label>Send Money To *</Label>
                  <Select
                    value={form.toUserId}
                    onValueChange={handleToUserChange}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u._id} value={u._id}>
                          {u.name} ({u.role === 1 ? 'Developer' : u.role === 2 ? 'Engineer' : 'Supervisor'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Site — auto-detected from selected user */}
                {form.toUserId && (
                  <div className="rounded-md bg-muted px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Site: </span>
                    <span className="font-medium">
                      {sites.find(s => s._id === form.siteId)?.name || 'No site assigned'}
                    </span>
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Description / Note</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="e.g. For cement and steel purchase"
                    rows={3}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Reference / Transaction No.</Label>
                  <Input
                    value={form.referenceNumber}
                    onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                    placeholder="e.g. TXN123456"
                  />
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700"
              disabled={!amountEntered || !form.toUserId}
            >
              {editingId ? 'Save Changes' : 'Send Funds'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Utilization Detail Dialog */}
      <Dialog
        open={!!selectedAllocation}
        onOpenChange={() => { setSelectedAllocation(null); setUtilizationData(null) }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fund Usage Details</DialogTitle>
            <DialogDescription>
              {utilizationData && `How ${formatCurrency(utilizationData.allocation?.amount)} was used`}
            </DialogDescription>
          </DialogHeader>
          {utilizationData && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Allocated', value: formatCurrency(utilizationData.summary?.allocated || 0), color: 'text-green-600' },
                  { label: 'Used', value: formatCurrency(utilizationData.summary?.totalUtilized || 0), color: 'text-blue-600' },
                  {
                    label: 'Remaining',
                    value: formatCurrency(utilizationData.summary?.remainingBalance || 0),
                    color: utilizationData.summary?.remainingBalance >= 0 ? 'text-green-600' : 'text-red-600',
                  },
                  { label: 'Used %', value: `${utilizationData.summary?.utilizationPercent}%`, color: 'text-gray-700' },
                ].map((item) => (
                  <div key={item.label} className="p-2 border rounded-lg">
                    <p className="text-[10px] text-gray-400">{item.label}</p>
                    <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Expenses', count: utilizationData.utilization?.expenses?.count, total: utilizationData.utilization?.expenses?.total, bg: 'bg-orange-50' },
                  { label: 'GST Bills', count: utilizationData.utilization?.bills?.count, total: utilizationData.utilization?.bills?.total, bg: 'bg-blue-50' },
                  { label: 'Worker Ledger', count: utilizationData.utilization?.workerLedger?.count, total: utilizationData.utilization?.workerLedger?.net, bg: 'bg-purple-50' },
                  { label: 'Sub-Allocations', count: utilizationData.utilization?.subAllocations?.count, total: utilizationData.utilization?.subAllocations?.total, bg: 'bg-green-50' },
                ].map((row) => (
                  <div key={row.label} className={`flex justify-between items-center p-3 rounded-lg ${row.bg}`}>
                    <span className="text-sm">{row.label} ({row.count || 0})</span>
                    <span className="font-semibold">{formatCurrency(row.total || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this allocation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the fund allocation. This cannot be undone.
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
    </PageLayout>
  )
}
