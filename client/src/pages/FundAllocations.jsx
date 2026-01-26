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
import { Plus, ArrowRight, Wallet, TrendingUp, Clock, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'

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
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)

  const [form, setForm] = useState({
    toUserId: '',
    siteId: '',
    amount: '',
    purpose: 'site_expense',
    description: '',
    referenceNumber: '',
  })

  useEffect(() => {
    fetchData()
  }, [pagination.page])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [allocationsRes, summaryRes, usersRes, sitesRes] = await Promise.all([
        fundsApi.getAll({ page: pagination.page, limit: 20 }),
        fundsApi.getMySummary(),
        usersApi.getAll(),
        sitesApi.getAll(),
      ])
      setAllocations(allocationsRes.data.allocations)
      setPagination(allocationsRes.data.pagination)
      setSummary(summaryRes.data)
      setUsers(usersRes.data.filter(u => u._id !== user._id))
      setSites(sitesRes.data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch fund allocations',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await fundsApi.create({
        toUserId: form.toUserId,
        siteId: form.siteId || null,
        amount: parseFloat(form.amount),
        purpose: form.purpose,
        description: form.description,
        referenceNumber: form.referenceNumber,
      })
      toast({ title: 'Fund allocation created successfully' })
      setIsAddOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create allocation',
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
                    <div className="flex gap-1">
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

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Allocate Funds</DialogTitle>
              <DialogDescription>Transfer funds to a team member for site expenses</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Recipient</Label>
                <Select
                  value={form.toUserId}
                  onValueChange={(value) => setForm({ ...form, toUserId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipient" />
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
              <div className="space-y-2">
                <Label>Site (Optional)</Label>
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
                />
              </div>
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Select
                  value={form.purpose}
                  onValueChange={(value) => setForm({ ...form, purpose: value })}
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
              <Button type="submit">Allocate Funds</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
