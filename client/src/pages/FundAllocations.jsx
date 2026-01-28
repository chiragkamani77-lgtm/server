import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { fundsApi, usersApi, sitesApi } from '@/lib/api'
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
import { Plus, ArrowRight, ArrowDown, Wallet, TrendingUp, Clock, ChevronLeft, ChevronRight, Check, X, Eye, Receipt, Users, Building2, Edit, Trash2 } from 'lucide-react'
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

const PURPOSES = [
  { value: 'site_expense', label: 'Site Expense' },
  { value: 'labor_expense', label: 'Labor Expense' },
  { value: 'material', label: 'Material' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
]

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
  const [summary, setSummary] = useState(null)
  const [flowSummary, setFlowSummary] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [selectedAllocation, setSelectedAllocation] = useState(null)
  const [utilizationData, setUtilizationData] = useState(null)

  const [form, setForm] = useState({
    toUserId: '',
    siteId: '',
    amount: '',
    purpose: 'site_expense',
    description: '',
    referenceNumber: '',
  })

  useEffect(() => {
    if (user?._id) {
      fetchData()
    }
  }, [pagination.page, user?._id])

  const fetchData = async () => {
    if (!user?._id) return

    try {
      setLoading(true)
      const [allocationsRes, summaryRes, usersRes, sitesRes, flowRes] = await Promise.all([
        fundsApi.getAll({ page: pagination.page, limit: 20 }),
        fundsApi.getMySummary(),
        usersApi.getAll(),
        sitesApi.getAll(),
        isAdmin ? fundsApi.getFlowSummary() : Promise.resolve({ data: null }),
      ])
      setAllocations(allocationsRes.data?.allocations || [])
      setPagination(allocationsRes.data?.pagination || { page: 1, pages: 1, total: 0 })
      setSummary(summaryRes.data)
      setUsers((usersRes.data || []).filter(u => u._id !== user?._id))
      setSites(sitesRes.data || [])
      if (flowRes.data) setFlowSummary(flowRes.data)
    } catch (error) {
      console.error('Fund allocations error:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch fund allocations',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchUtilization = async (allocationId) => {
    try {
      const res = await fundsApi.getUtilization(allocationId)
      setUtilizationData(res.data)
      setSelectedAllocation(allocationId)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch utilization data',
        variant: 'destructive',
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        toUserId: form.toUserId,
        siteId: form.siteId || null,
        amount: parseFloat(form.amount),
        purpose: form.purpose,
        description: form.description,
        referenceNumber: form.referenceNumber,
      }

      if (editingId) {
        await fundsApi.update(editingId, payload)
        toast({ title: 'Fund allocation updated successfully' })
      } else {
        await fundsApi.create(payload)
        toast({ title: 'Fund allocation created successfully' })
      }

      setIsAddOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || `Failed to ${editingId ? 'update' : 'create'} allocation`,
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (allocation) => {
    if (!isAllocationEditable(allocation)) {
      toast({
        title: 'Cannot Edit',
        description: 'This allocation cannot be edited in its current status.',
        variant: 'destructive',
      })
      return
    }

    setForm({
      toUserId: allocation.toUser?._id || '',
      siteId: allocation.site?._id || '',
      amount: allocation.amount.toString(),
      purpose: allocation.purpose,
      description: allocation.description || '',
      referenceNumber: allocation.referenceNumber || '',
    })
    setEditingId(allocation._id)
    setIsAddOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return

    try {
      await fundsApi.delete(deleteId)
      toast({ title: 'Fund allocation deleted successfully' })
      setDeleteId(null)
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete allocation',
        variant: 'destructive',
      })
    }
  }

  const handleStatusUpdate = async (id, status) => {
    try {
      await fundsApi.updateStatus(id, status)
      toast({ title: `Allocation ${status}` })
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update status',
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setForm({
      toUserId: '',
      siteId: '',
      amount: '',
      purpose: 'site_expense',
      description: '',
      referenceNumber: '',
    })
    setEditingId(null)
  }

  // Business rule: Determine if allocation can be edited
  const isAllocationEditable = (allocation) => {
    if (!isAdmin && !isSupervisor) return false
    // Only pending and approved allocations can be edited
    // Disbursed and rejected are locked
    return allocation.status === 'pending' || allocation.status === 'approved'
  }

  // Business rule: Determine if allocation can be deleted
  const isAllocationDeletable = (allocation) => {
    if (!isAdmin && !isSupervisor) return false
    // Only pending allocations can be deleted
    // Once approved, disbursed, or rejected - cannot delete
    return allocation.status === 'pending'
  }

  // Determine which fields can be edited based on status
  const getEditableFields = (status) => {
    if (status === 'pending') {
      return { toUser: true, site: true, amount: true, purpose: true, description: true, reference: true }
    } else if (status === 'approved') {
      // Limited edit - only non-financial fields
      return { toUser: false, site: true, amount: false, purpose: false, description: true, reference: true }
    }
    return { toUser: false, site: false, amount: false, purpose: false, description: false, reference: false }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Fund Allocations</h1>
          <p className="text-muted-foreground">
            Track fund flow from developers to engineers and supervisors
          </p>
        </div>
        {(isAdmin || isSupervisor) && (
          <Button onClick={() => { resetForm(); setIsAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Allocate Funds
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Funds Received</CardTitle>
              <Wallet className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.received.total)}</div>
              <p className="text-xs text-muted-foreground">{summary.received.count} transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Funds Disbursed</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(summary.disbursed.total)}</div>
              <p className="text-xs text-muted-foreground">{summary.disbursed.count} transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending to Receive</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{formatCurrency(summary.pendingToReceive.total)}</div>
              <p className="text-xs text-muted-foreground">{summary.pendingToReceive.count} pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(summary.balance)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fund Flow Summary (Admin Only) */}
      {isAdmin && flowSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDown className="h-5 w-5" />
              Fund Flow Overview
            </CardTitle>
            <CardDescription>How funds flow through the organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              {/* Developer to Engineer */}
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-blue-500" />
                  <span className="font-medium text-sm">Developer → Engineer</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(flowSummary.fundFlow?.developerToEngineer?.total || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {flowSummary.fundFlow?.developerToEngineer?.count || 0} allocations
                </p>
              </div>

              {/* Engineer to Supervisor */}
              <div className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-950">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-purple-500" />
                  <span className="font-medium text-sm">Engineer → Supervisor</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(flowSummary.fundFlow?.engineerToSupervisor?.total || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {flowSummary.fundFlow?.engineerToSupervisor?.count || 0} allocations
                </p>
              </div>

              {/* Developer to Supervisor */}
              <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowRight className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-sm">Developer → Supervisor</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(flowSummary.fundFlow?.developerToSupervisor?.total || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {flowSummary.fundFlow?.developerToSupervisor?.count || 0} allocations
                </p>
              </div>
            </div>

            {/* Utilization Breakdown */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h4 className="font-medium mb-3">Fund Utilization Summary</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex justify-between items-center p-2 border rounded">
                  <span className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-orange-500" />
                    Expenses
                  </span>
                  <span className="font-medium">{formatCurrency(flowSummary.utilization?.expenses?.total || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-2 border rounded">
                  <span className="text-sm flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-blue-500" />
                    Bills
                  </span>
                  <span className="font-medium">{formatCurrency(flowSummary.utilization?.bills?.total || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-2 border rounded">
                  <span className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-500" />
                    Worker Ledger
                  </span>
                  <span className="font-medium">{formatCurrency(flowSummary.utilization?.workerLedger?.net || 0)}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <span className="font-medium">Total Disbursed vs Utilized</span>
                <div className="text-right">
                  <span className="text-green-600 font-bold">{formatCurrency(flowSummary.totalDisbursed || 0)}</span>
                  <span className="mx-2 text-muted-foreground">/</span>
                  <span className="text-blue-600 font-bold">{formatCurrency(flowSummary.totalUtilized || 0)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Utilization Detail Dialog */}
      {selectedAllocation && utilizationData && (
        <Dialog open={!!selectedAllocation} onOpenChange={() => { setSelectedAllocation(null); setUtilizationData(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Fund Utilization Details</DialogTitle>
              <DialogDescription>
                How this allocation of {formatCurrency(utilizationData.allocation?.amount)} has been utilized
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Summary */}
              <div className="grid gap-2 md:grid-cols-4 text-center">
                <div className="p-2 border rounded">
                  <p className="text-xs text-muted-foreground">Allocated</p>
                  <p className="font-bold text-green-600">{formatCurrency(utilizationData.summary?.allocated || 0)}</p>
                </div>
                <div className="p-2 border rounded">
                  <p className="text-xs text-muted-foreground">Utilized</p>
                  <p className="font-bold text-blue-600">{formatCurrency(utilizationData.summary?.totalUtilized || 0)}</p>
                </div>
                <div className="p-2 border rounded">
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className={`font-bold ${utilizationData.summary?.remainingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(utilizationData.summary?.remainingBalance || 0)}
                  </p>
                </div>
                <div className="p-2 border rounded">
                  <p className="text-xs text-muted-foreground">Utilization</p>
                  <p className="font-bold">{utilizationData.summary?.utilizationPercent}%</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                  <span>Expenses ({utilizationData.utilization?.expenses?.count || 0})</span>
                  <span className="font-medium">{formatCurrency(utilizationData.utilization?.expenses?.total || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span>Bills ({utilizationData.utilization?.bills?.count || 0})</span>
                  <span className="font-medium">{formatCurrency(utilizationData.utilization?.bills?.total || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                  <span>Worker Ledger ({utilizationData.utilization?.workerLedger?.count || 0})</span>
                  <span className="font-medium">{formatCurrency(utilizationData.utilization?.workerLedger?.net || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span>Sub-Allocations ({utilizationData.utilization?.subAllocations?.count || 0})</span>
                  <span className="font-medium">{formatCurrency(utilizationData.utilization?.subAllocations?.total || 0)}</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Allocations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fund Allocation History</CardTitle>
          <CardDescription>Showing {allocations.length} of {pagination.total} entries</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>From</TableHead>
              <TableHead></TableHead>
              <TableHead>To</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
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
            ) : allocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No fund allocations found
                </TableCell>
              </TableRow>
            ) : (
              allocations.map((allocation) => (
                <TableRow key={allocation._id}>
                  <TableCell>{formatDate(allocation.allocationDate)}</TableCell>
                  <TableCell className="font-medium">{allocation.fromUser?.name}</TableCell>
                  <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  <TableCell className="font-medium">{allocation.toUser?.name}</TableCell>
                  <TableCell>{allocation.site?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {PURPOSES.find(p => p.value === allocation.purpose)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[allocation.status]}>
                      {allocation.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(allocation.amount)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {allocation.status === 'disbursed' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => fetchUtilization(allocation._id)}
                          title="View Utilization"
                        >
                          <Eye className="h-4 w-4 text-blue-500" />
                        </Button>
                      )}
                      {isAdmin && allocation.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusUpdate(allocation._id, 'approved')}
                            title="Approve"
                          >
                            <Check className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusUpdate(allocation._id, 'rejected')}
                            title="Reject"
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                      {allocation.toUser?._id === user._id && allocation.status === 'approved' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(allocation._id, 'disbursed')}
                        >
                          Mark Received
                        </Button>
                      )}
                      {(isAdmin || isSupervisor) && isAllocationEditable(allocation) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(allocation)}
                          title="Edit Allocation"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {(isAdmin || isSupervisor) && isAllocationDeletable(allocation) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(allocation._id)}
                          title="Delete Allocation"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
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
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Fund Allocation' : 'Allocate Funds'}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? 'Update fund allocation details. Some fields may be locked based on allocation status.'
                  : 'Transfer funds to a team member for site expenses'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {editingId && (() => {
                const currentAllocation = allocations.find(a => a._id === editingId)
                const editableFields = currentAllocation ? getEditableFields(currentAllocation.status) : {}
                const hasLimitedEdit = currentAllocation?.status === 'approved'

                return hasLimitedEdit && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Limited Edit Mode:</strong> This allocation is approved. You can only edit description, reference, and site. Amount and recipient cannot be changed.
                    </p>
                  </div>
                )
              })()}

              <div className="space-y-2">
                <Label>Recipient</Label>
                <Select
                  value={form.toUserId}
                  onValueChange={(value) => setForm({ ...form, toUserId: value })}
                  required
                  disabled={editingId && !(() => {
                    const currentAllocation = allocations.find(a => a._id === editingId)
                    return currentAllocation ? getEditableFields(currentAllocation.status).toUser : false
                  })()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.name} ({u.role === 1 ? 'Developer' : u.role === 2 ? 'Engineer' : u.role === 3 ? 'Supervisor' : 'Worker'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Site (Optional)</Label>
                <Select
                  value={form.siteId}
                  onValueChange={(value) => setForm({ ...form, siteId: value === 'none' ? '' : value })}
                  disabled={editingId && !(() => {
                    const currentAllocation = allocations.find(a => a._id === editingId)
                    return currentAllocation ? getEditableFields(currentAllocation.status).site : false
                  })()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific site</SelectItem>
                    {sites.map((site) => (
                      <SelectItem key={site._id} value={site._id}>
                        {site.name}
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
                  placeholder="50000"
                  required
                  min="0"
                  disabled={editingId && !(() => {
                    const currentAllocation = allocations.find(a => a._id === editingId)
                    return currentAllocation ? getEditableFields(currentAllocation.status).amount : false
                  })()}
                />
              </div>
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Select
                  value={form.purpose}
                  onValueChange={(value) => setForm({ ...form, purpose: value })}
                  disabled={editingId && !(() => {
                    const currentAllocation = allocations.find(a => a._id === editingId)
                    return currentAllocation ? getEditableFields(currentAllocation.status).purpose : false
                  })()}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map((purpose) => (
                      <SelectItem key={purpose.value} value={purpose.value}>
                        {purpose.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="For cement and steel purchase"
                />
              </div>
              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input
                  value={form.referenceNumber}
                  onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                  placeholder="TXN123456"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">{editingId ? 'Update Allocation' : 'Allocate Funds'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fund Allocation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this fund allocation? This action cannot be undone. Only pending allocations can be deleted.
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
